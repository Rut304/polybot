"""
Kalshi WebSocket and REST client for real-time order book data.
Based on jtdoherty/arb-bot with enhancements for production use.
"""

import asyncio
import json
import logging
import time
import base64
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
import requests

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
    """
    
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
    
    def _get_auth_headers(self, path: str = "/trade-api/ws/v2") -> Dict[str, str]:
        """Generate authentication headers with RSA signature."""
        if not self._private_key or not self.api_key:
            return {}
        
        current_time_ms = int(time.time() * 1000)
        timestamp_str = str(current_time_ms)
        message = timestamp_str + "GET" + path
        
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
    
    def discover_markets(
        self,
        event_ticker: Optional[str] = None,
        series_ticker: Optional[str] = None,
        status: str = "open",
        limit: int = 100,
    ) -> List[Market]:
        """
        Discover markets via REST API.
        
        Args:
            event_ticker: Filter by event ticker
            series_ticker: Filter by series ticker
            status: Market status filter ('open', 'closed', etc.)
            limit: Maximum number of markets to return
            
        Returns:
            List of Market objects
        """
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
            response.raise_for_status()
            data = response.json()
            
            markets = []
            for m in data.get("markets", []):
                try:
                    market = Market(
                        ticker=m["ticker"],
                        event_ticker=m.get("event_ticker", ""),
                        title=m.get("title", ""),
                        subtitle=m.get("subtitle", ""),
                        yes_bid=float(m.get("yes_bid", 0)) / 100,  # Convert cents to dollars
                        yes_ask=float(m.get("yes_ask", 0)) / 100,
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
            async with websockets.connect(
                self.ws_url,
                extra_headers=headers,
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
        }
