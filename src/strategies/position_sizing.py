"""
Kelly Criterion Position Sizing Module

Academic Foundation:
- Kelly, J.L. (1956). "A New Interpretation of Information Rate." Bell System Technical Journal
- Thorp, E.O. (2006). "The Kelly Criterion in Blackjack, Sports Betting and the Stock Market."

This module provides optimal position sizing based on the Kelly Criterion,
which maximizes long-term geometric growth rate while managing risk.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class KellyResult:
    """Result of Kelly Criterion calculation."""
    full_kelly: float  # Optimal fraction (can be > 1)
    half_kelly: float  # Conservative fraction (0.5x Kelly)
    quarter_kelly: float  # Very conservative (0.25x Kelly)
    recommended: float  # Capped recommendation
    edge: float  # Expected edge
    variance: float  # Variance of returns
    confidence: float  # Confidence in the calculation


class KellyCriterion:
    """
    Kelly Criterion position sizing calculator.
    
    The Kelly formula determines the optimal fraction of capital to allocate:
    f* = (p * b - q) / b
    
    Where:
    - p = probability of winning
    - q = probability of losing (1 - p)
    - b = odds received on the win (net return)
    
    For continuous outcomes (like trading):
    f* = edge / variance
    """
    
    def __init__(
        self,
        max_position_pct: float = 25.0,  # Never risk more than 25%
        kelly_fraction: float = 0.5,  # Use half-Kelly by default
        min_edge: float = 0.01,  # Minimum 1% edge required
        min_confidence: float = 0.6,  # Minimum 60% confidence
    ):
        """
        Initialize Kelly Criterion calculator.
        
        Args:
            max_position_pct: Maximum position as % of portfolio (hard cap)
            kelly_fraction: Fraction of Kelly to use (0.5 = half-Kelly)
            min_edge: Minimum edge required to take a position
            min_confidence: Minimum confidence level required
        """
        self.max_position_pct = max_position_pct / 100.0
        self.kelly_fraction = kelly_fraction
        self.min_edge = min_edge
        self.min_confidence = min_confidence
    
    def calculate_binary(
        self,
        win_probability: float,
        win_return: float,
        loss_return: float,
        confidence: float = 1.0,
    ) -> KellyResult:
        """
        Calculate Kelly fraction for binary outcome (win/lose).
        
        Perfect for prediction markets where outcome is binary.
        
        Args:
            win_probability: Probability of winning (0-1)
            win_return: Return if win (e.g., 0.10 for 10% gain)
            loss_return: Return if loss (e.g., -0.05 for 5% loss, negative!)
            confidence: Confidence in probability estimate (0-1)
        
        Returns:
            KellyResult with recommended position sizing
        """
        # Validate inputs
        if not 0 < win_probability < 1:
            logger.warning(f"Invalid win_probability: {win_probability}")
            return self._zero_result()
        
        if win_return <= 0:
            logger.warning(f"Invalid win_return: {win_return}")
            return self._zero_result()
        
        if loss_return >= 0:
            logger.warning(f"loss_return should be negative: {loss_return}")
            loss_return = -abs(loss_return)
        
        # Calculate edge and variance
        p = win_probability
        q = 1 - p
        
        edge = p * win_return + q * loss_return
        variance = p * (win_return ** 2) + q * (loss_return ** 2)
        
        # Check minimum edge
        if edge < self.min_edge:
            logger.debug(f"Edge {edge:.4f} below minimum {self.min_edge}")
            return self._zero_result(edge=edge, variance=variance)
        
        # Check minimum confidence
        if confidence < self.min_confidence:
            logger.debug(f"Confidence {confidence:.2f} below minimum {self.min_confidence}")
            return self._zero_result(edge=edge, variance=variance)
        
        # Calculate Kelly fraction
        if variance == 0:
            return self._zero_result(edge=edge, variance=variance)
        
        full_kelly = edge / variance
        
        # Apply confidence adjustment
        adjusted_kelly = full_kelly * confidence
        
        # Calculate fractional Kelly values
        half_kelly = adjusted_kelly * 0.5
        quarter_kelly = adjusted_kelly * 0.25
        
        # Apply our fraction preference and cap
        recommended = min(
            adjusted_kelly * self.kelly_fraction,
            self.max_position_pct
        )
        
        # Never recommend negative positions
        recommended = max(recommended, 0)
        
        return KellyResult(
            full_kelly=full_kelly,
            half_kelly=half_kelly,
            quarter_kelly=quarter_kelly,
            recommended=recommended,
            edge=edge,
            variance=variance,
            confidence=confidence,
        )
    
    def calculate_continuous(
        self,
        expected_return: float,
        volatility: float,
        confidence: float = 1.0,
    ) -> KellyResult:
        """
        Calculate Kelly fraction for continuous returns.
        
        Used for strategies with variable outcomes (not binary).
        
        Args:
            expected_return: Expected return (e.g., 0.02 for 2%)
            volatility: Standard deviation of returns
            confidence: Confidence in estimates
        
        Returns:
            KellyResult with recommended position sizing
        """
        if volatility <= 0:
            logger.warning(f"Invalid volatility: {volatility}")
            return self._zero_result()
        
        edge = expected_return
        variance = volatility ** 2
        
        if edge < self.min_edge:
            return self._zero_result(edge=edge, variance=variance)
        
        if confidence < self.min_confidence:
            return self._zero_result(edge=edge, variance=variance)
        
        # Kelly for continuous: f* = μ / σ²
        full_kelly = edge / variance
        adjusted_kelly = full_kelly * confidence
        
        half_kelly = adjusted_kelly * 0.5
        quarter_kelly = adjusted_kelly * 0.25
        
        recommended = min(
            adjusted_kelly * self.kelly_fraction,
            self.max_position_pct
        )
        recommended = max(recommended, 0)
        
        return KellyResult(
            full_kelly=full_kelly,
            half_kelly=half_kelly,
            quarter_kelly=quarter_kelly,
            recommended=recommended,
            edge=edge,
            variance=variance,
            confidence=confidence,
        )
    
    def calculate_for_arbitrage(
        self,
        profit_percent: float,
        execution_success_rate: float = 0.85,
        slippage_pct: float = 0.5,
    ) -> KellyResult:
        """
        Calculate Kelly fraction specifically for arbitrage opportunities.
        
        Arbitrage has high win rate but execution risk.
        
        Args:
            profit_percent: Expected profit % (e.g., 3.0 for 3%)
            execution_success_rate: Probability of successful execution
            slippage_pct: Expected slippage %
        
        Returns:
            KellyResult with recommended position sizing
        """
        # Arbitrage parameters
        win_prob = execution_success_rate
        net_profit = (profit_percent - slippage_pct) / 100.0
        
        # Loss on failed execution (slippage + potential adverse movement)
        loss_on_fail = -(slippage_pct + 0.5) / 100.0
        
        return self.calculate_binary(
            win_probability=win_prob,
            win_return=net_profit,
            loss_return=loss_on_fail,
            confidence=min(execution_success_rate, 0.95),
        )
    
    def optimal_position_usd(
        self,
        portfolio_value: float,
        kelly_result: KellyResult,
        max_position_usd: Optional[float] = None,
    ) -> float:
        """
        Calculate optimal position size in USD.
        
        Args:
            portfolio_value: Total portfolio value in USD
            kelly_result: Result from Kelly calculation
            max_position_usd: Optional hard cap on position size
        
        Returns:
            Recommended position size in USD
        """
        position = portfolio_value * kelly_result.recommended
        
        if max_position_usd is not None:
            position = min(position, max_position_usd)
        
        return max(position, 0)
    
    def _zero_result(
        self,
        edge: float = 0.0,
        variance: float = 0.0,
    ) -> KellyResult:
        """Return a zero-position result."""
        return KellyResult(
            full_kelly=0.0,
            half_kelly=0.0,
            quarter_kelly=0.0,
            recommended=0.0,
            edge=edge,
            variance=variance,
            confidence=0.0,
        )


# Convenience function for quick calculations
def kelly_position_size(
    win_prob: float,
    win_return: float,
    loss_return: float,
    portfolio_value: float,
    max_position_pct: float = 25.0,
    kelly_fraction: float = 0.5,
) -> float:
    """
    Quick Kelly position size calculation.
    
    Args:
        win_prob: Probability of winning (0-1)
        win_return: Return if win (positive)
        loss_return: Return if loss (negative)
        portfolio_value: Total portfolio value
        max_position_pct: Maximum position as % of portfolio
        kelly_fraction: Fraction of Kelly to use
    
    Returns:
        Recommended position size in USD
    """
    calculator = KellyCriterion(
        max_position_pct=max_position_pct,
        kelly_fraction=kelly_fraction,
    )
    
    result = calculator.calculate_binary(
        win_probability=win_prob,
        win_return=win_return,
        loss_return=loss_return,
    )
    
    return calculator.optimal_position_usd(portfolio_value, result)


# Alias for backward compatibility
KellyPositionSizer = KellyCriterion


# Singleton instance for global access
_kelly_sizer_instance: Optional[KellyCriterion] = None


def get_kelly_sizer(
    max_position_pct: float = 25.0,
    kelly_fraction: float = 0.5,
    min_confidence: float = 0.6,
) -> KellyCriterion:
    """
    Get or create the global Kelly sizer instance.
    
    Args:
        max_position_pct: Maximum position as % of portfolio
        kelly_fraction: Fraction of Kelly to use (default: half-Kelly)
        min_confidence: Minimum confidence threshold
        
    Returns:
        KellyCriterion instance
    """
    global _kelly_sizer_instance
    if _kelly_sizer_instance is None:
        _kelly_sizer_instance = KellyCriterion(
            max_position_pct=max_position_pct,
            kelly_fraction=kelly_fraction,
            min_confidence=min_confidence,
        )
    return _kelly_sizer_instance


def reset_kelly_sizer():
    """Reset the global Kelly sizer instance."""
    global _kelly_sizer_instance
    _kelly_sizer_instance = None


# Example usage and testing
if __name__ == "__main__":
    # Test with prediction market arbitrage
    kelly = KellyCriterion()
    
    # Scenario: 95% win rate, 3% profit, 1% loss on failure
    result = kelly.calculate_binary(
        win_probability=0.95,
        win_return=0.03,
        loss_return=-0.01,
    )
    
    print(f"Full Kelly: {result.full_kelly:.2%}")
    print(f"Half Kelly: {result.half_kelly:.2%}")
    print(f"Recommended: {result.recommended:.2%}")
    print(f"Edge: {result.edge:.4f}")
    
    # For a $10,000 portfolio
    position = kelly.optimal_position_usd(10000, result)
    print(f"Position size: ${position:.2f}")
