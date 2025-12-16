"""
Crypto 15-Minute Scalping Strategy

Based on Twitter research (PurpleThunderBicycleMountain, @RetroValix):
- $77K+ profit across 2,584 predictions
- $956 → $208,000 in 3 months (220x return)
- Strategy: Trade BTC/ETH 15-minute Up/Down markets

Key insight: These markets are essentially coin flips with slight edges.
If you can identify when one side is underpriced (< 45¢), you have an edge.

Strategy:
1. Monitor BTC and ETH 15-minute prediction markets
2. When UP or DOWN price ≤ entry threshold (default 45¢), buy
3. Hold until resolution (15 minutes max)
4. Use Kelly Criterion for optimal position sizing
5. High frequency - check every 2-3 seconds

Risk: HIGH - This is essentially gambling with an edge. 
The Twitter sources show some bots lost $3M before profitable tuning.
Start with small positions and validate the edge before scaling.

Expected returns: 50-200% APY (highly variable)
Win rate target: 52-55% (slightly better than coinflip)
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
import aiohttp
import re

logger = logging.getLogger(__name__)


class ScalpDirection(Enum):
    """Direction of the scalp trade"""
    UP = "up"
    DOWN = "down"


class ScalpOutcome(Enum):
    """Outcome of a scalp trade"""
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    EXPIRED = "expired"


@dataclass
class ScalpOpportunity:
    """A 15-minute crypto scalping opportunity"""
    id: str
    detected_at: datetime
    
    # Market info
    market_id: str
    market_title: str
    symbol: str  # BTC, ETH
    direction: ScalpDirection
    expiry: datetime
    
    # Pricing
    entry_price: Decimal  # Current price of the direction we're buying
    opposite_price: Decimal  # Price of opposite direction
    
    # Sizing
    kelly_fraction: float = 0.0
    recommended_size_usd: Decimal = Decimal("0")
    
    # Metadata
    time_to_expiry_minutes: int = 0
    
    def __str__(self) -> str:
        return (
            f"15min Scalp: {self.symbol} {self.direction.value.upper()} "
            f"@ {self.entry_price:.0%} | Expiry: {self.time_to_expiry_minutes}min"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "market_id": self.market_id,
            "market_title": self.market_title,
            "symbol": self.symbol,
            "direction": self.direction.value,
            "entry_price": float(self.entry_price),
            "opposite_price": float(self.opposite_price),
            "kelly_fraction": self.kelly_fraction,
            "recommended_size_usd": float(self.recommended_size_usd),
            "time_to_expiry_minutes": self.time_to_expiry_minutes,
        }


@dataclass
class ScalpTrade:
    """A completed or pending scalp trade"""
    id: str
    created_at: datetime
    
    # Market info
    market_id: str
    market_title: str
    symbol: str
    direction: ScalpDirection
    
    # Trade details
    entry_price: Decimal
    position_size_usd: Decimal
    
    # Outcome
    outcome: ScalpOutcome = ScalpOutcome.PENDING
    exit_price: Optional[Decimal] = None
    profit_usd: Decimal = Decimal("0")
    resolved_at: Optional[datetime] = None


@dataclass
class ScalpingStats:
    """Statistics for the scalping strategy"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    pending_trades: int = 0
    
    total_profit_usd: Decimal = Decimal("0")
    best_trade_usd: Decimal = Decimal("0")
    worst_trade_usd: Decimal = Decimal("0")
    
    btc_trades: int = 0
    eth_trades: int = 0
    
    avg_entry_price: float = 0.0
    
    def win_rate(self) -> float:
        completed = self.winning_trades + self.losing_trades
        if completed == 0:
            return 0.0
        return (self.winning_trades / completed) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "pending_trades": self.pending_trades,
            "win_rate": self.win_rate(),
            "total_profit_usd": float(self.total_profit_usd),
            "best_trade_usd": float(self.best_trade_usd),
            "worst_trade_usd": float(self.worst_trade_usd),
            "btc_trades": self.btc_trades,
            "eth_trades": self.eth_trades,
        }


class Crypto15MinScalpingStrategy:
    """
    High-frequency scalping on 15-minute crypto prediction markets.
    
    Based on successful Twitter traders who made $77K-$208K profits.
    
    Configuration:
    - entry_threshold: Maximum price to enter (default 0.45 = 45¢)
    - max_position_usd: Maximum position size per trade
    - symbols: Which cryptos to trade (BTC, ETH)
    - scan_interval: How often to check (2-3 seconds recommended)
    - use_kelly_sizing: Whether to use Kelly Criterion
    
    Risk Warning: This strategy has HIGH VARIANCE. Some bots lost
    millions before finding profitable parameters. Start small!
    """
    
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    CLOB_API = "https://clob.polymarket.com"
    
    # Pattern to match 15-minute crypto markets
    # Examples: "Will BTC go up in the next 15 minutes?"
    MARKET_PATTERNS = [
        r"(?:will\s+)?(\w+)\s+(?:go\s+)?(up|down)\s+(?:in\s+)?(?:the\s+)?(?:next\s+)?15\s*(?:min|minute)",
        r"(\w+)\s+15\s*(?:min|minute)\s+(up|down)",
        r"(\w+)\s+price\s+(up|down)\s+15\s*(?:min|minute)",
    ]
    
    def __init__(
        self,
        entry_threshold: float = 0.45,  # Buy when price ≤ 45¢
        max_position_usd: float = 50.0,
        min_position_usd: float = 5.0,
        symbols: List[str] = None,
        scan_interval_seconds: int = 2,
        use_kelly_sizing: bool = True,
        kelly_fraction: float = 0.25,  # Quarter Kelly for safety
        assumed_win_rate: float = 0.52,  # Slight edge assumption
        min_time_to_expiry_minutes: int = 2,  # Don't enter < 2 min to expiry
        max_concurrent_trades: int = 5,
        on_opportunity: Optional[Callable] = None,
        on_trade: Optional[Callable] = None,
        db_client=None,
    ):
        self.entry_threshold = Decimal(str(entry_threshold))
        self.max_position = Decimal(str(max_position_usd))
        self.min_position = Decimal(str(min_position_usd))
        self.symbols = [s.upper() for s in (symbols or ["BTC", "ETH"])]
        self.scan_interval = scan_interval_seconds
        self.use_kelly = use_kelly_sizing
        self.kelly_fraction = kelly_fraction
        self.assumed_win_rate = assumed_win_rate
        self.min_time_to_expiry = min_time_to_expiry_minutes
        self.max_concurrent = max_concurrent_trades
        
        self.on_opportunity = on_opportunity
        self.on_trade = on_trade
        self.db = db_client
        
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Track active trades to avoid duplicates
        self._active_trades: Dict[str, ScalpTrade] = {}
        self._recent_markets: Dict[str, datetime] = {}  # Cooldown tracking
        
        self.stats = ScalpingStats()
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=10)
            )
        return self._session
    
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    def _parse_market_info(self, market: Dict) -> Optional[Tuple[str, ScalpDirection]]:
        """
        Parse market title to extract symbol and direction.
        Returns (symbol, direction) or None if not a 15-min crypto market.
        """
        title = market.get("question", "") or market.get("title", "")
        title_lower = title.lower()
        
        # Check if it's a 15-minute market
        if "15" not in title_lower or ("min" not in title_lower and "minute" not in title_lower):
            return None
        
        # Check for our symbols
        for symbol in self.symbols:
            if symbol.lower() in title_lower:
                # Determine direction
                if "up" in title_lower:
                    return (symbol, ScalpDirection.UP)
                elif "down" in title_lower:
                    return (symbol, ScalpDirection.DOWN)
        
        return None
    
    def _calculate_kelly(self, win_prob: float, odds: float) -> float:
        """
        Calculate Kelly Criterion fraction.
        
        Kelly = (bp - q) / b
        where:
        - b = odds received (net odds, e.g., 1.2 for 45¢ → $1)
        - p = probability of winning
        - q = probability of losing (1 - p)
        """
        if win_prob <= 0 or win_prob >= 1 or odds <= 0:
            return 0.0
        
        b = odds
        p = win_prob
        q = 1 - p
        
        kelly = (b * p - q) / b
        
        # Apply fractional Kelly for safety
        kelly *= self.kelly_fraction
        
        # Cap at reasonable maximum
        return max(0, min(kelly, 0.15))  # Max 15% of bankroll
    
    def _calculate_position_size(
        self,
        entry_price: Decimal,
        bankroll: Decimal,
    ) -> Decimal:
        """Calculate position size based on Kelly or fixed sizing."""
        if self.use_kelly:
            # Calculate implied odds
            # If we buy at 45¢ and win, we get $1 - profit of 55¢
            # Odds = profit / stake = 0.55 / 0.45 = 1.22
            profit_if_win = Decimal("1.0") - entry_price
            odds = float(profit_if_win / entry_price) if entry_price > 0 else 0
            
            kelly = self._calculate_kelly(self.assumed_win_rate, odds)
            position = bankroll * Decimal(str(kelly))
        else:
            position = self.max_position
        
        # Apply limits
        position = max(self.min_position, min(position, self.max_position))
        
        return position.quantize(Decimal("0.01"))
    
    async def fetch_15min_markets(self) -> List[Dict]:
        """Fetch active 15-minute crypto markets from Polymarket."""
        session = await self._get_session()
        markets = []
        
        try:
            # Search for 15-minute markets
            for symbol in self.symbols:
                url = f"{self.POLYMARKET_API}/markets"
                params = {
                    "closed": "false",
                    "limit": 50,
                    # Note: API might not support text search, so we fetch and filter
                }
                
                async with session.get(url, params=params) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        all_markets = data if isinstance(data, list) else data.get("markets", [])
                        
                        for market in all_markets:
                            parsed = self._parse_market_info(market)
                            if parsed and parsed[0] == symbol:
                                market["_parsed_symbol"] = parsed[0]
                                market["_parsed_direction"] = parsed[1]
                                markets.append(market)
                    
                    # Rate limiting
                    await asyncio.sleep(0.5)
        
        except Exception as e:
            logger.error(f"Error fetching 15-min markets: {e}")
        
        return markets
    
    async def analyze_market(
        self,
        market: Dict,
        current_bankroll: Decimal = Decimal("1000"),
    ) -> Optional[ScalpOpportunity]:
        """
        Analyze a 15-minute market for scalping opportunity.
        
        Returns opportunity if entry criteria met, None otherwise.
        """
        market_id = market.get("id") or market.get("condition_id")
        if not market_id:
            return None
        
        # Check cooldown (don't trade same market twice)
        if market_id in self._recent_markets:
            last_trade = self._recent_markets[market_id]
            if datetime.now(timezone.utc) - last_trade < timedelta(minutes=20):
                return None
        
        # Check if already have active trade
        if len(self._active_trades) >= self.max_concurrent:
            return None
        
        parsed = self._parse_market_info(market)
        if not parsed:
            return None
        
        symbol, direction = parsed
        
        # Get current prices
        # Polymarket uses "tokens" array with outcomes
        tokens = market.get("tokens", [])
        if not tokens:
            return None
        
        # Find the token matching our direction
        entry_price = None
        opposite_price = None
        
        for token in tokens:
            outcome = (token.get("outcome") or "").lower()
            price = Decimal(str(token.get("price", 0.5)))
            
            if direction == ScalpDirection.UP and outcome in ["yes", "up"]:
                entry_price = price
            elif direction == ScalpDirection.UP and outcome in ["no", "down"]:
                opposite_price = price
            elif direction == ScalpDirection.DOWN and outcome in ["yes", "down"]:
                entry_price = price
            elif direction == ScalpDirection.DOWN and outcome in ["no", "up"]:
                opposite_price = price
        
        if entry_price is None:
            return None
        
        # Check entry threshold
        if entry_price > self.entry_threshold:
            return None
        
        # Calculate time to expiry
        end_date_str = market.get("end_date") or market.get("endDate")
        if end_date_str:
            try:
                expiry = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                time_to_expiry = (expiry - datetime.now(timezone.utc)).total_seconds() / 60
            except:
                time_to_expiry = 15  # Assume 15 minutes
        else:
            time_to_expiry = 15
            expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
        
        # Don't enter if too close to expiry
        if time_to_expiry < self.min_time_to_expiry:
            return None
        
        # Calculate position size
        recommended_size = self._calculate_position_size(entry_price, current_bankroll)
        
        # Calculate Kelly fraction for reference
        profit_if_win = Decimal("1.0") - entry_price
        odds = float(profit_if_win / entry_price) if entry_price > 0 else 0
        kelly = self._calculate_kelly(self.assumed_win_rate, odds)
        
        opp_id = f"SCALP-{symbol}-{direction.value}-{datetime.now(timezone.utc).strftime('%H%M%S')}"
        
        return ScalpOpportunity(
            id=opp_id,
            detected_at=datetime.now(timezone.utc),
            market_id=market_id,
            market_title=market.get("question", market.get("title", "")),
            symbol=symbol,
            direction=direction,
            expiry=expiry,
            entry_price=entry_price,
            opposite_price=opposite_price or (Decimal("1.0") - entry_price),
            kelly_fraction=kelly,
            recommended_size_usd=recommended_size,
            time_to_expiry_minutes=int(time_to_expiry),
        )
    
    async def scan_for_opportunities(
        self,
        current_bankroll: Decimal = Decimal("1000"),
    ) -> List[ScalpOpportunity]:
        """Scan all 15-minute markets for scalping opportunities."""
        opportunities = []
        
        markets = await self.fetch_15min_markets()
        logger.debug(f"Found {len(markets)} potential 15-min markets")
        
        for market in markets:
            opp = await self.analyze_market(market, current_bankroll)
            if opp:
                opportunities.append(opp)
                logger.info(f"🎯 Scalp opportunity: {opp}")
        
        # Sort by entry price (lower = better)
        opportunities.sort(key=lambda x: x.entry_price)
        
        return opportunities
    
    async def record_trade(self, trade: ScalpTrade):
        """Record a trade to the database."""
        if not self.db:
            return
        
        try:
            await self.db.client.table("polybot_scalp_trades").upsert({
                "id": trade.id,
                "market_id": trade.market_id,
                "symbol": trade.symbol,
                "direction": trade.direction.value,
                "entry_price": float(trade.entry_price),
                "position_size_usd": float(trade.position_size_usd),
                "outcome": trade.outcome.value,
                "profit_usd": float(trade.profit_usd),
                "created_at": trade.created_at.isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"Error recording scalp trade: {e}")
    
    async def run(self, get_bankroll: Optional[Callable] = None):
        """
        Run continuous scanning for scalping opportunities.
        
        Args:
            get_bankroll: Optional callback to get current bankroll
        """
        self._running = True
        logger.info(
            f"🎰 Starting 15-Min Crypto Scalping Strategy\n"
            f"   Symbols: {', '.join(self.symbols)}\n"
            f"   Entry threshold: ≤{self.entry_threshold:.0%}\n"
            f"   Scan interval: {self.scan_interval}s\n"
            f"   Max position: ${self.max_position}"
        )
        
        scan_count = 0
        
        while self._running:
            try:
                # Get current bankroll
                bankroll = Decimal("1000")
                if get_bankroll:
                    try:
                        bankroll = Decimal(str(await get_bankroll()))
                    except:
                        pass
                
                # Scan for opportunities
                opportunities = await self.scan_for_opportunities(bankroll)
                
                # Process opportunities
                for opp in opportunities:
                    # Callback for execution
                    if self.on_opportunity:
                        await self.on_opportunity(opp)
                    
                    # Mark market as recently traded
                    self._recent_markets[opp.market_id] = datetime.now(timezone.utc)
                    
                    # Update stats
                    self.stats.total_trades += 1
                    self.stats.pending_trades += 1
                    if opp.symbol == "BTC":
                        self.stats.btc_trades += 1
                    elif opp.symbol == "ETH":
                        self.stats.eth_trades += 1
                
                scan_count += 1
                
                # Log periodic summary
                if scan_count % 100 == 0:
                    logger.info(
                        f"📊 Scalping stats: {self.stats.total_trades} trades, "
                        f"{self.stats.win_rate():.1f}% win rate, "
                        f"${self.stats.total_profit_usd:.2f} P&L"
                    )
                
                await asyncio.sleep(self.scan_interval)
                
            except Exception as e:
                logger.error(f"Error in scalping scan: {e}")
                await asyncio.sleep(self.scan_interval * 2)
        
        await self.close()
    
    def stop(self):
        """Stop the strategy."""
        self._running = False
        logger.info("🛑 Stopping 15-Min Crypto Scalping Strategy")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics."""
        return self.stats.to_dict()


# Strategy info for UI display
CRYPTO_15MIN_SCALPING_INFO = {
    "id": "crypto_15min_scalping",
    "name": "15-Min Crypto Scalping",
    "confidence": 65,
    "expected_apy": "50-200%",
    "risk_level": "high",
    "description": (
        "High-frequency scalping on 15-minute BTC/ETH prediction markets. "
        "Based on Twitter traders who turned $956 into $208K. "
        "Trades when UP or DOWN price drops below threshold."
    ),
    "key_points": [
        "Buy when price ≤ 45¢ (configurable)",
        "Hold until 15-minute resolution",
        "Kelly Criterion position sizing",
        "High frequency - scans every 2-3 seconds",
        "Conservative defaults - start with small positions",
    ],
    "twitter_sources": [
        "@RetroValix - $956→$208K (220x)",
        "PurpleThunderBicycleMountain - $77K profit",
        "Anonymous bot - $74K in 10 days",
    ],
    "warnings": [
        "HIGH RISK - Some bots lost $3M before profitable",
        "High variance - Can have long losing streaks",
        "Start with minimum positions to validate edge",
    ],
}
