"""
Alpaca Markets client for commission-free stock and crypto trading.

Features:
- Commission-free stock trading
- Crypto trading
- Paper trading support
- REST + WebSocket API
- Fractional shares

Usage:
    client = AlpacaClient(api_key, api_secret, paper=True)
    await client.initialize()
    
    # Get stock prices
    ticker = await client.get_ticker('AAPL')
    
    # Place a trade
    order = await client.create_order('AAPL', OrderSide.BUY, OrderType.MARKET, 10)
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from dataclasses import dataclass

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False

from .base import (
    BaseExchange, Ticker, Balance, Order, Position, FundingRate,
    OrderSide, OrderType, PositionSide
)


logger = logging.getLogger(__name__)


# Alpaca API endpoints
ALPACA_PAPER_URL = "https://paper-api.alpaca.markets"
ALPACA_LIVE_URL = "https://api.alpaca.markets"
ALPACA_DATA_URL = "https://data.alpaca.markets"


class AlpacaClient(BaseExchange):
    """
    Alpaca Markets client for stock and crypto trading.
    
    Features:
    - Commission-free trading
    - Paper trading mode
    - Fractional shares
    - REST API
    """
    
    def __init__(self, api_key: Optional[str] = None,
                 api_secret: Optional[str] = None,
                 paper: bool = True):
        """
        Initialize Alpaca client.
        
        Args:
            api_key: Alpaca API key
            api_secret: Alpaca API secret
            paper: Use paper trading (sandbox) mode
        """
        super().__init__(api_key, api_secret, paper)
        
        if not AIOHTTP_AVAILABLE:
            raise ImportError("aiohttp is not installed. Run: pip install aiohttp")
        
        self.paper = paper
        self.base_url = ALPACA_PAPER_URL if paper else ALPACA_LIVE_URL
        self.data_url = ALPACA_DATA_URL
        self.session: Optional[aiohttp.ClientSession] = None
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API request headers."""
        return {
            'APCA-API-KEY-ID': self.api_key or '',
            'APCA-API-SECRET-KEY': self.api_secret or '',
            'Content-Type': 'application/json'
        }
    
    async def initialize(self) -> bool:
        """Initialize connection to Alpaca."""
        try:
            self.session = aiohttp.ClientSession()
            
            # Verify credentials by fetching account
            async with self.session.get(
                f"{self.base_url}/v2/account",
                headers=self._get_headers()
            ) as response:
                if response.status == 200:
                    account = await response.json()
                    self._initialized = True
                    mode = "paper" if self.paper else "live"
                    logger.info(f"✅ Alpaca {mode} initialized (Account: {account.get('account_number', 'N/A')})")
                    return True
                else:
                    error = await response.text()
                    logger.error(f"❌ Alpaca authentication failed: {error}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Failed to initialize Alpaca: {e}")
            return False
    
    async def close(self) -> None:
        """Close connection to Alpaca."""
        if self.session:
            await self.session.close()
            self._initialized = False
    
    # =========================================================================
    # Market Data Methods
    # =========================================================================
    
    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a stock/crypto symbol."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        # Determine if crypto or stock
        is_crypto = '/' in symbol or symbol.endswith('USD')
        
        if is_crypto:
            url = f"{self.data_url}/v1beta3/crypto/us/latest/quotes?symbols={symbol}"
        else:
            url = f"{self.data_url}/v2/stocks/{symbol}/quotes/latest"
        
        async with self.session.get(url, headers=self._get_headers()) as response:
            if response.status != 200:
                raise Exception(f"Failed to get ticker: {await response.text()}")
            
            data = await response.json()
            
            if is_crypto:
                quote = data.get('quotes', {}).get(symbol, {})
            else:
                quote = data.get('quote', {})
            
            return Ticker(
                symbol=symbol,
                bid=quote.get('bp', 0),
                ask=quote.get('ap', 0),
                last=(quote.get('bp', 0) + quote.get('ap', 0)) / 2,  # Mid price
                volume_24h=0,  # Would need separate call
                timestamp=datetime.now()
            )
    
    async def get_tickers(self, symbols: Optional[List[str]] = None) -> Dict[str, Ticker]:
        """Get tickers for multiple symbols."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        if not symbols:
            return {}
        
        # Separate crypto and stock symbols
        crypto_symbols = [s for s in symbols if '/' in s or s.endswith('USD')]
        stock_symbols = [s for s in symbols if s not in crypto_symbols]
        
        results = {}
        
        # Fetch stock quotes
        if stock_symbols:
            symbols_param = ','.join(stock_symbols)
            url = f"{self.data_url}/v2/stocks/quotes/latest?symbols={symbols_param}"
            
            async with self.session.get(url, headers=self._get_headers()) as response:
                if response.status == 200:
                    data = await response.json()
                    for symbol, quote in data.get('quotes', {}).items():
                        results[symbol] = Ticker(
                            symbol=symbol,
                            bid=quote.get('bp', 0),
                            ask=quote.get('ap', 0),
                            last=(quote.get('bp', 0) + quote.get('ap', 0)) / 2,
                            volume_24h=0,
                            timestamp=datetime.now()
                        )
        
        # Fetch crypto quotes
        if crypto_symbols:
            symbols_param = ','.join(crypto_symbols)
            url = f"{self.data_url}/v1beta3/crypto/us/latest/quotes?symbols={symbols_param}"
            
            async with self.session.get(url, headers=self._get_headers()) as response:
                if response.status == 200:
                    data = await response.json()
                    for symbol, quote in data.get('quotes', {}).items():
                        results[symbol] = Ticker(
                            symbol=symbol,
                            bid=quote.get('bp', 0),
                            ask=quote.get('ap', 0),
                            last=(quote.get('bp', 0) + quote.get('ap', 0)) / 2,
                            volume_24h=0,
                            timestamp=datetime.now()
                        )
        
        return results
    
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """Get order book for a symbol."""
        # Alpaca provides quotes, not full order books for most assets
        ticker = await self.get_ticker(symbol)
        return {
            'bids': [[ticker.bid, 0]],  # [price, size]
            'asks': [[ticker.ask, 0]],
            'timestamp': ticker.timestamp
        }
    
    async def get_ohlcv(self, symbol: str, timeframe: str = '1Hour', 
                        limit: int = 100) -> List[List[float]]:
        """Get OHLCV candlestick data."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        is_crypto = '/' in symbol or symbol.endswith('USD')
        
        if is_crypto:
            url = f"{self.data_url}/v1beta3/crypto/us/bars?symbols={symbol}&timeframe={timeframe}&limit={limit}"
        else:
            url = f"{self.data_url}/v2/stocks/{symbol}/bars?timeframe={timeframe}&limit={limit}"
        
        async with self.session.get(url, headers=self._get_headers()) as response:
            if response.status != 200:
                raise Exception(f"Failed to get OHLCV: {await response.text()}")
            
            data = await response.json()
            bars = data.get('bars', {}).get(symbol, []) if is_crypto else data.get('bars', [])
            
            # Convert to CCXT format: [timestamp, open, high, low, close, volume]
            return [
                [
                    int(datetime.fromisoformat(bar['t'].replace('Z', '+00:00')).timestamp() * 1000),
                    bar['o'],
                    bar['h'],
                    bar['l'],
                    bar['c'],
                    bar['v']
                ]
                for bar in bars
            ]
    
    # =========================================================================
    # Account Methods
    # =========================================================================
    
    async def get_balance(self, asset: Optional[str] = None) -> Dict[str, Balance]:
        """Get account balances."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        async with self.session.get(
            f"{self.base_url}/v2/account",
            headers=self._get_headers()
        ) as response:
            if response.status != 200:
                raise Exception(f"Failed to get balance: {await response.text()}")
            
            account = await response.json()
            
            return {
                'USD': Balance(
                    asset='USD',
                    free=float(account.get('buying_power', 0)),
                    locked=float(account.get('cash', 0)) - float(account.get('buying_power', 0)),
                    total=float(account.get('portfolio_value', 0))
                )
            }
    
    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        url = f"{self.base_url}/v2/positions"
        if symbol:
            url = f"{self.base_url}/v2/positions/{symbol}"
        
        async with self.session.get(url, headers=self._get_headers()) as response:
            if response.status == 404:
                return []
            if response.status != 200:
                raise Exception(f"Failed to get positions: {await response.text()}")
            
            data = await response.json()
            positions = [data] if symbol else data
            
            return [
                Position(
                    symbol=p['symbol'],
                    side=PositionSide.LONG if float(p.get('qty', 0)) > 0 else PositionSide.SHORT,
                    size=abs(float(p.get('qty', 0))),
                    entry_price=float(p.get('avg_entry_price', 0)),
                    mark_price=float(p.get('current_price', 0)),
                    unrealized_pnl=float(p.get('unrealized_pl', 0)),
                    liquidation_price=None,
                    leverage=1
                )
                for p in positions
            ]
    
    # =========================================================================
    # Trading Methods
    # =========================================================================
    
    async def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                          amount: float, price: Optional[float] = None,
                          params: Optional[Dict] = None) -> Order:
        """Create a new order."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        order_data = {
            'symbol': symbol,
            'qty': str(amount),
            'side': side.value,
            'type': order_type.value,
            'time_in_force': 'day'
        }
        
        if price and order_type == OrderType.LIMIT:
            order_data['limit_price'] = str(price)
        
        if params:
            order_data.update(params)
        
        async with self.session.post(
            f"{self.base_url}/v2/orders",
            headers=self._get_headers(),
            json=order_data
        ) as response:
            if response.status not in [200, 201]:
                raise Exception(f"Failed to create order: {await response.text()}")
            
            order = await response.json()
            
            return Order(
                id=order['id'],
                symbol=symbol,
                side=side,
                type=order_type,
                price=float(order.get('limit_price')) if order.get('limit_price') else None,
                amount=float(order.get('qty', 0)),
                filled=float(order.get('filled_qty', 0)),
                remaining=float(order.get('qty', 0)) - float(order.get('filled_qty', 0)),
                status=order.get('status', 'unknown'),
                timestamp=datetime.now()
            )
    
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        async with self.session.delete(
            f"{self.base_url}/v2/orders/{order_id}",
            headers=self._get_headers()
        ) as response:
            return response.status in [200, 204]
    
    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        async with self.session.get(
            f"{self.base_url}/v2/orders/{order_id}",
            headers=self._get_headers()
        ) as response:
            if response.status != 200:
                raise Exception(f"Failed to get order: {await response.text()}")
            
            order = await response.json()
            
            return Order(
                id=order['id'],
                symbol=order['symbol'],
                side=OrderSide.BUY if order['side'] == 'buy' else OrderSide.SELL,
                type=OrderType.MARKET if order['type'] == 'market' else OrderType.LIMIT,
                price=float(order.get('limit_price')) if order.get('limit_price') else None,
                amount=float(order.get('qty', 0)),
                filled=float(order.get('filled_qty', 0)),
                remaining=float(order.get('qty', 0)) - float(order.get('filled_qty', 0)),
                status=order.get('status', 'unknown'),
                timestamp=datetime.now()
            )
    
    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get all open orders."""
        if not self._initialized:
            raise RuntimeError("Alpaca not initialized")
        
        url = f"{self.base_url}/v2/orders?status=open"
        if symbol:
            url += f"&symbols={symbol}"
        
        async with self.session.get(url, headers=self._get_headers()) as response:
            if response.status != 200:
                raise Exception(f"Failed to get orders: {await response.text()}")
            
            orders = await response.json()
            
            return [
                Order(
                    id=o['id'],
                    symbol=o['symbol'],
                    side=OrderSide.BUY if o['side'] == 'buy' else OrderSide.SELL,
                    type=OrderType.MARKET if o['type'] == 'market' else OrderType.LIMIT,
                    price=float(o.get('limit_price')) if o.get('limit_price') else None,
                    amount=float(o.get('qty', 0)),
                    filled=float(o.get('filled_qty', 0)),
                    remaining=float(o.get('qty', 0)) - float(o.get('filled_qty', 0)),
                    status=o.get('status', 'unknown'),
                    timestamp=datetime.now()
                )
                for o in orders
            ]
    
    # =========================================================================
    # Futures-Specific Methods (Not supported by Alpaca)
    # =========================================================================
    
    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """Not supported - Alpaca doesn't have perpetual futures."""
        raise NotImplementedError("Alpaca does not support perpetual futures")
    
    async def get_funding_rates(self, symbols: Optional[List[str]] = None) -> Dict[str, FundingRate]:
        """Not supported - Alpaca doesn't have perpetual futures."""
        raise NotImplementedError("Alpaca does not support perpetual futures")
    
    async def get_funding_rate_history(self, symbol: str, limit: int = 100) -> List[FundingRate]:
        """Not supported - Alpaca doesn't have perpetual futures."""
        raise NotImplementedError("Alpaca does not support perpetual futures")
    
    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Not supported - Alpaca uses margin accounts differently."""
        raise NotImplementedError("Alpaca does not support setting leverage per symbol")
