"""
Correlation-Based Position Limits

Academic Foundation:
- Markowitz (1952) - Modern Portfolio Theory
- Risk parity and correlation clustering research
- VAR models with correlation adjustment

Positions in correlated assets multiply risk exponentially.
This module tracks correlations and enforces position limits.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from collections import deque
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class CorrelationPair:
    """Correlation between two assets."""
    asset_a: str
    asset_b: str
    correlation: float  # -1 to 1
    sample_count: int
    last_updated: datetime
    
    @property
    def is_highly_correlated(self) -> bool:
        """Check if assets are highly correlated (>0.7)."""
        return abs(self.correlation) > 0.7
    
    @property
    def correlation_type(self) -> str:
        """Get correlation type description."""
        if self.correlation > 0.7:
            return "strong_positive"
        elif self.correlation > 0.3:
            return "moderate_positive"
        elif self.correlation > -0.3:
            return "uncorrelated"
        elif self.correlation > -0.7:
            return "moderate_negative"
        else:
            return "strong_negative"


@dataclass
class Position:
    """Current position in an asset."""
    symbol: str
    size: float
    value: float
    direction: str  # "long" or "short"
    entry_time: datetime


@dataclass
class CorrelationRiskAssessment:
    """Assessment of correlation risk in portfolio."""
    total_exposure: float
    effective_exposure: float  # Adjusted for correlations
    correlation_multiplier: float  # How much correlation amplifies risk
    
    highly_correlated_pairs: List[Tuple[str, str, float]]
    cluster_exposures: Dict[str, float]  # Per correlation cluster
    
    risk_level: str  # "low", "medium", "high", "critical"
    recommendations: List[str]
    
    max_new_position_pct: float  # Max allowed new position
    blocked_assets: List[str]  # Assets that would exceed limits


class CorrelationTracker:
    """
    Tracks correlations between assets and enforces position limits.
    
    Key concepts:
    1. Assets are grouped into correlation clusters
    2. Position limits apply at cluster level, not just asset level
    3. Highly correlated assets share a combined limit
    4. Negative correlations can offset risk
    """
    
    # Default correlation groups (crypto)
    DEFAULT_CRYPTO_CLUSTERS = {
        "btc_ecosystem": ["BTC", "WBTC", "BTCB"],
        "eth_ecosystem": ["ETH", "WETH", "STETH"],
        "layer1_alts": ["SOL", "ADA", "AVAX", "DOT"],
        "defi": ["UNI", "AAVE", "COMP", "MKR"],
        "stables": ["USDT", "USDC", "DAI", "FRAX"],
    }
    
    # Default prediction market clusters
    DEFAULT_PREDICTION_CLUSTERS = {
        "us_politics": ["trump", "biden", "republican", "democrat"],
        "fed_policy": ["rate", "fed", "fomc", "inflation"],
        "crypto_prices": ["bitcoin", "btc", "ethereum", "eth"],
        "elections": ["election", "vote", "win", "president"],
    }
    
    def __init__(
        self,
        max_cluster_exposure_pct: float = 30.0,
        max_correlated_exposure_pct: float = 50.0,
        high_correlation_threshold: float = 0.7,
        history_window: int = 100,
    ):
        """
        Initialize correlation tracker.
        
        Args:
            max_cluster_exposure_pct: Max exposure per cluster
            max_correlated_exposure_pct: Max combined correlated exposure
            high_correlation_threshold: Correlation level considered "high"
            history_window: Number of observations for correlation calc
        """
        self.max_cluster_pct = max_cluster_exposure_pct
        self.max_correlated_pct = max_correlated_exposure_pct
        self.high_corr_threshold = high_correlation_threshold
        self.history_window = history_window
        
        # Price history for correlation calculation
        self._price_history: Dict[str, deque] = {}
        
        # Calculated correlations
        self._correlations: Dict[Tuple[str, str], CorrelationPair] = {}
        
        # Manual cluster assignments
        self._clusters: Dict[str, Set[str]] = {}
        
        # Current positions
        self._positions: Dict[str, Position] = {}
    
    def add_price(
        self,
        symbol: str,
        price: float,
        timestamp: datetime,
    ):
        """
        Add price observation for correlation calculation.
        
        Args:
            symbol: Asset symbol
            price: Current price
            timestamp: Observation timestamp
        """
        symbol = symbol.upper()
        if symbol not in self._price_history:
            self._price_history[symbol] = deque(maxlen=self.history_window)
        
        self._price_history[symbol].append({
            "price": price,
            "timestamp": timestamp,
        })
    
    def add_position(self, position: Position):
        """
        Add or update a position.
        
        Args:
            position: Position to add/update
        """
        self._positions[position.symbol.upper()] = position
    
    def remove_position(self, symbol: str):
        """
        Remove a position.
        
        Args:
            symbol: Symbol to remove
        """
        symbol = symbol.upper()
        if symbol in self._positions:
            del self._positions[symbol]
    
    def set_cluster(self, cluster_name: str, symbols: List[str]):
        """
        Manually define a correlation cluster.
        
        Args:
            cluster_name: Name for the cluster
            symbols: List of symbols in the cluster
        """
        self._clusters[cluster_name] = set(s.upper() for s in symbols)
    
    def calculate_correlation(
        self,
        symbol_a: str,
        symbol_b: str,
    ) -> Optional[CorrelationPair]:
        """
        Calculate correlation between two assets.
        
        Args:
            symbol_a: First asset
            symbol_b: Second asset
        
        Returns:
            CorrelationPair if enough data available
        """
        symbol_a = symbol_a.upper()
        symbol_b = symbol_b.upper()
        
        if symbol_a not in self._price_history:
            return None
        if symbol_b not in self._price_history:
            return None
        
        history_a = list(self._price_history[symbol_a])
        history_b = list(self._price_history[symbol_b])
        
        if len(history_a) < 10 or len(history_b) < 10:
            return None
        
        # Align timestamps and calculate returns
        returns_a = self._calculate_returns(history_a)
        returns_b = self._calculate_returns(history_b)
        
        # Use minimum common length
        min_len = min(len(returns_a), len(returns_b))
        if min_len < 5:
            return None
        
        returns_a = returns_a[-min_len:]
        returns_b = returns_b[-min_len:]
        
        # Calculate Pearson correlation
        correlation = self._pearson_correlation(returns_a, returns_b)
        
        pair = CorrelationPair(
            asset_a=symbol_a,
            asset_b=symbol_b,
            correlation=correlation,
            sample_count=min_len,
            last_updated=datetime.utcnow(),
        )
        
        # Cache result
        key = tuple(sorted([symbol_a, symbol_b]))
        self._correlations[key] = pair
        
        return pair
    
    def get_correlation(
        self,
        symbol_a: str,
        symbol_b: str,
    ) -> Optional[float]:
        """
        Get cached or calculated correlation.
        
        Args:
            symbol_a: First asset
            symbol_b: Second asset
        
        Returns:
            Correlation coefficient or None
        """
        key = tuple(sorted([symbol_a.upper(), symbol_b.upper()]))
        
        if key in self._correlations:
            pair = self._correlations[key]
            # Refresh if stale (>1 hour old)
            if (datetime.utcnow() - pair.last_updated).seconds < 3600:
                return pair.correlation
        
        # Calculate fresh
        pair = self.calculate_correlation(symbol_a, symbol_b)
        return pair.correlation if pair else None
    
    def assess_portfolio_risk(
        self,
        portfolio_value: float,
    ) -> CorrelationRiskAssessment:
        """
        Assess correlation risk in current portfolio.
        
        Args:
            portfolio_value: Total portfolio value
        
        Returns:
            CorrelationRiskAssessment with analysis
        """
        if not self._positions:
            return CorrelationRiskAssessment(
                total_exposure=0,
                effective_exposure=0,
                correlation_multiplier=1.0,
                highly_correlated_pairs=[],
                cluster_exposures={},
                risk_level="low",
                recommendations=[],
                max_new_position_pct=self.max_cluster_pct,
                blocked_assets=[],
            )
        
        # Calculate total exposure
        total_exposure = sum(p.value for p in self._positions.values())
        
        # Find highly correlated pairs
        highly_correlated = []
        symbols = list(self._positions.keys())
        
        for i, sym_a in enumerate(symbols):
            for sym_b in symbols[i + 1:]:
                corr = self.get_correlation(sym_a, sym_b)
                if corr is not None and abs(corr) > self.high_corr_threshold:
                    highly_correlated.append((sym_a, sym_b, corr))
        
        # Calculate cluster exposures
        cluster_exposures = self._calculate_cluster_exposures()
        
        # Calculate effective exposure (correlation-adjusted)
        effective_exposure, correlation_multiplier = (
            self._calculate_effective_exposure(total_exposure, highly_correlated)
        )
        
        # Determine risk level
        exposure_pct = (effective_exposure / portfolio_value * 100
                        if portfolio_value > 0 else 0)
        
        if exposure_pct > 80:
            risk_level = "critical"
        elif exposure_pct > 60:
            risk_level = "high"
        elif exposure_pct > 40:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            highly_correlated,
            cluster_exposures,
            portfolio_value,
        )
        
        # Calculate allowed new position
        max_new_pct = max(0, self.max_cluster_pct - max(
            cluster_exposures.values(), default=0
        ))
        
        # Identify blocked assets
        blocked = self._identify_blocked_assets(
            cluster_exposures,
            portfolio_value,
        )
        
        return CorrelationRiskAssessment(
            total_exposure=total_exposure,
            effective_exposure=effective_exposure,
            correlation_multiplier=correlation_multiplier,
            highly_correlated_pairs=highly_correlated,
            cluster_exposures=cluster_exposures,
            risk_level=risk_level,
            recommendations=recommendations,
            max_new_position_pct=max_new_pct,
            blocked_assets=blocked,
        )
    
    def can_add_position(
        self,
        symbol: str,
        value: float,
        portfolio_value: float,
    ) -> Tuple[bool, str]:
        """
        Check if a new position can be added within limits.
        
        Args:
            symbol: Asset symbol
            value: Position value
            portfolio_value: Total portfolio value
        
        Returns:
            (allowed, reason)
        """
        symbol = symbol.upper()
        
        if portfolio_value <= 0:
            return False, "Invalid portfolio value"
        
        position_pct = value / portfolio_value * 100
        
        # Check single position limit
        if position_pct > self.max_cluster_pct:
            return False, f"Position exceeds {self.max_cluster_pct}% limit"
        
        # Find cluster for this asset
        asset_cluster = self._find_cluster(symbol)
        
        # Calculate current cluster exposure
        cluster_exposures = self._calculate_cluster_exposures()
        current_cluster_exposure = cluster_exposures.get(asset_cluster, 0)
        
        # Check cluster limit
        new_cluster_exposure = current_cluster_exposure + position_pct
        if new_cluster_exposure > self.max_cluster_pct:
            return False, (
                f"Would exceed cluster limit: "
                f"{new_cluster_exposure:.1f}% > {self.max_cluster_pct}%"
            )
        
        # Check highly correlated exposure
        correlated_exposure = self._get_correlated_exposure(symbol)
        new_correlated = correlated_exposure + position_pct
        
        if new_correlated > self.max_correlated_pct:
            return False, (
                f"Would exceed correlated limit: "
                f"{new_correlated:.1f}% > {self.max_correlated_pct}%"
            )
        
        return True, "Position allowed"
    
    def _calculate_returns(
        self,
        history: List[dict],
    ) -> List[float]:
        """Calculate returns from price history."""
        returns = []
        for i in range(1, len(history)):
            prev_price = history[i - 1]["price"]
            curr_price = history[i]["price"]
            if prev_price > 0:
                ret = (curr_price - prev_price) / prev_price
                returns.append(ret)
        return returns
    
    def _pearson_correlation(
        self,
        x: List[float],
        y: List[float],
    ) -> float:
        """Calculate Pearson correlation coefficient."""
        n = len(x)
        if n == 0:
            return 0.0
        
        mean_x = sum(x) / n
        mean_y = sum(y) / n
        
        numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        
        sum_sq_x = sum((xi - mean_x) ** 2 for xi in x)
        sum_sq_y = sum((yi - mean_y) ** 2 for yi in y)
        
        denominator = math.sqrt(sum_sq_x * sum_sq_y)
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    def _calculate_cluster_exposures(self) -> Dict[str, float]:
        """Calculate exposure per cluster."""
        exposures: Dict[str, float] = {}
        
        for symbol, position in self._positions.items():
            cluster = self._find_cluster(symbol)
            if cluster not in exposures:
                exposures[cluster] = 0
            exposures[cluster] += position.value
        
        return exposures
    
    def _find_cluster(self, symbol: str) -> str:
        """Find cluster for an asset."""
        symbol = symbol.upper()
        
        # Check manual clusters
        for cluster_name, symbols in self._clusters.items():
            if symbol in symbols:
                return cluster_name
        
        # Check default clusters
        for cluster_name, patterns in self.DEFAULT_CRYPTO_CLUSTERS.items():
            if symbol in [p.upper() for p in patterns]:
                return cluster_name
        
        for cluster_name, patterns in self.DEFAULT_PREDICTION_CLUSTERS.items():
            if any(p.lower() in symbol.lower() for p in patterns):
                return cluster_name
        
        return "unclustered"
    
    def _calculate_effective_exposure(
        self,
        total_exposure: float,
        highly_correlated: List[Tuple[str, str, float]],
    ) -> Tuple[float, float]:
        """Calculate correlation-adjusted effective exposure."""
        if not highly_correlated:
            return total_exposure, 1.0
        
        # Simple model: increase exposure for correlated positions
        correlation_penalty = 0
        for sym_a, sym_b, corr in highly_correlated:
            pos_a = self._positions.get(sym_a)
            pos_b = self._positions.get(sym_b)
            if pos_a and pos_b:
                # If same direction and positive correlation, add penalty
                same_direction = pos_a.direction == pos_b.direction
                if same_direction and corr > 0:
                    overlap = min(pos_a.value, pos_b.value)
                    correlation_penalty += overlap * corr
        
        effective_exposure = total_exposure + correlation_penalty
        multiplier = effective_exposure / total_exposure if total_exposure > 0 else 1
        
        return effective_exposure, multiplier
    
    def _get_correlated_exposure(self, symbol: str) -> float:
        """Get total exposure correlated with a symbol."""
        symbol = symbol.upper()
        exposure = 0
        
        for other_symbol, position in self._positions.items():
            if other_symbol == symbol:
                continue
            
            corr = self.get_correlation(symbol, other_symbol)
            if corr is not None and abs(corr) > self.high_corr_threshold:
                exposure += position.value
        
        return exposure
    
    def _generate_recommendations(
        self,
        highly_correlated: List[Tuple[str, str, float]],
        cluster_exposures: Dict[str, float],
        portfolio_value: float,
    ) -> List[str]:
        """Generate risk reduction recommendations."""
        recommendations = []
        
        if highly_correlated:
            pairs_str = ", ".join(
                f"{a}/{b}" for a, b, _ in highly_correlated[:3]
            )
            recommendations.append(
                f"Consider reducing correlated positions: {pairs_str}"
            )
        
        for cluster, exposure in cluster_exposures.items():
            pct = exposure / portfolio_value * 100 if portfolio_value > 0 else 0
            if pct > self.max_cluster_pct * 0.8:
                recommendations.append(
                    f"High exposure to {cluster} cluster: {pct:.1f}%"
                )
        
        if not recommendations:
            recommendations.append("Portfolio correlation risk is manageable")
        
        return recommendations
    
    def _identify_blocked_assets(
        self,
        cluster_exposures: Dict[str, float],
        portfolio_value: float,
    ) -> List[str]:
        """Identify assets that would exceed limits."""
        blocked = []
        
        for cluster, exposure in cluster_exposures.items():
            pct = exposure / portfolio_value * 100 if portfolio_value > 0 else 0
            if pct >= self.max_cluster_pct:
                # Block all assets in this cluster
                if cluster in self._clusters:
                    blocked.extend(self._clusters[cluster])
        
        return list(set(blocked))


# Global instance
_correlation_tracker: Optional[CorrelationTracker] = None


def get_correlation_tracker() -> CorrelationTracker:
    """Get or create global correlation tracker."""
    global _correlation_tracker
    if _correlation_tracker is None:
        _correlation_tracker = CorrelationTracker()
    return _correlation_tracker
