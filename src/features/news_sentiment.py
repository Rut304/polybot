"""
News & Sentiment Integration

Monitors news sources and social media for market-moving events,
then correlates with prediction market movements.
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Callable
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class SentimentLevel(Enum):
    VERY_BEARISH = -2
    BEARISH = -1
    NEUTRAL = 0
    BULLISH = 1
    VERY_BULLISH = 2


class NewsSource(Enum):
    POLYMARKET = "polymarket"  # Polymarket's own activity
    REDDIT = "reddit"
    TWITTER = "twitter"
    NEWS_API = "news_api"
    GOOGLE_NEWS = "google_news"


@dataclass
class NewsItem:
    """Represents a news article or social post."""
    id: str
    source: NewsSource
    title: str
    content: str
    url: str
    published_at: datetime
    author: Optional[str] = None
    sentiment: SentimentLevel = SentimentLevel.NEUTRAL
    sentiment_score: float = 0.0
    keywords: List[str] = field(default_factory=list)
    related_markets: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source.value,
            "title": self.title,
            "url": self.url,
            "published_at": self.published_at.isoformat(),
            "sentiment": self.sentiment.value,
            "sentiment_score": self.sentiment_score,
            "keywords": self.keywords,
            "related_markets": self.related_markets,
        }


@dataclass
class MarketAlert:
    """Alert when news might affect a market."""
    id: str
    market_condition_id: str
    market_question: str
    news_item: NewsItem
    alert_type: str  # "sentiment_shift", "breaking_news", "volume_spike"
    confidence: float
    suggested_action: str  # "buy", "sell", "watch"
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "market_condition_id": self.market_condition_id,
            "market_question": self.market_question,
            "news": self.news_item.to_dict(),
            "alert_type": self.alert_type,
            "confidence": self.confidence,
            "suggested_action": self.suggested_action,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class MarketSentiment:
    """Aggregated sentiment for a market."""
    condition_id: str
    question: str
    overall_sentiment: SentimentLevel
    sentiment_score: float  # -1.0 to 1.0
    news_count: int
    bullish_count: int
    bearish_count: int
    recent_news: List[NewsItem] = field(default_factory=list)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class NewsSentimentEngine:
    """
    Monitors news and social media for market-relevant information.
    
    Features:
    - Fetch news from multiple sources
    - Keyword-based market matching
    - Basic sentiment analysis
    - Generate trading alerts
    """
    
    # Polymarket activity API
    POLYMARKET_ACTIVITY = "https://gamma-api.polymarket.com/activity"
    POLYMARKET_EVENTS = "https://gamma-api.polymarket.com/events"
    
    # Keywords mapped to market categories
    MARKET_KEYWORDS = {
        "politics": [
            "trump", "biden", "election", "congress", "senate",
            "democrat", "republican", "vote", "poll", "campaign",
        ],
        "crypto": [
            "bitcoin", "ethereum", "btc", "eth", "crypto",
            "blockchain", "defi", "nft", "sec", "binance",
        ],
        "ai": [
            "openai", "chatgpt", "gpt", "claude", "anthropic",
            "google", "gemini", "ai", "artificial intelligence",
        ],
        "sports": [
            "nfl", "nba", "mlb", "super bowl", "world series",
            "championship", "playoffs", "finals",
        ],
        "economics": [
            "fed", "interest rate", "inflation", "gdp",
            "unemployment", "recession", "fomc", "powell",
        ],
    }
    
    # Sentiment keywords
    POSITIVE_WORDS = {
        "win", "wins", "winning", "success", "surge", "soar",
        "rise", "gain", "bullish", "positive", "approve",
        "pass", "confirm", "breakthrough", "record", "best",
    }
    
    NEGATIVE_WORDS = {
        "lose", "loss", "fail", "crash", "plunge", "drop",
        "fall", "decline", "bearish", "negative", "reject",
        "block", "concern", "risk", "worst", "scandal",
    }
    
    def __init__(
        self,
        news_api_key: Optional[str] = None,
        check_interval: int = 300,  # 5 minutes
    ):
        self.news_api_key = news_api_key
        self.check_interval = check_interval
        self.news_cache: Dict[str, NewsItem] = {}
        self.market_sentiments: Dict[str, MarketSentiment] = {}
        self.alerts: List[MarketAlert] = []
        self._running = False
    
    async def fetch_polymarket_activity(
        self,
        hours: int = 24
    ) -> List[NewsItem]:
        """Fetch recent activity from Polymarket itself."""
        news_items = []
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Get recent events/markets that have activity
                response = await client.get(
                    self.POLYMARKET_EVENTS,
                    params={
                        "closed": "false",
                        "limit": 50,
                        "order": "volume24hr",
                        "ascending": "false",
                    }
                )
                response.raise_for_status()
                events = response.json()
                
                for event in events:
                    # High volume = news-worthy activity
                    volume_24h = float(event.get("volume24hr", 0) or 0)
                    if volume_24h > 10000:  # $10k+ volume
                        item = NewsItem(
                            id=f"pm_{event.get('id', '')}",
                            source=NewsSource.POLYMARKET,
                            title=f"High activity: {event.get('title', 'Unknown')}",
                            content=event.get("description", ""),
                            url=f"https://polymarket.com/event/{event.get('slug', '')}",
                            published_at=datetime.utcnow(),
                            keywords=self._extract_keywords(
                                event.get("title", "") + " " + 
                                event.get("description", "")
                            ),
                        )
                        news_items.append(item)
                
            except Exception as e:
                logger.error(f"Error fetching Polymarket activity: {e}")
        
        return news_items
    
    async def fetch_news_api(
        self,
        query: str,
        hours: int = 24
    ) -> List[NewsItem]:
        """Fetch news from NewsAPI.org."""
        if not self.news_api_key:
            return []
        
        news_items = []
        from_date = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    "https://newsapi.org/v2/everything",
                    params={
                        "q": query,
                        "from": from_date,
                        "sortBy": "publishedAt",
                        "apiKey": self.news_api_key,
                        "language": "en",
                        "pageSize": 20,
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                for article in data.get("articles", []):
                    item = NewsItem(
                        id=f"news_{hash(article.get('url', ''))}",
                        source=NewsSource.NEWS_API,
                        title=article.get("title", ""),
                        content=article.get("description", "") or "",
                        url=article.get("url", ""),
                        published_at=datetime.fromisoformat(
                            article.get("publishedAt", "").replace("Z", "")
                        ),
                        author=article.get("author"),
                        keywords=self._extract_keywords(
                            article.get("title", "") + " " + 
                            (article.get("description", "") or "")
                        ),
                    )
                    news_items.append(item)
                
            except Exception as e:
                logger.error(f"Error fetching news: {e}")
        
        return news_items
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from text."""
        text_lower = text.lower()
        keywords = []
        
        for category, words in self.MARKET_KEYWORDS.items():
            for word in words:
                if word in text_lower:
                    keywords.append(word)
        
        return list(set(keywords))
    
    def analyze_sentiment(self, text: str) -> tuple:
        """
        Basic sentiment analysis.
        
        Returns (SentimentLevel, score from -1.0 to 1.0)
        """
        text_lower = text.lower()
        words = set(re.findall(r'\b\w+\b', text_lower))
        
        positive_count = len(words & self.POSITIVE_WORDS)
        negative_count = len(words & self.NEGATIVE_WORDS)
        
        total = positive_count + negative_count
        if total == 0:
            return SentimentLevel.NEUTRAL, 0.0
        
        score = (positive_count - negative_count) / total
        
        if score >= 0.5:
            level = SentimentLevel.VERY_BULLISH
        elif score >= 0.2:
            level = SentimentLevel.BULLISH
        elif score <= -0.5:
            level = SentimentLevel.VERY_BEARISH
        elif score <= -0.2:
            level = SentimentLevel.BEARISH
        else:
            level = SentimentLevel.NEUTRAL
        
        return level, score
    
    async def fetch_all_news(self) -> List[NewsItem]:
        """Fetch news from all configured sources."""
        all_news = []
        
        # Polymarket activity
        pm_news = await self.fetch_polymarket_activity()
        all_news.extend(pm_news)
        
        # News API for key topics
        if self.news_api_key:
            for topic in ["prediction market", "polymarket", "cryptocurrency"]:
                topic_news = await self.fetch_news_api(topic, hours=12)
                all_news.extend(topic_news)
                await asyncio.sleep(0.5)  # Rate limit
        
        # Analyze sentiment for all items
        for item in all_news:
            level, score = self.analyze_sentiment(item.title + " " + item.content)
            item.sentiment = level
            item.sentiment_score = score
            self.news_cache[item.id] = item
        
        logger.info(f"Fetched {len(all_news)} news items")
        return all_news
    
    async def match_news_to_markets(
        self,
        news_items: List[NewsItem],
        markets: List[Dict[str, Any]]
    ) -> List[MarketAlert]:
        """Match news items to relevant markets and generate alerts."""
        alerts = []
        
        for news in news_items:
            for market in markets:
                market_question = market.get("question", "").lower()
                market_id = market.get("conditionId", "")
                
                # Check keyword overlap
                matching_keywords = []
                for keyword in news.keywords:
                    if keyword in market_question:
                        matching_keywords.append(keyword)
                
                if not matching_keywords:
                    continue
                
                # Calculate confidence based on keyword overlap
                confidence = min(1.0, len(matching_keywords) * 0.3)
                
                # Determine suggested action based on sentiment
                if news.sentiment in [SentimentLevel.VERY_BULLISH, SentimentLevel.BULLISH]:
                    suggested_action = "buy"
                elif news.sentiment in [SentimentLevel.VERY_BEARISH, SentimentLevel.BEARISH]:
                    suggested_action = "sell"
                else:
                    suggested_action = "watch"
                
                alert = MarketAlert(
                    id=f"alert_{news.id}_{market_id[:8]}",
                    market_condition_id=market_id,
                    market_question=market.get("question", ""),
                    news_item=news,
                    alert_type="sentiment_shift" if abs(news.sentiment_score) > 0.3 else "breaking_news",
                    confidence=confidence,
                    suggested_action=suggested_action,
                )
                
                alerts.append(alert)
                news.related_markets.append(market_id)
        
        # Sort by confidence
        alerts.sort(key=lambda x: x.confidence, reverse=True)
        
        self.alerts.extend(alerts)
        return alerts
    
    def get_market_sentiment(self, condition_id: str) -> Optional[MarketSentiment]:
        """Get aggregated sentiment for a specific market."""
        return self.market_sentiments.get(condition_id)
    
    def get_recent_alerts(self, hours: int = 24) -> List[MarketAlert]:
        """Get recent alerts within the specified timeframe."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return [a for a in self.alerts if a.created_at >= cutoff]
    
    async def run(
        self,
        markets: List[Dict[str, Any]],
        on_alert: Optional[Callable[[MarketAlert], Any]] = None,
    ) -> None:
        """
        Run continuous news monitoring.
        
        Args:
            markets: List of markets to match news against
            on_alert: Callback when a new alert is generated
        """
        self._running = True
        logger.info("Starting news/sentiment engine")
        
        while self._running:
            try:
                # Fetch all news
                news = await self.fetch_all_news()
                
                # Match to markets and generate alerts
                alerts = await self.match_news_to_markets(news, markets)
                
                logger.info(f"Generated {len(alerts)} alerts from {len(news)} news items")
                
                # Notify on high-confidence alerts
                for alert in alerts:
                    if alert.confidence >= 0.5:
                        logger.info(
                            f"Alert: {alert.alert_type} - "
                            f"{alert.market_question[:50]}... - "
                            f"Action: {alert.suggested_action}"
                        )
                        
                        if on_alert:
                            try:
                                result = on_alert(alert)
                                if asyncio.iscoroutine(result):
                                    await result
                            except Exception as e:
                                logger.error(f"Alert callback error: {e}")
                
            except Exception as e:
                logger.error(f"Error in news monitoring loop: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    def stop(self) -> None:
        """Stop the news engine."""
        self._running = False
        logger.info("Stopping news/sentiment engine")


# Example usage
async def main():
    engine = NewsSentimentEngine(
        news_api_key=None,  # Add your key here
        check_interval=300,
    )
    
    # Single fetch
    news = await engine.fetch_all_news()
    
    print(f"\nFetched {len(news)} news items")
    for item in news[:5]:
        print(f"\n{item.source.value}: {item.title}")
        print(f"  Sentiment: {item.sentiment.name} ({item.sentiment_score:.2f})")
        print(f"  Keywords: {', '.join(item.keywords[:5])}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
