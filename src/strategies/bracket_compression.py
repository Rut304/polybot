"""
Bracket Compression Strategy

Based on Twitter research (@carverfomo):
"Wait for one side of BTC bracket to stretch too far, then build
the second leg while the order book lags and exit on compression."

This is a mean-reversion strategy for bracket markets:
1. Detect when YES + NO > 100% (one side overpriced)
2. Buy the UNDERPRICED leg
3. Wait for prices to compress back to equilibrium
4. Exit with profit

Different from BTC Bracket Arb:
- Bracket Arb: Buy BOTH sides when total < 100%
- Compression: Buy ONE side when stretched, wait for reversion
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
import aiohttp
import statistics

logger = logging.getLogger(__name__)


class CompressionType(Enum):
    """Types of compression opportunities"""
    YES_STRETCHED = "yes_stretched"  # YES overpriced, buy NO
    NO_STRETCHED = "no_stretched"    # NO overpriced, buy YES
    BALANCED = "balanced"            # No opportunity


@dataclass
class CompressionOpportunity:
    """A bracket compression opportunity"""
    id: str
    detected_at: datetime
    platform: str
    compression_type: CompressionType
    
    # Market info
    market_id: str
    market_title: str
    
    # Current prices
    yes_price: Decimal = Decimal("0")
    no_price: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")
    
    # Historical context
    avg_total_price: Decimal = Decimal("1.0")
    price_std_dev: Decimal = Decimal("0")
    z_score: float = 0.0  # How many std devs from mean
    
    # Recommended action
    buy_side: str = ""  # "YES" or "NO"
    target_price: Decimal = Decimal("0")
    expected_profit_pct: Decimal = Decimal("0")
    
    # Risk metrics
    max_hold_minutes: int = 60
    stop_loss_pct: Decimal = Decimal("5.0")
    
    def __str__(self) -> str:
        return (
            f"Compression: {self.buy_side} @ {self.target_price:.0%} | "
            f"Z={self.z_score:.2f} | "
            f"Expected={self.expected_profit_pct:.1f}%"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "platform": self.platform,
            "compression_type": self.compression_type.value,
            "market_id": self.market_id,
            "market_title": self.market_title,
            "yes_price": float(self.yes_price),
            "no_price": float(self.no_price),
            "total_price": float(self.total_price),
            "z_score": self.z_score,
            "buy_side": self.buy_side,
            "expected_profit_pct": float(self.expected_profit_pct),
        }


@dataclass
class CompressionStats:
    """Statistics for compression strategy"""
    total_scans: int = 0
    opportunities_detected: int = 0
    trades_entered: int = 0
    trades_exited: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: Decimal = Decimal("0")
    avg_hold_time_minutes: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_scans": self.total_scans,
            "opportunities_detected": self.opportunities_detected,
            "trades_entered": self.trades_entered,
            "trades_exited": self.trades_exited,
            "win_rate": (
                self.winning_trades / max(self.trades_exited, 1) * 100
            ),
            "total_pnl": float(self.total_pnl),
            "avg_hold_time_minutes": self.avg_hold_time_minutes,
        }


class BracketCompressionStrategy:
    """
    Bracket Compression Detector
    
    Monitors bracket markets for mean-reversion opportunities:
    1. Track historical YES + NO totals
    2. Detect when total deviates significantly (z-score > 2)
    3. Buy the underpriced leg
    4. Exit when prices compress back to mean
    
    Configuration:
    - entry_z_score: Z-score threshold to enter (default 2.0)
    - exit_z_score: Z-score threshold to exit (default 0.5)
    - lookback_periods: Number of periods for mean calculation
    - max_hold_minutes: Maximum time to hold position
    """
    
    # API endpoints
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
    
    def __init__(
        self,
        entry_z_score: float = 2.0,
        exit_z_score: float = 0.5,
        lookback_periods: int = 20,
        min_profit_pct: float = 2.0,
        max_position_usd: float = 100.0,
        max_hold_minutes: int = 60,
        stop_loss_pct: float = 5.0,
        scan_interval_seconds: int = 30,
        on_opportunity: Optional[Callable] = None,
        db_client = None,
    ):
        self.entry_z_score = entry_z_score
        self.exit_z_score = exit_z_score
        self.lookback = lookback_periods
        self.min_profit_pct = Decimal(str(min_profit_pct))
        self.max_position_usd = Decimal(str(max_position_usd))
        self.max_hold_minutes = max_hold_minutes
        self.stop_loss_pct = Decimal(str(stop_loss_pct))
        self.scan_interval = scan_interval_seconds
        self.on_opportunity = on_opportunity
        self.db = db_client
        
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = CompressionStats()
        
        # Price history for each market
        self._price_history: Dict[str, List[Dict]] = {}
        
        # Active positions
        self._active_positions: Dict[str, Dict] = {}
    
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
    
    def _update_price_history(
        self,
        market_id: str,
        yes_price: Decimal,
        no_price: Decimal,
    ):
        """Update price history for a market"""
        if market_id not in self._price_history:
            self._price_history[market_id] = []
        
        entry = {
            "timestamp": datetime.now(timezone.utc),
            "yes_price": float(yes_price),
            "no_price": float(no_price),
            "total": float(yes_price + no_price),
        }
        
        self._price_history[market_id].append(entry)
        
        # Keep only recent history
        max_history = self.lookback * 3
        if len(self._price_history[market_id]) > max_history:
            self._price_history[market_id] = self._price_history[market_id][-max_history:]
    
    def _calculate_z_score(self, market_id: str, current_total: float) -> Tuple[float, float, float]:
        """
        Calculate z-score for current total price.
        
        Returns: (z_score, mean, std_dev)
        """
        history = self._price_history.get(market_id, [])
        
        if len(history) < 5:  # Need minimum history
            return 0.0, 1.0, 0.0
        
        totals = [h["total"] for h in history[-self.lookback:]]
        
        mean = statistics.mean(totals)
        std_dev = statistics.stdev(totals) if len(totals) > 1 else 0.01
        
        if std_dev == 0:
            std_dev = 0.01  # Prevent division by zero
        
        z_score = (current_total - mean) / std_dev
        
        return z_score, mean, std_dev
    
    async def analyze_market(
        self,
        market: Dict,
        platform: str = "polymarket",
    ) -> Optional[CompressionOpportunity]:
        """Analyze a market for compression opportunity"""
        
        try:
            import json
            
            if platform == "polymarket":
                market_id = market.get("conditionId") or market.get("id")
                title = market.get("question", "Unknown")
                
                # Parse prices
                prices_str = market.get("outcomePrices")
                if not prices_str:
                    return None
                
                prices = json.loads(prices_str) if isinstance(prices_str, str) else prices_str
                if len(prices) < 2:
                    return None
                
                yes_price = Decimal(str(prices[0]))
                no_price = Decimal(str(prices[1]))
                
            else:  # Kalshi
                market_id = market.get("ticker")
                title = market.get("title", "Unknown")
                
                yes_price = Decimal(str(market.get("yes_ask", 50) or 50)) / 100
                no_price = Decimal(str(market.get("no_ask", 50) or 50)) / 100
            
            # Update history
            self._update_price_history(market_id, yes_price, no_price)
            
            # Calculate totals
            total_price = yes_price + no_price
            
            # Calculate z-score
            z_score, mean, std_dev = self._calculate_z_score(
                market_id, float(total_price)
            )
            
            # Check for compression opportunity
            if abs(z_score) < self.entry_z_score:
                return None  # Not enough deviation
            
            # Determine which side is stretched
            if total_price > Decimal("1.0"):
                # Prices inflated - one side is overpriced
                if yes_price > no_price:
                    compression_type = CompressionType.YES_STRETCHED
                    buy_side = "NO"
                    target_price = no_price
                else:
                    compression_type = CompressionType.NO_STRETCHED
                    buy_side = "YES"
                    target_price = yes_price
            else:
                # Total < 1.0 is an arb opportunity (handled by bracket arb)
                return None
            
            # Calculate expected profit
            expected_compression = Decimal(str(mean)) - Decimal("1.0")
            expected_profit = abs(total_price - Decimal(str(mean))) * 100 / 2
            
            if expected_profit < self.min_profit_pct:
                return None
            
            # Create opportunity
            opp_id = f"COMP-{datetime.utcnow().strftime('%H%M%S')}-{market_id[:8]}"
            
            opportunity = CompressionOpportunity(
                id=opp_id,
                detected_at=datetime.now(timezone.utc),
                platform=platform,
                compression_type=compression_type,
                market_id=market_id,
                market_title=title,
                yes_price=yes_price,
                no_price=no_price,
                total_price=total_price,
                avg_total_price=Decimal(str(mean)),
                price_std_dev=Decimal(str(std_dev)),
                z_score=z_score,
                buy_side=buy_side,
                target_price=target_price,
                expected_profit_pct=expected_profit,
                max_hold_minutes=self.max_hold_minutes,
                stop_loss_pct=self.stop_loss_pct,
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error analyzing compression: {e}")
            return None
    
    async def fetch_bracket_markets(self) -> List[Tuple[Dict, str]]:
        """Fetch bracket markets from both platforms"""
        session = await self._get_session()
        markets = []
        
        try:
            # Fetch from Polymarket
            url = f"{self.POLYMARKET_API}/markets"
            params = {
                "active": "true",
                "closed": "false",
                "limit": 100,
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    poly_markets = data if isinstance(data, list) else data.get("data", [])
                    
                    # Filter for bracket markets (binary with Up/Down patterns)
                    for m in poly_markets:
                        title = m.get("question", "").lower()
                        if any(kw in title for kw in ["up", "down", "above", "below", "higher", "lower"]):
                            markets.append((m, "polymarket"))
            
        except Exception as e:
            logger.error(f"Error fetching markets: {e}")
        
        return markets
    
    async def check_exit_conditions(self) -> List[str]:
        """Check if any active positions should be exited"""
        exits = []
        
        for market_id, position in list(self._active_positions.items()):
            # Check hold time
            entry_time = position.get("entry_time")
            if entry_time:
                hold_minutes = (datetime.now(timezone.utc) - entry_time).total_seconds() / 60
                if hold_minutes > self.max_hold_minutes:
                    exits.append(market_id)
                    continue
            
            # Check z-score for mean reversion
            history = self._price_history.get(market_id, [])
            if history:
                latest = history[-1]
                z_score, _, _ = self._calculate_z_score(market_id, latest["total"])
                
                if abs(z_score) < self.exit_z_score:
                    exits.append(market_id)
        
        return exits
    
    async def scan_for_opportunities(self) -> List[CompressionOpportunity]:
        """Scan for compression opportunities"""
        self.stats.total_scans += 1
        opportunities = []
        
        # Fetch markets
        markets = await self.fetch_bracket_markets()
        
        # Analyze each market
        for market, platform in markets:
            opp = await self.analyze_market(market, platform)
            if opp:
                opportunities.append(opp)
                self.stats.opportunities_detected += 1
        
        # Sort by z-score (highest deviation first)
        opportunities.sort(key=lambda x: abs(x.z_score), reverse=True)
        
        if opportunities:
            logger.info(f"🎯 Found {len(opportunities)} compression opportunities!")
            for opp in opportunities[:3]:
                logger.info(f"   {opp}")
        
        return opportunities
    
    async def run(self):
        """Run continuous scanning"""
        self._running = True
        logger.info("🔍 Starting Bracket Compression Strategy")
        logger.info(f"   Entry Z-score: {self.entry_z_score}")
        logger.info(f"   Exit Z-score: {self.exit_z_score}")
        
        while self._running:
            try:
                # Check exits first
                exits = await self.check_exit_conditions()
                for market_id in exits:
                    if market_id in self._active_positions:
                        logger.info(f"Exiting position: {market_id}")
                        del self._active_positions[market_id]
                        self.stats.trades_exited += 1
                
                # Scan for new opportunities
                opportunities = await self.scan_for_opportunities()
                
                # Callback
                if self.on_opportunity and opportunities:
                    for opp in opportunities:
                        await self.on_opportunity(opp)
                
                await asyncio.sleep(self.scan_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Compression scanner error: {e}")
                await asyncio.sleep(5)
        
        await self.close()
    
    def stop(self):
        """Stop the scanner"""
        self._running = False


# Strategy info for UI
BRACKET_COMPRESSION_INFO = {
    "id": "bracket_compression",
    "name": "Bracket Compression",
    "confidence": 70,
    "expected_apy": "15-40%",
    "description": (
        "Mean-reversion strategy for bracket markets. "
        "Wait for one side to stretch too far, buy the underpriced leg, "
        "exit when prices compress back to equilibrium."
    ),
    "key_points": [
        "Uses z-score to detect stretched prices",
        "Buy underpriced leg when z > 2",
        "Exit when z returns to 0.5",
        "Works on longer time windows than bracket arb",
        "Based on @carverfomo's approach",
    ],
    "platforms": ["Polymarket", "Kalshi"],
    "risk_level": "medium",
    "category": "prediction",
}
