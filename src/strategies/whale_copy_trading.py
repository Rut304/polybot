"""
Whale Wallet Copy Trading Strategy

Based on Twitter research (@RetroValix, @gusik4ever):
"Track wallets with 100% win rates or suspicious patterns.
Follow their trades with delay. Identify early movers on information."

Strategy:
1. Identify whale wallets (high win rate, large positions)
2. Monitor their trading activity in real-time
3. Copy their trades with configurable delay
4. Scale position sizes based on whale conviction

Key insight: Polymarket is transparent on-chain, so we can
see exactly what successful traders are doing.

Criteria for "whale" status:
- Win rate > 70%
- Total volume > $10,000
- Number of predictions > 50
- Recent activity (last 7 days)
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import aiohttp
import json

logger = logging.getLogger(__name__)


class WhaleTier(Enum):
    """Whale classification tiers"""
    MEGA_WHALE = "mega_whale"      # >$100K volume, >80% win
    WHALE = "whale"                 # >$50K volume, >75% win
    SMART_MONEY = "smart_money"     # >$10K volume, >70% win
    RETAIL = "retail"               # Everyone else


class TradeDirection(Enum):
    """Trade direction"""
    BUY_YES = "buy_yes"
    BUY_NO = "buy_no"
    SELL_YES = "sell_yes"
    SELL_NO = "sell_no"


@dataclass
class WhaleProfile:
    """Profile of a tracked whale"""
    address: str
    alias: Optional[str] = None

    # Performance metrics
    total_volume_usd: Decimal = Decimal("0")
    win_rate: float = 0.0
    total_predictions: int = 0
    winning_predictions: int = 0

    # Tier
    tier: WhaleTier = WhaleTier.RETAIL

    # Activity
    last_trade_at: Optional[datetime] = None
    active_positions: int = 0

    # Copy settings
    copy_enabled: bool = True
    copy_multiplier: float = 1.0  # Scale of our position vs whale
    max_copy_size_usd: Decimal = Decimal("100")

    # Track record following this whale
    copy_trades: int = 0
    copy_wins: int = 0
    copy_pnl: Decimal = Decimal("0")

    def calculate_tier(self):
        """Calculate whale tier based on metrics"""
        if self.total_volume_usd >= Decimal("100000") and self.win_rate >= 80:
            self.tier = WhaleTier.MEGA_WHALE
        elif self.total_volume_usd >= Decimal("50000") and self.win_rate >= 75:
            self.tier = WhaleTier.WHALE
        elif self.total_volume_usd >= Decimal("10000") and self.win_rate >= 70:
            self.tier = WhaleTier.SMART_MONEY
        else:
            self.tier = WhaleTier.RETAIL

    def to_dict(self) -> Dict[str, Any]:
        return {
            "address": self.address,
            "alias": self.alias,
            "total_volume_usd": float(self.total_volume_usd),
            "win_rate": self.win_rate,
            "total_predictions": self.total_predictions,
            "tier": self.tier.value,
            "last_trade_at": self.last_trade_at.isoformat() if self.last_trade_at else None,
            "copy_trades": self.copy_trades,
            "copy_wins": self.copy_wins,
            "copy_pnl": float(self.copy_pnl),
        }


@dataclass
class WhaleTrade:
    """A trade made by a whale"""
    id: str
    whale_address: str
    timestamp: datetime

    # Market info
    market_id: str
    market_title: str

    # Trade details
    direction: TradeDirection
    side: str  # "YES" or "NO"
    price: Decimal
    size_usd: Decimal

    # Transaction info
    tx_hash: Optional[str] = None


@dataclass
class CopySignal:
    """A signal to copy a whale trade"""
    id: str
    detected_at: datetime

    # Whale info
    whale_address: str
    whale_tier: WhaleTier
    whale_win_rate: float

    # Trade info
    market_id: str
    market_title: str
    direction: TradeDirection
    side: str
    whale_price: Decimal
    whale_size_usd: Decimal

    # Recommended action
    recommended_size_usd: Decimal
    confidence_score: float
    delay_seconds: int

    def __str__(self) -> str:
        return (
            f"Copy {self.whale_tier.value}: {self.side} {self.market_title[:40]} | "
            f"Whale: ${self.whale_size_usd:.0f} @ {self.whale_price:.0%} | "
            f"Copy: ${self.recommended_size_usd:.0f}"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "whale_address": self.whale_address,
            "whale_tier": self.whale_tier.value,
            "whale_win_rate": self.whale_win_rate,
            "market_id": self.market_id,
            "market_title": self.market_title,
            "direction": self.direction.value,
            "side": self.side,
            "whale_price": float(self.whale_price),
            "whale_size_usd": float(self.whale_size_usd),
            "recommended_size_usd": float(self.recommended_size_usd),
            "confidence_score": self.confidence_score,
        }


@dataclass
class CopyTradingStats:
    """Statistics for copy trading"""
    whales_tracked: int = 0
    trades_detected: int = 0
    trades_copied: int = 0
    trades_won: int = 0
    trades_lost: int = 0
    total_pnl: Decimal = Decimal("0")
    best_whale_pnl: Decimal = Decimal("0")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "whales_tracked": self.whales_tracked,
            "trades_detected": self.trades_detected,
            "trades_copied": self.trades_copied,
            "win_rate": (
                self.trades_won / max(self.trades_won + self.trades_lost, 1) * 100
            ),
            "total_pnl": float(self.total_pnl),
            "best_whale_pnl": float(self.best_whale_pnl),
        }


class WhaleCopyTradingStrategy:
    """
    Whale Copy Trading Strategy

    Monitors successful traders on Polymarket and copies their trades.
    Fully integrated with Supabase for persistence and Admin UI control.

    Configuration:
    - whale_addresses: List of addresses to track
    - min_win_rate: Minimum win rate to qualify as whale
    - min_volume: Minimum volume to qualify as whale
    - copy_delay_seconds: Delay before copying (to confirm trade)
    - copy_multiplier: Scale factor for copy positions

    Features:
    - Auto-discover whales from leaderboard
    - Real-time trade monitoring
    - Configurable copy parameters per whale
    - Performance tracking
    - Supabase persistence (polybot_tracked_whales, polybot_whale_trades, polybot_copy_trades)
    - Admin UI integration for manual whale management
    """

    # Polymarket APIs
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    CLOB_API = "https://clob.polymarket.com"

    # Default whale addresses (known successful traders)
    DEFAULT_WHALES = [
        # Add known whale addresses here
        # These are examples - replace with real addresses
    ]

    def __init__(
        self,
        whale_addresses: Optional[List[str]] = None,
        min_win_rate: float = 70.0,
        min_volume_usd: float = 10000.0,
        min_predictions: int = 50,
        copy_delay_seconds: int = 30,
        default_copy_multiplier: float = 0.5,
        max_copy_size_usd: float = 100.0,
        scan_interval_seconds: int = 60,
        auto_discover_whales: bool = True,
        on_signal: Optional[Callable] = None,
        db_client = None,
        # Slippage protection (NEW)
        slippage_enabled: bool = True,
        max_slippage_pct: float = 5.0,
        balance_proportional: bool = True,
        max_balance_pct: float = 10.0,
    ):
        self.whale_addresses = whale_addresses or self.DEFAULT_WHALES
        self.min_win_rate = min_win_rate
        self.min_volume = Decimal(str(min_volume_usd))
        self.min_predictions = min_predictions
        self.copy_delay = copy_delay_seconds
        self.default_multiplier = default_copy_multiplier
        self.max_copy_size = Decimal(str(max_copy_size_usd))
        self.scan_interval = scan_interval_seconds
        self.auto_discover = auto_discover_whales
        self.on_signal = on_signal
        self.db = db_client

        # Slippage protection settings (NEW)
        self.slippage_enabled = slippage_enabled
        self.max_slippage_pct = max_slippage_pct
        self.balance_proportional = balance_proportional
        self.max_balance_pct = max_balance_pct

        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = CopyTradingStats()

        # Tracked whales
        self._whales: Dict[str, WhaleProfile] = {}

        # Recent trades (to avoid duplicates)
        self._recent_trades: Dict[str, datetime] = {}

        # Pending copy signals
        self._pending_signals: List[CopySignal] = []

        # Snapshot tracking
        self._last_daily_snapshot: Optional[datetime] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_leaderboard(self) -> List[Dict]:
        """Fetch top traders from Polymarket leaderboard"""
        session = await self._get_session()
        traders = []

        try:
            url = f"{self.CLOB_API}/leaderboard"
            params = {
                "limit": 100,
                "period": "all",
            }

            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    traders = data.get("data", [])
                    logger.info(f"Fetched {len(traders)} traders from leaderboard")

        except Exception as e:
            logger.error(f"Error fetching leaderboard: {e}")

        return traders

    async def fetch_trader_profile(self, address: str) -> Optional[Dict]:
        """Fetch detailed profile for a trader"""
        session = await self._get_session()

        try:
            url = f"{self.CLOB_API}/profile/{address}"

            async with session.get(url) as resp:
                if resp.status == 200:
                    return await resp.json()

        except Exception as e:
            logger.debug(f"Error fetching profile {address}: {e}")

        return None

    async def fetch_trader_activity(self, address: str, limit: int = 20) -> List[Dict]:
        """Fetch recent trading activity for an address"""
        session = await self._get_session()
        activity = []

        try:
            url = f"{self.CLOB_API}/activity"
            params = {
                "user": address,
                "limit": limit,
            }

            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    activity = data.get("data", [])

        except Exception as e:
            logger.debug(f"Error fetching activity for {address}: {e}")

        return activity

    async def discover_whales(self) -> List[WhaleProfile]:
        """Auto-discover whales from leaderboard"""
        discovered = []

        if not self.auto_discover:
            return discovered

        # Fetch leaderboard
        traders = await self.fetch_leaderboard()

        for trader in traders:
            address = trader.get("address")
            if not address:
                continue

            # Check if meets criteria
            volume = Decimal(str(trader.get("volume", 0) or 0))
            win_rate = float(trader.get("win_rate", 0) or 0) * 100
            predictions = int(trader.get("predictions", 0) or 0)

            if (volume >= self.min_volume and
                win_rate >= self.min_win_rate and
                predictions >= self.min_predictions):

                profile = WhaleProfile(
                    address=address,
                    alias=trader.get("username"),
                    total_volume_usd=volume,
                    win_rate=win_rate,
                    total_predictions=predictions,
                    winning_predictions=int(predictions * win_rate / 100),
                    copy_multiplier=self.default_multiplier,
                    max_copy_size_usd=self.max_copy_size,
                )
                profile.calculate_tier()

                discovered.append(profile)
                logger.info(
                    f"Discovered whale: {address[:10]}... | "
                    f"Win: {win_rate:.0f}% | Vol: ${volume:,.0f} | "
                    f"Tier: {profile.tier.value}"
                )

        return discovered

    async def update_whale_profiles(self):
        """Update profiles for all tracked whales"""
        for address in list(self._whales.keys()):
            profile_data = await self.fetch_trader_profile(address)

            if profile_data:
                whale = self._whales[address]
                whale.total_volume_usd = Decimal(str(profile_data.get("volume", 0) or 0))
                whale.win_rate = float(profile_data.get("win_rate", 0) or 0) * 100
                whale.total_predictions = int(profile_data.get("predictions", 0) or 0)
                whale.calculate_tier()

    def _parse_trade(self, activity: Dict, whale: WhaleProfile) -> Optional[WhaleTrade]:
        """Parse an activity entry into a WhaleTrade"""
        try:
            trade_type = activity.get("type", "").lower()

            if trade_type not in ["buy", "sell"]:
                return None

            # Determine direction
            side = activity.get("side", "YES").upper()
            if trade_type == "buy":
                direction = TradeDirection.BUY_YES if side == "YES" else TradeDirection.BUY_NO
            else:
                direction = TradeDirection.SELL_YES if side == "YES" else TradeDirection.SELL_NO

            # Get trade details
            price = Decimal(str(activity.get("price", 0.5)))
            size = Decimal(str(activity.get("size_usd", 0) or activity.get("amount", 0)))

            trade = WhaleTrade(
                id=activity.get("id", f"trade-{datetime.utcnow().timestamp()}"),
                whale_address=whale.address,
                timestamp=datetime.now(timezone.utc),
                market_id=activity.get("market_id", ""),
                market_title=activity.get("title", activity.get("question", "Unknown")),
                direction=direction,
                side=side,
                price=price,
                size_usd=size,
                tx_hash=activity.get("tx_hash"),
            )

            return trade

        except Exception as e:
            logger.debug(f"Error parsing trade: {e}")
            return None

    async def detect_whale_trades(self) -> List[WhaleTrade]:
        """Detect new trades from tracked whales and save to DB"""
        new_trades = []

        for address, whale in self._whales.items():
            if not whale.copy_enabled:
                continue

            # Fetch recent activity
            activity = await self.fetch_trader_activity(address)

            for entry in activity:
                trade_id = entry.get("id", "")

                # Skip if already processed
                if trade_id in self._recent_trades:
                    continue

                # Parse trade
                trade = self._parse_trade(entry, whale)
                if trade:
                    new_trades.append(trade)
                    self._recent_trades[trade_id] = datetime.now(timezone.utc)
                    self.stats.trades_detected += 1

                    # Update whale's last_trade_at
                    whale.last_trade_at = datetime.now(timezone.utc)

                    # Save trade to database
                    await self.save_whale_trade_to_db(trade)

                    logger.info(
                        f"🐋 Whale trade detected: {whale.alias or address[:10]}... | "
                        f"{trade.direction.value} {trade.side} | "
                        f"${trade.size_usd:.0f} @ {trade.price:.0%}"
                    )

        # Cleanup old trade IDs
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._recent_trades = {
            k: v for k, v in self._recent_trades.items()
            if v > cutoff
        }

        return new_trades

    async def check_slippage(
        self,
        market_id: str,
        whale_price: Decimal
    ) -> tuple[bool, Decimal, float]:
        """
        Check if current market price has moved too far from whale's entry.

        Returns:
            (ok_to_copy, current_price, slippage_pct)
        """
        try:
            session = await self._get_session()

            # Fetch current market price from CLOB API
            url = f"{self.CLOB_API}/markets/{market_id}"
            async with session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"Failed to fetch market price for slippage check")
                    return True, whale_price, 0.0  # Allow if can't check

                data = await resp.json()

                # Get best bid/ask
                best_bid = Decimal(str(data.get("bestBid", 0) or 0))
                best_ask = Decimal(str(data.get("bestAsk", 1) or 1))
                current_price = (best_bid + best_ask) / 2

                if current_price == 0:
                    return True, whale_price, 0.0

                # Calculate slippage percentage
                slippage_pct = abs(
                    float(current_price - whale_price) / float(whale_price)
                ) * 100

                # Check if within tolerance
                ok = slippage_pct <= self.max_slippage_pct

                if not ok:
                    logger.warning(
                        f"⚠️ Slippage too high: {slippage_pct:.1f}% > "
                        f"{self.max_slippage_pct}% max | "
                        f"Whale: {float(whale_price):.0%} → "
                        f"Now: {float(current_price):.0%}"
                    )

                return ok, current_price, slippage_pct

        except Exception as e:
            logger.error(f"Error checking slippage: {e}")
            return True, whale_price, 0.0  # Allow if error

    async def create_copy_signal(self, trade: WhaleTrade) -> Optional[CopySignal]:
        """Create a copy signal from a whale trade with slippage protection"""
        whale = self._whales.get(trade.whale_address)
        if not whale:
            return None

        # Only copy BUY trades (we want to follow their entries)
        if trade.direction not in [TradeDirection.BUY_YES, TradeDirection.BUY_NO]:
            return None

        # SLIPPAGE PROTECTION: Check if price has moved too much
        if self.slippage_enabled:
            ok, current_price, slippage = await self.check_slippage(
                trade.market_id, trade.price
            )
            if not ok:
                logger.info(
                    f"⏭️ Skipping copy due to slippage ({slippage:.1f}%): "
                    f"{trade.market_title[:30]}"
                )
                return None

        # Calculate recommended size
        base_size = trade.size_usd * Decimal(str(whale.copy_multiplier))
        recommended_size = min(base_size, whale.max_copy_size_usd)

        # BALANCE PROPORTIONAL SIZING: Cap at % of balance
        if self.balance_proportional and self.db:
            try:
                # Get current balance from DB
                balance_data = self.db._client.table("polybot_balances").select(
                    "total_usd"
                ).order("fetched_at", desc=True).limit(1).execute()

                if balance_data.data:
                    total_balance = Decimal(str(balance_data.data[0]["total_usd"]))
                    max_by_balance = total_balance * Decimal(
                        str(self.max_balance_pct / 100)
                    )
                    if recommended_size > max_by_balance:
                        logger.info(
                            f"📊 Size capped by balance: "
                            f"${float(recommended_size):.0f} → "
                            f"${float(max_by_balance):.0f} "
                            f"({self.max_balance_pct}% of ${float(total_balance):.0f})"
                        )
                        recommended_size = max_by_balance
            except Exception as e:
                logger.debug(f"Could not apply balance proportional sizing: {e}")

        # Calculate confidence based on whale tier
        confidence_map = {
            WhaleTier.MEGA_WHALE: 0.95,
            WhaleTier.WHALE: 0.85,
            WhaleTier.SMART_MONEY: 0.75,
            WhaleTier.RETAIL: 0.50,
        }
        confidence = confidence_map.get(whale.tier, 0.50)

        signal = CopySignal(
            id=f"COPY-{datetime.utcnow().strftime('%H%M%S')}-{trade.id[:8]}",
            detected_at=datetime.now(timezone.utc),
            whale_address=trade.whale_address,
            whale_tier=whale.tier,
            whale_win_rate=whale.win_rate,
            market_id=trade.market_id,
            market_title=trade.market_title,
            direction=trade.direction,
            side=trade.side,
            whale_price=trade.price,
            whale_size_usd=trade.size_usd,
            recommended_size_usd=recommended_size,
            confidence_score=confidence,
            delay_seconds=self.copy_delay,
        )

        return signal

    async def scan_for_signals(self) -> List[CopySignal]:
        """Scan for copy trading signals"""
        signals = []

        # Detect new whale trades
        trades = await self.detect_whale_trades()

        # Create signals (now async with slippage check)
        for trade in trades:
            signal = await self.create_copy_signal(trade)
            if signal:
                signals.append(signal)

        # Sort by confidence
        signals.sort(key=lambda x: x.confidence_score, reverse=True)

        if signals:
            logger.info(f"🎯 Found {len(signals)} copy signals!")
            for signal in signals[:3]:
                logger.info(f"   {signal}")

        return signals

    async def initialize(self):
        """Initialize the strategy - load from DB and discover whales"""
        # Load tracked whales from Supabase (configured via Admin UI)
        await self.load_whales_from_db()

        # Add manually configured whales (from code)
        for address in self.whale_addresses:
            if address not in self._whales:
                self._whales[address] = WhaleProfile(
                    address=address,
                    copy_multiplier=self.default_multiplier,
                    max_copy_size_usd=self.max_copy_size,
                )

        # Auto-discover whales from leaderboard
        if self.auto_discover:
            discovered = await self.discover_whales()
            for whale in discovered:
                if whale.address not in self._whales:
                    self._whales[whale.address] = whale
                    # Save discovered whale to DB
                    await self.save_whale_to_db(whale)

        self.stats.whales_tracked = len(self._whales)
        logger.info(f"Tracking {self.stats.whales_tracked} whales")

        # Update profiles from API
        await self.update_whale_profiles()

        # Sync updated profiles back to DB
        await self.sync_whales_to_db()

    async def load_whales_from_db(self):
        """Load tracked whales from Supabase polybot_tracked_whales table"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            logger.warning("No database client - skipping whale load from DB")
            return

        try:
            result = self.db._client.table("polybot_tracked_whales").select("*").execute()

            if result.data:
                for row in result.data:
                    address = row.get("address")
                    if not address:
                        continue

                    # Create WhaleProfile from DB row
                    whale = WhaleProfile(
                        address=address,
                        alias=row.get("alias"),
                        total_volume_usd=Decimal(str(row.get("total_volume_usd", 0) or 0)),
                        win_rate=float(row.get("win_rate", 0) or 0),
                        total_predictions=int(row.get("total_predictions", 0) or 0),
                        winning_predictions=int(row.get("winning_predictions", 0) or 0),
                        copy_enabled=row.get("copy_enabled", False),
                        copy_multiplier=float(row.get("copy_multiplier", self.default_multiplier) or self.default_multiplier),
                        max_copy_size_usd=Decimal(str(row.get("max_copy_size_usd", self.max_copy_size) or self.max_copy_size)),
                        copy_trades=int(row.get("copy_trades", 0) or 0),
                        copy_wins=int(row.get("copy_wins", 0) or 0),
                        copy_pnl=Decimal(str(row.get("copy_pnl", 0) or 0)),
                    )

                    # Parse tier
                    tier_str = row.get("tier", "retail")
                    try:
                        whale.tier = WhaleTier(tier_str)
                    except ValueError:
                        whale.calculate_tier()

                    # Parse last_trade_at
                    if row.get("last_trade_at"):
                        try:
                            whale.last_trade_at = datetime.fromisoformat(
                                row["last_trade_at"].replace("Z", "+00:00")
                            )
                        except:
                            pass

                    self._whales[address] = whale

                logger.info(f"Loaded {len(result.data)} whales from database")
        except Exception as e:
            logger.error(f"Error loading whales from DB: {e}")

    async def save_whale_to_db(self, whale: WhaleProfile):
        """Save a single whale profile to Supabase"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            return

        try:
            self.db._client.table("polybot_tracked_whales").upsert({
                "address": whale.address,
                "alias": whale.alias,
                "total_volume_usd": float(whale.total_volume_usd),
                "win_rate": whale.win_rate,
                "total_predictions": whale.total_predictions,
                "winning_predictions": whale.winning_predictions,
                "tier": whale.tier.value,
                "last_trade_at": whale.last_trade_at.isoformat() if whale.last_trade_at else None,
                "active_positions": whale.active_positions,
                "copy_enabled": whale.copy_enabled,
                "copy_multiplier": whale.copy_multiplier,
                "max_copy_size_usd": float(whale.max_copy_size_usd),
                "copy_trades": whale.copy_trades,
                "copy_wins": whale.copy_wins,
                "copy_pnl": float(whale.copy_pnl),
                "discovery_source": "leaderboard",
            }, on_conflict="address").execute()
        except Exception as e:
            logger.error(f"Error saving whale {whale.address[:10]}... to DB: {e}")

    async def sync_whales_to_db(self):
        """Sync all tracked whales to Supabase"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            return

        for whale in self._whales.values():
            await self.save_whale_to_db(whale)

    async def save_whale_trade_to_db(self, trade: WhaleTrade, copied: bool = False, copy_trade_id: Optional[str] = None):
        """Save a detected whale trade to Supabase"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            return

        try:
            self.db._client.table("polybot_whale_trades").upsert({
                "id": trade.id,
                "whale_address": trade.whale_address,
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "trade_timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
                "market_id": trade.market_id,
                "market_title": trade.market_title[:200] if trade.market_title else None,
                "platform": "polymarket",
                "direction": trade.direction.value,
                "side": trade.side,
                "price": float(trade.price),
                "size_usd": float(trade.size_usd),
                "tx_hash": trade.tx_hash,
                "copied": copied,
                "copy_trade_id": copy_trade_id,
            }, on_conflict="id").execute()
        except Exception as e:
            logger.error(f"Error saving whale trade to DB: {e}")

    async def save_copy_trade_to_db(self, signal: CopySignal, status: str = "open"):
        """Save a copy trade to Supabase"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            return

        try:
            whale = self._whales.get(signal.whale_address)
            self.db._client.table("polybot_copy_trades").upsert({
                "id": signal.id,
                "whale_address": signal.whale_address,
                "whale_trade_id": None,  # Link later if needed
                "signal_at": signal.detected_at.isoformat(),
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "delay_seconds": signal.delay_seconds,
                "market_id": signal.market_id,
                "market_title": signal.market_title[:200] if signal.market_title else None,
                "platform": "polymarket",
                "direction": signal.direction.value,
                "side": signal.side,
                "entry_price": float(signal.whale_price),
                "position_size_usd": float(signal.recommended_size_usd),
                "whale_price": float(signal.whale_price),
                "whale_size_usd": float(signal.whale_size_usd),
                "whale_tier": signal.whale_tier.value,
                "whale_win_rate": signal.whale_win_rate,
                "confidence_score": signal.confidence_score,
                "status": status,
            }, on_conflict="id").execute()
        except Exception as e:
            logger.error(f"Error saving copy trade to DB: {e}")

    async def create_performance_snapshot(self):
        """Create daily performance snapshots for all whales"""
        if not self.db or not hasattr(self.db, '_client') or not self.db._client:
            return

        now = datetime.now(timezone.utc)

        # Check if we already did a daily snapshot today
        if self._last_daily_snapshot:
            if self._last_daily_snapshot.date() == now.date():
                return  # Already snapshotted today

        try:
            for whale in self._whales.values():
                self.db._client.table("polybot_whale_performance_history").insert({
                    "whale_address": whale.address,
                    "snapshot_at": now.isoformat(),
                    "snapshot_period": "daily",
                    "total_volume_usd": float(whale.total_volume_usd),
                    "win_rate": whale.win_rate,
                    "total_predictions": whale.total_predictions,
                    "winning_predictions": whale.winning_predictions,
                    "tier": whale.tier.value,
                    "period_trades": 0,  # Would need to calculate
                    "period_wins": 0,
                    "period_volume_usd": 0,
                    "period_pnl_usd": 0,
                }).execute()

            self._last_daily_snapshot = now
            logger.info(f"Created daily snapshot for {len(self._whales)} whales")
        except Exception as e:
            logger.error(f"Error creating performance snapshot: {e}")

    async def run(self):
        """Run continuous monitoring with database integration"""
        self._running = True
        logger.info("🐋 Starting Whale Copy Trading Strategy")

        # Initialize (loads from DB + discovers)
        await self.initialize()

        scan_count = 0

        while self._running:
            try:
                # Scan for copy signals
                signals = await self.scan_for_signals()

                # Process signals
                for signal in signals:
                    # Save copy trade to DB
                    await self.save_copy_trade_to_db(signal)

                    # Callback for execution
                    if self.on_signal:
                        await self.on_signal(signal)

                scan_count += 1

                # Every 10 scans, refresh whale data from DB (in case Admin UI changed settings)
                if scan_count % 10 == 0:
                    await self.load_whales_from_db()

                # Every 60 scans (~1 hour at 60s interval), update profiles from API
                if scan_count % 60 == 0:
                    await self.update_whale_profiles()
                    await self.sync_whales_to_db()

                # Check for daily snapshot
                await self.create_performance_snapshot()

                await asyncio.sleep(self.scan_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Whale copy trading error: {e}")
                await asyncio.sleep(10)

        await self.close()

    def stop(self):
        """Stop the strategy"""
        self._running = False

    def add_whale(self, address: str, alias: Optional[str] = None):
        """Add a whale to track"""
        if address not in self._whales:
            self._whales[address] = WhaleProfile(
                address=address,
                alias=alias,
                copy_multiplier=self.default_multiplier,
                max_copy_size_usd=self.max_copy_size,
            )
            self.stats.whales_tracked = len(self._whales)

    def remove_whale(self, address: str):
        """Remove a whale from tracking"""
        if address in self._whales:
            del self._whales[address]
            self.stats.whales_tracked = len(self._whales)


# Strategy info for UI
WHALE_COPY_TRADING_INFO = {
    "id": "whale_copy_trading",
    "name": "Whale Copy Trading",
    "confidence": 70,
    "expected_apy": "20-50%",
    "description": (
        "Copy trades from successful 'whale' traders on Polymarket. "
        "Track wallets with high win rates and large volumes, "
        "then automatically follow their positions."
    ),
    "key_points": [
        "Auto-discover whales from leaderboard",
        "Filter by win rate, volume, predictions",
        "Configurable copy delay and sizing",
        "Track performance vs whale",
        "Based on @RetroValix and @gusik4ever research",
    ],
    "platforms": ["Polymarket"],
    "risk_level": "medium",
    "category": "prediction",
}
