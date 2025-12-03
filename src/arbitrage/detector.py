"""
Arbitrage opportunity detection across Polymarket and Kalshi.
Finds cross-platform price discrepancies and calculates profit potential.

Key optimizations:
- Asymmetric profit thresholds (fee-aware)
- Tighter data freshness requirements (10s vs 30s)
- Buy Polymarket (0% fee) preferred over buy Kalshi (7% fee)
"""

import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class Opportunity:
    """Represents a detected arbitrage opportunity."""
    
    # Unique identifier
    id: str
    
    # Detection timestamp
    detected_at: datetime
    
    # Platforms involved
    buy_platform: str  # 'polymarket' or 'kalshi'
    sell_platform: str
    
    # Market identifiers
    buy_market_id: str
    sell_market_id: str
    
    # Market descriptions
    buy_market_name: str
    sell_market_name: str
    
    # Prices (as decimals, e.g., 0.72 = 72 cents)
    buy_price: float
    sell_price: float
    
    # Calculated profit per contract (as decimal)
    profit_per_contract: float
    
    # Profit percentage
    profit_percent: float
    
    # Maximum size available (limited by liquidity)
    max_size: float
    
    # Total potential profit
    total_profit: float
    
    # Confidence score (0-1) based on data freshness
    confidence: float
    
    # Strategy description
    strategy: str
    
    def __str__(self) -> str:
        return (
            f"Opportunity: {self.profit_percent:.2f}% profit | "
            f"Buy {self.buy_platform} @ {self.buy_price:.4f} | "
            f"Sell {self.sell_platform} @ {self.sell_price:.4f} | "
            f"Max ${self.total_profit:.2f}"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary for database storage."""
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "buy_platform": self.buy_platform,
            "sell_platform": self.sell_platform,
            "buy_market_id": self.buy_market_id,
            "sell_market_id": self.sell_market_id,
            "buy_market_name": self.buy_market_name,
            "sell_market_name": self.sell_market_name,
            "buy_price": self.buy_price,
            "sell_price": self.sell_price,
            "profit_per_contract": self.profit_per_contract,
            "profit_percent": self.profit_percent,
            "max_size": self.max_size,
            "total_profit": self.total_profit,
            "confidence": self.confidence,
            "strategy": self.strategy,
        }


@dataclass
class MarketPair:
    """Represents a matched pair of markets across platforms."""
    
    # Identifiers
    polymarket_yes_token: str
    polymarket_no_token: str
    kalshi_ticker: str
    
    # Market info
    name: str
    category: str
    
    # For markets that are split on one platform
    # e.g., Polymarket has separate "450-474" and "475-499" markets
    # while Kalshi has a single "450-499" market
    polymarket_tokens: List[Tuple[str, str]] = None  # [(yes_token, no_token), ...]
    is_split_market: bool = False


class ArbitrageDetector:
    """
    Detects arbitrage opportunities between Polymarket and Kalshi.
    
    Supports:
    1. Simple cross-platform arbitrage (same market, different prices)
    2. Split market arbitrage (one platform splits outcomes that another combines)
    
    Fee-aware thresholds:
    - Polymarket: ~0% trading fee (2% on winning)
    - Kalshi: ~7% on profits
    - Uses asymmetric thresholds based on buy platform
    """
    
    # Asymmetric minimum profit thresholds based on fee structure
    # Buying on Polymarket (0% fee) is cheaper, so lower threshold
    # Buying on Kalshi (7% fee) requires higher profit to cover costs
    MIN_PROFIT_BUY_POLYMARKET = 3.0  # Lower threshold - cheaper fees
    MIN_PROFIT_BUY_KALSHI = 5.0      # Higher threshold - expensive fees
    
    def __init__(
        self,
        min_profit_percent: float = 1.0,  # Base threshold (overridden by asymmetric)
        min_confidence: float = 0.5,
        max_data_age_seconds: float = 10.0,  # Tightened from 30s - stale data kills arb
    ):
        self.min_profit_percent = min_profit_percent
        self.min_confidence = min_confidence
        self.max_data_age_seconds = max_data_age_seconds
        
        # Opportunity counter for unique IDs
        self._opportunity_counter = 0
    
    def _get_min_profit_for_direction(self, buy_platform: str) -> float:
        """
        Get minimum profit threshold based on which platform we're buying from.
        
        Rationale:
        - Buying on Polymarket (0% fee) → Selling on Kalshi: 3% min
        - Buying on Kalshi (7% fee) → Selling on Polymarket: 5% min
        """
        if buy_platform == "polymarket":
            return max(self.min_profit_percent, self.MIN_PROFIT_BUY_POLYMARKET)
        else:  # kalshi
            return max(self.min_profit_percent, self.MIN_PROFIT_BUY_KALSHI)
    
    def _generate_opportunity_id(self) -> str:
        """Generate unique opportunity ID."""
        self._opportunity_counter += 1
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"OPP-{timestamp}-{self._opportunity_counter:04d}"
    
    def _calculate_confidence(
        self,
        poly_last_update: float,
        kalshi_last_update: float,
        current_time: float,
    ) -> float:
        """
        Calculate confidence score based on data freshness.
        Returns value between 0 and 1.
        
        Fresher data = higher confidence = better arb opportunity.
        Stale data (>10s) = likely opportunity already gone.
        """
        poly_age = current_time - poly_last_update
        kalshi_age = current_time - kalshi_last_update
        max_age = max(poly_age, kalshi_age)
        
        if max_age > self.max_data_age_seconds:
            return 0.0
        
        # Linear decay from 1.0 at 0 seconds to 0.0 at max_data_age
        return 1.0 - (max_age / self.max_data_age_seconds)
    
    def find_simple_arbitrage(
        self,
        polymarket_bids: List[Tuple[float, float]],  # [(price, size), ...]
        polymarket_asks: List[Tuple[float, float]],
        kalshi_bids: List[Tuple[float, float]],
        kalshi_asks: List[Tuple[float, float]],
        poly_token_id: str,
        kalshi_ticker: str,
        market_name: str,
        poly_last_update: float,
        kalshi_last_update: float,
    ) -> List[Opportunity]:
        """
        Find simple arbitrage between matching markets.
        
        Strategy 1: Buy on Kalshi (low ask), Sell on Polymarket (high bid)
        Strategy 2: Buy on Polymarket (low ask), Sell on Kalshi (high bid)
        """
        opportunities = []
        current_time = datetime.utcnow().timestamp()
        
        confidence = self._calculate_confidence(
            poly_last_update, kalshi_last_update, current_time
        )
        
        if confidence < self.min_confidence:
            logger.debug(
                f"Skipping {market_name}: low confidence {confidence:.2f}"
            )
            return opportunities
        
        # Strategy 1: Buy Kalshi ask, Sell Polymarket bid
        # Higher threshold needed (Kalshi has 7% fees)
        if kalshi_asks and polymarket_bids:
            kalshi_ask_price, kalshi_ask_size = kalshi_asks[0]
            poly_bid_price, poly_bid_size = polymarket_bids[0]
            
            profit = poly_bid_price - kalshi_ask_price
            profit_percent = (
                (profit / kalshi_ask_price) * 100 if kalshi_ask_price > 0 else 0
            )
            max_size = min(kalshi_ask_size, poly_bid_size)
            
            # Use asymmetric threshold - buying Kalshi needs higher profit
            min_threshold = self._get_min_profit_for_direction("kalshi")
            if profit_percent >= min_threshold:
                opportunities.append(Opportunity(
                    id=self._generate_opportunity_id(),
                    detected_at=datetime.utcnow(),
                    buy_platform="kalshi",
                    sell_platform="polymarket",
                    buy_market_id=kalshi_ticker,
                    sell_market_id=poly_token_id,
                    buy_market_name=market_name,
                    sell_market_name=market_name,
                    buy_price=kalshi_ask_price,
                    sell_price=poly_bid_price,
                    profit_per_contract=profit,
                    profit_percent=profit_percent,
                    max_size=max_size,
                    total_profit=profit * max_size,
                    confidence=confidence,
                    strategy="Buy Kalshi YES ask, Sell Polymarket YES bid",
                ))
        
        # Strategy 2: Buy Polymarket ask, Sell Kalshi bid
        # Lower threshold (Polymarket has 0% trading fees)
        if polymarket_asks and kalshi_bids:
            poly_ask_price, poly_ask_size = polymarket_asks[0]
            kalshi_bid_price, kalshi_bid_size = kalshi_bids[0]
            
            profit = kalshi_bid_price - poly_ask_price
            profit_percent = (
                (profit / poly_ask_price) * 100 if poly_ask_price > 0 else 0
            )
            max_size = min(poly_ask_size, kalshi_bid_size)
            
            # Use asymmetric threshold - buying Polymarket is cheaper
            min_threshold = self._get_min_profit_for_direction("polymarket")
            if profit_percent >= min_threshold:
                opportunities.append(Opportunity(
                    id=self._generate_opportunity_id(),
                    detected_at=datetime.utcnow(),
                    buy_platform="polymarket",
                    sell_platform="kalshi",
                    buy_market_id=poly_token_id,
                    sell_market_id=kalshi_ticker,
                    buy_market_name=market_name,
                    sell_market_name=market_name,
                    buy_price=poly_ask_price,
                    sell_price=kalshi_bid_price,
                    profit_per_contract=profit,
                    profit_percent=profit_percent,
                    max_size=max_size,
                    total_profit=profit * max_size,
                    confidence=confidence,
                    strategy="Buy Polymarket YES ask, Sell Kalshi YES bid",
                ))
        
        return opportunities
    
    def find_split_market_arbitrage(
        self,
        poly_markets: List[Dict],  # List of {token_id, bids, asks, last_update}
        kalshi_bids: List[Tuple[float, float]],
        kalshi_asks: List[Tuple[float, float]],
        kalshi_ticker: str,
        market_name: str,
        kalshi_last_update: float,
    ) -> List[Opportunity]:
        """
        Find arbitrage when Polymarket splits a market that Kalshi has combined.
        
        Example: Kalshi has "450-499 tweets" while Polymarket has
        separate "450-474" and "475-499" markets.
        
        Strategy 1: Buy Kalshi single ask, Sell Polymarket split bids
        Strategy 2: Buy Polymarket split asks, Sell Kalshi single bid
        """
        opportunities = []
        current_time = datetime.utcnow().timestamp()
        
        if len(poly_markets) < 2:
            return opportunities
        
        # Check data freshness for all Polymarket markets
        poly_last_updates = [m.get("last_update", 0) for m in poly_markets]
        oldest_poly_update = min(poly_last_updates) if poly_last_updates else 0
        
        confidence = self._calculate_confidence(
            oldest_poly_update, kalshi_last_update, current_time
        )
        
        if confidence < self.min_confidence:
            return opportunities
        
        # Strategy 1: Buy Kalshi ask, Sell combined Polymarket bids
        # Strategy 1: Buy Kalshi combined ask, Sell Polymarket split bids
        # Higher threshold (Kalshi 7% fees)
        if kalshi_asks:
            kalshi_ask_price, kalshi_ask_size = kalshi_asks[0]
            
            # Sum up Polymarket bid prices (combined probability)
            poly_bid_sum = 0
            poly_min_size = float('inf')
            
            for market in poly_markets:
                bids = market.get("bids", [])
                if bids:
                    poly_bid_sum += bids[0][0]
                    poly_min_size = min(poly_min_size, bids[0][1])
            
            if poly_min_size == float('inf'):
                poly_min_size = 0
            
            profit = poly_bid_sum - kalshi_ask_price
            profit_percent = (
                (profit / kalshi_ask_price) * 100 if kalshi_ask_price > 0 else 0
            )
            max_size = min(kalshi_ask_size, poly_min_size)
            
            # Use asymmetric threshold - buying Kalshi needs higher profit
            min_threshold = self._get_min_profit_for_direction("kalshi")
            if profit_percent >= min_threshold:
                poly_token_ids = [m.get("token_id", "") for m in poly_markets]
                opportunities.append(Opportunity(
                    id=self._generate_opportunity_id(),
                    detected_at=datetime.utcnow(),
                    buy_platform="kalshi",
                    sell_platform="polymarket",
                    buy_market_id=kalshi_ticker,
                    sell_market_id=",".join(poly_token_ids),
                    buy_market_name=market_name,
                    sell_market_name=f"{market_name} (split)",
                    buy_price=kalshi_ask_price,
                    sell_price=poly_bid_sum,
                    profit_per_contract=profit,
                    profit_percent=profit_percent,
                    max_size=max_size,
                    total_profit=profit * max_size,
                    confidence=confidence,
                    strategy="Buy Kalshi combined, Sell Polymarket split",
                ))
        
        # Strategy 2: Buy combined Polymarket asks, Sell Kalshi bid
        # Lower threshold (Polymarket 0% fees)
        if kalshi_bids:
            kalshi_bid_price, kalshi_bid_size = kalshi_bids[0]
            
            # Sum up Polymarket ask prices
            poly_ask_sum = 0
            poly_min_size = float('inf')
            
            for market in poly_markets:
                asks = market.get("asks", [])
                if asks:
                    poly_ask_sum += asks[0][0]
                    poly_min_size = min(poly_min_size, asks[0][1])
            
            if poly_min_size == float('inf'):
                poly_min_size = 0
            
            profit = kalshi_bid_price - poly_ask_sum
            profit_percent = (
                (profit / poly_ask_sum) * 100 if poly_ask_sum > 0 else 0
            )
            max_size = min(kalshi_bid_size, poly_min_size)
            
            # Use asymmetric threshold - buying Polymarket is cheaper
            min_threshold = self._get_min_profit_for_direction("polymarket")
            if profit_percent >= min_threshold:
                poly_token_ids = [m.get("token_id", "") for m in poly_markets]
                opportunities.append(Opportunity(
                    id=self._generate_opportunity_id(),
                    detected_at=datetime.utcnow(),
                    buy_platform="polymarket",
                    sell_platform="kalshi",
                    buy_market_id=",".join(poly_token_ids),
                    sell_market_id=kalshi_ticker,
                    buy_market_name=f"{market_name} (split)",
                    sell_market_name=market_name,
                    buy_price=poly_ask_sum,
                    sell_price=kalshi_bid_price,
                    profit_per_contract=profit,
                    profit_percent=profit_percent,
                    max_size=max_size,
                    total_profit=profit * max_size,
                    confidence=confidence,
                    strategy="Buy Polymarket split, Sell Kalshi combined",
                ))
        
        return opportunities
    
    def find_all_opportunities(
        self,
        polymarket_books: Dict,  # {token_id: OrderBook}
        kalshi_books: Dict,      # {ticker: OrderBook}
        market_pairs: List[MarketPair],
    ) -> List[Opportunity]:
        """
        Find all arbitrage opportunities across market pairs.
        
        Args:
            polymarket_books: Dict of Polymarket order books by token ID
            kalshi_books: Dict of Kalshi order books by ticker
            market_pairs: List of matched market pairs
            
        Returns:
            List of detected opportunities, sorted by profit percentage
        """
        all_opportunities = []
        
        for pair in market_pairs:
            try:
                if pair.is_split_market and pair.polymarket_tokens:
                    # Split market arbitrage
                    poly_markets = []
                    for yes_token, no_token in pair.polymarket_tokens:
                        book = polymarket_books.get(yes_token)
                        if book:
                            poly_markets.append({
                                "token_id": yes_token,
                                "bids": book.bids,
                                "asks": book.asks,
                                "last_update": book.last_update,
                            })
                    
                    kalshi_book = kalshi_books.get(pair.kalshi_ticker)
                    if kalshi_book and poly_markets:
                        opportunities = self.find_split_market_arbitrage(
                            poly_markets=poly_markets,
                            kalshi_bids=kalshi_book.get_sorted_bids(),
                            kalshi_asks=kalshi_book.get_sorted_asks(),
                            kalshi_ticker=pair.kalshi_ticker,
                            market_name=pair.name,
                            kalshi_last_update=kalshi_book.last_update,
                        )
                        all_opportunities.extend(opportunities)
                else:
                    # Simple 1:1 market arbitrage
                    poly_book = polymarket_books.get(pair.polymarket_yes_token)
                    kalshi_book = kalshi_books.get(pair.kalshi_ticker)
                    
                    if poly_book and kalshi_book:
                        opportunities = self.find_simple_arbitrage(
                            polymarket_bids=poly_book.bids,
                            polymarket_asks=poly_book.asks,
                            kalshi_bids=kalshi_book.get_sorted_bids(),
                            kalshi_asks=kalshi_book.get_sorted_asks(),
                            poly_token_id=pair.polymarket_yes_token,
                            kalshi_ticker=pair.kalshi_ticker,
                            market_name=pair.name,
                            poly_last_update=poly_book.last_update,
                            kalshi_last_update=kalshi_book.last_update,
                        )
                        all_opportunities.extend(opportunities)
            
            except Exception as e:
                logger.error(f"Error detecting arbitrage for {pair.name}: {e}")
                continue
        
        # Sort by profit percentage (highest first)
        all_opportunities.sort(key=lambda x: x.profit_percent, reverse=True)
        
        return all_opportunities
