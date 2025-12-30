"""
Copy Trading Engine for PolyBot.

Tracks top Polymarket traders and mirrors their positions with proportional sizing.
Uses Polymarket's data API to monitor wallet activity.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
import httpx

logger = logging.getLogger(__name__)


@dataclass
class TrackedTrader:
    """A trader we're copying."""
    address: str
    name: str  # Display name
    total_profit: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    last_checked: Optional[datetime] = None
    is_active: bool = True
    copy_multiplier: float = 0.1  # Copy 10% of their position size by default


@dataclass
class TraderPosition:
    """A position held by a tracked trader."""
    address: str
    condition_id: str
    market_title: str
    outcome: str  # 'Yes' or 'No'
    size: float
    avg_price: float
    current_value: float
    pnl: float
    pnl_percent: float


@dataclass
class CopySignal:
    """A signal to copy a trade."""
    trader_address: str
    trader_name: str
    action: str  # 'buy' or 'sell'
    condition_id: str
    token_id: str
    market_title: str
    outcome: str
    size: float
    price: float
    copy_size: float  # Adjusted for our multiplier
    detected_at: datetime = field(default_factory=datetime.utcnow)


class CopyTradingEngine:
    """
    Monitors top Polymarket traders and generates copy signals.

    Features:
    - Track multiple wallets
    - Detect new positions and exits
    - Proportional position sizing
    - Configurable copy multipliers per trader
    """

    # Top traders to track (you can customize this list)
    DEFAULT_TRADERS = [
        # These are example addresses - replace with real top traders
        # You can find top traders at: https://polymarket.com/leaderboard
        TrackedTrader(
            address="0x1234567890abcdef1234567890abcdef12345678",
            name="Whale_Alpha",
            copy_multiplier=0.05,
        ),
    ]

    POSITIONS_API = "https://data-api.polymarket.com/positions"
    TRADES_API = "https://data-api.polymarket.com/trades"
    LEADERBOARD_API = "https://polymarket.com/api/leaderboard"

    def __init__(
        self,
        max_copy_size: float = 50.0,  # Max USD per copy trade
        min_copy_size: float = 5.0,   # Min USD to bother copying
        check_interval: int = 30,      # Seconds between checks
    ):
        self.max_copy_size = max_copy_size
        self.min_copy_size = min_copy_size
        self.check_interval = check_interval

        # Tracked traders
        self.traders: Dict[str, TrackedTrader] = {}

        # Last known positions per trader
        self._last_positions: Dict[str, Dict[str, TraderPosition]] = {}

        # Pending signals
        self._pending_signals: List[CopySignal] = []

        # Running state
        self._is_running = False
        self._http_client: Optional[httpx.AsyncClient] = None

    def add_trader(self, address: str, name: str, multiplier: float = 0.1) -> None:
        """Add a trader to track."""
        self.traders[address.lower()] = TrackedTrader(
            address=address.lower(),
            name=name,
            copy_multiplier=multiplier,
        )
        logger.info(f"Now tracking trader: {name} ({address[:10]}...)")

    def remove_trader(self, address: str) -> None:
        """Stop tracking a trader."""
        address = address.lower()
        if address in self.traders:
            del self.traders[address]
            logger.info(f"Stopped tracking: {address[:10]}...")

    async def fetch_trader_positions(self, address: str) -> List[TraderPosition]:
        """Fetch current positions for a trader."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)

        try:
            response = await self._http_client.get(
                self.POSITIONS_API,
                params={
                    "user": address,
                    "sortBy": "CURRENT",
                    "sortDirection": "DESC",
                    "sizeThreshold": 0.1,
                    "limit": 100,
                }
            )
            response.raise_for_status()
            data = response.json()

            positions = []
            for pos in data:
                positions.append(TraderPosition(
                    address=address,
                    condition_id=pos.get("conditionId", ""),
                    market_title=pos.get("title", "Unknown"),
                    outcome=pos.get("outcome", "Yes"),
                    size=float(pos.get("size", 0)),
                    avg_price=float(pos.get("avgPrice", 0)),
                    current_value=float(pos.get("currentValue", 0)),
                    pnl=float(pos.get("pnl", 0)),
                    pnl_percent=float(pos.get("pnlPercent", 0)),
                ))

            return positions

        except Exception as e:
            logger.error(f"Failed to fetch positions for {address[:10]}: {e}")
            return []

    async def fetch_trader_recent_trades(
        self,
        address: str,
        since: Optional[datetime] = None
    ) -> List[Dict]:
        """Fetch recent trades for a trader."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)

        try:
            params = {
                "user": address,
                "limit": 50,
            }
            if since:
                params["after"] = int(since.timestamp() * 1000)

            response = await self._http_client.get(self.TRADES_API, params=params)
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"Failed to fetch trades for {address[:10]}: {e}")
            return []

    def detect_position_changes(
        self,
        address: str,
        current_positions: List[TraderPosition],
    ) -> List[CopySignal]:
        """
        Compare current positions to last known and generate signals.
        """
        signals = []
        trader = self.traders.get(address.lower())
        if not trader:
            return signals

        # Get last known positions
        last_positions = self._last_positions.get(address, {})
        current_by_id = {p.condition_id: p for p in current_positions}

        # Detect new positions (buys)
        for cond_id, pos in current_by_id.items():
            last_pos = last_positions.get(cond_id)

            if last_pos is None:
                # New position - generate buy signal
                copy_size = min(
                    pos.size * trader.copy_multiplier,
                    self.max_copy_size
                )

                if copy_size >= self.min_copy_size:
                    signals.append(CopySignal(
                        trader_address=address,
                        trader_name=trader.name,
                        action="buy",
                        condition_id=cond_id,
                        token_id=cond_id,  # Will need to map to token
                        market_title=pos.market_title,
                        outcome=pos.outcome,
                        size=pos.size,
                        price=pos.avg_price,
                        copy_size=copy_size,
                    ))
                    logger.info(
                        f"📈 COPY SIGNAL: {trader.name} bought ${pos.size:.2f} of "
                        f"'{pos.market_title}' ({pos.outcome}) - copy ${copy_size:.2f}"
                    )

            elif pos.size < last_pos.size * 0.5:
                # Position reduced by >50% - partial exit
                reduction = last_pos.size - pos.size
                copy_size = min(
                    reduction * trader.copy_multiplier,
                    self.max_copy_size
                )

                if copy_size >= self.min_copy_size:
                    signals.append(CopySignal(
                        trader_address=address,
                        trader_name=trader.name,
                        action="sell",
                        condition_id=cond_id,
                        token_id=cond_id,
                        market_title=pos.market_title,
                        outcome=pos.outcome,
                        size=reduction,
                        price=pos.avg_price,
                        copy_size=copy_size,
                    ))
                    logger.info(
                        f"📉 COPY SIGNAL: {trader.name} reduced "
                        f"'{pos.market_title}' by ${reduction:.2f}"
                    )

        # Detect closed positions (sells)
        for cond_id, last_pos in last_positions.items():
            if cond_id not in current_by_id:
                # Position closed
                copy_size = min(
                    last_pos.size * trader.copy_multiplier,
                    self.max_copy_size
                )

                if copy_size >= self.min_copy_size:
                    signals.append(CopySignal(
                        trader_address=address,
                        trader_name=trader.name,
                        action="sell",
                        condition_id=cond_id,
                        token_id=cond_id,
                        market_title=last_pos.market_title,
                        outcome=last_pos.outcome,
                        size=last_pos.size,
                        price=last_pos.avg_price,
                        copy_size=copy_size,
                    ))
                    logger.info(
                        f"🚪 COPY SIGNAL: {trader.name} exited "
                        f"'{last_pos.market_title}' (${last_pos.size:.2f})"
                    )

        # Update last known positions
        self._last_positions[address] = current_by_id

        return signals

    async def check_all_traders(self) -> List[CopySignal]:
        """Check all tracked traders for new signals."""
        all_signals = []

        for address, trader in self.traders.items():
            if not trader.is_active:
                continue

            positions = await self.fetch_trader_positions(address)
            signals = self.detect_position_changes(address, positions)
            all_signals.extend(signals)

            trader.last_checked = datetime.utcnow()

        return all_signals

    async def run(self, callback: Optional[callable] = None) -> None:
        """
        Run the copy trading engine continuously.

        Args:
            callback: Optional async function to call with each signal
        """
        self._is_running = True
        self._http_client = httpx.AsyncClient(timeout=30.0)

        logger.info(f"🚀 Copy Trading Engine started, tracking {len(self.traders)} traders")

        try:
            while self._is_running:
                try:
                    signals = await self.check_all_traders()

                    for signal in signals:
                        self._pending_signals.append(signal)
                        if callback:
                            await callback(signal)

                    await asyncio.sleep(self.check_interval)

                except Exception as e:
                    logger.error(f"Error in copy trading loop: {e}")
                    await asyncio.sleep(5)

        finally:
            if self._http_client:
                await self._http_client.aclose()

    def stop(self) -> None:
        """Stop the copy trading engine."""
        self._is_running = False
        logger.info("Copy Trading Engine stopped")

    def get_pending_signals(self) -> List[CopySignal]:
        """Get and clear pending signals."""
        signals = self._pending_signals.copy()
        self._pending_signals.clear()
        return signals

    async def fetch_leaderboard(self, limit: int = 50) -> List[Dict]:
        """
        Fetch top traders from leaderboard.
        Useful for discovering new traders to copy.
        """
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)

        try:
            # This endpoint may require authentication or different URL
            response = await self._http_client.get(
                "https://polymarket.com/api/leaderboard",
                params={"limit": limit}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch leaderboard: {e}")
            return []
