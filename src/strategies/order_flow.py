"""
Order Flow Imbalance Analysis

Academic Foundation:
- Kyle (1985) - Market microstructure theory
- Easley & O'Hara (1992) - Order flow and information
- Cont, Stoikov, Talreja (2010) - "A stochastic model for order book dynamics"

Order flow imbalance (OFI) is one of the strongest short-term predictors
of price direction in liquid markets.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import deque
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OFISignal(Enum):
    """Order flow imbalance signal strength."""
    STRONG_BUY = "strong_buy"
    WEAK_BUY = "weak_buy"
    NEUTRAL = "neutral"
    WEAK_SELL = "weak_sell"
    STRONG_SELL = "strong_sell"


@dataclass
class OrderBookLevel:
    """Single order book level."""
    price: float
    size: float
    side: str  # "bid" or "ask"


@dataclass
class OrderBookSnapshot:
    """Point-in-time order book snapshot."""
    timestamp: datetime
    bids: List[OrderBookLevel]  # Sorted by price descending
    asks: List[OrderBookLevel]  # Sorted by price ascending
    
    @property
    def best_bid(self) -> Optional[float]:
        """Best bid price."""
        return self.bids[0].price if self.bids else None
    
    @property
    def best_ask(self) -> Optional[float]:
        """Best ask price."""
        return self.asks[0].price if self.asks else None
    
    @property
    def mid_price(self) -> Optional[float]:
        """Mid price."""
        if self.best_bid and self.best_ask:
            return (self.best_bid + self.best_ask) / 2
        return None
    
    @property
    def spread(self) -> Optional[float]:
        """Bid-ask spread."""
        if self.best_bid and self.best_ask:
            return self.best_ask - self.best_bid
        return None
    
    @property
    def spread_bps(self) -> Optional[float]:
        """Spread in basis points."""
        if self.spread and self.mid_price:
            return (self.spread / self.mid_price) * 10000
        return None


@dataclass
class OFIResult:
    """Order flow imbalance calculation result."""
    symbol: str
    timestamp: datetime
    
    # Core OFI metrics
    ofi_raw: float  # Raw imbalance (positive = buying pressure)
    ofi_normalized: float  # -1 to 1 scale
    ofi_cumulative: float  # Cumulative over window
    
    # Book pressure
    bid_depth: float  # Total bid size in window
    ask_depth: float  # Total ask size in window
    depth_imbalance: float  # Bid/Ask ratio
    
    # Signal
    signal: OFISignal
    signal_strength: float  # 0-1
    
    # Recommendation
    suggested_action: str
    confidence: float


class OrderFlowAnalyzer:
    """
    Analyzes order flow to generate trading signals.
    
    Core concept: Track changes in order book to detect
    informed trading pressure before price moves.
    
    OFI = Σ (ΔBid_quantity - ΔAsk_quantity)
    
    Positive OFI = net buying pressure
    Negative OFI = net selling pressure
    """
    
    def __init__(
        self,
        window_size: int = 100,
        signal_threshold: float = 0.3,
        strong_signal_threshold: float = 0.6,
        lookback_seconds: int = 300,
    ):
        """
        Initialize order flow analyzer.
        
        Args:
            window_size: Number of snapshots to keep
            signal_threshold: OFI level for weak signal
            strong_signal_threshold: OFI level for strong signal
            lookback_seconds: Seconds to consider for analysis
        """
        self.window_size = window_size
        self.signal_threshold = signal_threshold
        self.strong_threshold = strong_signal_threshold
        self.lookback_seconds = lookback_seconds
        
        # Per-symbol history
        self._snapshots: Dict[str, deque] = {}
        self._ofi_history: Dict[str, deque] = {}
    
    def add_snapshot(self, symbol: str, snapshot: OrderBookSnapshot):
        """
        Add order book snapshot for analysis.
        
        Args:
            symbol: Trading symbol
            snapshot: Order book snapshot
        """
        if symbol not in self._snapshots:
            self._snapshots[symbol] = deque(maxlen=self.window_size)
        
        self._snapshots[symbol].append(snapshot)
    
    def calculate_ofi(
        self,
        symbol: str,
        levels: int = 5,
    ) -> Optional[OFIResult]:
        """
        Calculate order flow imbalance for a symbol.
        
        Args:
            symbol: Trading symbol
            levels: Number of book levels to consider
        
        Returns:
            OFIResult with signals and recommendations
        """
        if symbol not in self._snapshots:
            return None
        
        snapshots = list(self._snapshots[symbol])
        if len(snapshots) < 2:
            return None
        
        # Filter to lookback window
        cutoff = datetime.utcnow() - timedelta(seconds=self.lookback_seconds)
        recent = [s for s in snapshots if s.timestamp >= cutoff]
        
        if len(recent) < 2:
            return None
        
        # Calculate OFI between consecutive snapshots
        ofi_values = []
        for i in range(1, len(recent)):
            prev = recent[i - 1]
            curr = recent[i]
            ofi = self._calculate_delta_ofi(prev, curr, levels)
            ofi_values.append(ofi)
        
        # Aggregate
        ofi_raw = sum(ofi_values)
        ofi_cumulative = ofi_raw
        
        # Normalize to -1 to 1
        max_possible = levels * 1000  # Rough estimate
        ofi_normalized = max(-1.0, min(1.0, ofi_raw / max_possible))
        
        # Calculate depth metrics from latest snapshot
        latest = recent[-1]
        bid_depth = sum(
            b.size for b in latest.bids[:levels]
        ) if latest.bids else 0
        ask_depth = sum(
            a.size for a in latest.asks[:levels]
        ) if latest.asks else 0
        
        depth_imbalance = (
            bid_depth / ask_depth if ask_depth > 0 else 1.0
        )
        
        # Determine signal
        signal = self._determine_signal(ofi_normalized)
        signal_strength = abs(ofi_normalized)
        
        # Generate action
        suggested_action = self._generate_action(signal, signal_strength)
        
        # Calculate confidence
        confidence = self._calculate_confidence(
            len(recent), signal_strength, depth_imbalance
        )
        
        result = OFIResult(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            ofi_raw=ofi_raw,
            ofi_normalized=ofi_normalized,
            ofi_cumulative=ofi_cumulative,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            depth_imbalance=depth_imbalance,
            signal=signal,
            signal_strength=signal_strength,
            suggested_action=suggested_action,
            confidence=confidence,
        )
        
        # Track history
        if symbol not in self._ofi_history:
            self._ofi_history[symbol] = deque(maxlen=self.window_size)
        self._ofi_history[symbol].append(result)
        
        return result
    
    def _calculate_delta_ofi(
        self,
        prev: OrderBookSnapshot,
        curr: OrderBookSnapshot,
        levels: int,
    ) -> float:
        """Calculate OFI change between two snapshots."""
        ofi = 0.0
        
        # Calculate bid changes
        prev_bids = {b.price: b.size for b in prev.bids[:levels]}
        curr_bids = {b.price: b.size for b in curr.bids[:levels]}
        
        # Bid increases = buying pressure
        for price, size in curr_bids.items():
            prev_size = prev_bids.get(price, 0)
            ofi += (size - prev_size)
        
        # Calculate ask changes
        prev_asks = {a.price: a.size for a in prev.asks[:levels]}
        curr_asks = {a.price: a.size for a in curr.asks[:levels]}
        
        # Ask increases = selling pressure (subtract)
        for price, size in curr_asks.items():
            prev_size = prev_asks.get(price, 0)
            ofi -= (size - prev_size)
        
        return ofi
    
    def _determine_signal(self, ofi_normalized: float) -> OFISignal:
        """Determine signal from normalized OFI."""
        if ofi_normalized >= self.strong_threshold:
            return OFISignal.STRONG_BUY
        elif ofi_normalized >= self.signal_threshold:
            return OFISignal.WEAK_BUY
        elif ofi_normalized <= -self.strong_threshold:
            return OFISignal.STRONG_SELL
        elif ofi_normalized <= -self.signal_threshold:
            return OFISignal.WEAK_SELL
        else:
            return OFISignal.NEUTRAL
    
    def _generate_action(
        self,
        signal: OFISignal,
        strength: float,
    ) -> str:
        """Generate action recommendation."""
        if signal == OFISignal.STRONG_BUY:
            return "Aggressive buy - strong inflow detected"
        elif signal == OFISignal.WEAK_BUY:
            return "Consider buy - moderate buying pressure"
        elif signal == OFISignal.STRONG_SELL:
            return "Aggressive sell - strong outflow detected"
        elif signal == OFISignal.WEAK_SELL:
            return "Consider sell - moderate selling pressure"
        else:
            return "Hold - no clear direction"
    
    def _calculate_confidence(
        self,
        sample_count: int,
        signal_strength: float,
        depth_imbalance: float,
    ) -> float:
        """Calculate confidence in the signal."""
        # More samples = more confidence
        sample_confidence = min(1.0, sample_count / 50)
        
        # Stronger signal = more confidence
        strength_confidence = signal_strength
        
        # Depth imbalance confirms signal
        depth_confirms = abs(depth_imbalance - 1.0) > 0.2
        depth_confidence = 0.1 if depth_confirms else 0.0
        
        return min(0.95, (
            sample_confidence * 0.3 +
            strength_confidence * 0.5 +
            depth_confidence + 0.1
        ))
    
    def get_momentum(
        self,
        symbol: str,
        periods: int = 5,
    ) -> Optional[float]:
        """
        Get OFI momentum (rate of change).
        
        Args:
            symbol: Trading symbol
            periods: Number of periods for momentum
        
        Returns:
            Momentum value (positive = increasing buy pressure)
        """
        if symbol not in self._ofi_history:
            return None
        
        history = list(self._ofi_history[symbol])
        if len(history) < periods + 1:
            return None
        
        recent = history[-periods:]
        older = history[-periods - 1]
        
        avg_recent = sum(r.ofi_normalized for r in recent) / len(recent)
        return avg_recent - older.ofi_normalized


@dataclass
class TradeFlowAnalysis:
    """Analysis of trade tape."""
    symbol: str
    buy_volume: float
    sell_volume: float
    net_volume: float
    buy_count: int
    sell_count: int
    avg_buy_size: float
    avg_sell_size: float
    large_buy_count: int  # Whale trades
    large_sell_count: int
    signal: OFISignal


class TradeFlowAnalyzer:
    """
    Analyzes trade tape (time & sales) for flow signals.
    
    Complements order book analysis with actual execution data.
    """
    
    def __init__(
        self,
        large_trade_multiplier: float = 5.0,
        window_seconds: int = 300,
    ):
        """
        Initialize trade flow analyzer.
        
        Args:
            large_trade_multiplier: Trades this many times avg = "large"
            window_seconds: Analysis window
        """
        self.large_multiplier = large_trade_multiplier
        self.window_seconds = window_seconds
        self._trades: Dict[str, deque] = {}
    
    def add_trade(
        self,
        symbol: str,
        price: float,
        size: float,
        side: str,
        timestamp: datetime,
    ):
        """
        Add trade to analysis.
        
        Args:
            symbol: Trading symbol
            price: Trade price
            size: Trade size
            side: "buy" or "sell"
            timestamp: Trade timestamp
        """
        if symbol not in self._trades:
            self._trades[symbol] = deque(maxlen=1000)
        
        self._trades[symbol].append({
            "price": price,
            "size": size,
            "side": side,
            "timestamp": timestamp,
        })
    
    def analyze(self, symbol: str) -> Optional[TradeFlowAnalysis]:
        """
        Analyze trade flow for a symbol.
        
        Args:
            symbol: Trading symbol
        
        Returns:
            TradeFlowAnalysis with aggregated metrics
        """
        if symbol not in self._trades:
            return None
        
        trades = list(self._trades[symbol])
        if not trades:
            return None
        
        # Filter to window
        cutoff = datetime.utcnow() - timedelta(seconds=self.window_seconds)
        recent = [t for t in trades if t["timestamp"] >= cutoff]
        
        if not recent:
            return None
        
        # Aggregate
        buy_trades = [t for t in recent if t["side"] == "buy"]
        sell_trades = [t for t in recent if t["side"] == "sell"]
        
        buy_volume = sum(t["size"] for t in buy_trades)
        sell_volume = sum(t["size"] for t in sell_trades)
        net_volume = buy_volume - sell_volume
        
        buy_count = len(buy_trades)
        sell_count = len(sell_trades)
        
        avg_buy = buy_volume / buy_count if buy_count > 0 else 0
        avg_sell = sell_volume / sell_count if sell_count > 0 else 0
        avg_size = (buy_volume + sell_volume) / len(recent)
        
        # Count large trades
        large_threshold = avg_size * self.large_multiplier
        large_buys = sum(
            1 for t in buy_trades if t["size"] >= large_threshold
        )
        large_sells = sum(
            1 for t in sell_trades if t["size"] >= large_threshold
        )
        
        # Determine signal
        if net_volume > buy_volume * 0.3:
            signal = OFISignal.STRONG_BUY
        elif net_volume > buy_volume * 0.1:
            signal = OFISignal.WEAK_BUY
        elif net_volume < -sell_volume * 0.3:
            signal = OFISignal.STRONG_SELL
        elif net_volume < -sell_volume * 0.1:
            signal = OFISignal.WEAK_SELL
        else:
            signal = OFISignal.NEUTRAL
        
        return TradeFlowAnalysis(
            symbol=symbol,
            buy_volume=buy_volume,
            sell_volume=sell_volume,
            net_volume=net_volume,
            buy_count=buy_count,
            sell_count=sell_count,
            avg_buy_size=avg_buy,
            avg_sell_size=avg_sell,
            large_buy_count=large_buys,
            large_sell_count=large_sells,
            signal=signal,
        )


# Global instances
_order_flow_analyzer: Optional[OrderFlowAnalyzer] = None
_trade_flow_analyzer: Optional[TradeFlowAnalyzer] = None


def get_order_flow_analyzer() -> OrderFlowAnalyzer:
    """Get or create global order flow analyzer."""
    global _order_flow_analyzer
    if _order_flow_analyzer is None:
        _order_flow_analyzer = OrderFlowAnalyzer()
    return _order_flow_analyzer


def get_trade_flow_analyzer() -> TradeFlowAnalyzer:
    """Get or create global trade flow analyzer."""
    global _trade_flow_analyzer
    if _trade_flow_analyzer is None:
        _trade_flow_analyzer = TradeFlowAnalyzer()
    return _trade_flow_analyzer
