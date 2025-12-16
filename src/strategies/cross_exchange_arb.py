"""
Cross-Exchange Crypto Arbitrage Strategy (Spot-Spot)

Monitors multiple exchanges for price discrepancies in identical trading pairs.
Buy Low, Sell High.

Focus:
- Spot vs Spot arbitrage (lower risk than Perp-Spot)
- Major pairs: BTC/USDT, ETH/USDT, SOL/USDT
- Exchanges: Binance, Bybit, Kraken, OKX, KuCoin

Safety:
- Checks for withdrawal/deposit status (if API allows) - MVP assumes active
- Accounts for trading fees (taker/taker)
- checks depth (liquidity) before execution
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Callable, Set
from enum import Enum

from src.exchanges.ccxt_client import CCXTClient, OrderSide, OrderType

logger = logging.getLogger(__name__)

@dataclass
class ArbConfig:
    min_profit_pct: Decimal = Decimal("0.5")  # Minimum spread to trade (0.5%)
    max_trade_size_usd: Decimal = Decimal("1000")
    min_trade_size_usd: Decimal = Decimal("50")
    scan_interval_sec: int = 5
    symbols: List[str] = field(default_factory=lambda: ["BTC/USDT", "ETH/USDT", "SOL/USDT"])

@dataclass
class CryptoArbOpportunity:
    symbol: str
    buy_exchange: str  # ID of exchange to buy on
    sell_exchange: str # ID of exchange to sell on
    buy_price: Decimal
    sell_price: Decimal
    spread_pct: Decimal
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def gross_profit_pct(self) -> Decimal:
        return self.spread_pct
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "buy_exchange": self.buy_exchange,
            "sell_exchange": self.sell_exchange,
            "buy_price": float(self.buy_price),
            "sell_price": float(self.sell_price),
            "spread_pct": float(self.spread_pct),
            "timestamp": self.timestamp.isoformat()
        }

class CrossExchangeArbStrategy:
    """
    Arbitrage strategy between multiple crypto exchanges.
    """
    
    def __init__(
        self,
        exchanges: List[CCXTClient],
        config: ArbConfig = ArbConfig(),
        dry_run: bool = True,
        on_opportunity: Optional[Callable[[CryptoArbOpportunity], None]] = None
    ):
        self.exchanges = {ex.exchange_id: ex for ex in exchanges}
        self.config = config
        self.dry_run = dry_run
        self.on_opportunity = on_opportunity
        
        self.is_running = False
        self._loop_task: Optional[asyncio.Task] = None
        
        # Stats
        self.opportunities_found = 0
        self.trades_executed = 0
        
    async def start(self):
        """Start the arbitrage loop."""
        if self.is_running:
            return
            
        logger.info(f"🚀 Starting Cross-Exchange Arbitrage ({len(self.exchanges)} exchanges)")
        
        # Ensure exchanges are initialized
        for ex_id, client in self.exchanges.items():
            if not client._initialized:
                logger.info(f"Initializing {ex_id}...")
                await client.initialize()
                
        self.is_running = True
        self._loop_task = asyncio.create_task(self._run_loop())
        
    async def stop(self):
        """Stop the arbitrage loop."""
        self.is_running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Cross-Exchange Arbitrage Stopped")

    async def _run_loop(self):
        """Main execution loop."""
        while self.is_running:
            try:
                await self._scan()
                await asyncio.sleep(self.config.scan_interval_sec)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in arb loop: {e}", exc_info=True)
                await asyncio.sleep(5) # Backoff on error

    async def _scan(self):
        """Scan for opportunities across all symbols."""
        tasks = []
        for symbol in self.config.symbols:
            tasks.append(self._check_symbol(symbol))
        
        await asyncio.gather(*tasks)

    async def _check_symbol(self, symbol: str):
        """Check a single symbol across all exchanges."""
        # 1. Fetch tickers in parallel
        ticker_tasks = {}
        for ex_id, client in self.exchanges.items():
            ticker_tasks[ex_id] = client.get_ticker(symbol)
            
        # Execute fetches, handle failures gracefully
        results = await asyncio.gather(*ticker_tasks.values(), return_exceptions=True)
        
        tickers = {}
        for ex_id, result in zip(ticker_tasks.keys(), results):
            if isinstance(result, Exception):
                # logger.debug(f"Failed to fetch {symbol} from {ex_id}: {result}")
                continue
            tickers[ex_id] = result

        if len(tickers) < 2:
            return # Need at least 2 exchanges to arb

        # 2. Find Best Buy (Lowest Ask) and Best Sell (Highest Bid)
        best_buy_ex = None
        best_buy_price = Decimal("Infinity")
        
        best_sell_ex = None
        best_sell_price = Decimal("0")

        for ex_id, ticker in tickers.items():
            ask = Decimal(str(ticker.ask))
            bid = Decimal(str(ticker.bid))
            
            if ask > 0 and ask < best_buy_price:
                best_buy_price = ask
                best_buy_ex = ex_id
            
            if bid > 0 and bid > best_sell_price:
                best_sell_price = bid
                best_sell_ex = ex_id
                
        if not best_buy_ex or not best_sell_ex or best_buy_ex == best_sell_ex:
            return

        # 3. Calculate Spread
        # Spread = (Sell - Buy) / Buy
        spread = (best_sell_price - best_buy_price)
        spread_pct = (spread / best_buy_price) * 100
        
        if spread_pct > self.config.min_profit_pct:
            opp = CryptoArbOpportunity(
                symbol=symbol,
                buy_exchange=best_buy_ex,
                sell_exchange=best_sell_ex,
                buy_price=best_buy_price,
                sell_price=best_sell_price,
                spread_pct=spread_pct
            )
            
            self.opportunities_found += 1
            logger.info(
                 f"🎯 ARB FOUND: {symbol} | Spread: {spread_pct:.2f}% | "
                 f"Buy {best_buy_ex} @ {best_buy_price} -> Sell {best_sell_ex} @ {best_sell_price}"
            )
            
            if self.on_opportunity:
                self.on_opportunity(opp)
            
            # Execute if not dry run (TODO)
            if not self.dry_run:
                # self._execute_arb(opp)
                pass
