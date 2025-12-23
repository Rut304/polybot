"""
Polymarket WebSocket and REST client for real-time order book data.
Based on jtdoherty/arb-bot with enhancements for production use.

Now includes LIVE TRADING support via py-clob-client.
"""

import asyncio
import json
import logging
import time
import threading
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
import websocket
import requests

# Import py-clob-client for live trading
try:
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import OrderArgs, ApiCreds
    from py_clob_client.constants import POLYGON
    CLOB_CLIENT_AVAILABLE = True
except ImportError:
    CLOB_CLIENT_AVAILABLE = False
    ClobClient = None

logger = logging.getLogger(__name__)


@dataclass
class OrderBook:
    """Represents an order book for a single market."""
    bids: List[tuple] = field(default_factory=list)  # [(price, size), ...]
    asks: List[tuple] = field(default_factory=list)  # [(price, size), ...]
    last_update: float = 0.0
    
    def best_bid(self) -> Optional[tuple]:
        """Get best bid (highest price)."""
        return self.bids[0] if self.bids else None
    
    def best_ask(self) -> Optional[tuple]:
        """Get best ask (lowest price)."""
        return self.asks[0] if self.asks else None


@dataclass
class Market:
    """Represents a Polymarket market."""
    token_id: str
    condition_id: str
    question: str
    slug: str
    outcome: str  # 'Yes' or 'No'
    outcome_price: float
    volume: float
    
    
class PolymarketClient:
    """
    Real-time Polymarket WebSocket client with order book management.
    
    Features:
    - WebSocket connection with auto-reconnect
    - Order book tracking for multiple markets
    - Dynamic market discovery via Gamma API
    - Thread-safe order book access
    - API key/secret for authenticated endpoints
    """
    
    def __init__(
        self,
        ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market",
        gamma_url: str = "https://gamma-api.polymarket.com",
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
    ):
        self.ws_url = ws_url
        self.gamma_url = gamma_url
        self.api_key = api_key
        self.api_secret = api_secret
        
        # Order books by token_id
        self._order_books: Dict[str, OrderBook] = {}
        self._order_books_lock = threading.Lock()
        
        # Market metadata
        self._markets: Dict[str, Market] = {}
        
        # WebSocket state
        self._ws: Optional[websocket.WebSocketApp] = None
        self._is_running = False
        self._ws_thread: Optional[threading.Thread] = None
        
        # Subscribed token IDs
        self._subscribed_tokens: List[str] = []
    
    @property
    def is_authenticated(self) -> bool:
        """Check if API credentials are configured."""
        return bool(self.api_key and self.api_secret)
        
        # Callbacks
        self._on_update_callback: Optional[Callable[[str, OrderBook], None]] = None
        
        # Stats
        self._update_count = 0
        self._last_update_time = 0.0
    
    def discover_markets(
        self,
        category: Optional[str] = None,
        search_query: Optional[str] = None,
        active_only: bool = True,
        limit: int = 100,
    ) -> List[Market]:
        """
        Discover markets via Gamma API.
        
        Args:
            category: Filter by category (e.g., 'politics', 'sports')
            search_query: Search query string
            active_only: Only return active markets
            limit: Maximum number of markets to return
            
        Returns:
            List of Market objects
        """
        try:
            params = {
                "active": str(active_only).lower(),
                "closed": "false",
                "limit": limit,
            }
            
            if search_query:
                params["_q"] = search_query
            
            # Get events (for multi-outcome markets)
            events_response = requests.get(
                f"{self.gamma_url}/events",
                params=params,
                timeout=10,
            )
            events_response.raise_for_status()
            events = events_response.json()
            
            markets = []
            for event in events:
                for market in event.get("markets", []):
                    try:
                        # Parse outcome prices
                        outcome_prices = market.get("outcomePrices", "")
                        if isinstance(outcome_prices, str):
                            # Parse from string format
                            import re
                            match = re.search(r'\["([0-9.]+)",\s*"([0-9.]+)"\]', outcome_prices)
                            if match:
                                yes_price = float(match.group(1))
                                no_price = float(match.group(2))
                            else:
                                continue
                        elif isinstance(outcome_prices, list) and len(outcome_prices) >= 2:
                            yes_price = float(outcome_prices[0])
                            no_price = float(outcome_prices[1])
                        else:
                            continue
                        
                        # Get token IDs
                        tokens = market.get("clobTokenIds", [])
                        if not tokens or len(tokens) < 2:
                            continue
                        
                        # Create market objects for Yes and No
                        base_market = {
                            "condition_id": market.get("conditionId", ""),
                            "question": market.get("question", event.get("title", "")),
                            "slug": market.get("slug", ""),
                            "volume": float(market.get("volume", 0) or 0),
                        }
                        
                        markets.append(Market(
                            token_id=tokens[0],
                            outcome="Yes",
                            outcome_price=yes_price,
                            **base_market,
                        ))
                        
                        markets.append(Market(
                            token_id=tokens[1],
                            outcome="No",
                            outcome_price=no_price,
                            **base_market,
                        ))
                        
                    except (ValueError, KeyError, IndexError) as e:
                        logger.debug(f"Skipping malformed market: {e}")
                        continue
            
            # Store market metadata
            for market in markets:
                self._markets[market.token_id] = market
            
            logger.info(f"Discovered {len(markets)} market tokens from {len(events)} events")
            return markets
            
        except requests.RequestException as e:
            logger.error(f"Failed to discover markets: {e}")
            return []
    
    def subscribe(self, token_ids: List[str]):
        """Subscribe to order book updates for given token IDs."""
        self._subscribed_tokens = token_ids
        
        # Initialize order books
        with self._order_books_lock:
            for token_id in token_ids:
                if token_id not in self._order_books:
                    self._order_books[token_id] = OrderBook()
        
        # If WebSocket is already running, send subscription message
        if self._ws and self._is_running:
            self._send_subscription()
    
    def _send_subscription(self):
        """Send subscription message to WebSocket."""
        if not self._ws or not self._subscribed_tokens:
            return
        
        subscribe_message = {
            "assets_ids": self._subscribed_tokens,
            "type": "market",
        }
        
        try:
            self._ws.send(json.dumps(subscribe_message))
            logger.info(f"Subscribed to {len(self._subscribed_tokens)} tokens")
        except Exception as e:
            logger.error(f"Failed to send subscription: {e}")
    
    def _on_message(self, ws, message: str):
        """Handle incoming WebSocket message."""
        try:
            data_list = json.loads(message)
            if not isinstance(data_list, list):
                data_list = [data_list]
            
            with self._order_books_lock:
                for data in data_list:
                    if data.get("event_type") == "book":
                        asset_id = data.get("asset_id")
                        if not asset_id:
                            continue
                        
                        # Parse bids and asks
                        new_bids = [
                            (float(bid["price"]), float(bid["size"]))
                            for bid in data.get("bids", [])
                        ]
                        new_asks = [
                            (float(ask["price"]), float(ask["size"]))
                            for ask in data.get("asks", [])
                        ]
                        
                        # Sort: bids high to low, asks low to high
                        new_bids.sort(key=lambda x: x[0], reverse=True)
                        new_asks.sort(key=lambda x: x[0])
                        
                        # Update order book
                        if asset_id not in self._order_books:
                            self._order_books[asset_id] = OrderBook()
                        
                        self._order_books[asset_id].bids = new_bids
                        self._order_books[asset_id].asks = new_asks
                        self._order_books[asset_id].last_update = time.time()
                        
                        self._update_count += 1
                        self._last_update_time = time.time()
                        
                        # Trigger callback
                        if self._on_update_callback:
                            self._on_update_callback(asset_id, self._order_books[asset_id])
                        
                        logger.debug(
                            f"Updated {asset_id}: {len(new_bids)} bids, {len(new_asks)} asks"
                        )
                    
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def _on_open(self, ws):
        """Handle WebSocket connection opened."""
        logger.info("Polymarket WebSocket connected")
        self._is_running = True
        self._send_subscription()
    
    def _on_error(self, ws, error):
        """Handle WebSocket error."""
        logger.error(f"Polymarket WebSocket error: {error}")
        self._is_running = False
    
    def _on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket connection closed."""
        logger.warning(f"Polymarket WebSocket closed: {close_status_code} - {close_msg}")
        self._is_running = False
    
    def start(self, on_update: Optional[Callable[[str, OrderBook], None]] = None):
        """
        Start WebSocket connection in background thread.
        
        Args:
            on_update: Callback function called on each order book update
        """
        self._on_update_callback = on_update
        
        def run_forever():
            while True:
                if not self._is_running:
                    logger.info("Connecting to Polymarket WebSocket...")
                    self._ws = websocket.WebSocketApp(
                        self.ws_url,
                        on_open=self._on_open,
                        on_message=self._on_message,
                        on_error=self._on_error,
                        on_close=self._on_close,
                    )
                    try:
                        self._ws.run_forever(ping_interval=30, ping_timeout=10)
                    except Exception as e:
                        logger.error(f"WebSocket run failed: {e}")
                    
                    # Wait before reconnecting
                    time.sleep(5)
                else:
                    time.sleep(1)
        
        self._ws_thread = threading.Thread(target=run_forever, daemon=True)
        self._ws_thread.start()
        
        # Wait for initial connection
        timeout = 10
        start_time = time.time()
        while not self._is_running and time.time() - start_time < timeout:
            time.sleep(0.1)
        
        if not self._is_running:
            logger.warning("WebSocket connection timed out")
            return False
        
        return True
    
    def stop(self):
        """Stop WebSocket connection."""
        self._is_running = False
        if self._ws:
            self._ws.close()
    
    def get_order_book(self, token_id: str) -> Optional[OrderBook]:
        """Get order book for a token (thread-safe)."""
        with self._order_books_lock:
            return self._order_books.get(token_id)
    
    def get_all_order_books(self) -> Dict[str, OrderBook]:
        """Get all order books (thread-safe copy)."""
        with self._order_books_lock:
            return {k: v for k, v in self._order_books.items()}
    
    def wait_for_data(self, timeout: float = 10.0) -> bool:
        """Wait for initial order book data to arrive."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            with self._order_books_lock:
                # Check if we have data for all subscribed tokens
                if all(
                    token_id in self._order_books and self._order_books[token_id].last_update > 0
                    for token_id in self._subscribed_tokens
                ):
                    logger.info(f"Received data for all {len(self._subscribed_tokens)} tokens")
                    return True
            time.sleep(0.1)
        
        logger.warning("Timed out waiting for order book data")
        return False
    
    @property
    def is_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self._is_running
    
    @property
    def stats(self) -> dict:
        """Get client statistics."""
        return {
            "connected": self._is_running,
            "subscribed_tokens": len(self._subscribed_tokens),
            "update_count": self._update_count,
            "last_update": self._last_update_time,
        }

    def get_balance(self, wallet_address: str) -> dict:
        """
        Get wallet balance from Polymarket.
        
        Args:
            wallet_address: Ethereum wallet address
            
        Returns:
            Dict with balance info: {
                "usdc_balance": float,  # USDC balance in dollars
                "positions_value": float,  # Total value of positions
                "total_value": float,  # Total portfolio value
                "positions": list,  # List of positions
            }
        """
        try:
            # Get positions/portfolio from the data API
            response = requests.get(
                f"https://data-api.polymarket.com/positions",
                params={"user": wallet_address.lower()},
                timeout=10,
            )
            response.raise_for_status()
            positions = response.json()
            
            positions_value = 0.0
            position_list = []
            
            for pos in positions:
                try:
                    size = float(pos.get("size", 0))
                    current_price = float(pos.get("currentPrice", 0))
                    value = size * current_price
                    positions_value += value
                    
                    position_list.append({
                        "market": pos.get("title", pos.get("slug", "Unknown")),
                        "outcome": pos.get("outcome", "Yes"),
                        "size": size,
                        "avg_price": float(pos.get("avgPrice", 0)),
                        "current_price": current_price,
                        "value": value,
                        "pnl": value - (size * float(pos.get("avgPrice", current_price))),
                    })
                except (ValueError, TypeError):
                    continue
            
            # Note: USDC balance requires on-chain query or authenticated API
            # For now, we return positions value
            return {
                "usdc_balance": 0.0,  # Would need web3 to get on-chain USDC balance
                "positions_value": round(positions_value, 2),
                "total_value": round(positions_value, 2),
                "positions": position_list,
                "position_count": len(position_list),
            }
            
        except requests.RequestException as e:
            logger.error(f"Failed to get Polymarket balance: {e}")
            return {
                "usdc_balance": 0.0,
                "positions_value": 0.0,
                "total_value": 0.0,
                "positions": [],
                "position_count": 0,
                "error": str(e),
            }

    # =========================================================================
    # LIVE TRADING METHODS
    # =========================================================================

    def create_clob_client(
        self,
        private_key: str,
        chain_id: int = 137,  # Polygon mainnet
        funder: Optional[str] = None,
    ) -> Optional[Any]:
        """
        Create a ClobClient instance for live trading.
        
        Args:
            private_key: Ethereum private key (0x prefixed)
            chain_id: Chain ID (137 for Polygon mainnet)
            funder: Optional funder address
            
        Returns:
            ClobClient instance or None if unavailable
        """
        if not CLOB_CLIENT_AVAILABLE:
            logger.error(
                "py-clob-client not installed. "
                "Install with: pip install py-clob-client"
            )
            return None
        
        try:
            # Create credentials
            creds = ApiCreds(
                api_key=self.api_key,
                api_secret=self.api_secret,
                api_passphrase="",  # Polymarket doesn't use passphrase
            )
            
            # Create client
            client = ClobClient(
                host="https://clob.polymarket.com",
                chain_id=chain_id,
                key=private_key,
                creds=creds,
                funder=funder,
            )
            
            logger.info("✓ Polymarket ClobClient created for live trading")
            return client
            
        except Exception as e:
            logger.error(f"Failed to create ClobClient: {e}")
            return None

    async def place_order(
        self,
        clob_client: Any,
        token_id: str,
        side: str,  # 'BUY' or 'SELL'
        price: float,  # 0.0 to 1.0
        size: float,  # Number of shares
        order_type: str = "GTC",  # GTC, FOK, IOC
    ) -> Dict:
        """
        Place a live order on Polymarket.
        
        Args:
            clob_client: ClobClient instance from create_clob_client()
            token_id: The token ID to trade
            side: 'BUY' or 'SELL'
            price: Price between 0 and 1 (e.g., 0.65 for 65 cents)
            size: Number of shares to trade
            order_type: Order type (GTC=Good Till Cancel, FOK, IOC)
            
        Returns:
            Dict with order result:
            {
                "success": bool,
                "order_id": str or None,
                "filled_size": float,
                "fill_price": float,
                "tx_hash": str or None,
                "error": str or None,
            }
        """
        if not clob_client:
            return {
                "success": False,
                "order_id": None,
                "filled_size": 0.0,
                "fill_price": 0.0,
                "tx_hash": None,
                "error": "ClobClient not initialized",
            }
        
        try:
            logger.info(
                f"🔴 LIVE ORDER: {side} {size} shares of {token_id[:20]}... "
                f"@ ${price:.4f}"
            )
            
            # Create order args
            order_args = {
                "token_id": token_id,
                "price": price,
                "size": size,
                "side": side.upper(),
            }
            
            # Set order options based on type
            options = None
            if order_type == "FOK":
                options = {"time_in_force": "FOK"}
            elif order_type == "IOC":
                options = {"time_in_force": "IOC"}
            
            # Submit order
            result = clob_client.create_and_post_order(order_args, options)
            
            # Parse response
            if result and result.get("success"):
                order_id = result.get("orderID", result.get("order_id"))
                logger.info(f"✅ Order placed successfully: {order_id}")
                return {
                    "success": True,
                    "order_id": order_id,
                    "filled_size": float(result.get("filledSize", size)),
                    "fill_price": price,
                    "tx_hash": result.get("transactionHash"),
                    "error": None,
                }
            else:
                error_msg = result.get("errorMsg", "Unknown error")
                logger.error(f"❌ Order failed: {error_msg}")
                return {
                    "success": False,
                    "order_id": None,
                    "filled_size": 0.0,
                    "fill_price": 0.0,
                    "tx_hash": None,
                    "error": error_msg,
                }
                
        except Exception as e:
            logger.error(f"❌ Order execution error: {e}")
            return {
                "success": False,
                "order_id": None,
                "filled_size": 0.0,
                "fill_price": 0.0,
                "tx_hash": None,
                "error": str(e),
            }

    async def cancel_order(
        self,
        clob_client: Any,
        order_id: str,
    ) -> Dict:
        """
        Cancel an existing order on Polymarket.
        
        Args:
            clob_client: ClobClient instance
            order_id: Order ID to cancel
            
        Returns:
            Dict with cancel result
        """
        if not clob_client:
            return {"success": False, "error": "ClobClient not initialized"}
        
        try:
            result = clob_client.cancel(order_id)
            if result and result.get("success"):
                logger.info(f"✅ Order {order_id} cancelled")
                return {"success": True, "error": None}
            else:
                return {
                    "success": False,
                    "error": result.get("errorMsg", "Cancel failed"),
                }
        except Exception as e:
            logger.error(f"Cancel error: {e}")
            return {"success": False, "error": str(e)}

    async def get_open_orders(self, clob_client: Any) -> List[Dict]:
        """Get all open orders for the account."""
        if not clob_client:
            return []
        
        try:
            orders = clob_client.get_orders()
            return orders if orders else []
        except Exception as e:
            logger.error(f"Failed to get open orders: {e}")
            return []

