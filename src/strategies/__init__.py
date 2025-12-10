"""
Strategies package for PolyBot

Contains profitable trading strategies:

PREDICTION MARKETS:
- Market Making: Provide liquidity, earn spread + rewards (10-20% APR)
- News Arbitrage: Trade Polymarket/Kalshi lag during news events (5-30%/event)

CRYPTO STRATEGIES:
- Funding Rate Arb: Delta-neutral funding collection (15-50% APY)
- Grid Trading: Profit from sideways price oscillation (20-60% APY)
- Pairs Trading: Statistical arbitrage on correlated assets (10-25% APY)

STOCK STRATEGIES:
- Stock Mean Reversion: Buy oversold, sell overbought stocks (15-30% APY)
- Stock Momentum: Ride trending stocks (20-40% APY)
- Sector Rotation: Rotate into strongest sectors (15-25% APY)
- Dividend Growth: Income from quality dividend growers (8-12% APY)
- Earnings Momentum: Trade around earnings events (15-30% APY)

OPTIONS STRATEGIES:
- Covered Calls: Generate income on long positions (10-20% APY)
- Cash-Secured Puts: Acquire stocks at discount (15-30% APY)
- Iron Condor: Range-bound premium collection (20-40% APY)
- Wheel Strategy: Systematic income generation (20-35% APY)
- Vertical Spreads: Defined-risk directional trades
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

# NEW: Sector Rotation Strategy
from .sector_rotation import (
    SectorRotationStrategy,
    SectorStrength,
    SectorPosition,
    RotationStats,
    RotationSignal,
    SECTOR_ETFS,
    SECTOR_ROTATION_INFO,
)

# NEW: Dividend Growth Strategy
from .dividend_growth import (
    DividendGrowthStrategy,
    DividendStock,
    DividendPosition,
    DividendStats,
    DividendQuality,
    DIVIDEND_ARISTOCRATS,
    DIVIDEND_STRATEGY_INFO,
)

# NEW: Earnings Momentum Strategy
from .earnings_momentum import (
    EarningsMomentumStrategy,
    EarningsEvent,
    EarningsPosition,
    EarningsStats,
    EarningsSurprise,
    EarningsStrategy,
    EARNINGS_STRATEGY_INFO,
)

# NEW: Options Strategies
from .options_strategies import (
    CoveredCallStrategy,
    CashSecuredPutStrategy,
    IronCondorStrategy,
    WheelStrategy,
    VerticalSpreadStrategy,
    OptionContract,
    OptionPosition,
    OptionsStrategyStats,
    OptionType,
    OptionStrategy,
    WheelPhase,
    create_options_strategy,
    OPTIONS_STRATEGY_INFO,
)

# ============================================
# ADVANCED FRAMEWORK MODULES (Phase 1)
# ============================================

# Position Sizing - Kelly Criterion
from .position_sizing import (
    KellyCriterion,
    KellyPositionSizer,  # Alias for backward compatibility
    KellyResult,
    get_kelly_sizer,
)

# Market Regime Detection
from .regime_detection import (
    RegimeDetector,
    MarketRegime,
    RegimeState,
    RegimeConfig,
    get_regime_detector,
)

# Circuit Breaker System
from .circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerState,
    CircuitBreakerStatus,
    DrawdownLevel,
    get_circuit_breaker,
    DailyLossCircuitBreaker,
)

# ============================================
# STRATEGY ENHANCEMENT MODULES (Phase 2)
# ============================================

# Time Decay Analysis (Prediction Markets)
from .time_decay import (
    TimeDecayAnalyzer,
    TimeDecayAnalysis,
    CorrelationArbDetector,
    CorrelationOpportunity,
    get_time_decay_analyzer,
)

# Order Flow Imbalance
from .order_flow import (
    OrderFlowAnalyzer,
    OrderBookSnapshot,
    OrderBookLevel,
    OFIResult,
    OFISignal,
    TradeFlowAnalyzer,
    TradeFlowAnalysis,
    get_order_flow_analyzer,
    get_trade_flow_analyzer,
)

# Stablecoin Depeg Detection
from .depeg_detection import (
    DepegDetector,
    DepegAlert,
    DepegSeverity,
    DepegDirection,
    DepegTradingOpportunity,
    StablecoinPrice,
    get_depeg_detector,
)

# Correlation-Based Position Limits
from .correlation_limits import (
    CorrelationTracker,
    CorrelationPair,
    CorrelationRiskAssessment,
    Position,
    get_correlation_tracker,
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
    # Stock Mean Reversion (15-30% APY)
    "StockMeanReversionStrategy",
    "MeanReversionPosition",
    "MeanReversionStats",
    "StockSignal",
    "SignalType",
    # Stock Momentum (20-40% APY)
    "StockMomentumStrategy",
    "MomentumPosition",
    "MomentumScore",
    "MomentumStats",
    "MomentumSignal",
    # Sector Rotation (15-25% APY) - NEW
    "SectorRotationStrategy",
    "SectorStrength",
    "SectorPosition",
    "RotationStats",
    "RotationSignal",
    "SECTOR_ETFS",
    "SECTOR_ROTATION_INFO",
    # Dividend Growth (8-12% APY) - NEW
    "DividendGrowthStrategy",
    "DividendStock",
    "DividendPosition",
    "DividendStats",
    "DividendQuality",
    "DIVIDEND_ARISTOCRATS",
    "DIVIDEND_STRATEGY_INFO",
    # Earnings Momentum (15-30% APY) - NEW
    "EarningsMomentumStrategy",
    "EarningsEvent",
    "EarningsPosition",
    "EarningsStats",
    "EarningsSurprise",
    "EarningsStrategy",
    "EARNINGS_STRATEGY_INFO",
    # Options Strategies (10-40% APY) - NEW
    "CoveredCallStrategy",
    "CashSecuredPutStrategy",
    "IronCondorStrategy",
    "WheelStrategy",
    "VerticalSpreadStrategy",
    "OptionContract",
    "OptionPosition",
    "OptionsStrategyStats",
    "OptionType",
    "OptionStrategy",
    "WheelPhase",
    "create_options_strategy",
    "OPTIONS_STRATEGY_INFO",
    # ========================================
    # ADVANCED FRAMEWORK (Phase 1)
    # ========================================
    # Position Sizing - Kelly Criterion
    "KellyCriterion",
    "KellyPositionSizer",  # Alias
    "KellyResult",
    "get_kelly_sizer",
    # Market Regime Detection
    "RegimeDetector",
    "MarketRegime",
    "RegimeState",
    "RegimeConfig",
    "get_regime_detector",
    # Circuit Breaker System
    "CircuitBreaker",
    "CircuitBreakerState",
    "CircuitBreakerStatus",
    "DrawdownLevel",
    "DailyLossCircuitBreaker",
    "get_circuit_breaker",
    # ========================================
    # STRATEGY ENHANCEMENTS (Phase 2)
    # ========================================
    # Time Decay Analysis
    "TimeDecayAnalyzer",
    "TimeDecayAnalysis",
    "CorrelationArbDetector",
    "CorrelationOpportunity",
    "get_time_decay_analyzer",
    # Order Flow Imbalance
    "OrderFlowAnalyzer",
    "OrderBookSnapshot",
    "OrderBookLevel",
    "OFIResult",
    "OFISignal",
    "TradeFlowAnalyzer",
    "TradeFlowAnalysis",
    "get_order_flow_analyzer",
    "get_trade_flow_analyzer",
    # Stablecoin Depeg Detection
    "DepegDetector",
    "DepegAlert",
    "DepegSeverity",
    "DepegDirection",
    "DepegTradingOpportunity",
    "StablecoinPrice",
    "get_depeg_detector",
    # Correlation Position Limits
    "CorrelationTracker",
    "CorrelationPair",
    "CorrelationRiskAssessment",
    "Position",
    "get_correlation_tracker",
    # Legacy (backward compatibility)
    "MarketMaker",
    "NewsArbitrageTracker",
]

