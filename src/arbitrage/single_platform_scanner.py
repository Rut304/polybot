"""
Single-Platform Arbitrage Scanner

Detects intra-market arbitrage opportunities on a SINGLE platform.
This is where the REAL money is according to academic research:
- $40M extracted from Polymarket in 1 year (Saguillo et al., 2025)
- ~400x more profitable than cross-platform arbitrage

Two types of single-platform arbitrage:
1. Market Rebalancing: When sum of YES prices across conditions ≠ $1
   Example: 3-way market with A=40%, B=35%, C=30% = 105% (5% arb!)
   
2. Spread Arbitrage: When YES + NO prices ≠ $1 in a binary market
   Example: YES=55¢, NO=40¢ → Buy both for 95¢, guaranteed $1 payout
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import aiohttp

logger = logging.getLogger(__name__)


class ArbitrageType(Enum):
    """Types of arbitrage opportunities"""
    POLYMARKET_SINGLE = "polymarket_single"      # Intra-market on Polymarket
    KALSHI_SINGLE = "kalshi_single"              # Intra-market on Kalshi
    CROSS_PLATFORM = "cross_platform"            # Polymarket ↔ Kalshi


@dataclass
class SinglePlatformOpportunity:
    """A single-platform arbitrage opportunity"""
    id: str
    detected_at: datetime
    platform: str                    # "polymarket" or "kalshi"
    arb_type: ArbitrageType
    
    # Market info
    market_id: str
    market_title: str
    market_slug: Optional[str] = None
    
    # For multi-condition markets
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Arbitrage details
    total_price: Decimal = Decimal("0")   # Sum of all YES prices
    profit_pct: Decimal = Decimal("0")    # Profit percentage
    max_size_usd: Decimal = Decimal("0")  # Maximum profitable size
    
    # Execution info
    buy_prices: List[Decimal] = field(default_factory=list)
    sell_price: Decimal = Decimal("1.0")  # Always $1 on resolution
    
    # Liquidity
    min_liquidity_usd: Decimal = Decimal("0")
    
    # Research-backed scoring (higher = better opportunity)
    opportunity_score: float = 0.0
    
    def calculate_score(self) -> float:
        """
        PhD Research-backed opportunity scoring algorithm.
        
        Factors (from Saguillo et al., 2025):
        1. Profit % - primary factor
        2. Number of conditions - more conditions = more pricing errors
        3. Lower liquidity = longer arbitrage window
        """
        # Base score is profit percentage
        score = float(self.profit_pct)
        
        # Bonus for multi-condition markets (3+ conditions have 2x error rate)
        num_conditions = len(self.conditions)
        if num_conditions >= 3:
            score *= 1.3  # 30% bonus for complex markets
        elif num_conditions >= 5:
            score *= 1.5  # 50% bonus for very complex markets
        
        # Lower liquidity = longer window (inverse relationship)
        # Cap the bonus to avoid chasing illiquid markets
        if self.min_liquidity_usd > 0:
            liquidity = float(self.min_liquidity_usd)
            if liquidity < 1000:
                score *= 1.2  # Lower liquidity = slower arb closure
            elif liquidity > 10000:
                score *= 0.9  # High liquidity = fast closure
        
        self.opportunity_score = score
        return score
    
    def __str__(self) -> str:
        return (
            f"{self.platform.upper()} Single-Platform Arb: "
            f"{self.market_title[:50]}... | "
            f"Total={self.total_price:.2f} | "
            f"Profit={self.profit_pct:.2f}%"
        )


class SinglePlatformScanner:
    """
    Scans for single-platform arbitrage opportunities.
    
    The KEY insight from academic research:
    - Multi-condition markets often have prices that sum to > $1
    - This means you can buy ALL outcomes for < $1 and guarantee profit
    - Example: If A=40¢, B=35¢, C=30¢ → total = $1.05
    - Buy all for 95¢ equivalent → profit 5¢ guaranteed
    """
    
    # API endpoints
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
    
    # Thresholds
    MIN_PROFIT_PCT = Decimal("0.5")      # Minimum 0.5% profit to be interesting
    # FIXED: Raised from 15% to 30% - prediction markets CAN have large mispricings!
    # Academic research shows significant arbitrage opportunities exist at various levels.
    # Previously we were rejecting 16%+ profit opportunities as "bad data" - WRONG!
    MAX_PROFIT_PCT = Decimal("30.0")     # Raised from 15% - big spreads are real!
    MIN_LIQUIDITY_USD = Decimal("100")   # Minimum liquidity
    
    # Deduplication: cooldown period before trading same market again
    # For prediction markets, once you've identified an opportunity and traded it,
    # there's no reason to trade the same market again until it resolves.
    # Using 1 hour cooldown to prevent duplicate trades while allowing
    # re-evaluation if market conditions change significantly.
    MARKET_COOLDOWN_SECONDS = 3600  # 1 hour between trades on same market
    
    def __init__(
        self,
        min_profit_pct: float = 2.0,  # RAISED: Default 2% min profit
        scan_interval_seconds: int = 30,
        on_opportunity: Optional[Callable] = None,
        db_client=None,  # Database client for logging ALL scans
        # Per-platform overrides (if set, take priority over min_profit_pct)
        poly_min_profit_pct: Optional[float] = None,
        poly_max_spread_pct: Optional[float] = None,
        poly_max_position_usd: Optional[float] = None,
        kalshi_min_profit_pct: Optional[float] = None,
        kalshi_max_spread_pct: Optional[float] = None,
        kalshi_max_position_usd: Optional[float] = None,
        market_cooldown_seconds: int = 3600,  # 1 hour default cooldown
    ):
        self.min_profit_pct = Decimal(str(min_profit_pct))
        # Per-platform thresholds (TUNED 2024-12-26 based on simulation results)
        # Polymarket: Raised from 0.3% to 2.0% - tiny spreads eaten by slippage
        # Kalshi: Keep at 8.0% - must cover 7% fee + net profit
        self.poly_min_profit = Decimal(str(poly_min_profit_pct if poly_min_profit_pct else 2.0))
        self.poly_max_spread = Decimal(str(poly_max_spread_pct if poly_max_spread_pct else 15.0))
        self.poly_max_position = Decimal(str(poly_max_position_usd if poly_max_position_usd else 35.0))
        self.kalshi_min_profit = Decimal(str(kalshi_min_profit_pct if kalshi_min_profit_pct else 8.0))
        self.kalshi_max_spread = Decimal(str(kalshi_max_spread_pct if kalshi_max_spread_pct else 15.0))
        self.kalshi_max_position = Decimal(str(kalshi_max_position_usd if kalshi_max_position_usd else 75.0))
        
        self.scan_interval = scan_interval_seconds
        self.on_opportunity = on_opportunity
        self.db = db_client
        
        # Deduplication: track recently traded markets
        self.market_cooldown_seconds = market_cooldown_seconds
        self._recently_traded: Dict[str, datetime] = {}  # market_id -> last_trade_time
        
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Stats tracking per platform
        self.stats = {
            ArbitrageType.POLYMARKET_SINGLE: {
                "scans": 0,
                "opportunities_found": 0,
                "markets_checked": 0,
                "markets_rejected": 0,
                "markets_on_cooldown": 0,
            },
            ArbitrageType.KALSHI_SINGLE: {
                "scans": 0,
                "opportunities_found": 0,
                "markets_checked": 0,
                "markets_rejected": 0,
                "markets_on_cooldown": 0,
            },
        }
    
    async def _log_market_scan(
        self,
        scanner_type: str,
        platform: str,
        market_id: str,
        market_title: str,
        yes_price: Optional[float] = None,
        no_price: Optional[float] = None,
        total_price: Optional[float] = None,
        spread_pct: Optional[float] = None,
        qualifies: bool = False,
        rejection_reason: Optional[str] = None,
        opportunity_id: Optional[str] = None,
        raw_data: Optional[Dict] = None,
    ):
        """
        Log ALL market scans to database - qualifying or not.
        
        This gives full visibility into what the scanner is seeing.
        """
        if not self.db:
            return
            
        try:
            scan_data = {
                "scanner_type": scanner_type,
                "platform": platform,
                "market_id": market_id,
                "market_title": market_title[:500] if market_title else None,
                "yes_price": yes_price,
                "no_price": no_price,
                "total_price": total_price,
                "spread_pct": spread_pct,
                "potential_profit_pct": spread_pct,
                "qualifies_for_trade": qualifies,
                "rejection_reason": rejection_reason,
                "opportunity_id": opportunity_id,
            }
            
            # Add raw data if small enough
            if raw_data:
                import json
                raw_str = json.dumps(raw_data, default=str)
                if len(raw_str) < 10000:  # Limit size
                    scan_data["raw_data"] = raw_data
            
            await self.db.insert("polybot_market_scans", scan_data)
            
        except Exception as e:
            logger.debug(f"Failed to log market scan: {e}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    # =========================================================================
    # COOLDOWN / DEDUPLICATION
    # =========================================================================
    
    def _is_on_cooldown(self, market_id: str, platform: str) -> bool:
        """Check if a market is on cooldown (recently traded)."""
        key = f"{platform}:{market_id}"
        if key not in self._recently_traded:
            return False
        
        last_trade = self._recently_traded[key]
        elapsed = (datetime.now() - last_trade).total_seconds()
        return elapsed < self.market_cooldown_seconds
    
    def mark_traded(self, market_id: str, platform: str) -> None:
        """Mark a market as recently traded (starts cooldown)."""
        key = f"{platform}:{market_id}"
        self._recently_traded[key] = datetime.now()
        
        # Cleanup old entries (older than 2x cooldown)
        cutoff = datetime.now() - timedelta(
            seconds=self.market_cooldown_seconds * 2
        )
        self._recently_traded = {
            k: v for k, v in self._recently_traded.items()
            if v > cutoff
        }
    
    def get_cooldown_stats(self) -> Dict[str, Any]:
        """Get cooldown statistics."""
        now = datetime.now()
        active = sum(
            1 for v in self._recently_traded.values()
            if (now - v).total_seconds() < self.market_cooldown_seconds
        )
        return {
            "markets_on_cooldown": active,
            "total_tracked": len(self._recently_traded),
            "cooldown_seconds": self.market_cooldown_seconds,
        }
    
    # =========================================================================
    # POLYMARKET SCANNING
    # =========================================================================
    
    async def fetch_polymarket_markets(self) -> List[Dict]:
        """
        Fetch active binary markets from Polymarket.
        NOTE: Binary markets (YES/NO) always sum to $1 - no arbitrage here!
        Real opportunities are in EVENTS (multi-outcome markets).
        """
        session = await self._get_session()
        markets = []
        
        try:
            # Fetch active markets (binary YES/NO only)
            url = f"{self.POLYMARKET_API}/markets"
            params = {
                "active": "true",
                "closed": "false",
                "limit": 100,
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    markets = data if isinstance(data, list) else data.get("data", [])
                    logger.debug(f"Fetched {len(markets)} Polymarket binary markets")
                else:
                    logger.warning(f"Polymarket API returned {resp.status}")
        
        except Exception as e:
            logger.error(f"Error fetching Polymarket markets: {e}")
        
        return markets
    
    async def fetch_polymarket_events(self) -> List[Dict]:
        """
        Fetch active EVENTS from Polymarket - THIS IS WHERE THE MONEY IS!
        
        Events contain multi-outcome markets where prices often sum > $1.
        Example: "Largest Company 2025" event has options like Apple, NVIDIA, etc.
        If all option prices sum to > $1, we have an arbitrage opportunity!
        
        From academic research (Saguillo et al., 2025):
        - Multi-outcome markets have 2x the pricing errors of binary markets
        - Events with 3+ outcomes average 5-10% mispricings
        - $40M extracted from Polymarket in 1 year from these opportunities
        """
        session = await self._get_session()
        events = []
        
        try:
            # Fetch high-volume events (most liquid = fastest execution)
            url = f"{self.POLYMARKET_API}/events"
            params = {
                "closed": "false",
                "limit": 50,  # Top 50 active events
                "order": "volume24hr",
                "ascending": "false",
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    events = data if isinstance(data, list) else data.get("data", [])
                    logger.debug(
                        f"Fetched {len(events)} Polymarket events "
                        f"(multi-outcome markets)"
                    )
                else:
                    logger.warning(f"Polymarket events API returned {resp.status}")
        
        except Exception as e:
            logger.error(f"Error fetching Polymarket events: {e}")
        
        return events
    
    async def analyze_polymarket_event(
        self,
        event: Dict,
    ) -> Optional[SinglePlatformOpportunity]:
        """
        Analyze a Polymarket EVENT for multi-outcome arbitrage.
        
        Events contain multiple markets (outcomes). If the sum of all outcome
        prices > $1, we can buy all outcomes and guarantee profit.
        
        Example: "Who will win 2024 election?" event
        """
        event_id = event.get("id", "unknown")
        
        # Check cooldown first - skip if recently traded
        if self._is_on_cooldown(event_id, "polymarket"):
            self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_on_cooldown"] += 1
            return None  # Skip without logging (reduces noise)
        
        """
        - Biden: $0.35
        - Trump: $0.40  
        - Other: $0.30
        - Total: $1.05 → 5% guaranteed profit by buying all!
        """
        event_id = event.get("id", "unknown")
        event_slug = event.get("slug", "")
        event_title = event.get("title", event.get("question", "Unknown Event"))
        rejection_reason = None
        qualifies = False
        opportunity = None
        
        try:
            # Get markets (outcomes) within this event
            markets = event.get("markets", [])
            
            if not markets or len(markets) < 2:
                rejection_reason = f"Only {len(markets)} outcomes (need 2+)"
                await self._log_market_scan(
                    scanner_type="polymarket_single",
                    platform="polymarket",
                    market_id=event_id,
                    market_title=f"[EVENT] {event_title}",
                    qualifies=False,
                    rejection_reason=rejection_reason,
                )
                return None
            
            # Sum all outcome prices
            # Each market in event is an outcome with YES price
            outcome_prices = []
            conditions = []
            
            for market in markets:
                # Get YES price for this outcome
                yes_price = None
                
                # Try different price field formats
                outcome_prices_str = market.get("outcomePrices")
                if outcome_prices_str:
                    import json
                    try:
                        prices = json.loads(outcome_prices_str) if isinstance(
                            outcome_prices_str, str
                        ) else outcome_prices_str
                        # First price is YES
                        yes_price = Decimal(str(prices[0]))
                    except (json.JSONDecodeError, IndexError, TypeError):
                        pass
                
                # Fallback to other price fields
                if yes_price is None:
                    yes_price = (
                        market.get("yes_price") or 
                        market.get("lastTradePrice") or 
                        market.get("bestBid")
                    )
                    if yes_price:
                        yes_price = Decimal(str(yes_price))
                
                if yes_price and yes_price > 0:
                    outcome_prices.append(yes_price)
                    conditions.append({
                        "market_id": market.get("conditionId", market.get("id")),
                        "outcome": market.get("question", market.get("outcome", "?")),
                        "yes_price": float(yes_price),
                    })
            
            if len(outcome_prices) < 2:
                rejection_reason = f"Only {len(outcome_prices)} valid prices"
                await self._log_market_scan(
                    scanner_type="polymarket_single",
                    platform="polymarket",
                    market_id=event_id,
                    market_title=f"[EVENT] {event_title}",
                    qualifies=False,
                    rejection_reason=rejection_reason,
                    raw_data={"markets_count": len(markets)},
                )
                return None
            
            # Calculate total - should be $1 for fair pricing
            total_price = sum(outcome_prices)
            total_price_float = float(total_price)
            
            # Multi-outcome arbitrage:
            # If total > $1: outcomes are OVERPRICED (buy NO on all)
            # If total < $1: outcomes are UNDERPRICED (buy YES on all)
            if total_price > Decimal("1.0"):
                profit_pct = (total_price - Decimal("1.0")) * 100
                arb_direction = "BUY_ALL_NO"  # Or sell YES
            elif total_price < Decimal("1.0"):
                profit_pct = (Decimal("1.0") - total_price) * 100
                arb_direction = "BUY_ALL_YES"
            else:
                rejection_reason = "Perfectly balanced (no arb)"
                profit_pct = Decimal("0")
                await self._log_market_scan(
                    scanner_type="polymarket_single",
                    platform="polymarket",
                    market_id=event_id,
                    market_title=f"[EVENT] {event_title}",
                    total_price=total_price_float,
                    spread_pct=0.0,
                    qualifies=False,
                    rejection_reason=rejection_reason,
                )
                return None
            
            profit_pct_float = float(profit_pct)
            
            # Check thresholds
            if profit_pct < self.poly_min_profit:
                rejection_reason = f"Profit {profit_pct:.2f}% < min {self.poly_min_profit}%"
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_rejected"] += 1
            elif profit_pct > self.MAX_PROFIT_PCT:
                rejection_reason = f"Profit {profit_pct:.2f}% > max (bad data?)"
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_rejected"] += 1
            else:
                # 🎯 QUALIFIES FOR TRADE!
                qualifies = True
                opportunity = SinglePlatformOpportunity(
                    id=f"poly_event_{event_id}_{int(datetime.now().timestamp())}",
                    detected_at=datetime.now(timezone.utc),
                    platform="polymarket",
                    arb_type=ArbitrageType.POLYMARKET_SINGLE,
                    market_id=event_id,
                    market_title=f"[EVENT] {event_title}",
                    market_slug=event_slug,
                    conditions=conditions,
                    total_price=total_price,
                    profit_pct=profit_pct,
                    buy_prices=outcome_prices,
                )
                
                # Calculate score
                opp_score = opportunity.calculate_score()
                
                logger.info(
                    f"🎯 POLYMARKET EVENT ARB FOUND: {event_title[:50]}... | "
                    f"Outcomes={len(conditions)} | Total=${total_price:.4f} | "
                    f"Profit={profit_pct:.2f}% | Score={opp_score:.1f}"
                )
            
            # Log scan
            await self._log_market_scan(
                scanner_type="polymarket_single",
                platform="polymarket",
                market_id=event_id,
                market_title=f"[EVENT] {event_title}",
                total_price=total_price_float,
                spread_pct=profit_pct_float,
                qualifies=qualifies,
                rejection_reason=rejection_reason,
                opportunity_id=opportunity.id if opportunity else None,
                raw_data={
                    "outcomes": len(conditions),
                    "direction": arb_direction if qualifies else None,
                },
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error analyzing event {event_id}: {e}")
            await self._log_market_scan(
                scanner_type="polymarket_single",
                platform="polymarket",
                market_id=event_id,
                market_title=f"[EVENT] {event_title}",
                qualifies=False,
                rejection_reason=f"Error: {str(e)}",
            )
            return None
    
    async def fetch_polymarket_market_details(self, condition_id: str) -> Optional[Dict]:
        """Fetch detailed market data including order book"""
        session = await self._get_session()
        
        try:
            url = f"{self.POLYMARKET_API}/markets/{condition_id}"
            async with session.get(url) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            logger.debug(f"Error fetching market {condition_id}: {e}")
        
        return None
    
    async def analyze_polymarket_multi_condition(
        self,
        market: Dict,
    ) -> Optional[SinglePlatformOpportunity]:
        """
        Analyze a Polymarket market for single-platform arbitrage.
        
        Logs ALL markets to database, even if they don't qualify.
        
        For multi-condition markets:
        - If sum of all YES prices > $1 → BUY NO (or sell YES) on all
        - If sum of all YES prices < $1 → BUY YES on all
        """
        market_id = market.get("conditionId") or market.get("condition_id", "unknown")
        market_title = market.get("question", "Unknown")
        
        # Check cooldown first - skip if recently traded
        if self._is_on_cooldown(market_id, "polymarket"):
            self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_on_cooldown"] += 1
            return None  # Skip without logging (reduces noise)
        
        rejection_reason = None
        qualifies = False
        opportunity = None
        total_price_float = None
        profit_pct_float = None
        
        try:
            # Get tokens - gamma-api uses outcomePrices/outcomes strings, clob-api uses tokens array
            tokens = market.get("tokens", [])
            
            # Handle gamma-api format: outcomePrices is JSON string like '["0.55", "0.45"]'
            if not tokens:
                outcome_prices_str = market.get("outcomePrices")
                outcomes_str = market.get("outcomes")
                
                if outcome_prices_str and outcomes_str:
                    import json
                    try:
                        # Parse JSON strings
                        prices = json.loads(outcome_prices_str) if isinstance(outcome_prices_str, str) else outcome_prices_str
                        outcomes = json.loads(outcomes_str) if isinstance(outcomes_str, str) else outcomes_str
                        
                        # Build tokens from parsed data
                        tokens = []
                        clob_ids = market.get("clobTokenIds")
                        if clob_ids and isinstance(clob_ids, str):
                            clob_ids = json.loads(clob_ids)
                        
                        for i, (price, outcome) in enumerate(zip(prices, outcomes)):
                            token_id = clob_ids[i] if clob_ids and i < len(clob_ids) else f"token_{i}"
                            tokens.append({
                                "token_id": token_id,
                                "price": price,
                                "outcome": outcome,
                            })
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.debug(f"Failed to parse gamma-api prices: {e}")
            
            if not tokens:
                rejection_reason = "No tokens/prices found"
                await self._log_market_scan(
                    scanner_type="polymarket_single",
                    platform="polymarket",
                    market_id=market_id,
                    market_title=market_title,
                    qualifies=False,
                    rejection_reason=rejection_reason,
                    raw_data={"tokens_count": 0, "had_outcomePrices": bool(market.get("outcomePrices"))},
                )
                return None
            
            # For binary markets (2 tokens), check if YES + NO ≠ 1
            # For multi-condition (3+ tokens), check if sum of all ≠ 1
            
            yes_prices = []
            conditions = []
            
            for token in tokens:
                price_str = token.get("price")
                if price_str is None:
                    continue
                    
                price = Decimal(str(price_str))
                outcome = token.get("outcome", "YES")
                
                # Only count YES tokens (or first for multi)
                if outcome.upper() == "YES" or len(tokens) > 2:
                    yes_prices.append(price)
                    conditions.append({
                        "token_id": token.get("token_id"),
                        "outcome": outcome,
                        "price": float(price),
                    })
            
            if not yes_prices:
                rejection_reason = "No YES prices found"
                await self._log_market_scan(
                    scanner_type="polymarket_single",
                    platform="polymarket",
                    market_id=market_id,
                    market_title=market_title,
                    qualifies=False,
                    rejection_reason=rejection_reason,
                )
                return None
            
            # Calculate total
            total_price = sum(yes_prices)
            total_price_float = float(total_price)
            
            # Check for arbitrage
            if total_price > Decimal("1.0"):
                profit_pct = (total_price - Decimal("1.0")) * 100
                arb_direction = "BUY_ALL_NO"
            elif total_price < Decimal("1.0"):
                profit_pct = (Decimal("1.0") - total_price) * 100
                arb_direction = "BUY_ALL_YES"
            else:
                rejection_reason = "Perfectly balanced (no arb)"
                profit_pct = Decimal("0")
            
            profit_pct_float = float(profit_pct)
            
            # Filter by per-platform thresholds (Polymarket has ~0% fees)
            if profit_pct < self.poly_min_profit:
                rejection_reason = f"Profit {profit_pct:.2f}% below min {self.poly_min_profit}%"
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_rejected"] += 1
            elif profit_pct > self.MAX_PROFIT_PCT:
                rejection_reason = f"Profit {profit_pct:.2f}% above max (likely bad data)"
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_rejected"] += 1
            else:
                # QUALIFIES! Create opportunity
                qualifies = True
                opportunity = SinglePlatformOpportunity(
                    id=f"poly_single_{market_id}_{int(datetime.now().timestamp())}",
                    detected_at=datetime.now(timezone.utc),
                    platform="polymarket",
                    arb_type=ArbitrageType.POLYMARKET_SINGLE,
                    market_id=market_id,
                    market_title=market_title,
                    market_slug=market.get("slug"),
                    conditions=conditions,
                    total_price=total_price,
                    profit_pct=profit_pct,
                    buy_prices=yes_prices,
                )
                
                # Calculate research-backed opportunity score
                opp_score = opportunity.calculate_score()
                
                logger.info(
                    f"🎯 POLYMARKET SINGLE-PLATFORM ARB: "
                    f"{market_title[:50]}... | "
                    f"Total={total_price:.4f} | "
                    f"Profit={profit_pct:.2f}% | "
                    f"Score={opp_score:.1f} | "
                    f"Conditions={len(conditions)}"
                )
            
            # Log ALL scans to database
            await self._log_market_scan(
                scanner_type="polymarket_single",
                platform="polymarket",
                market_id=market_id,
                market_title=market_title,
                total_price=total_price_float,
                spread_pct=profit_pct_float,
                qualifies=qualifies,
                rejection_reason=rejection_reason,
                opportunity_id=opportunity.id if opportunity else None,
                raw_data={
                    "conditions": conditions,
                    "tokens_count": len(tokens),
                },
            )
            
            return opportunity
            
        except Exception as e:
            logger.debug(f"Error analyzing Polymarket market: {e}")
            await self._log_market_scan(
                scanner_type="polymarket_single",
                platform="polymarket",
                market_id=market_id,
                market_title=market_title,
                qualifies=False,
                rejection_reason=f"Error: {str(e)}",
            )
            return None
    
    async def scan_polymarket(self) -> List[SinglePlatformOpportunity]:
        """
        Scan Polymarket for single-platform arbitrage opportunities.
        
        Scans BOTH:
        1. Binary markets (/markets) - usually no arb (YES+NO=$1)
        2. Events (/events) - THIS IS WHERE THE MONEY IS!
           Multi-outcome markets where prices often sum > $1
        """
        opportunities = []
        self.stats[ArbitrageType.POLYMARKET_SINGLE]["scans"] += 1
        
        # === SCAN EVENTS (Multi-outcome markets - where $40M was extracted!) ===
        events = await self.fetch_polymarket_events()
        logger.info(f"📊 Scanning {len(events)} Polymarket EVENTS (multi-outcome)...")
        
        for event in events:
            opp = await self.analyze_polymarket_event(event)
            if opp:
                opportunities.append(opp)
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["opportunities_found"] += 1
        
        self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_checked"] += len(events)
        
        # === SCAN BINARY MARKETS (less likely to have arb, but check anyway) ===
        markets = await self.fetch_polymarket_markets()
        logger.info(f"📊 Scanning {len(markets)} Polymarket binary markets...")
        
        for market in markets:
            opp = await self.analyze_polymarket_multi_condition(market)
            if opp:
                opportunities.append(opp)
                self.stats[ArbitrageType.POLYMARKET_SINGLE]["opportunities_found"] += 1
        
        self.stats[ArbitrageType.POLYMARKET_SINGLE]["markets_checked"] += len(markets)
        
        logger.info(
            f"🔍 Polymarket scan complete: {len(opportunities)} opportunities "
            f"from {len(events)} events + {len(markets)} binary markets"
        )
        
        return opportunities
    
    # =========================================================================
    # KALSHI SCANNING
    # =========================================================================
    
    async def fetch_kalshi_markets(self) -> List[Dict]:
        """Fetch active markets from Kalshi"""
        session = await self._get_session()
        markets = []
        
        try:
            url = f"{self.KALSHI_API}/markets"
            params = {
                "status": "open",
                "limit": 100,
            }
            
            headers = {
                "Accept": "application/json",
            }
            
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    markets = data.get("markets", [])
                    logger.debug(f"Fetched {len(markets)} Kalshi markets")
                else:
                    logger.warning(f"Kalshi API returned {resp.status}")
        
        except Exception as e:
            logger.error(f"Error fetching Kalshi markets: {e}")
        
        return markets
    
    async def fetch_kalshi_event_markets(self, event_ticker: str) -> List[Dict]:
        """Fetch all markets for a Kalshi event (multi-condition)"""
        session = await self._get_session()
        
        try:
            url = f"{self.KALSHI_API}/events/{event_ticker}/markets"
            headers = {"Accept": "application/json"}
            
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("markets", [])
        except Exception as e:
            logger.debug(f"Error fetching event {event_ticker}: {e}")
        
        return []
    
    async def analyze_kalshi_market(
        self,
        market: Dict,
    ) -> Optional[SinglePlatformOpportunity]:
        """
        Analyze a Kalshi market for single-platform arbitrage.
        
        Logs ALL markets to database, even if they don't qualify.
        
        Kalshi markets are typically binary (YES/NO).
        Arbitrage exists when: yes_price + no_price ≠ $1 (100¢)
        """
        market_id = market.get("ticker", "unknown")
        market_title = market.get("title", "Unknown")
        rejection_reason = None
        qualifies = False
        opportunity = None
        yes_price_float = None
        no_price_float = None
        total_float = None
        profit_pct_float = None
        
        # Check cooldown first - skip if recently traded
        if self._is_on_cooldown(market_id, "kalshi"):
            self.stats[ArbitrageType.KALSHI_SINGLE]["markets_on_cooldown"] += 1
            return None  # Skip without logging (reduces noise)
        
        try:
            yes_ask = market.get("yes_ask")
            no_ask = market.get("no_ask")
            
            # Need both sides
            if yes_ask is None or no_ask is None:
                rejection_reason = "Missing yes_ask or no_ask"
                await self._log_market_scan(
                    scanner_type="kalshi_single",
                    platform="kalshi",
                    market_id=market_id,
                    market_title=market_title,
                    qualifies=False,
                    rejection_reason=rejection_reason,
                )
                return None
            
            # Convert to decimal (Kalshi uses cents)
            yes_price = Decimal(str(yes_ask)) / 100
            no_price = Decimal(str(no_ask)) / 100
            yes_price_float = float(yes_price)
            no_price_float = float(no_price)
            
            total = yes_price + no_price
            total_float = float(total)
            
            # Check for arbitrage
            if total < Decimal("1.0"):
                profit_pct = (Decimal("1.0") - total) * 100
            elif total > Decimal("1.0"):
                profit_pct = (total - Decimal("1.0")) * 100
            else:
                profit_pct = Decimal("0")
                rejection_reason = "Perfectly balanced (no arb)"
            
            profit_pct_float = float(profit_pct)
            
            # Filter by per-platform thresholds (Kalshi has ~7% fees - need higher min!)
            if profit_pct < self.kalshi_min_profit:
                rejection_reason = f"Profit {profit_pct:.2f}% below min {self.kalshi_min_profit}%"
                self.stats[ArbitrageType.KALSHI_SINGLE]["markets_rejected"] += 1
            elif profit_pct > self.MAX_PROFIT_PCT:
                rejection_reason = f"Profit {profit_pct:.2f}% above max"
                self.stats[ArbitrageType.KALSHI_SINGLE]["markets_rejected"] += 1
            else:
                # QUALIFIES!
                qualifies = True
                ts = int(datetime.now().timestamp())
                opportunity = SinglePlatformOpportunity(
                    id=f"kalshi_single_{market_id}_{ts}",
                    detected_at=datetime.now(timezone.utc),
                    platform="kalshi",
                    arb_type=ArbitrageType.KALSHI_SINGLE,
                    market_id=market_id,
                    market_title=market_title,
                    conditions=[
                        {"outcome": "YES", "price": yes_price_float},
                        {"outcome": "NO", "price": no_price_float},
                    ],
                    total_price=total,
                    profit_pct=profit_pct,
                    buy_prices=[yes_price, no_price],
                )
                
                logger.info(
                    f"🎯 KALSHI SINGLE-PLATFORM ARB: "
                    f"{market_title[:60]}... | "
                    f"YES={yes_price:.2f} + NO={no_price:.2f} = {total:.4f} | "
                    f"Profit={profit_pct:.2f}%"
                )
            
            # Log ALL scans to database
            await self._log_market_scan(
                scanner_type="kalshi_single",
                platform="kalshi",
                market_id=market_id,
                market_title=market_title,
                yes_price=yes_price_float,
                no_price=no_price_float,
                total_price=total_float,
                spread_pct=profit_pct_float,
                qualifies=qualifies,
                rejection_reason=rejection_reason,
                opportunity_id=opportunity.id if opportunity else None,
            )
            
            return opportunity
            
        except Exception as e:
            logger.debug(f"Error analyzing Kalshi market: {e}")
            await self._log_market_scan(
                scanner_type="kalshi_single",
                platform="kalshi",
                market_id=market_id,
                market_title=market_title,
                qualifies=False,
                rejection_reason=f"Error: {str(e)}",
            )
            return None
    
    async def scan_kalshi(self) -> List[SinglePlatformOpportunity]:
        """Scan Kalshi for single-platform arbitrage opportunities"""
        opportunities = []
        self.stats[ArbitrageType.KALSHI_SINGLE]["scans"] += 1
        
        markets = await self.fetch_kalshi_markets()
        checked = len(markets)
        self.stats[ArbitrageType.KALSHI_SINGLE]["markets_checked"] += checked
        
        logger.info(f"📊 Scanning {checked} Kalshi markets...")
        
        for market in markets:
            opp = await self.analyze_kalshi_market(market)
            if opp:
                opportunities.append(opp)
                self.stats[ArbitrageType.KALSHI_SINGLE]["opportunities_found"] += 1
        
        return opportunities
    
    # =========================================================================
    # MAIN SCANNING LOOP
    # =========================================================================
    
    async def scan_all(
        self,
        enable_polymarket: bool = True,
        enable_kalshi: bool = True,
    ) -> List[SinglePlatformOpportunity]:
        """
        Scan all enabled platforms for single-platform arbitrage.
        
        Args:
            enable_polymarket: Scan Polymarket
            enable_kalshi: Scan Kalshi
            
        Returns:
            List of opportunities found
        """
        opportunities = []
        
        tasks = []
        if enable_polymarket:
            tasks.append(("polymarket", self.scan_polymarket()))
        if enable_kalshi:
            tasks.append(("kalshi", self.scan_kalshi()))
        
        if not tasks:
            return []
        
        # Run scans in parallel
        results = await asyncio.gather(
            *[t[1] for t in tasks],
            return_exceptions=True
        )
        
        for i, result in enumerate(results):
            platform = tasks[i][0]
            if isinstance(result, Exception):
                logger.error(f"Error scanning {platform}: {result}")
            elif result:
                opportunities.extend(result)
        
        return opportunities
    
    async def run(
        self,
        enable_polymarket: bool = True,
        enable_kalshi: bool = True,
    ):
        """
        Main scanning loop.
        
        Continuously scans for single-platform arbitrage opportunities
        and calls the callback when found.
        """
        self._running = True
        logger.info(
            f"🚀 Single-Platform Scanner started | "
            f"Polymarket={'ON' if enable_polymarket else 'OFF'} (min {self.poly_min_profit}%) | "
            f"Kalshi={'ON' if enable_kalshi else 'OFF'} (min {self.kalshi_min_profit}%)"
        )
        
        while self._running:
            try:
                opportunities = await self.scan_all(
                    enable_polymarket=enable_polymarket,
                    enable_kalshi=enable_kalshi,
                )
                
                if opportunities:
                    logger.info(
                        f"📊 Found {len(opportunities)} single-platform opportunities"
                    )
                    
                    for opp in opportunities:
                        if self.on_opportunity:
                            await self.on_opportunity(opp)
                else:
                    logger.debug("No single-platform opportunities this scan")
                
                await asyncio.sleep(self.scan_interval)
                
            except asyncio.CancelledError:
                logger.info("Single-Platform Scanner cancelled")
                break
            except Exception as e:
                logger.error(f"Error in single-platform scan loop: {e}")
                await asyncio.sleep(self.scan_interval)
        
        await self.close()
        logger.info("Single-Platform Scanner stopped")
    
    def stop(self):
        """Stop the scanner"""
        self._running = False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get scanning statistics"""
        return {
            "polymarket_single": self.stats[ArbitrageType.POLYMARKET_SINGLE],
            "kalshi_single": self.stats[ArbitrageType.KALSHI_SINGLE],
        }
