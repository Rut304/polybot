"""
Robinhood client for stock, crypto, and options trading.

⚠️ WARNING: Robinhood does not have an official API for third-party apps.
This client uses the unofficial robin_stocks library which reverse-engineers
the mobile app API. Use at your own risk - may break at any time.

Features:
- Stock trading (including fractional shares)
- Crypto trading
- Options trading
- Paper trading NOT officially supported (no sandbox)
- Multi-tenant support (per-user credentials)

Usage:
    # Direct initialization with credentials
    client = RobinhoodClient(username, password, mfa_code="123456")
    await client.initialize()

    # Multi-tenant: Create from user's stored credentials
    client = await RobinhoodClient.create_for_user(user_id="uuid-here")

    # Get stock prices
    ticker = await client.get_ticker('AAPL')

    # Place a trade
    order = await client.create_order('AAPL', OrderSide.BUY, OrderType.MARKET, 10)

Dependencies:
    pip install robin_stocks pyotp
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

try:
    import robin_stocks.robinhood as rh
    ROBIN_STOCKS_AVAILABLE = True
except ImportError:
    ROBIN_STOCKS_AVAILABLE = False
    rh = None

try:
    import pyotp
    PYOTP_AVAILABLE = True
except ImportError:
    PYOTP_AVAILABLE = False
    pyotp = None

from .base import (
    BaseExchange, Ticker, Balance, Order, Position, FundingRate,
    OrderSide, OrderType, PositionSide
)


logger = logging.getLogger(__name__)

# Thread pool for running sync robin_stocks calls
_executor = ThreadPoolExecutor(max_workers=4)


class RobinhoodClient(BaseExchange):
    """
    Robinhood client using unofficial robin_stocks library.

    ⚠️ DISCLAIMER: This uses an unofficial API. Use at your own risk.
    Robinhood may block access at any time.

    Features:
    - Stock trading with fractional shares
    - Crypto trading
    - Options trading (basic)
    - Multi-tenant support via create_for_user()
    """

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        mfa_secret: Optional[str] = None,  # TOTP secret for MFA
        user_id: Optional[str] = None
    ):
        """
        Initialize Robinhood client.

        Args:
            username: Robinhood email/username
            password: Robinhood password
            mfa_secret: TOTP secret for generating MFA codes (optional)
            user_id: User UUID for multi-tenant tracking
        """
        # Note: Robinhood doesn't use traditional API key/secret
        super().__init__(api_key=username, api_secret=password, sandbox=False)

        if not ROBIN_STOCKS_AVAILABLE:
            raise ImportError("robin_stocks is not installed. Run: pip install robin_stocks")

        self.username = username
        self.password = password
        self.mfa_secret = mfa_secret
        self.user_id = user_id
        self._account_info: Optional[Dict] = None

    @classmethod
    async def create_for_user(
        cls,
        user_id: str,
        db_client=None
    ) -> Optional['RobinhoodClient']:
        """
        Factory method to create RobinhoodClient from user's stored credentials.

        Multi-tenant design: Each user has their own credentials stored in
        user_exchange_credentials table.

        Args:
            user_id: User UUID
            db_client: Optional Database instance (creates one if not provided)

        Returns:
            Initialized RobinhoodClient or None if no credentials found
        """
        try:
            # Get database client
            if db_client is None:
                from src.database.client import Database
                db_client = Database(user_id=user_id)

            # Try to get user-specific credentials
            creds = db_client.get_exchange_credentials_for_user(
                user_id, 
                exchange='robinhood'
            )

            if not creds.get('api_key') or not creds.get('api_secret'):
                logger.debug(f"No Robinhood credentials for user {user_id}")
                return None

            # Create and initialize client
            # For Robinhood: api_key = username, api_secret = password
            client = cls(
                username=creds['api_key'],
                password=creds['api_secret'],
                mfa_secret=creds.get('passphrase'),  # Store TOTP secret in passphrase field
                user_id=user_id
            )

            initialized = await client.initialize()
            if initialized:
                logger.info(f"✅ RobinhoodClient created for user {user_id}")
                return client
            else:
                logger.warning(f"❌ RobinhoodClient init failed for user {user_id}")
                return None

        except Exception as e:
            logger.error(f"Failed to create RobinhoodClient for user {user_id}: {e}")
            return None

    def _generate_mfa_code(self) -> Optional[str]:
        """Generate MFA code from TOTP secret if available."""
        if self.mfa_secret and PYOTP_AVAILABLE:
            try:
                totp = pyotp.TOTP(self.mfa_secret)
                return totp.now()
            except Exception as e:
                logger.error(f"Failed to generate MFA code: {e}")
        return None

    async def _run_sync(self, func, *args, **kwargs):
        """Run a synchronous function in thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, lambda: func(*args, **kwargs))

    async def initialize(self) -> bool:
        """Initialize connection to Robinhood (login)."""
        try:
            if not self.username or not self.password:
                logger.error("Robinhood username and password required")
                return False

            # Generate MFA code if we have the secret
            mfa_code = self._generate_mfa_code()

            # Login to Robinhood (sync call wrapped in async)
            def do_login():
                try:
                    login_result = rh.login(
                        username=self.username,
                        password=self.password,
                        mfa_code=mfa_code,
                        store_session=True,  # Cache session for reuse
                        by_sms=False if mfa_code else True  # Use TOTP if available, else SMS
                    )
                    return login_result
                except Exception as e:
                    logger.error(f"Robinhood login error: {e}")
                    return None

            login_result = await self._run_sync(do_login)

            if login_result and 'access_token' in str(login_result):
                # Fetch account info to verify
                self._account_info = await self._run_sync(rh.load_account_profile)
                self._initialized = True
                logger.info(f"✅ Robinhood initialized for {self.username}")
                return True
            else:
                logger.error(f"❌ Robinhood login failed: {login_result}")
                return False

        except Exception as e:
            logger.error(f"❌ Failed to initialize Robinhood: {e}")
            return False

    async def close(self) -> None:
        """Logout from Robinhood."""
        try:
            await self._run_sync(rh.logout)
            self._initialized = False
            logger.info("Robinhood logged out")
        except Exception as e:
            logger.error(f"Error logging out: {e}")

    # =========================================================================
    # Market Data Methods
    # =========================================================================

    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a stock symbol."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        quote = await self._run_sync(rh.stocks.get_quotes, symbol)

        if not quote or not quote[0]:
            raise Exception(f"Failed to get quote for {symbol}")

        q = quote[0]
        bid = float(q.get('bid_price') or 0)
        ask = float(q.get('ask_price') or 0)
        last = float(q.get('last_trade_price') or q.get('last_extended_hours_trade_price') or 0)

        return Ticker(
            symbol=symbol,
            bid=bid,
            ask=ask,
            last=last,
            volume_24h=0,  # Would need separate call
            timestamp=datetime.now()
        )

    async def get_tickers(self, symbols: Optional[List[str]] = None) -> Dict[str, Ticker]:
        """Get tickers for multiple stock symbols."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        if not symbols:
            return {}

        quotes = await self._run_sync(rh.stocks.get_quotes, symbols)
        results = {}

        for q in quotes:
            if q:
                symbol = q.get('symbol', '')
                bid = float(q.get('bid_price') or 0)
                ask = float(q.get('ask_price') or 0)
                last = float(q.get('last_trade_price') or 0)

                results[symbol] = Ticker(
                    symbol=symbol,
                    bid=bid,
                    ask=ask,
                    last=last,
                    volume_24h=0,
                    timestamp=datetime.now()
                )

        return results

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """Get order book - not available on Robinhood."""
        logger.warning("Order book data not available on Robinhood")
        return {'bids': [], 'asks': []}

    async def get_ohlcv(self, symbol: str, timeframe: str = '1h',
                        limit: int = 100) -> List[List[float]]:
        """Get OHLCV candlestick data."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        # Map timeframe to Robinhood intervals
        interval_map = {
            '5m': '5minute',
            '10m': '10minute',
            '1h': 'hour',
            '1d': 'day',
            '1w': 'week'
        }
        interval = interval_map.get(timeframe, 'hour')

        # Robinhood span based on interval
        span_map = {
            '5minute': 'day',
            '10minute': 'week',
            'hour': 'month',
            'day': 'year',
            'week': '5year'
        }
        span = span_map.get(interval, 'month')

        historicals = await self._run_sync(
            rh.stocks.get_stock_historicals,
            symbol,
            interval=interval,
            span=span
        )

        # Convert to OHLCV format [timestamp, open, high, low, close, volume]
        result = []
        for candle in historicals[-limit:]:
            timestamp = datetime.fromisoformat(candle['begins_at'].replace('Z', '+00:00'))
            result.append([
                timestamp.timestamp() * 1000,
                float(candle.get('open_price', 0)),
                float(candle.get('high_price', 0)),
                float(candle.get('low_price', 0)),
                float(candle.get('close_price', 0)),
                float(candle.get('volume', 0))
            ])

        return result

    # =========================================================================
    # Account Methods
    # =========================================================================

    async def get_balance(self, asset: Optional[str] = None) -> Dict[str, Balance]:
        """Get account balances."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        profile = await self._run_sync(rh.profiles.load_account_profile)

        # Get buying power and portfolio value
        buying_power = float(profile.get('buying_power', 0))
        cash = float(profile.get('cash', 0))
        portfolio_value = float(profile.get('portfolio_value', buying_power))

        balances = {
            'USD': Balance(
                asset='USD',
                free=buying_power,
                locked=cash - buying_power if cash > buying_power else 0,
                total=cash
            ),
            'PORTFOLIO': Balance(
                asset='PORTFOLIO',
                free=portfolio_value,
                locked=0,
                total=portfolio_value
            )
        }

        # If specific asset requested and it's not USD
        if asset and asset != 'USD' and asset != 'PORTFOLIO':
            holdings = await self._run_sync(rh.account.build_holdings)
            if asset in holdings:
                h = holdings[asset]
                qty = float(h.get('quantity', 0))
                balances[asset] = Balance(
                    asset=asset,
                    free=qty,
                    locked=0,
                    total=qty
                )

        return balances

    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open stock positions."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        holdings = await self._run_sync(rh.account.build_holdings)
        positions = []

        for sym, h in holdings.items():
            if symbol and sym != symbol:
                continue

            qty = float(h.get('quantity', 0))
            if qty <= 0:
                continue

            avg_cost = float(h.get('average_buy_price', 0))
            current_price = float(h.get('price', avg_cost))
            equity = float(h.get('equity', qty * current_price))
            pnl = equity - (qty * avg_cost)

            positions.append(Position(
                symbol=sym,
                side=PositionSide.LONG,
                size=qty,
                entry_price=avg_cost,
                mark_price=current_price,
                unrealized_pnl=pnl,
                liquidation_price=None,
                leverage=1.0  # No leverage on Robinhood
            ))

        return positions

    # =========================================================================
    # Trading Methods
    # =========================================================================

    async def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                          amount: float, price: Optional[float] = None,
                          params: Optional[Dict] = None) -> Order:
        """Create a new stock order."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        params = params or {}

        # Determine order function
        if order_type == OrderType.MARKET:
            if side == OrderSide.BUY:
                result = await self._run_sync(
                    rh.orders.order_buy_market,
                    symbol,
                    amount,
                    extendedHours=params.get('extended_hours', False)
                )
            else:
                result = await self._run_sync(
                    rh.orders.order_sell_market,
                    symbol,
                    amount,
                    extendedHours=params.get('extended_hours', False)
                )
        elif order_type == OrderType.LIMIT:
            if not price:
                raise ValueError("Price required for limit orders")
            if side == OrderSide.BUY:
                result = await self._run_sync(
                    rh.orders.order_buy_limit,
                    symbol,
                    amount,
                    price,
                    extendedHours=params.get('extended_hours', False)
                )
            else:
                result = await self._run_sync(
                    rh.orders.order_sell_limit,
                    symbol,
                    amount,
                    price,
                    extendedHours=params.get('extended_hours', False)
                )
        else:
            raise ValueError(f"Order type {order_type} not supported")

        if not result or 'id' not in result:
            raise Exception(f"Order failed: {result}")

        return Order(
            id=result['id'],
            symbol=symbol,
            side=side,
            type=order_type,
            price=price,
            amount=amount,
            filled=float(result.get('cumulative_quantity', 0)),
            remaining=amount - float(result.get('cumulative_quantity', 0)),
            status=result.get('state', 'unknown'),
            timestamp=datetime.now()
        )

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        result = await self._run_sync(rh.orders.cancel_stock_order, order_id)
        return result is not None

    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        result = await self._run_sync(rh.orders.get_stock_order_info, order_id)

        if not result:
            raise Exception(f"Order {order_id} not found")

        return Order(
            id=result['id'],
            symbol=result.get('symbol', symbol),
            side=OrderSide.BUY if result.get('side') == 'buy' else OrderSide.SELL,
            type=OrderType.MARKET if result.get('type') == 'market' else OrderType.LIMIT,
            price=float(result.get('price', 0)) if result.get('price') else None,
            amount=float(result.get('quantity', 0)),
            filled=float(result.get('cumulative_quantity', 0)),
            remaining=float(result.get('quantity', 0)) - float(result.get('cumulative_quantity', 0)),
            status=result.get('state', 'unknown'),
            timestamp=datetime.fromisoformat(result['created_at'].replace('Z', '+00:00'))
        )

    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get all open orders."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        orders = await self._run_sync(rh.orders.get_all_open_stock_orders)
        results = []

        for o in orders:
            sym = o.get('symbol', '')
            if symbol and sym != symbol:
                continue

            results.append(Order(
                id=o['id'],
                symbol=sym,
                side=OrderSide.BUY if o.get('side') == 'buy' else OrderSide.SELL,
                type=OrderType.MARKET if o.get('type') == 'market' else OrderType.LIMIT,
                price=float(o.get('price', 0)) if o.get('price') else None,
                amount=float(o.get('quantity', 0)),
                filled=float(o.get('cumulative_quantity', 0)),
                remaining=float(o.get('quantity', 0)) - float(o.get('cumulative_quantity', 0)),
                status=o.get('state', 'open'),
                timestamp=datetime.fromisoformat(o['created_at'].replace('Z', '+00:00'))
            ))

        return results

    # =========================================================================
    # Crypto Methods (Robinhood-specific)
    # =========================================================================

    async def get_crypto_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a crypto symbol (e.g., 'BTC', 'ETH')."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        quote = await self._run_sync(rh.crypto.get_crypto_quote, symbol)

        if not quote:
            raise Exception(f"Failed to get crypto quote for {symbol}")

        bid = float(quote.get('bid_price', 0))
        ask = float(quote.get('ask_price', 0))
        mark = float(quote.get('mark_price', (bid + ask) / 2 if bid and ask else 0))

        return Ticker(
            symbol=symbol,
            bid=bid,
            ask=ask,
            last=mark,
            volume_24h=float(quote.get('volume', 0)),
            timestamp=datetime.now()
        )

    async def get_crypto_positions(self) -> List[Position]:
        """Get crypto holdings."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        holdings = await self._run_sync(rh.crypto.get_crypto_positions)
        positions = []

        for h in holdings:
            qty = float(h.get('quantity_available', 0))
            if qty <= 0:
                continue

            # Get current price
            currency = h.get('currency', {}).get('code', 'BTC')
            try:
                quote = await self._run_sync(rh.crypto.get_crypto_quote, currency)
                current_price = float(quote.get('mark_price', 0))
            except:
                current_price = 0

            cost_basis = float(h.get('cost_bases', [{}])[0].get('direct_cost_basis', 0))
            avg_cost = cost_basis / qty if qty > 0 else 0

            positions.append(Position(
                symbol=currency,
                side=PositionSide.LONG,
                size=qty,
                entry_price=avg_cost,
                mark_price=current_price,
                unrealized_pnl=(current_price - avg_cost) * qty,
                liquidation_price=None,
                leverage=1.0
            ))

        return positions

    async def create_crypto_order(self, symbol: str, side: OrderSide,
                                   amount_in_dollars: float) -> Order:
        """Create a crypto order (by dollar amount)."""
        if not self._initialized:
            raise RuntimeError("Robinhood not initialized")

        if side == OrderSide.BUY:
            result = await self._run_sync(
                rh.orders.order_buy_crypto_by_price,
                symbol,
                amount_in_dollars
            )
        else:
            result = await self._run_sync(
                rh.orders.order_sell_crypto_by_price,
                symbol,
                amount_in_dollars
            )

        if not result or 'id' not in result:
            raise Exception(f"Crypto order failed: {result}")

        return Order(
            id=result['id'],
            symbol=symbol,
            side=side,
            type=OrderType.MARKET,
            price=None,
            amount=amount_in_dollars,
            filled=0,
            remaining=amount_in_dollars,
            status=result.get('state', 'unknown'),
            timestamp=datetime.now()
        )

    # =========================================================================
    # Funding Rate Methods (Not applicable for Robinhood)
    # =========================================================================

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """Not available on Robinhood."""
        raise NotImplementedError("Robinhood does not support futures/funding rates")

    async def get_funding_rates(self, symbols: Optional[List[str]] = None) -> Dict[str, FundingRate]:
        """Not available on Robinhood."""
        return {}

    async def get_funding_rate_history(self, symbol: str, limit: int = 100) -> List[FundingRate]:
        """Not available on Robinhood."""
        return []

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Not available on Robinhood (no margin trading via API)."""
        logger.warning("Leverage not supported on Robinhood")
        return False
