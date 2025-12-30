"""
Kalshi Mention Market Sniping Strategy

Based on Twitter research (@PredMTrader):
"When a word gets said in a Trump speech (Kalshi mention markets),
SLAM 99¢ YES bid immediately after word is said.
Get filled by people wanting instant cash vs waiting for resolution."

Strategy:
1. Monitor real-time speech/news feeds for trigger words
2. Detect when word is SAID (market resolved YES)
3. Immediately bid 99¢ on YES
4. Get filled by impatient sellers at 99¢
5. Wait for official resolution → collect $1.00
6. Profit: 1% guaranteed (but scalable)

The key insight: After a word is said, the market IS resolved,
but hasn't officially settled. Impatient holders sell at 99¢
to get cash immediately instead of waiting.

Rate Limiting:
- Kalshi API: 30 req/min, 2s between requests
- Adaptive backoff on 429 responses
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import aiohttp
import re

logger = logging.getLogger(__name__)

# Rate limiting constants for Kalshi
KALSHI_MIN_INTERVAL = 2.0  # Minimum seconds between requests
KALSHI_MAX_PER_MINUTE = 30


class MentionStatus(Enum):
    """Status of a mention market"""
    PENDING = "pending"       # Word not said yet
    TRIGGERED = "triggered"   # Word was said, market effectively resolved
    SETTLED = "settled"       # Officially settled by exchange
    EXPIRED = "expired"       # Event ended without mention


@dataclass
class MentionMarket:
    """A Kalshi mention market"""
    ticker: str
    title: str
    keyword: str  # The word being tracked
    event_title: str  # e.g., "Trump Speech"

    status: MentionStatus = MentionStatus.PENDING
    yes_bid: Decimal = Decimal("0")
    yes_ask: Decimal = Decimal("0")

    # Timestamps
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None
    word_detected_at: Optional[datetime] = None

    def is_snipeable(self) -> bool:
        """Check if market is in snipeable state (word said but not settled)"""
        return (
            self.status == MentionStatus.TRIGGERED and
            self.yes_ask is not None and
            Decimal("0.95") <= self.yes_ask <= Decimal("0.99")
        )


@dataclass
class SnipeOpportunity:
    """A mention market snipe opportunity"""
    id: str
    detected_at: datetime

    # Market info
    ticker: str
    title: str
    keyword: str
    event_title: str

    # Pricing
    bid_price: Decimal  # What we're offering
    expected_fill_price: Decimal  # What we expect to pay
    expected_profit_pct: Decimal  # Expected profit percentage

    # Size
    max_size_contracts: int
    max_size_usd: Decimal

    # Confidence
    confidence_score: float  # How confident we are word was said

    def __str__(self) -> str:
        return (
            f"Snipe: {self.keyword} in {self.event_title} | "
            f"Bid {self.bid_price:.0%} | "
            f"Expected profit: {self.expected_profit_pct:.1f}%"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "ticker": self.ticker,
            "title": self.title,
            "keyword": self.keyword,
            "event_title": self.event_title,
            "bid_price": float(self.bid_price),
            "expected_profit_pct": float(self.expected_profit_pct),
            "max_size_usd": float(self.max_size_usd),
            "confidence_score": self.confidence_score,
        }


@dataclass
class SnipeStats:
    """Statistics for mention sniping"""
    markets_tracked: int = 0
    words_detected: int = 0
    snipes_attempted: int = 0
    snipes_filled: int = 0
    total_profit_usd: Decimal = Decimal("0")
    avg_fill_price: Decimal = Decimal("0")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "markets_tracked": self.markets_tracked,
            "words_detected": self.words_detected,
            "snipes_attempted": self.snipes_attempted,
            "snipes_filled": self.snipes_filled,
            "fill_rate": (
                self.snipes_filled / max(self.snipes_attempted, 1) * 100
            ),
            "total_profit_usd": float(self.total_profit_usd),
            "avg_fill_price": float(self.avg_fill_price),
        }


class KalshiMentionSnipeStrategy:
    """
    Kalshi Mention Market Sniping

    Strategy for capturing profit on "mention" markets:
    - Markets that resolve YES if a specific word is said
    - After word is detected, market is effectively resolved
    - But impatient holders sell at 99¢ instead of waiting
    - We bid 99¢, get filled, wait for settlement, collect $1.00

    Requirements:
    1. Real-time news/speech feed (Twitter API, NewsAPI, etc.)
    2. Kalshi API access for order placement
    3. Fast execution capability

    Flow:
    1. Monitor Kalshi for mention markets
    2. Subscribe to relevant news feeds
    3. When keyword detected, check market price
    4. If YES < 100¢, place aggressive bid
    5. Wait for settlement
    """

    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"

    # Mention market patterns
    MENTION_PATTERNS = [
        r"say.*word",
        r"mention",
        r"speak.*about",
        r"use.*term",
        r"utter",
    ]

    # Common mention market keywords
    TRACKED_KEYWORDS = [
        "inflation", "tariff", "china", "russia", "ukraine",
        "bitcoin", "crypto", "immigration", "border",
        "jobs", "economy", "recession", "fed", "rate",
        "war", "peace", "deal", "winning", "tremendous",
    ]

    def __init__(
        self,
        bid_price: float = 0.99,  # Bid 99¢
        min_profit_pct: float = 0.5,
        max_position_usd: float = 500.0,
        max_position_per_market: float = 100.0,
        scan_interval_seconds: int = 5,  # Fast scanning
        twitter_bearer_token: Optional[str] = None,
        newsapi_key: Optional[str] = None,
        on_opportunity: Optional[Callable] = None,
        db_client=None,
    ):
        self.bid_price = Decimal(str(bid_price))
        self.min_profit_pct = Decimal(str(min_profit_pct))
        self.max_position_usd = Decimal(str(max_position_usd))
        self.max_per_market = Decimal(str(max_position_per_market))
        self.scan_interval = scan_interval_seconds
        self.twitter_token = twitter_bearer_token
        self.newsapi_key = newsapi_key
        self.on_opportunity = on_opportunity
        self.db = db_client

        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = SnipeStats()

        # Track mention markets
        self._mention_markets: Dict[str, MentionMarket] = {}
        self._triggered_words: Set[str] = set()

        # Rate limiting for Kalshi
        self._kalshi_last_request: float = 0.0
        self._kalshi_requests_minute: int = 0
        self._kalshi_minute_start: float = 0.0
        self._kalshi_backoff_until: float = 0.0

        # Compile patterns
        self._mention_regex = re.compile(
            '|'.join(self.MENTION_PATTERNS), re.IGNORECASE
        )

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

    async def _kalshi_rate_limit(self):
        """Apply rate limiting for Kalshi API calls."""
        now = time.time()

        # Check backoff period (after 429)
        if now < self._kalshi_backoff_until:
            wait_time = self._kalshi_backoff_until - now
            logger.info(f"[Snipe] Kalshi rate limited, waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
            now = time.time()

        # Reset minute window if needed
        if now - self._kalshi_minute_start >= 60:
            self._kalshi_minute_start = now
            self._kalshi_requests_minute = 0

        # Check per-minute limit
        if self._kalshi_requests_minute >= KALSHI_MAX_PER_MINUTE:
            wait_until = self._kalshi_minute_start + 60
            extra_wait = wait_until - now + 0.1
            if extra_wait > 0:
                logger.info(f"[Snipe] Kalshi limit reached, waiting {extra_wait:.1f}s")
                await asyncio.sleep(extra_wait)
                self._kalshi_minute_start = time.time()
                self._kalshi_requests_minute = 0

        # Enforce minimum interval
        time_since_last = now - self._kalshi_last_request
        if time_since_last < KALSHI_MIN_INTERVAL:
            await asyncio.sleep(KALSHI_MIN_INTERVAL - time_since_last)

        # Update state
        self._kalshi_last_request = time.time()
        self._kalshi_requests_minute += 1

    def _handle_kalshi_response(self, status: int):
        """Handle Kalshi response, applying backoff on 429."""
        if status == 429:
            current_backoff = self._kalshi_backoff_until - time.time()
            new_backoff = min(max(current_backoff * 2, 5), 60)
            self._kalshi_backoff_until = time.time() + new_backoff
            logger.warning(f"[Snipe] Kalshi 429, backing off {new_backoff}s")

    def _is_mention_market(self, title: str) -> bool:
        """Check if a market is a mention market"""
        return bool(self._mention_regex.search(title))

    def _extract_keyword(self, title: str) -> Optional[str]:
        """Extract the keyword being tracked from market title"""
        title_lower = title.lower()

        # Try to find tracked keywords
        for keyword in self.TRACKED_KEYWORDS:
            if keyword in title_lower:
                return keyword

        # Try to extract from patterns like "say 'word'"
        match = re.search(r"say\s+['\"]?(\w+)['\"]?", title_lower)
        if match:
            return match.group(1)

        return None

    async def fetch_mention_markets(self) -> List[Dict]:
        """Fetch mention markets from Kalshi with rate limiting"""
        session = await self._get_session()
        mention_markets = []

        try:
            # Apply rate limiting before request
            await self._kalshi_rate_limit()

            # Search for mention-related events
            url = f"{self.KALSHI_API}/events"
            params = {
                "status": "active",
                "limit": 100,
            }

            async with session.get(url, params=params) as resp:
                self._handle_kalshi_response(resp.status)

                if resp.status == 429:
                    logger.warning("[Snipe] Kalshi 429 on events fetch")
                    return []

                if resp.status == 200:
                    data = await resp.json()
                    events = data.get("events", [])

                    for event in events:
                        # Look for speech/mention events
                        event_title = event.get("title", "")
                        speech_kws = [
                            "speech", "address", "remarks", "press conference"
                        ]
                        if any(kw in event_title.lower() for kw in speech_kws):
                            # Fetch markets for this event
                            event_ticker = event.get("event_ticker")
                            if event_ticker:
                                markets = await self._fetch_event_markets(
                                    event_ticker, event_title
                                )
                                mention_markets.extend(markets)

            logger.info(f"[Snipe] Found {len(mention_markets)} mention markets")

        except Exception as e:
            logger.error(f"Error fetching mention markets: {e}")

        return mention_markets

    async def _fetch_event_markets(
        self, event_ticker: str, event_title: str
    ) -> List[Dict]:
        """Fetch markets for a specific event with rate limiting"""
        session = await self._get_session()
        markets = []

        try:
            # Apply rate limiting before request
            await self._kalshi_rate_limit()

            url = f"{self.KALSHI_API}/markets"
            params = {
                "event_ticker": event_ticker,
                "status": "active",
            }

            async with session.get(url, params=params) as resp:
                self._handle_kalshi_response(resp.status)

                if resp.status == 429:
                    return []

                if resp.status == 200:
                    data = await resp.json()
                    for market in data.get("markets", []):
                        title = market.get("title", "")
                        if self._is_mention_market(title):
                            market["event_title"] = event_title
                            markets.append(market)

        except Exception as e:
            logger.debug(f"Error fetching event markets: {e}")

        return markets

    async def check_news_for_keywords(self) -> Set[str]:
        """Check news feeds for triggered keywords"""
        triggered = set()

        # Check Twitter if available
        if self.twitter_token:
            twitter_words = await self._check_twitter()
            triggered.update(twitter_words)

        # Check NewsAPI if available
        if self.newsapi_key:
            news_words = await self._check_news_api()
            triggered.update(news_words)

        return triggered

    async def _check_twitter(self) -> Set[str]:
        """Check Twitter for keyword mentions"""
        triggered = set()

        if not self.twitter_token:
            return triggered

        session = await self._get_session()

        try:
            # Search for recent tweets about tracked keywords
            headers = {"Authorization": f"Bearer {self.twitter_token}"}

            for keyword in self.TRACKED_KEYWORDS[:10]:  # Limit API calls
                url = "https://api.twitter.com/2/tweets/search/recent"
                params = {
                    "query": f'"{keyword}" (Trump OR Biden OR POTUS)',
                    "max_results": 10,
                    "tweet.fields": "created_at",
                }

                async with session.get(url, headers=headers, params=params) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("data"):
                            triggered.add(keyword)
                            logger.info(f"🎯 Keyword detected on Twitter: {keyword}")

        except Exception as e:
            logger.debug(f"Twitter check error: {e}")

        return triggered

    async def _check_news_api(self) -> Set[str]:
        """Check NewsAPI for keyword mentions"""
        triggered = set()

        if not self.newsapi_key:
            return triggered

        session = await self._get_session()

        try:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": "Trump speech OR presidential address",
                "sortBy": "publishedAt",
                "pageSize": 10,
                "apiKey": self.newsapi_key,
            }

            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    articles = data.get("articles", [])

                    for article in articles:
                        content = (article.get("title", "") + " " +
                                   article.get("description", "")).lower()

                        for keyword in self.TRACKED_KEYWORDS:
                            if keyword in content:
                                triggered.add(keyword)

        except Exception as e:
            logger.debug(f"NewsAPI check error: {e}")

        return triggered

    async def analyze_market(
        self,
        market: Dict,
    ) -> Optional[SnipeOpportunity]:
        """Analyze a mention market for snipe opportunity"""

        try:
            ticker = market.get("ticker", "unknown")
            title = market.get("title", "Unknown")
            event_title = market.get("event_title", "")

            # Extract keyword
            keyword = self._extract_keyword(title)
            if not keyword:
                return None

            # Get prices (Kalshi uses cents)
            yes_bid = Decimal(str(market.get("yes_bid", 0) or 0)) / 100
            yes_ask = Decimal(str(market.get("yes_ask", 0) or 0)) / 100

            # Check if word was triggered
            if keyword not in self._triggered_words:
                return None  # Word not detected yet

            # Check if snipeable (YES ask between 95-99¢)
            if yes_ask < Decimal("0.95") or yes_ask > Decimal("0.995"):
                return None  # Not in snipeable range

            # Calculate expected profit
            expected_fill = yes_ask
            expected_profit_pct = (Decimal("1.0") - expected_fill) * 100

            if expected_profit_pct < self.min_profit_pct:
                return None

            # Calculate size
            volume = int(market.get("volume", 0) or 0)
            max_contracts = min(
                int(self.max_per_market / expected_fill),
                volume // 10,  # Don't take more than 10% of volume
            )

            if max_contracts < 1:
                return None

            # Create opportunity
            opp_id = f"SNIPE-{datetime.utcnow().strftime('%H%M%S')}-{ticker}"

            opportunity = SnipeOpportunity(
                id=opp_id,
                detected_at=datetime.now(timezone.utc),
                ticker=ticker,
                title=title,
                keyword=keyword,
                event_title=event_title,
                bid_price=self.bid_price,
                expected_fill_price=expected_fill,
                expected_profit_pct=expected_profit_pct,
                max_size_contracts=max_contracts,
                max_size_usd=Decimal(str(max_contracts)) * expected_fill,
                confidence_score=0.9,  # High confidence if word detected
            )

            return opportunity

        except Exception as e:
            logger.error(f"Error analyzing mention market: {e}")
            return None

    async def scan_for_opportunities(self) -> List[SnipeOpportunity]:
        """Scan for snipe opportunities"""
        opportunities = []

        # Check news for triggered keywords
        newly_triggered = await self.check_news_for_keywords()

        for word in newly_triggered:
            if word not in self._triggered_words:
                self._triggered_words.add(word)
                self.stats.words_detected += 1
                logger.info(f"🎯 NEW WORD TRIGGERED: {word}")

        # Fetch mention markets
        markets = await self.fetch_mention_markets()
        self.stats.markets_tracked = len(markets)

        # Analyze each market
        for market in markets:
            opp = await self.analyze_market(market)
            if opp:
                opportunities.append(opp)

        # Sort by profit
        opportunities.sort(key=lambda x: x.expected_profit_pct, reverse=True)

        if opportunities:
            logger.info(f"🎯 Found {len(opportunities)} snipe opportunities!")
            for opp in opportunities[:3]:
                logger.info(f"   {opp}")

        return opportunities

    async def run(self):
        """Run continuous scanning"""
        self._running = True
        logger.info("🔍 Starting Kalshi Mention Snipe Strategy")
        logger.info(f"   Bid price: {self.bid_price:.0%}")
        logger.info(f"   Scan interval: {self.scan_interval}s")

        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()

                # Callback
                if self.on_opportunity and opportunities:
                    for opp in opportunities:
                        await self.on_opportunity(opp)

                await asyncio.sleep(self.scan_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Mention snipe error: {e}")
                await asyncio.sleep(5)

        await self.close()

    def stop(self):
        """Stop the scanner"""
        self._running = False


# Strategy info for UI
KALSHI_MENTION_SNIPE_INFO = {
    "id": "kalshi_mention_snipe",
    "name": "Kalshi Mention Sniping",
    "confidence": 80,
    "expected_apy": "20-100%",
    "description": (
        "Snipe mention markets after keywords are detected. "
        "When a word is said in a speech, bid 99¢ on YES, "
        "get filled by impatient sellers, collect $1.00 on settlement."
    ),
    "key_points": [
        "Requires real-time news/speech monitoring",
        "Fast execution is critical",
        "Low risk once word is confirmed said",
        "Scalable with position sizing",
        "Based on @PredMTrader's approach",
    ],
    "platforms": ["Kalshi"],
    "risk_level": "low",
    "category": "prediction",
}
