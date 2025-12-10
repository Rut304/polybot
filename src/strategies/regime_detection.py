"""
Market Regime Detection Module

Academic Foundation:
- Hamilton, J.D. (1989). "A New Approach to Economic Analysis of
  Nonstationary Time Series and the Business Cycle." Econometrica
- Ang & Bekaert (2002). "Regime Switches in Interest Rates."

This module detects market regimes to adapt strategy parameters dynamically.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import statistics

logger = logging.getLogger(__name__)


class MarketRegime(Enum):
    """Market regime classifications."""
    LOW_VOLATILITY = "low_volatility"
    NORMAL = "normal"
    HIGH_VOLATILITY = "high_volatility"
    CRISIS = "crisis"
    TRENDING_UP = "trending_up"
    TRENDING_DOWN = "trending_down"
    MEAN_REVERTING = "mean_reverting"


@dataclass
class RegimeConfig:
    """Configuration for a specific regime."""
    regime: MarketRegime
    position_size_multiplier: float
    stop_loss_multiplier: float
    enabled_strategies: List[str]
    disabled_strategies: List[str]
    scan_interval_multiplier: float = 1.0
    min_profit_multiplier: float = 1.0


@dataclass
class RegimeState:
    """Current regime state and history."""
    current_regime: MarketRegime
    confidence: float
    detected_at: datetime
    indicators: Dict[str, float] = field(default_factory=dict)
    previous_regime: Optional[MarketRegime] = None
    regime_duration_hours: float = 0.0


# Default regime configurations
DEFAULT_REGIME_CONFIGS: Dict[MarketRegime, RegimeConfig] = {
    MarketRegime.LOW_VOLATILITY: RegimeConfig(
        regime=MarketRegime.LOW_VOLATILITY,
        position_size_multiplier=1.2,  # Can size up in calm markets
        stop_loss_multiplier=0.8,  # Tighter stops OK
        enabled_strategies=[
            "grid_trading",
            "market_making",
            "pairs_trading",
            "single_platform_arb",
            "cross_platform_arb",
        ],
        disabled_strategies=[],
        scan_interval_multiplier=1.5,  # Can scan less frequently
        min_profit_multiplier=0.8,  # Accept smaller spreads
    ),
    MarketRegime.NORMAL: RegimeConfig(
        regime=MarketRegime.NORMAL,
        position_size_multiplier=1.0,
        stop_loss_multiplier=1.0,
        enabled_strategies=[
            "all"
        ],  # All strategies enabled
        disabled_strategies=[],
        scan_interval_multiplier=1.0,
        min_profit_multiplier=1.0,
    ),
    MarketRegime.HIGH_VOLATILITY: RegimeConfig(
        regime=MarketRegime.HIGH_VOLATILITY,
        position_size_multiplier=0.5,  # Reduce size
        stop_loss_multiplier=1.5,  # Wider stops needed
        enabled_strategies=[
            "momentum",
            "funding_rate_arb",
            "single_platform_arb",
        ],
        disabled_strategies=[
            "grid_trading",
            "market_making",
        ],
        scan_interval_multiplier=0.5,  # Scan more frequently
        min_profit_multiplier=1.5,  # Require larger spreads
    ),
    MarketRegime.CRISIS: RegimeConfig(
        regime=MarketRegime.CRISIS,
        position_size_multiplier=0.25,  # Minimal size
        stop_loss_multiplier=2.0,  # Very wide stops
        enabled_strategies=[
            "single_platform_arb",  # Only guaranteed profit
        ],
        disabled_strategies=[
            "grid_trading",
            "market_making",
            "pairs_trading",
            "momentum",
            "news_arbitrage",
        ],
        scan_interval_multiplier=0.25,  # Very frequent scanning
        min_profit_multiplier=2.0,  # Only take large edges
    ),
    MarketRegime.TRENDING_UP: RegimeConfig(
        regime=MarketRegime.TRENDING_UP,
        position_size_multiplier=1.0,
        stop_loss_multiplier=1.2,
        enabled_strategies=[
            "momentum",
            "funding_rate_arb",
            "stock_momentum",
        ],
        disabled_strategies=[
            "stock_mean_reversion",  # Don't fade the trend
        ],
        scan_interval_multiplier=0.8,
        min_profit_multiplier=1.0,
    ),
    MarketRegime.TRENDING_DOWN: RegimeConfig(
        regime=MarketRegime.TRENDING_DOWN,
        position_size_multiplier=0.7,
        stop_loss_multiplier=1.3,
        enabled_strategies=[
            "single_platform_arb",
            "cross_platform_arb",
        ],
        disabled_strategies=[
            "momentum",
            "grid_trading",
        ],
        scan_interval_multiplier=0.7,
        min_profit_multiplier=1.2,
    ),
    MarketRegime.MEAN_REVERTING: RegimeConfig(
        regime=MarketRegime.MEAN_REVERTING,
        position_size_multiplier=1.1,
        stop_loss_multiplier=1.0,
        enabled_strategies=[
            "pairs_trading",
            "stock_mean_reversion",
            "grid_trading",
        ],
        disabled_strategies=[
            "momentum",
        ],
        scan_interval_multiplier=1.0,
        min_profit_multiplier=0.9,
    ),
}


class RegimeDetector:
    """
    Detects market regime based on volatility and trend indicators.
    
    Uses multiple signals:
    - VIX level (if available)
    - ATR (Average True Range) percentage
    - ADX (Average Directional Index) for trend strength
    - Price vs moving averages
    - Correlation breakdown detection
    """
    
    def __init__(
        self,
        vix_low_threshold: float = 15.0,
        vix_high_threshold: float = 25.0,
        vix_crisis_threshold: float = 35.0,
        atr_low_threshold: float = 1.0,
        atr_high_threshold: float = 3.0,
        trend_strength_threshold: float = 25.0,
        lookback_periods: int = 20,
    ):
        """
        Initialize regime detector.
        
        Args:
            vix_low_threshold: VIX below this = low volatility
            vix_high_threshold: VIX above this = high volatility
            vix_crisis_threshold: VIX above this = crisis
            atr_low_threshold: ATR% below this = low volatility
            atr_high_threshold: ATR% above this = high volatility
            trend_strength_threshold: ADX above this = trending
            lookback_periods: Periods for calculations
        """
        self.vix_low = vix_low_threshold
        self.vix_high = vix_high_threshold
        self.vix_crisis = vix_crisis_threshold
        self.atr_low = atr_low_threshold
        self.atr_high = atr_high_threshold
        self.trend_threshold = trend_strength_threshold
        self.lookback = lookback_periods
        
        self._current_state: Optional[RegimeState] = None
        self._price_history: List[float] = []
        self._regime_history: List[RegimeState] = []
        
        # Config mapping
        self.regime_configs = DEFAULT_REGIME_CONFIGS.copy()
    
    def detect_regime(
        self,
        vix: Optional[float] = None,
        atr_percent: Optional[float] = None,
        adx: Optional[float] = None,
        price_vs_sma: Optional[float] = None,
        correlation_breakdown: bool = False,
        recent_prices: Optional[List[float]] = None,
    ) -> RegimeState:
        """
        Detect current market regime.
        
        Args:
            vix: Current VIX level (optional)
            atr_percent: ATR as percentage of price
            adx: Average Directional Index (trend strength)
            price_vs_sma: Price relative to SMA (e.g., 1.05 = 5% above)
            correlation_breakdown: Whether correlations have broken down
            recent_prices: Recent price data for calculation
        
        Returns:
            RegimeState with detected regime
        """
        # Calculate indicators from price data if provided
        if recent_prices and len(recent_prices) >= self.lookback:
            self._price_history = recent_prices[-100:]  # Keep last 100
            
            if atr_percent is None:
                atr_percent = self._calculate_atr_percent(recent_prices)
            
            if price_vs_sma is None:
                price_vs_sma = self._calculate_price_vs_sma(recent_prices)
        
        # Store indicators
        indicators = {
            "vix": vix,
            "atr_percent": atr_percent,
            "adx": adx,
            "price_vs_sma": price_vs_sma,
            "correlation_breakdown": float(correlation_breakdown),
        }
        
        # Determine regime
        regime, confidence = self._classify_regime(
            vix=vix,
            atr_percent=atr_percent,
            adx=adx,
            price_vs_sma=price_vs_sma,
            correlation_breakdown=correlation_breakdown,
        )
        
        # Calculate regime duration
        duration_hours = 0.0
        if self._current_state and self._current_state.current_regime == regime:
            duration_hours = (
                datetime.utcnow() - self._current_state.detected_at
            ).total_seconds() / 3600
        
        # Create new state
        previous_regime = (
            self._current_state.current_regime
            if self._current_state
            else None
        )
        
        state = RegimeState(
            current_regime=regime,
            confidence=confidence,
            detected_at=datetime.utcnow(),
            indicators=indicators,
            previous_regime=previous_regime,
            regime_duration_hours=duration_hours,
        )
        
        # Log regime change
        if previous_regime and previous_regime != regime:
            logger.info(
                f"🔄 Regime change: {previous_regime.value} → {regime.value} "
                f"(confidence: {confidence:.0%})"
            )
        
        self._current_state = state
        self._regime_history.append(state)
        
        # Keep history bounded
        if len(self._regime_history) > 1000:
            self._regime_history = self._regime_history[-500:]
        
        return state
    
    def _classify_regime(
        self,
        vix: Optional[float],
        atr_percent: Optional[float],
        adx: Optional[float],
        price_vs_sma: Optional[float],
        correlation_breakdown: bool,
    ) -> tuple:
        """Classify regime based on indicators."""
        confidence_scores: Dict[MarketRegime, float] = {}
        
        # Crisis detection (highest priority)
        if correlation_breakdown:
            confidence_scores[MarketRegime.CRISIS] = 0.9
        
        if vix is not None:
            if vix > self.vix_crisis:
                confidence_scores[MarketRegime.CRISIS] = max(
                    confidence_scores.get(MarketRegime.CRISIS, 0),
                    0.95
                )
            elif vix > self.vix_high:
                confidence_scores[MarketRegime.HIGH_VOLATILITY] = 0.85
            elif vix < self.vix_low:
                confidence_scores[MarketRegime.LOW_VOLATILITY] = 0.80
        
        # ATR-based classification
        if atr_percent is not None:
            if atr_percent > self.atr_high:
                confidence_scores[MarketRegime.HIGH_VOLATILITY] = max(
                    confidence_scores.get(MarketRegime.HIGH_VOLATILITY, 0),
                    0.75
                )
            elif atr_percent < self.atr_low:
                confidence_scores[MarketRegime.LOW_VOLATILITY] = max(
                    confidence_scores.get(MarketRegime.LOW_VOLATILITY, 0),
                    0.70
                )
        
        # Trend detection
        if adx is not None and adx > self.trend_threshold:
            if price_vs_sma is not None:
                if price_vs_sma > 1.02:  # 2% above SMA
                    confidence_scores[MarketRegime.TRENDING_UP] = 0.80
                elif price_vs_sma < 0.98:  # 2% below SMA
                    confidence_scores[MarketRegime.TRENDING_DOWN] = 0.80
        elif adx is not None and adx < 20:
            confidence_scores[MarketRegime.MEAN_REVERTING] = 0.70
        
        # Default to normal if no strong signals
        if not confidence_scores:
            return MarketRegime.NORMAL, 0.5
        
        # Return highest confidence regime
        best_regime = max(confidence_scores, key=confidence_scores.get)
        return best_regime, confidence_scores[best_regime]
    
    def _calculate_atr_percent(self, prices: List[float]) -> float:
        """Calculate ATR as percentage of current price."""
        if len(prices) < 2:
            return 0.0
        
        # Simple ATR approximation using price changes
        changes = [
            abs(prices[i] - prices[i-1])
            for i in range(1, len(prices))
        ]
        
        atr = statistics.mean(changes[-self.lookback:])
        current_price = prices[-1]
        
        if current_price == 0:
            return 0.0
        
        return (atr / current_price) * 100
    
    def _calculate_price_vs_sma(self, prices: List[float]) -> float:
        """Calculate price relative to SMA."""
        if len(prices) < self.lookback:
            return 1.0
        
        sma = statistics.mean(prices[-self.lookback:])
        current_price = prices[-1]
        
        if sma == 0:
            return 1.0
        
        return current_price / sma
    
    def get_config(self, regime: Optional[MarketRegime] = None) -> RegimeConfig:
        """Get configuration for a regime."""
        if regime is None:
            regime = self.current_regime
        
        return self.regime_configs.get(regime, self.regime_configs[MarketRegime.NORMAL])
    
    @property
    def current_regime(self) -> MarketRegime:
        """Get current detected regime."""
        if self._current_state:
            return self._current_state.current_regime
        return MarketRegime.NORMAL
    
    @property
    def current_state(self) -> Optional[RegimeState]:
        """Get current regime state."""
        return self._current_state
    
    def is_strategy_enabled(self, strategy_name: str) -> bool:
        """Check if a strategy is enabled in current regime."""
        config = self.get_config()
        
        # Check if explicitly disabled
        if strategy_name in config.disabled_strategies:
            return False
        
        # Check if "all" is enabled or strategy is explicitly enabled
        if "all" in config.enabled_strategies:
            return True
        
        return strategy_name in config.enabled_strategies
    
    def adjust_position_size(self, base_size: float) -> float:
        """Adjust position size for current regime."""
        config = self.get_config()
        return base_size * config.position_size_multiplier
    
    def adjust_stop_loss(self, base_stop_pct: float) -> float:
        """Adjust stop loss for current regime."""
        config = self.get_config()
        return base_stop_pct * config.stop_loss_multiplier
    
    def adjust_scan_interval(self, base_interval: float) -> float:
        """Adjust scan interval for current regime."""
        config = self.get_config()
        return base_interval * config.scan_interval_multiplier
    
    def adjust_min_profit(self, base_profit_pct: float) -> float:
        """Adjust minimum profit threshold for current regime."""
        config = self.get_config()
        return base_profit_pct * config.min_profit_multiplier
    
    def get_regime_config(self, regime: Optional[MarketRegime] = None) -> RegimeConfig:
        """Alias for get_config() - get config for current or specified regime."""
        return self.get_config(regime)
    
    def get_regime_history(self) -> List[RegimeState]:
        """Get history of regime states."""
        return self._regime_history.copy()


# Global instance for easy access
_detector: Optional[RegimeDetector] = None


def get_regime_detector() -> RegimeDetector:
    """Get or create global regime detector."""
    global _detector
    if _detector is None:
        _detector = RegimeDetector()
    return _detector


def current_regime() -> MarketRegime:
    """Get current market regime."""
    return get_regime_detector().current_regime


def is_strategy_enabled(strategy_name: str) -> bool:
    """Check if strategy is enabled in current regime."""
    return get_regime_detector().is_strategy_enabled(strategy_name)
