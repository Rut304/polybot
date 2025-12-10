"""
Stablecoin Depeg Detection and Trading

Academic Foundation:
- Liquidity crisis research
- Bank run dynamics applied to crypto
- Tether/UST analyses from 2022 events

Stablecoin depegs create massive arbitrage opportunities but require
fast detection and execution due to rapid price movements.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import deque
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class DepegSeverity(Enum):
    """Severity level of depeg event."""
    NONE = "none"
    MINOR = "minor"  # <0.5% deviation
    MODERATE = "moderate"  # 0.5-2% deviation
    SEVERE = "severe"  # 2-5% deviation
    CRITICAL = "critical"  # >5% deviation


class DepegDirection(Enum):
    """Direction of depeg."""
    ABOVE = "above"  # Trading above peg (premium)
    BELOW = "below"  # Trading below peg (discount)
    PEGGED = "pegged"


@dataclass
class StablecoinPrice:
    """Price observation for a stablecoin."""
    symbol: str
    price: float
    timestamp: datetime
    source: str  # Exchange or data source


@dataclass
class DepegAlert:
    """Alert for depeg detection."""
    symbol: str
    current_price: float
    peg_price: float
    deviation_pct: float
    direction: DepegDirection
    severity: DepegSeverity
    
    # Trading signals
    arbitrage_opportunity: bool
    expected_return_pct: float
    risk_level: str  # "low", "medium", "high", "extreme"
    
    # Timing
    detected_at: datetime
    depeg_duration_seconds: float
    
    # Recommendations
    action: str
    confidence: float


@dataclass
class DepegTradingOpportunity:
    """Actionable trading opportunity from depeg."""
    stablecoin: str
    current_price: float
    expected_price: float  # Where it should revert to
    
    entry_action: str  # "buy" or "sell"
    expected_profit_pct: float
    max_position_pct: float  # Of portfolio
    
    stop_loss_pct: float
    take_profit_pct: float
    
    risk_factors: List[str]
    confidence: float


class DepegDetector:
    """
    Detects stablecoin depeg events and generates trading signals.
    
    Key stablecoins monitored:
    - USDT (Tether)
    - USDC (Circle)
    - DAI (MakerDAO)
    - FRAX
    - BUSD
    - TUSD
    
    Detection thresholds:
    - Minor: 0.1-0.5% (normal volatility)
    - Moderate: 0.5-2% (stress)
    - Severe: 2-5% (potential failure)
    - Critical: >5% (active depeg)
    """
    
    # Known stablecoins and their pegs
    STABLECOINS = {
        "USDT": 1.0,
        "USDC": 1.0,
        "DAI": 1.0,
        "FRAX": 1.0,
        "BUSD": 1.0,
        "TUSD": 1.0,
        "USDP": 1.0,
        "GUSD": 1.0,
        "LUSD": 1.0,
        "SUSD": 1.0,
    }
    
    # Thresholds for severity levels (in percentage)
    THRESHOLDS = {
        DepegSeverity.MINOR: 0.5,
        DepegSeverity.MODERATE: 2.0,
        DepegSeverity.SEVERE: 5.0,
        DepegSeverity.CRITICAL: 10.0,
    }
    
    def __init__(
        self,
        alert_threshold_pct: float = 0.3,
        arbitrage_threshold_pct: float = 0.5,
        history_window: int = 100,
        min_duration_seconds: int = 60,
    ):
        """
        Initialize depeg detector.
        
        Args:
            alert_threshold_pct: Minimum deviation to alert
            arbitrage_threshold_pct: Minimum deviation for arb opportunity
            history_window: Number of price observations to keep
            min_duration_seconds: Minimum depeg duration to confirm
        """
        self.alert_threshold = alert_threshold_pct
        self.arb_threshold = arbitrage_threshold_pct
        self.history_window = history_window
        self.min_duration = min_duration_seconds
        
        # Price history per stablecoin
        self._prices: Dict[str, deque] = {}
        
        # Active depeg events
        self._active_depegs: Dict[str, datetime] = {}
    
    def add_price(self, observation: StablecoinPrice):
        """
        Add price observation.
        
        Args:
            observation: Price observation to add
        """
        symbol = observation.symbol.upper()
        if symbol not in self._prices:
            self._prices[symbol] = deque(maxlen=self.history_window)
        
        self._prices[symbol].append(observation)
    
    def check_depeg(self, symbol: str) -> Optional[DepegAlert]:
        """
        Check for depeg event on a stablecoin.
        
        Args:
            symbol: Stablecoin symbol
        
        Returns:
            DepegAlert if deviation detected, None otherwise
        """
        symbol = symbol.upper()
        
        if symbol not in self._prices or not self._prices[symbol]:
            return None
        
        if symbol not in self.STABLECOINS:
            logger.warning(f"Unknown stablecoin: {symbol}")
            return None
        
        peg_price = self.STABLECOINS[symbol]
        latest = self._prices[symbol][-1]
        current_price = latest.price
        
        # Calculate deviation
        deviation = current_price - peg_price
        deviation_pct = abs(deviation / peg_price) * 100
        
        # Determine direction
        if deviation_pct < 0.1:
            direction = DepegDirection.PEGGED
        elif deviation > 0:
            direction = DepegDirection.ABOVE
        else:
            direction = DepegDirection.BELOW
        
        # Determine severity
        severity = self._get_severity(deviation_pct)
        
        # Check if below alert threshold
        if deviation_pct < self.alert_threshold:
            return None
        
        # Track depeg duration
        now = datetime.utcnow()
        if symbol not in self._active_depegs:
            self._active_depegs[symbol] = now
        
        depeg_start = self._active_depegs[symbol]
        duration = (now - depeg_start).total_seconds()
        
        # Clear if returned to peg
        if severity == DepegSeverity.NONE:
            if symbol in self._active_depegs:
                del self._active_depegs[symbol]
            return None
        
        # Check for arbitrage opportunity
        arb_opportunity = deviation_pct >= self.arb_threshold
        expected_return = deviation_pct if arb_opportunity else 0.0
        
        # Assess risk
        risk_level = self._assess_risk(symbol, severity, duration)
        
        # Generate action
        action = self._generate_action(
            symbol, direction, severity, arb_opportunity
        )
        
        # Calculate confidence
        confidence = self._calculate_confidence(
            severity, duration, deviation_pct
        )
        
        return DepegAlert(
            symbol=symbol,
            current_price=current_price,
            peg_price=peg_price,
            deviation_pct=deviation_pct,
            direction=direction,
            severity=severity,
            arbitrage_opportunity=arb_opportunity,
            expected_return_pct=expected_return,
            risk_level=risk_level,
            detected_at=now,
            depeg_duration_seconds=duration,
            action=action,
            confidence=confidence,
        )
    
    def check_all(self) -> List[DepegAlert]:
        """
        Check all tracked stablecoins for depegs.
        
        Returns:
            List of DepegAlert for any detected depegs
        """
        alerts = []
        for symbol in self._prices.keys():
            alert = self.check_depeg(symbol)
            if alert:
                alerts.append(alert)
        
        # Sort by severity
        severity_order = {
            DepegSeverity.CRITICAL: 0,
            DepegSeverity.SEVERE: 1,
            DepegSeverity.MODERATE: 2,
            DepegSeverity.MINOR: 3,
        }
        alerts.sort(key=lambda a: severity_order.get(a.severity, 99))
        
        return alerts
    
    def get_trading_opportunity(
        self,
        alert: DepegAlert,
        portfolio_value: float,
    ) -> Optional[DepegTradingOpportunity]:
        """
        Convert depeg alert to trading opportunity.
        
        Args:
            alert: Depeg alert
            portfolio_value: Current portfolio value
        
        Returns:
            Trading opportunity if actionable
        """
        if not alert.arbitrage_opportunity:
            return None
        
        # Entry action
        if alert.direction == DepegDirection.BELOW:
            entry_action = "buy"  # Buy discounted stablecoin
            expected_profit = alert.deviation_pct
        else:
            entry_action = "sell"  # Sell premium stablecoin
            expected_profit = alert.deviation_pct
        
        # Position sizing based on risk
        max_position = self._calculate_max_position(
            alert.severity,
            alert.risk_level,
        )
        
        # Stop loss and take profit
        stop_loss = self._calculate_stop_loss(alert)
        take_profit = alert.deviation_pct * 0.8  # Take 80% of deviation
        
        # Risk factors
        risk_factors = self._get_risk_factors(alert)
        
        return DepegTradingOpportunity(
            stablecoin=alert.symbol,
            current_price=alert.current_price,
            expected_price=alert.peg_price,
            entry_action=entry_action,
            expected_profit_pct=expected_profit,
            max_position_pct=max_position,
            stop_loss_pct=stop_loss,
            take_profit_pct=take_profit,
            risk_factors=risk_factors,
            confidence=alert.confidence,
        )
    
    def _get_severity(self, deviation_pct: float) -> DepegSeverity:
        """Get severity level from deviation percentage."""
        if deviation_pct >= self.THRESHOLDS[DepegSeverity.CRITICAL]:
            return DepegSeverity.CRITICAL
        elif deviation_pct >= self.THRESHOLDS[DepegSeverity.SEVERE]:
            return DepegSeverity.SEVERE
        elif deviation_pct >= self.THRESHOLDS[DepegSeverity.MODERATE]:
            return DepegSeverity.MODERATE
        elif deviation_pct >= self.THRESHOLDS[DepegSeverity.MINOR]:
            return DepegSeverity.MINOR
        else:
            return DepegSeverity.NONE
    
    def _assess_risk(
        self,
        symbol: str,
        severity: DepegSeverity,
        duration: float,
    ) -> str:
        """Assess risk level of trading the depeg."""
        # High-quality stablecoins have lower risk
        high_quality = ["USDC", "DAI", "FRAX"]
        is_quality = symbol in high_quality
        
        if severity == DepegSeverity.CRITICAL:
            return "extreme"  # Possible total failure
        elif severity == DepegSeverity.SEVERE:
            return "high" if not is_quality else "medium"
        elif severity == DepegSeverity.MODERATE:
            return "medium" if not is_quality else "low"
        else:
            return "low"
    
    def _generate_action(
        self,
        symbol: str,
        direction: DepegDirection,
        severity: DepegSeverity,
        arb_opportunity: bool,
    ) -> str:
        """Generate recommended action."""
        if severity == DepegSeverity.CRITICAL:
            return f"CRITICAL: Exit all {symbol} positions immediately"
        
        if not arb_opportunity:
            return f"Monitor {symbol} - deviation minor"
        
        if direction == DepegDirection.BELOW:
            if severity == DepegSeverity.SEVERE:
                return f"High-risk buy opportunity: {symbol} at discount"
            else:
                return f"Buy opportunity: {symbol} trading below peg"
        else:
            return f"Sell opportunity: {symbol} trading above peg"
    
    def _calculate_confidence(
        self,
        severity: DepegSeverity,
        duration: float,
        deviation_pct: float,
    ) -> float:
        """Calculate confidence in the signal."""
        # Longer duration = more confirmed
        duration_factor = min(1.0, duration / 300)  # Max at 5 min
        
        # Larger deviation = more certain
        deviation_factor = min(1.0, deviation_pct / 5.0)
        
        # Severe depegs are more certain
        severity_factor = {
            DepegSeverity.MINOR: 0.6,
            DepegSeverity.MODERATE: 0.7,
            DepegSeverity.SEVERE: 0.8,
            DepegSeverity.CRITICAL: 0.9,
        }.get(severity, 0.5)
        
        return min(0.95, (
            duration_factor * 0.3 +
            deviation_factor * 0.3 +
            severity_factor * 0.4
        ))
    
    def _calculate_max_position(
        self,
        severity: DepegSeverity,
        risk_level: str,
    ) -> float:
        """Calculate maximum position as percentage of portfolio."""
        base_position = {
            DepegSeverity.MINOR: 10.0,
            DepegSeverity.MODERATE: 5.0,
            DepegSeverity.SEVERE: 2.0,
            DepegSeverity.CRITICAL: 0.0,  # Don't trade critical depegs
        }.get(severity, 0.0)
        
        risk_multiplier = {
            "low": 1.0,
            "medium": 0.5,
            "high": 0.25,
            "extreme": 0.0,
        }.get(risk_level, 0.0)
        
        return base_position * risk_multiplier
    
    def _calculate_stop_loss(self, alert: DepegAlert) -> float:
        """Calculate stop loss percentage."""
        # Stop loss widens with severity
        base_stop = {
            DepegSeverity.MINOR: 1.0,
            DepegSeverity.MODERATE: 2.0,
            DepegSeverity.SEVERE: 5.0,
            DepegSeverity.CRITICAL: 10.0,
        }.get(alert.severity, 5.0)
        
        return base_stop
    
    def _get_risk_factors(self, alert: DepegAlert) -> List[str]:
        """Get list of risk factors for the opportunity."""
        risks = []
        
        if alert.severity in [DepegSeverity.SEVERE, DepegSeverity.CRITICAL]:
            risks.append("Potential complete depeg/failure")
        
        if alert.depeg_duration_seconds < self.min_duration:
            risks.append("Short duration - may be transient")
        
        if alert.symbol == "USDT":
            risks.append("USDT has complex backing - verify reserves")
        
        if alert.deviation_pct > 5.0:
            risks.append("Large deviation suggests fundamental issues")
        
        if not risks:
            risks.append("Standard arbitrage risk - price may not revert")
        
        return risks
    
    def get_historical_stats(
        self,
        symbol: str,
    ) -> Dict:
        """
        Get historical statistics for a stablecoin.
        
        Args:
            symbol: Stablecoin symbol
        
        Returns:
            Dictionary with historical stats
        """
        symbol = symbol.upper()
        
        if symbol not in self._prices or not self._prices[symbol]:
            return {}
        
        prices = list(self._prices[symbol])
        price_values = [p.price for p in prices]
        peg = self.STABLECOINS.get(symbol, 1.0)
        
        deviations = [abs(p - peg) / peg * 100 for p in price_values]
        
        return {
            "symbol": symbol,
            "observations": len(prices),
            "current_price": prices[-1].price if prices else None,
            "avg_price": sum(price_values) / len(price_values),
            "min_price": min(price_values),
            "max_price": max(price_values),
            "avg_deviation_pct": sum(deviations) / len(deviations),
            "max_deviation_pct": max(deviations),
            "peg_price": peg,
        }


# Global instance
_depeg_detector: Optional[DepegDetector] = None


def get_depeg_detector() -> DepegDetector:
    """Get or create global depeg detector."""
    global _depeg_detector
    if _depeg_detector is None:
        _depeg_detector = DepegDetector()
    return _depeg_detector
