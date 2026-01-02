"""
Unified Market Data Service - Aggregates data from all trading platforms.

This service provides a single interface to market data across:
- Prediction Markets: Polymarket, Kalshi
- Stock Brokers: Alpaca (public data), IBKR, Webull (authenticated)
- Crypto Exchanges: Binance, Coinbase, Hyperliquid (via CCXT)

DESIGN PRINCIPLES:
1. Simulation mode: ALL public data sources (no auth needed)
2. Live mode: ONLY user's connected platforms
3. Normalized schema across all platforms
4. Source tracking for every data point
5. Rate limiting per-provider

USAGE:
    # Simulation mode - all public data
    data_service = UnifiedMarketDataService(user_id, mode="simulation")
    await data_service.initialize()
    
    # Get unified market data
    opportunities = await data_service.get_all_opportunities()
    
    # Live mode - user's platforms only
    data_service = UnifiedMarketDataService(user_id, mode="live")
    await data_service.initialize()  # Only loads connected platforms
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any, Literal
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


# =============================================================================
# DATA TYPES - Unified schema for all platforms
# =============================================================================

class AssetType(Enum):
    """Type of tradeable asset."""
    PREDICTION = "prediction"  # Polymarket, Kalshi
    STOCK = "stock"           # Alpaca, IBKR, Webull
    CRYPTO = "crypto"         # Binance, Coinbase, Hyperliquid
    OPTION = "option"         # IBKR, Alpaca
    FUTURES = "futures"       # IBKR, Binance futures


class DataSource(Enum):
    """Source platform for market data."""
    # Prediction Markets
    POLYMARKET = "polymarket"
    KALSHI = "kalshi"
    
    # Stock Brokers (public data available)
    ALPACA = "alpaca"
    
    # Stock Brokers (auth required for data)
    IBKR = "ibkr"
    WEBULL = "webull"
    
    # Crypto Exchanges (public data available)
    BINANCE = "binance"
    COINBASE = "coinbase"
    HYPERLIQUID = "hyperliquid"
    
    # Fallback for stock data
    YAHOO = "yahoo"


@dataclass
class UnifiedTicker:
    """
    Normalized market data from any platform.
    
    All prices normalized to same format regardless of source.
    """
    # Identification
    symbol: str                    # Unified symbol (e.g., "AAPL", "BTC/USDT", "trump-win-2024")
    source: DataSource             # Where this data came from
    asset_type: AssetType          # Type of asset
    
    # Price data
    bid: float                     # Best bid price
    ask: float                     # Best ask price
    last_price: float              # Last traded price
    mid_price: float               # (bid + ask) / 2
    spread_percent: float          # (ask - bid) / mid * 100
    
    # Volume/liquidity
    volume_24h: float              # 24h trading volume
    liquidity: Optional[float]     # Available liquidity at best prices
    
    # Timestamps
    timestamp: datetime            # When this data was fetched
    source_timestamp: Optional[datetime]  # Platform's timestamp (if provided)
    
    # Metadata
    market_id: Optional[str] = None       # Platform-specific ID
    market_title: Optional[str] = None    # Human-readable title
    category: Optional[str] = None        # Category/sector
    expiry: Optional[datetime] = None     # Expiry for options/prediction markets
    
    # For prediction markets
    yes_price: Optional[float] = None
    no_price: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "symbol": self.symbol,
            "source": self.source.value,
            "asset_type": self.asset_type.value,
            "bid": self.bid,
            "ask": self.ask,
            "last_price": self.last_price,
            "mid_price": self.mid_price,
            "spread_percent": self.spread_percent,
            "volume_24h": self.volume_24h,
            "liquidity": self.liquidity,
            "timestamp": self.timestamp.isoformat(),
            "market_id": self.market_id,
            "market_title": self.market_title,
            "category": self.category,
            "yes_price": self.yes_price,
            "no_price": self.no_price,
        }


@dataclass
class UnifiedOpportunity:
    """
    Arbitrage or trading opportunity from any platform.
    """
    # Identification
    opportunity_id: str
    source: DataSource
    asset_type: AssetType
    
    # Opportunity details
    symbol: str
    market_title: str
    spread_percent: float          # Potential profit %
    direction: str                 # "buy", "sell", "arb"
    
    # Prices
    entry_price: float
    exit_price: Optional[float]    # For arb, the other side
    
    # Risk/reward
    expected_profit: float
    confidence_score: float        # 0-1 confidence in opportunity
    
    # Execution
    min_size: float
    max_size: float
    
    # Metadata
    timestamp: datetime
    expires_at: Optional[datetime]
    
    # Cross-platform arbitrage
    exit_source: Optional[DataSource] = None  # For cross-platform arb


# =============================================================================
# DATA ADAPTERS - One per platform
# =============================================================================

class BaseDataAdapter(ABC):
    """
    Abstract base class for platform data adapters.
    
    Each adapter normalizes data from one platform into unified schema.
    """
    
    def __init__(self, requires_auth: bool = False, rate_limit: int = 60):
        self.requires_auth = requires_auth
        self.rate_limit = rate_limit  # Requests per minute
        self._initialized = False
        self._last_request = 0
    
    @property
    @abstractmethod
    def source(self) -> DataSource:
        """Return the data source this adapter handles."""
        pass
    
    @property
    @abstractmethod
    def asset_types(self) -> List[AssetType]:
        """Return asset types this adapter provides."""
        pass
    
    @abstractmethod
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize the adapter (connect to API, authenticate if needed)."""
        pass
    
    @abstractmethod
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get all available markets/tickers."""
        pass
    
    @abstractmethod
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get ticker for a specific symbol."""
        pass
    
    async def get_opportunities(self) -> List[UnifiedOpportunity]:
        """Find trading opportunities (default: scan spreads)."""
        return []


class PolymarketAdapter(BaseDataAdapter):
    """
    Adapter for Polymarket prediction market data.
    
    PUBLIC DATA - No authentication required.
    """
    
    def __init__(self):
        super().__init__(requires_auth=False, rate_limit=100)
        self._client = None
    
    @property
    def source(self) -> DataSource:
        return DataSource.POLYMARKET
    
    @property
    def asset_types(self) -> List[AssetType]:
        return [AssetType.PREDICTION]
    
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize Polymarket client."""
        try:
            from src.clients.polymarket_client import PolymarketClient
            self._client = PolymarketClient()
            self._initialized = True
            logger.info(f"✅ {self.source.value} adapter initialized")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to initialize Polymarket adapter: {e}")
            return False
    
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get all Polymarket markets."""
        if not self._initialized or not self._client:
            return []
        
        tickers = []
        try:
            # Get active markets from Gamma API
            markets = self._client.get_active_markets()
            
            for market in markets[:100]:  # Limit to prevent rate limits
                try:
                    token_id = market.get('clob_token_ids', [None, None])
                    yes_price = market.get('outcomePrices', [0.5, 0.5])[0]
                    no_price = market.get('outcomePrices', [0.5, 0.5])[1]
                    
                    # Handle string prices
                    if isinstance(yes_price, str):
                        yes_price = float(yes_price)
                    if isinstance(no_price, str):
                        no_price = float(no_price)
                    
                    mid = (yes_price + no_price) / 2 if yes_price and no_price else 0.5
                    spread = abs(yes_price + no_price - 1.0) * 100  # Deviation from $1
                    
                    ticker = UnifiedTicker(
                        symbol=market.get('slug', ''),
                        source=DataSource.POLYMARKET,
                        asset_type=AssetType.PREDICTION,
                        bid=yes_price,
                        ask=1 - yes_price if yes_price else 0.5,
                        last_price=yes_price,
                        mid_price=mid,
                        spread_percent=spread,
                        volume_24h=float(market.get('volume', 0) or 0),
                        liquidity=float(market.get('liquidityClob', 0) or 0),
                        timestamp=datetime.now(timezone.utc),
                        source_timestamp=None,
                        market_id=market.get('condition_id'),
                        market_title=market.get('question', ''),
                        category=market.get('category', ''),
                        yes_price=yes_price,
                        no_price=no_price,
                    )
                    tickers.append(ticker)
                except Exception as e:
                    logger.debug(f"Error parsing Polymarket market: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error fetching Polymarket markets: {e}")
        
        return tickers
    
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get single market ticker."""
        markets = await self.get_markets()
        for m in markets:
            if m.symbol == symbol or m.market_id == symbol:
                return m
        return None


class KalshiAdapter(BaseDataAdapter):
    """
    Adapter for Kalshi prediction market data.
    
    PUBLIC DATA available for market prices.
    """
    
    def __init__(self):
        super().__init__(requires_auth=False, rate_limit=60)
        self._client = None
    
    @property
    def source(self) -> DataSource:
        return DataSource.KALSHI
    
    @property
    def asset_types(self) -> List[AssetType]:
        return [AssetType.PREDICTION]
    
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize Kalshi client."""
        try:
            from src.clients.kalshi_client import KalshiClient
            self._client = KalshiClient()
            self._initialized = True
            logger.info(f"✅ {self.source.value} adapter initialized")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to initialize Kalshi adapter: {e}")
            return False
    
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get all Kalshi markets."""
        if not self._initialized or not self._client:
            return []
        
        tickers = []
        try:
            # Get active markets
            markets = self._client.get_active_markets()
            
            for market in markets[:100]:
                try:
                    yes_bid = market.get('yes_bid', 0.5)
                    yes_ask = market.get('yes_ask', 0.5)
                    
                    if isinstance(yes_bid, str):
                        yes_bid = float(yes_bid) / 100  # Kalshi uses cents
                    if isinstance(yes_ask, str):
                        yes_ask = float(yes_ask) / 100
                    
                    mid = (yes_bid + yes_ask) / 2
                    spread = ((yes_ask - yes_bid) / mid * 100) if mid > 0 else 0
                    
                    ticker = UnifiedTicker(
                        symbol=market.get('ticker', ''),
                        source=DataSource.KALSHI,
                        asset_type=AssetType.PREDICTION,
                        bid=yes_bid,
                        ask=yes_ask,
                        last_price=market.get('last_price', mid),
                        mid_price=mid,
                        spread_percent=spread,
                        volume_24h=float(market.get('volume', 0) or 0),
                        liquidity=float(market.get('open_interest', 0) or 0),
                        timestamp=datetime.now(timezone.utc),
                        source_timestamp=None,
                        market_id=market.get('ticker'),
                        market_title=market.get('title', ''),
                        category=market.get('category', ''),
                        yes_price=yes_bid,
                        no_price=1 - yes_ask if yes_ask else 0.5,
                    )
                    tickers.append(ticker)
                except Exception as e:
                    logger.debug(f"Error parsing Kalshi market: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error fetching Kalshi markets: {e}")
        
        return tickers
    
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get single market ticker."""
        markets = await self.get_markets()
        for m in markets:
            if m.symbol == symbol or m.market_id == symbol:
                return m
        return None


class AlpacaAdapter(BaseDataAdapter):
    """
    Adapter for Alpaca Markets stock data.
    
    PUBLIC DATA - Free tier provides real-time quotes (200 req/min).
    No authentication needed for basic market data.
    """
    
    def __init__(self):
        super().__init__(requires_auth=False, rate_limit=200)
        self._client = None
    
    @property
    def source(self) -> DataSource:
        return DataSource.ALPACA
    
    @property
    def asset_types(self) -> List[AssetType]:
        return [AssetType.STOCK, AssetType.CRYPTO]
    
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize Alpaca client for public data."""
        try:
            from src.exchanges.alpaca_client import AlpacaClient
            
            # Use credentials if provided, otherwise try env vars
            api_key = credentials.get('api_key') if credentials else None
            api_secret = credentials.get('api_secret') if credentials else None
            
            self._client = AlpacaClient(
                api_key=api_key,
                api_secret=api_secret,
                paper=True  # Always use paper for data (doesn't matter for quotes)
            )
            
            initialized = await self._client.initialize()
            self._initialized = initialized
            
            if initialized:
                logger.info(f"✅ {self.source.value} adapter initialized")
            return initialized
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Alpaca adapter: {e}")
            return False
    
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get stock tickers from Alpaca."""
        if not self._initialized or not self._client:
            return []
        
        tickers = []
        # Get quotes for popular symbols
        symbols = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
            "SPY", "QQQ", "IWM", "BTC/USD", "ETH/USD"
        ]
        
        for symbol in symbols:
            try:
                ticker_data = await self._client.get_ticker(symbol)
                if ticker_data:
                    mid = (ticker_data.bid + ticker_data.ask) / 2 if ticker_data.bid and ticker_data.ask else ticker_data.last
                    spread = ((ticker_data.ask - ticker_data.bid) / mid * 100) if mid > 0 else 0
                    
                    asset_type = AssetType.CRYPTO if "/" in symbol else AssetType.STOCK
                    
                    ticker = UnifiedTicker(
                        symbol=symbol,
                        source=DataSource.ALPACA,
                        asset_type=asset_type,
                        bid=ticker_data.bid,
                        ask=ticker_data.ask,
                        last_price=ticker_data.last,
                        mid_price=mid,
                        spread_percent=spread,
                        volume_24h=ticker_data.volume_24h,
                        liquidity=None,
                        timestamp=datetime.now(timezone.utc),
                        source_timestamp=ticker_data.timestamp,
                        market_id=symbol,
                        market_title=symbol,
                    )
                    tickers.append(ticker)
            except Exception as e:
                logger.debug(f"Error fetching Alpaca ticker {symbol}: {e}")
                continue
        
        return tickers
    
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get single stock ticker."""
        if not self._initialized or not self._client:
            return None
        
        try:
            ticker_data = await self._client.get_ticker(symbol)
            if ticker_data:
                mid = (ticker_data.bid + ticker_data.ask) / 2 if ticker_data.bid and ticker_data.ask else ticker_data.last
                spread = ((ticker_data.ask - ticker_data.bid) / mid * 100) if mid > 0 else 0
                
                return UnifiedTicker(
                    symbol=symbol,
                    source=DataSource.ALPACA,
                    asset_type=AssetType.CRYPTO if "/" in symbol else AssetType.STOCK,
                    bid=ticker_data.bid,
                    ask=ticker_data.ask,
                    last_price=ticker_data.last,
                    mid_price=mid,
                    spread_percent=spread,
                    volume_24h=ticker_data.volume_24h,
                    liquidity=None,
                    timestamp=datetime.now(timezone.utc),
                    source_timestamp=ticker_data.timestamp,
                    market_id=symbol,
                    market_title=symbol,
                )
        except Exception as e:
            logger.error(f"Error fetching Alpaca ticker {symbol}: {e}")
        
        return None


class WebullAdapter(BaseDataAdapter):
    """
    Adapter for Webull stock data.
    
    REQUIRES AUTHENTICATION - Data only available for authenticated users.
    
    In simulation mode: Uses platform owner's credentials to provide data.
    In live mode: Uses user's own credentials.
    """
    
    def __init__(self):
        super().__init__(requires_auth=True, rate_limit=60)
        self._client = None
    
    @property
    def source(self) -> DataSource:
        return DataSource.WEBULL
    
    @property
    def asset_types(self) -> List[AssetType]:
        return [AssetType.STOCK, AssetType.OPTION, AssetType.CRYPTO]
    
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize Webull client with credentials."""
        if not credentials:
            logger.warning(f"⚠️ {self.source.value} requires credentials - skipping")
            return False
        
        try:
            from src.exchanges.webull_client import WebullClient
            
            self._client = WebullClient(
                email=credentials.get('email'),
                password=credentials.get('password'),
                device_id=credentials.get('device_id'),
                trading_pin=credentials.get('trading_pin'),
                paper=credentials.get('paper', True)
            )
            
            initialized = await self._client.initialize()
            self._initialized = initialized
            
            if initialized:
                logger.info(f"✅ {self.source.value} adapter initialized")
            return initialized
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Webull adapter: {e}")
            return False
    
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get stock tickers from Webull."""
        if not self._initialized or not self._client:
            return []
        
        tickers = []
        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
        
        for symbol in symbols:
            try:
                ticker_data = await self._client.get_ticker(symbol)
                if ticker_data:
                    mid = (ticker_data.bid + ticker_data.ask) / 2 if ticker_data.bid and ticker_data.ask else ticker_data.last
                    spread = ((ticker_data.ask - ticker_data.bid) / mid * 100) if mid > 0 else 0
                    
                    ticker = UnifiedTicker(
                        symbol=symbol,
                        source=DataSource.WEBULL,
                        asset_type=AssetType.STOCK,
                        bid=ticker_data.bid,
                        ask=ticker_data.ask,
                        last_price=ticker_data.last,
                        mid_price=mid,
                        spread_percent=spread,
                        volume_24h=ticker_data.volume_24h,
                        liquidity=None,
                        timestamp=datetime.now(timezone.utc),
                        source_timestamp=ticker_data.timestamp,
                        market_id=symbol,
                        market_title=symbol,
                    )
                    tickers.append(ticker)
            except Exception as e:
                logger.debug(f"Error fetching Webull ticker {symbol}: {e}")
                continue
        
        return tickers
    
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get single stock ticker."""
        if not self._initialized or not self._client:
            return None
        
        try:
            ticker_data = await self._client.get_ticker(symbol)
            if ticker_data:
                mid = (ticker_data.bid + ticker_data.ask) / 2 if ticker_data.bid and ticker_data.ask else ticker_data.last
                spread = ((ticker_data.ask - ticker_data.bid) / mid * 100) if mid > 0 else 0
                
                return UnifiedTicker(
                    symbol=symbol,
                    source=DataSource.WEBULL,
                    asset_type=AssetType.STOCK,
                    bid=ticker_data.bid,
                    ask=ticker_data.ask,
                    last_price=ticker_data.last,
                    mid_price=mid,
                    spread_percent=spread,
                    volume_24h=ticker_data.volume_24h,
                    liquidity=None,
                    timestamp=datetime.now(timezone.utc),
                    source_timestamp=ticker_data.timestamp,
                    market_id=symbol,
                    market_title=symbol,
                )
        except Exception as e:
            logger.error(f"Error fetching Webull ticker {symbol}: {e}")
        
        return None


class BinanceAdapter(BaseDataAdapter):
    """
    Adapter for Binance crypto exchange data.
    
    PUBLIC DATA - No authentication needed for market data.
    """
    
    def __init__(self):
        super().__init__(requires_auth=False, rate_limit=1200)  # 1200 req/min
        self._client = None
    
    @property
    def source(self) -> DataSource:
        return DataSource.BINANCE
    
    @property
    def asset_types(self) -> List[AssetType]:
        return [AssetType.CRYPTO, AssetType.FUTURES]
    
    async def initialize(self, credentials: Optional[Dict] = None) -> bool:
        """Initialize Binance via CCXT."""
        try:
            from src.exchanges.ccxt_client import CCXTClient
            
            self._client = CCXTClient(
                exchange_id="binance",
                api_key=credentials.get('api_key') if credentials else None,
                api_secret=credentials.get('api_secret') if credentials else None,
                sandbox=False
            )
            
            initialized = await self._client.initialize()
            self._initialized = initialized
            
            if initialized:
                logger.info(f"✅ {self.source.value} adapter initialized")
            return initialized
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Binance adapter: {e}")
            return False
    
    async def get_markets(self) -> List[UnifiedTicker]:
        """Get crypto tickers from Binance."""
        if not self._initialized or not self._client:
            return []
        
        tickers = []
        symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT"]
        
        for symbol in symbols:
            ticker = await self.get_ticker(symbol)
            if ticker:
                tickers.append(ticker)
        
        return tickers
    
    async def get_ticker(self, symbol: str) -> Optional[UnifiedTicker]:
        """Get single crypto ticker."""
        if not self._initialized or not self._client:
            return None
        
        try:
            ticker_data = await self._client.get_ticker(symbol)
            if ticker_data:
                mid = (ticker_data.bid + ticker_data.ask) / 2 if ticker_data.bid and ticker_data.ask else ticker_data.last
                spread = ((ticker_data.ask - ticker_data.bid) / mid * 100) if mid > 0 else 0
                
                return UnifiedTicker(
                    symbol=symbol,
                    source=DataSource.BINANCE,
                    asset_type=AssetType.CRYPTO,
                    bid=ticker_data.bid,
                    ask=ticker_data.ask,
                    last_price=ticker_data.last,
                    mid_price=mid,
                    spread_percent=spread,
                    volume_24h=ticker_data.volume_24h,
                    liquidity=None,
                    timestamp=datetime.now(timezone.utc),
                    source_timestamp=ticker_data.timestamp,
                    market_id=symbol,
                    market_title=symbol,
                )
        except Exception as e:
            logger.error(f"Error fetching Binance ticker {symbol}: {e}")
        
        return None


# =============================================================================
# UNIFIED MARKET DATA SERVICE
# =============================================================================

class UnifiedMarketDataService:
    """
    Main service for unified market data across all platforms.
    
    MODES:
    - simulation: All public data sources (Polymarket, Kalshi, Alpaca, Binance)
    - live: Only user's connected platforms
    
    USAGE:
        # Simulation mode
        service = UnifiedMarketDataService(user_id="123", mode="simulation")
        await service.initialize()
        data = await service.get_all_tickers()
        
        # Live mode
        service = UnifiedMarketDataService(user_id="123", mode="live")
        await service.initialize()  # Loads user's connected platforms
        data = await service.get_all_tickers()  # Only their platforms
    """
    
    # Public data sources (no auth needed) - used in simulation mode
    PUBLIC_SOURCES = [
        DataSource.POLYMARKET,
        DataSource.KALSHI,
        DataSource.ALPACA,
        DataSource.BINANCE,
    ]
    
    # Auth-required sources - only available if user connected
    AUTH_REQUIRED_SOURCES = [
        DataSource.WEBULL,
        DataSource.IBKR,
    ]
    
    def __init__(
        self,
        user_id: str,
        mode: Literal["simulation", "live"] = "simulation",
        db_client=None,
        platform_credentials: Optional[Dict[DataSource, Dict]] = None
    ):
        """
        Initialize the unified market data service.
        
        Args:
            user_id: User UUID
            mode: "simulation" (all public data) or "live" (user's platforms only)
            db_client: Optional database client for loading user config
            platform_credentials: Optional dict of platform -> credentials for
                                 auth-required sources in simulation mode.
                                 Use this to provide YOUR credentials for
                                 Webull data in simulation.
        """
        self.user_id = user_id
        self.mode = mode
        self.db_client = db_client
        self.platform_credentials = platform_credentials or {}
        
        # Adapters for each data source
        self._adapters: Dict[DataSource, BaseDataAdapter] = {}
        self._user_connected_platforms: List[DataSource] = []
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        Initialize data adapters based on mode.
        
        Simulation: Initialize all public sources + any auth sources with credentials
        Live: Initialize only user's connected platforms
        """
        if self.mode == "simulation":
            return await self._init_simulation_mode()
        else:
            return await self._init_live_mode()
    
    async def _init_simulation_mode(self) -> bool:
        """
        Initialize all PUBLIC data sources for simulation.
        
        Also initializes AUTH sources if platform_credentials provided
        (e.g., platform owner's Webull account for data).
        """
        logger.info("🎮 Initializing SIMULATION mode - all public sources")
        
        # Initialize public sources (no auth needed)
        adapter_classes = {
            DataSource.POLYMARKET: PolymarketAdapter,
            DataSource.KALSHI: KalshiAdapter,
            DataSource.ALPACA: AlpacaAdapter,
            DataSource.BINANCE: BinanceAdapter,
        }
        
        for source, adapter_class in adapter_classes.items():
            try:
                adapter = adapter_class()
                creds = self.platform_credentials.get(source)
                if await adapter.initialize(creds):
                    self._adapters[source] = adapter
                    logger.info(f"  ✅ {source.value}")
                else:
                    logger.warning(f"  ⚠️ {source.value} failed to initialize")
            except Exception as e:
                logger.error(f"  ❌ {source.value}: {e}")
        
        # Initialize auth-required sources if credentials provided
        # This allows platform owner to provide their credentials for simulation data
        auth_adapter_classes = {
            DataSource.WEBULL: WebullAdapter,
        }
        
        for source, adapter_class in auth_adapter_classes.items():
            if source in self.platform_credentials:
                try:
                    adapter = adapter_class()
                    if await adapter.initialize(self.platform_credentials[source]):
                        self._adapters[source] = adapter
                        logger.info(f"  ✅ {source.value} (with credentials)")
                except Exception as e:
                    logger.warning(f"  ⚠️ {source.value} (auth): {e}")
        
        self._initialized = len(self._adapters) > 0
        logger.info(f"🎮 Simulation mode: {len(self._adapters)} sources active")
        return self._initialized
    
    async def _init_live_mode(self) -> bool:
        """
        Initialize ONLY user's connected platforms for live trading.
        """
        logger.info(f"💰 Initializing LIVE mode for user {self.user_id}")
        
        # Load user's connected platforms from database
        await self._load_user_platforms()
        
        if not self._user_connected_platforms:
            logger.warning("⚠️ No platforms connected for this user")
            return False
        
        # Map of source -> adapter class
        adapter_classes = {
            DataSource.POLYMARKET: PolymarketAdapter,
            DataSource.KALSHI: KalshiAdapter,
            DataSource.ALPACA: AlpacaAdapter,
            DataSource.BINANCE: BinanceAdapter,
            DataSource.WEBULL: WebullAdapter,
        }
        
        for source in self._user_connected_platforms:
            if source not in adapter_classes:
                continue
                
            try:
                adapter = adapter_classes[source]()
                
                # Get user's credentials for this platform
                creds = await self._get_user_credentials(source)
                
                if await adapter.initialize(creds):
                    self._adapters[source] = adapter
                    logger.info(f"  ✅ {source.value}")
                else:
                    logger.warning(f"  ⚠️ {source.value} init failed")
                    
            except Exception as e:
                logger.error(f"  ❌ {source.value}: {e}")
        
        self._initialized = len(self._adapters) > 0
        logger.info(f"💰 Live mode: {len(self._adapters)} platforms active")
        return self._initialized
    
    async def _load_user_platforms(self):
        """Load user's connected platforms from database."""
        if not self.db_client:
            try:
                from src.database.client import Database
                self.db_client = Database(user_id=self.user_id)
            except Exception as e:
                logger.error(f"Failed to create DB client: {e}")
                return
        
        try:
            # Query user_exchange_credentials table
            result = self.db_client._client.table("user_exchange_credentials").select(
                "exchange"
            ).eq("user_id", self.user_id).execute()
            
            if result.data:
                for row in result.data:
                    exchange = row.get('exchange', '').lower()
                    try:
                        source = DataSource(exchange)
                        self._user_connected_platforms.append(source)
                    except ValueError:
                        logger.debug(f"Unknown exchange: {exchange}")
                        
            logger.info(f"User has {len(self._user_connected_platforms)} platforms connected")
            
        except Exception as e:
            logger.error(f"Failed to load user platforms: {e}")
    
    async def _get_user_credentials(self, source: DataSource) -> Optional[Dict]:
        """Get user's credentials for a specific platform."""
        if not self.db_client:
            return None
        
        try:
            result = self.db_client._client.table("user_exchange_credentials").select(
                "*"
            ).eq("user_id", self.user_id).eq("exchange", source.value).limit(1).execute()
            
            if result.data:
                row = result.data[0]
                return {
                    'api_key': row.get('api_key'),
                    'api_secret': row.get('api_secret'),
                    'passphrase': row.get('passphrase'),
                    'account_id': row.get('account_id'),
                    # Map to specific platform fields
                    'email': row.get('api_key'),  # For Webull
                    'password': row.get('api_secret'),  # For Webull
                    'device_id': row.get('account_id'),  # For Webull
                    'trading_pin': row.get('passphrase'),  # For Webull
                    'username': row.get('api_key'),  # For Robinhood
                    'mfa_secret': row.get('passphrase'),  # For Robinhood
                }
        except Exception as e:
            logger.error(f"Failed to get credentials for {source.value}: {e}")
        
        return None
    
    # =========================================================================
    # Public API
    # =========================================================================
    
    def get_active_sources(self) -> List[DataSource]:
        """Get list of currently active data sources."""
        return list(self._adapters.keys())
    
    async def get_all_tickers(self) -> List[UnifiedTicker]:
        """
        Get all market tickers from all active sources.
        
        Returns unified list with source tracking.
        """
        if not self._initialized:
            logger.warning("Service not initialized")
            return []
        
        all_tickers = []
        
        for source, adapter in self._adapters.items():
            try:
                tickers = await adapter.get_markets()
                all_tickers.extend(tickers)
                logger.debug(f"Got {len(tickers)} tickers from {source.value}")
            except Exception as e:
                logger.error(f"Error fetching from {source.value}: {e}")
        
        return all_tickers
    
    async def get_tickers_by_source(
        self,
        source: DataSource
    ) -> List[UnifiedTicker]:
        """Get tickers from a specific source only."""
        if source not in self._adapters:
            logger.warning(f"Source {source.value} not active")
            return []
        
        return await self._adapters[source].get_markets()
    
    async def get_tickers_by_asset_type(
        self,
        asset_type: AssetType
    ) -> List[UnifiedTicker]:
        """Get all tickers of a specific asset type."""
        all_tickers = await self.get_all_tickers()
        return [t for t in all_tickers if t.asset_type == asset_type]
    
    async def get_ticker(
        self,
        symbol: str,
        source: Optional[DataSource] = None
    ) -> Optional[UnifiedTicker]:
        """
        Get ticker for a specific symbol.
        
        If source not specified, searches all active sources.
        """
        if source and source in self._adapters:
            return await self._adapters[source].get_ticker(symbol)
        
        # Search all sources
        for adapter in self._adapters.values():
            ticker = await adapter.get_ticker(symbol)
            if ticker:
                return ticker
        
        return None
    
    async def get_prediction_markets(self) -> List[UnifiedTicker]:
        """Get all prediction market data."""
        return await self.get_tickers_by_asset_type(AssetType.PREDICTION)
    
    async def get_stock_markets(self) -> List[UnifiedTicker]:
        """Get all stock market data."""
        return await self.get_tickers_by_asset_type(AssetType.STOCK)
    
    async def get_crypto_markets(self) -> List[UnifiedTicker]:
        """Get all crypto market data."""
        return await self.get_tickers_by_asset_type(AssetType.CRYPTO)
    
    async def find_opportunities(
        self,
        min_spread_percent: float = 2.0
    ) -> List[UnifiedOpportunity]:
        """
        Find trading opportunities across all active sources.
        
        Args:
            min_spread_percent: Minimum spread % to consider an opportunity
            
        Returns:
            List of opportunities sorted by spread (highest first)
        """
        opportunities = []
        tickers = await self.get_all_tickers()
        
        for ticker in tickers:
            if ticker.spread_percent >= min_spread_percent:
                opp = UnifiedOpportunity(
                    opportunity_id=f"{ticker.source.value}:{ticker.symbol}:{datetime.now().timestamp()}",
                    source=ticker.source,
                    asset_type=ticker.asset_type,
                    symbol=ticker.symbol,
                    market_title=ticker.market_title or ticker.symbol,
                    spread_percent=ticker.spread_percent,
                    direction="buy" if ticker.asset_type == AssetType.PREDICTION else "neutral",
                    entry_price=ticker.bid,
                    exit_price=ticker.ask,
                    expected_profit=ticker.spread_percent / 100,
                    confidence_score=min(1.0, ticker.volume_24h / 10000) if ticker.volume_24h else 0.5,
                    min_size=10,
                    max_size=min(1000, ticker.liquidity or 1000),
                    timestamp=datetime.now(timezone.utc),
                    expires_at=ticker.expiry,
                )
                opportunities.append(opp)
        
        # Sort by spread (highest first)
        opportunities.sort(key=lambda x: x.spread_percent, reverse=True)
        
        return opportunities
    
    def is_source_available(self, source: DataSource) -> bool:
        """Check if a specific source is active."""
        return source in self._adapters
    
    def get_mode(self) -> str:
        """Get current operating mode."""
        return self.mode
    
    async def close(self):
        """Clean up resources."""
        self._adapters.clear()
        self._initialized = False
