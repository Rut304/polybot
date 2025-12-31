"""
Webull client for stock, crypto, and options trading.

Features:
- Commission-free stock trading
- Options trading
- Crypto trading (limited)
- Paper trading support via sandbox mode
- Extended hours trading
- Multi-tenant support (per-user credentials)

Usage:
    # Direct initialization with credentials
    client = WebullClient(email, password, device_id, trading_pin)
    await client.initialize()

    # Multi-tenant: Create from user's stored credentials
    client = await WebullClient.create_for_user(user_id="uuid-here")

    # Get stock prices
    ticker = await client.get_ticker('AAPL')

    # Place a trade
    order = await client.create_order(
        'AAPL', OrderSide.BUY, OrderType.MARKET, 10
    )

Dependencies:
    pip install webull
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

try:
    from webull import webull, paper_webull
    WEBULL_AVAILABLE = True
except ImportError:
    WEBULL_AVAILABLE = False
    webull = None
    paper_webull = None

from .base import (
    BaseExchange, Ticker, Balance, Order, Position, FundingRate,
    OrderSide, OrderType, PositionSide
)


logger = logging.getLogger(__name__)

# Thread pool for running sync webull calls
_executor = ThreadPoolExecutor(max_workers=4)


class WebullClient(BaseExchange):
    """
    Webull client for stock, options, and crypto trading.

    Features:
    - Commission-free trading
    - Paper trading mode
    - Extended hours trading
    - Options trading
    - Multi-tenant support via create_for_user()
    """

    def __init__(
        self,
        email: Optional[str] = None,
        password: Optional[str] = None,
        device_id: Optional[str] = None,
        trading_pin: Optional[str] = None,
        paper: bool = True,
        user_id: Optional[str] = None
    ):
        """
        Initialize Webull client.

        Args:
            email: Webull account email
            password: Webull account password
            device_id: Device ID for authentication
            trading_pin: 6-digit trading PIN
            paper: Use paper trading mode
            user_id: User UUID for multi-tenant tracking
        """
        super().__init__(api_key=email, api_secret=password, sandbox=paper)

        if not WEBULL_AVAILABLE:
            raise ImportError(
                "webull is not installed. Run: pip install webull"
            )

        self.email = email
        self.password = password
        self.device_id = device_id
        self.trading_pin = trading_pin
        self.paper = paper
        self.user_id = user_id
        self._client = None
        self._account_id = None

    @classmethod
    async def create_for_user(
        cls,
        user_id: str,
        paper: bool = True,
        db_client=None
    ) -> Optional['WebullClient']:
        """
        Create WebullClient from user's stored credentials.

        Multi-tenant design: Each user has their own credentials stored in
        user_exchange_credentials table.

        Args:
            user_id: User UUID
            paper: Use paper trading mode
            db_client: Optional Database instance

        Returns:
            Initialized WebullClient or None if no credentials found
        """
        try:
            # Get database client
            if db_client is None:
                from src.database.client import Database
                db_client = Database(user_id=user_id)

            # Try to get user-specific credentials
            creds = db_client.get_exchange_credentials_for_user(
                user_id,
                exchange='webull'
            )

            if not creds.get('api_key') or not creds.get('api_secret'):
                logger.debug(f"No Webull credentials for user {user_id}")
                return None

            # Create and initialize client
            # For Webull: api_key = email, api_secret = password
            # passphrase = trading_pin, account_id = device_id
            client = cls(
                email=creds['api_key'],
                password=creds['api_secret'],
                device_id=creds.get('account_id'),
                trading_pin=creds.get('passphrase'),
                paper=creds.get('is_paper', paper),
                user_id=user_id
            )

            initialized = await client.initialize()
            if initialized:
                logger.info(f"✅ WebullClient created for user {user_id}")
                return client
            else:
                logger.warning(
                    f"❌ WebullClient init failed for user {user_id}"
                )
                return None

        except Exception as e:
            logger.error(
                f"Failed to create WebullClient for user {user_id}: {e}"
            )
            return None

    async def _run_sync(self, func, *args, **kwargs):
        """Run a synchronous function in thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            lambda: func(*args, **kwargs)
        )

    async def initialize(self) -> bool:
        """Initialize connection to Webull (login)."""
        try:
            if not self.email or not self.password:
                logger.error("Webull email and password required")
                return False

            # Create appropriate client
            if self.paper:
                self._client = paper_webull()
            else:
                self._client = webull()

            # Login
            def do_login():
                try:
                    result = self._client.login(
                        self.email,
                        self.password,
                        device_id=self.device_id
                    )
                    return result
                except Exception as e:
                    logger.error(f"Webull login error: {e}")
                    return None

            login_result = await self._run_sync(do_login)

            if login_result and 'accessToken' in str(login_result):
                # Get account ID
                account_info = await self._run_sync(
                    self._client.get_account
                )
                if account_info:
                    self._account_id = account_info.get(
                        'secAccountId',
                        account_info.get('accountId')
                    )

                # Unlock trading with PIN if provided
                if self.trading_pin:
                    await self._run_sync(
                        self._client.get_trade_token,
                        self.trading_pin
                    )

                self._initialized = True
                mode = "paper" if self.paper else "live"
                logger.info(
                    f"✅ Webull {mode} initialized "
                    f"(Account: {self._account_id})"
                )
                return True
            else:
                logger.error(f"❌ Webull login failed: {login_result}")
                return False

        except Exception as e:
            logger.error(f"❌ Failed to initialize Webull: {e}")
            return False

    async def close(self) -> None:
        """Logout from Webull."""
        try:
            if self._client:
                await self._run_sync(self._client.logout)
            self._initialized = False
            logger.info("Webull logged out")
        except Exception as e:
            logger.error(f"Error logging out: {e}")

    # =========================================================================
    # Market Data Methods
    # =========================================================================

    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a stock symbol."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        quote = await self._run_sync(self._client.get_quote, symbol)

        if not quote:
            raise Exception(f"Failed to get quote for {symbol}")

        bid = float(quote.get('bidPrice', 0) or 0)
        ask = float(quote.get('askPrice', 0) or 0)
        last = float(quote.get('close', 0) or quote.get('price', 0) or 0)

        return Ticker(
            symbol=symbol,
            bid=bid,
            ask=ask,
            last=last,
            volume_24h=float(quote.get('volume', 0) or 0),
            timestamp=datetime.now()
        )

    async def get_tickers(
        self,
        symbols: Optional[List[str]] = None
    ) -> Dict[str, Ticker]:
        """Get tickers for multiple stock symbols."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        if not symbols:
            return {}

        results = {}
        for symbol in symbols:
            try:
                ticker = await self.get_ticker(symbol)
                results[symbol] = ticker
            except Exception as e:
                logger.warning(f"Failed to get ticker for {symbol}: {e}")

        return results

    async def get_orderbook(
        self,
        symbol: str,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get order book for a symbol."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        # Get stock ID first
        stock_id = await self._run_sync(
            self._client.get_ticker,
            symbol
        )

        if not stock_id:
            return {'bids': [], 'asks': []}

        quote = await self._run_sync(
            self._client.get_quote,
            stock=symbol
        )

        bids = []
        asks = []

        # Extract bid/ask from quote
        if quote:
            bids.append({
                'price': float(quote.get('bidPrice', 0) or 0),
                'size': float(quote.get('bidSize', 0) or 0)
            })
            asks.append({
                'price': float(quote.get('askPrice', 0) or 0),
                'size': float(quote.get('askSize', 0) or 0)
            })

        return {'bids': bids, 'asks': asks}

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = '1h',
        limit: int = 100
    ) -> List[List[float]]:
        """Get OHLCV candlestick data."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        # Map timeframe to Webull intervals
        interval_map = {
            '1m': 'm1',
            '5m': 'm5',
            '15m': 'm15',
            '30m': 'm30',
            '1h': 'm60',
            '1d': 'd1',
            '1w': 'w1'
        }
        interval = interval_map.get(timeframe, 'm60')

        bars = await self._run_sync(
            self._client.get_bars,
            stock=symbol,
            interval=interval,
            count=limit
        )

        # Convert to OHLCV format
        result = []
        for bar in (bars or []):
            timestamp = datetime.fromisoformat(
                bar.get('timestamp', '').replace('Z', '+00:00')
            ) if bar.get('timestamp') else datetime.now()

            result.append([
                timestamp.timestamp() * 1000,
                float(bar.get('open', 0)),
                float(bar.get('high', 0)),
                float(bar.get('low', 0)),
                float(bar.get('close', 0)),
                float(bar.get('volume', 0))
            ])

        return result

    # =========================================================================
    # Account Methods
    # =========================================================================

    async def get_balance(
        self,
        asset: Optional[str] = None
    ) -> Dict[str, Balance]:
        """Get account balances."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        account = await self._run_sync(self._client.get_account)

        if not account:
            return {}

        # Extract balance info
        cash = float(account.get('cashBalance', 0) or 0)
        buying_power = float(account.get('dayBuyingPower', 0) or 0)
        net_liq = float(account.get('netLiquidation', 0) or 0)

        balances = {
            'USD': Balance(
                asset='USD',
                free=buying_power,
                locked=max(0, cash - buying_power),
                total=cash
            ),
            'PORTFOLIO': Balance(
                asset='PORTFOLIO',
                free=net_liq,
                locked=0,
                total=net_liq
            )
        }

        return balances

    async def get_positions(
        self,
        symbol: Optional[str] = None
    ) -> List[Position]:
        """Get open stock positions."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        positions_data = await self._run_sync(
            self._client.get_positions
        )

        if not positions_data:
            return []

        positions = []
        for p in positions_data:
            sym = p.get('ticker', {}).get('symbol', '')
            if symbol and sym != symbol:
                continue

            qty = float(p.get('position', 0))
            if qty == 0:
                continue

            avg_cost = float(p.get('costPrice', 0) or 0)
            current_price = float(p.get('lastPrice', 0) or avg_cost)
            unrealized_pnl = float(p.get('unrealizedProfitLoss', 0) or 0)

            positions.append(Position(
                symbol=sym,
                side=PositionSide.LONG if qty > 0 else PositionSide.SHORT,
                size=abs(qty),
                entry_price=avg_cost,
                mark_price=current_price,
                unrealized_pnl=unrealized_pnl,
                liquidation_price=None,
                leverage=1.0  # Webull doesn't expose leverage via API
            ))

        return positions

    # =========================================================================
    # Trading Methods
    # =========================================================================

    async def create_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        amount: float,
        price: Optional[float] = None,
        params: Optional[Dict] = None
    ) -> Order:
        """Create a new stock order."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        params = params or {}

        # Map order type
        webull_type = 'MKT' if order_type == OrderType.MARKET else 'LMT'

        # Map side
        webull_side = 'BUY' if side == OrderSide.BUY else 'SELL'

        # Time in force
        tif = params.get('time_in_force', 'GTC')

        # Place order
        result = await self._run_sync(
            self._client.place_order,
            stock=symbol,
            action=webull_side,
            orderType=webull_type,
            quant=int(amount),
            price=price,
            enforce=tif
        )

        if not result or 'orderId' not in result:
            raise Exception(f"Order failed: {result}")

        return Order(
            id=str(result.get('orderId', '')),
            symbol=symbol,
            side=side,
            type=order_type,
            price=price,
            amount=amount,
            filled=0,
            remaining=amount,
            status=result.get('status', 'submitted'),
            timestamp=datetime.now()
        )

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        result = await self._run_sync(
            self._client.cancel_order,
            order_id
        )
        return result is not None and result.get('success', False)

    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        orders = await self._run_sync(self._client.get_current_orders)

        for o in (orders or []):
            if str(o.get('orderId')) == order_id:
                return Order(
                    id=str(o.get('orderId', '')),
                    symbol=o.get('ticker', {}).get('symbol', symbol),
                    side=OrderSide.BUY if o.get('action') == 'BUY' else OrderSide.SELL,
                    type=OrderType.MARKET if o.get('orderType') == 'MKT' else OrderType.LIMIT,
                    price=float(o.get('lmtPrice', 0)) if o.get('lmtPrice') else None,
                    amount=float(o.get('totalQuantity', 0)),
                    filled=float(o.get('filledQuantity', 0)),
                    remaining=float(o.get('totalQuantity', 0)) - float(o.get('filledQuantity', 0)),
                    status=o.get('status', 'unknown'),
                    timestamp=datetime.now()
                )

        raise Exception(f"Order {order_id} not found")

    async def get_open_orders(
        self,
        symbol: Optional[str] = None
    ) -> List[Order]:
        """Get all open orders."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        orders = await self._run_sync(self._client.get_current_orders)
        results = []

        for o in (orders or []):
            sym = o.get('ticker', {}).get('symbol', '')
            if symbol and sym != symbol:
                continue

            results.append(Order(
                id=str(o.get('orderId', '')),
                symbol=sym,
                side=OrderSide.BUY if o.get('action') == 'BUY' else OrderSide.SELL,
                type=OrderType.MARKET if o.get('orderType') == 'MKT' else OrderType.LIMIT,
                price=float(o.get('lmtPrice', 0)) if o.get('lmtPrice') else None,
                amount=float(o.get('totalQuantity', 0)),
                filled=float(o.get('filledQuantity', 0)),
                remaining=float(o.get('totalQuantity', 0)) - float(o.get('filledQuantity', 0)),
                status=o.get('status', 'unknown'),
                timestamp=datetime.now()
            ))

        return results

    # =========================================================================
    # Options Trading Methods (Webull-specific)
    # =========================================================================

    async def get_options_chain(
        self,
        symbol: str,
        expiration: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get options chain for a symbol."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        # Get options expiration dates first
        expirations = await self._run_sync(
            self._client.get_options_expiration_dates,
            stock=symbol
        )

        if not expirations:
            return {'calls': [], 'puts': []}

        # Use first expiration if not specified
        exp_date = expiration or expirations[0].get('date')

        # Get options chain
        chain = await self._run_sync(
            self._client.get_options,
            stock=symbol,
            expireDate=exp_date
        )

        return chain or {'calls': [], 'puts': []}

    async def create_options_order(
        self,
        symbol: str,
        option_id: str,
        side: OrderSide,
        order_type: OrderType,
        contracts: int,
        price: Optional[float] = None
    ) -> Order:
        """Create an options order."""
        if not self._initialized:
            raise RuntimeError("Webull not initialized")

        webull_type = 'MKT' if order_type == OrderType.MARKET else 'LMT'
        webull_side = 'BUY' if side == OrderSide.BUY else 'SELL'

        result = await self._run_sync(
            self._client.place_order_option,
            optionId=option_id,
            lmtPrice=price,
            stpPrice=None,
            action=webull_side,
            orderType=webull_type,
            quant=contracts
        )

        if not result or 'orderId' not in result:
            raise Exception(f"Options order failed: {result}")

        return Order(
            id=str(result.get('orderId', '')),
            symbol=f"{symbol}-{option_id}",
            side=side,
            type=order_type,
            price=price,
            amount=float(contracts),
            filled=0,
            remaining=float(contracts),
            status=result.get('status', 'submitted'),
            timestamp=datetime.now()
        )

    # =========================================================================
    # Funding Rate Methods (Not applicable for Webull)
    # =========================================================================

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """Not available on Webull."""
        raise NotImplementedError(
            "Webull does not support futures/funding rates"
        )

    async def get_funding_rates(
        self,
        symbols: Optional[List[str]] = None
    ) -> Dict[str, FundingRate]:
        """Not available on Webull."""
        return {}

    async def get_funding_rate_history(
        self,
        symbol: str,
        limit: int = 100
    ) -> List[FundingRate]:
        """Not available on Webull."""
        return []

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Not available on Webull."""
        logger.warning("Leverage not supported on Webull")
        return False
