"""
Spike Hunter Strategy

Based on Twitter research (@0xReflection, @hanakoxbt, @carverfomo):
"Detect 2%+ price moves in <30 seconds, enter mean-reversion trades with tight stops."

This strategy targets rapid price spikes in prediction markets that overshoot fair value.
Key insight: Fast moves are often followed by reversions - market makers re-price quickly.

Strategy mechanics:
1. Monitor all active markets via WebSocket for real-time price updates
2. Detect price spikes: 2%+ move within 30 seconds
3. Calculate spike direction and magnitude
4. Enter contrarian position (against the spike)
5. Use tight stop-loss (3%) and take-profit (1.5%)
6. Exit within 5 minutes max hold time

Risk management:
- Max 3 concurrent spike positions
- Max $50 per position
- 3% stop loss (cut losses quickly)
- 5-minute max hold time (avoid getting trapped)

Expected returns: $5K-$100K/month (per Twitter traders)
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
from collections import deque
import statistics

logger = logging.getLogger(__name__)


class SpikeType(Enum):
    """Types of price spikes"""
    SPIKE_UP = "spike_up"      # Price shot up - expect reversion down
    SPIKE_DOWN = "spike_down"  # Price crashed - expect reversion up
    NO_SPIKE = "no_spike"


@dataclass
class PricePoint:
    """A single price observation"""
    price: float
    timestamp: float  # Unix timestamp
    volume: float = 0.0


@dataclass
class SpikeOpportunity:
    """A spike trading opportunity"""
    id: str
    detected_at: datetime
    platform: str
    spike_type: SpikeType
    
    # Market info
    market_id: str
    market_title: str
    token_id: Optional[str] = None
    
    # Spike details
    spike_start_price: float = 0.0
    spike_end_price: float = 0.0
    spike_magnitude_pct: float = 0.0  # How big was the spike
    spike_duration_sec: float = 0.0   # How fast was the spike
    
    # Trade details
    entry_side: str = ""       # "YES" or "NO" - opposite of spike direction
    entry_price: float = 0.0
    target_price: float = 0.0  # Mean reversion target
    stop_loss_price: float = 0.0
    expected_profit_pct: float = 0.0
    
    # Position tracking
    position_size_usd: float = 0.0
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    realized_pnl: Optional[float] = None
    exit_reason: Optional[str] = None  # "target", "stop_loss", "timeout"
    
    def __str__(self) -> str:
        direction = "↑" if self.spike_type == SpikeType.SPIKE_UP else "↓"
        return (
            f"Spike {direction} {self.spike_magnitude_pct:.1f}% in {self.spike_duration_sec:.0f}s | "
            f"Trade {self.entry_side} @ {self.entry_price:.2%} | "
            f"Target={self.target_price:.2%}"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "platform": self.platform,
            "spike_type": self.spike_type.value,
            "market_id": self.market_id,
            "market_title": self.market_title,
            "spike_magnitude_pct": self.spike_magnitude_pct,
            "spike_duration_sec": self.spike_duration_sec,
            "entry_side": self.entry_side,
            "entry_price": self.entry_price,
            "target_price": self.target_price,
            "stop_loss_price": self.stop_loss_price,
            "expected_profit_pct": self.expected_profit_pct,
        }


@dataclass
class SpikeStats:
    """Statistics for spike hunting"""
    total_scans: int = 0
    spikes_detected: int = 0
    trades_entered: int = 0
    trades_exited: int = 0
    trades_won: int = 0
    trades_lost: int = 0
    total_pnl: float = 0.0
    avg_hold_time_sec: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    
    @property
    def win_rate(self) -> float:
        total = self.trades_won + self.trades_lost
        return self.trades_won / total if total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_scans": self.total_scans,
            "spikes_detected": self.spikes_detected,
            "trades_entered": self.trades_entered,
            "win_rate": f"{self.win_rate:.1%}",
            "total_pnl": f"${self.total_pnl:.2f}",
        }


class SpikeHunterStrategy:
    """
    Spike Hunter Strategy - Mean reversion on rapid price moves.
    
    Based on Twitter alpha from @0xReflection, @hanakoxbt, @carverfomo:
    - Detect 2%+ price moves in <30 seconds
    - Enter contrarian positions (fade the spike)
    - Use tight stops and quick exits
    
    Config keys:
    - enable_spike_hunter: Enable/disable strategy
    - spike_min_magnitude_pct: Minimum spike size (default: 2.0%)
    - spike_max_duration_sec: Max time for spike detection (default: 30s)
    - spike_take_profit_pct: Target profit (default: 1.5%)
    - spike_stop_loss_pct: Stop loss (default: 3.0%)
    - spike_max_hold_sec: Max hold time (default: 300s = 5 min)
    - spike_max_position_usd: Max position size (default: 50)
    - spike_max_concurrent: Max concurrent positions (default: 3)
    """
    
    def __init__(
        self,
        enabled: bool = True,
        min_magnitude_pct: float = 2.0,
        max_duration_sec: float = 30.0,
        take_profit_pct: float = 1.5,
        stop_loss_pct: float = 3.0,
        max_hold_sec: float = 300.0,  # 5 minutes
        max_position_usd: float = 50.0,
        max_concurrent: int = 3,
        lookback_window: int = 60,  # Keep 60 seconds of price history
        on_opportunity: Optional[Callable[[SpikeOpportunity], None]] = None,
    ):
        self.enabled = enabled
        self.min_magnitude_pct = min_magnitude_pct
        self.max_duration_sec = max_duration_sec
        self.take_profit_pct = take_profit_pct
        self.stop_loss_pct = stop_loss_pct
        self.max_hold_sec = max_hold_sec
        self.max_position_usd = max_position_usd
        self.max_concurrent = max_concurrent
        self.lookback_window = lookback_window
        
        # Callback for opportunity notification
        self._on_opportunity = on_opportunity
        
        # Price history per market: market_id -> deque of PricePoints
        self._price_history: Dict[str, deque] = {}
        
        # Active positions
        self._active_positions: Dict[str, SpikeOpportunity] = {}
        
        # Recent spikes (to avoid re-trading same spike)
        self._recent_spikes: Dict[str, datetime] = {}
        self._spike_cooldown_sec: float = 60.0  # Don't retrade same market for 60s
        
        # Statistics
        self.stats = SpikeStats()
        
        # Running state
        self._is_running = False
        self._last_scan_time = 0.0
    
    def update_price(
        self,
        market_id: str,
        price: float,
        volume: float = 0.0,
        timestamp: Optional[float] = None,
    ) -> Optional[SpikeOpportunity]:
        """
        Update price for a market and check for spikes.
        
        Called by WebSocket price handler or polling loop.
        
        Args:
            market_id: The market identifier
            price: Current price (0-1 for prediction markets)
            volume: Current volume
            timestamp: Unix timestamp (defaults to now)
            
        Returns:
            SpikeOpportunity if spike detected, None otherwise
        """
        if not self.enabled:
            return None
        
        ts = timestamp or time.time()
        
        # Initialize price history for new markets
        if market_id not in self._price_history:
            self._price_history[market_id] = deque(maxlen=self.lookback_window * 10)
        
        # Add new price point
        self._price_history[market_id].append(PricePoint(
            price=price,
            timestamp=ts,
            volume=volume,
        ))
        
        # Check for spike
        return self._detect_spike(market_id)
    
    def _detect_spike(self, market_id: str) -> Optional[SpikeOpportunity]:
        """
        Detect if a spike has occurred in the given market.
        
        A spike is defined as:
        - Price move >= min_magnitude_pct
        - Within max_duration_sec time window
        """
        history = self._price_history.get(market_id)
        if not history or len(history) < 2:
            return None
        
        self.stats.total_scans += 1
        
        # Get current price
        current = history[-1]
        current_price = current.price
        current_time = current.timestamp
        
        # Check if we're in cooldown for this market
        if market_id in self._recent_spikes:
            cooldown_end = self._recent_spikes[market_id] + timedelta(seconds=self._spike_cooldown_sec)
            if datetime.now(timezone.utc) < cooldown_end:
                return None
        
        # Check if we already have too many positions
        if len(self._active_positions) >= self.max_concurrent:
            return None
        
        # Look back through price history for spike detection
        for point in reversed(list(history)[:-1]):
            time_diff = current_time - point.timestamp
            
            # Only look at prices within our detection window
            if time_diff > self.max_duration_sec:
                break
            
            # Skip very recent prices (need some time delta)
            if time_diff < 1.0:
                continue
            
            # Calculate price change
            old_price = point.price
            price_change_pct = ((current_price - old_price) / old_price) * 100 if old_price > 0 else 0
            
            # Check for spike (up or down)
            if abs(price_change_pct) >= self.min_magnitude_pct:
                spike_type = SpikeType.SPIKE_UP if price_change_pct > 0 else SpikeType.SPIKE_DOWN
                
                # Create opportunity
                opp = self._create_opportunity(
                    market_id=market_id,
                    spike_type=spike_type,
                    spike_start_price=old_price,
                    spike_end_price=current_price,
                    spike_magnitude_pct=abs(price_change_pct),
                    spike_duration_sec=time_diff,
                )
                
                if opp:
                    self.stats.spikes_detected += 1
                    self._recent_spikes[market_id] = datetime.now(timezone.utc)
                    
                    # Notify callback
                    if self._on_opportunity:
                        self._on_opportunity(opp)
                    
                    logger.info(f"🎯 SPIKE DETECTED: {opp}")
                    return opp
        
        return None
    
    def _create_opportunity(
        self,
        market_id: str,
        spike_type: SpikeType,
        spike_start_price: float,
        spike_end_price: float,
        spike_magnitude_pct: float,
        spike_duration_sec: float,
    ) -> Optional[SpikeOpportunity]:
        """Create a spike trading opportunity."""
        
        # Determine trade direction (fade the spike)
        if spike_type == SpikeType.SPIKE_UP:
            # Price went up fast - bet it comes back down
            entry_side = "NO"
            entry_price = 1.0 - spike_end_price  # NO price
            target_price = entry_price * (1 + self.take_profit_pct / 100)
            stop_loss_price = entry_price * (1 - self.stop_loss_pct / 100)
        else:
            # Price crashed - bet it bounces
            entry_side = "YES"
            entry_price = spike_end_price
            target_price = entry_price * (1 + self.take_profit_pct / 100)
            stop_loss_price = entry_price * (1 - self.stop_loss_pct / 100)
        
        # Validate entry makes sense
        if entry_price <= 0.05 or entry_price >= 0.95:
            logger.debug(f"Skip spike - entry price {entry_price:.2%} too extreme")
            return None
        
        return SpikeOpportunity(
            id=str(uuid.uuid4()),
            detected_at=datetime.now(timezone.utc),
            platform="polymarket",  # Default, can be overridden
            spike_type=spike_type,
            market_id=market_id,
            market_title=market_id,  # Will be enriched later
            spike_start_price=spike_start_price,
            spike_end_price=spike_end_price,
            spike_magnitude_pct=spike_magnitude_pct,
            spike_duration_sec=spike_duration_sec,
            entry_side=entry_side,
            entry_price=entry_price,
            target_price=target_price,
            stop_loss_price=stop_loss_price,
            expected_profit_pct=self.take_profit_pct,
            position_size_usd=self.max_position_usd,
        )
    
    def enter_position(self, opp: SpikeOpportunity) -> bool:
        """
        Enter a spike position (paper or live).
        
        Args:
            opp: The spike opportunity to trade
            
        Returns:
            True if position entered, False otherwise
        """
        if len(self._active_positions) >= self.max_concurrent:
            logger.warning(f"Cannot enter - max concurrent positions ({self.max_concurrent}) reached")
            return False
        
        opp.entry_time = datetime.now(timezone.utc)
        self._active_positions[opp.id] = opp
        self.stats.trades_entered += 1
        
        logger.info(f"📈 SPIKE ENTRY: {opp.entry_side} @ {opp.entry_price:.2%} | "
                   f"Target={opp.target_price:.2%} | Stop={opp.stop_loss_price:.2%}")
        
        return True
    
    def check_exit(
        self,
        opp_id: str,
        current_price: float,
    ) -> Optional[Tuple[str, float]]:
        """
        Check if a position should exit.
        
        Args:
            opp_id: The opportunity ID
            current_price: Current market price for the entry side
            
        Returns:
            Tuple of (exit_reason, exit_price) if should exit, None otherwise
        """
        opp = self._active_positions.get(opp_id)
        if not opp:
            return None
        
        now = datetime.now(timezone.utc)
        hold_time = (now - opp.entry_time).total_seconds() if opp.entry_time else 0
        
        # Check timeout
        if hold_time >= self.max_hold_sec:
            return ("timeout", current_price)
        
        # Check take profit
        if current_price >= opp.target_price:
            return ("target", current_price)
        
        # Check stop loss
        if current_price <= opp.stop_loss_price:
            return ("stop_loss", current_price)
        
        return None
    
    def exit_position(
        self,
        opp_id: str,
        exit_price: float,
        exit_reason: str,
    ) -> Optional[float]:
        """
        Exit a spike position.
        
        Args:
            opp_id: The opportunity ID
            exit_price: Price at exit
            exit_reason: Why we're exiting ("target", "stop_loss", "timeout")
            
        Returns:
            Realized P&L in USD
        """
        opp = self._active_positions.pop(opp_id, None)
        if not opp:
            return None
        
        opp.exit_time = datetime.now(timezone.utc)
        opp.exit_price = exit_price
        opp.exit_reason = exit_reason
        
        # Calculate P&L
        price_diff = exit_price - opp.entry_price
        pnl_pct = price_diff / opp.entry_price if opp.entry_price > 0 else 0
        pnl_usd = opp.position_size_usd * pnl_pct
        opp.realized_pnl = pnl_usd
        
        # Update stats
        self.stats.trades_exited += 1
        self.stats.total_pnl += pnl_usd
        
        if pnl_usd >= 0:
            self.stats.trades_won += 1
            self.stats.largest_win = max(self.stats.largest_win, pnl_usd)
        else:
            self.stats.trades_lost += 1
            self.stats.largest_loss = min(self.stats.largest_loss, pnl_usd)
        
        # Update average hold time
        hold_time = (opp.exit_time - opp.entry_time).total_seconds() if opp.entry_time else 0
        n = self.stats.trades_exited
        self.stats.avg_hold_time_sec = ((self.stats.avg_hold_time_sec * (n - 1)) + hold_time) / n
        
        emoji = "✅" if pnl_usd >= 0 else "❌"
        logger.info(f"{emoji} SPIKE EXIT ({exit_reason}): {opp.entry_side} @ {exit_price:.2%} | "
                   f"P&L: ${pnl_usd:+.2f} ({pnl_pct:+.1%}) | Hold: {hold_time:.0f}s")
        
        return pnl_usd
    
    @property
    def active_positions(self) -> List[SpikeOpportunity]:
        """Get list of active positions."""
        return list(self._active_positions.values())
    
    def clear_stale_history(self, max_age_sec: float = 120.0):
        """Clear old price history to save memory."""
        now = time.time()
        cutoff = now - max_age_sec
        
        for market_id, history in self._price_history.items():
            # Remove old entries
            while history and history[0].timestamp < cutoff:
                history.popleft()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get strategy statistics."""
        return self.stats.to_dict()
    
    def reset_stats(self):
        """Reset statistics."""
        self.stats = SpikeStats()


# =============================================================================
# INTEGRATION HELPERS
# =============================================================================

async def create_spike_hunter_from_config(config) -> SpikeHunterStrategy:
    """
    Create SpikeHunterStrategy from bot config.
    
    Expected config attributes:
    - enable_spike_hunter: bool
    - spike_min_magnitude_pct: float
    - spike_max_duration_sec: float
    - spike_take_profit_pct: float
    - spike_stop_loss_pct: float
    - spike_max_hold_sec: float
    - spike_max_position_usd: float
    - spike_max_concurrent: int
    """
    return SpikeHunterStrategy(
        enabled=getattr(config, 'enable_spike_hunter', True),
        min_magnitude_pct=getattr(config, 'spike_min_magnitude_pct', 2.0),
        max_duration_sec=getattr(config, 'spike_max_duration_sec', 30.0),
        take_profit_pct=getattr(config, 'spike_take_profit_pct', 1.5),
        stop_loss_pct=getattr(config, 'spike_stop_loss_pct', 3.0),
        max_hold_sec=getattr(config, 'spike_max_hold_sec', 300.0),
        max_position_usd=getattr(config, 'spike_max_position_usd', 50.0),
        max_concurrent=getattr(config, 'spike_max_concurrent', 3),
    )


# =============================================================================
# STANDALONE TEST
# =============================================================================

if __name__ == "__main__":
    import random
    
    logging.basicConfig(level=logging.INFO)
    
    # Create strategy
    strategy = SpikeHunterStrategy(
        enabled=True,
        min_magnitude_pct=2.0,
        max_duration_sec=30.0,
    )
    
    # Simulate price updates
    market_id = "test-market-btc"
    base_price = 0.50
    
    print("Simulating normal price movement...")
    for i in range(20):
        price = base_price + random.uniform(-0.005, 0.005)
        strategy.update_price(market_id, price)
        time.sleep(0.1)
    
    print("\nSimulating spike UP...")
    # Sudden spike up
    for i in range(5):
        price = base_price + (0.02 * (i + 1))  # 2% increments
        opp = strategy.update_price(market_id, price)
        if opp:
            print(f"Spike detected! {opp}")
            strategy.enter_position(opp)
        time.sleep(0.5)
    
    print(f"\nStats: {strategy.get_stats()}")
