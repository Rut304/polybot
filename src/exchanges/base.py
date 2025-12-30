"""
Base exchange class defining the interface for all exchange integrations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"


class PositionSide(Enum):
    LONG = "long"
    SHORT = "short"


@dataclass
class Ticker:
    """Current price information for a symbol."""
    symbol: str
    bid: float
    ask: float
    last: float
    volume_24h: float
    timestamp: datetime


@dataclass
class Balance:
    """Account balance for an asset."""
    asset: str
    free: float
    locked: float
    total: float


@dataclass
class Order:
    """Order information."""
    id: str
    symbol: str
    side: OrderSide
    type: OrderType
    price: Optional[float]
    amount: float
    filled: float
    remaining: float
    status: str
    timestamp: datetime


@dataclass
class Position:
    """Open position information."""
    symbol: str
    side: PositionSide
    size: float
    entry_price: float
    mark_price: float
    unrealized_pnl: float
    liquidation_price: Optional[float]
    leverage: float


@dataclass
class FundingRate:
    """Funding rate information for perpetual futures."""
    symbol: str
    funding_rate: float  # Rate per funding interval
    funding_timestamp: datetime
    next_funding_timestamp: Optional[datetime]
    predicted_rate: Optional[float]
    annualized_rate: float  # Computed: rate * intervals_per_year


class BaseExchange(ABC):
    """Abstract base class for exchange integrations."""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None,
                 sandbox: bool = False):
        self.api_key = api_key
        self.api_secret = api_secret
        self.sandbox = sandbox
        self._initialized = False

    @abstractmethod
    async def initialize(self) -> bool:
        """Initialize connection to exchange."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close connection to exchange."""
        pass

    # =========================================================================
    # Market Data Methods
    # =========================================================================

    @abstractmethod
    async def get_ticker(self, symbol: str) -> Ticker:
        """Get current ticker for a symbol."""
        pass

    @abstractmethod
    async def get_tickers(self, symbols: Optional[List[str]] = None) -> Dict[str, Ticker]:
        """Get tickers for multiple symbols."""
        pass

    @abstractmethod
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """Get order book for a symbol."""
        pass

    @abstractmethod
    async def get_ohlcv(self, symbol: str, timeframe: str = '1h',
                        limit: int = 100) -> List[List[float]]:
        """Get OHLCV candlestick data."""
        pass

    # =========================================================================
    # Account Methods
    # =========================================================================

    @abstractmethod
    async def get_balance(self, asset: Optional[str] = None) -> Dict[str, Balance]:
        """Get account balances."""
        pass

    @abstractmethod
    async def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Get open positions (for margin/futures accounts)."""
        pass

    # =========================================================================
    # Trading Methods
    # =========================================================================

    @abstractmethod
    async def create_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                          amount: float, price: Optional[float] = None,
                          params: Optional[Dict] = None) -> Order:
        """Create a new order."""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order."""
        pass

    @abstractmethod
    async def get_order(self, order_id: str, symbol: str) -> Order:
        """Get order details."""
        pass

    @abstractmethod
    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Order]:
        """Get all open orders."""
        pass

    # =========================================================================
    # Futures-Specific Methods
    # =========================================================================

    @abstractmethod
    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """Get current funding rate for a perpetual futures symbol."""
        pass

    @abstractmethod
    async def get_funding_rates(self, symbols: Optional[List[str]] = None) -> Dict[str, FundingRate]:
        """Get funding rates for multiple symbols."""
        pass

    @abstractmethod
    async def get_funding_rate_history(self, symbol: str,
                                        limit: int = 100) -> List[FundingRate]:
        """Get historical funding rates."""
        pass

    @abstractmethod
    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol."""
        pass

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def calculate_annualized_funding_rate(self, rate: float,
                                          funding_interval_hours: int = 8) -> float:
        """
        Calculate annualized funding rate.

        Most perpetual futures charge funding every 8 hours (3x daily).
        Annual rate = rate * (24/interval_hours) * 365
        """
        funding_intervals_per_year = (24 / funding_interval_hours) * 365
        return rate * funding_intervals_per_year
