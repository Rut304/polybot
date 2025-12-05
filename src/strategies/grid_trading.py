"""
Grid Trading Strategy (75% Confidence)

Expected Returns: 20-60% APY in ranging markets
How it works:
1. Define a price range (e.g., current price ±10%)
2. Place buy orders at regular intervals below current price
3. Place sell orders at regular intervals above current price
4. As price oscillates, orders fill and profit is captured

Why it works:
- Markets spend ~70% of time in consolidation/ranges
- Guaranteed to profit if price oscillates within grid
- 3Commas, Pionex have proven track records with millions of users

Best Markets:
- BTC/USDT (mature, high volume)
- ETH/USDT
- Major forex pairs (EUR/USD, GBP/USD)
- High-volume altcoins

Risks:
- Breakout = stuck in losing position
- Trending markets destroy grid profits
- Requires capital tied up in orders
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Dict, List, Optional, Callable, Set
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class GridStatus(Enum):
    """Status of the grid trading strategy"""
    IDLE = "idle"
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class GridType(Enum):
    """Type of grid"""
    ARITHMETIC = "arithmetic"  # Equal price intervals
    GEOMETRIC = "geometric"    # Equal percentage intervals


@dataclass
class GridLevel:
    """A single level in the grid"""
    id: str
    price: Decimal
    side: str  # "buy" or "sell"
    size: Decimal
    order_id: Optional[str] = None
    status: str = "pending"  # pending, open, filled, cancelled
    filled_at: Optional[datetime] = None
    fill_price: Optional[Decimal] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "price": float(self.price),
            "side": self.side,
            "size": float(self.size),
            "order_id": self.order_id,
            "status": self.status,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "fill_price": float(self.fill_price) if self.fill_price else None,
        }


@dataclass
class GridConfig:
    """Configuration for a grid"""
    symbol: str
    upper_price: Decimal
    lower_price: Decimal
    grid_levels: int
    total_investment: Decimal
    grid_type: GridType = GridType.ARITHMETIC

    @property
    def price_range(self) -> Decimal:
        return self.upper_price - self.lower_price

    @property
    def grid_spacing(self) -> Decimal:
        if self.grid_type == GridType.ARITHMETIC:
            return self.price_range / (self.grid_levels - 1)
        else:
            # Geometric: equal percentage intervals
            ratio = (self.upper_price / self.lower_price) ** (
                Decimal("1") / (self.grid_levels - 1)
            )
            return ratio

    @property
    def order_size(self) -> Decimal:
        return self.total_investment / self.grid_levels

    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "upper_price": float(self.upper_price),
            "lower_price": float(self.lower_price),
            "grid_levels": self.grid_levels,
            "total_investment": float(self.total_investment),
            "grid_type": self.grid_type.value,
            "price_range": float(self.price_range),
            "grid_spacing": float(self.grid_spacing),
            "order_size": float(self.order_size),
        }


@dataclass
class GridStats:
    """Performance tracking for grid trading"""
    total_grids_created: int = 0
    total_buy_fills: int = 0
    total_sell_fills: int = 0
    total_round_trips: int = 0  # Buy followed by sell
    total_profit: Decimal = Decimal("0")
    total_fees: Decimal = Decimal("0")
    total_volume: Decimal = Decimal("0")
    session_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def net_profit(self) -> Decimal:
        return self.total_profit - self.total_fees

    @property
    def avg_profit_per_trip(self) -> Decimal:
        if self.total_round_trips == 0:
            return Decimal("0")
        return self.total_profit / self.total_round_trips

    def to_dict(self) -> Dict:
        duration = (
            datetime.now(timezone.utc) - self.session_start
        ).total_seconds()
        return {
            "session_start": self.session_start.isoformat(),
            "duration_hours": round(duration / 3600, 2),
            "grids_created": self.total_grids_created,
            "buy_fills": self.total_buy_fills,
            "sell_fills": self.total_sell_fills,
            "round_trips": self.total_round_trips,
            "total_profit": float(self.total_profit),
            "total_fees": float(self.total_fees),
            "net_profit": float(self.net_profit),
            "total_volume": float(self.total_volume),
            "avg_profit_per_trip": float(self.avg_profit_per_trip),
        }


@dataclass
class Grid:
    """A complete grid with all levels"""
    id: str
    config: GridConfig
    levels: List[GridLevel]
    status: GridStatus = GridStatus.IDLE
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    last_update: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    # Tracking
    total_buys: int = 0
    total_sells: int = 0
    realized_profit: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    current_position: Decimal = Decimal("0")
    avg_entry_price: Decimal = Decimal("0")

    @property
    def round_trips(self) -> int:
        return min(self.total_buys, self.total_sells)

    @property
    def is_active(self) -> bool:
        return self.status == GridStatus.ACTIVE

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "config": self.config.to_dict(),
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "last_update": self.last_update.isoformat(),
            "total_buys": self.total_buys,
            "total_sells": self.total_sells,
            "round_trips": self.round_trips,
            "realized_profit": float(self.realized_profit),
            "unrealized_pnl": float(self.unrealized_pnl),
            "current_position": float(self.current_position),
            "avg_entry_price": float(self.avg_entry_price),
            "levels_count": len(self.levels),
            "active_orders": sum(
                1 for l in self.levels if l.status == "open"
            ),
        }


# Default symbols for grid trading
DEFAULT_GRID_SYMBOLS = [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "BNB/USDT",
]


class GridTradingStrategy:
    """
    Grid Trading Strategy

    Places a grid of buy/sell orders around the current price.
    Profits from price oscillation within the defined range.
    """

    def __init__(
        self,
        ccxt_client,
        db_client=None,
        # Grid defaults
        default_range_pct: float = 10.0,  # ±10% from current price
        default_grid_levels: int = 20,
        default_investment_usd: float = 500.0,
        # Risk management
        max_grids: int = 3,  # Max concurrent grids
        max_investment_per_grid: float = 1000.0,
        stop_loss_pct: float = 15.0,  # Close grid if price breaks out
        take_profit_pct: float = 50.0,  # Close if profit target reached
        # Timing
        check_interval_sec: int = 30,
        # Exchange
        enabled_exchanges: Optional[List[str]] = None,
        # Callbacks
        on_grid_created: Optional[Callable[[Grid], None]] = None,
        on_order_filled: Optional[Callable[[Grid, GridLevel], None]] = None,
        on_round_trip: Optional[Callable[[Grid, Decimal], None]] = None,
        # Mode
        dry_run: bool = True,
    ):
        self.ccxt_client = ccxt_client
        self.db = db_client

        # Grid defaults
        self.default_range_pct = Decimal(str(default_range_pct))
        self.default_grid_levels = default_grid_levels
        self.default_investment = Decimal(str(default_investment_usd))

        # Risk management
        self.max_grids = max_grids
        self.max_investment = Decimal(str(max_investment_per_grid))
        self.stop_loss_pct = Decimal(str(stop_loss_pct))
        self.take_profit_pct = Decimal(str(take_profit_pct))

        # Timing
        self.check_interval_sec = check_interval_sec

        # Exchanges
        self.enabled_exchanges = enabled_exchanges or ["binance", "bybit"]

        # Callbacks
        self.on_grid_created = on_grid_created
        self.on_order_filled = on_order_filled
        self.on_round_trip = on_round_trip

        # Mode
        self.dry_run = dry_run

        # State
        self.status = GridStatus.IDLE
        self.grids: Dict[str, Grid] = {}  # grid_id -> Grid
        self.stats = GridStats()
        self._running = False
        self._monitor_task: Optional[asyncio.Task] = None

        # Track pending fills for round-trip detection
        self._pending_sells: Dict[str, List[Decimal]] = {}  # symbol -> buy prices

    async def start(self) -> None:
        """Start the grid trading strategy."""
        if self._running:
            logger.warning("Grid trading strategy already running")
            return

        self._running = True
        self.status = GridStatus.ACTIVE
        logger.info("🔲 Starting Grid Trading Strategy")
        logger.info(f"   Default range: ±{self.default_range_pct}%")
        logger.info(f"   Default levels: {self.default_grid_levels}")
        logger.info(f"   Default investment: ${self.default_investment}")
        logger.info(f"   Dry run: {self.dry_run}")

        self._monitor_task = asyncio.create_task(self._monitor_loop())

    async def stop(self) -> None:
        """Stop the strategy gracefully."""
        self._running = False
        self.status = GridStatus.STOPPED

        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        logger.info("🛑 Grid Trading Strategy stopped")
        logger.info(f"   Stats: {self.stats.to_dict()}")

    async def _monitor_loop(self) -> None:
        """Monitor active grids and handle fills."""
        while self._running:
            try:
                await self._check_grids()
                await asyncio.sleep(self.check_interval_sec)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in grid monitor: {e}")
                await asyncio.sleep(60)

    async def create_grid(
        self,
        symbol: str,
        upper_price: Optional[float] = None,
        lower_price: Optional[float] = None,
        grid_levels: Optional[int] = None,
        investment: Optional[float] = None,
        grid_type: GridType = GridType.ARITHMETIC,
    ) -> Optional[Grid]:
        """Create a new grid for a symbol."""
        # Check max grids
        active_grids = sum(1 for g in self.grids.values() if g.is_active)
        if active_grids >= self.max_grids:
            logger.warning(f"Max grids ({self.max_grids}) reached")
            return None

        # Get current price
        try:
            ticker = await self.ccxt_client.get_ticker(symbol)
            current_price = Decimal(str(ticker.last))
        except Exception as e:
            logger.error(f"Failed to get price for {symbol}: {e}")
            return None

        # Calculate grid bounds
        range_pct = self.default_range_pct / 100
        if upper_price is None:
            upper = current_price * (1 + range_pct)
        else:
            upper = Decimal(str(upper_price))

        if lower_price is None:
            lower = current_price * (1 - range_pct)
        else:
            lower = Decimal(str(lower_price))

        levels = grid_levels or self.default_grid_levels
        invest = Decimal(str(investment)) if investment else self.default_investment

        # Validate
        if upper <= lower:
            logger.error("Upper price must be greater than lower price")
            return None

        if invest > self.max_investment:
            logger.warning(
                f"Investment ${invest} exceeds max ${self.max_investment}"
            )
            invest = self.max_investment

        # Create config
        config = GridConfig(
            symbol=symbol,
            upper_price=upper,
            lower_price=lower,
            grid_levels=levels,
            total_investment=invest,
            grid_type=grid_type,
        )

        # Generate grid levels
        grid_levels_list = self._generate_levels(config, current_price)

        # Create grid
        grid = Grid(
            id=str(uuid.uuid4())[:8],
            config=config,
            levels=grid_levels_list,
            status=GridStatus.ACTIVE,
        )

        self.grids[grid.id] = grid
        self.stats.total_grids_created += 1

        logger.info(
            f"🔲 Created grid {grid.id} for {symbol}\n"
            f"   Range: ${float(lower):.2f} - ${float(upper):.2f}\n"
            f"   Levels: {levels} | Investment: ${float(invest):.2f}\n"
            f"   Current price: ${float(current_price):.2f}"
        )

        if self.on_grid_created:
            self.on_grid_created(grid)

        # Place initial orders
        await self._place_grid_orders(grid)

        # Log to database
        if self.db:
            await self._log_grid(grid)

        return grid

    def _generate_levels(
        self, config: GridConfig, current_price: Decimal
    ) -> List[GridLevel]:
        """Generate grid levels based on config."""
        levels = []

        for i in range(config.grid_levels):
            if config.grid_type == GridType.ARITHMETIC:
                price = config.lower_price + (
                    i * config.grid_spacing
                )
            else:  # Geometric
                price = config.lower_price * (
                    config.grid_spacing ** i
                )

            # Round to 2 decimal places
            price = price.quantize(Decimal("0.01"), rounding=ROUND_DOWN)

            # Determine side: below current = buy, above = sell
            side = "buy" if price < current_price else "sell"

            level = GridLevel(
                id=f"L{i}",
                price=price,
                side=side,
                size=config.order_size / price,  # Convert USD to asset
            )
            levels.append(level)

        return levels

    async def _place_grid_orders(self, grid: Grid) -> None:
        """Place orders for all grid levels."""
        for level in grid.levels:
            if level.status != "pending":
                continue

            if self.dry_run:
                # Simulate order placement
                level.order_id = f"sim_{level.id}"
                level.status = "open"
                logger.debug(
                    f"[DRY RUN] Placed {level.side} @ ${float(level.price):.2f}"
                )
            else:
                # Live order placement
                try:
                    from src.exchanges.base import OrderSide, OrderType

                    side = (
                        OrderSide.BUY if level.side == "buy"
                        else OrderSide.SELL
                    )
                    order = await self.ccxt_client.create_order(
                        symbol=grid.config.symbol,
                        side=side,
                        order_type=OrderType.LIMIT,
                        amount=float(level.size),
                        price=float(level.price),
                    )
                    level.order_id = order.id
                    level.status = "open"
                except Exception as e:
                    logger.error(
                        f"Failed to place {level.side} @ {level.price}: {e}"
                    )

    async def _check_grids(self) -> None:
        """Check all active grids for fills and updates."""
        for grid_id, grid in list(self.grids.items()):
            if not grid.is_active:
                continue

            try:
                # Get current price
                ticker = await self.ccxt_client.get_ticker(grid.config.symbol)
                current_price = Decimal(str(ticker.last))

                # Check for stop loss / take profit
                await self._check_grid_exits(grid, current_price)

                # Simulate fills in dry run mode
                if self.dry_run:
                    await self._simulate_fills(grid, current_price)
                else:
                    await self._check_real_fills(grid)

                grid.last_update = datetime.now(timezone.utc)

            except Exception as e:
                logger.error(f"Error checking grid {grid_id}: {e}")

    async def _check_grid_exits(
        self, grid: Grid, current_price: Decimal
    ) -> None:
        """Check if grid should be closed due to breakout."""
        config = grid.config

        # Check stop loss (price broke out of range)
        lower_stop = config.lower_price * (
            1 - self.stop_loss_pct / 100
        )
        upper_stop = config.upper_price * (
            1 + self.stop_loss_pct / 100
        )

        if current_price < lower_stop or current_price > upper_stop:
            logger.warning(
                f"⚠️ Grid {grid.id} stop loss triggered "
                f"(price: ${float(current_price):.2f})"
            )
            await self.close_grid(grid.id, reason="stop_loss")
            return

        # Check take profit
        profit_pct = (
            grid.realized_profit / config.total_investment * 100
        )
        if profit_pct >= self.take_profit_pct:
            logger.info(
                f"🎯 Grid {grid.id} take profit reached "
                f"(profit: {float(profit_pct):.1f}%)"
            )
            await self.close_grid(grid.id, reason="take_profit")

    async def _simulate_fills(
        self, grid: Grid, current_price: Decimal
    ) -> None:
        """Simulate order fills based on price movement (dry run)."""
        for level in grid.levels:
            if level.status != "open":
                continue

            filled = False

            if level.side == "buy" and current_price <= level.price:
                filled = True
                grid.total_buys += 1
                self.stats.total_buy_fills += 1
                # Track for round trip
                if grid.config.symbol not in self._pending_sells:
                    self._pending_sells[grid.config.symbol] = []
                self._pending_sells[grid.config.symbol].append(level.price)

            elif level.side == "sell" and current_price >= level.price:
                filled = True
                grid.total_sells += 1
                self.stats.total_sell_fills += 1
                # Check for round trip
                if self._pending_sells.get(grid.config.symbol):
                    buy_price = self._pending_sells[grid.config.symbol].pop(0)
                    profit = (level.price - buy_price) * level.size
                    grid.realized_profit += profit
                    self.stats.total_profit += profit
                    self.stats.total_round_trips += 1

                    logger.info(
                        f"💰 Round trip completed: "
                        f"Buy ${float(buy_price):.2f} → "
                        f"Sell ${float(level.price):.2f} = "
                        f"+${float(profit):.2f}"
                    )

                    if self.on_round_trip:
                        self.on_round_trip(grid, profit)

            if filled:
                level.status = "filled"
                level.filled_at = datetime.now(timezone.utc)
                level.fill_price = current_price

                if self.on_order_filled:
                    self.on_order_filled(grid, level)

                # Flip the order (buy -> sell at next level up)
                await self._flip_order(grid, level)

    async def _flip_order(self, grid: Grid, filled_level: GridLevel) -> None:
        """After a fill, place opposite order."""
        # Find the corresponding opposite level
        idx = grid.levels.index(filled_level)

        if filled_level.side == "buy" and idx < len(grid.levels) - 1:
            # Place sell order at next level up
            next_level = grid.levels[idx + 1]
            if next_level.status == "filled":
                next_level.side = "sell"
                next_level.status = "pending"
                await self._place_grid_orders(grid)

        elif filled_level.side == "sell" and idx > 0:
            # Place buy order at next level down
            next_level = grid.levels[idx - 1]
            if next_level.status == "filled":
                next_level.side = "buy"
                next_level.status = "pending"
                await self._place_grid_orders(grid)

    async def _check_real_fills(self, grid: Grid) -> None:
        """Check for actual order fills (live mode)."""
        for level in grid.levels:
            if level.status != "open" or not level.order_id:
                continue

            try:
                order = await self.ccxt_client.get_order(
                    level.order_id, grid.config.symbol
                )
                if order.status == "closed":
                    level.status = "filled"
                    level.filled_at = datetime.now(timezone.utc)
                    level.fill_price = Decimal(str(order.price or level.price))

                    if level.side == "buy":
                        grid.total_buys += 1
                        self.stats.total_buy_fills += 1
                    else:
                        grid.total_sells += 1
                        self.stats.total_sell_fills += 1

                    if self.on_order_filled:
                        self.on_order_filled(grid, level)

            except Exception as e:
                logger.debug(f"Error checking order {level.order_id}: {e}")

    async def close_grid(
        self, grid_id: str, reason: str = "manual"
    ) -> bool:
        """Close a grid and cancel all orders."""
        grid = self.grids.get(grid_id)
        if not grid:
            return False

        grid.status = GridStatus.STOPPED

        # Cancel all open orders
        for level in grid.levels:
            if level.status == "open" and level.order_id:
                if not self.dry_run:
                    try:
                        await self.ccxt_client.cancel_order(
                            level.order_id, grid.config.symbol
                        )
                    except Exception:
                        pass
                level.status = "cancelled"

        logger.info(
            f"🛑 Closed grid {grid_id} ({reason})\n"
            f"   Profit: ${float(grid.realized_profit):.2f}\n"
            f"   Round trips: {grid.round_trips}"
        )

        return True

    async def _log_grid(self, grid: Grid) -> None:
        """Log grid to database."""
        if not self.db:
            return

        try:
            data = {
                "strategy": "grid_trading",
                "grid_id": grid.id,
                "symbol": grid.config.symbol,
                "upper_price": float(grid.config.upper_price),
                "lower_price": float(grid.config.lower_price),
                "grid_levels": grid.config.grid_levels,
                "investment": float(grid.config.total_investment),
                "created_at": grid.created_at.isoformat(),
            }

            if hasattr(self.db, '_client') and self.db._client:
                self.db._client.table("polybot_grids").insert(data).execute()
        except Exception as e:
            logger.debug(f"Failed to log grid: {e}")

    def get_status(self) -> Dict:
        """Get current strategy status."""
        return {
            "status": self.status.value,
            "dry_run": self.dry_run,
            "active_grids": sum(1 for g in self.grids.values() if g.is_active),
            "grids": {gid: g.to_dict() for gid, g in self.grids.items()},
            "stats": self.stats.to_dict(),
            "config": {
                "default_range_pct": float(self.default_range_pct),
                "default_grid_levels": self.default_grid_levels,
                "default_investment": float(self.default_investment),
                "max_grids": self.max_grids,
                "stop_loss_pct": float(self.stop_loss_pct),
                "take_profit_pct": float(self.take_profit_pct),
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
