"""
Kalshi WebSocket and REST client for real-time order book data.
Based on jtdoherty/arb-bot with enhancements for production use.

Features:
- Rate limiting to prevent 429 errors
- Adaptive backoff on rate limit responses
- WebSocket order book tracking
"""

import asyncio
import json
import logging
import time
import base64
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
import requests

# Import rate limiter
try:
    from src.utils.rate_limiter import get_rate_limiter, RateLimiter
    RATE_LIMITER_AVAILABLE = True
except ImportError:
    RATE_LIMITER_AVAILABLE = False

logger = logging.getLogger(__name__)

# Optional imports for WebSocket and cryptography
try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    logger.warning("websockets package not installed - Kalshi WebSocket unavailable")

try:
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography package not installed - Kalshi auth unavailable")


@dataclass
class OrderBook:
    """Represents an order book for a single market."""
    yes_bids: Dict[float, int] = field(default_factory=dict)  # {price: quantity}
    yes_asks: Dict[float, int] = field(default_factory=dict)
    no_bids: Dict[float, int] = field(default_factory=dict)
    no_asks: Dict[float, int] = field(default_factory=dict)
    last_update: float = 0.0

    def best_yes_bid(self) -> Optional[tuple]:
        """Get best YES bid (highest price)."""
        if not self.yes_bids:
            return None
        price = max(self.yes_bids.keys())
        return (price, self.yes_bids[price])

    def best_yes_ask(self) -> Optional[tuple]:
        """Get best YES ask (lowest price)."""
        if not self.yes_asks:
            return None
        price = min(self.yes_asks.keys())
        return (price, self.yes_asks[price])

    def get_sorted_bids(self, side: str = "yes") -> List[tuple]:
        """Get sorted bids (highest to lowest price)."""
        bids = self.yes_bids if side == "yes" else self.no_bids
        return sorted([(p, q) for p, q in bids.items()], key=lambda x: x[0], reverse=True)

    def get_sorted_asks(self, side: str = "yes") -> List[tuple]:
        """Get sorted asks (lowest to highest price)."""
        asks = self.yes_asks if side == "yes" else self.no_asks
        return sorted([(p, q) for p, q in asks.items()], key=lambda x: x[0])


@dataclass
class Market:
    """Represents a Kalshi market."""
    ticker: str
    event_ticker: str
    title: str
    subtitle: str
    yes_bid: float
    yes_ask: float
    volume: int
    open_interest: int
    status: str


class KalshiClient:
    """
    Real-time Kalshi WebSocket client with order book management.

    Features:
    - Authenticated WebSocket connection
    - Order book tracking with delta updates
    - Market discovery via REST API
    - RSA signature authentication
    - Rate limiting to prevent 429 errors
    """

    # Rate limiting constants
    MIN_REQUEST_INTERVAL = 2.0  # Minimum seconds between requests
    REQUESTS_PER_MINUTE = 30  # Conservative limit

    def __init__(
        self,
        api_key: Optional[str] = None,
        private_key: Optional[str] = None,
        ws_url: str = "wss://api.elections.kalshi.com/trade-api/ws/v2",
        api_url: str = "https://api.elections.kalshi.com/trade-api/v2",
    ):
        self.api_key = api_key
        self.private_key_content = private_key
        self.ws_url = ws_url
        self.api_url = api_url

        # Load private key
        self._private_key = None
        if private_key and CRYPTO_AVAILABLE:
            self._load_private_key()

        # Order books by market ticker
        self._order_books: Dict[str, OrderBook] = {}

        # Market metadata
        self._markets: Dict[str, Market] = {}

        # Subscribed market tickers
        self._subscribed_tickers: List[str] = []

        # Rate limiting state
        self._last_request_time: float = 0.0
        self._request_count_minute: int = 0
        self._minute_window_start: float = 0.0
        self._backoff_until: float = 0.0
        self._consecutive_429s: int = 0

        # Get global rate limiter if available
        self._rate_limiter = None
        if RATE_LIMITER_AVAILABLE:
            try:
                self._rate_limiter = get_rate_limiter()
            except Exception:
                pass

        # WebSocket state
        self._is_running = False

        # Stats
        self._update_count = 0
        self._last_update_time = 0.0

    def _load_private_key(self):
        """Load RSA private key for authentication."""
        if not CRYPTO_AVAILABLE:
            logger.error("cryptography package required for Kalshi authentication")
            return

        try:
            # Check if it's a file path or the key content itself
            key_content = self.private_key_content
            if key_content and not key_content.startswith("-----"):
                # It's a file path
                with open(key_content, "rb") as f:
                    key_content = f.read()
            else:
                key_content = key_content.encode() if isinstance(key_content, str) else key_content

            self._private_key = serialization.load_pem_private_key(
                key_content,
                password=None,
            )
            logger.info("Kalshi private key loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Kalshi private key: {e}")
            self._private_key = None

    def _get_auth_headers(self, path: str = "/trade-api/ws/v2", method: str = "GET") -> Dict[str, str]:
        """Generate authentication headers with RSA signature.
        
        Args:
            path: API path (e.g., "/trade-api/v2/portfolio/orders")
            method: HTTP method - "GET" or "POST" (must match actual request method!)
        """
        if not self._private_key or not self.api_key:
            return {}

        current_time_ms = int(time.time() * 1000)
        timestamp_str = str(current_time_ms)
        message = timestamp_str + method + path

        signature = self._private_key.sign(
            message.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.DIGEST_LENGTH,
            ),
            hashes.SHA256(),
        )

        return {
            "Content-Type": "application/json",
            "KALSHI-ACCESS-KEY": self.api_key,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode('utf-8'),
            "KALSHI-ACCESS-TIMESTAMP": timestamp_str,
        }

    def _wait_for_rate_limit(self):
        """
        Wait if necessary to respect rate limits.
        Returns the time waited in seconds.
        """
        now = time.time()
        wait_time = 0.0

        # Check if we're in backoff period (after 429)
        if now < self._backoff_until:
            wait_time = self._backoff_until - now
            logger.info(f"[Kalshi] Rate limited, waiting {wait_time:.1f}s")
            time.sleep(wait_time)
            now = time.time()

        # Reset minute window if needed
        if now - self._minute_window_start >= 60:
            self._minute_window_start = now
            self._request_count_minute = 0

        # Check per-minute limit
        if self._request_count_minute >= self.REQUESTS_PER_MINUTE:
            wait_until = self._minute_window_start + 60
            extra_wait = wait_until - now + 0.1
            if extra_wait > 0:
                logger.info(
                    f"[Kalshi] Per-minute limit ({self.REQUESTS_PER_MINUTE}) "
                    f"reached, waiting {extra_wait:.1f}s"
                )
                time.sleep(extra_wait)
                wait_time += extra_wait
                now = time.time()
                self._minute_window_start = now
                self._request_count_minute = 0

        # Enforce minimum interval
        time_since_last = now - self._last_request_time
        if time_since_last < self.MIN_REQUEST_INTERVAL:
            extra_wait = self.MIN_REQUEST_INTERVAL - time_since_last
            time.sleep(extra_wait)
            wait_time += extra_wait

        # Update state
        self._last_request_time = time.time()
        self._request_count_minute += 1

        return wait_time

    def _handle_rate_limit_response(self, status_code: int):
        """Handle 429 rate limit response with exponential backoff."""
        if status_code == 429:
            self._consecutive_429s += 1
            # Exponential backoff: 5, 10, 20, 40, 60 (max)
            backoff = min(5 * (2 ** (self._consecutive_429s - 1)), 60)
            self._backoff_until = time.time() + backoff
            logger.warning(
                f"[Kalshi] Rate limit 429 (#{self._consecutive_429s}). "
                f"Backing off {backoff}s"
            )
        else:
            # Success - reset 429 counter
            if self._consecutive_429s > 0:
                logger.debug("[Kalshi] Request succeeded, resetting backoff")
            self._consecutive_429s = 0

    def discover_markets(
        self,
        event_ticker: Optional[str] = None,
        series_ticker: Optional[str] = None,
        status: str = "open",
        limit: int = 100,
    ) -> List[Market]:
        """
        Discover markets via REST API with rate limiting.

        Args:
            event_ticker: Filter by event ticker
            series_ticker: Filter by series ticker
            status: Market status filter ('open', 'closed', etc.)
            limit: Maximum number of markets to return

        Returns:
            List of Market objects
        """
        # Apply rate limiting before request
        self._wait_for_rate_limit()

        try:
            params = {
                "limit": limit,
                "status": status,
            }

            if event_ticker:
                params["event_ticker"] = event_ticker
            if series_ticker:
                params["series_ticker"] = series_ticker

            response = requests.get(
                f"{self.api_url}/markets",
                params=params,
                headers={"accept": "application/json"},
                timeout=10,
            )

            # Handle rate limit response
            self._handle_rate_limit_response(response.status_code)

            if response.status_code == 429:
                logger.warning("Kalshi 429 - retrying after backoff")
                return []

            response.raise_for_status()
            data = response.json()

            markets = []
            for m in data.get("markets", []):
                try:
                    # Convert cents to dollars
                    yes_bid = float(m.get("yes_bid", 0)) / 100
                    yes_ask = float(m.get("yes_ask", 0)) / 100
                    market = Market(
                        ticker=m["ticker"],
                        event_ticker=m.get("event_ticker", ""),
                        title=m.get("title", ""),
                        subtitle=m.get("subtitle", ""),
                        yes_bid=yes_bid,
                        yes_ask=yes_ask,
                        volume=int(m.get("volume", 0)),
                        open_interest=int(m.get("open_interest", 0)),
                        status=m.get("status", ""),
                    )
                    markets.append(market)
                    self._markets[market.ticker] = market
                except (KeyError, ValueError) as e:
                    logger.debug(f"Skipping malformed market: {e}")
                    continue

            logger.info(f"Discovered {len(markets)} Kalshi markets")
            return markets

        except requests.RequestException as e:
            logger.error(f"Failed to discover Kalshi markets: {e}")
            return []
            return []

    def subscribe(self, tickers: List[str]):
        """Set market tickers to subscribe to."""
        self._subscribed_tickers = tickers

        # Initialize order books
        for ticker in tickers:
            if ticker not in self._order_books:
                self._order_books[ticker] = OrderBook()

    def _update_order_book(
        self,
        ticker: str,
        snapshot: Optional[Dict] = None,
        delta: Optional[Dict] = None,
    ):
        """Update order book from snapshot or delta message."""
        if ticker not in self._order_books:
            self._order_books[ticker] = OrderBook()

        book = self._order_books[ticker]

        if snapshot:
            # Full snapshot - replace entire order book
            book.yes_bids = {price: qty for price, qty in snapshot.get("yes", [])}
            book.no_bids = {price: qty for price, qty in snapshot.get("no", [])}
            # Note: Kalshi provides bids/asks differently - may need adjustment

        elif delta:
            # Delta update - modify existing order book
            side = delta.get("side", "yes")
            price = delta.get("price", 0)
            delta_qty = delta.get("delta", 0)

            if side == "yes":
                current_qty = book.yes_bids.get(price, 0)
                new_qty = current_qty + delta_qty
                if new_qty <= 0:
                    book.yes_bids.pop(price, None)
                else:
                    book.yes_bids[price] = new_qty
            else:
                current_qty = book.no_bids.get(price, 0)
                new_qty = current_qty + delta_qty
                if new_qty <= 0:
                    book.no_bids.pop(price, None)
                else:
                    book.no_bids[price] = new_qty

        book.last_update = time.time()
        self._update_count += 1
        self._last_update_time = time.time()

    async def run(self):
        """Run WebSocket connection (async)."""
        if not WEBSOCKETS_AVAILABLE:
            logger.error("websockets package required for Kalshi WebSocket")
            return

        if not self._private_key or not self.api_key:
            logger.error("Kalshi API credentials required for WebSocket connection")
            return

        headers = self._get_auth_headers()

        try:
            # Use additional_headers for newer websockets versions
            async with websockets.connect(
                self.ws_url,
                additional_headers=headers,
                ping_interval=10,
            ) as websocket:
                self._is_running = True
                logger.info("Kalshi WebSocket connected")

                # Subscribe to order book updates
                subscription = {
                    "id": 1,
                    "cmd": "subscribe",
                    "params": {
                        "channels": ["orderbook_delta"],
                        "market_tickers": self._subscribed_tickers,
                    },
                }
                await websocket.send(json.dumps(subscription))
                logger.info(f"Subscribed to {len(self._subscribed_tickers)} Kalshi markets")

                # Process messages
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        msg_type = data.get("type")

                        if msg_type == "orderbook_snapshot":
                            ticker = data["msg"]["market_ticker"]
                            self._update_order_book(ticker, snapshot=data["msg"])
                            logger.debug(f"Kalshi snapshot: {ticker}")

                        elif msg_type == "orderbook_delta":
                            ticker = data["msg"]["market_ticker"]
                            self._update_order_book(ticker, delta=data["msg"])
                            logger.debug(f"Kalshi delta: {ticker}")

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.debug(f"Skipping message: {e}")
                        continue

        except Exception as e:
            logger.error(f"Kalshi WebSocket error: {e}")
        finally:
            self._is_running = False

    def get_order_book(self, ticker: str) -> Optional[OrderBook]:
        """Get order book for a market ticker."""
        return self._order_books.get(ticker)

    def get_all_order_books(self) -> Dict[str, OrderBook]:
        """Get all order books."""
        return dict(self._order_books)

    @property
    def is_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self._is_running

    @property
    def is_authenticated(self) -> bool:
        """Check if API credentials are configured."""
        return bool(self._private_key and self.api_key)

    @property
    def stats(self) -> dict:
        """Get client statistics."""
        return {
            "connected": self._is_running,
            "authenticated": self.is_authenticated,
            "subscribed_tickers": len(self._subscribed_tickers),
            "update_count": self._update_count,
            "last_update": self._last_update_time,
            "rate_limit_stats": {
                "requests_this_minute": self._request_count_minute,
                "consecutive_429s": self._consecutive_429s,
                "backoff_until": self._backoff_until,
            },
        }

    def get_balance(self) -> dict:
        """
        Get account balance from Kalshi with rate limiting.

        Requires valid API credentials.

        Returns:
            Dict with balance info: {
                "balance": float,  # Cash balance in dollars
                "portfolio_value": float,  # Total value of positions
                "total_value": float,  # Total account value
                "positions": list,  # List of positions
            }
        """
        if not self.is_authenticated:
            return {
                "balance": 0.0,
                "portfolio_value": 0.0,
                "total_value": 0.0,
                "positions": [],
                "error": "Not authenticated - API key required",
            }

        try:
            # Apply rate limiting before balance request
            self._wait_for_rate_limit()

            # Get account balance
            headers = self._get_auth_headers("/trade-api/v2/portfolio/balance")
            balance_response = requests.get(
                f"{self.api_url}/portfolio/balance",
                headers=headers,
                timeout=10,
            )

            self._handle_rate_limit_response(balance_response.status_code)
            if balance_response.status_code == 429:
                return {
                    "balance": 0.0,
                    "portfolio_value": 0.0,
                    "total_value": 0.0,
                    "positions": [],
                    "error": "Rate limited (429) - try again later",
                }

            balance_response.raise_for_status()
            balance_data = balance_response.json()

            # Balance is in cents
            cash_balance = float(balance_data.get("balance", 0)) / 100.0

            # Apply rate limiting before positions request
            self._wait_for_rate_limit()

            # Get positions
            headers = self._get_auth_headers("/trade-api/v2/portfolio/positions")
            positions_response = requests.get(
                f"{self.api_url}/portfolio/positions",
                headers=headers,
                timeout=10,
            )

            self._handle_rate_limit_response(positions_response.status_code)
            if positions_response.status_code == 429:
                # Return balance only, no positions
                return {
                    "balance": round(cash_balance, 2),
                    "portfolio_value": 0.0,
                    "total_value": round(cash_balance, 2),
                    "positions": [],
                    "error": "Rate limited on positions - partial data",
                }

            positions_response.raise_for_status()
            positions_data = positions_response.json()

            positions_value = 0.0
            position_list = []

            for pos in positions_data.get("market_positions", []):
                try:
                    # Kalshi positions
                    ticker = pos.get("ticker", "")
                    quantity = int(pos.get("position", 0))
                    # Estimate value
                    est_price = float(pos.get("market_exposure", 0)) / 100.0
                    value = abs(quantity) * est_price if quantity else 0
                    positions_value += value

                    position_list.append({
                        "ticker": ticker,
                        "quantity": quantity,
                        "side": "yes" if quantity > 0 else "no",
                        "estimated_value": value,
                    })
                except (ValueError, TypeError):
                    continue

            return {
                "balance": round(cash_balance, 2),
                "portfolio_value": round(positions_value, 2),
                "total_value": round(cash_balance + positions_value, 2),
                "positions": position_list,
                "position_count": len(position_list),
            }

        except requests.RequestException as e:
            logger.error(f"Failed to get Kalshi balance: {e}")
            return {
                "balance": 0.0,
                "portfolio_value": 0.0,
                "total_value": 0.0,
                "positions": [],
                "error": str(e),
            }

    # =========================================================================
    # LIVE TRADING METHODS
    # =========================================================================

    async def place_order(
        self,
        ticker: str,
        side: str,  # 'yes' or 'no'
        action: str,  # 'buy' or 'sell'
        count: int,  # Number of contracts
        price_cents: int,  # Price in cents (1-99)
        order_type: str = "limit",  # 'limit' or 'market'
        time_in_force: str = "good_till_canceled",  # GTC, FOK, IOC
        client_order_id: Optional[str] = None,
    ) -> Dict:
        """
        Place a live order on Kalshi.

        Args:
            ticker: Market ticker (e.g., "KXBTCUSD-25JAN03-B101500")
            side: 'yes' or 'no'
            action: 'buy' or 'sell'
            count: Number of contracts
            price_cents: Price in cents (1-99)
            order_type: 'limit' or 'market'
            time_in_force: Order duration
            client_order_id: Optional client-side order ID

        Returns:
            Dict with order result:
            {
                "success": bool,
                "order_id": str or None,
                "filled_count": int,
                "remaining_count": int,
                "status": str,
                "fees_cents": int,
                "error": str or None,
            }
        """
        if not self.is_authenticated:
            return {
                "success": False,
                "order_id": None,
                "filled_count": 0,
                "remaining_count": count,
                "status": "failed",
                "fees_cents": 0,
                "error": "Not authenticated - API key and private key required",
            }

        try:
            # Apply rate limiting
            self._wait_for_rate_limit()

            logger.info(
                f"🔴 LIVE ORDER: {action.upper()} {count} {side.upper()} "
                f"contracts of {ticker} @ {price_cents}¢"
            )

            # Build order payload
            order_payload = {
                "ticker": ticker,
                "side": side.lower(),
                "action": action.lower(),
                "count": count,
                "type": order_type,
                "time_in_force": time_in_force,
            }

            # Add price for limit orders
            if order_type == "limit":
                if side.lower() == "yes":
                    order_payload["yes_price"] = price_cents
                else:
                    order_payload["no_price"] = price_cents

            # Add client order ID if provided
            if client_order_id:
                order_payload["client_order_id"] = client_order_id

            # Get auth headers for POST
            path = "/trade-api/v2/portfolio/orders"
            headers = self._get_auth_headers(path, method="POST")
            headers["Content-Type"] = "application/json"

            # Submit order
            response = requests.post(
                f"{self.api_url}/portfolio/orders",
                headers=headers,
                json=order_payload,
                timeout=15,
            )

            # Handle rate limiting
            self._handle_rate_limit_response(response.status_code)

            if response.status_code == 429:
                return {
                    "success": False,
                    "order_id": None,
                    "filled_count": 0,
                    "remaining_count": count,
                    "status": "rate_limited",
                    "fees_cents": 0,
                    "error": "Rate limited (429) - try again later",
                }

            if response.status_code == 201:
                data = response.json()
                order = data.get("order", {})
                order_id = order.get("order_id")
                status = order.get("status", "submitted")
                filled = order.get("fill_count", 0)
                remaining = order.get("remaining_count", count)
                taker_fees = order.get("taker_fees", 0)
                maker_fees = order.get("maker_fees", 0)

                logger.info(
                    f"✅ Order placed: {order_id} | "
                    f"Status: {status} | Filled: {filled}/{count}"
                )

                return {
                    "success": True,
                    "order_id": order_id,
                    "filled_count": filled,
                    "remaining_count": remaining,
                    "status": status,
                    "fees_cents": taker_fees + maker_fees,
                    "error": None,
                }
            else:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get(
                    "message",
                    f"HTTP {response.status_code}"
                )
                logger.error(f"❌ Order failed: {error_msg}")
                return {
                    "success": False,
                    "order_id": None,
                    "filled_count": 0,
                    "remaining_count": count,
                    "status": "failed",
                    "fees_cents": 0,
                    "error": error_msg,
                }

        except Exception as e:
            logger.error(f"❌ Order execution error: {e}")
            return {
                "success": False,
                "order_id": None,
                "filled_count": 0,
                "remaining_count": count,
                "status": "error",
                "fees_cents": 0,
                "error": str(e),
            }

    async def cancel_order(self, order_id: str) -> Dict:
        """
        Cancel an existing order on Kalshi.

        Args:
            order_id: The order ID to cancel

        Returns:
            Dict with cancel result
        """
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}

        try:
            self._wait_for_rate_limit()

            path = f"/trade-api/v2/portfolio/orders/{order_id}"
            headers = self._get_auth_headers(path, method="DELETE")

            response = requests.delete(
                f"{self.api_url}/portfolio/orders/{order_id}",
                headers=headers,
                timeout=10,
            )

            self._handle_rate_limit_response(response.status_code)

            if response.status_code in [200, 204]:
                logger.info(f"✅ Order {order_id} cancelled")
                return {"success": True, "error": None}
            else:
                error_msg = response.json().get("message", "Cancel failed")
                return {"success": False, "error": error_msg}

        except Exception as e:
            logger.error(f"Cancel error: {e}")
            return {"success": False, "error": str(e)}

    async def get_open_orders(self) -> List[Dict]:
        """Get all open orders for the account."""
        if not self.is_authenticated:
            return []

        try:
            self._wait_for_rate_limit()

            path = "/trade-api/v2/portfolio/orders"
            headers = self._get_auth_headers(path)

            response = requests.get(
                f"{self.api_url}/portfolio/orders",
                headers=headers,
                params={"status": "resting"},
                timeout=10,
            )

            self._handle_rate_limit_response(response.status_code)

            if response.status_code == 200:
                return response.json().get("orders", [])
            return []

        except Exception as e:
            logger.error(f"Failed to get open orders: {e}")
            return []

    async def get_order(self, order_id: str) -> Optional[Dict]:
        """Get details of a specific order."""
        if not self.is_authenticated:
            return None

        try:
            self._wait_for_rate_limit()

            path = f"/trade-api/v2/portfolio/orders/{order_id}"
            headers = self._get_auth_headers(path)

            response = requests.get(
                f"{self.api_url}/portfolio/orders/{order_id}",
                headers=headers,
                timeout=10,
            )

            self._handle_rate_limit_response(response.status_code)

            if response.status_code == 200:
                return response.json().get("order")
            return None

        except Exception as e:
            logger.error(f"Failed to get order {order_id}: {e}")
            return None