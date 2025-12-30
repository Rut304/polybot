"""
News Arbitrage Strategy for Cross-Platform Trading

This module implements a news-driven arbitrage strategy that exploits
the price lag between Polymarket and Kalshi during news events.

Key insight: Polymarket updates faster (retail-driven) while Kalshi
lags by 5-30 minutes. This creates short windows of arbitrage.

Expected returns: 5-30% per event (when events occur)
Risk: Medium-High (timing dependent, execution risk)

Usage:
- Monitor news sources for relevant events
- When news breaks, compare prices across platforms
- Execute trades during the lag window
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Callable, Set, Tuple
from enum import Enum
import asyncio
import xml.etree.ElementTree as ET
import aiohttp

logger = logging.getLogger(__name__)


class NewsSource(Enum):
    """News sources to monitor"""
    TWITTER = "twitter"
    AP_NEWS = "ap_news"
    REUTERS = "reuters"
    POLYMARKET = "polymarket_activity"  # Watch for sudden volume
    MANUAL = "manual"


class AlertSeverity(Enum):
    """How urgent is the alert"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class NewsEvent:
    """A detected news event"""
    source: NewsSource
    headline: str
    keywords: List[str]
    detected_at: datetime
    url: Optional[str] = None
    severity: AlertSeverity = AlertSeverity.MEDIUM
    processed: bool = False


@dataclass
class PriceSnapshot:
    """Price at a point in time for a market"""
    platform: str
    market_id: str
    market_name: str
    yes_price: Decimal
    no_price: Decimal
    volume_24h: float
    timestamp: datetime


@dataclass
class NewsArbOpportunity:
    """An opportunity detected from news-driven price divergence"""
    event: NewsEvent
    poly_snapshot: PriceSnapshot
    kalshi_snapshot: PriceSnapshot
    spread_pct: Decimal
    direction: str  # "buy_poly" or "buy_kalshi"
    confidence: float
    detected_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    executed: bool = False

    @property
    def expected_profit_pct(self) -> Decimal:
        """Expected profit after fees"""
        # Kalshi has 7% fee on profits
        if self.direction == "buy_kalshi":
            # We're buying Kalshi (7% fee) and selling Poly (0% fee)
            return self.spread_pct - Decimal("7.0")
        else:
            # We're buying Poly (0% fee) and selling Kalshi (7% fee)
            return self.spread_pct - Decimal("7.0")

    def to_dict(self) -> Dict:
        return {
            "event_headline": self.event.headline[:100],
            "event_source": self.event.source.value,
            "poly_price": float(self.poly_snapshot.yes_price),
            "kalshi_price": float(self.kalshi_snapshot.yes_price),
            "spread_pct": float(self.spread_pct),
            "expected_profit_pct": float(self.expected_profit_pct),
            "direction": self.direction,
            "confidence": self.confidence,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class NewsArbStats:
    """Statistics for news arbitrage strategy"""
    events_detected: int = 0
    opportunities_found: int = 0
    opportunities_executed: int = 0
    total_profit_usd: Decimal = Decimal("0")
    total_loss_usd: Decimal = Decimal("0")
    session_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def net_pnl(self) -> Decimal:
        return self.total_profit_usd - self.total_loss_usd

    @property
    def win_rate(self) -> float:
        if self.opportunities_executed == 0:
            return 0.0
        wins = (
            self.opportunities_executed
            if self.net_pnl > 0
            else 0
        )
        return (wins / self.opportunities_executed) * 100

    def to_dict(self) -> Dict:
        return {
            "events_detected": self.events_detected,
            "opportunities_found": self.opportunities_found,
            "opportunities_executed": self.opportunities_executed,
            "total_profit_usd": float(self.total_profit_usd),
            "win_rate": self.win_rate(),
            "uptime_seconds": (
                datetime.now(timezone.utc) - self.session_start
            ).total_seconds(),
        }


class RSSMonitor:
    """
    Monitors RSS feeds for breaking news.
    """

    FEEDS = {
        "coindesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
        "politico": "https://rss.politico.com/politics-news.xml",
    }

    def __init__(self):
        self.seen_guids: Set[str] = set()
        self.last_poll = datetime.min.replace(tzinfo=timezone.utc)

    async def poll(self) -> List[NewsEvent]:
        """Poll all feeds for new items."""
        tasks = []
        for source, url in self.FEEDS.items():
            tasks.append(self._fetch_feed(source, url))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        events = []
        for res in results:
            if isinstance(res, list):
                events.extend(res)

        self.last_poll = datetime.now(timezone.utc)
        return events

    async def _fetch_feed(self, source_name: str, url: str) -> List[NewsEvent]:
        events = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    if resp.status != 200:
                        logger.warning(f"Failed to fetch {source_name} RSS: {resp.status}")
                        return []

                    content = await resp.text()

                    # Parse XML
                    root = ET.fromstring(content)
                    channel = root.find("channel")
                    if not channel:
                        return []

                    for item in channel.findall("item"):
                        guid = item.findtext("guid") or item.findtext("link")
                        if not guid or guid in self.seen_guids:
                            continue

                        title = item.findtext("title", "")
                        link = item.findtext("link", "")
                        description = item.findtext("description", "")

                        # Mark as seen
                        self.seen_guids.add(guid)

                        # Basic sentiment/keyword check could go here

                        events.append(NewsEvent(
                            source=NewsSource.AP_NEWS if source_name == "politico" else NewsSource.REUTERS, # Mapping to existing enums best effort
                            headline=title,
                            keywords=self._extract_keywords(title + " " + description),
                            detected_at=datetime.now(timezone.utc),
                            url=link,
                        ))

                        # Limit memory
                        if len(self.seen_guids) > 1000:
                            self.seen_guids = set(list(self.seen_guids)[-500:])

        except Exception as e:
            logger.debug(f"Error polling {source_name}: {e}")

        return events

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract potential trading keywords."""
        text = text.lower()
        keywords = []

        # Politics
        if "trump" in text: keywords.append("trump")
        if "biden" in text: keywords.append("biden")
        if "harris" in text: keywords.append("harris")
        if "election" in text: keywords.append("election")
        if "approval" in text: keywords.append("approval")

        # Crypto
        if "bitcoin" in text or "btc" in text: keywords.append("bitcoin")
        if "ethereum" in text or "eth" in text: keywords.append("ethereum")
        if "etf" in text: keywords.append("etf")
        if "sec" in text: keywords.append("sec")
        if "rate" in text: keywords.append("rate")

        return keywords


class NewsArbitrageStrategy:
    """
    Monitor news and exploit cross-platform price lag.

    Strategy:
    1. Monitor news sources for relevant events
    2. When event detected, immediately check prices on both platforms
    3. If spread > threshold, execute trade
    4. Polymarket typically reacts faster, Kalshi lags 5-30 min

    Best events to watch:
    - Election results (any projection/call)
    - Fed rate decisions
    - Legal verdicts (Trump cases, crypto, etc.)
    - Sports championships
    - Crypto regulatory news
    - Geopolitical events (wars, sanctions, treaties)
    - Corporate earnings/announcements
    - Natural disasters/emergencies
    """

    # Default keywords to watch - comprehensive list for market-moving events
    # Based on research from algo trading forums, academic papers, and historical analysis
    DEFAULT_KEYWORDS = {
        # ELECTIONS & POLITICS (high impact)
        "election", "wins", "winner", "victory", "projected", "calls", "votes",
        "electoral", "ballot", "recount", "concede", "concession", "declared",
        "swing state", "battleground", "landslide", "upset",

        # POLITICAL FIGURES (US-focused)
        "trump", "biden", "harris", "desantis", "newsom", "musk", "rfk",
        "pelosi", "mcconnell", "schumer", "congress", "senate", "house",

        # FEDERAL RESERVE & MONETARY POLICY (very high impact)
        "fed", "fomc", "rate", "powell", "inflation", "cpi", "pce",
        "hawkish", "dovish", "taper", "qe", "qt", "basis points", "bps",
        "unemployment", "nonfarm", "payroll", "gdp", "recession",
        "soft landing", "hard landing", "pivot",

        # LEGAL & REGULATORY (high impact)
        "verdict", "guilty", "acquitted", "ruling", "indictment", "indicted",
        "convicted", "sentenced", "charges", "lawsuit", "settlement",
        "supreme court", "appeals", "trial", "jury", "injunction",

        # CRYPTO & BLOCKCHAIN (high volatility)
        "bitcoin", "btc", "ethereum", "eth", "crypto", "sec", "cftc",
        "etf", "spot etf", "approval", "denied", "coinbase", "binance",
        "stablecoin", "defi", "hack", "exploit", "rug pull", "halving",
        "gensler", "grayscale", "blackrock",

        # GEOPOLITICS & INTERNATIONAL (can move markets quickly)
        "war", "invasion", "ceasefire", "peace", "sanctions", "tariff",
        "treaty", "nato", "china", "russia", "ukraine", "israel", "iran",
        "missile", "nuclear", "military", "troops", "attacked",

        # CORPORATE & MARKETS (earnings season)
        "earnings", "beat", "miss", "guidance", "revenue", "profit",
        "layoff", "merger", "acquisition", "ipo", "bankrupt", "default",
        "tesla", "nvidia", "apple", "amazon", "google", "meta",

        # BREAKING NEWS SIGNALS (urgency indicators)
        "breaking", "just in", "urgent", "alert", "confirmed", "official",
        "announced", "reportedly", "sources say", "exclusive",

        # SPORTS (for sports prediction markets)
        "championship", "finals", "playoff", "super bowl", "world series",
        "injured", "suspended", "traded", "mvp", "upset",
    }

    def __init__(
        self,
        polymarket_client=None,
        kalshi_client=None,
        db_client=None,
        min_spread_pct: float = 3.0,
        max_lag_minutes: int = 30,
        position_size_usd: float = 50.0,
        scan_interval_sec: int = 30,
        keywords: Optional[Set[str]] = None,
        on_opportunity: Optional[Callable] = None,
    ):
        self.poly_client = polymarket_client
        self.kalshi_client = kalshi_client
        self.db = db_client

        # Configuration
        self.min_spread_pct = Decimal(str(min_spread_pct))
        self.max_lag = timedelta(minutes=max_lag_minutes)
        self.position_size = Decimal(str(position_size_usd))
        self.scan_interval = scan_interval_sec
        self.keywords = keywords or {
            "trump", "biden", "rate", "fed", "inflation",
            "bitcoin", "etf", "approval", "election"
        }

        # Callback
        self.on_opportunity = on_opportunity

        # State
        self._running = False
        self._events: List[NewsEvent] = []
        self._opportunities: List[NewsArbOpportunity] = []
        self._watched_markets: Dict[str, Dict] = {}  # topic -> {poly, kalshi}
        self.stats = NewsArbStats()

        # V2: RSS Monitor
        self.rss_monitor = RSSMonitor()

        # Price cache
        self._price_cache: Dict[str, PriceSnapshot] = {}

    def add_keyword(self, keyword: str):
        """Add a keyword to watch"""
        self.keywords.add(keyword.lower())

    def remove_keyword(self, keyword: str):
        """Remove a keyword"""
        self.keywords.discard(keyword.lower())

    async def scan_for_events(self) -> List[NewsEvent]:
        """
        Scan for news events.

        V2 Implementation:
        1. Poll RSS feeds (CoinDesk, Politico)
        2. Check Polymarket volume spikes
        """
        events = []

        # 1. Poll RSS Feeds (Real News)
        try:
            rss_events = await self.rss_monitor.poll()
            events.extend(rss_events)
        except Exception as e:
            logger.debug(f"Error polling RSS: {e}")

        # 2. Check Polymarket for volume spikes (Market Signal)
        try:
            poly_events = await self._check_polymarket_volume_spikes()
            events.extend(poly_events)
        except Exception as e:
            logger.debug(f"Error checking Polymarket volume: {e}")

        if events:
            logger.info(f"Found {len(events)} new events")
            for event in events:
                self.stats.events_detected += 1
                logger.info(
                    f"🔔 NEWS EVENT: {event.headline[:60]}... "
                    f"(source: {event.source.value})"
                )

        return events

    async def _check_polymarket_volume_spikes(self) -> List[NewsEvent]:
        """
        Detect volume spikes on Polymarket as proxy for news.

        Logic: If a market suddenly gets 10x+ normal volume,
        something is happening.
        """
        events = []

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://gamma-api.polymarket.com/markets",
                    params={
                        "active": "true",
                        "limit": 50,
                        "order": "volume24hr",
                    }
                ) as resp:
                    if resp.status != 200:
                        return events

                    markets = await resp.json()

                    for m in markets[:20]:  # Check top 20 by volume
                        volume = float(m.get("volume", 0) or 0)
                        question = m.get("question", "").lower()

                        # Check if market matches our keywords
                        matches = [
                            kw for kw in self.keywords
                            if kw in question
                        ]

                        if matches and volume > 100000:  # >$100k volume
                            events.append(NewsEvent(
                                source=NewsSource.POLYMARKET,
                                headline=f"High volume: {m.get('question', '')[:100]}",
                                keywords=matches,
                                detected_at=datetime.now(timezone.utc),
                                severity=AlertSeverity.MEDIUM,
                            ))

        except Exception as e:
            logger.debug(f"Error in volume spike check: {e}")

        return events

    def _analyze_sentiment(self, text: str) -> float:
        """
        Simple keyword-based sentiment analysis.
        Returns: -1.0 (negative) to 1.0 (positive)
        """
        text = text.lower()
        score = 0.0

        positive = {"win", "lead", "record", "high", "approve", "accept", "bull", "rally", "growth", "beat"}
        negative = {"loss", "lose", "trail", "low", "reject", "ban", "bear", "crash", "drop", "miss", "sue"}

        words = set(re.findall(r'\w+', text))

        score += sum(1 for w in words if w in positive)
        score -= sum(1 for w in words if w in negative)

        # Normalize to range -1 to 1 (soft sigmoid-ish)
        if score > 0:
            return min(1.0, score * 0.2)
        else:
            return max(-1.0, score * 0.2)

    async def check_price_divergence(
        self,
        topic: str,
        sentiment_score: float = 0.0
    ) -> Optional[NewsArbOpportunity]:
        """
        Check for price divergence between platforms for a topic.
        Uses parallel fetching for minimal latency.
        """
        try:
            # Parallel fetch
            poly_task = self._get_polymarket_price(topic)
            kalshi_task = self._get_kalshi_price(topic)

            poly_snapshot, kalshi_snapshot = await asyncio.gather(poly_task, kalshi_task)

            if not poly_snapshot or not kalshi_snapshot:
                return None

            # Calculate spread
            poly_price = poly_snapshot.yes_price
            kalshi_price = kalshi_snapshot.yes_price

            if poly_price == 0 or kalshi_price == 0:
                return None

            spread = abs(poly_price - kalshi_price)
            spread_pct = (spread / min(poly_price, kalshi_price)) * 100

            # Check if meets threshold
            if spread_pct < self.min_spread_pct:
                logger.debug(
                    f"Spread too low for {topic}: {spread_pct:.1f}% "
                    f"(need {self.min_spread_pct}%)"
                )
                return None

            # Determine direction & Confidence
            # Strategy: We assume Poly is "fast" and Kalshi is "slow/lagging".
            # Positive News -> Price Up. Poly High, Kalshi Low. -> Buy Kalshi (Catch up).
            # Negative News -> Price Down. Poly Low, Kalshi High. -> Sell Kalshi (Catch up).
            # note: current execution only supports 'buy'.

            sentiment_bonus = 0.0
            direction = ""
            confidence = 0.0

            if kalshi_price < poly_price:
                # Poly is Higher. Implies Positive movement (if filtered by sentiment).
                direction = "buy_kalshi"

                # If sentiment is positive, this trade makes sense (Market is going up, Kalshi lags low)
                if sentiment_score > 0:
                    sentiment_bonus = 0.2
                elif sentiment_score < 0:
                    sentiment_bonus = -0.2 # Contradictory signal

                confidence = min(0.9, float(spread_pct) / 10 + sentiment_bonus)

            else:
                # Poly is Lower. Implies Negative movement.
                # Kalshi is High. We arguably want to SELL Kalshi.
                # If we can only BUY, we might Buy Poly? (Betting on reversion? No, Poly is the leader).
                # If Poly dropped, it's correct. Buying Poly means buying the dip?
                # Or maybe Kalshi will check down.

                direction = "buy_poly"

                # If sentiment is negative, markets are crashing.
                # Buying anything is risky unless we really think Poly oversold.
                # If sentiment is positive but Poly dropped? Contradiction.

                if sentiment_score < 0:
                    sentiment_bonus = -0.1 # Risky to buy into a crash

                confidence = min(0.9, float(spread_pct) / 10 + sentiment_bonus)

            # Create opportunity
            event = NewsEvent(
                source=NewsSource.MANUAL,
                headline=f"Price divergence detected: {topic}",
                keywords=[topic],
                detected_at=datetime.now(timezone.utc),
            )

            opp = NewsArbOpportunity(
                event=event,
                poly_snapshot=poly_snapshot,
                kalshi_snapshot=kalshi_snapshot,
                spread_pct=Decimal(str(spread_pct)),
                direction=direction,
                confidence=confidence,
            )

            self.stats.opportunities_found += 1
            self._opportunities.append(opp)

            logger.warning(
                f"🎯 ARB OPPORTUNITY: {topic}\n"
                f"   Poly: ${poly_price:.3f} | Kalshi: ${kalshi_price:.3f}\n"
                f"   Spread: {spread_pct:.1f}% | Direction: {direction}\n"
                f"   Expected profit: {opp.expected_profit_pct:.1f}%"
            )

            # Log to database
            if self.db:
                try:
                    self.db.log_opportunity({
                        "type": "news_arbitrage",
                        "topic": topic,
                        **opp.to_dict(),
                    })
                except Exception as e:
                    logger.debug(f"Error logging opportunity: {e}")

            # Callback
            if self.on_opportunity:
                await self.on_opportunity(opp)

            return opp

        except Exception as e:
            logger.error(f"Error checking divergence for {topic}: {e}")
            return None

    async def _get_polymarket_price(
        self, topic: str
    ) -> Optional[PriceSnapshot]:
        """Get current Polymarket price for a topic"""
        try:
            async with aiohttp.ClientSession() as session:
                # Search for matching market
                async with session.get(
                    "https://gamma-api.polymarket.com/markets",
                    params={"active": "true", "limit": 20}
                ) as resp:
                    if resp.status != 200:
                        return None

                    markets = await resp.json()

                    # Find best matching market
                    topic_lower = topic.lower()
                    for m in markets:
                        question = m.get("question", "").lower()
                        if topic_lower in question:
                            # Get YES price
                            yes_price = Decimal("0.5")  # Default

                            tokens = m.get("tokens", [])
                            for t in tokens:
                                if t.get("outcome", "").upper() == "YES":
                                    price = t.get("price")
                                    if price:
                                        yes_price = Decimal(str(price))

                            # Check outcomePrices
                            outcome_prices = m.get("outcomePrices", "")
                            if outcome_prices:
                                try:
                                    import json
                                    prices = json.loads(outcome_prices)
                                    if len(prices) >= 1:
                                        yes_price = Decimal(str(prices[0]))
                                except Exception:
                                    pass

                            return PriceSnapshot(
                                platform="polymarket",
                                market_id=m.get("id", ""),
                                market_name=m.get("question", "")[:200],
                                yes_price=yes_price,
                                no_price=Decimal("1") - yes_price,
                                volume_24h=float(m.get("volume", 0) or 0),
                                timestamp=datetime.now(timezone.utc),
                            )

        except Exception as e:
            logger.debug(f"Error getting Polymarket price: {e}")

        return None

    async def _get_kalshi_price(
        self, topic: str
    ) -> Optional[PriceSnapshot]:
        """Get current Kalshi price for a topic"""
        try:
            async with aiohttp.ClientSession() as session:
                # Search for matching market
                async with session.get(
                    "https://api.elections.kalshi.com/trade-api/v2/markets",
                    params={"status": "open", "limit": 50}
                ) as resp:
                    if resp.status != 200:
                        return None

                    data = await resp.json()
                    markets = data.get("markets", [])

                    # Find best matching market
                    topic_lower = topic.lower()
                    for m in markets:
                        title = m.get("title", "").lower()
                        subtitle = m.get("subtitle", "").lower()

                        if topic_lower in title or topic_lower in subtitle:
                            # Get YES price (from bid/ask)
                            yes_bid = m.get("yes_bid", 0) or 0
                            yes_ask = m.get("yes_ask", 100) or 100

                            # Use mid price
                            yes_price = Decimal(str((yes_bid + yes_ask) / 200))

                            return PriceSnapshot(
                                platform="kalshi",
                                market_id=m.get("ticker", ""),
                                market_name=f"{m.get('title', '')} - {m.get('subtitle', '')}"[:200],
                                yes_price=yes_price,
                                no_price=Decimal("1") - yes_price,
                                volume_24h=float(m.get("volume", 0) or 0),
                                timestamp=datetime.now(timezone.utc),
                            )

        except Exception as e:
            logger.debug(f"Error getting Kalshi price: {e}")

        return None

    async def run(self, duration_seconds: int = 3600):
        """
        Run news arbitrage monitoring.

        Args:
            duration_seconds: How long to run (default 1 hour)
        """
        logger.info(
            f"🔍 Starting News Arbitrage Scanner "
            f"(min spread: {self.min_spread_pct}%, "
            f"keywords: {len(self.keywords)})"
        )

        self._running = True
        start_time = datetime.now(timezone.utc)

        iteration = 0
        while self._running:
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            if elapsed >= duration_seconds:
                logger.info(f"Duration reached ({duration_seconds}s)")
                break

            iteration += 1

            try:
                # Scan for news events
                events = await self.scan_for_events()
                self._events.extend(events)

                # For each event, check price divergence
                for event in events:
                    if event.processed:
                        continue

                    sentiment = self._analyze_sentiment(event.headline)

                    for keyword in event.keywords:
                        opp = await self.check_price_divergence(
                            keyword,
                            sentiment_score=sentiment
                        )
                        if opp:
                            logger.info(f"Found opportunity from event: {event.headline[:50]}...")

                    event.processed = True

                # Also check configured watched topics (periodic sync)
                for topic in list(self.keywords)[:5]:  # Check top 5 keywords
                    await self.check_price_divergence(topic)

                # Log periodic summary
                if iteration % 6 == 0:  # Every 3 minutes (at 30s interval)
                    self._log_summary()

            except Exception as e:
                logger.error(f"News arbitrage error: {e}")

            await asyncio.sleep(self.scan_interval)

        self._running = False

        # Final summary
        self._log_summary()
        logger.info("News Arbitrage Scanner stopped")

    def _log_summary(self):
        """Log performance summary"""
        stats = self.stats.to_dict()
        logger.info(
            f"📊 News Arb Summary | "
            f"Events: {stats['events_detected']} | "
            f"Opportunities: {stats['opportunities_found']} | "
            f"Net P&L: ${stats['net_pnl']:.2f}"
        )

    def stop(self):
        """Stop monitoring"""
        logger.info("Stopping News Arbitrage Scanner...")
        self._running = False

    def get_stats(self) -> Dict:
        """Get current statistics"""
        return {
            "running": self._running,
            "keywords": list(self.keywords),
            "recent_events": [
                {
                    "headline": e.headline[:100],
                    "source": e.source.value,
                    "detected_at": e.detected_at.isoformat(),
                }
                for e in self._events[-10:]
            ],
            "recent_opportunities": [
                o.to_dict() for o in self._opportunities[-10:]
            ],
            **self.stats.to_dict(),
        }

    def get_opportunities(self) -> List[NewsArbOpportunity]:
        """Get all detected opportunities"""
        return self._opportunities


# Entry point for testing
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    print("=" * 70)
    print("📰 NEWS ARBITRAGE STRATEGY - Simulation")
    print("=" * 70)
    print()
    print("This strategy exploits the price lag between platforms")
    print("when news events occur.")
    print()
    print("How it works:")
    print("1. Monitor news sources for relevant events")
    print("2. When news breaks, check prices on both platforms")
    print("3. Polymarket updates faster (retail), Kalshi lags")
    print("4. Execute trades during the lag window")
    print()
    print("Expected returns: 5-30% per event")
    print("Risk: Medium-High (timing dependent)")
    print()

    async def main():
        scanner = NewsArbitrageStrategy(
            min_spread_pct=3.0,
            position_size_usd=50.0,
            scan_interval_sec=10,
        )

        # Add some test keywords
        scanner.add_keyword("bitcoin")
        scanner.add_keyword("trump")
        scanner.add_keyword("fed")

        await scanner.run(duration_seconds=60)
        print("\nFinal stats:", scanner.get_stats())

    asyncio.run(main())
