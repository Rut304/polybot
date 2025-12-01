"""
Trade execution engine with risk management and safety controls.
Handles order placement on Polymarket and Kalshi with dry-run support.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from enum import Enum

from .detector import Opportunity

logger = logging.getLogger(__name__)


class TradeStatus(Enum):
    """Status of a trade execution."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    FAILED = "failed"
    DRY_RUN = "dry_run"


@dataclass
class Trade:
    """Represents an executed or attempted trade."""
    
    id: str
    opportunity_id: str
    platform: str
    market_id: str
    side: str  # 'buy' or 'sell'
    price: float
    size: float
    status: TradeStatus
    executed_at: datetime
    filled_size: float = 0.0
    fill_price: float = 0.0
    tx_hash: Optional[str] = None
    order_id: Optional[str] = None
    error_message: Optional[str] = None
    fees: float = 0.0
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "opportunity_id": self.opportunity_id,
            "platform": self.platform,
            "market_id": self.market_id,
            "side": self.side,
            "price": self.price,
            "size": self.size,
            "status": self.status.value,
            "executed_at": self.executed_at.isoformat(),
            "filled_size": self.filled_size,
            "fill_price": self.fill_price,
            "tx_hash": self.tx_hash,
            "order_id": self.order_id,
            "error_message": self.error_message,
            "fees": self.fees,
        }


@dataclass
class RiskState:
    """Tracks risk management state."""
    
    daily_pnl: float = 0.0
    daily_trades: int = 0
    consecutive_failures: int = 0
    is_paused: bool = False
    pause_reason: Optional[str] = None
    last_reset: datetime = field(default_factory=datetime.utcnow)
    trades_requiring_approval: int = 0
    
    def reset_daily(self):
        """Reset daily counters."""
        self.daily_pnl = 0.0
        self.daily_trades = 0
        self.last_reset = datetime.utcnow()


class TradeExecutor:
    """
    Executes arbitrage trades with comprehensive safety controls.
    
    Features:
    - Dry-run mode (logs trades without executing)
    - Position sizing limits
    - Daily loss limits with circuit breaker
    - Consecutive failure detection
    - Slippage protection
    - Manual approval for first N trades
    - Balance verification
    """
    
    def __init__(
        self,
        dry_run: bool = True,
        max_trade_size: float = 100.0,
        max_daily_loss: float = 50.0,
        max_consecutive_failures: int = 3,
        slippage_tolerance: float = 0.005,  # 0.5%
        manual_approval_trades: int = 10,
        polymarket_client=None,
        kalshi_client=None,
    ):
        self.dry_run = dry_run
        self.max_trade_size = max_trade_size
        self.max_daily_loss = max_daily_loss
        self.max_consecutive_failures = max_consecutive_failures
        self.slippage_tolerance = slippage_tolerance
        self.manual_approval_trades = manual_approval_trades
        
        # Platform clients
        self.polymarket_client = polymarket_client
        self.kalshi_client = kalshi_client
        
        # Risk state
        self.risk_state = RiskState()
        
        # Trade counter
        self._trade_counter = 0
        
        # Trade history (in-memory, also persisted to DB)
        self._trades: List[Trade] = []
        
        # Pending approval queue
        self._pending_approval: List[Opportunity] = []
    
    def _generate_trade_id(self) -> str:
        """Generate unique trade ID."""
        self._trade_counter += 1
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"TRD-{timestamp}-{self._trade_counter:04d}"
    
    def _check_daily_reset(self):
        """Reset daily counters if new day."""
        now = datetime.utcnow()
        if now.date() > self.risk_state.last_reset.date():
            logger.info("Resetting daily risk counters")
            self.risk_state.reset_daily()
    
    def can_trade(self) -> tuple[bool, str]:
        """
        Check if trading is allowed based on risk state.
        
        Returns:
            Tuple of (can_trade, reason)
        """
        self._check_daily_reset()
        
        # Check if paused
        if self.risk_state.is_paused:
            return False, f"Trading paused: {self.risk_state.pause_reason}"
        
        # Check daily loss limit
        if self.risk_state.daily_pnl <= -self.max_daily_loss:
            self.risk_state.is_paused = True
            self.risk_state.pause_reason = "Daily loss limit reached"
            return False, "Daily loss limit reached"
        
        # Check consecutive failures
        if self.risk_state.consecutive_failures >= self.max_consecutive_failures:
            self.risk_state.is_paused = True
            self.risk_state.pause_reason = "Too many consecutive failures"
            return False, "Circuit breaker: too many consecutive failures"
        
        return True, "OK"
    
    def requires_approval(self) -> bool:
        """Check if current trade requires manual approval."""
        return self.risk_state.trades_requiring_approval < self.manual_approval_trades
    
    def verify_price(
        self,
        opportunity: Opportunity,
        current_buy_price: float,
        current_sell_price: float,
    ) -> tuple[bool, str]:
        """
        Verify prices haven't moved beyond slippage tolerance.
        
        Args:
            opportunity: The opportunity being executed
            current_buy_price: Current best price for buy side
            current_sell_price: Current best price for sell side
            
        Returns:
            Tuple of (is_valid, reason)
        """
        buy_slippage = abs(current_buy_price - opportunity.buy_price) / opportunity.buy_price
        sell_slippage = abs(current_sell_price - opportunity.sell_price) / opportunity.sell_price
        
        if buy_slippage > self.slippage_tolerance:
            return False, f"Buy price slipped {buy_slippage:.2%} (max {self.slippage_tolerance:.2%})"
        
        if sell_slippage > self.slippage_tolerance:
            return False, f"Sell price slipped {sell_slippage:.2%} (max {self.slippage_tolerance:.2%})"
        
        # Recalculate profit with current prices
        current_profit = current_sell_price - current_buy_price
        if current_profit <= 0:
            return False, "Opportunity no longer profitable"
        
        return True, "OK"
    
    def calculate_position_size(
        self,
        opportunity: Opportunity,
        available_balance: float,
    ) -> float:
        """
        Calculate appropriate position size.
        
        Args:
            opportunity: The opportunity to size
            available_balance: Available balance on buy platform
            
        Returns:
            Position size in units
        """
        # Start with opportunity's max size
        size = opportunity.max_size
        
        # Limit by max trade size setting
        max_units = self.max_trade_size / opportunity.buy_price if opportunity.buy_price > 0 else 0
        size = min(size, max_units)
        
        # Limit by available balance
        balance_units = available_balance / opportunity.buy_price if opportunity.buy_price > 0 else 0
        size = min(size, balance_units)
        
        # Round down to reasonable precision
        size = int(size * 100) / 100
        
        return max(0, size)
    
    async def execute_opportunity(
        self,
        opportunity: Opportunity,
        approved: bool = False,
    ) -> tuple[Optional[Trade], Optional[Trade], str]:
        """
        Execute an arbitrage opportunity.
        
        Args:
            opportunity: The opportunity to execute
            approved: Whether manual approval was given (for first N trades)
            
        Returns:
            Tuple of (buy_trade, sell_trade, status_message)
        """
        # Check if we can trade
        can_trade, reason = self.can_trade()
        if not can_trade:
            return None, None, reason
        
        # Check if approval required
        if self.requires_approval() and not approved:
            self._pending_approval.append(opportunity)
            return None, None, "Requires manual approval"
        
        # Calculate position size
        # TODO: Get actual balances from clients
        available_balance = self.max_trade_size  # Placeholder
        size = self.calculate_position_size(opportunity, available_balance)
        
        if size <= 0:
            return None, None, "Position size too small"
        
        # Log the trade attempt
        logger.info(f"{'[DRY RUN] ' if self.dry_run else ''}Executing: {opportunity}")
        
        buy_trade = None
        sell_trade = None
        
        try:
            if self.dry_run:
                # Simulate successful execution
                buy_trade = Trade(
                    id=self._generate_trade_id(),
                    opportunity_id=opportunity.id,
                    platform=opportunity.buy_platform,
                    market_id=opportunity.buy_market_id,
                    side="buy",
                    price=opportunity.buy_price,
                    size=size,
                    status=TradeStatus.DRY_RUN,
                    executed_at=datetime.utcnow(),
                    filled_size=size,
                    fill_price=opportunity.buy_price,
                )
                
                sell_trade = Trade(
                    id=self._generate_trade_id(),
                    opportunity_id=opportunity.id,
                    platform=opportunity.sell_platform,
                    market_id=opportunity.sell_market_id,
                    side="sell",
                    price=opportunity.sell_price,
                    size=size,
                    status=TradeStatus.DRY_RUN,
                    executed_at=datetime.utcnow(),
                    filled_size=size,
                    fill_price=opportunity.sell_price,
                )
                
                # Simulate P&L
                simulated_pnl = opportunity.profit_per_contract * size
                self.risk_state.daily_pnl += simulated_pnl
                
                logger.info(
                    f"[DRY RUN] Would execute: "
                    f"Buy {size} @ {opportunity.buy_price:.4f} on {opportunity.buy_platform}, "
                    f"Sell @ {opportunity.sell_price:.4f} on {opportunity.sell_platform}. "
                    f"Simulated P&L: ${simulated_pnl:.2f}"
                )
            
            else:
                # LIVE TRADING
                # Step 1: Place buy order
                buy_trade = await self._execute_buy(opportunity, size)
                
                if buy_trade.status != TradeStatus.FILLED:
                    # Buy failed, don't proceed to sell
                    self.risk_state.consecutive_failures += 1
                    return buy_trade, None, f"Buy order failed: {buy_trade.error_message}"
                
                # Step 2: Place sell order
                sell_trade = await self._execute_sell(opportunity, buy_trade.filled_size)
                
                if sell_trade.status != TradeStatus.FILLED:
                    # Sell failed - we now have an open position!
                    logger.error(
                        f"CRITICAL: Buy filled but sell failed! "
                        f"Open position: {buy_trade.filled_size} on {opportunity.buy_platform}"
                    )
                    self.risk_state.consecutive_failures += 1
                    return buy_trade, sell_trade, f"Sell order failed: {sell_trade.error_message}"
                
                # Both orders filled - calculate actual P&L
                actual_pnl = (
                    (sell_trade.fill_price * sell_trade.filled_size) -
                    (buy_trade.fill_price * buy_trade.filled_size) -
                    buy_trade.fees - sell_trade.fees
                )
                
                self.risk_state.daily_pnl += actual_pnl
                self.risk_state.consecutive_failures = 0  # Reset on success
                
                logger.info(f"Trade executed successfully! P&L: ${actual_pnl:.2f}")
            
            # Update counters
            self.risk_state.daily_trades += 1
            self.risk_state.trades_requiring_approval += 1
            
            # Store trades
            if buy_trade:
                self._trades.append(buy_trade)
            if sell_trade:
                self._trades.append(sell_trade)
            
            return buy_trade, sell_trade, "Success"
        
        except Exception as e:
            logger.error(f"Trade execution error: {e}")
            self.risk_state.consecutive_failures += 1
            return None, None, str(e)
    
    async def _execute_buy(self, opportunity: Opportunity, size: float) -> Trade:
        """Execute buy order on appropriate platform."""
        trade = Trade(
            id=self._generate_trade_id(),
            opportunity_id=opportunity.id,
            platform=opportunity.buy_platform,
            market_id=opportunity.buy_market_id,
            side="buy",
            price=opportunity.buy_price,
            size=size,
            status=TradeStatus.PENDING,
            executed_at=datetime.utcnow(),
        )
        
        try:
            if opportunity.buy_platform == "polymarket":
                result = await self._execute_polymarket_order(
                    opportunity.buy_market_id,
                    "buy",
                    opportunity.buy_price,
                    size,
                )
            else:
                result = await self._execute_kalshi_order(
                    opportunity.buy_market_id,
                    "buy",
                    opportunity.buy_price,
                    size,
                )
            
            trade.status = TradeStatus.FILLED if result.get("success") else TradeStatus.FAILED
            trade.filled_size = result.get("filled_size", 0)
            trade.fill_price = result.get("fill_price", opportunity.buy_price)
            trade.order_id = result.get("order_id")
            trade.tx_hash = result.get("tx_hash")
            trade.fees = result.get("fees", 0)
            trade.error_message = result.get("error")
            
        except Exception as e:
            trade.status = TradeStatus.FAILED
            trade.error_message = str(e)
        
        return trade
    
    async def _execute_sell(self, opportunity: Opportunity, size: float) -> Trade:
        """Execute sell order on appropriate platform."""
        trade = Trade(
            id=self._generate_trade_id(),
            opportunity_id=opportunity.id,
            platform=opportunity.sell_platform,
            market_id=opportunity.sell_market_id,
            side="sell",
            price=opportunity.sell_price,
            size=size,
            status=TradeStatus.PENDING,
            executed_at=datetime.utcnow(),
        )
        
        try:
            if opportunity.sell_platform == "polymarket":
                result = await self._execute_polymarket_order(
                    opportunity.sell_market_id,
                    "sell",
                    opportunity.sell_price,
                    size,
                )
            else:
                result = await self._execute_kalshi_order(
                    opportunity.sell_market_id,
                    "sell",
                    opportunity.sell_price,
                    size,
                )
            
            trade.status = TradeStatus.FILLED if result.get("success") else TradeStatus.FAILED
            trade.filled_size = result.get("filled_size", 0)
            trade.fill_price = result.get("fill_price", opportunity.sell_price)
            trade.order_id = result.get("order_id")
            trade.tx_hash = result.get("tx_hash")
            trade.fees = result.get("fees", 0)
            trade.error_message = result.get("error")
            
        except Exception as e:
            trade.status = TradeStatus.FAILED
            trade.error_message = str(e)
        
        return trade
    
    async def _execute_polymarket_order(
        self,
        token_id: str,
        side: str,
        price: float,
        size: float,
    ) -> dict:
        """
        Execute order on Polymarket via py-clob-client.
        
        Returns dict with: success, filled_size, fill_price, order_id, tx_hash, fees, error
        """
        # TODO: Implement actual Polymarket order execution
        # Using py-clob-client library
        logger.warning("Polymarket order execution not yet implemented")
        return {
            "success": False,
            "error": "Not implemented",
        }
    
    async def _execute_kalshi_order(
        self,
        ticker: str,
        side: str,
        price: float,
        size: float,
    ) -> dict:
        """
        Execute order on Kalshi via their trading API.
        
        Returns dict with: success, filled_size, fill_price, order_id, fees, error
        """
        # TODO: Implement actual Kalshi order execution
        logger.warning("Kalshi order execution not yet implemented")
        return {
            "success": False,
            "error": "Not implemented",
        }
    
    def get_pending_approvals(self) -> List[Opportunity]:
        """Get opportunities pending manual approval."""
        return list(self._pending_approval)
    
    def approve_opportunity(self, opportunity_id: str) -> bool:
        """Approve a pending opportunity for execution."""
        for i, opp in enumerate(self._pending_approval):
            if opp.id == opportunity_id:
                self._pending_approval.pop(i)
                return True
        return False
    
    def reject_opportunity(self, opportunity_id: str) -> bool:
        """Reject a pending opportunity."""
        for i, opp in enumerate(self._pending_approval):
            if opp.id == opportunity_id:
                self._pending_approval.pop(i)
                logger.info(f"Rejected opportunity {opportunity_id}")
                return True
        return False
    
    def resume_trading(self):
        """Resume trading after pause."""
        self.risk_state.is_paused = False
        self.risk_state.pause_reason = None
        self.risk_state.consecutive_failures = 0
        logger.info("Trading resumed")
    
    def pause_trading(self, reason: str = "Manual pause"):
        """Pause trading."""
        self.risk_state.is_paused = True
        self.risk_state.pause_reason = reason
        logger.info(f"Trading paused: {reason}")
    
    def get_stats(self) -> dict:
        """Get executor statistics."""
        return {
            "dry_run": self.dry_run,
            "daily_pnl": self.risk_state.daily_pnl,
            "daily_trades": self.risk_state.daily_trades,
            "consecutive_failures": self.risk_state.consecutive_failures,
            "is_paused": self.risk_state.is_paused,
            "pause_reason": self.risk_state.pause_reason,
            "trades_requiring_approval": self.risk_state.trades_requiring_approval,
            "pending_approvals": len(self._pending_approval),
            "total_trades": len(self._trades),
        }
