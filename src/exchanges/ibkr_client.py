import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from ib_insync import IB, Stock, MarketOrder, LimitOrder, Position as IBPosition, Order as IBOrder

from src.exchanges.base import (
    BaseExchange, Ticker, Balance, Order, Position,
    OrderSide, OrderType, PositionSide
)

logger = logging.getLogger(__name__)

class IBKRClient(BaseExchange):
    """
    Interactive Brokers client using ib_insync.
    Connects to a running IB Gateway/TWS instance.
    """
    
    def __init__(self, host: str = '127.0.0.1', port: int = 4002, client_id: int = 1,
                 account: str = '', sandbox: bool = True):
        super().__init__(api_key=None, api_secret=None, sandbox=sandbox)
        self.host = host
        self.port = port
        self.client_id = client_id
        self.account = account
        self.ib = IB()
        self._connected = False

    async def initialize(self) -> bool:
        """Connect to IB Gateway."""
        try:
            logger.info(f"Connecting to IBKR Gateway at {self.host}:{self.port} (Client ID: {self.client_id})...")
            await self.ib.connectAsync(self.host, self.port, self.client_id)
            self._connected = True
            logger.info("Successfully connected to IBKR Gateway")
            
            # Request account summary updates
            self.ib.reqAccountSummary()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IBKR: {e}")
            return False

    async def close(self) -> None:
        """Disconnect from IB Gateway."""
        if self.ib.isConnected():
            self.ib.disconnect()
            self._connected = False
            logger.info("Disconnected from IBKR")

    # =========================================================================
    # Market Data
    # =========================================================================

    async def get_ticker(self, symbol: str) -> Ticker:
        """
        Get ticker. Symbol format: 'AAPL' (Stock) or 'EURUSD' (Forex).
        Simplified for Stocks for now.
        """
        contract = Stock(symbol, 'SMART', 'USD')
        self.ib.qualifyContracts(contract)
        
        # Request market data
        ticker = self.ib.reqMktData(contract, '', False, False)
        
        # Wait for data (market data in IB is streaming, wait for initial snapshot)
        for _ in range(20):
            if ticker.last or ticker.bid or ticker.ask:
                break
            await asyncio.sleep(0.1)
            
        return Ticker(
            symbol=symbol,
            bid=ticker.bid if ticker.bid else 0.0,
            ask=ticker.ask if ticker.ask else 0.0,
            last=ticker.last if ticker.last else 0.0,
            volume_24h=0.0, # IB doesn't give 24h vol easily in snapshot
            timestamp=ticker.time or datetime.now()
        )

    async def get_tickers(self, symbols: Optional[List[str]] = None) -> Dict[str, Ticker]:
        """Get tickers for multiple symbols."""
        tickers = {}
        if symbols:
            for sym in symbols:
                try:
                    tickers[sym] = await self.get_ticker(sym)
                except Exception as e:
                    logger.error(f"Error fetching ticker for {sym}: {e}")
        return tickers

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """Get order book (Not fully implemented for IBKR in this simplified client)."""
        # IBKR requires subscribing to market depth
        return {'bids': [], 'asks': []}

    async def get_ohlcv(self, symbol: str, timeframe: str = '1h', limit: int = 100) -> List[List[float]]:
        """Get historical data."""
        # Map timeframe to IB duration string
        duration = '1 D' # Default
        bar_size = '1 hour'
        if timeframe == '1m':
            duration = '2 H'
            bar_size = '1 min'
        elif timeframe == '15m':
            duration = '1 D'
            bar_size = '15 mins'
        
        contract = Stock(symbol, 'SMART', 'USD')
        bars = await self.ib.reqHistoricalDataAsync(
            contract, endDateTime='', durationStr=duration,
            barSizeSetting=bar_size, whatToShow='TRADES', useRTH=True
        )
        
        # Format: [timestamp, open, high, low, close, volume]
        return [[b.date.timestamp() * 1000, b.open, b.high, b.low, b.close, b.volume] for b in bars]

    # =========================================================================
    # Account
    # =========================================================================

    async def get_balance(self, asset: Optional[str] = None) -> Dict[str, Balance]:
        """Get account balances."""
        # requestAccountSummary returns list of TagValue
        # We look for TotalCashValue
        tags = self.ib.accountSummary()
        balances = {}
        
        # Parse 'TotalCashValue' for USD
        usd_val = 0.0
        for tag in tags:
            if tag.tag == 'TotalCashValue' and tag.currency == 'USD':
                usd_val = float(tag.value)
                break
                
        balances['USD'] = Balance(
            asset='USD',
            free=usd_val, # IB doesn't strictly split free/locked in same way as crypto exchanges
            locked=0.0,
            total=usd_val
        )
        return balances

    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions."""
        ib_positions = self.ib.positions()
        positions = []
        
        for p in ib_positions:
            # Filter by account if specified
            if self.account and p.account != self.account:
                continue
                
            sym = p.contract.symbol
            if symbol and sym != symbol:
                continue
                
            side = PositionSide.LONG if p.position > 0 else PositionSide.SHORT
            size = abs(p.position)
            
            positions.append(Position(
                symbol=sym,
                side=side,
                size=size,
                entry_price=p.avgCost,
                mark_price=0.0, # Would need real-time ticker
                unrealized_pnl=0.0, # Needs calculation with market price
                liquidation_price=0.0,
                leverage=1.0 # Stocks default
            ))
            
        return positions

    # =========================================================================
    # Trading
    # =========================================================================

    async def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                          amount: float, price: Optional[float] = None,
                          params: Optional[Dict] = None) -> Order:
        """Create and place a new order."""
        contract = Stock(symbol, 'SMART', 'USD')
        action = 'BUY' if side == OrderSide.BUY else 'SELL'
        
        ib_order = None
        if order_type == OrderType.MARKET:
            ib_order = MarketOrder(action, amount)
        elif order_type == OrderType.LIMIT and price:
            ib_order = LimitOrder(action, amount, price)
        else:
            raise ValueError(f"Unsupported order type: {order_type}")
            
        if params and 'account' in params:
            ib_order.account = params['account']
            
        trade = self.ib.placeOrder(contract, ib_order)
        
        # Wait for acknowledgment
        count = 0 
        while not trade.orderStatus.orderId and count < 20:
             await asyncio.sleep(0.1)
             count += 1

        return Order(
            id=str(trade.order.orderId),
            symbol=symbol,
            side=side,
            type=order_type,
            price=price,
            amount=amount,
            filled=trade.filled(),
            remaining=trade.remaining(),
            status=trade.orderStatus.status,
            timestamp=datetime.now()
        )

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        # Need to implement
        return True

    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        # Need to implement
        return Order(id=order_id, symbol=symbol, side=OrderSide.BUY, type=OrderType.MARKET, price=0, amount=0, filled=0, remaining=0, status='unknown', timestamp=datetime.now())

    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get open orders."""
        return []

    # =========================================================================
    # Futures (Placeholder)
    # =========================================================================
    async def get_funding_rate(self, symbol: str): pass
    async def get_funding_rates(self, symbols: Optional[List[str]] = None): pass
    async def get_funding_rate_history(self, symbol: str, limit: int = 100): pass
    async def set_leverage(self, symbol: str, leverage: int) -> bool: return True
