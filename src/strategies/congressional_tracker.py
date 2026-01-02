"""
Congressional Tracker Strategy

Track and copy trades made by members of Congress using public disclosure data.
Members of Congress are required to disclose stock trades within 45 days of execution
under the STOCK Act (2012).

Data Sources (all free):
- House Stock Watcher API (https://housestockwatcher.com)
- Senate Stock Watcher API (https://senatestockwatcher.com)
- Quiver Quant (https://www.quiverquant.com) - Free tier

Strategy Premise:
Congress members have access to non-public information through briefings, committee
meetings, and insider knowledge of upcoming legislation. Studies show their trades
significantly outperform the market (~12% annually vs S&P 500).

Key Features:
- Track specific politicians by name
- Filter by party, state, committee membership
- Size positions relative to your bankroll
- Delay execution to avoid front-running concerns
- Track performance per politician
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import aiohttp
import json
import re

logger = logging.getLogger(__name__)


class Chamber(Enum):
    """Congressional chamber"""
    HOUSE = "house"
    SENATE = "senate"
    BOTH = "both"


class Party(Enum):
    """Political party"""
    DEMOCRAT = "D"
    REPUBLICAN = "R"
    INDEPENDENT = "I"
    ANY = "any"


class TransactionType(Enum):
    """Type of stock transaction"""
    PURCHASE = "purchase"
    SALE = "sale"
    EXCHANGE = "exchange"


@dataclass
class Politician:
    """Profile of a tracked politician"""
    name: str
    chamber: Chamber
    party: Party
    state: str
    district: Optional[str] = None  # House only
    committees: List[str] = field(default_factory=list)

    # Performance tracking
    total_trades: int = 0
    winning_trades: int = 0
    total_pnl_usd: Decimal = Decimal("0")
    avg_return_pct: float = 0.0

    # Copy settings
    copy_enabled: bool = False
    copy_scale_pct: float = 100.0  # % of their trade to copy
    max_copy_size_usd: Decimal = Decimal("1000")

    # Metadata
    first_tracked_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None

    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return (self.winning_trades / self.total_trades) * 100


@dataclass
class CongressionalTrade:
    """A trade disclosed by a member of Congress"""
    id: str
    politician_name: str
    chamber: Chamber
    party: Party
    state: str

    # Trade details
    ticker: str
    asset_name: str
    transaction_type: TransactionType
    transaction_date: datetime
    disclosure_date: datetime

    # Amount (usually a range like "$1,001 - $15,000")
    amount_range_low: Decimal
    amount_range_high: Decimal
    amount_estimated: Decimal  # Midpoint estimate

    # Price at disclosure (for tracking delayed impact)
    price_at_trade: Optional[float] = None
    price_at_disclosure: Optional[float] = None
    price_current: Optional[float] = None

    # Source info
    source: str = "house_stock_watcher"
    disclosure_url: Optional[str] = None

    # Copy info
    copied: bool = False
    copy_trade_id: Optional[str] = None


@dataclass
class CopySignal:
    """Signal to copy a congressional trade"""
    signal_id: str
    politician: Politician
    original_trade: CongressionalTrade

    # Copy parameters
    ticker: str
    direction: str  # "buy" or "sell"
    position_size_usd: Decimal

    # Confidence scoring
    confidence_score: float  # 0-1
    reasoning: List[str]

    # Timing
    created_at: datetime = field(default_factory=datetime.utcnow)
    execute_after: Optional[datetime] = None
    expires_at: Optional[datetime] = None


@dataclass
class CongressionalTrackerStats:
    """Statistics for congressional tracking"""
    politicians_tracked: int = 0
    trades_detected: int = 0
    trades_copied: int = 0
    copy_wins: int = 0
    copy_losses: int = 0
    total_copy_pnl: Decimal = Decimal("0")
    best_politician: Optional[str] = None
    best_return_pct: float = 0.0

    def win_rate(self) -> float:
        total = self.copy_wins + self.copy_losses
        return (self.copy_wins / total * 100) if total > 0 else 0.0


class CongressionalTrackerStrategy:
    """
    Congressional Tracker Strategy

    Monitors stock trades by members of Congress and copies them,
    scaled to your bankroll.

    Configuration:
    - tracked_politicians: List of politician names to track
    - chambers: Which chamber(s) to monitor (house, senate, both)
    - parties: Which party/parties to track (D, R, I, any)
    - min_trade_amount: Minimum trade amount to copy
    - copy_scale_pct: What % of their trade to copy (scaled to your bankroll)
    - max_position_usd: Maximum position size
    - delay_hours: How long to wait after disclosure before copying

    Features:
    - Auto-discover top-performing politicians
    - Real-time trade monitoring via API
    - Configurable copy parameters per politician
    - Performance tracking
    - Supabase persistence (polybot_tracked_politicians, etc.)
    - Admin UI integration for politician management
    """

    # API endpoints (all free)
    HOUSE_API = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json"
    SENATE_API = "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json"
    QUIVER_API = "https://api.quiverquant.com/beta/live/congresstrading"

    # =========================================================================
    # FASTER/ALTERNATIVE DATA SOURCES (Added Jan 2025)
    # Official filings have 45-day delay. These sources are often faster:
    # =========================================================================

    # Capitol Trades - Often gets disclosures 24-48h faster than official APIs
    # Website scrapes directly from House/Senate filing portals
    CAPITOL_TRADES_API = "https://www.capitoltrades.com/api/trades"

    # Unusual Whales - Commercial API with fast disclosure alerts
    # Free tier available, premium for faster alerts
    # Docs: https://docs.unusualwhales.com/api-reference/congress
    UNUSUAL_WHALES_API = "https://api.unusualwhales.com/api/congress/trades"

    # Twitter/X accounts for real-time alerts (monitor via Twitter API)
    # These accounts often post within hours of filing
    TWITTER_ALERT_ACCOUNTS = [
        "@unusual_whales",      # Fast, high-quality alerts
        "@capitoltrades",       # Good coverage
        "@quaborot",            # Quantitative analysis
        "@congresstradesbot",   # Automated bot
        "@CongressWatcher_",    # News and analysis
        "@PelosiTracker_",      # Nancy Pelosi specific
    ]

    # RSS feeds for alternative monitoring
    RSS_FEEDS = [
        "https://housestockwatcher.com/feed",
        "https://senatestockwatcher.com/feed",
    ]

    # Amount range mapping (Congress uses ranges, not exact amounts)
    AMOUNT_RANGES = {
        "$1,001 - $15,000": (1001, 15000),
        "$15,001 - $50,000": (15001, 50000),
        "$50,001 - $100,000": (50001, 100000),
        "$100,001 - $250,000": (100001, 250000),
        "$250,001 - $500,000": (250001, 500000),
        "$500,001 - $1,000,000": (500001, 1000000),
        "$1,000,001 - $5,000,000": (1000001, 5000000),
        "$5,000,001 - $25,000,000": (5000001, 25000000),
        "$25,000,001 - $50,000,000": (25000001, 50000000),
        "Over $50,000,000": (50000001, 100000000),
    }

    # Known high-performers (based on public analysis)
    # These are examples - actual performance varies
    DEFAULT_WATCHLIST = [
        "Nancy Pelosi",
        "Dan Crenshaw",
        "Marjorie Taylor Greene",
        "Josh Gottheimer",
        "Michael McCaul",
        "Tommy Tuberville",
        "Ro Khanna",
    ]

    def __init__(
        self,
        tracked_politicians: Optional[List[str]] = None,
        chambers: Chamber = Chamber.BOTH,
        parties: Party = Party.ANY,
        min_trade_amount_usd: float = 1000.0,
        copy_scale_pct: float = 10.0,  # Copy 10% of their trade size
        max_position_usd: float = 1000.0,
        delay_hours: int = 0,  # Hours to wait after disclosure
        scan_interval_seconds: int = 3600,  # Check every hour
        auto_discover: bool = True,
        bankroll_usd: float = 10000.0,  # Your total bankroll
        on_signal: Optional[Callable] = None,
        db_client=None,
    ):
        self.tracked_politicians = set(tracked_politicians or self.DEFAULT_WATCHLIST)
        self.chambers = chambers
        self.parties = parties
        self.min_trade_amount = Decimal(str(min_trade_amount_usd))
        self.copy_scale_pct = copy_scale_pct
        self.max_position = Decimal(str(max_position_usd))
        self.delay_hours = delay_hours
        self.scan_interval = scan_interval_seconds
        self.auto_discover = auto_discover
        self.bankroll = Decimal(str(bankroll_usd))
        self.on_signal = on_signal
        self.db = db_client

        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = CongressionalTrackerStats()

        # Tracked politicians with profiles
        self._politicians: Dict[str, Politician] = {}

        # Recent trades (to avoid duplicates)
        self._seen_trades: Set[str] = set()

        # Pending copy signals
        self._pending_signals: List[CopySignal] = []

        # Cache for API responses
        self._house_cache: Optional[List[Dict]] = None
        self._senate_cache: Optional[List[Dict]] = None
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = timedelta(hours=1)

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60)
            )
        return self._session

    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()

    def _parse_amount_range(self, amount_str: str) -> tuple[Decimal, Decimal, Decimal]:
        """Parse amount range string to low, high, and estimated midpoint"""
        amount_str = amount_str.strip()

        for range_str, (low, high) in self.AMOUNT_RANGES.items():
            if amount_str.lower() == range_str.lower():
                low_d = Decimal(str(low))
                high_d = Decimal(str(high))
                mid = (low_d + high_d) / 2
                return low_d, high_d, mid

        # Try to parse numeric values
        numbers = re.findall(r'[\d,]+', amount_str)
        if len(numbers) >= 2:
            low = Decimal(numbers[0].replace(',', ''))
            high = Decimal(numbers[1].replace(',', ''))
            return low, high, (low + high) / 2
        elif len(numbers) == 1:
            val = Decimal(numbers[0].replace(',', ''))
            return val, val, val

        # Default fallback
        return Decimal("1000"), Decimal("15000"), Decimal("8000")

    async def fetch_house_trades(self) -> List[Dict]:
        """Fetch trades from House Stock Watcher"""
        # Check cache
        if (self._house_cache and self._cache_time and
            datetime.utcnow() - self._cache_time < self._cache_ttl):
            return self._house_cache

        session = await self._get_session()

        try:
            async with session.get(self.HOUSE_API) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._house_cache = data
                    self._cache_time = datetime.utcnow()
                    logger.info(f"Fetched {len(data)} House trades")
                    return data
                else:
                    logger.error(f"House API error: {resp.status}")
                    return self._house_cache or []
        except Exception as e:
            logger.error(f"Error fetching House trades: {e}")
            return self._house_cache or []

    async def fetch_senate_trades(self) -> List[Dict]:
        """Fetch trades from Senate Stock Watcher"""
        session = await self._get_session()

        try:
            async with session.get(self.SENATE_API) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._senate_cache = data
                    logger.info(f"Fetched {len(data)} Senate trades")
                    return data
                else:
                    logger.error(f"Senate API error: {resp.status}")
                    return self._senate_cache or []
        except Exception as e:
            logger.error(f"Error fetching Senate trades: {e}")
            return self._senate_cache or []

    async def fetch_capitol_trades(self, days_back: int = 7) -> List[Dict]:
        """
        Fetch trades from Capitol Trades (often 24-48h faster than official).
        
        Capitol Trades scrapes directly from House/Senate filing portals
        and often processes disclosures faster than the official APIs.
        """
        session = await self._get_session()

        try:
            # Capitol Trades may require auth or have rate limits
            # This is a best-effort integration
            params = {
                'days': days_back,
                'limit': 500,
            }
            headers = {
                'User-Agent': 'PolyBot Congressional Tracker/1.0',
            }

            async with session.get(
                self.CAPITOL_TRADES_API,
                params=params,
                headers=headers
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    trades = data.get('trades', data) if isinstance(
                        data, dict
                    ) else data
                    logger.info(
                        f"📊 Capitol Trades: Fetched {len(trades)} trades"
                    )
                    return trades
                elif resp.status == 403:
                    logger.debug(
                        "Capitol Trades API requires auth/subscription"
                    )
                    return []
                else:
                    logger.debug(f"Capitol Trades API: {resp.status}")
                    return []
        except Exception as e:
            logger.debug(f"Capitol Trades fetch error: {e}")
            return []

    async def fetch_unusual_whales(self, limit: int = 100) -> List[Dict]:
        """
        Fetch from Unusual Whales Congress API.
        
        Premium service but often has fastest alerts.
        Free tier available at https://docs.unusualwhales.com/
        """
        session = await self._get_session()

        # Check if API key is available
        api_key = None
        if self.db:
            api_key = self.db.get_secret("UNUSUAL_WHALES_API_KEY")

        if not api_key:
            logger.debug(
                "No UNUSUAL_WHALES_API_KEY - skipping Unusual Whales API"
            )
            return []

        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'User-Agent': 'PolyBot/1.0',
            }
            params = {'limit': limit}

            async with session.get(
                self.UNUSUAL_WHALES_API,
                headers=headers,
                params=params
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    trades = data.get('data', data) if isinstance(
                        data, dict
                    ) else data
                    logger.info(
                        f"🐋 Unusual Whales: Fetched {len(trades)} trades"
                    )
                    return trades
                else:
                    logger.debug(f"Unusual Whales API: {resp.status}")
                    return []
        except Exception as e:
            logger.debug(f"Unusual Whales fetch error: {e}")
            return []

    async def check_twitter_alerts(self) -> List[Dict]:
        """
        Check Twitter/X for congressional trade alerts.
        
        Monitors accounts like @unusual_whales, @capitoltrades, @quaborot
        for real-time trade disclosures (often posted within hours of filing).
        
        Requires TWITTER_BEARER_TOKEN in secrets.
        """
        # Get Twitter bearer token
        bearer_token = None
        if self.db:
            bearer_token = self.db.get_secret("TWITTER_BEARER_TOKEN")

        if not bearer_token:
            logger.debug(
                "No TWITTER_BEARER_TOKEN - Twitter alerts disabled"
            )
            return []

        session = await self._get_session()
        alerts = []

        try:
            # Twitter API v2 - search recent tweets
            # Search for congressional trade keywords
            query = (
                "(congress OR senator OR representative) "
                "(bought OR sold OR trade OR stock) "
                f"from:{' OR from:'.join(a.lstrip('@') for a in self.TWITTER_ALERT_ACCOUNTS[:5])}"
            )

            headers = {
                'Authorization': f'Bearer {bearer_token}',
            }
            params = {
                'query': query,
                'max_results': 50,
                'tweet.fields': 'created_at,author_id,text',
            }

            async with session.get(
                'https://api.twitter.com/2/tweets/search/recent',
                headers=headers,
                params=params
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    tweets = data.get('data', [])

                    for tweet in tweets:
                        # Parse tweet for trade info
                        text = tweet.get('text', '')
                        alert = self._parse_twitter_alert(text)
                        if alert:
                            alerts.append(alert)

                    if alerts:
                        logger.info(
                            f"🐦 Twitter: Found {len(alerts)} trade alerts"
                        )
                    return alerts
                elif resp.status == 429:
                    logger.debug("Twitter rate limited")
                    return []
                else:
                    logger.debug(f"Twitter API: {resp.status}")
                    return []
        except Exception as e:
            logger.debug(f"Twitter alerts error: {e}")
            return []

    def _parse_twitter_alert(self, tweet_text: str) -> Optional[Dict]:
        """
        Parse a tweet for congressional trade information.
        
        Common patterns:
        - "BREAKING: Nancy Pelosi bought $NVDA for $1M-$5M"
        - "NEW: Rep. Dan Crenshaw sold $TSLA ($50K-$100K)"
        """
        tweet_lower = tweet_text.lower()

        # Check for trade keywords
        is_purchase = any(w in tweet_lower for w in [
            'bought', 'purchase', 'buys', 'buying'
        ])
        is_sale = any(w in tweet_lower for w in [
            'sold', 'sale', 'sells', 'selling'
        ])

        if not (is_purchase or is_sale):
            return None

        # Extract ticker (look for $XXXX pattern)
        ticker_match = re.search(r'\$([A-Z]{1,5})\b', tweet_text)
        if not ticker_match:
            return None
        ticker = ticker_match.group(1)

        # Try to extract politician name
        # Common patterns: "Nancy Pelosi", "Rep. Crenshaw", "Sen. Tuberville"
        name_patterns = [
            r'(?:Rep\.?|Senator|Sen\.?)\s+(\w+\s+\w+)',
            r'(Nancy Pelosi|Dan Crenshaw|Tommy Tuberville)',
            r'(\w+\s+\w+)\s+(?:bought|sold)',
        ]
        politician = None
        for pattern in name_patterns:
            match = re.search(pattern, tweet_text, re.IGNORECASE)
            if match:
                politician = match.group(1).strip()
                break

        if not politician:
            return None

        return {
            'source': 'twitter',
            'ticker': ticker,
            'politician': politician,
            'transaction_type': 'purchase' if is_purchase else 'sale',
            'raw_text': tweet_text[:200],
            'is_unverified': True,  # Twitter alerts should be verified
        }

    def _parse_house_trade(self, raw: Dict) -> Optional[CongressionalTrade]:
        """Parse a raw House trade into our dataclass"""
        try:
            # Extract fields
            politician_name = raw.get('representative', '').strip()
            ticker = raw.get('ticker', '').strip().upper()
            asset_name = raw.get('asset_description', '')
            tx_type_str = raw.get('type', '').lower()
            amount_str = raw.get('amount', '')
            tx_date_str = raw.get('transaction_date', '')
            disc_date_str = raw.get('disclosure_date', '')
            party = raw.get('party', '')
            state = raw.get('state', '')
            district = raw.get('district', '')

            # Skip if no ticker or invalid
            if not ticker or ticker == '--' or len(ticker) > 6:
                return None

            # Parse transaction type
            if 'purchase' in tx_type_str:
                tx_type = TransactionType.PURCHASE
            elif 'sale' in tx_type_str:
                tx_type = TransactionType.SALE
            else:
                tx_type = TransactionType.EXCHANGE

            # Parse dates
            try:
                tx_date = datetime.strptime(tx_date_str, '%Y-%m-%d')
            except:
                tx_date = datetime.utcnow()

            try:
                disc_date = datetime.strptime(disc_date_str, '%Y-%m-%d')
            except:
                disc_date = datetime.utcnow()

            # Parse amount
            low, high, estimated = self._parse_amount_range(amount_str)

            # Parse party
            party_enum = Party.DEMOCRAT if party == 'D' else (
                Party.REPUBLICAN if party == 'R' else Party.INDEPENDENT
            )

            # Generate unique ID
            trade_id = f"house_{politician_name}_{ticker}_{tx_date_str}_{tx_type.value}"
            trade_id = re.sub(r'[^a-zA-Z0-9_]', '', trade_id)

            return CongressionalTrade(
                id=trade_id,
                politician_name=politician_name,
                chamber=Chamber.HOUSE,
                party=party_enum,
                state=state,
                ticker=ticker,
                asset_name=asset_name,
                transaction_type=tx_type,
                transaction_date=tx_date,
                disclosure_date=disc_date,
                amount_range_low=low,
                amount_range_high=high,
                amount_estimated=estimated,
                source="house_stock_watcher",
            )
        except Exception as e:
            logger.debug(f"Error parsing House trade: {e}")
            return None

    def _parse_senate_trade(self, raw: Dict) -> Optional[CongressionalTrade]:
        """Parse a raw Senate trade into our dataclass"""
        try:
            politician_name = raw.get('senator', raw.get('first_name', '') + ' ' + raw.get('last_name', '')).strip()
            ticker = raw.get('ticker', '').strip().upper()
            asset_name = raw.get('asset_description', raw.get('asset_type', ''))
            tx_type_str = raw.get('type', raw.get('transaction_type', '')).lower()
            amount_str = raw.get('amount', '')
            tx_date_str = raw.get('transaction_date', '')
            disc_date_str = raw.get('disclosure_date', '')
            party = raw.get('party', '')
            state = raw.get('state', '')

            if not ticker or ticker == '--' or len(ticker) > 6:
                return None

            if 'purchase' in tx_type_str:
                tx_type = TransactionType.PURCHASE
            elif 'sale' in tx_type_str:
                tx_type = TransactionType.SALE
            else:
                tx_type = TransactionType.EXCHANGE

            try:
                tx_date = datetime.strptime(tx_date_str, '%Y-%m-%d')
            except:
                tx_date = datetime.utcnow()

            try:
                disc_date = datetime.strptime(disc_date_str, '%Y-%m-%d')
            except:
                disc_date = datetime.utcnow()

            low, high, estimated = self._parse_amount_range(amount_str)

            party_enum = Party.DEMOCRAT if party == 'D' else (
                Party.REPUBLICAN if party == 'R' else Party.INDEPENDENT
            )

            trade_id = f"senate_{politician_name}_{ticker}_{tx_date_str}_{tx_type.value}"
            trade_id = re.sub(r'[^a-zA-Z0-9_]', '', trade_id)

            return CongressionalTrade(
                id=trade_id,
                politician_name=politician_name,
                chamber=Chamber.SENATE,
                party=party_enum,
                state=state,
                ticker=ticker,
                asset_name=asset_name,
                transaction_type=tx_type,
                transaction_date=tx_date,
                disclosure_date=disc_date,
                amount_range_low=low,
                amount_range_high=high,
                amount_estimated=estimated,
                source="senate_stock_watcher",
            )
        except Exception as e:
            logger.debug(f"Error parsing Senate trade: {e}")
            return None

    async def fetch_all_trades(self, days_back: int = 30) -> List[CongressionalTrade]:
        """
        Fetch all trades from all configured sources.
        
        Sources (in order of priority):
        1. House/Senate Stock Watcher APIs (official, most comprehensive)
        2. Capitol Trades (often 24-48h faster)
        3. Unusual Whales API (if API key available)
        4. Twitter alerts (real-time, needs verification)
        """
        trades = []
        cutoff = datetime.utcnow() - timedelta(days=days_back)

        # Primary sources - official APIs
        if self.chambers in [Chamber.HOUSE, Chamber.BOTH]:
            house_raw = await self.fetch_house_trades()
            for raw in house_raw:
                trade = self._parse_house_trade(raw)
                if trade and trade.disclosure_date >= cutoff:
                    trades.append(trade)

        if self.chambers in [Chamber.SENATE, Chamber.BOTH]:
            senate_raw = await self.fetch_senate_trades()
            for raw in senate_raw:
                trade = self._parse_senate_trade(raw)
                if trade and trade.disclosure_date >= cutoff:
                    trades.append(trade)

        # Alternative sources - often faster
        try:
            # Capitol Trades (often faster)
            capitol_raw = await self.fetch_capitol_trades(days_back=7)
            for raw in capitol_raw:
                # Capitol Trades uses similar format to House API
                trade = self._parse_house_trade(raw)
                if trade and trade.id not in self._seen_trades:
                    trade.source = "capitol_trades"
                    trades.append(trade)
        except Exception as e:
            logger.debug(f"Capitol Trades fetch skipped: {e}")

        try:
            # Unusual Whales (premium, fastest)
            uw_raw = await self.fetch_unusual_whales(limit=50)
            for raw in uw_raw:
                # Parse Unusual Whales format
                trade = self._parse_unusual_whales_trade(raw)
                if trade and trade.id not in self._seen_trades:
                    trades.append(trade)
        except Exception as e:
            logger.debug(f"Unusual Whales fetch skipped: {e}")

        # Twitter alerts (real-time but unverified)
        try:
            twitter_alerts = await self.check_twitter_alerts()
            for alert in twitter_alerts:
                if alert.get('ticker') and alert.get('politician'):
                    # Log for manual review, don't auto-trade unverified
                    logger.info(
                        f"🐦 UNVERIFIED: {alert['politician']} "
                        f"{alert['transaction_type']} ${alert['ticker']}"
                    )
        except Exception as e:
            logger.debug(f"Twitter alerts skipped: {e}")

        # Sort by disclosure date (newest first)
        trades.sort(key=lambda t: t.disclosure_date, reverse=True)

        logger.info(
            f"📊 Congress: {len(trades)} trades from last {days_back} days"
        )
        return trades

    def _parse_unusual_whales_trade(
        self, raw: Dict
    ) -> Optional[CongressionalTrade]:
        """Parse trade from Unusual Whales API format."""
        try:
            politician_name = raw.get('politician', raw.get('name', ''))
            ticker = raw.get('ticker', raw.get('symbol', '')).upper()
            tx_type_str = raw.get('transaction_type', raw.get('type', ''))
            tx_date_str = raw.get('trade_date', raw.get('transaction_date'))
            disc_date_str = raw.get('filed_date', raw.get('disclosure_date'))

            if not ticker or not politician_name:
                return None

            # Parse transaction type
            tx_type = TransactionType.PURCHASE
            if 'sale' in tx_type_str.lower():
                tx_type = TransactionType.SALE

            # Parse dates
            tx_date = datetime.utcnow()
            disc_date = datetime.utcnow()
            if tx_date_str:
                try:
                    tx_date = datetime.fromisoformat(
                        tx_date_str.replace('Z', '+00:00')
                    )
                except Exception:
                    pass
            if disc_date_str:
                try:
                    disc_date = datetime.fromisoformat(
                        disc_date_str.replace('Z', '+00:00')
                    )
                except Exception:
                    pass

            # Parse amount
            amount_str = raw.get('amount', '$1,001 - $15,000')
            low, high, estimated = self._parse_amount_range(amount_str)

            # Generate ID
            trade_id = f"uw_{politician_name}_{ticker}_{tx_date.date()}"
            trade_id = re.sub(r'[^a-zA-Z0-9_]', '', trade_id)

            return CongressionalTrade(
                id=trade_id,
                politician_name=politician_name,
                chamber=Chamber.BOTH,  # UW doesn't always specify
                party=Party.ANY,
                state="",
                ticker=ticker,
                asset_name=raw.get('asset_name', ticker),
                transaction_type=tx_type,
                transaction_date=tx_date,
                disclosure_date=disc_date,
                amount_range_low=low,
                amount_range_high=high,
                amount_estimated=estimated,
                source="unusual_whales",
            )
        except Exception as e:
            logger.debug(f"Error parsing UW trade: {e}")
            return None

    def should_copy_trade(self, trade: CongressionalTrade) -> tuple[bool, float, List[str]]:
        """
        Determine if we should copy this trade.
        Returns (should_copy, confidence_score, reasons)
        """
        reasons = []
        confidence = 0.5  # Base confidence

        # Check if politician is tracked
        is_tracked = trade.politician_name in self.tracked_politicians
        if not is_tracked and not self.auto_discover:
            return False, 0.0, ["Politician not in tracked list"]

        if is_tracked:
            confidence += 0.2
            reasons.append(f"Tracked politician: {trade.politician_name}")

        # Check party filter
        if self.parties != Party.ANY and trade.party != self.parties:
            return False, 0.0, [f"Party filter: {trade.party.value} not in {self.parties.value}"]

        # Check minimum amount
        if trade.amount_estimated < self.min_trade_amount:
            return False, 0.0, [f"Trade amount ${trade.amount_estimated} below minimum ${self.min_trade_amount}"]

        # Boost confidence for larger trades (indicates conviction)
        if trade.amount_estimated >= Decimal("100000"):
            confidence += 0.15
            reasons.append(f"Large trade: ${trade.amount_estimated:,.0f}")
        elif trade.amount_estimated >= Decimal("50000"):
            confidence += 0.1
            reasons.append(f"Significant trade: ${trade.amount_estimated:,.0f}")

        # Check politician's historical performance
        if trade.politician_name in self._politicians:
            pol = self._politicians[trade.politician_name]
            if pol.win_rate() >= 60:
                confidence += 0.15
                reasons.append(f"{trade.politician_name} win rate: {pol.win_rate():.1f}%")

        # Only copy purchases (more reliable signal)
        if trade.transaction_type == TransactionType.PURCHASE:
            confidence += 0.1
            reasons.append("Purchase (bullish signal)")
        elif trade.transaction_type == TransactionType.SALE:
            confidence -= 0.1
            reasons.append("Sale (bearish signal)")

        # Recent disclosure is better
        days_since_disclosure = (datetime.utcnow() - trade.disclosure_date).days
        if days_since_disclosure <= 3:
            confidence += 0.1
            reasons.append(f"Fresh disclosure ({days_since_disclosure} days ago)")
        elif days_since_disclosure > 30:
            confidence -= 0.2
            reasons.append(f"Stale disclosure ({days_since_disclosure} days old)")

        # Minimum confidence threshold
        min_confidence = 0.5
        if confidence < min_confidence:
            return False, confidence, reasons + [f"Confidence {confidence:.2f} below threshold {min_confidence}"]

        return True, min(confidence, 1.0), reasons

    def calculate_position_size(self, trade: CongressionalTrade, confidence: float) -> Decimal:
        """Calculate position size based on trade, confidence, and bankroll"""
        # Base: scale their trade by copy_scale_pct
        base_size = trade.amount_estimated * Decimal(str(self.copy_scale_pct / 100))

        # Scale by confidence
        confidence_adjusted = base_size * Decimal(str(confidence))

        # Scale by bankroll ratio (don't risk more than 5% of bankroll per trade)
        max_bankroll_risk = self.bankroll * Decimal("0.05")

        # Apply maximum position size
        position_size = min(confidence_adjusted, self.max_position, max_bankroll_risk)

        # Minimum position size
        min_position = Decimal("10")
        position_size = max(position_size, min_position)

        return position_size.quantize(Decimal("0.01"))

    async def generate_signals(self, days_back: int = 7) -> List[CopySignal]:
        """Generate copy signals from recent congressional trades"""
        trades = await self.fetch_all_trades(days_back=days_back)
        signals = []

        for trade in trades:
            # Skip if already seen
            if trade.id in self._seen_trades:
                continue

            # Check if we should copy
            should_copy, confidence, reasons = self.should_copy_trade(trade)

            if not should_copy:
                logger.debug(f"Skipping trade {trade.id}: {reasons}")
                continue

            # Mark as seen
            self._seen_trades.add(trade.id)

            # Calculate position size
            position_size = self.calculate_position_size(trade, confidence)

            # Determine direction
            direction = "buy" if trade.transaction_type == TransactionType.PURCHASE else "sell"

            # Get or create politician profile
            if trade.politician_name not in self._politicians:
                self._politicians[trade.politician_name] = Politician(
                    name=trade.politician_name,
                    chamber=trade.chamber,
                    party=trade.party,
                    state=trade.state,
                    first_tracked_at=datetime.utcnow(),
                )

            pol = self._politicians[trade.politician_name]
            pol.last_trade_at = trade.disclosure_date

            # Create signal
            signal = CopySignal(
                signal_id=f"cong_{trade.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                politician=pol,
                original_trade=trade,
                ticker=trade.ticker,
                direction=direction,
                position_size_usd=position_size,
                confidence_score=confidence,
                reasoning=reasons,
                created_at=datetime.utcnow(),
                execute_after=datetime.utcnow() + timedelta(hours=self.delay_hours),
                expires_at=datetime.utcnow() + timedelta(days=7),
            )

            signals.append(signal)
            logger.info(
                f"Generated congressional copy signal: {direction.upper()} ${position_size} {trade.ticker} "
                f"(following {trade.politician_name}, confidence: {confidence:.2f})"
            )

            # Update stats
            self.stats.trades_detected += 1

        return signals

    async def run_scan(self) -> List[CopySignal]:
        """Run a single scan cycle"""
        logger.info("Running congressional trade scan...")

        signals = await self.generate_signals()

        for signal in signals:
            self._pending_signals.append(signal)

            # Emit signal if callback registered
            if self.on_signal:
                await self.on_signal(signal)

        # Update politician count
        self.stats.politicians_tracked = len(self._politicians)

        logger.info(f"Scan complete: {len(signals)} new signals generated")
        return signals

    async def start(self):
        """Start the tracking loop"""
        self._running = True
        logger.info("Starting Congressional Tracker Strategy")

        # Load persisted data from DB if available
        await self._load_from_db()

        while self._running:
            try:
                await self.run_scan()
            except Exception as e:
                logger.error(f"Error in scan cycle: {e}")

            await asyncio.sleep(self.scan_interval)

    async def stop(self):
        """Stop the tracking loop"""
        self._running = False
        await self.close()
        logger.info("Congressional Tracker Strategy stopped")

    async def _load_from_db(self):
        """Load tracked politicians from database"""
        if not self.db:
            return

        try:
            # Load politicians
            result = self.db.table('polybot_tracked_politicians').select('*').execute()
            if result.data:
                for row in result.data:
                    pol = Politician(
                        name=row['name'],
                        chamber=Chamber(row.get('chamber', 'both')),
                        party=Party(row.get('party', 'any')),
                        state=row.get('state', ''),
                        total_trades=row.get('total_trades', 0),
                        winning_trades=row.get('winning_trades', 0),
                        total_pnl_usd=Decimal(str(row.get('total_pnl_usd', 0))),
                        avg_return_pct=row.get('avg_return_pct', 0.0),
                        copy_enabled=row.get('copy_enabled', False),
                        copy_scale_pct=row.get('copy_scale_pct', 100.0),
                        max_copy_size_usd=Decimal(str(row.get('max_copy_size_usd', 1000))),
                    )
                    self._politicians[pol.name] = pol
                    if pol.copy_enabled:
                        self.tracked_politicians.add(pol.name)

                logger.info(f"Loaded {len(self._politicians)} politicians from DB")

            # Load seen trades
            result = self.db.table('polybot_congressional_trades').select('id').execute()
            if result.data:
                self._seen_trades = {row['id'] for row in result.data}
                logger.info(f"Loaded {len(self._seen_trades)} seen trade IDs")

        except Exception as e:
            logger.warning(f"Could not load from DB: {e}")

    async def save_signal_to_db(self, signal: CopySignal):
        """Save a copy signal to the database"""
        if not self.db:
            return

        try:
            # Save the original trade
            trade = signal.original_trade
            self.db.table('polybot_congressional_trades').upsert({
                'id': trade.id,
                'politician_name': trade.politician_name,
                'chamber': trade.chamber.value,
                'party': trade.party.value,
                'state': trade.state,
                'ticker': trade.ticker,
                'asset_name': trade.asset_name,
                'transaction_type': trade.transaction_type.value,
                'transaction_date': trade.transaction_date.isoformat(),
                'disclosure_date': trade.disclosure_date.isoformat(),
                'amount_range_low': float(trade.amount_range_low),
                'amount_range_high': float(trade.amount_range_high),
                'amount_estimated': float(trade.amount_estimated),
                'source': trade.source,
                'copied': True,
                'copy_trade_id': signal.signal_id,
            }).execute()

            # Save the copy signal
            self.db.table('polybot_congressional_copy_trades').insert({
                'id': signal.signal_id,
                'politician_name': signal.politician.name,
                'original_trade_id': trade.id,
                'ticker': signal.ticker,
                'direction': signal.direction,
                'position_size_usd': float(signal.position_size_usd),
                'confidence_score': signal.confidence_score,
                'reasoning': json.dumps(signal.reasoning),
                'created_at': signal.created_at.isoformat(),
                'execute_after': signal.execute_after.isoformat() if signal.execute_after else None,
                'status': 'pending',
            }).execute()

            logger.info(f"Saved signal {signal.signal_id} to database")

        except Exception as e:
            logger.error(f"Error saving signal to DB: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get current strategy statistics"""
        return {
            'strategy': 'congressional_tracker',
            'politicians_tracked': self.stats.politicians_tracked,
            'trades_detected': self.stats.trades_detected,
            'trades_copied': self.stats.trades_copied,
            'copy_win_rate': self.stats.win_rate(),
            'total_pnl': float(self.stats.total_copy_pnl),
            'top_politicians': [
                {
                    'name': p.name,
                    'win_rate': p.win_rate(),
                    'total_pnl': float(p.total_pnl_usd),
                    'trades': p.total_trades,
                }
                for p in sorted(
                    self._politicians.values(),
                    key=lambda x: x.total_pnl_usd,
                    reverse=True
                )[:5]
            ],
            'pending_signals': len(self._pending_signals),
        }


# Convenience function for quick testing
async def main():
    """Test the Congressional Tracker"""
    tracker = CongressionalTrackerStrategy(
        tracked_politicians=["Nancy Pelosi", "Tommy Tuberville"],
        chambers=Chamber.BOTH,
        copy_scale_pct=10.0,
        max_position_usd=500.0,
        bankroll_usd=10000.0,
    )

    try:
        signals = await tracker.run_scan()
        print(f"\nGenerated {len(signals)} signals:")
        for sig in signals[:5]:  # Show first 5
            print(f"  {sig.direction.upper()} ${sig.position_size_usd} {sig.ticker}")
            print(f"    Politician: {sig.politician.name}")
            print(f"    Confidence: {sig.confidence_score:.2f}")
            print(f"    Reasons: {', '.join(sig.reasoning)}")
    finally:
        await tracker.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
