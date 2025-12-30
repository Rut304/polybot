"""
High Conviction Trading Strategy

Based on leaderboard analysis: Elite traders (50%+ ROI) focus on quality over
quantity. They achieve better returns by being selective and only trading when
they have a strong edge.

Strategy:
1. Fewer trades with higher confidence thresholds
2. Larger position sizes on high-conviction setups
3. Strict entry criteria combining multiple signals
4. Wait for optimal conditions rather than forcing trades

Key metrics from top traders:
- Average 2-5 trades per week vs 20+ for low performers
- Position sizes 3-5x larger than average
- 70%+ win rate on executed trades
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class SignalStrength(Enum):
    """Signal strength classification"""
    EXTREME = "extreme"    # 5+ confirming signals
    STRONG = "strong"      # 4 confirming signals
    MODERATE = "moderate"  # 3 confirming signals
    WEAK = "weak"          # 2 or fewer signals


class SignalType(Enum):
    """Types of signals to aggregate"""
    WHALE_ACTIVITY = "whale_activity"
    NEWS_SENTIMENT = "news_sentiment"
    PRICE_MOMENTUM = "price_momentum"
    VOLUME_SPIKE = "volume_spike"
    CONGRESSIONAL = "congressional"
    ODDS_MOVEMENT = "odds_movement"
    SMART_MONEY = "smart_money"
    TIMING = "timing"
    AI_MODEL = "ai_model"


@dataclass
class Signal:
    """Individual signal from any source"""
    signal_type: SignalType
    direction: str  # "bullish" or "bearish"
    strength: float  # 0-1
    reason: str
    source: str
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "signal_type": self.signal_type.value,
            "direction": self.direction,
            "strength": self.strength,
            "reason": self.reason,
            "source": self.source,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class HighConvictionOpportunity:
    """A high-conviction trading opportunity"""
    market_id: str
    ticker: str
    direction: str  # "buy" or "sell"
    
    # Signal aggregation
    signals: List[Signal] = field(default_factory=list)
    signal_strength: SignalStrength = SignalStrength.WEAK
    aggregate_score: float = 0.0  # 0-100
    
    # Position sizing
    base_position_usd: Decimal = Decimal("50")
    multiplier: float = 1.0
    final_position_usd: Decimal = Decimal("50")
    
    # Risk management
    stop_loss_pct: float = 10.0
    take_profit_pct: float = 20.0
    max_hold_hours: int = 72
    
    # Market data
    current_price: float = 0.5
    implied_odds: float = 50.0
    
    # Metadata
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    expires_at: Optional[datetime] = None
    
    def calculate_strength(self) -> SignalStrength:
        """Calculate signal strength from aggregated signals"""
        bullish = sum(
            1 for s in self.signals if s.direction == "bullish"
        )
        bearish = sum(
            1 for s in self.signals if s.direction == "bearish"
        )
        
        # Signals should agree
        max_aligned = max(bullish, bearish)
        
        if max_aligned >= 5:
            return SignalStrength.EXTREME
        elif max_aligned >= 4:
            return SignalStrength.STRONG
        elif max_aligned >= 3:
            return SignalStrength.MODERATE
        else:
            return SignalStrength.WEAK
    
    def calculate_score(self) -> float:
        """Calculate aggregate conviction score (0-100)"""
        if not self.signals:
            return 0.0
        
        # Weight by signal strength
        weighted_sum = sum(s.strength for s in self.signals)
        
        # Bonus for signal agreement
        bullish = sum(1 for s in self.signals if s.direction == "bullish")
        bearish = sum(1 for s in self.signals if s.direction == "bearish")
        agreement_bonus = abs(bullish - bearish) / len(self.signals) * 20
        
        # Base score
        base_score = (weighted_sum / len(self.signals)) * 80
        
        return min(100, base_score + agreement_bonus)
    
    def get_position_multiplier(self) -> float:
        """Get position multiplier based on conviction"""
        score = self.aggregate_score
        
        if score >= 85:
            return 3.0
        elif score >= 75:
            return 2.0
        elif score >= 65:
            return 1.5
        elif score >= 55:
            return 1.0
        else:
            return 0.5
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "market_id": self.market_id,
            "ticker": self.ticker,
            "direction": self.direction,
            "signals": [s.to_dict() for s in self.signals],
            "signal_strength": self.signal_strength.value,
            "aggregate_score": self.aggregate_score,
            "base_position_usd": float(self.base_position_usd),
            "multiplier": self.multiplier,
            "final_position_usd": float(self.final_position_usd),
            "current_price": self.current_price,
            "created_at": self.created_at.isoformat(),
        }


class HighConvictionStrategy:
    """
    Strategy that only trades with high conviction and multiple confirming
    signals.
    
    Key principles:
    - Quality over quantity
    - Wait for 3+ confirming signals
    - Larger positions on best setups
    - Strict entry criteria
    """
    
    def __init__(
        self,
        config: Optional[Dict] = None,
        on_opportunity: Optional[Callable] = None,
    ):
        self.config = config or {}
        self.on_opportunity = on_opportunity
        
        # Configuration
        self.enabled = self.config.get("enable_high_conviction", True)
        self.min_signals = self.config.get("high_conviction_min_signals", 3)
        self.min_score = self.config.get("high_conviction_min_score", 65)
        self.base_position_usd = Decimal(str(
            self.config.get("high_conviction_base_position", 100)
        ))
        self.max_position_usd = Decimal(str(
            self.config.get("high_conviction_max_position", 500)
        ))
        self.max_concurrent = self.config.get(
            "high_conviction_max_concurrent", 3
        )
        
        # State
        self.active_opportunities: List[HighConvictionOpportunity] = []
        self.pending_signals: Dict[str, List[Signal]] = {}
        self.trades_today = 0
        self.last_trade_at: Optional[datetime] = None
        
        logger.info(
            f"HighConvictionStrategy initialized - "
            f"enabled={self.enabled}, min_signals={self.min_signals}, "
            f"min_score={self.min_score}, max_position=${self.max_position_usd}"
        )
    
    def add_signal(
        self,
        market_id: str,
        signal: Signal,
    ) -> Optional[HighConvictionOpportunity]:
        """
        Add a signal for a market. Returns opportunity if threshold met.
        """
        if not self.enabled:
            return None
        
        # Initialize signal list for market
        if market_id not in self.pending_signals:
            self.pending_signals[market_id] = []
        
        # Add signal
        self.pending_signals[market_id].append(signal)
        
        logger.debug(
            f"Signal added for {market_id}: {signal.signal_type.value} "
            f"({signal.direction}) - total signals: "
            f"{len(self.pending_signals[market_id])}"
        )
        
        # Check if we have enough signals
        signals = self.pending_signals[market_id]
        if len(signals) >= self.min_signals:
            return self._evaluate_opportunity(market_id, signals)
        
        return None
    
    def _evaluate_opportunity(
        self,
        market_id: str,
        signals: List[Signal],
    ) -> Optional[HighConvictionOpportunity]:
        """Evaluate if signals create a high-conviction opportunity"""
        # Check signal agreement
        bullish = sum(1 for s in signals if s.direction == "bullish")
        bearish = sum(1 for s in signals if s.direction == "bearish")
        
        if bullish > bearish:
            direction = "buy"
            aligned_count = bullish
        elif bearish > bullish:
            direction = "sell"
            aligned_count = bearish
        else:
            # No clear direction
            return None
        
        # Need minimum aligned signals
        if aligned_count < self.min_signals:
            return None
        
        # Create opportunity
        opportunity = HighConvictionOpportunity(
            market_id=market_id,
            ticker="",  # Would be populated from market data
            direction=direction,
            signals=signals,
            base_position_usd=self.base_position_usd,
        )
        
        # Calculate metrics
        opportunity.signal_strength = opportunity.calculate_strength()
        opportunity.aggregate_score = opportunity.calculate_score()
        
        # Check minimum score
        if opportunity.aggregate_score < self.min_score:
            logger.debug(
                f"Opportunity score {opportunity.aggregate_score:.1f} "
                f"below minimum {self.min_score}"
            )
            return None
        
        # Calculate position size
        opportunity.multiplier = opportunity.get_position_multiplier()
        opportunity.final_position_usd = min(
            self.base_position_usd * Decimal(str(opportunity.multiplier)),
            self.max_position_usd,
        )
        
        # Check concurrent positions
        if len(self.active_opportunities) >= self.max_concurrent:
            logger.info(
                f"Max concurrent positions reached ({self.max_concurrent})"
            )
            return None
        
        # Add to active
        self.active_opportunities.append(opportunity)
        self.trades_today += 1
        self.last_trade_at = datetime.now(timezone.utc)
        
        # Clear pending signals
        del self.pending_signals[market_id]
        
        logger.info(
            f"High conviction opportunity: {market_id} "
            f"direction={direction}, score={opportunity.aggregate_score:.1f}, "
            f"position=${opportunity.final_position_usd}"
        )
        
        # Callback
        if self.on_opportunity:
            self.on_opportunity(opportunity)
        
        return opportunity
    
    def create_signal_from_whale(
        self,
        whale_address: str,
        direction: str,
        whale_tier: str,
    ) -> Signal:
        """Create a signal from whale activity"""
        strength = {
            "mega_whale": 0.95,
            "whale": 0.85,
            "smart_money": 0.75,
            "retail": 0.5,
        }.get(whale_tier, 0.5)
        
        return Signal(
            signal_type=SignalType.WHALE_ACTIVITY,
            direction="bullish" if direction == "buy" else "bearish",
            strength=strength,
            reason=f"Whale {whale_address[:8]}... ({whale_tier}) {direction}",
            source="whale_tracker",
        )
    
    def create_signal_from_news(
        self,
        sentiment: float,
        headline: str,
    ) -> Signal:
        """Create a signal from news sentiment"""
        direction = "bullish" if sentiment > 0 else "bearish"
        strength = min(1.0, abs(sentiment))
        
        return Signal(
            signal_type=SignalType.NEWS_SENTIMENT,
            direction=direction,
            strength=strength,
            reason=f"News: {headline[:50]}...",
            source="news_analyzer",
        )
    
    def create_signal_from_congressional(
        self,
        politician: str,
        transaction_type: str,
        amount_usd: float,
    ) -> Signal:
        """Create a signal from congressional trading"""
        direction = "bullish" if transaction_type == "purchase" else "bearish"
        
        # Strength based on amount
        if amount_usd >= 500000:
            strength = 0.9
        elif amount_usd >= 100000:
            strength = 0.8
        elif amount_usd >= 50000:
            strength = 0.7
        else:
            strength = 0.6
        
        return Signal(
            signal_type=SignalType.CONGRESSIONAL,
            direction=direction,
            strength=strength,
            reason=f"Congress: {politician} {transaction_type} ${amount_usd:,.0f}",
            source="congressional_tracker",
        )
    
    def create_signal_from_odds_movement(
        self,
        old_odds: float,
        new_odds: float,
        volume_usd: float,
    ) -> Signal:
        """Create a signal from odds movement"""
        change = new_odds - old_odds
        direction = "bullish" if change > 0 else "bearish"
        
        # Strength based on change magnitude and volume
        change_strength = min(1.0, abs(change) / 10)  # 10% = 1.0
        volume_mult = min(1.5, volume_usd / 10000)
        strength = min(1.0, change_strength * volume_mult)
        
        return Signal(
            signal_type=SignalType.ODDS_MOVEMENT,
            direction=direction,
            strength=strength,
            reason=f"Odds moved {change:+.1f}% on ${volume_usd:,.0f} volume",
            source="market_monitor",
        )

    def create_signal_from_ai_forecast(
        self,
        question: str,
        probability: float,
        confidence: float,
        model: str,
    ) -> Signal:
        """Create a signal from AI forecast"""
        # Direction based on probability > 50%? 
        # Actually AI strategy usually gives a `direction` (buy_yes/buy_no).
        # We'll assume the caller passes implied direction or we infer from prob.
        # But AIForecast has 'direction' field. We should probably pass that or use prob.
        
        # If prob > 0.6 => Bullish (YES)
        # If prob < 0.4 => Bearish (NO)
        
        if probability > 0.5:
            direction = "bullish"
            strength_val = (probability - 0.5) * 2  # 0.6 -> 0.2 strength? 
            # Better to use confidence as strength, conditioned on probability.
        else:
            direction = "bearish"
            strength_val = (0.5 - probability) * 2
            
        # Combine model confidence with probability conviction
        final_strength = min(1.0, strength_val * confidence * 1.5)
        
        return Signal(
            signal_type=SignalType.AI_MODEL,
            direction=direction,
            strength=final_strength,
            reason=f"AI ({model}) pred: {probability:.0%} (conf: {confidence:.0%})",
            source=f"ai_model_{model}",
        )
    
    def clear_stale_signals(self, max_age_hours: int = 24):
        """Clear signals older than max_age_hours"""
        cutoff = datetime.now(timezone.utc)
        
        for market_id in list(self.pending_signals.keys()):
            self.pending_signals[market_id] = [
                s for s in self.pending_signals[market_id]
                if (cutoff - s.timestamp).total_seconds() < max_age_hours * 3600
            ]
            
            if not self.pending_signals[market_id]:
                del self.pending_signals[market_id]
    
    def close_opportunity(self, market_id: str, pnl: Decimal):
        """Close an opportunity and record PnL"""
        self.active_opportunities = [
            o for o in self.active_opportunities
            if o.market_id != market_id
        ]
        
        logger.info(f"Closed opportunity {market_id} with PnL: ${pnl}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get strategy statistics"""
        return {
            "enabled": self.enabled,
            "min_signals": self.min_signals,
            "min_score": self.min_score,
            "base_position_usd": float(self.base_position_usd),
            "max_position_usd": float(self.max_position_usd),
            "max_concurrent": self.max_concurrent,
            "active_opportunities": len(self.active_opportunities),
            "pending_markets": len(self.pending_signals),
            "trades_today": self.trades_today,
            "last_trade_at": (
                self.last_trade_at.isoformat() if self.last_trade_at else None
            ),
        }

    def stop(self):
        """Stop the strategy and clean up resources."""
        logger.info("HighConvictionStrategy stopping...")
        self.enabled = False
        self.active_opportunities.clear()
        self.pending_signals.clear()
        logger.info("HighConvictionStrategy stopped")
