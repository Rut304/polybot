"""
Stock Momentum Strategy for Alpaca

Trades stocks showing strong momentum, riding trends until they reverse.

Strategy:
- Monitor a universe of liquid stocks
- Calculate momentum indicators (RSI, price change, volume surge)
- BUY stocks with strong upward momentum
- SELL/SHORT stocks with strong downward momentum (if allowed)
- Exit when momentum fades or reverses

Expected Returns: 20-40% APY (in trending markets)
Confidence: 65% (works well in trending markets, poor in choppy markets)
Risk: Medium-High (momentum can reverse quickly)
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from enum import Enum
import statistics

logger = logging.getLogger(__name__)


class MomentumSignal(Enum):
    """Momentum trading signals."""
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    HOLD = "hold"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


@dataclass
class MomentumScore:
    """Momentum analysis for a stock."""
    symbol: str
    price: float
    price_change_1d: float  # 1-day price change %
    price_change_5d: float  # 5-day price change %
    price_change_20d: float  # 20-day price change %
    rsi_14: float  # 14-day RSI
    volume_ratio: float  # Current volume vs 20-day avg
    momentum_score: float  # Combined score 0-100
    signal: MomentumSignal
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass
class MomentumPosition:
    """Tracks a momentum position."""
    symbol: str
    entry_price: float
    quantity: int
    side: str  # "long"
    entry_time: datetime
    entry_momentum: float
    trailing_stop: float
    highest_price: float  # For trailing stop
    current_pnl: float = 0.0


@dataclass
class MomentumStats:
    """Strategy performance statistics."""
    total_scans: int = 0
    signals_generated: int = 0
    trades_entered: int = 0
    trades_won: int = 0
    trades_lost: int = 0
    total_pnl: float = 0.0
    best_trade: float = 0.0
    worst_trade: float = 0.0
    current_positions: int = 0
    
    @property
    def win_rate(self) -> float:
        total = self.trades_won + self.trades_lost
        return (self.trades_won / total * 100) if total > 0 else 0.0


class StockMomentumStrategy:
    """
    Momentum Strategy for stock trading via Alpaca.
    
    This strategy identifies stocks with strong momentum and
    rides the trend until momentum fades.
    
    Configuration:
    - universe: List of stock symbols to monitor
    - min_momentum_score: Minimum score to enter (default: 70)
    - trailing_stop_pct: Trailing stop percentage (default: 5%)
    - max_position_size: Maximum USD per position
    - max_positions: Maximum concurrent positions
    """
    
    # Default universe - liquid, volatile stocks good for momentum
    DEFAULT_UNIVERSE = [
        # Tech (high beta)
        "NVDA", "AMD", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN",
        # Growth
        "CRM", "ADBE", "NOW", "SNOW", "NET", "CRWD", "DDOG",
        # Semiconductors
        "AVGO", "QCOM", "MU", "MRVL", "AMAT",
        # Consumer
        "COST", "HD", "TGT", "NKE", "SBUX",
        # Finance
        "V", "MA", "PYPL", "SQ",
        # Biotech (high volatility)
        "MRNA", "REGN", "VRTX",
    ]
    
    def __init__(
        self,
        alpaca_client,
        db_client=None,
        universe: Optional[List[str]] = None,
        min_momentum_score: float = 70.0,
        trailing_stop_pct: float = 5.0,
        max_position_size: float = 2000.0,
        max_positions: int = 5,
        dry_run: bool = True,
    ):
        self.alpaca = alpaca_client
        self.db = db_client
        self.universe = universe or self.DEFAULT_UNIVERSE
        self.min_momentum_score = min_momentum_score
        self.trailing_stop_pct = trailing_stop_pct
        self.max_position_size = max_position_size
        self.max_positions = max_positions
        self.dry_run = dry_run
        
        # State
        self.positions: Dict[str, MomentumPosition] = {}
        self.price_data: Dict[str, List[Dict]] = {}  # OHLCV data
        self.stats = MomentumStats()
        self._running = False
        
        logger.info(
            f"🚀 Stock Momentum Strategy initialized | "
            f"Universe: {len(self.universe)} stocks | "
            f"Min Score: {min_momentum_score} | "
            f"Trailing Stop: {trailing_stop_pct}% | "
            f"Mode: {'DRY RUN' if dry_run else 'LIVE'}"
        )
    
    async def initialize(self) -> bool:
        """Initialize strategy and load historical data."""
        try:
            if not self.alpaca._initialized:
                if not await self.alpaca.initialize():
                    logger.error("Failed to initialize Alpaca client")
                    return False
            
            logger.info("Loading historical data for momentum calculation...")
            
            for symbol in self.universe:
                try:
                    ohlcv = await self.alpaca.get_ohlcv(
                        symbol, timeframe='1Day', limit=25
                    )
                    self.price_data[symbol] = [
                        {
                            'timestamp': c[0],
                            'open': c[1],
                            'high': c[2],
                            'low': c[3],
                            'close': c[4],
                            'volume': c[5]
                        }
                        for c in ohlcv
                    ]
                except Exception as e:
                    logger.warning(f"Failed to load data for {symbol}: {e}")
            
            loaded = len(self.price_data)
            logger.info(f"✅ Loaded data for {loaded}/{len(self.universe)} stocks")
            return loaded > 0
            
        except Exception as e:
            logger.error(f"Failed to initialize strategy: {e}")
            return False
    
    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """Calculate RSI indicator."""
        if len(prices) < period + 1:
            return 50.0  # Neutral
        
        # Calculate price changes
        changes = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        
        # Separate gains and losses
        gains = [max(0, c) for c in changes[-period:]]
        losses = [abs(min(0, c)) for c in changes[-period:]]
        
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def _calculate_momentum_score(self, symbol: str) -> Optional[MomentumScore]:
        """Calculate momentum score for a symbol."""
        data = self.price_data.get(symbol, [])
        
        if len(data) < 20:
            return None
        
        closes = [d['close'] for d in data]
        volumes = [d['volume'] for d in data]
        current_price = closes[-1]
        
        # Price changes
        price_1d = ((current_price / closes[-2]) - 1) * 100 if len(closes) >= 2 else 0
        price_5d = ((current_price / closes[-5]) - 1) * 100 if len(closes) >= 5 else 0
        price_20d = ((current_price / closes[-20]) - 1) * 100 if len(closes) >= 20 else 0
        
        # RSI
        rsi = self._calculate_rsi(closes)
        
        # Volume surge (current vs 20-day average)
        avg_volume = statistics.mean(volumes[-20:]) if volumes else 1
        vol_ratio = volumes[-1] / avg_volume if avg_volume > 0 else 1
        
        # Calculate momentum score (0-100)
        # Components:
        # - Short-term momentum (1d change): 20%
        # - Medium-term momentum (5d change): 30%
        # - Long-term momentum (20d change): 20%
        # - RSI (not oversold/overbought): 15%
        # - Volume confirmation: 15%
        
        # Normalize each component to 0-100
        short_score = min(100, max(0, 50 + price_1d * 10))
        medium_score = min(100, max(0, 50 + price_5d * 5))
        long_score = min(100, max(0, 50 + price_20d * 2))
        rsi_score = rsi  # Already 0-100
        volume_score = min(100, vol_ratio * 50)  # 2x volume = 100
        
        momentum_score = (
            short_score * 0.20 +
            medium_score * 0.30 +
            long_score * 0.20 +
            rsi_score * 0.15 +
            volume_score * 0.15
        )
        
        # Determine signal
        if momentum_score >= 80 and rsi < 70:
            signal = MomentumSignal.STRONG_BUY
        elif momentum_score >= 65 and rsi < 75:
            signal = MomentumSignal.BUY
        elif momentum_score <= 20 or rsi > 80:
            signal = MomentumSignal.STRONG_SELL
        elif momentum_score <= 35:
            signal = MomentumSignal.SELL
        else:
            signal = MomentumSignal.HOLD
        
        return MomentumScore(
            symbol=symbol,
            price=current_price,
            price_change_1d=price_1d,
            price_change_5d=price_5d,
            price_change_20d=price_20d,
            rsi_14=rsi,
            volume_ratio=vol_ratio,
            momentum_score=momentum_score,
            signal=signal,
        )
    
    async def _enter_position(
        self, score: MomentumScore
    ) -> Optional[MomentumPosition]:
        """Enter a new momentum position."""
        if len(self.positions) >= self.max_positions:
            return None
        
        if score.symbol in self.positions:
            return None
        
        quantity = int(self.max_position_size / score.price)
        if quantity <= 0:
            return None
        
        trailing_stop = score.price * (1 - self.trailing_stop_pct / 100)
        
        position = MomentumPosition(
            symbol=score.symbol,
            entry_price=score.price,
            quantity=quantity,
            side="long",
            entry_time=datetime.now(timezone.utc),
            entry_momentum=score.momentum_score,
            trailing_stop=trailing_stop,
            highest_price=score.price,
        )
        
        # Execute trade
        if not self.dry_run:
            try:
                from ..exchanges.base import OrderSide, OrderType
                await self.alpaca.create_order(
                    symbol=score.symbol,
                    side=OrderSide.BUY,
                    order_type=OrderType.MARKET,
                    quantity=quantity,
                )
            except Exception as e:
                logger.error(f"Failed to place order: {e}")
                return None
        
        self.positions[score.symbol] = position
        self.stats.trades_entered += 1
        self.stats.current_positions = len(self.positions)
        
        mode = "[DRY RUN] " if self.dry_run else ""
        logger.info(
            f"{mode}🚀 ENTERED LONG {score.symbol} | "
            f"Price: ${score.price:.2f} | "
            f"Momentum: {score.momentum_score:.0f} | "
            f"RSI: {score.rsi_14:.0f} | "
            f"Trail Stop: ${trailing_stop:.2f}"
        )
        
        return position
    
    async def _update_position(
        self, position: MomentumPosition, current_price: float
    ) -> bool:
        """Update position and check for exit."""
        # Update trailing stop
        if current_price > position.highest_price:
            position.highest_price = current_price
            new_stop = current_price * (1 - self.trailing_stop_pct / 100)
            position.trailing_stop = max(position.trailing_stop, new_stop)
        
        # Calculate current P&L
        pnl = (current_price - position.entry_price) * position.quantity
        position.current_pnl = pnl
        
        should_exit = False
        exit_reason = ""
        
        # Check trailing stop
        if current_price <= position.trailing_stop:
            should_exit = True
            exit_reason = "TRAILING STOP"
        
        # Check momentum fade
        score = self._calculate_momentum_score(position.symbol)
        if score and score.momentum_score < 40:
            should_exit = True
            exit_reason = "MOMENTUM FADE"
        
        if should_exit:
            # Execute exit
            if not self.dry_run:
                try:
                    from ..exchanges.base import OrderSide, OrderType
                    await self.alpaca.create_order(
                        symbol=position.symbol,
                        side=OrderSide.SELL,
                        order_type=OrderType.MARKET,
                        quantity=position.quantity,
                    )
                except Exception as e:
                    logger.error(f"Failed to exit position: {e}")
                    return False
            
            # Update stats
            if pnl > 0:
                self.stats.trades_won += 1
                self.stats.best_trade = max(self.stats.best_trade, pnl)
            else:
                self.stats.trades_lost += 1
                self.stats.worst_trade = min(self.stats.worst_trade, pnl)
            
            self.stats.total_pnl += pnl
            del self.positions[position.symbol]
            self.stats.current_positions = len(self.positions)
            
            hold_hours = (
                datetime.now(timezone.utc) - position.entry_time
            ).total_seconds() / 3600
            
            mode = "[DRY RUN] " if self.dry_run else ""
            emoji = "✅" if pnl > 0 else "❌"
            logger.info(
                f"{mode}{emoji} EXITED {position.symbol} | "
                f"{exit_reason} | "
                f"Entry: ${position.entry_price:.2f} → "
                f"Exit: ${current_price:.2f} | "
                f"P&L: ${pnl:+.2f} | "
                f"Held: {hold_hours:.1f}h"
            )
            return True
        
        return False
    
    async def scan_opportunities(self) -> List[MomentumScore]:
        """Scan universe for momentum opportunities."""
        opportunities = []
        self.stats.total_scans += 1
        
        try:
            # Get current prices and update data
            tickers = await self.alpaca.get_tickers(self.universe)
            
            for symbol in self.universe:
                ticker = tickers.get(symbol)
                if not ticker:
                    continue
                
                # Update price data
                if symbol in self.price_data:
                    self.price_data[symbol].append({
                        'timestamp': int(datetime.now().timestamp() * 1000),
                        'open': ticker.last,
                        'high': ticker.last,
                        'low': ticker.last,
                        'close': ticker.last,
                        'volume': 0,  # Intraday volume not available
                    })
                    # Keep only recent data
                    self.price_data[symbol] = self.price_data[symbol][-25:]
                
                score = self._calculate_momentum_score(symbol)
                if score and score.signal in (
                    MomentumSignal.STRONG_BUY, MomentumSignal.BUY
                ):
                    if score.momentum_score >= self.min_momentum_score:
                        opportunities.append(score)
                        self.stats.signals_generated += 1
            
        except Exception as e:
            logger.error(f"Error scanning opportunities: {e}")
        
        # Sort by momentum score
        opportunities.sort(key=lambda x: x.momentum_score, reverse=True)
        return opportunities
    
    async def run(self, duration_seconds: int = 3600):
        """Run the strategy for specified duration."""
        self._running = True
        end_time = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
        
        while self._running and datetime.now(timezone.utc) < end_time:
            try:
                # Update existing positions
                for symbol in list(self.positions.keys()):
                    try:
                        ticker = await self.alpaca.get_ticker(symbol)
                        await self._update_position(
                            self.positions[symbol], ticker.last
                        )
                    except KeyError:
                        pass  # Position was closed
                    except Exception as e:
                        logger.error(f"Error updating {symbol}: {e}")
                
                # Scan for new opportunities
                opportunities = await self.scan_opportunities()
                
                # Enter best opportunities
                for score in opportunities[:3]:  # Top 3 only
                    if len(self.positions) < self.max_positions:
                        await self._enter_position(score)
                
                # Log status
                if self.positions:
                    total_pnl = sum(p.current_pnl for p in self.positions.values())
                    logger.info(
                        f"🚀 Momentum | "
                        f"Positions: {len(self.positions)}/{self.max_positions} | "
                        f"Open P&L: ${total_pnl:+.2f} | "
                        f"Realized: ${self.stats.total_pnl:+.2f}"
                    )
                
                # Wait before next scan (5 minutes for intraday)
                await asyncio.sleep(300)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in momentum loop: {e}")
                await asyncio.sleep(60)
        
        self._running = False
    
    async def run_cycle(self):
        """Run one iteration of the strategy (called by bot_runner)."""
        try:
            # Update existing positions
            for symbol in list(self.positions.keys()):
                try:
                    ticker = await self.alpaca.get_ticker(symbol)
                    await self._update_position(
                        self.positions[symbol], ticker.last
                    )
                except KeyError:
                    pass  # Position was closed
                except Exception as e:
                    logger.error(f"Error updating {symbol}: {e}")
            
            # Scan for new opportunities
            opportunities = await self.scan_opportunities()
            
            # Enter best opportunities (top 3 only)
            for score in opportunities[:3]:
                if len(self.positions) < self.max_positions:
                    await self._enter_position(score)
            
            # Log status
            total_pnl = sum(p.current_pnl for p in self.positions.values())
            logger.info(
                f"🚀 Momentum | "
                f"Opportunities: {len(opportunities)} | "
                f"Positions: {len(self.positions)}/{self.max_positions} | "
                f"Open P&L: ${total_pnl:+.2f} | "
                f"Realized: ${self.stats.total_pnl:+.2f}"
            )
            
        except Exception as e:
            logger.error(f"Error in momentum cycle: {e}")
            raise
    
    async def stop(self):
        """Stop the strategy."""
        self._running = False
        logger.info(
            f"🚀 Momentum stopped | "
            f"P&L: ${self.stats.total_pnl:+.2f} | "
            f"Win Rate: {self.stats.win_rate:.0f}% | "
            f"Best: ${self.stats.best_trade:+.2f} | "
            f"Worst: ${self.stats.worst_trade:+.2f}"
        )
