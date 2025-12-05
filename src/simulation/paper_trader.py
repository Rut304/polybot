"""
Paper Trading Simulator for PolyBot

Tracks hypothetical P&L without executing real trades.
Records every opportunity and simulates what would have happened.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional
import logging
import json

logger = logging.getLogger(__name__)


class SimulatedTradeOutcome(Enum):
    """Possible outcomes for simulated trades"""
    PENDING = "pending"           # Trade simulated, waiting for market resolution
    WON = "won"                   # Arbitrage succeeded
    LOST = "lost"                 # Market moved against us
    EXPIRED = "expired"           # Market closed without resolution
    WOULD_HAVE_FAILED = "would_have_failed"  # Opportunity disappeared before fill


@dataclass
class SimulatedPosition:
    """Represents a simulated arbitrage position"""
    id: str
    created_at: datetime
    
    # Market info
    polymarket_token_id: str
    polymarket_market_title: str
    kalshi_ticker: str
    kalshi_market_title: str
    
    # Entry prices (at time of opportunity)
    polymarket_yes_price: Decimal
    polymarket_no_price: Decimal
    kalshi_yes_price: Decimal
    kalshi_no_price: Decimal
    
    # Simulated trade details
    trade_type: str  # "buy_poly_yes_sell_kalshi_yes" etc.
    position_size_usd: Decimal
    expected_profit_usd: Decimal
    expected_profit_pct: Decimal
    
    # Outcome tracking
    outcome: SimulatedTradeOutcome = SimulatedTradeOutcome.PENDING
    actual_profit_usd: Optional[Decimal] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""
    
    # Market resolution (when known)
    market_result: Optional[str] = None  # "yes", "no", or None


@dataclass  
class PaperTradingStats:
    """Running statistics for paper trading"""
    total_opportunities_seen: int = 0
    total_simulated_trades: int = 0
    
    # P&L tracking
    simulated_starting_balance: Decimal = Decimal("5000.00")
    simulated_current_balance: Decimal = Decimal("5000.00")
    total_simulated_profit: Decimal = Decimal("0.00")
    total_simulated_loss: Decimal = Decimal("0.00")
    
    # Trade stats
    winning_trades: int = 0
    losing_trades: int = 0
    pending_trades: int = 0
    
    # Best/worst
    best_trade_profit: Decimal = Decimal("0.00")
    worst_trade_loss: Decimal = Decimal("0.00")
    largest_opportunity_seen: Decimal = Decimal("0.00")
    
    # Timing
    first_opportunity_at: Optional[datetime] = None
    last_opportunity_at: Optional[datetime] = None
    
    @property
    def total_pnl(self) -> Decimal:
        return self.total_simulated_profit - self.total_simulated_loss
    
    @property
    def win_rate(self) -> float:
        total = self.winning_trades + self.losing_trades
        if total == 0:
            return 0.0
        return self.winning_trades / total * 100
    
    @property
    def roi_percent(self) -> float:
        if self.simulated_starting_balance == 0:
            return 0.0
        return float((self.simulated_current_balance - self.simulated_starting_balance) 
                    / self.simulated_starting_balance * 100)
    
    def to_dict(self) -> dict:
        return {
            "total_opportunities_seen": self.total_opportunities_seen,
            "total_simulated_trades": self.total_simulated_trades,
            "simulated_starting_balance": str(self.simulated_starting_balance),
            "simulated_current_balance": str(self.simulated_current_balance),
            "total_pnl": str(self.total_pnl),
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "pending_trades": self.pending_trades,
            "win_rate_pct": round(self.win_rate, 2),
            "roi_pct": round(self.roi_percent, 2),
            "best_trade_profit": str(self.best_trade_profit),
            "worst_trade_loss": str(self.worst_trade_loss),
            "largest_opportunity_seen_pct": str(self.largest_opportunity_seen),
            "first_opportunity_at": self.first_opportunity_at.isoformat() if self.first_opportunity_at else None,
            "last_opportunity_at": self.last_opportunity_at.isoformat() if self.last_opportunity_at else None,
        }


class PaperTrader:
    """
    Paper trading simulator that tracks hypothetical performance.
    
    Features:
    - Records every arbitrage opportunity detected
    - Simulates trades at detected prices
    - Tracks hypothetical P&L over time
    - Persists to Supabase for historical analysis
    """
    
    def __init__(
        self,
        db_client,
        starting_balance: Decimal = Decimal("5000.00"),
        max_position_pct: float = 10.0,  # Max 10% of balance per trade
        min_profit_threshold: float = 0.5,  # Only sim trades with 0.5%+ expected profit
    ):
        self.db = db_client
        self.stats = PaperTradingStats(
            simulated_starting_balance=starting_balance,
            simulated_current_balance=starting_balance,
        )
        self.max_position_pct = max_position_pct
        self.min_profit_threshold = min_profit_threshold
        self.positions: dict[str, SimulatedPosition] = {}
        self._position_counter = 0
        
    def _generate_position_id(self) -> str:
        """Generate unique position ID"""
        self._position_counter += 1
        return f"SIM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{self._position_counter:04d}"
    
    def calculate_position_size(self, profit_pct: Decimal) -> Decimal:
        """
        Calculate optimal position size based on Kelly Criterion (simplified).
        Higher confidence = larger position, capped at max_position_pct.
        """
        # Simple sizing: larger opportunities get larger allocations
        base_pct = min(float(profit_pct) * 2, self.max_position_pct)  # 2x profit % up to max
        position_usd = self.stats.simulated_current_balance * Decimal(str(base_pct / 100))
        return min(position_usd, Decimal("100.00"))  # Cap at $100 per trade for safety
    
    async def record_opportunity(
        self,
        polymarket_token_id: str,
        polymarket_market_title: str,
        kalshi_ticker: str,
        kalshi_market_title: str,
        poly_yes: Decimal,
        poly_no: Decimal,
        kalshi_yes: Decimal,
        kalshi_no: Decimal,
        profit_pct: Decimal,
        trade_type: str,
    ) -> Optional[SimulatedPosition]:
        """
        Record an arbitrage opportunity and simulate a trade if profitable enough.
        
        Returns the simulated position if a trade was simulated, None otherwise.
        """
        now = datetime.now(timezone.utc)
        
        # Update stats
        self.stats.total_opportunities_seen += 1
        if self.stats.first_opportunity_at is None:
            self.stats.first_opportunity_at = now
        self.stats.last_opportunity_at = now
        
        if profit_pct > self.stats.largest_opportunity_seen:
            self.stats.largest_opportunity_seen = profit_pct
        
        # Check if profitable enough to simulate
        if float(profit_pct) < self.min_profit_threshold:
            logger.debug(f"Opportunity {profit_pct:.2f}% below threshold, not simulating")
            return None
        
        # Calculate position size
        position_size = self.calculate_position_size(profit_pct)
        expected_profit = position_size * profit_pct / Decimal("100")
        
        # Create simulated position
        position = SimulatedPosition(
            id=self._generate_position_id(),
            created_at=now,
            polymarket_token_id=polymarket_token_id,
            polymarket_market_title=polymarket_market_title,
            kalshi_ticker=kalshi_ticker,
            kalshi_market_title=kalshi_market_title,
            polymarket_yes_price=poly_yes,
            polymarket_no_price=poly_no,
            kalshi_yes_price=kalshi_yes,
            kalshi_no_price=kalshi_no,
            trade_type=trade_type,
            position_size_usd=position_size,
            expected_profit_usd=expected_profit,
            expected_profit_pct=profit_pct,
        )
        
        self.positions[position.id] = position
        self.stats.total_simulated_trades += 1
        self.stats.pending_trades += 1
        
        # Persist to database
        await self._save_position_to_db(position)
        
        logger.info(
            f"📝 PAPER TRADE: {position.id} | "
            f"Size: ${position_size:.2f} | "
            f"Expected: +${expected_profit:.2f} ({profit_pct:.2f}%) | "
            f"{trade_type}"
        )
        
        return position
    
    async def resolve_position(
        self,
        position_id: str,
        market_result: str,  # "yes" or "no"
        notes: str = "",
    ) -> None:
        """
        Resolve a pending position when the market settles.
        
        For arbitrage:
        - If we bought YES on one platform and NO on other, 
          one wins and one loses, locking in the spread profit.
        """
        if position_id not in self.positions:
            logger.warning(f"Position {position_id} not found")
            return
            
        position = self.positions[position_id]
        now = datetime.now(timezone.utc)
        
        position.resolved_at = now
        position.market_result = market_result
        position.resolution_notes = notes
        
        # For arbitrage, we generally lock in the spread profit regardless of outcome
        # (assuming both legs filled at expected prices)
        # In reality there's execution risk, but for simulation we assume perfect fills
        
        # Simulate that we captured the expected profit
        position.actual_profit_usd = position.expected_profit_usd
        position.outcome = SimulatedTradeOutcome.WON
        
        # Update stats
        self.stats.pending_trades -= 1
        self.stats.winning_trades += 1
        self.stats.total_simulated_profit += position.actual_profit_usd
        self.stats.simulated_current_balance += position.actual_profit_usd
        
        if position.actual_profit_usd > self.stats.best_trade_profit:
            self.stats.best_trade_profit = position.actual_profit_usd
        
        # Update in database
        await self._update_position_in_db(position)
        
        logger.info(
            f"✅ RESOLVED: {position.id} | "
            f"Profit: +${position.actual_profit_usd:.2f} | "
            f"New Balance: ${self.stats.simulated_current_balance:.2f}"
        )
    
    async def simulate_instant_profit(
        self,
        polymarket_token_id: str,
        polymarket_market_title: str,
        kalshi_ticker: str,
        kalshi_market_title: str,
        poly_yes: Decimal,
        poly_no: Decimal,
        kalshi_yes: Decimal,
        kalshi_no: Decimal,
        profit_pct: Decimal,
        trade_type: str,
    ) -> Optional[SimulatedPosition]:
        """
        For simulation purposes, assume trades lock in profit immediately.
        This is optimistic but useful for tracking opportunity quality.
        """
        position = await self.record_opportunity(
            polymarket_token_id=polymarket_token_id,
            polymarket_market_title=polymarket_market_title,
            kalshi_ticker=kalshi_ticker,
            kalshi_market_title=kalshi_market_title,
            poly_yes=poly_yes,
            poly_no=poly_no,
            kalshi_yes=kalshi_yes,
            kalshi_no=kalshi_no,
            profit_pct=profit_pct,
            trade_type=trade_type,
        )
        
        if position:
            # Immediately "resolve" as profitable (optimistic simulation)
            await self.resolve_position(
                position.id, 
                market_result="simulated",
                notes="Instant simulation - assumed perfect execution"
            )
        
        return position
    
    async def _save_position_to_db(self, position: SimulatedPosition) -> None:
        """Save simulated position to Supabase"""
        try:
            data = {
                "position_id": position.id,
                "created_at": position.created_at.isoformat(),
                "polymarket_token_id": position.polymarket_token_id,
                "polymarket_market_title": position.polymarket_market_title[:500],  # Truncate
                "kalshi_ticker": position.kalshi_ticker,
                "kalshi_market_title": position.kalshi_market_title[:500],
                "polymarket_yes_price": float(position.polymarket_yes_price),
                "polymarket_no_price": float(position.polymarket_no_price),
                "kalshi_yes_price": float(position.kalshi_yes_price),
                "kalshi_no_price": float(position.kalshi_no_price),
                "trade_type": position.trade_type,
                "position_size_usd": float(position.position_size_usd),
                "expected_profit_usd": float(position.expected_profit_usd),
                "expected_profit_pct": float(position.expected_profit_pct),
                "outcome": position.outcome.value,
            }
            
            await self.db.insert("polybot_simulated_trades", data)
            
        except Exception as e:
            logger.error(f"Failed to save simulated position: {e}")
    
    async def _update_position_in_db(self, position: SimulatedPosition) -> None:
        """Update resolved position in Supabase"""
        try:
            data = {
                "outcome": position.outcome.value,
                "actual_profit_usd": float(position.actual_profit_usd) if position.actual_profit_usd else None,
                "resolved_at": position.resolved_at.isoformat() if position.resolved_at else None,
                "market_result": position.market_result,
                "resolution_notes": position.resolution_notes,
            }
            
            await self.db.update(
                "polybot_simulated_trades",
                data,
                {"position_id": position.id}
            )
            
        except Exception as e:
            logger.error(f"Failed to update simulated position: {e}")
    
    async def save_stats_to_db(self) -> None:
        """Save current paper trading stats to Supabase"""
        try:
            data = {
                "id": 1,  # Always update the same row
                "snapshot_at": datetime.now(timezone.utc).isoformat(),
                "stats_json": self.stats.to_dict(),
                "simulated_balance": float(self.stats.simulated_current_balance),
                "total_pnl": float(self.stats.total_pnl),
                "total_trades": self.stats.total_simulated_trades,
                "win_rate": self.stats.win_rate,
            }
            
            # Use upsert to update existing row or insert new one
            await self.db.upsert("polybot_simulation_stats", data)
            
        except Exception as e:
            logger.error(f"Failed to save simulation stats: {e}")
    
    def get_stats_summary(self) -> str:
        """Get a formatted summary of paper trading performance"""
        return f"""
╔══════════════════════════════════════════════════════════════╗
║                   📊 PAPER TRADING SUMMARY                    ║
╠══════════════════════════════════════════════════════════════╣
║  Starting Balance:     ${self.stats.simulated_starting_balance:>10.2f}                   ║
║  Current Balance:      ${self.stats.simulated_current_balance:>10.2f}                   ║
║  Total P&L:            ${self.stats.total_pnl:>+10.2f} ({self.stats.roi_percent:>+.2f}%)          ║
╠══════════════════════════════════════════════════════════════╣
║  Opportunities Seen:   {self.stats.total_opportunities_seen:>10}                        ║
║  Trades Simulated:     {self.stats.total_simulated_trades:>10}                        ║
║  Win/Loss/Pending:     {self.stats.winning_trades:>4} / {self.stats.losing_trades:<4} / {self.stats.pending_trades:<4}               ║
║  Win Rate:             {self.stats.win_rate:>10.1f}%                       ║
╠══════════════════════════════════════════════════════════════╣
║  Best Trade:           ${self.stats.best_trade_profit:>+10.2f}                   ║
║  Worst Trade:          ${self.stats.worst_trade_loss:>+10.2f}                   ║
║  Largest Opportunity:  {self.stats.largest_opportunity_seen:>10.2f}%                    ║
╚══════════════════════════════════════════════════════════════╝
"""
    
    def get_stats_dict(self) -> dict:
        """Get stats as dictionary for API/JSON responses"""
        return self.stats.to_dict()
