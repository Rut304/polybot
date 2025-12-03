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


class CrossPlatformScanner:
    """
    Scans Polymarket and Kalshi for matching markets and arbitrage opportunities.
    
    This is a higher-level scanner that:
    1. Fetches markets from both platforms
    2. Matches them by title similarity
    3. Compares prices for arbitrage opportunities
    4. Reports findings via callback
    """
    
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
    
    # Minimum thresholds
    MIN_PROFIT_PERCENT = 3.0  # Minimum profit to report
    MIN_LIQUIDITY_POLY = 1000  # Minimum volume for Polymarket (in USD)
    MIN_LIQUIDITY_KALSHI = 100  # Minimum volume for Kalshi (in contracts)
    
    def __init__(
        self,
        min_profit_percent: float = 3.0,
        scan_interval: int = 120,  # Scan every 2 minutes
    ):
        self.min_profit_percent = min_profit_percent
        self.scan_interval = scan_interval
        self._running = False
        self._http_client = None
        
        # Cache for matched markets
        self._matched_pairs: List[Dict] = []
        self._last_match_time = 0
        self._match_refresh_interval = 300  # Refresh matches every 5 min
    
    async def _get_http_client(self):
        """Get or create HTTP client."""
        if self._http_client is None:
            import httpx
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def fetch_polymarket_markets(self) -> List[Dict]:
        """Fetch active markets from Polymarket."""
        try:
            client = await self._get_http_client()
            response = await client.get(
                f"{self.POLYMARKET_API}/markets",
                params={"limit": 200, "active": "true", "closed": "false"}
            )
            response.raise_for_status()
            markets = response.json()
            
            # Filter to high-liquidity markets
            filtered = []
            for m in markets:
                try:
                    volume = float(m.get("volume", 0) or 0)
                    if volume >= self.MIN_LIQUIDITY_POLY:
                        # Parse prices
                        prices = m.get("outcomePrices", "[]")
                        if isinstance(prices, str):
                            import json
                            prices = json.loads(prices)
                        
                        yes_price = float(prices[0]) if prices else 0.5
                        no_price = float(prices[1]) if len(prices) > 1 else 1 - yes_price
                        
                        filtered.append({
                            "id": m.get("conditionId", m.get("id")),
                            "question": m.get("question", ""),
                            "yes_price": yes_price,
                            "no_price": no_price,
                            "volume": volume,
                            "platform": "polymarket",
                        })
                except (ValueError, IndexError, TypeError):
                    continue
            
            logger.info(f"Fetched {len(filtered)} Polymarket markets (vol >= ${self.MIN_LIQUIDITY_POLY})")
            return filtered
            
        except Exception as e:
            logger.error(f"Failed to fetch Polymarket markets: {e}")
            return []
    
    async def fetch_kalshi_markets(self) -> List[Dict]:
        """
        Fetch active markets from Kalshi.
        
        Uses the events API to get proper market titles,
        then fetches markets for each event.
        """
        try:
            client = await self._get_http_client()
            
            # Fetch events
            events_resp = await client.get(
                f"{self.KALSHI_API}/events",
                params={"limit": 100}
            )
            events_resp.raise_for_status()
            events_data = events_resp.json()
            
            filtered = []
            event_count = 0
            
            # Process each event and get its markets
            for event in events_data.get("events", []):
                event_ticker = event.get("event_ticker", "")
                event_title = event.get("title", "")
                
                if not event_ticker:
                    continue
                
                # Fetch markets for this event
                try:
                    markets_resp = await client.get(
                        f"{self.KALSHI_API}/markets",
                        params={"event_ticker": event_ticker}
                    )
                    markets_resp.raise_for_status()
                    markets = markets_resp.json().get("markets", [])
                except Exception:
                    continue
                
                for m in markets:
                    try:
                        if m.get("status") != "active":
                            continue
                        
                        volume = int(m.get("volume", 0) or 0)
                        if volume < self.MIN_LIQUIDITY_KALSHI:
                            continue
                        
                        # Skip MVE/parlay markets
                        ticker = m.get("ticker", "")
                        if "MVE" in ticker:
                            continue
                        
                        # Kalshi prices are in cents (0-100)
                        yes_bid = float(m.get("yes_bid", 0) or 0) / 100
                        yes_ask = float(m.get("yes_ask", 0) or 0) / 100
                        last_price = float(m.get("last_price", 50) or 50) / 100
                        
                        # Use mid price if no bid/ask
                        if yes_bid and yes_ask:
                            yes_price = (yes_bid + yes_ask) / 2
                        else:
                            yes_price = last_price
                        
                        # Use event title as the question (better for matching)
                        filtered.append({
                            "id": ticker,
                            "question": event_title,
                            "yes_price": yes_price,
                            "no_price": 1 - yes_price,
                            "yes_bid": yes_bid,
                            "yes_ask": yes_ask,
                            "volume": volume,
                            "platform": "kalshi",
                        })
                        event_count += 1
                    except (ValueError, TypeError):
                        continue
                
                # Limit API calls - stop after we have enough markets
                if len(filtered) >= 50:
                    break
            
            logger.info(f"Fetched {len(filtered)} Kalshi event markets")
            return filtered
            
        except Exception as e:
            logger.error(f"Failed to fetch Kalshi markets: {e}")
            return []
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching."""
        import re
        text = text.lower().strip()
        # Remove common words and punctuation
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        # Remove common filler words
        stopwords = {'will', 'the', 'be', 'a', 'an', 'by', 'in', 'on', 'at', 'to', 'of', 'for'}
        words = [w for w in text.split() if w not in stopwords]
        return ' '.join(words)
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity score (0-1)."""
        norm1 = self._normalize_text(text1)
        norm2 = self._normalize_text(text2)
        
        if not norm1 or not norm2:
            return 0.0
        
        words1 = set(norm1.split())
        words2 = set(norm2.split())
        
        if not words1 or not words2:
            return 0.0
        
        # Jaccard similarity
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0
    
    async def find_matching_markets(
        self,
        poly_markets: List[Dict],
        kalshi_markets: List[Dict],
        min_similarity: float = 0.25,  # Lowered from 0.4 for better cross-platform matching
    ) -> List[Dict]:
        """
        Find matching markets between platforms based on title similarity.
        
        Returns list of matched pairs with price comparison.
        """
        matches = []
        
        for poly in poly_markets:
            poly_question = poly.get("question", "")
            if not poly_question:
                continue
            
            best_match = None
            best_score = 0.0
            
            for kalshi in kalshi_markets:
                kalshi_title = kalshi.get("question", "")
                if not kalshi_title:
                    continue
                
                score = self._calculate_similarity(poly_question, kalshi_title)
                
                # Log potential matches for debugging
                if score >= 0.15:  # Log anything close
                    logger.debug(
                        f"Similarity {score:.2f}: Poly='{poly_question[:40]}' "
                        f"vs Kalshi='{kalshi_title[:40]}'"
                    )
                
                if score > best_score and score >= min_similarity:
                    best_score = score
                    best_match = kalshi
            
            if best_match:
                # Calculate price difference
                poly_yes = poly.get("yes_price", 0.5)
                kalshi_yes = best_match.get("yes_price", 0.5)
                price_diff = abs(poly_yes - kalshi_yes)
                price_diff_pct = price_diff * 100
                
                matches.append({
                    "polymarket": poly,
                    "kalshi": best_match,
                    "similarity": best_score,
                    "poly_yes": poly_yes,
                    "kalshi_yes": kalshi_yes,
                    "price_diff": price_diff,
                    "price_diff_pct": price_diff_pct,
                })
        
        # Sort by price difference (potential profit)
        matches.sort(key=lambda x: x["price_diff_pct"], reverse=True)
        
        if matches:
            logger.info(f"Found {len(matches)} matched market pairs")
            # Log the best match for visibility
            best = matches[0]
            logger.info(
                f"Best match: Poly={best['poly_yes']:.0%} vs Kalshi={best['kalshi_yes']:.0%} "
                f"(diff={best['price_diff_pct']:.1f}%, sim={best['similarity']:.2f})"
            )
        else:
            logger.info("No matched market pairs found between platforms")
        return matches
    
    def analyze_opportunity(self, match: Dict) -> Optional[Opportunity]:
        """
        Analyze a matched pair for arbitrage opportunity.
        
        Strategy:
        - If Poly YES < Kalshi YES: Buy Poly, Sell Kalshi
        - If Kalshi YES < Poly YES: Buy Kalshi, Sell Poly
        """
        poly = match["polymarket"]
        kalshi = match["kalshi"]
        
        poly_yes = match["poly_yes"]
        kalshi_yes = match["kalshi_yes"]
        
        # Strategy 1: Buy Poly YES (cheaper), Sell Kalshi YES (expensive)
        if poly_yes < kalshi_yes:
            profit = kalshi_yes - poly_yes
            profit_pct = (profit / poly_yes) * 100 if poly_yes > 0 else 0
            
            # Apply asymmetric threshold (buying Poly is cheap)
            if profit_pct >= self.min_profit_percent:
                return Opportunity(
                    id=f"XP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{len(poly['id'][:8])}",
                    detected_at=datetime.utcnow(),
                    buy_platform="polymarket",
                    sell_platform="kalshi",
                    buy_market_id=poly["id"],
                    sell_market_id=kalshi["id"],
                    buy_market_name=poly["question"][:100],
                    sell_market_name=kalshi["question"][:100],
                    buy_price=poly_yes,
                    sell_price=kalshi_yes,
                    profit_per_contract=profit,
                    profit_percent=profit_pct,
                    max_size=min(poly.get("volume", 0), kalshi.get("volume", 0)) / 1000,
                    total_profit=profit * 100,  # Assume $100 position
                    confidence=match["similarity"],
                    strategy=f"Buy Poly YES @{poly_yes:.2f}, Sell Kalshi YES @{kalshi_yes:.2f}",
                )
        
        # Strategy 2: Buy Kalshi YES (cheaper), Sell Poly YES (expensive)
        elif kalshi_yes < poly_yes:
            profit = poly_yes - kalshi_yes
            profit_pct = (profit / kalshi_yes) * 100 if kalshi_yes > 0 else 0
            
            # Apply asymmetric threshold (buying Kalshi is expensive - need 5%+)
            min_threshold = max(self.min_profit_percent, 5.0)
            if profit_pct >= min_threshold:
                return Opportunity(
                    id=f"XP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{len(kalshi['id'][:8])}",
                    detected_at=datetime.utcnow(),
                    buy_platform="kalshi",
                    sell_platform="polymarket",
                    buy_market_id=kalshi["id"],
                    sell_market_id=poly["id"],
                    buy_market_name=kalshi["question"][:100],
                    sell_market_name=poly["question"][:100],
                    buy_price=kalshi_yes,
                    sell_price=poly_yes,
                    profit_per_contract=profit,
                    profit_percent=profit_pct,
                    max_size=min(poly.get("volume", 0), kalshi.get("volume", 0)) / 1000,
                    total_profit=profit * 100,
                    confidence=match["similarity"],
                    strategy=f"Buy Kalshi YES @{kalshi_yes:.2f}, Sell Poly YES @{poly_yes:.2f}",
                )
        
        return None
    
    async def scan_for_opportunities(self) -> List[Opportunity]:
        """
        Perform a full scan for cross-platform arbitrage opportunities.
        
        Returns list of detected opportunities.
        """
        import time
        
        # Fetch markets from both platforms
        poly_markets, kalshi_markets = await asyncio.gather(
            self.fetch_polymarket_markets(),
            self.fetch_kalshi_markets(),
        )
        
        if not poly_markets or not kalshi_markets:
            logger.warning("Missing market data - cannot scan for opportunities")
            return []
        
        # Log sample titles for debugging
        if poly_markets:
            sample_poly = poly_markets[0].get("question", "")[:80]
            logger.info(f"Sample Poly: {sample_poly}...")
        if kalshi_markets:
            sample_kalshi = kalshi_markets[0].get("question", "")[:80]
            logger.info(f"Sample Kalshi: {sample_kalshi}...")
        
        # Find matching markets (refresh periodically)
        current_time = time.time()
        if (current_time - self._last_match_time) > self._match_refresh_interval or not self._matched_pairs:
            self._matched_pairs = await self.find_matching_markets(poly_markets, kalshi_markets)
            self._last_match_time = current_time
        
        # Analyze each match for opportunities
        opportunities = []
        for match in self._matched_pairs:
            opp = self.analyze_opportunity(match)
            if opp:
                opportunities.append(opp)
        
        # Sort by profit percentage
        opportunities.sort(key=lambda x: x.profit_percent, reverse=True)
        
        return opportunities
    
    async def run(
        self,
        callback=None,
    ) -> None:
        """
        Run continuous scanning for cross-platform arbitrage.
        
        Args:
            callback: Async function called with each Opportunity found
        """
        import asyncio
        
        self._running = True
        logger.info("🔍 Starting Cross-Platform Arbitrage Scanner")
        logger.info(f"   Min profit threshold: {self.min_profit_percent}%")
        logger.info(f"   Scan interval: {self.scan_interval}s")
        
        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()
                
                if opportunities:
                    logger.info(f"🎯 Found {len(opportunities)} cross-platform opportunities!")
                    
                    for opp in opportunities:
                        logger.info(
                            f"   💰 {opp.profit_percent:.1f}% profit: "
                            f"{opp.buy_platform}→{opp.sell_platform} | "
                            f"{opp.buy_market_name[:40]}..."
                        )
                        
                        if callback:
                            try:
                                result = callback(opp)
                                if asyncio.iscoroutine(result):
                                    await result
                            except Exception as e:
                                logger.error(f"Callback error: {e}")
                else:
                    logger.debug("No cross-platform opportunities found this scan")
                
                logger.info(
                    f"Cross-platform scan complete. "
                    f"Found {len(opportunities)} opportunities. "
                    f"Next scan in {self.scan_interval}s"
                )
                
            except Exception as e:
                logger.error(f"Error in cross-platform scan: {e}")
            
            await asyncio.sleep(self.scan_interval)
    
    def stop(self) -> None:
        """Stop the scanner."""
        self._running = False
        logger.info("Stopping Cross-Platform Arbitrage Scanner")
    
    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


# Make asyncio available for the run method
import asyncio
