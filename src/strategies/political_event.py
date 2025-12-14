"""
Political Event Trading Strategy

Based on leaderboard analysis showing political specialists dominate profits.
Strategy focuses on high-conviction political event trading with specific triggers.

Key insights from top traders:
- Politics-focused usernames dominate top 50 leaderboard
- Political events offer asymmetric risk/reward opportunities  
- Information edges are possible through careful news monitoring
- Time-sensitive events (debates, primaries, speeches) create momentum

Strategy components:
1. Monitor key political calendars and events
2. Track political news sentiment in real-time
3. Identify high-conviction setups around events
4. Execute with appropriate position sizing
5. Use congressional trading data as signal
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import re

logger = logging.getLogger(__name__)


class PoliticalEventType(Enum):
    """Types of political events to track"""
    DEBATE = "debate"
    ELECTION = "election"
    PRIMARY = "primary"
    POLL_RELEASE = "poll_release"
    SPEECH = "speech"
    LEGISLATION = "legislation"
    COURT_RULING = "court_ruling"
    APPOINTMENT = "appointment"
    SCANDAL = "scandal"
    RESIGNATION = "resignation"


class ConvictionLevel(Enum):
    """Conviction level for trades"""
    EXTREME = "extreme"      # 90%+ confidence
    HIGH = "high"            # 75-90% confidence
    MEDIUM = "medium"        # 60-75% confidence
    LOW = "low"              # <60% confidence


@dataclass
class PoliticalEvent:
    """Represents a political event"""
    event_type: PoliticalEventType
    title: str
    description: str
    scheduled_at: Optional[datetime]
    
    # Related markets
    related_market_ids: List[str] = field(default_factory=list)
    related_tickers: List[str] = field(default_factory=list)
    
    # Signals
    sentiment_score: float = 0.0  # -1 to 1
    conviction_level: ConvictionLevel = ConvictionLevel.LOW
    congressional_signal: Optional[str] = None  # Buy/sell signal from congress trades
    
    # Metadata
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "title": self.title,
            "description": self.description,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "related_market_ids": self.related_market_ids,
            "related_tickers": self.related_tickers,
            "sentiment_score": self.sentiment_score,
            "conviction_level": self.conviction_level.value,
            "congressional_signal": self.congressional_signal,
            "detected_at": self.detected_at.isoformat(),
            "source": self.source,
        }


@dataclass
class PoliticalSignal:
    """Trading signal from political analysis"""
    market_id: str
    ticker: str
    direction: str  # "buy" or "sell"
    conviction: ConvictionLevel
    reason: str
    event: Optional[PoliticalEvent] = None
    
    # Position sizing suggestion
    suggested_position_pct: float = 1.0  # % of normal position size
    max_position_usd: Decimal = Decimal("100")
    
    # Timing
    urgency: str = "normal"  # "immediate", "normal", "wait"
    expires_at: Optional[datetime] = None
    
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class PoliticalEventStrategy:
    """
    Strategy that trades on political events with high conviction.
    
    Features:
    - Event calendar monitoring
    - News sentiment analysis
    - Congressional trading signal integration
    - Dynamic position sizing based on conviction
    """
    
    def __init__(
        self,
        db_client=None,
        config: Optional[Dict] = None,
        on_signal: Optional[Callable[[PoliticalSignal], None]] = None,
    ):
        self.db = db_client
        self.config = config or {}
        self.on_signal = on_signal
        
        # Configuration
        self.enabled = self.config.get("enable_political_event", True)
        self.min_conviction = ConvictionLevel[
            self.config.get("political_min_conviction", "HIGH").upper()
        ]
        self.max_position_usd = Decimal(str(self.config.get("political_max_position_usd", 200)))
        self.use_congressional_signal = self.config.get("political_use_congressional", True)
        self.event_lookback_hours = self.config.get("political_event_lookback_hours", 48)
        
        # State
        self.active_events: List[PoliticalEvent] = []
        self.recent_signals: List[PoliticalSignal] = []
        self.last_scan_at: Optional[datetime] = None
        
        # Political keywords for market identification
        self.political_keywords = [
            "trump", "biden", "harris", "vance", "election", "president",
            "senate", "house", "congress", "republican", "democrat",
            "gop", "dnc", "primary", "debate", "poll", "vote", "ballot",
            "governor", "mayor", "impeach", "scotus", "supreme court"
        ]
        
        # Event patterns
        self.event_patterns = {
            PoliticalEventType.DEBATE: [
                r"debate", r"face-off", r"showdown"
            ],
            PoliticalEventType.ELECTION: [
                r"election", r"vote", r"ballot", r"winner"
            ],
            PoliticalEventType.PRIMARY: [
                r"primary", r"caucus", r"nomination"
            ],
            PoliticalEventType.POLL_RELEASE: [
                r"poll", r"survey", r"polling", r"approval"
            ],
            PoliticalEventType.SPEECH: [
                r"speech", r"address", r"statement", r"press conference"
            ],
        }
        
        logger.info(
            f"PoliticalEventStrategy initialized - "
            f"enabled={self.enabled}, min_conviction={self.min_conviction.value}, "
            f"max_position=${self.max_position_usd}"
        )
    
    def is_political_market(self, market: Dict) -> bool:
        """Check if a market is political based on keywords"""
        text = f"{market.get('question', '')} {market.get('description', '')}".lower()
        return any(kw in text for kw in self.political_keywords)
    
    def classify_event_type(self, text: str) -> Optional[PoliticalEventType]:
        """Classify the type of political event from text"""
        text_lower = text.lower()
        for event_type, patterns in self.event_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return event_type
        return None
    
    def calculate_conviction(
        self,
        sentiment_score: float,
        congressional_signal: Optional[str] = None,
        event_type: Optional[PoliticalEventType] = None,
    ) -> ConvictionLevel:
        """Calculate conviction level based on multiple signals"""
        score = 0
        
        # Sentiment contributes up to 40 points
        score += abs(sentiment_score) * 40
        
        # Congressional signal contributes 30 points
        if congressional_signal:
            score += 30
        
        # Certain event types are higher conviction
        high_conviction_events = [
            PoliticalEventType.ELECTION,
            PoliticalEventType.COURT_RULING,
            PoliticalEventType.RESIGNATION,
        ]
        if event_type in high_conviction_events:
            score += 20
        
        # Map score to conviction level
        if score >= 80:
            return ConvictionLevel.EXTREME
        elif score >= 60:
            return ConvictionLevel.HIGH
        elif score >= 40:
            return ConvictionLevel.MEDIUM
        else:
            return ConvictionLevel.LOW
    
    def get_position_multiplier(self, conviction: ConvictionLevel) -> float:
        """Get position size multiplier based on conviction"""
        multipliers = {
            ConvictionLevel.EXTREME: 2.0,
            ConvictionLevel.HIGH: 1.5,
            ConvictionLevel.MEDIUM: 1.0,
            ConvictionLevel.LOW: 0.5,
        }
        return multipliers.get(conviction, 1.0)
    
    async def scan_markets_for_political_events(
        self,
        markets: List[Dict],
    ) -> List[PoliticalEvent]:
        """Scan markets to identify political events"""
        events = []
        
        for market in markets:
            if not self.is_political_market(market):
                continue
            
            question = market.get("question", "")
            event_type = self.classify_event_type(question)
            
            if event_type:
                event = PoliticalEvent(
                    event_type=event_type,
                    title=question[:100],
                    description=market.get("description", "")[:500],
                    scheduled_at=None,  # Would parse from market end time
                    related_market_ids=[market.get("id", "")],
                    source="market_scan",
                )
                events.append(event)
        
        return events
    
    async def get_congressional_signals(
        self,
        tickers: List[str],
    ) -> Dict[str, str]:
        """Get congressional trading signals for related tickers"""
        signals = {}
        
        if not self.db or not self.use_congressional_signal:
            return signals
        
        try:
            # Query recent congressional trades
            result = await self.db.from_("polybot_tracked_politicians").select(
                "*"
            ).execute()
            
            # This would need to be enhanced to correlate with actual trade data
            # For now, return empty signals
            pass
            
        except Exception as e:
            logger.warning(f"Failed to get congressional signals: {e}")
        
        return signals
    
    async def generate_signals(
        self,
        markets: List[Dict],
        news_sentiment: Optional[Dict[str, float]] = None,
    ) -> List[PoliticalSignal]:
        """Generate trading signals from political analysis"""
        signals = []
        
        if not self.enabled:
            return signals
        
        self.last_scan_at = datetime.now(timezone.utc)
        
        # Scan for political events
        events = await self.scan_markets_for_political_events(markets)
        self.active_events = events
        
        for event in events:
            # Get sentiment if available
            sentiment = 0.0
            if news_sentiment:
                # Check sentiment for related terms
                for keyword in self.political_keywords:
                    if keyword in event.title.lower():
                        sentiment = news_sentiment.get(keyword, 0.0)
                        break
            
            event.sentiment_score = sentiment
            
            # Get congressional signals
            congressional_signal = None
            if event.related_tickers:
                cong_signals = await self.get_congressional_signals(event.related_tickers)
                if cong_signals:
                    congressional_signal = list(cong_signals.values())[0]
            
            event.congressional_signal = congressional_signal
            
            # Calculate conviction
            conviction = self.calculate_conviction(
                sentiment,
                congressional_signal,
                event.event_type,
            )
            event.conviction_level = conviction
            
            # Only generate signal if meets minimum conviction
            if self._conviction_meets_minimum(conviction):
                # Determine direction based on sentiment
                direction = "buy" if sentiment >= 0 else "sell"
                
                # If congressional signal, use that direction
                if congressional_signal:
                    direction = congressional_signal.lower()
                
                position_mult = self.get_position_multiplier(conviction)
                
                signal = PoliticalSignal(
                    market_id=event.related_market_ids[0] if event.related_market_ids else "",
                    ticker="",  # Would need to map from market
                    direction=direction,
                    conviction=conviction,
                    reason=f"{event.event_type.value}: {event.title[:50]}",
                    event=event,
                    suggested_position_pct=position_mult,
                    max_position_usd=self.max_position_usd * Decimal(str(position_mult)),
                    urgency="normal",
                )
                
                signals.append(signal)
                
                # Callback
                if self.on_signal:
                    self.on_signal(signal)
        
        self.recent_signals = signals
        
        logger.info(
            f"Political event scan complete - "
            f"events={len(events)}, signals={len(signals)}"
        )
        
        return signals
    
    def _conviction_meets_minimum(self, conviction: ConvictionLevel) -> bool:
        """Check if conviction meets minimum threshold"""
        levels = [
            ConvictionLevel.LOW,
            ConvictionLevel.MEDIUM,
            ConvictionLevel.HIGH,
            ConvictionLevel.EXTREME,
        ]
        return levels.index(conviction) >= levels.index(self.min_conviction)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get strategy statistics"""
        return {
            "enabled": self.enabled,
            "min_conviction": self.min_conviction.value,
            "max_position_usd": float(self.max_position_usd),
            "active_events": len(self.active_events),
            "recent_signals": len(self.recent_signals),
            "last_scan_at": self.last_scan_at.isoformat() if self.last_scan_at else None,
            "use_congressional_signal": self.use_congressional_signal,
        }
