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
from typing import Dict, List, Optional, Callable, Set
from enum import Enum
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
            "session_start": self.session_start.isoformat(),
            "events_detected": self.events_detected,
            "opportunities_found": self.opportunities_found,
            "opportunities_executed": self.opportunities_executed,
            "total_profit_usd": float(self.total_profit_usd),
            "total_loss_usd": float(self.total_loss_usd),
            "net_pnl": float(self.net_pnl),
        }


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
    """
    
    # Default keywords to watch
    DEFAULT_KEYWORDS = {
        "election", "wins", "victory", "projected", "calls",
        "fed", "fomc", "rate", "powell",
        "verdict", "guilty", "acquitted", "ruling",
        "bitcoin", "btc", "ethereum", "sec", "crypto",
        "trump", "biden", "harris",
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
        self.max_lag_minutes = max_lag_minutes
        self.position_size_usd = Decimal(str(position_size_usd))
        self.scan_interval_sec = scan_interval_sec
        self.keywords = keywords or self.DEFAULT_KEYWORDS
        
        # Callback
        self.on_opportunity = on_opportunity
        
        # State
        self._running = False
        self._events: List[NewsEvent] = []
        self._opportunities: List[NewsArbOpportunity] = []
        self._watched_markets: Dict[str, Dict] = {}  # topic -> {poly, kalshi}
        self.stats = NewsArbStats()
        
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
        
        In production, this would:
        1. Poll Twitter API for breaking news
        2. Check AP/Reuters feeds
        3. Monitor Polymarket for volume spikes
        """
        events = []
        
        # Check Polymarket for volume spikes (proxy for news)
        try:
            poly_events = await self._check_polymarket_volume_spikes()
            events.extend(poly_events)
        except Exception as e:
            logger.debug(f"Error checking Polymarket volume: {e}")
        
        # Check for manual/simulated events (for testing)
        # In production, add Twitter/news API integration
        
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
    
    async def check_price_divergence(
        self,
        topic: str
    ) -> Optional[NewsArbOpportunity]:
        """
        Check for price divergence between platforms for a topic.
        """
        try:
            # Get prices from both platforms
            poly_snapshot = await self._get_polymarket_price(topic)
            kalshi_snapshot = await self._get_kalshi_price(topic)
            
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
            
            # Determine direction
            if kalshi_price < poly_price:
                direction = "buy_kalshi"
                confidence = min(0.9, float(spread_pct) / 10)
            else:
                direction = "buy_poly"
                confidence = min(0.9, float(spread_pct) / 10)
            
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
                    
                    for keyword in event.keywords:
                        opp = await self.check_price_divergence(keyword)
                        if opp:
                            logger.info(f"Found opportunity from event: {event.headline[:50]}...")
                    
                    event.processed = True
                
                # Also check configured watched topics
                for topic in list(self.keywords)[:5]:  # Check top 5 keywords
                    await self.check_price_divergence(topic)
                
                # Log periodic summary
                if iteration % 6 == 0:  # Every 3 minutes (at 30s interval)
                    self._log_summary()
                
            except Exception as e:
                logger.error(f"News arbitrage error: {e}")
            
            await asyncio.sleep(self.scan_interval_sec)
        
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
