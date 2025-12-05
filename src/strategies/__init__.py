"""
Strategies package for PolyBot

Contains profitable trading strategies:
- Market Making: Provide liquidity, earn spread + rewards (10-20% APR)
- News Arbitrage: Trade Polymarket/Kalshi lag during news events (5-30%/event)
- Funding Rate Arb: Delta-neutral funding collection (15-50% APY)
- Grid Trading: Profit from sideways price oscillation (20-60% APY)
- Pairs Trading: Statistical arbitrage on correlated assets (10-25% APY)
- Cross-Platform Arb: Exploit price differences across platforms
- Single-Platform Arb: Exploit price inefficiencies within platforms
"""

from .market_maker_v2 import (
    MarketMakerStrategy,
    MarketMakerStatus,
    Quote,
    Inventory,
    MarketMakerStats,
)

from .news_arbitrage import (
    NewsArbitrageStrategy,
    NewsEvent,
    NewsSource,
    NewsArbOpportunity,
    NewsArbStats,
)

from .funding_rate_arb import (
    FundingRateArbStrategy,
    FundingArbStatus,
    FundingPosition,
    FundingOpportunity,
    FundingArbStats,
)

from .grid_trading import (
    GridTradingStrategy,
    GridStatus,
    Grid,
    GridConfig,
    GridLevel,
    GridStats,
    GridType,
)

from .pairs_trading import (
    PairsTradingStrategy,
    PairsStatus,
    TradingPair,
    PairsPosition,
    PairsStats,
)

from .stock_mean_reversion import (
    StockMeanReversionStrategy,
    MeanReversionPosition,
    MeanReversionStats,
    StockSignal,
    SignalType,
)

from .stock_momentum import (
    StockMomentumStrategy,
    MomentumPosition,
    MomentumScore,
    MomentumStats,
    MomentumSignal,
)

# Keep old imports for backward compatibility
from .market_maker import MarketMaker, NewsArbitrageTracker

__all__ = [
    # Market Making (10-20% APR)
    "MarketMakerStrategy",
    "MarketMakerStatus",
    "Quote",
    "Inventory",
    "MarketMakerStats",
    # News Arbitrage (5-30% per event)
    "NewsArbitrageStrategy",
    "NewsEvent",
    "NewsSource",
    "NewsArbOpportunity",
    "NewsArbStats",
    # Funding Rate Arbitrage (15-50% APY)
    "FundingRateArbStrategy",
    "FundingArbStatus",
    "FundingPosition",
    "FundingOpportunity",
    "FundingArbStats",
    # Grid Trading (20-60% APY)
    "GridTradingStrategy",
    "GridStatus",
    "Grid",
    "GridConfig",
    "GridLevel",
    "GridStats",
    "GridType",
    # Pairs Trading (10-25% APY)
    "PairsTradingStrategy",
    "PairsStatus",
    "TradingPair",
    "PairsPosition",
    "PairsStats",
    # Stock Mean Reversion (15-30% APY) - NEW
    "StockMeanReversionStrategy",
    "MeanReversionPosition",
    "MeanReversionStats",
    "StockSignal",
    "SignalType",
    # Stock Momentum (20-40% APY) - NEW
    "StockMomentumStrategy",
    "MomentumPosition",
    "MomentumScore",
    "MomentumStats",
    "MomentumSignal",
    # Legacy (backward compatibility)
    "MarketMaker",
    "NewsArbitrageTracker",
]

