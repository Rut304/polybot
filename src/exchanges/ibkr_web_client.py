"""
IBKR Web API Client - Multi-Tenant OAuth-based Trading

This client uses IBKR's REST Web API instead of the legacy
ib_insync + Gateway approach.

Benefits:
- No sidecar container needed (IB Gateway)
- OAuth 2.0 token-based authentication
- Per-user session management for multi-tenancy
- Direct REST calls to api.ibkr.com
- WebSocket streaming for real-time data

Architecture:
- Each user completes OAuth flow once in admin UI
- Access/refresh tokens stored encrypted in Supabase
- Complete isolation between users' IBKR accounts
"""

import asyncio
import logging
import base64
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
import httpx

from src.exchanges.base import (
    BaseExchange, Ticker, Balance, Order, Position,
    OrderSide, OrderType, PositionSide
)

logger = logging.getLogger(__name__)

# IBKR Web API Base URL
IBKR_API_BASE = "https://api.ibkr.com/v1/api"
IBKR_GATEWAY_BASE = "https://localhost:5000/v1/api"  # For CP Gateway fallback


@dataclass
class IBKRUserSession:
    """Per-user IBKR session data for multi-tenancy."""
    user_id: str
    account_id: str  # IBKR account ID (e.g., U1234567)
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    consumer_key: Optional[str] = None  # For OAuth 1.0a
    is_paper: bool = True
    last_authenticated: Optional[datetime] = None

    def is_token_expired(self) -> bool:
        if not self.token_expiry:
            return True
        return datetime.now() >= self.token_expiry - timedelta(minutes=5)


class IBKRWebClient(BaseExchange):
    """
    Interactive Brokers Web API Client.

    Multi-tenant design:
    - Each user has their own IBKRUserSession
    - Sessions are stored/retrieved from Supabase
    - Complete isolation between users

    Usage:
        # Create client for a specific user
        client = IBKRWebClient(user_id="user-123")
        await client.initialize()  # Loads session from DB

        # Or inject session directly
        session = IBKRUserSession(
            user_id="user-123", account_id="U1234567",
            access_token="..."
        )
        client = IBKRWebClient(user_session=session)
    """

    def __init__(
        self,
        user_id: Optional[str] = None,
        user_session: Optional[IBKRUserSession] = None,
        use_gateway: bool = False,  # Use CP Gateway instead of OAuth
        sandbox: bool = True
    ):
        super().__init__(api_key=None, api_secret=None, sandbox=sandbox)
        self.user_id = user_id
        self.session = user_session
        self.use_gateway = use_gateway
        self.base_url = IBKR_GATEWAY_BASE if use_gateway else IBKR_API_BASE
        self._http_client: Optional[httpx.AsyncClient] = None
        self._authenticated = False
        self._brokerage_session_active = False

    async def initialize(self) -> bool:
        """
        Initialize the client and establish authentication.

        For multi-tenant: Loads user's OAuth tokens from database.
        """
        try:
            # Initialize HTTP client
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                # Skip SSL verify for local gateway
                verify=not self.use_gateway,
                headers=self._get_default_headers()
            )

            # Load session from database if not provided
            if not self.session and self.user_id:
                self.session = await self._load_user_session()

            if not self.session:
                logger.warning(
                    "No IBKR session available. "
                    "User must complete OAuth flow."
                )
                return False

            # Validate/refresh token if needed
            if self.session.is_token_expired():
                await self._refresh_access_token()

            # Initialize brokerage session
            self._authenticated = await self._init_brokerage_session()

            if self._authenticated:
                logger.info(
                    f"IBKR Web API initialized for user "
                    f"{self.user_id}, account {self.session.account_id}"
                )

            return self._authenticated

        except Exception as e:
            logger.error(f"Failed to initialize IBKR Web API: {e}")
            return False

    async def close(self) -> None:
        """Close the client and cleanup."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        self._authenticated = False
        self._brokerage_session_active = False

    def _get_default_headers(self) -> Dict[str, str]:
        """Get default HTTP headers."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "PolyBot/1.0"
        }
        return headers

    def _get_auth_headers(self) -> Dict[str, str]:
        """Get headers with OAuth authentication."""
        headers = self._get_default_headers()
        if self.session and self.session.access_token:
            # For OAuth 2.0
            headers["Authorization"] = f"Bearer {self.session.access_token}"
        return headers

    # =========================================================================
    # Session Management (Multi-Tenant)
    # =========================================================================

    async def _load_user_session(self) -> Optional[IBKRUserSession]:
        """
        Load user's IBKR session from Supabase.

        Table: user_exchange_credentials
        Columns: user_id, exchange, account_id, access_token,
                 refresh_token, token_expiry, consumer_key,
                 is_paper, encrypted
        """
        try:
            # Import here to avoid circular deps
            from src.database.client import Database
            db = Database()

            result = await db.client.table(
                'user_exchange_credentials'
            ).select('*').eq(
                'user_id', self.user_id
            ).eq(
                'exchange', 'ibkr'
            ).single().execute()

            if result.data:
                data = result.data
                # Decrypt tokens if needed
                access_token = await self._decrypt_token(
                    data.get('access_token')
                )
                refresh_token = await self._decrypt_token(
                    data.get('refresh_token')
                )

                return IBKRUserSession(
                    user_id=self.user_id,
                    account_id=data.get('account_id'),
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expiry=(
                        datetime.fromisoformat(data['token_expiry'])
                        if data.get('token_expiry') else None
                    ),
                    consumer_key=data.get('consumer_key'),
                    is_paper=data.get('is_paper', True),
                    last_authenticated=(
                        datetime.fromisoformat(data['last_authenticated'])
                        if data.get('last_authenticated') else None
                    )
                )
            return None

        except Exception as e:
            logger.error(
                f"Failed to load IBKR session for user {self.user_id}: {e}"
            )
            return None

    async def _save_user_session(self) -> bool:
        """Save user's IBKR session to Supabase."""
        if not self.session:
            return False

        try:
            from src.database.client import Database
            db = Database()

            # Encrypt tokens
            encrypted_access = await self._encrypt_token(
                self.session.access_token
            )
            encrypted_refresh = None
            if self.session.refresh_token:
                encrypted_refresh = await self._encrypt_token(
                    self.session.refresh_token
                )

            data = {
                'user_id': self.session.user_id,
                'exchange': 'ibkr',
                'account_id': self.session.account_id,
                'access_token': encrypted_access,
                'refresh_token': encrypted_refresh,
                'token_expiry': (
                    self.session.token_expiry.isoformat()
                    if self.session.token_expiry else None
                ),
                'consumer_key': self.session.consumer_key,
                'is_paper': self.session.is_paper,
                'last_authenticated': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }

            await db.client.table('user_exchange_credentials').upsert(
                data, on_conflict='user_id,exchange'
            ).execute()

            return True

        except Exception as e:
            logger.error(f"Failed to save IBKR session: {e}")
            return False

    async def _encrypt_token(self, token: str) -> str:
        """Encrypt token for storage. TODO: Implement proper encryption."""
        # For now, just base64 encode.
        # In production, use Supabase Vault or AWS KMS
        if not token:
            return ""
        return base64.b64encode(token.encode()).decode()

    async def _decrypt_token(self, encrypted: str) -> str:
        """Decrypt token from storage."""
        if not encrypted:
            return ""
        return base64.b64decode(encrypted.encode()).decode()

    # =========================================================================
    # Authentication
    # =========================================================================

    async def _init_brokerage_session(self) -> bool:
        """
        Initialize the brokerage session (required for trading).

        POST /iserver/auth/ssodh/init
        """
        try:
            response = await self._request(
                "POST",
                "/iserver/auth/ssodh/init",
                json={"publish": True, "compete": True}
            )

            if response and response.get("authenticated"):
                self._brokerage_session_active = True
                logger.info("IBKR brokerage session initialized")
                return True
            else:
                logger.warning(
                    f"Brokerage session not authenticated: {response}"
                )
                return False

        except Exception as e:
            logger.error(f"Failed to init brokerage session: {e}")
            return False

    async def _check_auth_status(self) -> Dict[str, Any]:
        """
        Check current authentication status.

        POST /iserver/auth/status
        """
        return await self._request("POST", "/iserver/auth/status", json={})

    async def _refresh_access_token(self) -> bool:
        """Refresh OAuth access token using refresh token."""
        # OAuth 2.0 token refresh logic
        # This depends on IBKR's OAuth implementation
        logger.info(
            "Token refresh not yet implemented - user must re-authenticate"
        )
        return False

    async def _keep_session_alive(self) -> bool:
        """
        Ping the session to keep it alive.

        GET /tickle
        """
        try:
            response = await self._request("GET", "/tickle")
            return response is not None
        except Exception:
            return False

    # =========================================================================
    # HTTP Request Helper
    # =========================================================================

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Make authenticated HTTP request to IBKR API."""
        if not self._http_client:
            raise RuntimeError("HTTP client not initialized")

        url = f"{self.base_url}{endpoint}"
        headers = self._get_auth_headers()

        try:
            response = await self._http_client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                headers=headers
            )

            if response.status_code == 429:
                logger.warning("Rate limited by IBKR API")
                await asyncio.sleep(1)
                return await self._request(method, endpoint, params, json)

            if response.status_code >= 400:
                logger.error(
                    f"IBKR API error: {response.status_code} - "
                    f"{response.text}"
                )
                return None

            return response.json() if response.text else {}

        except Exception as e:
            logger.error(f"IBKR API request failed: {e}")
            return None

    # =========================================================================
    # Account Operations
    # =========================================================================

    async def get_accounts(self) -> List[Dict[str, Any]]:
        """
        Get list of accounts accessible to this user.

        GET /iserver/accounts
        """
        response = await self._request("GET", "/iserver/accounts")
        if response:
            return response.get("accounts", [])
        return []

    async def get_balance(
        self, asset: Optional[str] = None
    ) -> Dict[str, Balance]:
        """Get account balances."""
        if not self.session:
            return {}

        # GET /portfolio/{accountId}/ledger
        response = await self._request(
            "GET",
            f"/portfolio/{self.session.account_id}/ledger"
        )

        balances = {}
        if response:
            for currency, data in response.items():
                if currency == "BASE":
                    continue
                balances[currency] = Balance(
                    asset=currency,
                    free=data.get("cashbalance", 0.0),
                    locked=0.0,
                    total=data.get("netliquidationvalue", 0.0)
                )

        return balances

    async def get_positions(
        self, symbol: Optional[str] = None
    ) -> List[Position]:
        """
        Get open positions.

        GET /portfolio/{accountId}/positions/0
        """
        if not self.session:
            return []

        response = await self._request(
            "GET",
            f"/portfolio/{self.session.account_id}/positions/0"
        )

        positions = []
        if response and isinstance(response, list):
            for p in response:
                sym = p.get("contractDesc", p.get("symbol", ""))
                if symbol and sym != symbol:
                    continue

                pos_size = p.get("position", 0)
                side = PositionSide.LONG if pos_size > 0 else PositionSide.SHORT

                positions.append(Position(
                    symbol=sym,
                    side=side,
                    size=abs(pos_size),
                    entry_price=p.get("avgCost", 0.0),
                    mark_price=p.get("mktPrice", 0.0),
                    unrealized_pnl=p.get("unrealizedPnl", 0.0),
                    liquidation_price=0.0,
                    leverage=1.0
                ))

        return positions

    # =========================================================================
    # Market Data
    # =========================================================================

    async def search_contract(self, symbol: str) -> Optional[int]:
        """
        Search for a contract by symbol and return conid.

        GET /iserver/secdef/search
        """
        response = await self._request(
            "GET",
            "/iserver/secdef/search",
            params={"symbol": symbol}
        )

        if response and isinstance(response, list) and len(response) > 0:
            return response[0].get("conid")
        return None

    async def get_ticker(self, symbol: str) -> Ticker:
        """
        Get ticker data for a symbol.

        Uses snapshot market data endpoint.
        """
        conid = await self.search_contract(symbol)
        if not conid:
            raise ValueError(f"Contract not found: {symbol}")

        # First request initializes the stream
        await self._request(
            "GET",
            "/iserver/marketdata/snapshot",
            params={"conids": str(conid), "fields": "31,84,85,86,88"}
        )

        # Wait briefly for data
        await asyncio.sleep(0.5)

        # Second request gets actual data
        response = await self._request(
            "GET",
            "/iserver/marketdata/snapshot",
            params={"conids": str(conid)}
        )

        if response and isinstance(response, list) and len(response) > 0:
            data = response[0]
            return Ticker(
                symbol=symbol,
                bid=float(data.get("84", 0)),  # Bid price
                ask=float(data.get("86", 0)),  # Ask price
                last=float(data.get("31", 0)),  # Last price
                volume_24h=0.0,
                timestamp=datetime.now()
            )

        return Ticker(symbol=symbol, bid=0, ask=0, last=0, volume_24h=0, timestamp=datetime.now())

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
        """Get order book (depth of book requires separate subscription)."""
        return {"bids": [], "asks": []}

    async def get_ohlcv(self, symbol: str, timeframe: str = "1h", limit: int = 100) -> List[List[float]]:
        """
        Get historical OHLCV data.

        GET /iserver/marketdata/history
        """
        conid = await self.search_contract(symbol)
        if not conid:
            return []

        # Map timeframe to IBKR format
        period_map = {
            "1m": ("1d", "1min"),
            "5m": ("1d", "5mins"),
            "15m": ("1d", "15mins"),
            "1h": ("1w", "1hour"),
            "1d": ("1y", "1day")
        }
        period, bar = period_map.get(timeframe, ("1w", "1hour"))

        response = await self._request(
            "GET",
            "/iserver/marketdata/history",
            params={
                "conid": conid,
                "period": period,
                "bar": bar
            }
        )

        ohlcv = []
        if response and "data" in response:
            for bar in response["data"]:
                ohlcv.append([
                    bar.get("t", 0) * 1000,  # timestamp
                    bar.get("o", 0),  # open
                    bar.get("h", 0),  # high
                    bar.get("l", 0),  # low
                    bar.get("c", 0),  # close
                    bar.get("v", 0)   # volume
                ])
        return ohlcv

    # =========================================================================
    # Order Management
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
        """
        Place a new order.

        POST /iserver/account/{accountId}/orders
        """
        if not self.session:
            raise RuntimeError("No IBKR session")

        conid = await self.search_contract(symbol)
        if not conid:
            raise ValueError(f"Contract not found: {symbol}")

        # Build order request
        order_data = {
            "conid": conid,
            "side": "BUY" if side == OrderSide.BUY else "SELL",
            "quantity": amount,
            "orderType": "MKT" if order_type == OrderType.MARKET else "LMT",
            "tif": "DAY"
        }

        if order_type == OrderType.LIMIT and price:
            order_data["price"] = price

        response = await self._request(
            "POST",
            f"/iserver/account/{self.session.account_id}/orders",
            json={"orders": [order_data]}
        )

        # Handle order reply messages (confirmations required)
        if response and isinstance(response, list) and "id" in response[0]:
            # Need to confirm the order
            reply_id = response[0]["id"]
            confirm_response = await self._request(
                "POST",
                f"/iserver/reply/{reply_id}",
                json={"confirmed": True}
            )
            response = confirm_response

        order_id = "0"
        status = "unknown"
        if response:
            if isinstance(response, dict):
                order_id = str(response.get("order_id", "0"))
                status = response.get("order_status", "submitted")
            elif isinstance(response, list) and len(response) > 0:
                order_id = str(response[0].get("order_id", "0"))
                status = response[0].get("order_status", "submitted")

        return Order(
            id=order_id,
            symbol=symbol,
            side=side,
            type=order_type,
            price=price,
            amount=amount,
            filled=0,
            remaining=amount,
            status=status,
            timestamp=datetime.now()
        )

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """
        Cancel an order.

        DELETE /iserver/account/{accountId}/order/{orderId}
        """
        if not self.session:
            return False

        response = await self._request(
            "DELETE",
            f"/iserver/account/{self.session.account_id}/order/{order_id}"
        )

        return response is not None

    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order status."""
        if not self.session:
            return Order(
                id=order_id, symbol=symbol, side=OrderSide.BUY,
                type=OrderType.MARKET, price=0, amount=0,
                filled=0, remaining=0, status="unknown", timestamp=datetime.now()
            )

        response = await self._request(
            "GET",
            f"/iserver/account/order/status/{order_id}"
        )

        if response:
            return Order(
                id=order_id,
                symbol=symbol,
                side=OrderSide.BUY if response.get("side") == "BUY" else OrderSide.SELL,
                type=OrderType.LIMIT if "LMT" in response.get("orderType", "") else OrderType.MARKET,
                price=response.get("price", 0),
                amount=response.get("totalSize", 0),
                filled=response.get("filledQuantity", 0),
                remaining=response.get("remainingQuantity", 0),
                status=response.get("status", "unknown"),
                timestamp=datetime.now()
            )

        return Order(
            id=order_id, symbol=symbol, side=OrderSide.BUY,
            type=OrderType.MARKET, price=0, amount=0,
            filled=0, remaining=0, status="unknown", timestamp=datetime.now()
        )

    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """
        Get all open orders.

        GET /iserver/account/orders
        """
        response = await self._request(
            "GET",
            "/iserver/account/orders",
            params={"force": "true"}
        )

        orders = []
        if response and "orders" in response:
            for o in response["orders"]:
                if symbol and o.get("ticker") != symbol:
                    continue

                orders.append(Order(
                    id=str(o.get("orderId", "")),
                    symbol=o.get("ticker", ""),
                    side=OrderSide.BUY if o.get("side") == "BUY" else OrderSide.SELL,
                    type=OrderType.LIMIT if "LMT" in o.get("orderType", "") else OrderType.MARKET,
                    price=float(o.get("price", 0)) if o.get("price") else 0,
                    amount=o.get("totalSize", 0),
                    filled=o.get("filledQuantity", 0),
                    remaining=o.get("remainingQuantity", 0),
                    status=o.get("status", "unknown"),
                    timestamp=datetime.now()
                ))

        return orders

    # =========================================================================
    # Futures (Not applicable for basic stock trading)
    # =========================================================================

    async def get_funding_rate(self, symbol: str):
        pass

    async def get_funding_rates(self, symbols: Optional[List[str]] = None):
        pass

    async def get_funding_rate_history(self, symbol: str, limit: int = 100):
        pass

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        return True


# =============================================================================
# OAuth Flow Helpers (For Admin UI)
# =============================================================================

class IBKROAuthFlow:
    """
    Handles the OAuth flow for connecting a user's IBKR account.

    Flow:
    1. User clicks "Connect IBKR" in admin UI
    2. Redirect to IBKR authorization URL
    3. User logs in to IBKR and grants access
    4. IBKR redirects back with auth code
    5. Exchange auth code for access token
    6. Store tokens in Supabase
    """

    def __init__(self, consumer_key: str, consumer_secret: str, callback_url: str):
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.callback_url = callback_url

    def get_authorization_url(self, state: str) -> str:
        """
        Generate the URL to redirect user to IBKR for authorization.

        Args:
            state: Random string to prevent CSRF (include user_id)
        """
        # OAuth 2.0 authorization URL
        # Note: IBKR OAuth 2.0 is in beta, may need OAuth 1.0a for now
        return (
            f"https://www.interactivebrokers.com/authorize"
            f"?response_type=code"
            f"&client_id={self.consumer_key}"
            f"&redirect_uri={self.callback_url}"
            f"&state={state}"
        )

    async def exchange_code_for_token(self, auth_code: str) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for access token.

        Returns:
            Dict with access_token, refresh_token, expires_in
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.ibkr.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": auth_code,
                    "client_id": self.consumer_key,
                    "client_secret": self.consumer_secret,
                    "redirect_uri": self.callback_url
                }
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Token exchange failed: {response.text}")
                return None

    async def create_user_session(
        self,
        user_id: str,
        token_data: Dict[str, Any]
    ) -> IBKRUserSession:
        """
        Create a user session from OAuth token response.
        """
        # Get account ID from IBKR
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{IBKR_API_BASE}/iserver/accounts",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            accounts = response.json().get("accounts", [])
            account_id = accounts[0] if accounts else ""

        expiry = datetime.now() + timedelta(seconds=token_data.get("expires_in", 3600))

        return IBKRUserSession(
            user_id=user_id,
            account_id=account_id,
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            token_expiry=expiry,
            consumer_key=self.consumer_key,
            is_paper=False,  # Determined by account type
            last_authenticated=datetime.now()
        )
