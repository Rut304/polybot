"""
BTC Bracket Arbitrage Strategy

Based on Twitter research (@bckfv_eth, @hanakoxbt, @carverfomo):
- Bots making $20K-$200K on BTC 15-min Up/Down markets
- Strategy: Buy YES + NO when combined price < 100¢
- Guaranteed profit on resolution

Key insight: On any market, YES + NO should = $1.00
When YES + NO < $1.00, buy BOTH for risk-free profit.

Example:
- YES @ 48¢ + NO @ 48¢ = 96¢ cost
- Guaranteed $1.00 payout = 4% risk-free profit

This is the "new meta" on Polymarket according to multiple sources.

Rate Limiting:
- Kalshi API: 30 req/min, 2s between requests
- Polymarket API: More lenient, 0.5s between requests
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
import aiohttp
import re

logger = logging.getLogger(__name__)

# Rate limiting constants for Kalshi
KALSHI_MIN_INTERVAL = 2.0  # Minimum seconds between requests
KALSHI_MAX_PER_MINUTE = 30


class BracketType(Enum):
    """Types of BTC bracket markets"""
    BTC_15MIN = "btc_15min"
    BTC_1HOUR = "btc_1hour"
    BTC_DAILY = "btc_daily"
    ETH_15MIN = "eth_15min"
    OTHER = "other"


@dataclass
class BracketOpportunity:
    """A BTC bracket arbitrage opportunity"""
    id: str
    detected_at: datetime
    platform: str  # "polymarket" or "kalshi"
    bracket_type: BracketType
    
    # Market info
    market_id: str
    market_title: str
    market_slug: Optional[str] = None
    expiry: Optional[datetime] = None
    
    # Prices
    yes_price: Decimal = Decimal("0")
    no_price: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")
    
    # Arbitrage details
    profit_pct: Decimal = Decimal("0")
    max_size_usd: Decimal = Decimal("0")
    
    # Execution info
    yes_token_id: Optional[str] = None
    no_token_id: Optional[str] = None
    
    # Risk metrics
    time_to_expiry_minutes: int = 0
    liquidity_score: float = 0.0
    
    def __str__(self) -> str:
        return (
            f"BTC Bracket Arb: {self.bracket_type.value} | "
            f"YES={self.yes_price:.0%} NO={self.no_price:.0%} | "
            f"Total={self.total_price:.0%} | "
            f"Profit={self.profit_pct:.2f}%"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "platform": self.platform,
            "bracket_type": self.bracket_type.value,
            "market_id": self.market_id,
            "market_title": self.market_title,
            "yes_price": float(self.yes_price),
            "no_price": float(self.no_price),
            "total_price": float(self.total_price),
            "profit_pct": float(self.profit_pct),
            "max_size_usd": float(self.max_size_usd),
            "time_to_expiry_minutes": self.time_to_expiry_minutes,
            "liquidity_score": self.liquidity_score,
        }


@dataclass
class BracketArbStats:
    """Statistics for BTC bracket arbitrage"""
    total_scans: int = 0
    opportunities_found: int = 0
    opportunities_traded: int = 0
    total_profit_usd: Decimal = Decimal("0")
    avg_profit_pct: Decimal = Decimal("0")
    best_profit_pct: Decimal = Decimal("0")
    markets_tracked: int = 0
    
    # Per bracket type stats
    stats_by_type: Dict[str, Dict] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_scans": self.total_scans,
            "opportunities_found": self.opportunities_found,
            "opportunities_traded": self.opportunities_traded,
            "total_profit_usd": float(self.total_profit_usd),
            "avg_profit_pct": float(self.avg_profit_pct),
            "best_profit_pct": float(self.best_profit_pct),
            "markets_tracked": self.markets_tracked,
            "stats_by_type": self.stats_by_type,
        }


class BTCBracketArbStrategy:
    """
    BTC Bracket Arbitrage Scanner
    
    Specialized scanner for Bitcoin (and ETH) bracket markets:
    - 15-minute Up/Down markets (primary focus)
    - 1-hour brackets
    - Daily brackets
    
    Strategy:
    1. Scan for BTC/ETH bracket markets
    2. Check if YES + NO < 100%
    3. If profitable, buy BOTH sides
    4. Wait for resolution (guaranteed profit)
    
    Risk Management:
    - Only trade markets with sufficient liquidity
    - Time filter: Avoid markets expiring in < 2 minutes
    - Max position sizing based on config
    """
    
    # API endpoints
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
    
    # BTC market patterns
    BTC_PATTERNS = [
        r"bitcoin.*up.*down",
        r"btc.*up.*down",
        r"bitcoin.*price.*15.*min",
        r"btc.*price.*15.*min",
        r"bitcoin.*above.*below",
        r"btc.*above.*below",
        r"bitcoin.*\d+.*minute",
        r"btc.*\d+.*minute",
        r"bitcoin.*higher.*lower",
    ]
    
    ETH_PATTERNS = [
        r"ethereum.*up.*down",
        r"eth.*up.*down",
        r"ethereum.*price.*15.*min",
        r"eth.*price.*15.*min",
    ]
    
    # Kalshi BTC market tickers
    KALSHI_BTC_PREFIXES = [
        "BTCUP",
        "BTCDOWN",
        "BTCM",  # BTC minute markets
        "BTCH",  # BTC hourly
        "BTCD",  # BTC daily
    ]

    def __init__(
        self,
        min_profit_pct: float = 0.5,
        max_profit_pct: float = 10.0,  # Above this is likely bad data
        min_liquidity_usd: float = 100.0,
        min_time_to_expiry_minutes: int = 2,
        max_position_usd: float = 100.0,
        scan_interval_seconds: int = 15,  # Fast scanning for 15-min markets
        on_opportunity: Optional[Callable] = None,
        db_client=None,
    ):
        self.min_profit_pct = Decimal(str(min_profit_pct))
        self.max_profit_pct = Decimal(str(max_profit_pct))
        self.min_liquidity_usd = Decimal(str(min_liquidity_usd))
        self.min_time_to_expiry = min_time_to_expiry_minutes
        self.max_position_usd = Decimal(str(max_position_usd))
        self.scan_interval = scan_interval_seconds
        self.on_opportunity = on_opportunity
        self.db = db_client

        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = BracketArbStats()

        # Cache for bracket markets
        self._bracket_markets: Dict[str, Dict] = {}
        self._last_cache_update = datetime.min
        self._cache_ttl_seconds = 60

        # Cooldown tracking
        self._recently_traded: Dict[str, datetime] = {}
        self._cooldown_seconds = 300  # 5 min cooldown per market

        # Rate limiting for Kalshi
        self._kalshi_last_request: float = 0.0
        self._kalshi_requests_minute: int = 0
        self._kalshi_minute_start: float = 0.0
        self._kalshi_backoff_until: float = 0.0

        # Compile patterns
        self._btc_regex = re.compile(
            '|'.join(self.BTC_PATTERNS), re.IGNORECASE
        )
        self._eth_regex = re.compile(
            '|'.join(self.ETH_PATTERNS), re.IGNORECASE
        )
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()

    async def _kalshi_rate_limit(self):
        """
        Apply rate limiting for Kalshi API calls.
        Prevents 429 errors with adaptive backoff.
        """
        now = time.time()

        # Check backoff period (after 429)
        if now < self._kalshi_backoff_until:
            wait_time = self._kalshi_backoff_until - now
            logger.info(f"[BTC-Arb] Kalshi rate limited, waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
            now = time.time()

        # Reset minute window if needed
        if now - self._kalshi_minute_start >= 60:
            self._kalshi_minute_start = now
            self._kalshi_requests_minute = 0

        # Check per-minute limit
        if self._kalshi_requests_minute >= KALSHI_MAX_PER_MINUTE:
            wait_until = self._kalshi_minute_start + 60
            extra_wait = wait_until - now + 0.1
            if extra_wait > 0:
                logger.info(
                    f"[BTC-Arb] Kalshi rate limit reached, "
                    f"waiting {extra_wait:.1f}s"
                )
                await asyncio.sleep(extra_wait)
                now = time.time()
                self._kalshi_minute_start = now
                self._kalshi_requests_minute = 0

        # Enforce minimum interval
        time_since_last = now - self._kalshi_last_request
        if time_since_last < KALSHI_MIN_INTERVAL:
            await asyncio.sleep(KALSHI_MIN_INTERVAL - time_since_last)

        # Update state
        self._kalshi_last_request = time.time()
        self._kalshi_requests_minute += 1

    def _handle_kalshi_response(self, status: int):
        """Handle Kalshi response, applying backoff on 429."""
        if status == 429:
            # Exponential backoff: 5, 10, 20, 40, 60 (max)
            current_backoff = self._kalshi_backoff_until - time.time()
            new_backoff = min(max(current_backoff * 2, 5), 60)
            self._kalshi_backoff_until = time.time() + new_backoff
            logger.warning(f"[BTC-Arb] Kalshi 429, backing off {new_backoff}s")

    def _identify_bracket_type(self, title: str, ticker: str = "") -> BracketType:
        """Identify the type of bracket market"""
        title_lower = title.lower()
        ticker_lower = ticker.lower()

        # Check for BTC 15-minute
        btc_15_check = "15" in title_lower
        min_check = "min" in title_lower or "minute" in title_lower
        if btc_15_check and min_check:
            if self._btc_regex.search(title):
                return BracketType.BTC_15MIN
            if self._eth_regex.search(title):
                return BracketType.ETH_15MIN

        # Check for BTC hourly
        if "hour" in title_lower or "1h" in title_lower:
            if self._btc_regex.search(title):
                return BracketType.BTC_1HOUR

        # Check for BTC daily
        if "daily" in title_lower or "day" in title_lower:
            if self._btc_regex.search(title):
                return BracketType.BTC_DAILY

        # Check ticker patterns (Kalshi)
        for prefix in self.KALSHI_BTC_PREFIXES:
            if ticker_lower.startswith(prefix.lower()):
                if "15" in ticker or "M" in ticker:
                    return BracketType.BTC_15MIN
                if "H" in ticker:
                    return BracketType.BTC_1HOUR
                if "D" in ticker:
                    return BracketType.BTC_DAILY

        return BracketType.OTHER

    def _is_bracket_market(self, title: str, ticker: str = "") -> bool:
        """Check if a market is a BTC/ETH bracket market"""
        bracket_type = self._identify_bracket_type(title, ticker)
        return bracket_type != BracketType.OTHER

    def _is_on_cooldown(self, market_id: str) -> bool:
        """Check if market is on cooldown"""
        if market_id not in self._recently_traded:
            return False

        traded_time = self._recently_traded[market_id]
        elapsed = (datetime.now() - traded_time).total_seconds()
        return elapsed < self._cooldown_seconds

    def mark_traded(self, market_id: str):
        """Mark market as traded (start cooldown)"""
        self._recently_traded[market_id] = datetime.now()

    async def fetch_polymarket_btc_markets(self) -> List[Dict]:
        """Fetch BTC bracket markets from Polymarket"""
        session = await self._get_session()
        btc_markets = []
        
        try:
            url = f"{self.POLYMARKET_API}/markets"
            params = {
                "active": "true",
                "closed": "false",
                "limit": 200,
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    markets = data if isinstance(data, list) else data.get("data", [])
                    
                    # Filter for BTC/ETH bracket markets
                    for market in markets:
                        title = market.get("question", "")
                        if self._is_bracket_market(title):
                            btc_markets.append(market)
                    
                    logger.info(f"Found {len(btc_markets)} BTC bracket markets on Polymarket")
                else:
                    logger.warning(f"Polymarket API returned {resp.status}")

        except Exception as e:
            logger.error(f"Error fetching Polymarket markets: {e}")

        return btc_markets

    async def fetch_kalshi_btc_markets(self) -> List[Dict]:
        """Fetch BTC bracket markets from Kalshi with rate limiting"""
        session = await self._get_session()
        btc_markets = []

        try:
            # Search for BTC markets with rate limiting
            for prefix in self.KALSHI_BTC_PREFIXES:
                # Apply rate limiting before each request
                await self._kalshi_rate_limit()

                url = f"{self.KALSHI_API}/markets"
                params = {
                    "ticker": prefix,
                    "status": "active",
                    "limit": 50,
                }

                async with session.get(url, params=params) as resp:
                    self._handle_kalshi_response(resp.status)
                    if resp.status == 200:
                        data = await resp.json()
                        markets = data.get("markets", [])
                        btc_markets.extend(markets)
                    elif resp.status == 429:
                        logger.warning(
                            f"[BTC-Arb] Kalshi 429 on prefix {prefix}"
                        )
                        # Don't continue hitting rate limits
                        break

            logger.info(
                f"[BTC-Arb] Found {len(btc_markets)} BTC bracket markets"
            )

        except Exception as e:
            logger.error(f"Error fetching Kalshi markets: {e}")

        return btc_markets

    async def analyze_polymarket_bracket(
        self,
        market: Dict,
    ) -> Optional[BracketOpportunity]:
        """Analyze a Polymarket bracket market for arbitrage"""

        market_id = market.get("conditionId") or market.get("id", "unknown")
        title = market.get("question", "Unknown")
        
        try:
            import json
            
            # Parse prices from gamma-api format
            prices_str = market.get("outcomePrices")
            outcomes_str = market.get("outcomes")
            
            if not prices_str or not outcomes_str:
                return None
            
            prices = json.loads(prices_str) if isinstance(prices_str, str) else prices_str
            outcomes = json.loads(outcomes_str) if isinstance(outcomes_str, str) else outcomes_str
            
            if len(prices) < 2:
                return None
            
            # Get YES and NO prices
            yes_price = Decimal(str(prices[0]))
            no_price = Decimal(str(prices[1])) if len(prices) > 1 else Decimal("1") - yes_price
            
            # Calculate total
            total_price = yes_price + no_price
            
            # Check for arbitrage (total < 1.0)
            if total_price >= Decimal("1.0"):
                return None
            
            profit_pct = (Decimal("1.0") - total_price) * 100
            
            # Validate profit range
            if profit_pct < self.min_profit_pct:
                return None
            if profit_pct > self.max_profit_pct:
                logger.warning(f"Suspicious profit {profit_pct}% on {title} - likely bad data")
                return None
            
            # Check cooldown
            if self._is_on_cooldown(market_id):
                return None
            
            # Get token IDs
            clob_ids = market.get("clobTokenIds")
            if clob_ids and isinstance(clob_ids, str):
                clob_ids = json.loads(clob_ids)
            
            yes_token = clob_ids[0] if clob_ids else None
            no_token = clob_ids[1] if clob_ids and len(clob_ids) > 1 else None
            
            # Check liquidity
            volume = Decimal(str(market.get("volume", 0) or 0))
            if volume < self.min_liquidity_usd:
                return None
            
            # Calculate max position
            max_size = min(
                self.max_position_usd,
                volume / 10,  # Don't take more than 10% of volume
            )
            
            # Create opportunity
            bracket_type = self._identify_bracket_type(title)
            opp_id = f"BTC-{datetime.utcnow().strftime('%H%M%S')}-{market_id[:8]}"
            
            opportunity = BracketOpportunity(
                id=opp_id,
                detected_at=datetime.now(timezone.utc),
                platform="polymarket",
                bracket_type=bracket_type,
                market_id=market_id,
                market_title=title,
                market_slug=market.get("slug"),
                yes_price=yes_price,
                no_price=no_price,
                total_price=total_price,
                profit_pct=profit_pct,
                max_size_usd=max_size,
                yes_token_id=yes_token,
                no_token_id=no_token,
                liquidity_score=float(volume / 1000),
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error analyzing bracket market {market_id}: {e}")
            return None
    
    async def analyze_kalshi_bracket(
        self,
        market: Dict,
    ) -> Optional[BracketOpportunity]:
        """Analyze a Kalshi bracket market for arbitrage"""
        
        ticker = market.get("ticker", "unknown")
        title = market.get("title", market.get("subtitle", "Unknown"))
        
        try:
            # Kalshi prices are in cents (0-100)
            yes_bid = Decimal(str(market.get("yes_bid", 0) or 0)) / 100
            yes_ask = Decimal(str(market.get("yes_ask", 0) or 0)) / 100
            no_bid = Decimal(str(market.get("no_bid", 0) or 0)) / 100
            no_ask = Decimal(str(market.get("no_ask", 0) or 0)) / 100
            
            # Use ask prices (what we'd pay to buy)
            yes_price = yes_ask if yes_ask > 0 else (yes_bid + Decimal("0.01"))
            no_price = no_ask if no_ask > 0 else (no_bid + Decimal("0.01"))
            
            # Calculate total
            total_price = yes_price + no_price
            
            # Check for arbitrage (total < 1.0)
            # Note: Kalshi has 7% fees, so we need higher spread
            min_profit_kalshi = max(self.min_profit_pct, Decimal("7.0"))
            
            if total_price >= Decimal("1.0"):
                return None
            
            profit_pct = (Decimal("1.0") - total_price) * 100
            
            # Need higher profit to cover Kalshi fees
            if profit_pct < min_profit_kalshi:
                return None
            if profit_pct > self.max_profit_pct:
                return None
            
            # Check cooldown
            if self._is_on_cooldown(ticker):
                return None
            
            # Check liquidity
            volume = int(market.get("volume", 0) or 0)
            if volume < 10:  # Kalshi uses contracts
                return None
            
            # Calculate max position
            max_size = min(
                self.max_position_usd,
                Decimal(str(volume)) / 10,
            )
            
            # Create opportunity
            bracket_type = self._identify_bracket_type(title, ticker)
            opp_id = f"BTC-K-{datetime.utcnow().strftime('%H%M%S')}-{ticker}"
            
            opportunity = BracketOpportunity(
                id=opp_id,
                detected_at=datetime.now(timezone.utc),
                platform="kalshi",
                bracket_type=bracket_type,
                market_id=ticker,
                market_title=title,
                yes_price=yes_price,
                no_price=no_price,
                total_price=total_price,
                profit_pct=profit_pct,
                max_size_usd=max_size,
                liquidity_score=float(volume / 100),
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error analyzing Kalshi bracket {ticker}: {e}")
            return None
    
    async def scan_for_opportunities(self) -> List[BracketOpportunity]:
        """Scan all bracket markets for arbitrage opportunities"""
        self.stats.total_scans += 1
        opportunities = []
        
        # Fetch markets from both platforms
        poly_markets, kalshi_markets = await asyncio.gather(
            self.fetch_polymarket_btc_markets(),
            self.fetch_kalshi_btc_markets(),
        )
        
        self.stats.markets_tracked = len(poly_markets) + len(kalshi_markets)
        
        # Analyze Polymarket brackets
        for market in poly_markets:
            opp = await self.analyze_polymarket_bracket(market)
            if opp:
                opportunities.append(opp)
                self.stats.opportunities_found += 1
                
                # Track best profit
                if opp.profit_pct > self.stats.best_profit_pct:
                    self.stats.best_profit_pct = opp.profit_pct
        
        # Analyze Kalshi brackets
        for market in kalshi_markets:
            opp = await self.analyze_kalshi_bracket(market)
            if opp:
                opportunities.append(opp)
                self.stats.opportunities_found += 1
                
                if opp.profit_pct > self.stats.best_profit_pct:
                    self.stats.best_profit_pct = opp.profit_pct
        
        # Sort by profit
        opportunities.sort(key=lambda x: x.profit_pct, reverse=True)
        
        # Log opportunities
        if opportunities:
            logger.info(f"🎯 Found {len(opportunities)} BTC bracket opportunities!")
            for opp in opportunities[:3]:  # Log top 3
                logger.info(f"   {opp}")
        
        return opportunities
    
    async def run(self):
        """Run continuous scanning"""
        self._running = True
        logger.info("🔍 Starting BTC Bracket Arbitrage Scanner")
        logger.info(f"   Min profit: {self.min_profit_pct}%")
        logger.info(f"   Scan interval: {self.scan_interval}s")
        
        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()
                
                # Callback for each opportunity
                if self.on_opportunity and opportunities:
                    for opp in opportunities:
                        await self.on_opportunity(opp)
                
                await asyncio.sleep(self.scan_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Bracket scanner error: {e}")
                await asyncio.sleep(5)
        
        await self.close()
    
    def stop(self):
        """Stop the scanner"""
        self._running = False


# Strategy info for UI
BTC_BRACKET_ARB_INFO = {
    "id": "btc_bracket_arb",
    "name": "BTC Bracket Arbitrage",
    "confidence": 90,
    "expected_apy": "50-200%",
    "description": (
        "Exploit mispricings in BTC 15-minute Up/Down markets. "
        "Buy YES + NO when combined price < 100¢ for guaranteed profit. "
        "Based on strategies making $20K-$200K on Polymarket."
    ),
    "key_points": [
        "Focus on BTC/ETH 15-minute bracket markets",
        "Risk-free when YES + NO < $1.00",
        "Fast scanning (15-second intervals)",
        "Works on both Polymarket and Kalshi",
        "The 'new meta' according to @bckfv_eth",
    ],
    "platforms": ["Polymarket", "Kalshi"],
    "risk_level": "low",
    "category": "prediction",
}
