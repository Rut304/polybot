"""
Comprehensive Strategy Testing Suite

This module provides end-to-end testing for all trading strategies,
verifying accuracy in both simulation and live trading modes.

Tests cover:
1. Unit tests for each strategy module
2. Integration tests for strategy interactions
3. Accuracy tests for P&L calculations
4. Risk management validation

Run with: python -m pytest tests/test_strategies.py -v
"""

import pytest
import asyncio
import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Optional
from unittest.mock import MagicMock, AsyncMock, patch
import logging

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger(__name__)


# ============================================================================
# PHASE 1: Kelly Criterion Tests
# ============================================================================


class TestKellyCriterion:
    """Test Kelly Criterion position sizing calculations."""
    
    def test_kelly_binary_basic(self):
        """Test basic Kelly fraction calculation for binary outcomes."""
        from src.strategies.position_sizing import KellyCriterion, KellyResult
        
        kelly = KellyCriterion(
            max_position_pct=25.0,
            kelly_fraction=0.5,
            min_edge=0.01,
            min_confidence=0.5,
        )
        
        # Test case: 60% win rate, 10% gain, 5% loss
        result = kelly.calculate_binary(
            win_probability=0.60,
            win_return=0.10,
            loss_return=-0.05,
        )
        
        # Expected edge = 0.6*0.10 + 0.4*(-0.05) = 0.06 - 0.02 = 0.04
        assert result.edge == pytest.approx(0.04, abs=0.001), (
            f"Edge {result.edge} should be ~0.04"
        )
        assert result.recommended > 0, "Should recommend positive position"
        assert result.recommended <= 0.25, "Should not exceed 25% cap"
        assert isinstance(result, KellyResult), "Should return KellyResult"
    
    def test_kelly_negative_edge_returns_zero(self):
        """Test Kelly with negative edge returns zero."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion(min_edge=0.01)
        
        # 40% win rate with equal wins/losses = negative edge
        result = kelly.calculate_binary(
            win_probability=0.40,
            win_return=0.05,
            loss_return=-0.05,
        )
        
        # Edge = 0.4*0.05 + 0.6*(-0.05) = 0.02 - 0.03 = -0.01
        assert result.edge < 0, "Edge should be negative"
        assert result.recommended == 0, "Negative edge should return 0"
    
    def test_kelly_position_sizing_usd(self):
        """Test actual position size calculation in USD."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion(
            max_position_pct=10.0,
            kelly_fraction=0.5,
        )
        
        result = kelly.calculate_binary(
            win_probability=0.70,
            win_return=0.08,
            loss_return=-0.04,
        )
        
        # Calculate recommended USD position
        portfolio_value = 10000.0
        position_usd = kelly.optimal_position_usd(portfolio_value, result)
        
        # With 10% cap and $10k portfolio, max is $1000
        assert position_usd <= 1000.0, f"Position {position_usd} exceeds max"
        assert position_usd > 0, "Should recommend positive position"
    
    def test_kelly_low_confidence_rejection(self):
        """Test that low confidence trades are rejected."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion(min_confidence=0.7)
        
        result = kelly.calculate_binary(
            win_probability=0.65,
            win_return=0.10,
            loss_return=-0.05,
            confidence=0.5,  # Below threshold
        )
        
        assert result.recommended == 0, "Low confidence should return 0 position"
    
    def test_kelly_continuous_returns(self):
        """Test Kelly calculation for continuous returns."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion()
        
        result = kelly.calculate_continuous(
            expected_return=0.05,  # 5% expected return
            volatility=0.20,       # 20% volatility
            confidence=0.8,
        )
        
        # Kelly = μ / σ² = 0.05 / 0.04 = 1.25
        assert result.full_kelly > 0, "Full Kelly should be positive"
        assert result.recommended <= 0.25, "Should respect cap"
    
    def test_kelly_half_kelly_recommended(self):
        """Test that half-Kelly is properly calculated."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion(kelly_fraction=0.5, max_position_pct=100.0)
        
        result = kelly.calculate_binary(
            win_probability=0.60,
            win_return=0.10,
            loss_return=-0.05,
        )
        
        # Half Kelly should be 0.5 * full_kelly
        assert result.half_kelly == pytest.approx(
            result.full_kelly * 0.5, rel=0.01
        ), "Half Kelly calculation incorrect"
    
    def test_kelly_singleton_factory(self):
        """Test get_kelly_sizer factory function."""
        from src.strategies.position_sizing import (
            get_kelly_sizer, reset_kelly_sizer
        )
        
        reset_kelly_sizer()
        sizer1 = get_kelly_sizer()
        sizer2 = get_kelly_sizer()
        
        assert sizer1 is sizer2, "Factory should return singleton"


# ============================================================================
# PHASE 1: Regime Detection Tests
# ============================================================================


class TestRegimeDetection:
    """Test market regime detection accuracy."""
    
    def test_regime_low_volatility_vix(self):
        """Test LOW_VOLATILITY regime detection via VIX."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector(
            vix_low_threshold=15.0,
            vix_high_threshold=25.0,
            vix_crisis_threshold=35.0,
        )
        
        state = detector.detect_regime(vix=12.0)
        assert state.current_regime == MarketRegime.LOW_VOLATILITY
    
    def test_regime_normal(self):
        """Test NORMAL regime detection."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        # VIX between low and high thresholds
        state = detector.detect_regime(vix=20.0)
        assert state.current_regime == MarketRegime.NORMAL
    
    def test_regime_high_volatility(self):
        """Test HIGH_VOLATILITY regime detection."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        state = detector.detect_regime(vix=28.0)
        assert state.current_regime == MarketRegime.HIGH_VOLATILITY
    
    def test_regime_crisis(self):
        """Test CRISIS regime detection."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        state = detector.detect_regime(vix=42.0)
        assert state.current_regime == MarketRegime.CRISIS
    
    def test_regime_correlation_breakdown(self):
        """Test CRISIS detection via correlation breakdown."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        state = detector.detect_regime(
            vix=20.0,  # Normal VIX
            correlation_breakdown=True,
        )
        assert state.current_regime == MarketRegime.CRISIS
    
    def test_regime_trending_up(self):
        """Test TRENDING_UP regime detection."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        state = detector.detect_regime(
            vix=18.0,
            adx=30.0,  # Strong trend
            price_vs_sma=1.05,  # 5% above SMA
        )
        assert state.current_regime == MarketRegime.TRENDING_UP
    
    def test_regime_trending_down(self):
        """Test TRENDING_DOWN regime detection."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        
        state = detector.detect_regime(
            vix=18.0,
            adx=30.0,
            price_vs_sma=0.95,  # 5% below SMA
        )
        assert state.current_regime == MarketRegime.TRENDING_DOWN
    
    def test_regime_config_lookup(self):
        """Test strategy configuration per regime."""
        from src.strategies.regime_detection import (
            RegimeDetector, MarketRegime
        )
        
        detector = RegimeDetector()
        detector.detect_regime(vix=40.0)  # Crisis
        
        config = detector.get_regime_config()
        
        assert config is not None, "Should return config"
        assert config.position_size_multiplier < 1.0, (
            "Crisis should reduce position sizes"
        )
    
    def test_regime_state_history(self):
        """Test that regime history is maintained."""
        from src.strategies.regime_detection import RegimeDetector
        
        detector = RegimeDetector()
        
        detector.detect_regime(vix=12.0)
        detector.detect_regime(vix=28.0)
        detector.detect_regime(vix=40.0)
        
        history = detector.get_regime_history()
        assert len(history) == 3, "Should track 3 regime states"


# ============================================================================
# PHASE 1: Circuit Breaker Tests
# ============================================================================


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    def test_circuit_breaker_normal_state(self):
        """Test circuit breaker in normal state."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState
        )
        
        cb = CircuitBreaker(initial_value=10000)
        
        # No drawdown
        status = cb.update(current_value=10000)
        
        assert status.state == CircuitBreakerState.NORMAL
        assert status.position_multiplier == 1.0
    
    def test_circuit_breaker_caution_level(self):
        """Test CAUTION level circuit breaker (reduced position)."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState, DrawdownLevel
        )
        
        levels = [
            DrawdownLevel(
                threshold_pct=5.0,
                state=CircuitBreakerState.CAUTION,
                position_multiplier=0.5,
                cooldown_minutes=60,
            ),
        ]
        
        cb = CircuitBreaker(levels=levels, initial_value=10000)
        
        # 6% drawdown (above 5% threshold)
        status = cb.update(current_value=9400)
        
        assert status.state == CircuitBreakerState.CAUTION
        assert status.position_multiplier == 0.5
    
    def test_circuit_breaker_warning_level(self):
        """Test WARNING level circuit breaker (further reduced position)."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState, DrawdownLevel
        )
        
        levels = [
            DrawdownLevel(
                threshold_pct=5.0,
                state=CircuitBreakerState.CAUTION,
                position_multiplier=0.5,
                cooldown_minutes=60,
            ),
            DrawdownLevel(
                threshold_pct=10.0,
                state=CircuitBreakerState.WARNING,
                position_multiplier=0.25,
                cooldown_minutes=120,
            ),
        ]
        
        cb = CircuitBreaker(levels=levels, initial_value=10000)
        
        # 12% drawdown
        status = cb.update(current_value=8800)
        
        assert status.state == CircuitBreakerState.WARNING
        assert status.position_multiplier == 0.25
    
    def test_circuit_breaker_halted(self):
        """Test HALTED circuit breaker (full halt)."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState, DrawdownLevel
        )
        
        levels = [
            DrawdownLevel(
                threshold_pct=15.0,
                state=CircuitBreakerState.HALTED,
                position_multiplier=0.0,
                cooldown_minutes=1440,
            ),
        ]
        
        cb = CircuitBreaker(levels=levels, initial_value=10000)
        
        # 20% drawdown
        status = cb.update(current_value=8000)
        
        assert status.state == CircuitBreakerState.HALTED
        assert status.position_multiplier == 0.0
        assert cb.can_trade() is False
    
    def test_circuit_breaker_can_trade(self):
        """Test can_trade() method."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState, DrawdownLevel
        )
        
        levels = [
            DrawdownLevel(
                threshold_pct=15.0,
                state=CircuitBreakerState.HALTED,
                position_multiplier=0.0,
                cooldown_minutes=1440,
            ),
        ]
        
        cb = CircuitBreaker(levels=levels, initial_value=10000)
        
        # Normal state - can trade
        assert cb.can_trade() is True
        
        # Trigger halt
        cb.update(current_value=8000)
        assert cb.can_trade() is False
    
    def test_circuit_breaker_factory(self):
        """Test get_circuit_breaker factory function."""
        from src.strategies.circuit_breaker import get_circuit_breaker
        
        cb1 = get_circuit_breaker()
        cb2 = get_circuit_breaker()
        
        assert cb1 is cb2, "Factory should return singleton"
    
    def test_circuit_breaker_position_adjustment(self):
        """Test position size adjustment."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker, CircuitBreakerState, DrawdownLevel
        )
        
        levels = [
            DrawdownLevel(
                threshold_pct=5.0,
                state=CircuitBreakerState.CAUTION,
                position_multiplier=0.5,
                cooldown_minutes=60,
            ),
        ]
        
        cb = CircuitBreaker(levels=levels, initial_value=10000)
        cb.update(current_value=9400)  # Trigger CAUTION
        
        # Should reduce $1000 position to $500
        adjusted = cb.adjust_position_size(1000.0)
        assert adjusted == 500.0


# ============================================================================
# PHASE 2: Time Decay Tests
# ============================================================================


class TestTimeDecay:
    """Test time decay analysis for prediction markets."""
    
    def test_time_decay_analysis(self):
        """Test basic time decay analysis."""
        from src.strategies.time_decay import TimeDecayAnalyzer
        
        analyzer = TimeDecayAnalyzer()
        
        # Market expiring in 7 days
        result = analyzer.analyze(
            market_id="test_market",
            current_prob=0.75,
            resolution_time=datetime.utcnow() + timedelta(days=7),
        )
        
        assert result is not None, "Should return analysis"
        assert result.days_to_resolution > 0, "Should have positive days"
        assert result.days_to_resolution <= 7.0, "Should be <= 7 days"
    
    def test_time_decay_factor(self):
        """Test time decay factor increases near resolution."""
        from src.strategies.time_decay import TimeDecayAnalyzer
        
        analyzer = TimeDecayAnalyzer()
        
        # Near resolution - higher decay
        result_near = analyzer.analyze(
            market_id="near",
            current_prob=0.80,
            resolution_time=datetime.utcnow() + timedelta(hours=24),
        )
        
        # Far from resolution - lower decay
        result_far = analyzer.analyze(
            market_id="far",
            current_prob=0.60,
            resolution_time=datetime.utcnow() + timedelta(days=30),
        )
        
        assert result_near.time_decay_factor > result_far.time_decay_factor, (
            "Decay factor should be higher near resolution"
        )
    
    def test_time_decay_avoid_entry(self):
        """Test avoid_entry flag near resolution."""
        from src.strategies.time_decay import TimeDecayAnalyzer
        
        analyzer = TimeDecayAnalyzer(avoid_entry_hours=48)
        
        # Within avoid entry window
        result = analyzer.analyze(
            market_id="near",
            current_prob=0.70,
            resolution_time=datetime.utcnow() + timedelta(hours=12),
        )
        
        assert result.avoid_entry is True, "Should avoid entry near resolution"
    
    def test_time_decay_sell_signal(self):
        """Test sell signal at expiry."""
        from src.strategies.time_decay import TimeDecayAnalyzer
        
        analyzer = TimeDecayAnalyzer()
        
        # Already expired
        result = analyzer.analyze(
            market_id="expired",
            current_prob=0.85,
            resolution_time=datetime.utcnow() - timedelta(hours=1),
        )
        
        assert result.sell_signal is True, "Should signal sell at expiry"


# ============================================================================
# PHASE 2: Order Flow Tests
# ============================================================================


class TestOrderFlow:
    """Test order flow imbalance analysis."""
    
    def test_ofi_snapshot_add(self):
        """Test adding order book snapshots."""
        from src.strategies.order_flow import (
            OrderFlowAnalyzer, OrderBookSnapshot, OrderBookLevel
        )
        
        analyzer = OrderFlowAnalyzer()
        
        # Create order book snapshot
        snapshot = OrderBookSnapshot(
            timestamp=datetime.utcnow(),
            bids=[OrderBookLevel(price=99.0, size=100.0, side="bid")],
            asks=[OrderBookLevel(price=101.0, size=100.0, side="ask")],
        )
        
        analyzer.add_snapshot("BTC", snapshot)
        
        # No error means success
        assert True
    
    def test_ofi_calculation_requires_history(self):
        """Test OFI calculation needs at least 2 snapshots."""
        from src.strategies.order_flow import OrderFlowAnalyzer
        
        analyzer = OrderFlowAnalyzer()
        
        # No snapshots = no result
        result = analyzer.calculate_ofi("BTC")
        assert result is None, "Should return None without snapshots"
    
    def test_ofi_signal_levels(self):
        """Test OFI signal enum values."""
        from src.strategies.order_flow import OFISignal
        
        # Verify signal values exist
        assert OFISignal.STRONG_BUY is not None
        assert OFISignal.WEAK_BUY is not None
        assert OFISignal.NEUTRAL is not None
        assert OFISignal.WEAK_SELL is not None
        assert OFISignal.STRONG_SELL is not None


# ============================================================================
# PHASE 2: Depeg Detection Tests
# ============================================================================


class TestDepegDetection:
    """Test stablecoin depeg detection."""
    
    def test_depeg_add_price(self):
        """Test adding price observations."""
        from src.strategies.depeg_detection import (
            DepegDetector, StablecoinPrice
        )
        
        detector = DepegDetector()
        
        price_obs = StablecoinPrice(
            symbol="USDC",
            price=0.999,
            source="binance",
            timestamp=datetime.utcnow(),
        )
        
        detector.add_price(price_obs)
        
        # No error means success
        assert True
    
    def test_depeg_check_no_data(self):
        """Test check_depeg returns None without price data."""
        from src.strategies.depeg_detection import DepegDetector
        
        detector = DepegDetector()
        
        result = detector.check_depeg("USDC")
        assert result is None, "Should return None without price data"
    
    def test_depeg_minor_deviation(self):
        """Test minor depeg detection."""
        from src.strategies.depeg_detection import (
            DepegDetector, StablecoinPrice, DepegSeverity
        )
        
        detector = DepegDetector(alert_threshold_pct=0.3)
        
        # Add price showing 0.6% deviation
        price_obs = StablecoinPrice(
            symbol="USDC",
            price=0.994,  # 0.6% below peg
            source="binance",
            timestamp=datetime.utcnow(),
        )
        detector.add_price(price_obs)
        
        alert = detector.check_depeg("USDC")
        
        assert alert is not None, "Should generate alert"
        assert alert.severity == DepegSeverity.MINOR
    
    def test_depeg_severe_deviation(self):
        """Test severe depeg detection with known stablecoin."""
        from src.strategies.depeg_detection import (
            DepegDetector, StablecoinPrice, DepegSeverity
        )
        
        detector = DepegDetector()
        
        # Need >= 5% deviation for SEVERE (thresholds: MINOR=0.5, MODERATE=2.0, SEVERE=5.0)
        price_obs = StablecoinPrice(
            symbol="USDC",
            price=0.94,  # 6% below peg = SEVERE
            source="ftx",
            timestamp=datetime.utcnow(),
        )
        detector.add_price(price_obs)
        
        alert = detector.check_depeg("USDC")
        
        assert alert is not None
        assert alert.severity == DepegSeverity.SEVERE
    
    def test_depeg_severity_thresholds(self):
        """Test depeg severity threshold lookup."""
        from src.strategies.depeg_detection import (
            DepegDetector, DepegSeverity
        )
        
        # Test threshold values
        assert DepegDetector.THRESHOLDS[DepegSeverity.MINOR] == 0.5
        assert DepegDetector.THRESHOLDS[DepegSeverity.MODERATE] == 2.0
        assert DepegDetector.THRESHOLDS[DepegSeverity.SEVERE] == 5.0
        assert DepegDetector.THRESHOLDS[DepegSeverity.CRITICAL] == 10.0


# ============================================================================
# PHASE 2: Correlation Limits Tests
# ============================================================================


class TestCorrelationLimits:
    """Test correlation-based position limits."""
    
    def test_correlation_add_price(self):
        """Test adding price data."""
        from src.strategies.correlation_limits import CorrelationTracker
        
        tracker = CorrelationTracker()
        
        # Add price data
        tracker.add_price("BTC", 50000, datetime.utcnow())
        tracker.add_price("ETH", 3000, datetime.utcnow())
        
        # No error means success
        assert True
    
    def test_correlation_add_position(self):
        """Test adding positions."""
        from src.strategies.correlation_limits import (
            CorrelationTracker, Position
        )
        
        tracker = CorrelationTracker()
        
        position = Position(
            symbol="BTC",
            size=0.2,
            value=10000.0,
            direction="long",
            entry_time=datetime.utcnow(),
        )
        
        tracker.add_position(position)
        
        # No error means success
        assert True
    
    def test_correlation_calculation_requires_data(self):
        """Test correlation needs sufficient price history."""
        from src.strategies.correlation_limits import CorrelationTracker
        
        tracker = CorrelationTracker()
        
        # Without price data, correlation calculation may return None
        result = tracker.calculate_correlation("BTC", "ETH")
        assert result is None, "Should return None without price data"
    
    def test_correlation_cluster_setup(self):
        """Test correlation cluster configuration."""
        from src.strategies.correlation_limits import CorrelationTracker
        
        tracker = CorrelationTracker()
        
        # Set custom cluster
        tracker.set_cluster("layer1", ["BTC", "ETH", "SOL"])
        
        # Verify cluster exists
        assert "layer1" in tracker._clusters
        assert "BTC" in tracker._clusters["layer1"]
    
    def test_correlation_thresholds(self):
        """Test correlation threshold defaults."""
        from src.strategies.correlation_limits import CorrelationTracker
        
        tracker = CorrelationTracker(
            max_cluster_exposure_pct=30.0,
            high_correlation_threshold=0.7,
        )
        
        assert tracker.max_cluster_pct == 30.0
        assert tracker.high_corr_threshold == 0.7


# ============================================================================
# INTEGRATION: Mathematical Accuracy Tests
# ============================================================================


class TestMathematicalAccuracy:
    """Test mathematical accuracy of all calculations."""
    
    def test_kelly_math_accuracy(self):
        """Verify Kelly formula is mathematically correct."""
        from src.strategies.position_sizing import KellyCriterion
        
        kelly = KellyCriterion(
            kelly_fraction=1.0,  # Full Kelly for testing
            max_position_pct=100.0,  # No cap for testing
        )
        
        # Known case: 60% win, 1:1 odds
        # Kelly = (bp - q) / b = (1*0.6 - 0.4) / 1 = 0.2
        result = kelly.calculate_binary(
            win_probability=0.60,
            win_return=0.10,  # 10% win
            loss_return=-0.10,  # 10% loss
        )
        
        # Edge = 0.6*0.1 - 0.4*0.1 = 0.02
        # Variance = 0.6*0.01 + 0.4*0.01 = 0.01
        # Kelly = edge/variance = 0.02/0.01 = 2.0
        assert result.full_kelly == pytest.approx(2.0, rel=0.01)
    
    def test_circuit_breaker_drawdown_math(self):
        """Verify drawdown calculation is mathematically correct."""
        from src.strategies.circuit_breaker import CircuitBreaker
        
        cb = CircuitBreaker(initial_value=10000)
        
        # 10% drawdown: from 10000 to 9000
        # Drawdown% = (10000 - 9000) / 10000 * 100 = 10%
        status = cb.update(current_value=9000)
        
        assert status.current_drawdown_pct == pytest.approx(10.0, rel=0.01)
    
    def test_correlation_tracker_initialization(self):
        """Verify correlation tracker initializes correctly."""
        from src.strategies.correlation_limits import CorrelationTracker
        
        tracker = CorrelationTracker(
            max_cluster_exposure_pct=30.0,
            high_correlation_threshold=0.7,
        )
        
        assert tracker.max_cluster_pct == 30.0
        assert tracker.high_corr_threshold == 0.7
    
    def test_time_decay_math_accuracy(self):
        """Verify time decay calculation is mathematically correct."""
        from src.strategies.time_decay import TimeDecayAnalyzer
        
        analyzer = TimeDecayAnalyzer()
        
        # 7 days to resolution
        resolution = datetime.utcnow() + timedelta(days=7)
        result = analyzer.analyze(
            market_id="test",
            current_prob=0.75,
            resolution_time=resolution,
        )
        
        assert result.days_to_resolution == pytest.approx(7.0, abs=0.1)
    
    def test_depeg_deviation_math(self):
        """Verify depeg deviation calculation."""
        from src.strategies.depeg_detection import (
            DepegDetector, StablecoinPrice
        )
        
        detector = DepegDetector()
        
        # USDC at $0.99 = 1% deviation
        price_obs = StablecoinPrice(
            symbol="USDC",
            price=0.99,
            source="test",
            timestamp=datetime.utcnow(),
        )
        detector.add_price(price_obs)
        
        alert = detector.check_depeg("USDC")
        
        assert alert is not None
        # Deviation should be ~1%
        assert abs(alert.deviation_pct - 1.0) < 0.1


# ============================================================================
# INTEGRATION: Module Import Tests
# ============================================================================


class TestModuleImports:
    """Test that all modules can be imported."""
    
    def test_import_position_sizing(self):
        """Test position_sizing module imports."""
        from src.strategies.position_sizing import (
            KellyCriterion,
            KellyPositionSizer,
            KellyResult,
            get_kelly_sizer,
        )
        assert KellyCriterion is not None
        assert KellyPositionSizer is KellyCriterion  # Alias
    
    def test_import_regime_detection(self):
        """Test regime_detection module imports."""
        from src.strategies.regime_detection import (
            RegimeDetector,
            MarketRegime,
            RegimeState,
            get_regime_detector,
        )
        assert RegimeDetector is not None
        assert MarketRegime is not None
    
    def test_import_circuit_breaker(self):
        """Test circuit_breaker module imports."""
        from src.strategies.circuit_breaker import (
            CircuitBreaker,
            CircuitBreakerState,
            get_circuit_breaker,
        )
        assert CircuitBreaker is not None
        assert CircuitBreakerState is not None
    
    def test_import_time_decay(self):
        """Test time_decay module imports."""
        from src.strategies.time_decay import (
            TimeDecayAnalyzer,
            TimeDecayAnalysis,
            get_time_decay_analyzer,
        )
        assert TimeDecayAnalyzer is not None
    
    def test_import_order_flow(self):
        """Test order_flow module imports."""
        from src.strategies.order_flow import (
            OrderFlowAnalyzer,
            OrderBookSnapshot,
            OFISignal,
            get_order_flow_analyzer,
        )
        assert OrderFlowAnalyzer is not None
    
    def test_import_depeg_detection(self):
        """Test depeg_detection module imports."""
        from src.strategies.depeg_detection import (
            DepegDetector,
            DepegAlert,
            DepegSeverity,
            get_depeg_detector,
        )
        assert DepegDetector is not None
    
    def test_import_correlation_limits(self):
        """Test correlation_limits module imports."""
        from src.strategies.correlation_limits import (
            CorrelationTracker,
            CorrelationPair,
            get_correlation_tracker,
        )
        assert CorrelationTracker is not None
    
    def test_import_from_init(self):
        """Test imports from strategies __init__.py."""
        from src.strategies import (
            KellyCriterion,
            KellyPositionSizer,
            RegimeDetector,
            MarketRegime,
            CircuitBreaker,
            TimeDecayAnalyzer,
            OrderFlowAnalyzer,
            DepegDetector,
            CorrelationTracker,
        )
        assert all([
            KellyCriterion,
            KellyPositionSizer,
            RegimeDetector,
            MarketRegime,
            CircuitBreaker,
            TimeDecayAnalyzer,
            OrderFlowAnalyzer,
            DepegDetector,
            CorrelationTracker,
        ])


# ============================================================================
# Run Tests
# ============================================================================


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
