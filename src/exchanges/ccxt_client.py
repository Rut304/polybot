"""
CCXT-based exchange client supporting 106+ crypto exchanges.
Provides unified API for spot, margin, and futures trading.

Supported exchanges include:
- Binance, Binance Futures
- Bybit
- OKX
- Kraken
- Coinbase Pro
- KuCoin
- Gate.io
- Bitget
- And 100+ more

Usage:
    client = CCXTClient('binance', api_key, api_secret)
    await client.initialize()
    
    # Get funding rates (for perpetual futures)
    rates = await client.get_funding_rates(['BTC/USDT:USDT', 'ETH/USDT:USDT'])
    
    # Place a trade
    order = await client.create_order('BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 0.001, 50000)
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from dataclasses import dataclass

try:
    import ccxt.async_support as ccxt
    CCXT_AVAILABLE = True
except ImportError:
    CCXT_AVAILABLE = False
    ccxt = None

from .base import (
    BaseExchange, Ticker, Balance, Order, Position, FundingRate,
    OrderSide, OrderType, PositionSide
)


logger = logging.getLogger(__name__)


# Mapping of exchange names to CCXT exchange IDs
EXCHANGE_MAPPING = {
    'binance': 'binanceus',  # Use Binance.US for US users
    'binanceus': 'binanceus',
    'binance_intl': 'binance',  # International Binance (not available in US)
    'binance_futures': 'binanceusdm',
    'binance_coin_futures': 'binancecoinm',
    'bybit': 'bybit',
    'okx': 'okx',
    'kraken': 'kraken',
    'kraken_futures': 'krakenfutures',
    'coinbase': 'coinbase',  # Updated to use coinbase (not coinbasepro which is deprecated)
    'coinbasepro': 'coinbase',
    'kucoin': 'kucoin',
    'kucoin_futures': 'kucoinfutures',
    'gate': 'gate',
    'gate_futures': 'gateio',
    'bitget': 'bitget',
    'huobi': 'huobi',
    'mexc': 'mexc',
    'phemex': 'phemex',
    'deribit': 'deribit',  # Options exchange
}

# Symbols for funding rate arbitrage
FUNDING_RATE_SYMBOLS = [
    'BTC/USDT:USDT',
    'ETH/USDT:USDT',
    'SOL/USDT:USDT',
    'BNB/USDT:USDT',
    'XRP/USDT:USDT',
    'DOGE/USDT:USDT',
    'ADA/USDT:USDT',
    'AVAX/USDT:USDT',
    'LINK/USDT:USDT',
    'MATIC/USDT:USDT',
]


class CCXTClient(BaseExchange):
    """
    CCXT-based exchange client for crypto trading.
    
    Supports 106+ exchanges with a unified API.
    """
    
    def __init__(self, exchange_id: str = 'binance',
                 api_key: Optional[str] = None,
                 api_secret: Optional[str] = None,
                 password: Optional[str] = None,
                 sandbox: bool = False):
        """
        Initialize CCXT client.
        
        Args:
            exchange_id: Exchange identifier (e.g., 'binance', 'bybit')
            api_key: API key
            api_secret: API secret
            password: API password (for exchanges that require it)
            sandbox: Use testnet/sandbox mode
        """
        super().__init__(api_key, api_secret, sandbox)
        
        if not CCXT_AVAILABLE:
            raise ImportError("CCXT is not installed. Run: pip install ccxt")
        
        # Map friendly names to CCXT exchange IDs
        self.exchange_id = EXCHANGE_MAPPING.get(exchange_id.lower(), exchange_id)
        self.password = password
        self.exchange: Optional[ccxt.Exchange] = None
        self._session = None  # aiohttp session for IPv4 connections
        
    async def initialize(self) -> bool:
        """Initialize connection to exchange."""
        try:
            # Get exchange class
            exchange_class = getattr(ccxt, self.exchange_id)
            
            # Determine if this exchange supports futures
            # Spot-only exchanges: binanceus, coinbase, kraken (main), etc.
            spot_only_exchanges = ['binanceus', 'coinbase', 'kraken', 'gemini']
            default_type = 'spot' if self.exchange_id in spot_only_exchanges else 'future'
            
            # Force IPv4 connections for exchanges that don't support IPv6
            # Binance US specifically returns error -71012 "IPv6 not supported"
            import aiohttp
            import socket
            ipv4_connector = aiohttp.TCPConnector(family=socket.AF_INET)
            
            # Configure exchange with IPv4-only session
            # This fixes Binance US error -71012 "IPv6 not supported"
            session = aiohttp.ClientSession(connector=ipv4_connector)
            
            config = {
                'enableRateLimit': True,  # Built-in rate limiting
                'session': session,  # Use IPv4-only session
                'options': {
                    'defaultType': default_type,
                }
            }
            
            if self.api_key:
                config['apiKey'] = self.api_key
            if self.api_secret:
                config['secret'] = self.api_secret
            if self.password:
                config['password'] = self.password
            
            # Create exchange instance
            self.exchange = exchange_class(config)
            self._session = session  # Store for cleanup
            
            # Enable sandbox mode if requested
            if self.sandbox:
                self.exchange.set_sandbox_mode(True)
                logger.info(f"🧪 {self.exchange_id} sandbox mode enabled")
            
            # Load markets
            await self.exchange.load_markets()
            
            self._initialized = True
            market_type = "spot" if default_type == 'spot' else "futures"
            logger.info(
                f"✅ CCXT {self.exchange_id} initialized "
                f"({len(self.exchange.markets)} {market_type} markets)"
            )
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize CCXT {self.exchange_id}: {e}")
            return False
    
    async def close(self) -> None:
        """Close exchange connection."""
        if self.exchange:
            await self.exchange.close()
        if hasattr(self, '_session') and self._session:
            await self._session.close()
        self._initialized = False
    
    # =========================================================================
    # Market Data Methods
    # =========================================================================
    
    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a symbol."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        ticker = await self.exchange.fetch_ticker(symbol)
        return Ticker(
            symbol=symbol,
            bid=ticker.get('bid', 0),
            ask=ticker.get('ask', 0),
            last=ticker.get('last', 0),
            volume_24h=ticker.get('quoteVolume', 0),
            timestamp=datetime.fromtimestamp(ticker['timestamp'] / 1000) if ticker.get('timestamp') else datetime.now()
        )
    
    async def get_tickers(self, symbols: Optional[List[str]] = None) -> Dict[str, Ticker]:
        """Get tickers for multiple symbols."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        tickers = await self.exchange.fetch_tickers(symbols)
        return {
            symbol: Ticker(
                symbol=symbol,
                bid=t.get('bid', 0),
                ask=t.get('ask', 0),
                last=t.get('last', 0),
                volume_24h=t.get('quoteVolume', 0),
                timestamp=datetime.fromtimestamp(t['timestamp'] / 1000) if t.get('timestamp') else datetime.now()
            )
            for symbol, t in tickers.items()
        }
    
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """Get order book for a symbol."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        return await self.exchange.fetch_order_book(symbol, limit)
    
    async def get_ohlcv(self, symbol: str, timeframe: str = '1h', 
                        limit: int = 100) -> List[List[float]]:
        """Get OHLCV candlestick data."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        return await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
    
    # =========================================================================
    # Account Methods
    # =========================================================================
    
    async def get_balance(self, asset: Optional[str] = None) -> Dict[str, Balance]:
        """Get account balances."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        balance = await self.exchange.fetch_balance()
        result = {}
        
        for currency, data in balance.get('total', {}).items():
            if asset and currency != asset:
                continue
            if data > 0:  # Only include non-zero balances
                result[currency] = Balance(
                    asset=currency,
                    free=balance.get('free', {}).get(currency, 0),
                    locked=balance.get('used', {}).get(currency, 0),
                    total=data
                )
        
        return result
    
    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions (for futures accounts)."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        try:
            positions = await self.exchange.fetch_positions(symbols=[symbol] if symbol else None)
            
            return [
                Position(
                    symbol=p['symbol'],
                    side=PositionSide.LONG if p['side'] == 'long' else PositionSide.SHORT,
                    size=abs(p.get('contracts', 0) or p.get('contractSize', 0)),
                    entry_price=p.get('entryPrice', 0),
                    mark_price=p.get('markPrice', 0),
                    unrealized_pnl=p.get('unrealizedPnl', 0),
                    liquidation_price=p.get('liquidationPrice'),
                    leverage=p.get('leverage', 1)
                )
                for p in positions
                if p.get('contracts', 0) != 0 or p.get('contractSize', 0) != 0
            ]
        except Exception as e:
            logger.warning(f"Failed to fetch positions: {e}")
            return []
    
    # =========================================================================
    # Trading Methods
    # =========================================================================
    
    async def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                          amount: float, price: Optional[float] = None,
                          params: Optional[Dict] = None) -> Order:
        """Create a new order."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        ccxt_side = side.value
        ccxt_type = order_type.value
        
        order = await self.exchange.create_order(
            symbol=symbol,
            type=ccxt_type,
            side=ccxt_side,
            amount=amount,
            price=price,
            params=params or {}
        )
        
        return Order(
            id=order['id'],
            symbol=symbol,
            side=side,
            type=order_type,
            price=order.get('price'),
            amount=order.get('amount', 0),
            filled=order.get('filled', 0),
            remaining=order.get('remaining', 0),
            status=order.get('status', 'unknown'),
            timestamp=datetime.fromtimestamp(order['timestamp'] / 1000) if order.get('timestamp') else datetime.now()
        )
    
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        try:
            await self.exchange.cancel_order(order_id, symbol)
            return True
        except Exception as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        order = await self.exchange.fetch_order(order_id, symbol)
        
        return Order(
            id=order['id'],
            symbol=symbol,
            side=OrderSide.BUY if order['side'] == 'buy' else OrderSide.SELL,
            type=OrderType.MARKET if order['type'] == 'market' else OrderType.LIMIT,
            price=order.get('price'),
            amount=order.get('amount', 0),
            filled=order.get('filled', 0),
            remaining=order.get('remaining', 0),
            status=order.get('status', 'unknown'),
            timestamp=datetime.fromtimestamp(order['timestamp'] / 1000) if order.get('timestamp') else datetime.now()
        )
    
    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get all open orders."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        orders = await self.exchange.fetch_open_orders(symbol)
        
        return [
            Order(
                id=o['id'],
                symbol=o['symbol'],
                side=OrderSide.BUY if o['side'] == 'buy' else OrderSide.SELL,
                type=OrderType.MARKET if o['type'] == 'market' else OrderType.LIMIT,
                price=o.get('price'),
                amount=o.get('amount', 0),
                filled=o.get('filled', 0),
                remaining=o.get('remaining', 0),
                status=o.get('status', 'unknown'),
                timestamp=datetime.fromtimestamp(o['timestamp'] / 1000) if o.get('timestamp') else datetime.now()
            )
            for o in orders
        ]
    
    # =========================================================================
    # Futures-Specific Methods (Funding Rate Arbitrage)
    # =========================================================================
    
    def has_symbol(self, symbol: str) -> bool:
        """Check if exchange has a specific symbol."""
        if not self._initialized or not self.exchange:
            return False
        return symbol in self.exchange.markets
    
    def filter_valid_symbols(self, symbols: List[str]) -> List[str]:
        """Filter a list of symbols to only those available on this exchange."""
        if not self._initialized or not self.exchange:
            return []
        return [s for s in symbols if s in self.exchange.markets]
    
    def has_futures_support(self) -> bool:
        """Check if exchange supports futures/perpetual trading."""
        if not self._initialized or not self.exchange:
            return False
        return self.exchange.has.get('fetchFundingRate', False)
    
    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """
        Get current funding rate for a perpetual futures symbol.
        
        This is the KEY method for Funding Rate Arbitrage strategy.
        """
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        try:
            rate_data = await self.exchange.fetch_funding_rate(symbol)
            
            funding_rate = rate_data.get('fundingRate', 0) or 0
            funding_timestamp = rate_data.get('fundingTimestamp')
            next_funding = rate_data.get('nextFundingTimestamp')
            
            # Calculate annualized rate (most exchanges use 8-hour intervals)
            annualized = self.calculate_annualized_funding_rate(funding_rate, 8)
            
            return FundingRate(
                symbol=symbol,
                funding_rate=funding_rate,
                funding_timestamp=datetime.fromtimestamp(funding_timestamp / 1000) if funding_timestamp else datetime.now(),
                next_funding_timestamp=datetime.fromtimestamp(next_funding / 1000) if next_funding else None,
                predicted_rate=rate_data.get('fundingRateIndicative'),
                annualized_rate=annualized
            )
            
        except Exception as e:
            logger.error(f"Failed to fetch funding rate for {symbol}: {e}")
            raise
    
    async def get_funding_rates(self, symbols: Optional[List[str]] = None) -> Dict[str, FundingRate]:
        """
        Get funding rates for multiple symbols.
        
        If no symbols provided, uses default high-volume perpetual symbols.
        """
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        symbols = symbols or FUNDING_RATE_SYMBOLS
        
        # Filter to only symbols available on this exchange
        valid_symbols = self.filter_valid_symbols(symbols)
        if not valid_symbols:
            logger.warning(
                f"No valid funding rate symbols found on {self.exchange_id}. "
                f"Exchange may be spot-only."
            )
            return {}
        
        # Log which symbols were skipped
        skipped = set(symbols) - set(valid_symbols)
        if skipped:
            logger.debug(f"Skipping unavailable symbols: {skipped}")
        
        # Try batch fetch if supported
        try:
            if hasattr(self.exchange, 'fetch_funding_rates'):
                rates_data = await self.exchange.fetch_funding_rates(valid_symbols)
                return {
                    symbol: FundingRate(
                        symbol=symbol,
                        funding_rate=data.get('fundingRate', 0) or 0,
                        funding_timestamp=datetime.fromtimestamp(data['fundingTimestamp'] / 1000) if data.get('fundingTimestamp') else datetime.now(),
                        next_funding_timestamp=datetime.fromtimestamp(data['nextFundingTimestamp'] / 1000) if data.get('nextFundingTimestamp') else None,
                        predicted_rate=data.get('fundingRateIndicative'),
                        annualized_rate=self.calculate_annualized_funding_rate(data.get('fundingRate', 0) or 0, 8)
                    )
                    for symbol, data in rates_data.items()
                }
        except Exception:
            pass  # Fall back to individual fetches
        
        # Fetch individually
        results = {}
        for symbol in valid_symbols:
            try:
                results[symbol] = await self.get_funding_rate(symbol)
            except Exception as e:
                logger.warning(f"Skipping {symbol}: {e}")
        
        return results
    
    async def get_funding_rate_history(self, symbol: str, 
                                        limit: int = 100) -> List[FundingRate]:
        """Get historical funding rates."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        try:
            history = await self.exchange.fetch_funding_rate_history(symbol, limit=limit)
            
            return [
                FundingRate(
                    symbol=symbol,
                    funding_rate=h.get('fundingRate', 0) or 0,
                    funding_timestamp=datetime.fromtimestamp(h['timestamp'] / 1000) if h.get('timestamp') else datetime.now(),
                    next_funding_timestamp=None,
                    predicted_rate=None,
                    annualized_rate=self.calculate_annualized_funding_rate(h.get('fundingRate', 0) or 0, 8)
                )
                for h in history
            ]
        except Exception as e:
            logger.error(f"Failed to fetch funding rate history for {symbol}: {e}")
            return []
    
    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        try:
            await self.exchange.set_leverage(leverage, symbol)
            return True
        except Exception as e:
            logger.error(f"Failed to set leverage for {symbol}: {e}")
            return False
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    def get_supported_exchanges(self) -> List[str]:
        """Get list of supported exchanges."""
        return list(EXCHANGE_MAPPING.keys())
    
    async def get_exchange_info(self) -> Dict[str, Any]:
        """Get exchange information."""
        if not self._initialized:
            raise RuntimeError("Exchange not initialized")
        
        return {
            'id': self.exchange.id,
            'name': self.exchange.name,
            'countries': self.exchange.countries,
            'has_fetch_funding_rate': self.exchange.has.get('fetchFundingRate', False),
            'has_fetch_positions': self.exchange.has.get('fetchPositions', False),
            'markets_count': len(self.exchange.markets),
            'sandbox': self.sandbox,
        }
