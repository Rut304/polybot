"""
Pairs Trading / Statistical Arbitrage Strategy (65% Confidence)

Expected Returns: 10-25% APY
How it works:
1. Find two correlated assets (e.g., BTC/ETH with ~0.85 correlation)
2. Calculate the spread between them (price_A - beta * price_B)
3. When spread deviates significantly (z-score > 2):
   - Short the outperformer
   - Long the underperformer
4. Exit when spread reverts to mean

Academic Support:
- "Algorithmic Trading of Co-Integrated Assets" (SSRN)
- QuantConnect: "Optimal Pairs Trading" strategy library

Best Pairs (Crypto):
- BTC/ETH (correlation ~0.85)
- SOL/AVAX (L1 competitors)
- LINK/UNI (DeFi tokens)

Best Pairs (Stocks):
- XOM/CVX (oil)
- KO/PEP (beverages)
- V/MA (payments)

Risks:
- Correlation can break down (regime change)
- Spread may widen further before reverting
- Requires both legs to be tradeable
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Callable, Tuple
from enum import Enum
import statistics

logger = logging.getLogger(__name__)


class PairsStatus(Enum):
    """Status of the pairs trading strategy"""
    IDLE = "idle"
    MONITORING = "monitoring"
    POSITIONED = "positioned"
    PAUSED = "paused"
    ERROR = "error"


@dataclass
class TradingPair:
    """A pair of correlated assets for trading"""
    symbol_a: str  # The first asset
    symbol_b: str  # The second asset
    name: str  # Friendly name (e.g., "BTC-ETH")

    # Correlation metrics
    correlation: float = 0.0
    beta: float = 1.0  # Hedge ratio: how much B to trade per unit of A

    # Spread statistics (rolling window)
    spread_mean: float = 0.0
    spread_std: float = 0.0
    current_spread: float = 0.0
    current_zscore: float = 0.0

    # Price data
    price_a: float = 0.0
    price_b: float = 0.0

    # Historical data for calculations
    spread_history: List[float] = field(default_factory=list)
    lookback_periods: int = 30  # Days of data for statistics

    @property
    def is_signal_long_a(self) -> bool:
        """Z-score < -2: A is cheap relative to B"""
        return self.current_zscore < -2.0

    @property
    def is_signal_short_a(self) -> bool:
        """Z-score > 2: A is expensive relative to B"""
        return self.current_zscore > 2.0

    @property
    def has_signal(self) -> bool:
        return abs(self.current_zscore) > 2.0

    def update_prices(self, price_a: float, price_b: float) -> None:
        """Update prices and recalculate spread/zscore."""
        self.price_a = price_a
        self.price_b = price_b

        # Calculate spread: A - beta * B
        self.current_spread = price_a - (self.beta * price_b)

        # Add to history
        self.spread_history.append(self.current_spread)

        # Keep only lookback_periods
        if len(self.spread_history) > self.lookback_periods * 24:  # hourly
            self.spread_history = self.spread_history[-self.lookback_periods * 24:]

        # Update statistics
        if len(self.spread_history) >= 10:
            self.spread_mean = statistics.mean(self.spread_history)
            self.spread_std = statistics.stdev(self.spread_history)

            if self.spread_std > 0:
                self.current_zscore = (
                    self.current_spread - self.spread_mean
                ) / self.spread_std
            else:
                self.current_zscore = 0.0

    def to_dict(self) -> Dict:
        return {
            "symbol_a": self.symbol_a,
            "symbol_b": self.symbol_b,
            "name": self.name,
            "correlation": self.correlation,
            "beta": self.beta,
            "spread_mean": self.spread_mean,
            "spread_std": self.spread_std,
            "current_spread": self.current_spread,
            "current_zscore": round(self.current_zscore, 2),
            "price_a": self.price_a,
            "price_b": self.price_b,
            "has_signal": self.has_signal,
            "signal_direction": (
                "long_a" if self.is_signal_long_a
                else "short_a" if self.is_signal_short_a
                else "none"
            ),
            "history_length": len(self.spread_history),
        }


@dataclass
class PairsPosition:
    """An open pairs trade position"""
    pair: TradingPair
    position_id: str

    # Position details
    side_a: str  # "long" or "short"
    side_b: str  # "long" or "short"
    size_a: Decimal
    size_b: Decimal
    entry_price_a: Decimal
    entry_price_b: Decimal
    entry_zscore: float

    # Tracking
    opened_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    current_pnl_a: Decimal = Decimal("0")
    current_pnl_b: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")

    @property
    def total_pnl(self) -> Decimal:
        return self.current_pnl_a + self.current_pnl_b + self.realized_pnl

    @property
    def hours_open(self) -> float:
        delta = datetime.now(timezone.utc) - self.opened_at
        return delta.total_seconds() / 3600

    def update_pnl(self, current_price_a: float, current_price_b: float):
        """Update unrealized P&L based on current prices."""
        # P&L for leg A
        price_diff_a = Decimal(str(current_price_a)) - self.entry_price_a
        if self.side_a == "long":
            self.current_pnl_a = price_diff_a * self.size_a
        else:
            self.current_pnl_a = -price_diff_a * self.size_a

        # P&L for leg B
        price_diff_b = Decimal(str(current_price_b)) - self.entry_price_b
        if self.side_b == "long":
            self.current_pnl_b = price_diff_b * self.size_b
        else:
            self.current_pnl_b = -price_diff_b * self.size_b

    def to_dict(self) -> Dict:
        return {
            "position_id": self.position_id,
            "pair_name": self.pair.name,
            "side_a": self.side_a,
            "side_b": self.side_b,
            "size_a": float(self.size_a),
            "size_b": float(self.size_b),
            "entry_price_a": float(self.entry_price_a),
            "entry_price_b": float(self.entry_price_b),
            "entry_zscore": self.entry_zscore,
            "current_zscore": self.pair.current_zscore,
            "opened_at": self.opened_at.isoformat(),
            "hours_open": round(self.hours_open, 1),
            "pnl_a": float(self.current_pnl_a),
            "pnl_b": float(self.current_pnl_b),
            "total_pnl": float(self.total_pnl),
        }


@dataclass
class PairsStats:
    """Performance tracking for pairs trading"""
    total_signals: int = 0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: Decimal = Decimal("0")
    total_fees: Decimal = Decimal("0")
    best_trade_pnl: Decimal = Decimal("0")
    worst_trade_pnl: Decimal = Decimal("0")
    avg_hold_hours: float = 0.0
    session_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return self.winning_trades / self.total_trades * 100

    @property
    def net_pnl(self) -> Decimal:
        return self.total_pnl - self.total_fees

    def to_dict(self) -> Dict:
        duration = (
            datetime.now(timezone.utc) - self.session_start
        ).total_seconds()
        return {
            "session_start": self.session_start.isoformat(),
            "duration_hours": round(duration / 3600, 2),
            "total_signals": self.total_signals,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 1),
            "total_pnl": float(self.total_pnl),
            "net_pnl": float(self.net_pnl),
            "best_trade": float(self.best_trade_pnl),
            "worst_trade": float(self.worst_trade_pnl),
            "avg_hold_hours": round(self.avg_hold_hours, 1),
        }


# Default pairs to monitor
DEFAULT_CRYPTO_PAIRS = [
    ("BTC/USDT", "ETH/USDT", "BTC-ETH", 0.85, 15.0),  # symbol_a, symbol_b, name, corr, beta
    ("SOL/USDT", "AVAX/USDT", "SOL-AVAX", 0.78, 3.5),
    ("LINK/USDT", "UNI/USDT", "LINK-UNI", 0.72, 1.8),
    ("BNB/USDT", "SOL/USDT", "BNB-SOL", 0.75, 3.2),
]


class PairsTradingStrategy:
    """
    Pairs Trading / Statistical Arbitrage Strategy

    Monitors correlated asset pairs and trades mean reversion
    when spreads deviate significantly (z-score > 2).
    """

    def __init__(
        self,
        ccxt_client,
        db_client=None,
        # Entry/exit thresholds
        entry_zscore: float = 2.0,  # Enter when |z| > 2
        exit_zscore: float = 0.5,   # Exit when |z| < 0.5
        stop_loss_zscore: float = 4.0,  # Stop if |z| > 4
        # Position sizing
        position_size_usd: float = 500.0,
        max_positions: int = 2,
        # Risk management
        max_hold_hours: float = 72.0,  # Max 3 days
        max_loss_pct: float = 5.0,  # Max 5% loss per trade
        # Timing
        scan_interval_sec: int = 60,
        # Pairs to monitor
        custom_pairs: Optional[List[Tuple]] = None,
        # Callbacks
        on_signal: Optional[Callable[[TradingPair], None]] = None,
        on_trade_opened: Optional[Callable[[PairsPosition], None]] = None,
        on_trade_closed: Optional[Callable[[PairsPosition, Decimal], None]] = None,
        # Mode
        dry_run: bool = True,
    ):
        self.ccxt_client = ccxt_client
        self.db = db_client

        # Thresholds
        self.entry_zscore = entry_zscore
        self.exit_zscore = exit_zscore
        self.stop_loss_zscore = stop_loss_zscore

        # Position sizing
        self.position_size_usd = Decimal(str(position_size_usd))
        self.max_positions = max_positions

        # Risk management
        self.max_hold_hours = max_hold_hours
        self.max_loss_pct = Decimal(str(max_loss_pct))

        # Timing
        self.scan_interval_sec = scan_interval_sec

        # Callbacks
        self.on_signal = on_signal
        self.on_trade_opened = on_trade_opened
        self.on_trade_closed = on_trade_closed

        # Mode
        self.dry_run = dry_run

        # State
        self.status = PairsStatus.IDLE
        self.pairs: Dict[str, TradingPair] = {}
        self.positions: Dict[str, PairsPosition] = {}
        self.stats = PairsStats()
        self._running = False
        self._monitor_task: Optional[asyncio.Task] = None

        # Initialize pairs
        pairs_data = custom_pairs or DEFAULT_CRYPTO_PAIRS
        for p in pairs_data:
            pair = TradingPair(
                symbol_a=p[0],
                symbol_b=p[1],
                name=p[2],
                correlation=p[3],
                beta=p[4],
            )
            self.pairs[pair.name] = pair

    async def start(self) -> None:
        """Start the pairs trading strategy."""
        if self._running:
            logger.warning("Pairs trading strategy already running")
            return

        self._running = True
        self.status = PairsStatus.MONITORING
        logger.info("📊 Starting Pairs Trading Strategy")
        logger.info(f"   Entry z-score: ±{self.entry_zscore}")
        logger.info(f"   Exit z-score: ±{self.exit_zscore}")
        logger.info(f"   Position size: ${self.position_size_usd}")
        logger.info(f"   Pairs: {list(self.pairs.keys())}")
        logger.info(f"   Dry run: {self.dry_run}")

        self._monitor_task = asyncio.create_task(self._monitor_loop())

    async def stop(self) -> None:
        """Stop the strategy gracefully."""
        self._running = False
        self.status = PairsStatus.IDLE

        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        logger.info("🛑 Pairs Trading Strategy stopped")
        logger.info(f"   Stats: {self.stats.to_dict()}")

    async def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        while self._running:
            try:
                await self._update_pairs()
                await self._check_signals()
                await self._manage_positions()
                await asyncio.sleep(self.scan_interval_sec)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pairs monitor: {e}")
                self.status = PairsStatus.ERROR
                await asyncio.sleep(60)

    async def _update_pairs(self) -> None:
        """Update prices and statistics for all pairs."""
        for pair in self.pairs.values():
            try:
                # Fetch current prices
                ticker_a = await self.ccxt_client.get_ticker(pair.symbol_a)
                ticker_b = await self.ccxt_client.get_ticker(pair.symbol_b)

                price_a = ticker_a.last
                price_b = ticker_b.last

                # Update pair with new prices
                pair.update_prices(price_a, price_b)

                logger.debug(
                    f"{pair.name}: A=${price_a:.2f} B=${price_b:.2f} "
                    f"z={pair.current_zscore:.2f}"
                )

            except Exception as e:
                logger.warning(f"Failed to update {pair.name}: {e}")

    async def _check_signals(self) -> None:
        """Check for entry signals on all pairs."""
        active_positions = len(self.positions)

        for pair in self.pairs.values():
            # Skip if already positioned in this pair
            if pair.name in self.positions:
                continue

            # Skip if max positions reached
            if active_positions >= self.max_positions:
                break

            # Check for signal
            if pair.has_signal:
                self.stats.total_signals += 1

                logger.info(
                    f"📊 Signal detected: {pair.name} "
                    f"z-score={pair.current_zscore:.2f}"
                )

                if self.on_signal:
                    self.on_signal(pair)

                # Enter position
                position = await self._enter_position(pair)
                if position:
                    active_positions += 1

        # Update status
        if self.positions:
            self.status = PairsStatus.POSITIONED
        else:
            self.status = PairsStatus.MONITORING

    async def _enter_position(
        self, pair: TradingPair
    ) -> Optional[PairsPosition]:
        """Enter a pairs trade position."""
        import uuid

        # Determine direction
        if pair.is_signal_long_a:
            # A is cheap: Long A, Short B
            side_a = "long"
            side_b = "short"
        else:
            # A is expensive: Short A, Long B
            side_a = "short"
            side_b = "long"

        # Calculate position sizes
        size_a = self.position_size_usd / Decimal(str(pair.price_a))
        size_b = (self.position_size_usd * Decimal(str(pair.beta))) / Decimal(
            str(pair.price_b)
        )

        position = PairsPosition(
            pair=pair,
            position_id=str(uuid.uuid4())[:8],
            side_a=side_a,
            side_b=side_b,
            size_a=size_a,
            size_b=size_b,
            entry_price_a=Decimal(str(pair.price_a)),
            entry_price_b=Decimal(str(pair.price_b)),
            entry_zscore=pair.current_zscore,
        )

        if self.dry_run:
            logger.info(
                f"🎯 [DRY RUN] Entered pairs trade: {pair.name}\n"
                f"   {side_a.upper()} {pair.symbol_a}: "
                f"{float(size_a):.4f} @ ${pair.price_a:.2f}\n"
                f"   {side_b.upper()} {pair.symbol_b}: "
                f"{float(size_b):.4f} @ ${pair.price_b:.2f}\n"
                f"   Entry z-score: {pair.current_zscore:.2f}"
            )
        else:
            # Live trading: place actual orders
            try:
                from src.exchanges.base import OrderSide, OrderType

                # Order for leg A
                side_a_enum = OrderSide.BUY if side_a == "long" else OrderSide.SELL
                await self.ccxt_client.create_order(
                    symbol=pair.symbol_a,
                    side=side_a_enum,
                    order_type=OrderType.MARKET,
                    amount=float(size_a),
                )

                # Order for leg B
                side_b_enum = OrderSide.BUY if side_b == "long" else OrderSide.SELL
                await self.ccxt_client.create_order(
                    symbol=pair.symbol_b,
                    side=side_b_enum,
                    order_type=OrderType.MARKET,
                    amount=float(size_b),
                )

                logger.info(f"📝 Placed pairs trade orders for {pair.name}")

            except Exception as e:
                logger.error(f"Failed to enter pairs position: {e}")
                return None

        self.positions[pair.name] = position
        self.stats.total_trades += 1

        if self.on_trade_opened:
            self.on_trade_opened(position)

        # Log to database
        if self.db:
            await self._log_position(position, "opened")

        return position

    async def _manage_positions(self) -> None:
        """Manage existing positions - check exits."""
        for pair_name, position in list(self.positions.items()):
            pair = position.pair

            # Update P&L
            position.update_pnl(pair.price_a, pair.price_b)

            # Check exit conditions
            should_exit = False
            exit_reason = ""

            # Mean reversion exit
            if abs(pair.current_zscore) < self.exit_zscore:
                should_exit = True
                exit_reason = "mean_reversion"

            # Stop loss - spread widened further
            elif abs(pair.current_zscore) > self.stop_loss_zscore:
                should_exit = True
                exit_reason = "stop_loss"

            # Time-based exit
            elif position.hours_open > self.max_hold_hours:
                should_exit = True
                exit_reason = "max_hold_time"

            # P&L stop loss
            loss_pct = -position.total_pnl / self.position_size_usd * 100
            if loss_pct > self.max_loss_pct:
                should_exit = True
                exit_reason = "max_loss"

            if should_exit:
                await self._exit_position(position, exit_reason)

    async def _exit_position(
        self, position: PairsPosition, reason: str
    ) -> Decimal:
        """Exit a pairs trade position."""
        pair = position.pair
        pnl = position.total_pnl

        if self.dry_run:
            logger.info(
                f"💰 [DRY RUN] Exited pairs trade: {pair.name}\n"
                f"   Reason: {reason}\n"
                f"   Entry z-score: {position.entry_zscore:.2f}\n"
                f"   Exit z-score: {pair.current_zscore:.2f}\n"
                f"   P&L: ${float(pnl):.2f}\n"
                f"   Hold time: {position.hours_open:.1f}h"
            )
        else:
            # Live trading: close positions
            try:
                from src.exchanges.base import OrderSide, OrderType

                # Close leg A (opposite of entry)
                side_a = (
                    OrderSide.SELL if position.side_a == "long"
                    else OrderSide.BUY
                )
                await self.ccxt_client.create_order(
                    symbol=pair.symbol_a,
                    side=side_a,
                    order_type=OrderType.MARKET,
                    amount=float(position.size_a),
                )

                # Close leg B
                side_b = (
                    OrderSide.SELL if position.side_b == "long"
                    else OrderSide.BUY
                )
                await self.ccxt_client.create_order(
                    symbol=pair.symbol_b,
                    side=side_b,
                    order_type=OrderType.MARKET,
                    amount=float(position.size_b),
                )

            except Exception as e:
                logger.error(f"Failed to close pairs position: {e}")

        # Update stats
        self.stats.total_pnl += pnl
        if pnl > 0:
            self.stats.winning_trades += 1
            if pnl > self.stats.best_trade_pnl:
                self.stats.best_trade_pnl = pnl
        else:
            self.stats.losing_trades += 1
            if pnl < self.stats.worst_trade_pnl:
                self.stats.worst_trade_pnl = pnl

        # Update average hold time
        total_trades = self.stats.winning_trades + self.stats.losing_trades
        self.stats.avg_hold_hours = (
            (self.stats.avg_hold_hours * (total_trades - 1) + position.hours_open)
            / total_trades
        )

        # Remove position
        del self.positions[pair.name]

        if self.on_trade_closed:
            self.on_trade_closed(position, pnl)

        # Log to database
        if self.db:
            await self._log_position(position, "closed", reason, pnl)

        return pnl

    async def _log_position(
        self, position: PairsPosition, action: str,
        reason: str = "", pnl: Decimal = Decimal("0")
    ) -> None:
        """Log position to database."""
        if not self.db:
            return

        try:
            data = {
                "strategy": "pairs_trading",
                "position_id": position.position_id,
                "pair_name": position.pair.name,
                "action": action,
                "side_a": position.side_a,
                "side_b": position.side_b,
                "entry_zscore": position.entry_zscore,
                "exit_zscore": position.pair.current_zscore,
                "pnl": float(pnl),
                "reason": reason,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            if hasattr(self.db, '_client') and self.db._client:
                self.db._client.table("polybot_pairs_trades").insert(
                    data
                ).execute()
        except Exception as e:
            logger.debug(f"Failed to log position: {e}")

    def add_pair(
        self, symbol_a: str, symbol_b: str, name: str,
        correlation: float = 0.8, beta: float = 1.0
    ) -> None:
        """Add a custom pair to monitor."""
        pair = TradingPair(
            symbol_a=symbol_a,
            symbol_b=symbol_b,
            name=name,
            correlation=correlation,
            beta=beta,
        )
        self.pairs[name] = pair
        logger.info(f"Added pair: {name} ({symbol_a}/{symbol_b})")

    def remove_pair(self, name: str) -> None:
        """Remove a pair from monitoring."""
        if name in self.pairs:
            del self.pairs[name]
            logger.info(f"Removed pair: {name}")

    def get_status(self) -> Dict:
        """Get current strategy status."""
        return {
            "status": self.status.value,
            "dry_run": self.dry_run,
            "active_positions": len(self.positions),
            "pairs": {name: p.to_dict() for name, p in self.pairs.items()},
            "positions": {
                name: p.to_dict() for name, p in self.positions.items()
            },
            "stats": self.stats.to_dict(),
            "config": {
                "entry_zscore": self.entry_zscore,
                "exit_zscore": self.exit_zscore,
                "stop_loss_zscore": self.stop_loss_zscore,
                "position_size_usd": float(self.position_size_usd),
                "max_positions": self.max_positions,
                "max_hold_hours": self.max_hold_hours,
            },
        }

    async def run(self, duration_seconds: int = 3600) -> None:
        """
        Run the strategy for a specified duration.
        
        This is the main entry point matching other strategy interfaces.
        
        Args:
            duration_seconds: How long to run (default 1 hour)
        """
        await self.start()
        
        try:
            # Wait for duration or until stopped
            await asyncio.sleep(duration_seconds)
        except asyncio.CancelledError:
            pass
        finally:
            await self.stop()
