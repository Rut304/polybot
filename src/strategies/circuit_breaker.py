"""
Circuit Breaker Module for Risk Management

This module implements automatic trading halts based on drawdown levels.
When portfolio experiences significant losses, trading is automatically
reduced or stopped to prevent catastrophic losses.

Academic Foundation:
- Portfolio risk management best practices
- Drawdown control mechanisms from institutional trading
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, Callable, List
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    NORMAL = "normal"  # Full trading enabled
    CAUTION = "caution"  # Reduced position sizes
    WARNING = "warning"  # Minimal trading
    HALTED = "halted"  # No new positions


@dataclass
class DrawdownLevel:
    """Drawdown threshold configuration."""
    threshold_pct: float  # Drawdown percentage trigger
    state: CircuitBreakerState
    position_multiplier: float  # Multiply position sizes by this
    cooldown_minutes: int  # Minutes before resetting


@dataclass
class CircuitBreakerStatus:
    """Current circuit breaker status."""
    state: CircuitBreakerState
    current_drawdown_pct: float
    peak_value: float
    current_value: float
    position_multiplier: float
    triggered_at: Optional[datetime]
    reset_at: Optional[datetime]
    trades_blocked: int = 0


# Default drawdown levels
DEFAULT_LEVELS = [
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
        cooldown_minutes=240,
    ),
    DrawdownLevel(
        threshold_pct=15.0,
        state=CircuitBreakerState.HALTED,
        position_multiplier=0.0,
        cooldown_minutes=1440,  # 24 hours
    ),
]


class CircuitBreaker:
    """
    Automatic trading circuit breaker based on drawdown.

    Monitors portfolio value and automatically reduces or halts
    trading when drawdown exceeds configured thresholds.
    """

    def __init__(
        self,
        levels: Optional[List[DrawdownLevel]] = None,
        on_state_change: Optional[Callable] = None,
        initial_value: float = 0.0,
    ):
        """
        Initialize circuit breaker.

        Args:
            levels: List of DrawdownLevel configurations
            on_state_change: Callback when state changes
            initial_value: Initial portfolio value
        """
        self.levels = sorted(
            levels or DEFAULT_LEVELS,
            key=lambda x: x.threshold_pct
        )
        self.on_state_change = on_state_change

        self._peak_value = initial_value
        self._current_value = initial_value
        self._current_state = CircuitBreakerState.NORMAL
        self._triggered_at: Optional[datetime] = None
        self._triggered_level: Optional[DrawdownLevel] = None
        self._trades_blocked = 0
        self._value_history: List[tuple] = []

    def update(self, current_value: float) -> CircuitBreakerStatus:
        """
        Update circuit breaker with current portfolio value.

        Args:
            current_value: Current portfolio value

        Returns:
            Current circuit breaker status
        """
        self._current_value = current_value

        # Update peak (only when in normal state)
        if self._current_state == CircuitBreakerState.NORMAL:
            if current_value > self._peak_value:
                self._peak_value = current_value

        # Calculate drawdown
        drawdown_pct = self._calculate_drawdown()

        # Record history
        self._value_history.append((datetime.utcnow(), current_value))
        if len(self._value_history) > 10000:
            self._value_history = self._value_history[-5000:]

        # Check for state changes
        self._check_state_change(drawdown_pct)

        # Check for reset conditions
        self._check_reset()

        return self.get_status()

    def _calculate_drawdown(self) -> float:
        """Calculate current drawdown percentage."""
        if self._peak_value <= 0:
            return 0.0

        drawdown = (self._peak_value - self._current_value) / self._peak_value
        return max(drawdown * 100, 0.0)

    def _check_state_change(self, drawdown_pct: float):
        """Check if state should change based on drawdown."""
        new_level = None

        # Find highest triggered level
        for level in self.levels:
            if drawdown_pct >= level.threshold_pct:
                new_level = level

        if new_level:
            if new_level.state != self._current_state:
                old_state = self._current_state
                self._current_state = new_level.state
                self._triggered_at = datetime.utcnow()
                self._triggered_level = new_level

                logger.warning(
                    f"🚨 Circuit breaker: {old_state.value} → "
                    f"{new_level.state.value} "
                    f"(drawdown: {drawdown_pct:.1f}%)"
                )

                if self.on_state_change:
                    self.on_state_change(old_state, new_level.state, drawdown_pct)

    def _check_reset(self):
        """Check if circuit breaker should reset."""
        if self._current_state == CircuitBreakerState.NORMAL:
            return

        if not self._triggered_at or not self._triggered_level:
            return

        # Check if cooldown has passed
        cooldown = timedelta(minutes=self._triggered_level.cooldown_minutes)
        if datetime.utcnow() - self._triggered_at < cooldown:
            return

        # Check if drawdown has improved significantly
        current_dd = self._calculate_drawdown()
        threshold = self._triggered_level.threshold_pct

        # Reset if drawdown is now below half the trigger threshold
        if current_dd < threshold * 0.5:
            old_state = self._current_state
            self._current_state = CircuitBreakerState.NORMAL
            self._triggered_at = None
            self._triggered_level = None

            # Reset peak to current value for fresh start
            self._peak_value = self._current_value

            logger.info(
                f"✅ Circuit breaker reset: {old_state.value} → NORMAL "
                f"(drawdown recovered to {current_dd:.1f}%)"
            )

            if self.on_state_change:
                self.on_state_change(
                    old_state,
                    CircuitBreakerState.NORMAL,
                    current_dd
                )

    def can_trade(self) -> bool:
        """Check if trading is currently allowed."""
        return self._current_state != CircuitBreakerState.HALTED

    def get_position_multiplier(self) -> float:
        """Get current position size multiplier."""
        if self._triggered_level:
            return self._triggered_level.position_multiplier
        return 1.0

    def adjust_position_size(self, base_size: float) -> float:
        """Adjust position size based on current state."""
        return base_size * self.get_position_multiplier()

    def block_trade(self, reason: str = ""):
        """Record a blocked trade."""
        self._trades_blocked += 1
        logger.warning(
            f"🛑 Trade blocked by circuit breaker "
            f"(state: {self._current_state.value}) {reason}"
        )

    def get_status(self) -> CircuitBreakerStatus:
        """Get current circuit breaker status."""
        reset_at = None
        if self._triggered_at and self._triggered_level:
            reset_at = (
                self._triggered_at +
                timedelta(minutes=self._triggered_level.cooldown_minutes)
            )

        return CircuitBreakerStatus(
            state=self._current_state,
            current_drawdown_pct=self._calculate_drawdown(),
            peak_value=self._peak_value,
            current_value=self._current_value,
            position_multiplier=self.get_position_multiplier(),
            triggered_at=self._triggered_at,
            reset_at=reset_at,
            trades_blocked=self._trades_blocked,
        )

    def reset(self, new_peak: Optional[float] = None):
        """Manually reset circuit breaker."""
        self._current_state = CircuitBreakerState.NORMAL
        self._triggered_at = None
        self._triggered_level = None
        self._trades_blocked = 0

        if new_peak is not None:
            self._peak_value = new_peak
            self._current_value = new_peak

        logger.info("Circuit breaker manually reset")

    @property
    def state(self) -> CircuitBreakerState:
        """Get current state."""
        return self._current_state

    @property
    def is_halted(self) -> bool:
        """Check if trading is halted."""
        return self._current_state == CircuitBreakerState.HALTED

    @property
    def drawdown_pct(self) -> float:
        """Get current drawdown percentage."""
        return self._calculate_drawdown()


class DailyLossCircuitBreaker:
    """
    Circuit breaker based on daily P&L loss.

    Stops trading when daily losses exceed threshold.
    Resets at market open or configurable time.
    """

    def __init__(
        self,
        max_daily_loss_pct: float = 5.0,
        max_daily_loss_usd: Optional[float] = None,
        reset_hour_utc: int = 14,  # 9 AM EST = 14:00 UTC
    ):
        """
        Initialize daily loss circuit breaker.

        Args:
            max_daily_loss_pct: Max daily loss as % of starting balance
            max_daily_loss_usd: Max daily loss in USD (optional hard cap)
            reset_hour_utc: Hour (UTC) to reset daily tracking
        """
        self.max_loss_pct = max_daily_loss_pct
        self.max_loss_usd = max_daily_loss_usd
        self.reset_hour = reset_hour_utc

        self._daily_start_value: float = 0.0
        self._current_value: float = 0.0
        self._last_reset: Optional[datetime] = None
        self._is_halted: bool = False
        self._trades_blocked: int = 0

    def start_day(self, starting_value: float):
        """Start tracking for a new day."""
        self._daily_start_value = starting_value
        self._current_value = starting_value
        self._last_reset = datetime.utcnow()
        self._is_halted = False
        logger.info(f"Daily circuit breaker started: ${starting_value:.2f}")

    def update(self, current_value: float) -> bool:
        """
        Update with current value.

        Returns:
            True if trading is allowed, False if halted
        """
        self._check_reset()

        self._current_value = current_value
        daily_pnl = current_value - self._daily_start_value
        daily_pnl_pct = (
            (daily_pnl / self._daily_start_value * 100)
            if self._daily_start_value > 0 else 0
        )

        # Check if loss exceeds threshold
        if daily_pnl_pct < -self.max_loss_pct:
            if not self._is_halted:
                self._is_halted = True
                logger.warning(
                    f"🚨 Daily loss limit hit: {daily_pnl_pct:.2f}% "
                    f"(${daily_pnl:.2f})"
                )
            return False

        # Check USD limit if set
        if self.max_loss_usd and daily_pnl < -self.max_loss_usd:
            if not self._is_halted:
                self._is_halted = True
                logger.warning(
                    f"🚨 Daily USD loss limit hit: ${abs(daily_pnl):.2f}"
                )
            return False

        self._is_halted = False
        return True

    def _check_reset(self):
        """Check if we should reset for a new day."""
        now = datetime.utcnow()

        if self._last_reset is None:
            self._last_reset = now
            return

        # Check if we've passed the reset hour
        last_date = self._last_reset.date()
        current_date = now.date()

        if current_date > last_date and now.hour >= self.reset_hour:
            # New day - reset
            logger.info("Daily circuit breaker resetting for new day")
            self._daily_start_value = self._current_value
            self._last_reset = now
            self._is_halted = False

    def can_trade(self) -> bool:
        """Check if trading is allowed."""
        return not self._is_halted

    def block_trade(self):
        """Record blocked trade."""
        self._trades_blocked += 1

    @property
    def daily_pnl(self) -> float:
        """Get today's P&L."""
        return self._current_value - self._daily_start_value

    @property
    def daily_pnl_pct(self) -> float:
        """Get today's P&L percentage."""
        if self._daily_start_value <= 0:
            return 0.0
        return (self.daily_pnl / self._daily_start_value) * 100


# Global instances
_circuit_breaker: Optional[CircuitBreaker] = None
_daily_breaker: Optional[DailyLossCircuitBreaker] = None


def get_circuit_breaker() -> CircuitBreaker:
    """Get or create global circuit breaker."""
    global _circuit_breaker
    if _circuit_breaker is None:
        _circuit_breaker = CircuitBreaker()
    return _circuit_breaker


def get_daily_circuit_breaker() -> DailyLossCircuitBreaker:
    """Get or create daily circuit breaker."""
    global _daily_breaker
    if _daily_breaker is None:
        _daily_breaker = DailyLossCircuitBreaker()
    return _daily_breaker


def can_trade() -> bool:
    """Check if trading is allowed by all circuit breakers."""
    cb = get_circuit_breaker()
    dcb = get_daily_circuit_breaker()
    return cb.can_trade() and dcb.can_trade()
