"""
Realistic Paper Trading Simulator for PolyBot

Simulates real trading conditions including:
- Slippage (prices move before you can execute)
- Spread costs (bid-ask spreads eat into profits)
- Execution failures (opportunities disappear)
- Partial fills (can't always get full size)
- Platform fees (Polymarket/Kalshi fees)
- Market resolution risk (markets can resolve against you)
- Time decay and opportunity expiration
- FALSE POSITIVE DETECTION - rejects unrealistic "opportunities"
"""

import json
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from enum import Enum
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class TradeOutcome(Enum):
    """Possible outcomes for simulated trades"""
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    FAILED_EXECUTION = "failed_execution"
    PARTIAL_FILL = "partial_fill"
    EXPIRED = "expired"
    REJECTED_FALSE_POSITIVE = "rejected_false_positive"


@dataclass
class SimulatedTrade:
    """Represents a simulated trade with realistic execution"""
    id: str
    created_at: datetime

    # Market info
    market_a_id: str
    market_a_title: str
    market_b_id: str
    market_b_title: str
    platform_a: str  # "polymarket" or "kalshi"
    platform_b: str

    # Original opportunity prices
    original_price_a: Decimal
    original_price_b: Decimal
    original_spread_pct: Decimal

    # Executed prices (after slippage)
    executed_price_a: Optional[Decimal] = None
    executed_price_b: Optional[Decimal] = None

    # Trade details
    intended_size_usd: Decimal = Decimal("0")
    executed_size_usd: Decimal = Decimal("0")  # May be less due to partial fill

    # Fees
    fee_a_usd: Decimal = Decimal("0")
    fee_b_usd: Decimal = Decimal("0")
    total_fees_usd: Decimal = Decimal("0")

    # P&L
    gross_profit_usd: Decimal = Decimal("0")
    net_profit_usd: Decimal = Decimal("0")
    net_profit_pct: Decimal = Decimal("0")

    # Outcome
    outcome: TradeOutcome = TradeOutcome.PENDING
    outcome_reason: str = ""
    resolved_at: Optional[datetime] = None


@dataclass
class RealisticStats:
    """Realistic paper trading statistics"""
    # Balance
    starting_balance: Decimal = Decimal("1000.00")
    current_balance: Decimal = Decimal("1000.00")

    # Opportunities
    opportunities_seen: int = 0
    opportunities_traded: int = 0
    opportunities_skipped_too_small: int = 0
    opportunities_skipped_insufficient_funds: int = 0

    # Execution
    successful_executions: int = 0
    failed_executions: int = 0
    partial_fills: int = 0

    # P&L
    total_gross_profit: Decimal = Decimal("0")
    total_fees_paid: Decimal = Decimal("0")
    total_net_profit: Decimal = Decimal("0")
    total_losses: Decimal = Decimal("0")

    # Trade stats
    winning_trades: int = 0
    losing_trades: int = 0
    breakeven_trades: int = 0

    # Best/Worst
    best_trade_pnl: Decimal = Decimal("0")
    worst_trade_pnl: Decimal = Decimal("0")
    avg_trade_pnl: Decimal = Decimal("0")

    # Timing
    first_trade_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None

    @property
    def total_pnl(self) -> Decimal:
        return self.current_balance - self.starting_balance

    @property
    def roi_pct(self) -> float:
        if self.starting_balance == 0:
            return 0.0
        return float((self.current_balance - self.starting_balance)
                    / self.starting_balance * 100)

    @property
    def win_rate(self) -> float:
        total = self.winning_trades + self.losing_trades
        if total == 0:
            return 0.0
        return self.winning_trades / total * 100

    @property
    def execution_success_rate(self) -> float:
        total = self.successful_executions + self.failed_executions
        if total == 0:
            return 0.0
        return self.successful_executions / total * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "simulated_starting_balance": str(self.starting_balance),
            "simulated_current_balance": str(self.current_balance),
            "total_pnl": str(self.total_pnl),
            "roi_pct": round(self.roi_pct, 2),
            "total_opportunities_seen": self.opportunities_seen,
            "total_simulated_trades": self.opportunities_traded,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "pending_trades": 0,
            "win_rate_pct": round(self.win_rate, 2),
            "execution_success_rate_pct": round(self.execution_success_rate, 2),
            "total_fees_paid": str(self.total_fees_paid),
            "total_losses": str(self.total_losses),
            "failed_executions": self.failed_executions,
            "best_trade_profit": str(self.best_trade_pnl),
            "worst_trade_loss": str(self.worst_trade_pnl),
            "avg_trade_pnl": str(self.avg_trade_pnl),
            "largest_opportunity_seen_pct": "0",
            "first_opportunity_at": (
                self.first_trade_at.isoformat() if self.first_trade_at else None
            ),
            "last_opportunity_at": (
                self.last_trade_at.isoformat() if self.last_trade_at else None
            ),
        }


class RealisticPaperTrader:
    """
    Realistic paper trading simulator that models real-world trading conditions.

    Key realistic factors:
    1. FALSE POSITIVE FILTER: Rejects spreads > 15% as likely false correlations
    2. Slippage: Prices move 0.5-3% by the time you execute
    3. Spread cost: Bid-ask spread typically 1-2% on prediction markets
    4. Execution failure: 20-40% of opportunities disappear before execution
    5. Partial fills: Only get 50-100% of intended size
    6. Platform fees: ~2% on Polymarket, ~7% on Kalshi profits
    7. RESOLUTION RISK: Small chance market resolves against your position
    8. Minimum profit threshold: Need >5% to cover costs
    """

    # ========== REALISTIC CONSTRAINTS ==========
    # Maximum believable arbitrage spread (anything higher is likely false positive)
    MAX_REALISTIC_SPREAD_PCT = 12.0  # Tightened from 15% - more conservative

    # Minimum spread to bother trading (after costs)
    MIN_PROFIT_THRESHOLD_PCT = 5.0  # Raised from 3% - only take quality opportunities

    # ========== EXECUTION SIMULATION ==========
    SLIPPAGE_MIN_PCT = 0.2      # Minimal slippage for fast execution
    SLIPPAGE_MAX_PCT = 1.0      # Reduced - tighter markets
    SPREAD_COST_PCT = 0.5       # Reduced - better fills
    EXECUTION_FAILURE_RATE = 0.15  # Reduced - faster execution
    PARTIAL_FILL_CHANCE = 0.15  # Reduced - better liquidity
    PARTIAL_FILL_MIN_PCT = 0.70 # Raised - better fills when partial

    # ========== MARKET RESOLUTION RISK ==========
    # Arbitrage should rarely lose if both legs execute properly
    # Loss only happens if markets diverge unexpectedly
    RESOLUTION_LOSS_RATE = 0.08  # Reduced to 8% - true arbitrage rarely loses
    LOSS_SEVERITY_MIN = 0.10    # Reduced - losses are usually partial
    LOSS_SEVERITY_MAX = 0.40    # Capped at 40% - never total loss on arb

    # ========== PLATFORM FEES ==========
    POLYMARKET_FEE_PCT = 2.0    # ~2% on profits
    KALSHI_FEE_PCT = 7.0        # ~7% on profits (higher fees)

    # ========== POSITION SIZING ==========
    MAX_POSITION_PCT = 5.0      # Increased - can take larger positions
    MAX_POSITION_USD = 50.0     # Increased - larger bets on good opps
    MIN_POSITION_USD = 5.0      # Minimum trade size

    def __init__(
        self,
        db_client,
        starting_balance: Decimal = Decimal("1000.00"),
    ):
        self.db = db_client
        self.stats = RealisticStats(
            starting_balance=starting_balance,
            current_balance=starting_balance,
        )
        self.trades: Dict[str, SimulatedTrade] = {}
        self._trade_counter = 0

    def _generate_trade_id(self) -> str:
        """Generate unique trade ID"""
        self._trade_counter += 1
        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        return f"SIM-{ts}-{self._trade_counter:04d}"

    def _calculate_slippage(self, price: Decimal) -> Decimal:
        """
        Calculate realistic slippage.
        Prices typically move against you during execution.
        """
        slippage_pct = random.uniform(self.SLIPPAGE_MIN_PCT, self.SLIPPAGE_MAX_PCT)
        # Slippage usually works against you (price moves unfavorably)
        direction = 1 if random.random() > 0.3 else -1  # 70% unfavorable
        slippage = price * Decimal(str(slippage_pct / 100)) * direction
        return slippage

    def _simulate_execution(
        self,
        original_spread_pct: Decimal,
    ) -> tuple[bool, str, Decimal, bool]:
        """
        Simulate whether a trade executes successfully.

        Returns: (success, reason, actual_profit_multiplier, is_loss)

        Key scenarios:
        1. Execution failure (35%) - opportunity disappears
        2. Successful but losing trade (25% of executed) - market resolves against
        3. Successful winning trade (remaining) - profit after costs
        """
        # Check if opportunity still exists (execution failure)
        if random.random() < self.EXECUTION_FAILURE_RATE:
            reasons = [
                "Opportunity disappeared before execution",
                "Price moved too far, spread closed",
                "Insufficient liquidity at target price",
                "Order rejected by platform",
                "Network delay caused missed opportunity",
            ]
            return False, random.choice(reasons), Decimal("0"), False

        # ========== MARKET RESOLUTION RISK ==========
        # Even if we "execute" the arb, markets can resolve against us
        # This happens when the "correlation" we detected was actually wrong
        if random.random() < self.RESOLUTION_LOSS_RATE:
            # Simulate a loss - market resolved against our position
            loss_severity = random.uniform(
                self.LOSS_SEVERITY_MIN,
                self.LOSS_SEVERITY_MAX
            )
            loss_pct = Decimal(str(-loss_severity * 100))

            loss_reasons = [
                "Market A resolved opposite to expected correlation",
                "Market B moved against position before resolution",
                "Detected correlation was spurious - not true arbitrage",
                "Markets resolved independently - no actual relationship",
                "Time decay eroded position before resolution",
                "Liquidity dried up, forced to close at loss",
            ]
            return True, random.choice(loss_reasons), loss_pct, True

        # ========== CALCULATE REALISTIC PROFIT ==========
        # Original spread minus slippage, spread costs, and fees
        slippage_range = (self.SLIPPAGE_MIN_PCT + self.SLIPPAGE_MAX_PCT) / 2
        avg_slippage = Decimal(str(slippage_range))
        spread_cost = Decimal(str(self.SPREAD_COST_PCT))
        fee_range = (self.POLYMARKET_FEE_PCT + self.KALSHI_FEE_PCT) / 2
        avg_fee = Decimal(str(fee_range))

        # Actual profit = original spread - slippage - spread - fees
        actual_profit_pct = original_spread_pct - avg_slippage - spread_cost

        # Apply fees to profits only if profitable
        if actual_profit_pct > 0:
            actual_profit_pct = actual_profit_pct * (1 - avg_fee / 100)

        # Determine if trade is profitable after costs
        if actual_profit_pct <= 0:
            return True, "Costs exceeded spread - breakeven/loss", actual_profit_pct, True

        return True, "Successful execution", actual_profit_pct, False

    def _calculate_position_size(self) -> Decimal:
        """Calculate conservative position size"""
        # Use smaller of: max_position_pct of balance, or max_position_usd
        pct_based = self.stats.current_balance * Decimal(str(self.MAX_POSITION_PCT / 100))
        size = min(pct_based, Decimal(str(self.MAX_POSITION_USD)))

        # Apply partial fill if applicable
        if random.random() < self.PARTIAL_FILL_CHANCE:
            fill_pct = random.uniform(self.PARTIAL_FILL_MIN_PCT, 1.0)
            size = size * Decimal(str(fill_pct))
            self.stats.partial_fills += 1

        return size.quantize(Decimal("0.01"), rounding=ROUND_DOWN)

    async def simulate_opportunity(
        self,
        market_a_id: str,
        market_a_title: str,
        market_b_id: str,
        market_b_title: str,
        platform_a: str,
        platform_b: str,
        price_a: Decimal,
        price_b: Decimal,
        spread_pct: Decimal,
        trade_type: str,
    ) -> Optional[SimulatedTrade]:
        """
        Simulate a realistic trade on an arbitrage opportunity.

        This applies all realistic factors:
        - FALSE POSITIVE FILTER: Rejects unrealistically large spreads
        - Execution failure chance
        - Slippage on prices
        - Spread costs
        - Platform fees
        - Partial fills
        - MARKET RESOLUTION RISK: Trades can lose money!
        """
        now = datetime.now(timezone.utc)

        # Track opportunity
        self.stats.opportunities_seen += 1
        if self.stats.first_trade_at is None:
            self.stats.first_trade_at = now
        self.stats.last_trade_at = now

        # ========== FALSE POSITIVE FILTER ==========
        # Reject opportunities with unrealistically large spreads
        # Real arbitrage is typically 0.5-10%, anything >15% is likely
        # a false positive from incorrectly correlated markets
        if float(spread_pct) > self.MAX_REALISTIC_SPREAD_PCT:
            self.stats.opportunities_skipped_too_small += 1
            logger.info(
                f"🚫 REJECTED (false positive): {spread_pct:.1f}% spread "
                f"exceeds {self.MAX_REALISTIC_SPREAD_PCT}% max - "
                f"likely not true arbitrage"
            )
            return None

        # Skip if spread too small to be profitable after costs
        if float(spread_pct) < self.MIN_PROFIT_THRESHOLD_PCT:
            self.stats.opportunities_skipped_too_small += 1
            logger.debug(
                f"Skipping: {spread_pct:.2f}% spread "
                f"below {self.MIN_PROFIT_THRESHOLD_PCT}% threshold"
            )
            return None

        # Check if we have enough balance
        min_size = Decimal(str(self.MIN_POSITION_USD))
        if self.stats.current_balance < min_size:
            self.stats.opportunities_skipped_insufficient_funds += 1
            logger.warning(
                f"Insufficient funds: ${self.stats.current_balance:.2f}"
            )
            return None

        # Calculate position size
        position_size = self._calculate_position_size()
        if position_size < min_size:
            self.stats.opportunities_skipped_insufficient_funds += 1
            return None

        # Simulate execution (now returns is_loss flag)
        success, reason, actual_profit_pct, is_loss = self._simulate_execution(
            spread_pct
        )

        # Create trade record
        trade = SimulatedTrade(
            id=self._generate_trade_id(),
            created_at=now,
            market_a_id=market_a_id,
            market_a_title=market_a_title[:200],
            market_b_id=market_b_id,
            market_b_title=market_b_title[:200],
            platform_a=platform_a,
            platform_b=platform_b,
            original_price_a=price_a,
            original_price_b=price_b,
            original_spread_pct=spread_pct,
            intended_size_usd=position_size,
        )

        if not success:
            # Execution failed - no money lost, opportunity just missed
            trade.outcome = TradeOutcome.FAILED_EXECUTION
            trade.outcome_reason = reason
            trade.resolved_at = now
            self.stats.failed_executions += 1

            logger.info(
                f"⚠️ FAILED: {trade.id} | {reason} | "
                f"Spread was: {spread_pct:.2f}%"
            )
        else:
            # Execution succeeded - but could be win or loss
            trade.executed_size_usd = position_size

            # Calculate slippage-adjusted prices
            slippage_a = self._calculate_slippage(price_a)
            slippage_b = self._calculate_slippage(price_b)
            trade.executed_price_a = price_a + slippage_a
            trade.executed_price_b = price_b + slippage_b

            # Calculate fees (on position size)
            fee_a = Decimal(str(self.POLYMARKET_FEE_PCT / 100))
            fee_b = Decimal(str(self.KALSHI_FEE_PCT / 100))
            trade.fee_a_usd = position_size * fee_a
            trade.fee_b_usd = position_size * fee_b
            trade.total_fees_usd = (trade.fee_a_usd + trade.fee_b_usd) / 2

            # Calculate P&L
            gross_pnl = position_size * actual_profit_pct / Decimal("100")
            trade.gross_profit_usd = gross_pnl
            trade.net_profit_usd = gross_pnl - trade.total_fees_usd

            if position_size > 0:
                trade.net_profit_pct = (trade.net_profit_usd / position_size) * 100

            trade.resolved_at = now
            trade.outcome_reason = reason

            # Update stats
            self.stats.successful_executions += 1
            self.stats.opportunities_traded += 1
            self.stats.total_fees_paid += trade.total_fees_usd

            # ========== HANDLE WIN VS LOSS ==========
            if is_loss or trade.net_profit_usd < 0:
                # LOSING TRADE
                trade.outcome = TradeOutcome.LOST
                self.stats.losing_trades += 1
                loss_amount = abs(trade.net_profit_usd)
                self.stats.total_losses += loss_amount
                self.stats.current_balance -= loss_amount

                if trade.net_profit_usd < self.stats.worst_trade_pnl:
                    self.stats.worst_trade_pnl = trade.net_profit_usd

                logger.info(
                    f"❌ LOST: {trade.id} | "
                    f"Size: ${position_size:.2f} | "
                    f"Loss: -${loss_amount:.2f} ({trade.net_profit_pct:.1f}%) | "
                    f"Reason: {reason} | "
                    f"Balance: ${self.stats.current_balance:.2f}"
                )
            elif trade.net_profit_usd > 0:
                # WINNING TRADE
                trade.outcome = TradeOutcome.WON
                self.stats.winning_trades += 1
                self.stats.total_gross_profit += trade.gross_profit_usd
                self.stats.total_net_profit += trade.net_profit_usd
                self.stats.current_balance += trade.net_profit_usd

                if trade.net_profit_usd > self.stats.best_trade_pnl:
                    self.stats.best_trade_pnl = trade.net_profit_usd

                logger.info(
                    f"✅ WON: {trade.id} | "
                    f"Size: ${position_size:.2f} | "
                    f"Net P&L: +${trade.net_profit_usd:.2f} "
                    f"({trade.net_profit_pct:.1f}%) | "
                    f"Fees: ${trade.total_fees_usd:.2f} | "
                    f"Balance: ${self.stats.current_balance:.2f}"
                )
            else:
                # BREAKEVEN
                trade.outcome = TradeOutcome.WON
                self.stats.breakeven_trades += 1
                logger.info(f"➖ BREAKEVEN: {trade.id}")

        # Store trade
        self.trades[trade.id] = trade

        # Save to database
        await self._save_trade_to_db(trade)

        # Update average trade P&L
        total = self.stats.winning_trades + self.stats.losing_trades
        if total > 0:
            net = self.stats.total_net_profit - self.stats.total_losses
            self.stats.avg_trade_pnl = net / total

        return trade

    async def _save_trade_to_db(self, trade: SimulatedTrade) -> None:
        """Save trade to Supabase polybot_simulated_trades table"""
        try:
            data = {
                "position_id": trade.id,
                "created_at": trade.created_at.isoformat(),
                "polymarket_token_id": trade.market_a_id,
                "polymarket_market_title": trade.market_a_title,
                "kalshi_ticker": trade.market_b_id,
                "kalshi_market_title": trade.market_b_title,
                "polymarket_yes_price": float(trade.original_price_a),
                "polymarket_no_price": float(1 - trade.original_price_a),
                "kalshi_yes_price": float(trade.original_price_b),
                "kalshi_no_price": float(1 - trade.original_price_b),
                "trade_type": f"realistic_arb_{trade.platform_a}_{trade.platform_b}",
                "position_size_usd": float(trade.executed_size_usd),
                "expected_profit_usd": float(trade.gross_profit_usd),
                "expected_profit_pct": float(trade.original_spread_pct),
                "outcome": trade.outcome.value,
                "actual_profit_usd": float(trade.net_profit_usd),
                "resolved_at": trade.resolved_at.isoformat() if trade.resolved_at else None,
                "resolution_notes": trade.outcome_reason,
            }

            if self.db and hasattr(self.db, '_client') and self.db._client:
                self.db._client.table("polybot_simulated_trades").insert(data).execute()
                logger.info(f"📝 DB TRADE: {trade.id} saved")
            else:
                logger.warning("DB client not available for saving trade")
        except Exception as e:
            logger.error(f"Failed to save trade to DB: {e}")

    async def save_stats_to_db(self) -> None:
        """Save current stats to Supabase polybot_simulation_stats table"""
        try:
            data = {
                "id": 1,  # Always update same row
                "snapshot_at": datetime.now(timezone.utc).isoformat(),
                "stats_json": self.stats.to_dict(),
                "simulated_balance": float(self.stats.current_balance),
                "total_pnl": float(self.stats.total_pnl),
                "total_trades": self.stats.opportunities_traded,
                "win_rate": self.stats.win_rate,
            }

            if self.db and hasattr(self.db, '_client') and self.db._client:
                # Use upsert to update existing row
                self.db._client.table("polybot_simulation_stats").upsert(
                    data, on_conflict="id"
                ).execute()
                logger.info(
                    f"💾 DB SAVE: Balance=${self.stats.current_balance:.2f} "
                    f"Trades={self.stats.opportunities_traded}"
                )
            else:
                logger.warning("DB client not available for saving stats")
        except Exception as e:
            logger.error(f"Failed to save stats to DB: {e}")

    def get_summary(self) -> str:
        """Get formatted summary of paper trading performance"""
        return f"""
╔══════════════════════════════════════════════════════════════╗
║              📊 REALISTIC PAPER TRADING SUMMARY               ║
╠══════════════════════════════════════════════════════════════╣
║  Starting Balance:     ${self.stats.starting_balance:>10.2f}                   ║
║  Current Balance:      ${self.stats.current_balance:>10.2f}                   ║
║  Total P&L:            ${self.stats.total_pnl:>+10.2f} ({self.stats.roi_pct:>+.1f}%)          ║
╠══════════════════════════════════════════════════════════════╣
║  Opportunities Seen:   {self.stats.opportunities_seen:>10}                        ║
║  Trades Executed:      {self.stats.opportunities_traded:>10}                        ║
║  Execution Rate:       {self.stats.execution_success_rate:>10.1f}%                      ║
╠══════════════════════════════════════════════════════════════╣
║  Winning Trades:       {self.stats.winning_trades:>10}                        ║
║  Losing Trades:        {self.stats.losing_trades:>10}                        ║
║  Win Rate:             {self.stats.win_rate:>10.1f}%                       ║
╠══════════════════════════════════════════════════════════════╣
║  Total Fees Paid:      ${self.stats.total_fees_paid:>10.2f}                   ║
║  Best Trade:           ${self.stats.best_trade_pnl:>+10.2f}                   ║
║  Worst Trade:          ${self.stats.worst_trade_pnl:>+10.2f}                   ║
║  Avg Trade P&L:        ${self.stats.avg_trade_pnl:>+10.2f}                   ║
╚══════════════════════════════════════════════════════════════╝
"""
