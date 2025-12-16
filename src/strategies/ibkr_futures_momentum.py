import logging
import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass
import statistics

from src.strategies.base_strategy import BaseStrategy, StrategySignal, SignalType
from src.exchanges.ibkr_client import IBKRClient
from src.db.client import SupabaseClient
from src.exchanges.base import OrderSide, OrderType

logger = logging.getLogger(__name__)

@dataclass
class FuturesConfig:
    symbol: str = 'ES' # E-mini S&P 500
    ma_period: int = 20
    trend_threshold_pct: float = 0.5
    position_size: int = 1 # 1 contract

class IBKRFuturesMomentumStrategy(BaseStrategy):
    """
    Simple Momentum Strategy for Futures (e.g., ES, NQ).
    Buy when price is significantly above Moving Average.
    Sell when price is significantly below Moving Average.
    """
    
    def __init__(
        self,
        ibkr_client: IBKRClient,
        db_client: SupabaseClient,
        symbol: str = 'ES',
        scan_interval_seconds: int = 60,
    ):
        self.ibkr = ibkr_client
        self.db = db_client
        self.config = FuturesConfig(symbol=symbol)
        self.scan_interval = scan_interval_seconds
        self.running = False
        self.enabled = True # Controlled by bot_runner

    async def start(self):
        self.running = True
        logger.info(f"Futures Momentum Bot started ({self.config.symbol})")
        while self.running:
            if self.enabled:
                try:
                    await self.check_signals()
                except Exception as e:
                    logger.error(f"Error in futures momentum: {e}")
            
            await asyncio.sleep(self.scan_interval)

    async def stop(self):
        self.running = False

    async def check_signals(self):
        # 1. Get History
        try:
            klines = await self.ibkr.get_ohlcv(self.config.symbol, timeframe='1h', limit=self.config.ma_period + 5)
        except Exception as e:
            logger.warning(f"Could not fetch history for {self.config.symbol}: {e}")
            return

        if not klines or len(klines) < self.config.ma_period:
            return

        # Close prices
        closes = [k[4] for k in klines]
        current_price = closes[-1]
        
        # Calculate MA
        ma_slice = closes[-self.config.ma_period:]
        ma = statistics.mean(ma_slice)
        
        # Deviation
        deviation_pct = ((current_price - ma) / ma) * 100
        
        logger.info(f"Futures {self.config.symbol}: Price={current_price:.2f}, MA({self.config.ma_period})={ma:.2f}, Dev={deviation_pct:.2f}%")
        
        # Signal Generation
        signal = None
        reason = ""
        
        if deviation_pct > self.config.trend_threshold_pct:
            signal = OrderSide.BUY
            reason = f"Price {deviation_pct:.2f}% above MA"
        elif deviation_pct < -self.config.trend_threshold_pct:
            signal = OrderSide.SELL
            reason = f"Price {deviation_pct:.2f}% below MA"
            
        if signal:
            # Check current position first to avoid stacking too many
            positions = await self.ibkr.get_positions(self.config.symbol)
            current_qty = sum(p.size * (1 if p.side.value == 'LONG' else -1) for p in positions)
            
            # Simple logic: Go Long if Flat or Short. Go Short if Flat or Long.
            # Don't add to existing position of same side (simplify)
            
            action = None
            if signal == OrderSide.BUY and current_qty <= 0:
                action = OrderSide.BUY
            elif signal == OrderSide.SELL and current_qty >= 0:
                action = OrderSide.SELL
                
            if action:
                logger.info(f"🚀 FUTURES SIGNAL: {action} {self.config.symbol} ({reason})")
                
                # Execution (Mock/Paper for safety unless configured)
                # await self.ibkr.create_order(self.config.symbol, action, OrderType.MARKET, self.config.position_size)
                
                self.db.log_opportunity({
                    "id": f"futures_{self.config.symbol}_{int(datetime.now().timestamp())}",
                    "strategy": "futures_momentum",
                    "buy_platform": "IBKR",
                    "sell_platform": "N/A",
                    "buy_price": current_price if action == OrderSide.BUY else 0,
                    "sell_price": current_price if action == OrderSide.SELL else 0,
                    "profit_percent": 0.0,
                    "buy_market_name": f"{action} {self.config.symbol}",
                    "sell_market_name": reason,
                    "detected_at": datetime.now(timezone.utc).isoformat()
                })
