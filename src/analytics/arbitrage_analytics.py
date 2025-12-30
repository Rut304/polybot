"""
Arbitrage Analytics Tracker

Tracks performance metrics for each arbitrage strategy type independently.
Essential for knowing what's working and what isn't.

Three Strategy Types:
1. POLYMARKET_SINGLE - Intra-market arbitrage on Polymarket
2. KALSHI_SINGLE - Intra-market arbitrage on Kalshi
3. CROSS_PLATFORM - Polymarket ↔ Kalshi arbitrage
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ArbitrageType(Enum):
    """Types of arbitrage strategies"""
    POLYMARKET_SINGLE = "polymarket_single"
    KALSHI_SINGLE = "kalshi_single"
    CROSS_PLATFORM = "cross_platform"


@dataclass
class StrategyStats:
    """Stats for a single arbitrage strategy"""

    strategy_type: ArbitrageType

    # Opportunity tracking
    opportunities_seen: int = 0
    opportunities_traded: int = 0
    opportunities_skipped: int = 0

    # Trade outcomes
    winning_trades: int = 0
    losing_trades: int = 0
    failed_executions: int = 0

    # P&L tracking
    gross_profit: Decimal = Decimal("0")
    gross_loss: Decimal = Decimal("0")
    total_fees: Decimal = Decimal("0")

    # Best/Worst trades
    best_trade_pnl: Decimal = Decimal("0")
    worst_trade_pnl: Decimal = Decimal("0")

    # Timing
    first_opportunity_at: Optional[datetime] = None
    last_opportunity_at: Optional[datetime] = None
    first_trade_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None

    @property
    def net_pnl(self) -> Decimal:
        """Net P&L after fees and losses"""
        return self.gross_profit - self.gross_loss - self.total_fees

    @property
    def total_trades(self) -> int:
        """Total trades attempted (successful executions)"""
        return self.winning_trades + self.losing_trades

    @property
    def win_rate(self) -> float:
        """Win rate percentage"""
        if self.total_trades == 0:
            return 0.0
        return (self.winning_trades / self.total_trades) * 100

    @property
    def execution_rate(self) -> float:
        """Execution success rate"""
        total_attempts = self.total_trades + self.failed_executions
        if total_attempts == 0:
            return 0.0
        return (self.total_trades / total_attempts) * 100

    @property
    def avg_profit_per_trade(self) -> Decimal:
        """Average net P&L per trade"""
        if self.total_trades == 0:
            return Decimal("0")
        return self.net_pnl / self.total_trades

    def record_opportunity(self):
        """Record that an opportunity was seen"""
        now = datetime.now(timezone.utc)
        self.opportunities_seen += 1
        if self.first_opportunity_at is None:
            self.first_opportunity_at = now
        self.last_opportunity_at = now

    def record_skip(self):
        """Record that an opportunity was skipped"""
        self.opportunities_skipped += 1

    def record_failed_execution(self):
        """Record a failed trade execution"""
        self.failed_executions += 1

    def record_trade(
        self,
        is_win: bool,
        gross_pnl: Decimal,
        fees: Decimal,
    ):
        """Record a completed trade"""
        now = datetime.now(timezone.utc)
        self.opportunities_traded += 1
        self.total_fees += fees

        if self.first_trade_at is None:
            self.first_trade_at = now
        self.last_trade_at = now

        if is_win:
            self.winning_trades += 1
            self.gross_profit += gross_pnl
            if gross_pnl > self.best_trade_pnl:
                self.best_trade_pnl = gross_pnl
        else:
            self.losing_trades += 1
            self.gross_loss += abs(gross_pnl)
            if gross_pnl < self.worst_trade_pnl:
                self.worst_trade_pnl = gross_pnl

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "strategy_type": self.strategy_type.value,
            "opportunities_seen": self.opportunities_seen,
            "opportunities_traded": self.opportunities_traded,
            "opportunities_skipped": self.opportunities_skipped,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "failed_executions": self.failed_executions,
            "total_trades": self.total_trades,
            "win_rate": round(self.win_rate, 2),
            "execution_rate": round(self.execution_rate, 2),
            "gross_profit": float(self.gross_profit),
            "gross_loss": float(self.gross_loss),
            "total_fees": float(self.total_fees),
            "net_pnl": float(self.net_pnl),
            "avg_profit_per_trade": float(self.avg_profit_per_trade),
            "best_trade_pnl": float(self.best_trade_pnl),
            "worst_trade_pnl": float(self.worst_trade_pnl),
            "first_opportunity_at": (
                self.first_opportunity_at.isoformat()
                if self.first_opportunity_at else None
            ),
            "last_trade_at": (
                self.last_trade_at.isoformat()
                if self.last_trade_at else None
            ),
        }


@dataclass
class ArbitrageAnalytics:
    """
    Central analytics tracker for all arbitrage strategies.

    Tracks each strategy type independently for comparison.
    """

    # Per-strategy stats
    polymarket_single: StrategyStats = field(
        default_factory=lambda: StrategyStats(ArbitrageType.POLYMARKET_SINGLE)
    )
    kalshi_single: StrategyStats = field(
        default_factory=lambda: StrategyStats(ArbitrageType.KALSHI_SINGLE)
    )
    cross_platform: StrategyStats = field(
        default_factory=lambda: StrategyStats(ArbitrageType.CROSS_PLATFORM)
    )

    # Overall tracking
    starting_balance: Decimal = Decimal("10000")
    current_balance: Decimal = Decimal("1000")
    session_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    def get_stats(self, arb_type: ArbitrageType) -> StrategyStats:
        """Get stats for a specific strategy type

        Note: Uses .value comparison to handle ArbitrageType enums from
        different modules (scanner vs analytics) which are different class instances.
        """
        # Use .value for comparison to handle cross-module enum instances
        arb_value = arb_type.value if hasattr(arb_type, 'value') else str(arb_type)

        if arb_value == ArbitrageType.POLYMARKET_SINGLE.value:
            return self.polymarket_single
        elif arb_value == ArbitrageType.KALSHI_SINGLE.value:
            return self.kalshi_single
        elif arb_value == ArbitrageType.CROSS_PLATFORM.value:
            return self.cross_platform
        else:
            raise ValueError(f"Unknown arbitrage type: {arb_type} (value={arb_value})")

    def record_opportunity(self, arb_type: ArbitrageType):
        """Record an opportunity seen for a strategy"""
        self.get_stats(arb_type).record_opportunity()

    def record_skip(self, arb_type: ArbitrageType):
        """Record an opportunity skipped for a strategy"""
        self.get_stats(arb_type).record_skip()

    def record_failed_execution(self, arb_type: ArbitrageType):
        """Record a failed execution for a strategy"""
        self.get_stats(arb_type).record_failed_execution()

    def record_trade(
        self,
        arb_type: ArbitrageType,
        is_win: bool,
        gross_pnl: Decimal,
        fees: Decimal,
    ):
        """Record a completed trade for a strategy"""
        stats = self.get_stats(arb_type)
        stats.record_trade(is_win, gross_pnl, fees)

        # Update overall balance
        net_pnl = gross_pnl - fees if is_win else -abs(gross_pnl) - fees
        self.current_balance += net_pnl

    @property
    def total_net_pnl(self) -> Decimal:
        """Total P&L across all strategies"""
        return (
            self.polymarket_single.net_pnl +
            self.kalshi_single.net_pnl +
            self.cross_platform.net_pnl
        )

    @property
    def total_trades(self) -> int:
        """Total trades across all strategies"""
        return (
            self.polymarket_single.total_trades +
            self.kalshi_single.total_trades +
            self.cross_platform.total_trades
        )

    @property
    def total_opportunities(self) -> int:
        """Total opportunities seen across all strategies"""
        return (
            self.polymarket_single.opportunities_seen +
            self.kalshi_single.opportunities_seen +
            self.cross_platform.opportunities_seen
        )

    @property
    def roi_pct(self) -> float:
        """Return on investment percentage"""
        if self.starting_balance == 0:
            return 0.0
        return float(
            (self.current_balance - self.starting_balance)
            / self.starting_balance * 100
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert all stats to dictionary"""
        return {
            "session_start": self.session_start.isoformat(),
            "starting_balance": float(self.starting_balance),
            "current_balance": float(self.current_balance),
            "total_net_pnl": float(self.total_net_pnl),
            "roi_pct": round(self.roi_pct, 2),
            "total_trades": self.total_trades,
            "total_opportunities": self.total_opportunities,
            "strategies": {
                "polymarket_single": self.polymarket_single.to_dict(),
                "kalshi_single": self.kalshi_single.to_dict(),
                "cross_platform": self.cross_platform.to_dict(),
            },
        }

    def get_comparison_summary(self) -> str:
        """Get a formatted comparison of all strategies"""
        ps = self.polymarket_single
        ks = self.kalshi_single
        cp = self.cross_platform

        return f"""
╔══════════════════════════════════════════════════════════════════════╗
║                    📊 ARBITRAGE STRATEGY COMPARISON                   ║
╠══════════════════════════════════════════════════════════════════════╣
║ Strategy              │ Opps  │ Trades │ Win% │ Net P&L  │ Avg/Trade ║
╠═══════════════════════╪═══════╪════════╪══════╪══════════╪═══════════╣
║ Polymarket Single     │ {ps.opportunities_seen:>5} │ {ps.total_trades:>6} │ {ps.win_rate:>4.0f}% │ ${ps.net_pnl:>+7.2f} │ ${ps.avg_profit_per_trade:>+7.2f} ║
║ Kalshi Single         │ {ks.opportunities_seen:>5} │ {ks.total_trades:>6} │ {ks.win_rate:>4.0f}% │ ${ks.net_pnl:>+7.2f} │ ${ks.avg_profit_per_trade:>+7.2f} ║
║ Cross-Platform        │ {cp.opportunities_seen:>5} │ {cp.total_trades:>6} │ {cp.win_rate:>4.0f}% │ ${cp.net_pnl:>+7.2f} │ ${cp.avg_profit_per_trade:>+7.2f} ║
╠═══════════════════════╧═══════╧════════╧══════╧══════════╧═══════════╣
║ TOTAL                                          │ ${self.total_net_pnl:>+7.2f} │ ROI: {self.roi_pct:>+5.1f}% ║
╠══════════════════════════════════════════════════════════════════════╣
║ Starting: ${self.starting_balance:<10.2f}   Current: ${self.current_balance:<10.2f}              ║
╚══════════════════════════════════════════════════════════════════════╝
"""

    def get_recommendation(self) -> str:
        """Analyze which strategy is performing best"""
        strategies = [
            ("Polymarket Single", self.polymarket_single),
            ("Kalshi Single", self.kalshi_single),
            ("Cross-Platform", self.cross_platform),
        ]

        # Find best by net P&L
        best_pnl = max(strategies, key=lambda x: x[1].net_pnl)

        # Find best by win rate (min 5 trades)
        active = [(n, s) for n, s in strategies if s.total_trades >= 5]
        best_winrate = max(active, key=lambda x: x[1].win_rate) if active else None

        # Find most opportunity-rich
        best_volume = max(strategies, key=lambda x: x[1].opportunities_seen)

        rec = []
        rec.append(f"💰 Most Profitable: {best_pnl[0]} (${best_pnl[1].net_pnl:.2f})")
        if best_winrate:
            rec.append(
                f"🎯 Best Win Rate: {best_winrate[0]} ({best_winrate[1].win_rate:.0f}%)"
            )
        rec.append(
            f"📈 Most Opportunities: {best_volume[0]} "
            f"({best_volume[1].opportunities_seen} seen)"
        )

        # Recommendations
        rec.append("\n📋 RECOMMENDATIONS:")

        if self.polymarket_single.net_pnl > self.cross_platform.net_pnl * 2:
            rec.append(
                "  • Polymarket single-platform is outperforming cross-platform "
                "- consider increasing focus there"
            )

        low_volume = [n for n, s in strategies if s.opportunities_seen < 10]
        if low_volume:
            rec.append(
                f"  • Low activity on: {', '.join(low_volume)} "
                "- may need longer runtime or market conditions to improve"
            )

        losing = [n for n, s in strategies if s.net_pnl < 0 and s.total_trades > 5]
        if losing:
            rec.append(
                f"  • Consider disabling: {', '.join(losing)} (negative P&L)"
            )

        return "\n".join(rec)

    async def save_to_db(self, db_client) -> bool:
        """
        Save analytics to Supabase for persistent tracking.
        Creates/updates polybot_arbitrage_analytics table.
        """
        if not db_client or not hasattr(db_client, '_client') or not db_client._client:
            logger.warning("DB client not available for saving analytics")
            return False

        try:
            data = {
                "id": 1,  # Always update same row for current session
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "session_start": self.session_start.isoformat(),
                "starting_balance": float(self.starting_balance),
                "current_balance": float(self.current_balance),
                "total_net_pnl": float(self.total_net_pnl),
                "roi_pct": round(self.roi_pct, 2),
                "total_trades": self.total_trades,
                "total_opportunities": self.total_opportunities,
                # Per-strategy stats as JSON
                "polymarket_single_stats": self.polymarket_single.to_dict(),
                "kalshi_single_stats": self.kalshi_single.to_dict(),
                "cross_platform_stats": self.cross_platform.to_dict(),
            }

            db_client._client.table("polybot_arbitrage_analytics").upsert(
                data, on_conflict="id"
            ).execute()

            logger.info(
                f"📊 ANALYTICS SAVED: {self.total_trades} trades, "
                f"${self.total_net_pnl:.2f} net P&L, "
                f"{self.roi_pct:.1f}% ROI"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save analytics to DB: {e}")
            return False


# Global analytics instance
analytics = ArbitrageAnalytics()


def get_analytics() -> ArbitrageAnalytics:
    """Get the global analytics instance"""
    return analytics


def reset_analytics(starting_balance: Decimal = Decimal("1000")):
    """Reset analytics for a new session"""
    global analytics
    analytics = ArbitrageAnalytics(
        starting_balance=starting_balance,
        current_balance=starting_balance,
    )
    return analytics
