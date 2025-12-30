"""
Time Decay Analysis for Prediction Markets

Academic Foundation:
- Options pricing theory (theta decay)
- Prediction market microstructure research
- Berg, J., et al. (2008). "Prediction Market Accuracy in the Long Run."

Markets approaching resolution exhibit specific patterns that can be exploited.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from decimal import Decimal
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class TimeDecayAnalysis:
    """Result of time decay analysis."""
    market_id: str
    current_prob: float
    days_to_resolution: float
    hours_to_resolution: float

    # Decay factors
    time_decay_factor: float  # 0-1, higher = more decay pressure
    uncertainty_premium: float  # Premium for mid-probability
    convergence_speed: float  # Expected convergence rate

    # Signals
    sell_signal: bool  # Should sell mid-prob positions
    hold_signal: bool  # Should hold extreme positions
    avoid_entry: bool  # Should avoid new entries

    # Recommendations
    position_adjustment: float  # -1 (sell all) to +1 (hold/add)
    confidence: float


class TimeDecayAnalyzer:
    """
    Analyzes time decay patterns in prediction markets.

    Key insights:
    1. Mid-probability markets (40-60%) lose value as resolution approaches
    2. Extreme probability markets converge faster
    3. Most information arrives in final 20% of market duration
    4. Uncertainty premium decays non-linearly
    """

    def __init__(
        self,
        mid_prob_range: Tuple[float, float] = (0.35, 0.65),
        extreme_prob_threshold: float = 0.15,
        critical_days: int = 7,
        avoid_entry_hours: int = 48,
    ):
        """
        Initialize time decay analyzer.

        Args:
            mid_prob_range: Range considered "mid probability"
            extreme_prob_threshold: Below/above this is "extreme"
            critical_days: Days before resolution for critical zone
            avoid_entry_hours: Hours before resolution to avoid entry
        """
        self.mid_prob_low = mid_prob_range[0]
        self.mid_prob_high = mid_prob_range[1]
        self.extreme_threshold = extreme_prob_threshold
        self.critical_days = critical_days
        self.avoid_entry_hours = avoid_entry_hours

    def analyze(
        self,
        market_id: str,
        current_prob: float,
        resolution_time: datetime,
        market_created: Optional[datetime] = None,
    ) -> TimeDecayAnalysis:
        """
        Analyze time decay for a market.

        Args:
            market_id: Market identifier
            current_prob: Current probability (0-1)
            resolution_time: Expected resolution datetime
            market_created: When market was created (for duration calc)

        Returns:
            TimeDecayAnalysis with signals and recommendations
        """
        now = datetime.utcnow()
        time_remaining = resolution_time - now

        days_remaining = time_remaining.total_seconds() / 86400
        hours_remaining = time_remaining.total_seconds() / 3600

        # Handle expired markets
        if days_remaining <= 0:
            return TimeDecayAnalysis(
                market_id=market_id,
                current_prob=current_prob,
                days_to_resolution=0,
                hours_to_resolution=0,
                time_decay_factor=1.0,
                uncertainty_premium=0.0,
                convergence_speed=1.0,
                sell_signal=True,
                hold_signal=False,
                avoid_entry=True,
                position_adjustment=-1.0,
                confidence=0.9,
            )

        # Calculate time decay factor (exponential decay)
        # Higher near resolution
        if days_remaining > 30:
            time_decay_factor = 0.1
        else:
            time_decay_factor = 1.0 - math.exp(-1.0 / max(days_remaining, 0.1))

        # Calculate mid-probability penalty
        distance_from_extreme = 0.5 - abs(current_prob - 0.5)
        mid_prob_factor = distance_from_extreme * 2  # 0-1, highest at 50%

        # Uncertainty premium (decays as resolution approaches)
        uncertainty_premium = mid_prob_factor * (1 - time_decay_factor)

        # Convergence speed (faster near resolution)
        if days_remaining < self.critical_days:
            convergence_speed = 1.0 - (days_remaining / self.critical_days)
        else:
            convergence_speed = 0.1

        # Determine signals
        is_mid_prob = self.mid_prob_low <= current_prob <= self.mid_prob_high
        is_extreme = (
            current_prob < self.extreme_threshold or
            current_prob > (1 - self.extreme_threshold)
        )
        is_critical_period = days_remaining < self.critical_days

        # Sell signal: Mid-prob in critical period
        sell_signal = is_mid_prob and is_critical_period

        # Hold signal: Extreme prob with fundamentals
        hold_signal = is_extreme and not (hours_remaining < self.avoid_entry_hours)

        # Avoid entry: Too close to resolution
        avoid_entry = hours_remaining < self.avoid_entry_hours

        # Calculate position adjustment
        position_adjustment = self._calculate_position_adjustment(
            is_mid_prob=is_mid_prob,
            is_extreme=is_extreme,
            time_decay_factor=time_decay_factor,
            days_remaining=days_remaining,
        )

        # Calculate confidence
        confidence = self._calculate_confidence(
            days_remaining=days_remaining,
            is_extreme=is_extreme,
        )

        return TimeDecayAnalysis(
            market_id=market_id,
            current_prob=current_prob,
            days_to_resolution=days_remaining,
            hours_to_resolution=hours_remaining,
            time_decay_factor=time_decay_factor,
            uncertainty_premium=uncertainty_premium,
            convergence_speed=convergence_speed,
            sell_signal=sell_signal,
            hold_signal=hold_signal,
            avoid_entry=avoid_entry,
            position_adjustment=position_adjustment,
            confidence=confidence,
        )

    def _calculate_position_adjustment(
        self,
        is_mid_prob: bool,
        is_extreme: bool,
        time_decay_factor: float,
        days_remaining: float,
    ) -> float:
        """Calculate recommended position adjustment."""
        if days_remaining < 1:
            # Very close to resolution
            if is_extreme:
                return 0.5  # Hold half
            else:
                return -1.0  # Exit

        if is_mid_prob and time_decay_factor > 0.5:
            # Mid-prob with high decay - reduce
            return -0.5 - (time_decay_factor * 0.5)

        if is_extreme:
            # Extreme prob - can hold
            return 0.5

        # Default: slight reduction as time passes
        return -time_decay_factor * 0.3

    def _calculate_confidence(
        self,
        days_remaining: float,
        is_extreme: bool,
    ) -> float:
        """Calculate confidence in the analysis."""
        # Higher confidence closer to resolution
        time_confidence = min(1.0, 1.0 - (days_remaining / 30))

        # Higher confidence for extreme probabilities
        extreme_boost = 0.1 if is_extreme else 0.0

        return min(0.95, 0.6 + time_confidence * 0.3 + extreme_boost)

    def should_exit_position(
        self,
        current_prob: float,
        entry_prob: float,
        days_to_resolution: float,
        profit_pct: float,
    ) -> Tuple[bool, str]:
        """
        Determine if should exit an existing position.

        Args:
            current_prob: Current market probability
            entry_prob: Probability when position was entered
            days_to_resolution: Days until resolution
            profit_pct: Current profit percentage

        Returns:
            (should_exit, reason)
        """
        # Always exit if profitable and close to resolution
        if profit_pct > 5.0 and days_to_resolution < 3:
            return True, "Take profit near resolution"

        # Exit mid-prob positions in critical period
        is_mid_prob = self.mid_prob_low <= current_prob <= self.mid_prob_high
        if is_mid_prob and days_to_resolution < self.critical_days:
            return True, "Mid-probability in critical period"

        # Exit if probability moved significantly against us
        prob_change = abs(current_prob - entry_prob)
        if prob_change > 0.2 and profit_pct < -5.0:
            return True, "Adverse probability movement"

        return False, ""


@dataclass
class CorrelationOpportunity:
    """Cross-market correlation arbitrage opportunity."""
    event_a_id: str
    event_b_id: str
    event_a_name: str
    event_b_name: str
    relationship: str  # "subset", "mutually_exclusive", "correlated"

    event_a_prob: float
    event_b_prob: float

    expected_relationship_value: float  # What the math says
    actual_relationship_value: float  # What market says

    edge_pct: float
    action: str  # What to do
    confidence: float


class CorrelationArbDetector:
    """
    Detects arbitrage in correlated prediction markets.

    Key relationships:
    - A implies B: P(A) <= P(B)
    - Mutually exclusive: P(A) + P(B) <= 1
    - Exhaustive: P(A) + P(B) >= 1
    - Correlated events: Track spread
    """

    def __init__(
        self,
        min_edge_pct: float = 3.0,
        min_confidence: float = 0.7,
    ):
        """
        Initialize correlation arbitrage detector.

        Args:
            min_edge_pct: Minimum edge to flag opportunity
            min_confidence: Minimum confidence in relationship
        """
        self.min_edge = min_edge_pct / 100.0
        self.min_confidence = min_confidence

        # Known relationships (can be expanded)
        self._relationships: List[dict] = []

    def add_relationship(
        self,
        event_a_pattern: str,
        event_b_pattern: str,
        relationship: str,
        confidence: float = 0.9,
    ):
        """
        Add a known relationship between events.

        Args:
            event_a_pattern: Pattern to match event A
            event_b_pattern: Pattern to match event B
            relationship: Type of relationship
            confidence: Confidence in this relationship
        """
        self._relationships.append({
            "a_pattern": event_a_pattern.lower(),
            "b_pattern": event_b_pattern.lower(),
            "relationship": relationship,
            "confidence": confidence,
        })

    def check_subset_relationship(
        self,
        event_a_id: str,
        event_a_name: str,
        event_a_prob: float,
        event_b_id: str,
        event_b_name: str,
        event_b_prob: float,
    ) -> Optional[CorrelationOpportunity]:
        """
        Check if A implies B but P(A) > P(B).

        Example: "Trump wins 2028" implies "Republican wins 2028"
        So P(Trump) should always be <= P(Republican)
        """
        # A implies B: P(A) should be <= P(B)
        if event_a_prob > event_b_prob + self.min_edge:
            edge = event_a_prob - event_b_prob
            return CorrelationOpportunity(
                event_a_id=event_a_id,
                event_b_id=event_b_id,
                event_a_name=event_a_name,
                event_b_name=event_b_name,
                relationship="subset",
                event_a_prob=event_a_prob,
                event_b_prob=event_b_prob,
                expected_relationship_value=event_b_prob,
                actual_relationship_value=event_a_prob,
                edge_pct=edge * 100,
                action="sell_a_buy_b",
                confidence=0.85,
            )

        return None

    def check_mutually_exclusive(
        self,
        event_a_id: str,
        event_a_name: str,
        event_a_prob: float,
        event_b_id: str,
        event_b_name: str,
        event_b_prob: float,
    ) -> Optional[CorrelationOpportunity]:
        """
        Check if A and B are mutually exclusive but P(A) + P(B) > 1.

        Example: "Fed raises rates Dec" and "Fed cuts rates Dec"
        Cannot both happen, so sum should be <= 100%
        """
        total = event_a_prob + event_b_prob

        if total > 1.0 + self.min_edge:
            edge = total - 1.0
            return CorrelationOpportunity(
                event_a_id=event_a_id,
                event_b_id=event_b_id,
                event_a_name=event_a_name,
                event_b_name=event_b_name,
                relationship="mutually_exclusive",
                event_a_prob=event_a_prob,
                event_b_prob=event_b_prob,
                expected_relationship_value=1.0,
                actual_relationship_value=total,
                edge_pct=edge * 100,
                action="sell_both",
                confidence=0.90,
            )

        return None

    def check_exhaustive(
        self,
        event_a_id: str,
        event_a_name: str,
        event_a_prob: float,
        event_b_id: str,
        event_b_name: str,
        event_b_prob: float,
    ) -> Optional[CorrelationOpportunity]:
        """
        Check if A and B are exhaustive but P(A) + P(B) < 1.

        Example: "BTC > $100k EOY" and "BTC <= $100k EOY"
        One must happen, so sum should be = 100%
        """
        total = event_a_prob + event_b_prob

        if total < 1.0 - self.min_edge:
            edge = 1.0 - total
            return CorrelationOpportunity(
                event_a_id=event_a_id,
                event_b_id=event_b_id,
                event_a_name=event_a_name,
                event_b_name=event_b_name,
                relationship="exhaustive",
                event_a_prob=event_a_prob,
                event_b_prob=event_b_prob,
                expected_relationship_value=1.0,
                actual_relationship_value=total,
                edge_pct=edge * 100,
                action="buy_both",
                confidence=0.90,
            )

        return None


# Global instance
_time_decay_analyzer: Optional[TimeDecayAnalyzer] = None


def get_time_decay_analyzer() -> TimeDecayAnalyzer:
    """Get or create global time decay analyzer."""
    global _time_decay_analyzer
    if _time_decay_analyzer is None:
        _time_decay_analyzer = TimeDecayAnalyzer()
    return _time_decay_analyzer
