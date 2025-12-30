"""
Earnings Momentum Strategy for Alpaca

Trade stocks around earnings announcements based on
expectations, historical patterns, and post-earnings drift.

Strategy Components:
1. Pre-Earnings: Position before earnings based on historical patterns
2. Post-Earnings Drift: Trade the continuation after surprise moves
3. Earnings Momentum: Ride stocks with consecutive beats

Expected Returns: 15-30% APY
Confidence: 65% (earnings are inherently uncertain)
Risk: High (binary events can cause large moves)
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from enum import Enum

logger = logging.getLogger(__name__)


class EarningsSurprise(Enum):
    """Earnings surprise classification."""
    MASSIVE_BEAT = "massive_beat"  # > 10% surprise
    STRONG_BEAT = "strong_beat"  # 5-10%
    BEAT = "beat"  # 0-5%
    INLINE = "inline"  # Within 1%
    MISS = "miss"  # 0-5% miss
    STRONG_MISS = "strong_miss"  # 5-10%
    MASSIVE_MISS = "massive_miss"  # > 10%


class EarningsStrategy(Enum):
    """Earnings trading strategies."""
    PRE_EARNINGS_MOMENTUM = "pre_earnings_momentum"
    POST_EARNINGS_DRIFT = "post_earnings_drift"
    EARNINGS_STRANGLE = "earnings_strangle"
    BEAT_CONTINUATION = "beat_continuation"


@dataclass
class EarningsEvent:
    """Represents an earnings event."""
    symbol: str
    report_date: datetime
    report_time: str  # "BMO" (before market open) or "AMC" (after close)
    eps_estimate: float
    eps_actual: Optional[float] = None
    revenue_estimate: float = 0
    revenue_actual: Optional[float] = None
    surprise_pct: Optional[float] = None
    surprise_type: Optional[EarningsSurprise] = None
    price_before: float = 0
    price_after: float = 0
    move_pct: float = 0
    historical_moves: List[float] = field(default_factory=list)
    beat_streak: int = 0


@dataclass
class EarningsPosition:
    """Tracks an earnings-related position."""
    symbol: str
    strategy: EarningsStrategy
    entry_price: float
    entry_date: datetime
    shares: int
    target_exit_date: Optional[datetime] = None
    stop_loss: float = 0
    take_profit: float = 0
    earnings_date: Optional[datetime] = None
    pnl: float = 0


@dataclass
class EarningsStats:
    """Strategy performance statistics."""
    total_trades: int = 0
    pre_earnings_trades: int = 0
    post_earnings_trades: int = 0
    beat_trades_won: int = 0
    miss_trades_won: int = 0
    avg_return: float = 0.0
    total_pnl: float = 0.0


class EarningsMomentumStrategy:
    """
    Earnings Momentum Strategy

    Trade around earnings based on historical patterns and surprises.
    """

    def __init__(
        self,
        alpaca_client,
        min_surprise_pct: float = 0.03,  # 3% surprise threshold
        min_beat_streak: int = 3,  # Consecutive beats
        post_drift_days: int = 5,  # Days to hold post-earnings
        max_position_pct: float = 0.05,  # 5% per position
    ):
        self.alpaca = alpaca_client
        self.min_surprise = min_surprise_pct
        self.min_streak = min_beat_streak
        self.drift_days = post_drift_days
        self.max_position = max_position_pct
        self.positions: Dict[str, EarningsPosition] = {}
        self.upcoming_earnings: Dict[str, EarningsEvent] = {}
        self.historical: Dict[str, List[EarningsEvent]] = {}
        self.stats = EarningsStats()

    async def scan_upcoming_earnings(
        self, days_ahead: int = 14
    ) -> List[EarningsEvent]:
        """Scan for upcoming earnings events."""
        try:
            # In production, use an earnings calendar API
            # (Finnhub, Alpha Vantage, IEX, etc.)
            calendar = await self._fetch_earnings_calendar(days_ahead)

            events = []
            for event in calendar:
                # Enrich with historical data
                historical = await self._get_historical_earnings(
                    event.symbol
                )

                # Calculate beat streak
                streak = self._calculate_beat_streak(historical)
                event.beat_streak = streak
                event.historical_moves = [
                    e.move_pct for e in historical[-4:]
                ]

                events.append(event)

            return events

        except Exception as e:
            logger.error(f"Error scanning earnings: {e}")
            return []

    async def _fetch_earnings_calendar(
        self, days: int
    ) -> List[EarningsEvent]:
        """Fetch earnings calendar."""
        # Simulated - in production use real API
        return []

    async def _get_historical_earnings(
        self, symbol: str
    ) -> List[EarningsEvent]:
        """Get historical earnings data."""
        if symbol in self.historical:
            return self.historical[symbol]

        # Fetch from API - simulated
        return []

    def _calculate_beat_streak(
        self, history: List[EarningsEvent]
    ) -> int:
        """Calculate consecutive earnings beat streak."""
        streak = 0
        for event in reversed(history):
            if event.surprise_type in [
                EarningsSurprise.BEAT,
                EarningsSurprise.STRONG_BEAT,
                EarningsSurprise.MASSIVE_BEAT
            ]:
                streak += 1
            else:
                break
        return streak

    async def find_pre_earnings_plays(self) -> List[Dict]:
        """Find pre-earnings trading opportunities."""
        opportunities = []
        events = await self.scan_upcoming_earnings()

        for event in events:
            # Strategy 1: Strong beat streak continuation
            if event.beat_streak >= self.min_streak:
                # Expect momentum into earnings
                avg_move = (
                    sum(event.historical_moves) / len(event.historical_moves)
                    if event.historical_moves else 0
                )

                opportunities.append({
                    'symbol': event.symbol,
                    'strategy': EarningsStrategy.PRE_EARNINGS_MOMENTUM,
                    'earnings_date': event.report_date,
                    'beat_streak': event.beat_streak,
                    'expected_move': avg_move,
                    'entry_reason': (
                        f"{event.beat_streak} consecutive beats, "
                        f"avg move: {avg_move:.1f}%"
                    ),
                })

            # Strategy 2: High IV play (options strangle)
            implied_move = sum(abs(m) for m in event.historical_moves)
            implied_move = implied_move / len(event.historical_moves) if event.historical_moves else 0

            if implied_move > 5:  # >5% average move
                opportunities.append({
                    'symbol': event.symbol,
                    'strategy': EarningsStrategy.EARNINGS_STRANGLE,
                    'earnings_date': event.report_date,
                    'implied_move': implied_move,
                    'entry_reason': (
                        f"High volatility play: avg {implied_move:.1f}% move"
                    ),
                })

        return opportunities

    async def find_post_earnings_drift(self) -> List[Dict]:
        """
        Find post-earnings drift opportunities.

        Post-Earnings Announcement Drift (PEAD) is a well-documented
        anomaly where stocks continue to drift in the direction of
        the earnings surprise for days/weeks after the announcement.
        """
        opportunities = []

        # Get stocks that just reported
        recent = await self._get_recent_earnings(days_back=2)

        for event in recent:
            if event.surprise_pct is None:
                continue

            # Strong surprises create drift opportunities
            if abs(event.surprise_pct) >= self.min_surprise:
                direction = 'long' if event.surprise_pct > 0 else 'short'

                opportunities.append({
                    'symbol': event.symbol,
                    'strategy': EarningsStrategy.POST_EARNINGS_DRIFT,
                    'direction': direction,
                    'surprise_pct': event.surprise_pct,
                    'initial_move': event.move_pct,
                    'hold_days': self.drift_days,
                    'entry_reason': (
                        f"Post-earnings drift: "
                        f"{event.surprise_pct:.1f}% surprise"
                    ),
                })

        return opportunities

    async def _get_recent_earnings(
        self, days_back: int
    ) -> List[EarningsEvent]:
        """Get earnings from recent days."""
        # In production, fetch from API
        return []

    async def execute_trade(
        self, opportunity: Dict, portfolio_value: float
    ) -> Optional[EarningsPosition]:
        """Execute an earnings trade."""
        try:
            symbol = opportunity['symbol']
            strategy = opportunity['strategy']

            # Get current price
            quote = await self.alpaca.get_quote(symbol)
            price = (quote.bid_price + quote.ask_price) / 2

            # Calculate position size
            position_value = portfolio_value * self.max_position
            shares = int(position_value / price)

            if shares == 0:
                return None

            # Set stops based on strategy
            if strategy == EarningsStrategy.PRE_EARNINGS_MOMENTUM:
                stop_loss = price * 0.95  # 5% stop
                take_profit = price * 1.10  # 10% target
            elif strategy == EarningsStrategy.POST_EARNINGS_DRIFT:
                direction = opportunity.get('direction', 'long')
                if direction == 'long':
                    stop_loss = price * 0.97
                    take_profit = price * 1.05
                else:
                    stop_loss = price * 1.03
                    take_profit = price * 0.95
            else:
                stop_loss = price * 0.92
                take_profit = price * 1.15

            # Submit order
            side = 'buy'
            if (strategy == EarningsStrategy.POST_EARNINGS_DRIFT
                and opportunity.get('direction') == 'short'):
                side = 'sell'  # Short sell

            order = await self.alpaca.submit_order(
                symbol=symbol,
                qty=shares,
                side=side,
                type='market',
                time_in_force='day',
            )

            if order:
                position = EarningsPosition(
                    symbol=symbol,
                    strategy=strategy,
                    entry_price=price,
                    entry_date=datetime.now(timezone.utc),
                    shares=shares if side == 'buy' else -shares,
                    stop_loss=stop_loss,
                    take_profit=take_profit,
                    earnings_date=opportunity.get('earnings_date'),
                )

                self.positions[symbol] = position
                self.stats.total_trades += 1

                if 'pre' in strategy.value:
                    self.stats.pre_earnings_trades += 1
                else:
                    self.stats.post_earnings_trades += 1

                return position

        except Exception as e:
            logger.error(f"Error executing trade: {e}")

        return None

    async def manage_positions(self) -> List[Dict]:
        """Manage existing earnings positions."""
        actions = []
        now = datetime.now(timezone.utc)

        for symbol, pos in list(self.positions.items()):
            try:
                quote = await self.alpaca.get_quote(symbol)
                price = (quote.bid_price + quote.ask_price) / 2

                # Check stop loss
                if pos.shares > 0 and price <= pos.stop_loss:
                    actions.append({
                        'symbol': symbol,
                        'action': 'close',
                        'reason': 'Stop loss hit',
                        'pnl_pct': (price - pos.entry_price) / pos.entry_price
                    })

                # Check take profit
                elif pos.shares > 0 and price >= pos.take_profit:
                    actions.append({
                        'symbol': symbol,
                        'action': 'close',
                        'reason': 'Take profit hit',
                        'pnl_pct': (price - pos.entry_price) / pos.entry_price
                    })

                # Check time-based exit for drift trades
                elif (pos.strategy == EarningsStrategy.POST_EARNINGS_DRIFT
                      and pos.target_exit_date
                      and now >= pos.target_exit_date):
                    actions.append({
                        'symbol': symbol,
                        'action': 'close',
                        'reason': 'Drift period ended',
                        'pnl_pct': (price - pos.entry_price) / pos.entry_price
                    })

            except Exception as e:
                logger.error(f"Error managing {symbol}: {e}")

        return actions

    def get_earnings_calendar_summary(self) -> Dict:
        """Get summary of upcoming earnings."""
        return {
            'upcoming_count': len(self.upcoming_earnings),
            'high_streak_stocks': [
                e.symbol for e in self.upcoming_earnings.values()
                if e.beat_streak >= self.min_streak
            ],
            'positions_count': len(self.positions),
            'stats': {
                'total_trades': self.stats.total_trades,
                'avg_return': self.stats.avg_return,
            }
        }


EARNINGS_STRATEGY_INFO = {
    'name': 'Earnings Momentum',
    'description': 'Trade around earnings announcements',
    'risk': 'High',
    'expected_return': '15-30% APY',
    'key_strategies': [
        'Pre-earnings momentum',
        'Post-earnings drift (PEAD)',
        'Beat streak continuation',
    ],
    'best_for': 'Active traders comfortable with earnings volatility',
    'key_metrics': ['Beat Streak', 'Surprise %', 'Historical Move'],
}
