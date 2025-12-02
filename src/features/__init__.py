"""
PolyBot Advanced Features Module

This module contains advanced trading strategies and features:
- Copy Trading: Track and mirror top traders
- Overlapping Arbitrage: Find related markets with pricing inefficiencies
- Position Manager: Auto-claim resolved positions
- News/Sentiment: Monitor news for market-moving events
"""

from .copy_trading import CopyTradingEngine, TrackedTrader, CopySignal
from .overlapping_arb import OverlappingArbDetector, OverlapOpportunity
from .position_manager import PositionManager, Position, PortfolioSummary
from .news_sentiment import NewsSentimentEngine, MarketAlert, NewsItem

__all__ = [
    # Copy Trading
    "CopyTradingEngine",
    "TrackedTrader",
    "CopySignal",
    # Overlapping Arbitrage
    "OverlappingArbDetector",
    "OverlapOpportunity",
    # Position Manager
    "PositionManager",
    "Position",
    "PortfolioSummary",
    # News/Sentiment
    "NewsSentimentEngine",
    "MarketAlert",
    "NewsItem",
]
