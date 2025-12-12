"""
Macro Board Strategy

Based on Twitter research (@carverfomo - ArmageddonRewardsBilly):
"$62,856 pulled in the last month without chasing headlines.
Heavy macro board: US rates, Treasuries, elections, Trump approvals, MicroStrategy.
$1.7M in active exposure. Biggest single hit - $317K."

Strategy:
1. Focus on high-conviction macro themes
2. Build large positions in correlated markets
3. Don't chase headlines - stick to thesis
4. Use portfolio approach (multiple related markets)

Key Categories:
- Interest Rates / Fed Policy
- Treasury / Bond Markets  
- Elections / Politics
- Crypto-adjacent (MSTR, BTC ETF)
- Geopolitical Events
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import aiohttp
import re

logger = logging.getLogger(__name__)


class MacroCategory(Enum):
    """Macro market categories"""
    INTEREST_RATES = "interest_rates"
    TREASURIES = "treasuries"
    ELECTIONS = "elections"
    APPROVALS = "approvals"
    CRYPTO_ADJACENT = "crypto_adjacent"
    GEOPOLITICAL = "geopolitical"
    ECONOMIC = "economic"
    OTHER = "other"


@dataclass
class MacroTheme:
    """A macro trading theme"""
    id: str
    name: str
    category: MacroCategory
    
    # Thesis
    thesis: str
    direction: str  # "bullish", "bearish", "neutral"
    conviction: float  # 0-100
    
    # Markets in this theme
    market_ids: List[str] = field(default_factory=list)
    market_titles: List[str] = field(default_factory=list)
    
    # Position
    total_exposure_usd: Decimal = Decimal("0")
    target_exposure_usd: Decimal = Decimal("0")
    
    # Keywords to match markets
    keywords: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category.value,
            "thesis": self.thesis,
            "direction": self.direction,
            "conviction": self.conviction,
            "market_count": len(self.market_ids),
            "total_exposure_usd": float(self.total_exposure_usd),
            "target_exposure_usd": float(self.target_exposure_usd),
        }


@dataclass
class MacroOpportunity:
    """A macro trading opportunity"""
    id: str
    detected_at: datetime
    
    # Theme
    theme_id: str
    theme_name: str
    category: MacroCategory
    
    # Market info
    platform: str
    market_id: str
    market_title: str
    
    # Opportunity
    current_price: Decimal
    fair_value: Decimal  # Based on thesis
    edge_pct: Decimal
    
    # Action
    recommended_side: str  # "YES" or "NO"
    recommended_size_usd: Decimal
    conviction: float
    
    def __str__(self) -> str:
        return (
            f"Macro: {self.theme_name} | {self.market_title[:40]} | "
            f"{self.recommended_side} @ {self.current_price:.0%} | "
            f"Edge: {self.edge_pct:.1f}%"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "detected_at": self.detected_at.isoformat(),
            "theme_id": self.theme_id,
            "theme_name": self.theme_name,
            "category": self.category.value,
            "platform": self.platform,
            "market_id": self.market_id,
            "market_title": self.market_title,
            "current_price": float(self.current_price),
            "fair_value": float(self.fair_value),
            "edge_pct": float(self.edge_pct),
            "recommended_side": self.recommended_side,
            "recommended_size_usd": float(self.recommended_size_usd),
            "conviction": self.conviction,
        }


@dataclass
class MacroBoardStats:
    """Statistics for macro board strategy"""
    themes_active: int = 0
    markets_tracked: int = 0
    total_exposure_usd: Decimal = Decimal("0")
    opportunities_found: int = 0
    positions_entered: int = 0
    total_pnl: Decimal = Decimal("0")
    best_theme_pnl: Decimal = Decimal("0")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "themes_active": self.themes_active,
            "markets_tracked": self.markets_tracked,
            "total_exposure_usd": float(self.total_exposure_usd),
            "opportunities_found": self.opportunities_found,
            "positions_entered": self.positions_entered,
            "total_pnl": float(self.total_pnl),
        }


# Default macro themes (configurable)
DEFAULT_MACRO_THEMES = [
    MacroTheme(
        id="fed_rates",
        name="Fed Interest Rates",
        category=MacroCategory.INTEREST_RATES,
        thesis="Fed likely to cut rates in 2025 due to slowing inflation",
        direction="bullish",  # Bullish on rate cuts
        conviction=75,
        keywords=["fed", "interest rate", "fomc", "rate cut", "rate hike", "powell"],
        target_exposure_usd=Decimal("5000"),
    ),
    MacroTheme(
        id="trump_approval",
        name="Trump Approval Ratings",
        category=MacroCategory.APPROVALS,
        thesis="Trump approval likely to remain in 45-50% range",
        direction="neutral",
        conviction=70,
        keywords=["trump approval", "approval rating", "favorable"],
        target_exposure_usd=Decimal("3000"),
    ),
    MacroTheme(
        id="mstr_btc",
        name="MicroStrategy & BTC",
        category=MacroCategory.CRYPTO_ADJACENT,
        thesis="MSTR correlated with BTC, likely volatility",
        direction="bullish",
        conviction=65,
        keywords=["microstrategy", "mstr", "saylor", "btc etf", "bitcoin etf"],
        target_exposure_usd=Decimal("4000"),
    ),
    MacroTheme(
        id="elections_2026",
        name="2026 Elections",
        category=MacroCategory.ELECTIONS,
        thesis="Early positioning for midterm elections",
        direction="neutral",
        conviction=60,
        keywords=["senate", "congress", "midterm", "2026 election"],
        target_exposure_usd=Decimal("2000"),
    ),
    MacroTheme(
        id="ukraine_russia",
        name="Ukraine-Russia Conflict",
        category=MacroCategory.GEOPOLITICAL,
        thesis="Conflict likely to continue through 2025",
        direction="bearish",  # On peace
        conviction=70,
        keywords=["ukraine", "russia", "zelensky", "putin", "ceasefire"],
        target_exposure_usd=Decimal("3000"),
    ),
    MacroTheme(
        id="recession",
        name="US Recession",
        category=MacroCategory.ECONOMIC,
        thesis="Soft landing more likely than recession in 2025",
        direction="bearish",  # On recession
        conviction=65,
        keywords=["recession", "gdp", "unemployment", "economic", "downturn"],
        target_exposure_usd=Decimal("4000"),
    ),
]


class MacroBoardStrategy:
    """
    Macro Board Strategy
    
    Build a portfolio of positions across related macro themes:
    1. Define macro themes (Fed, elections, crypto, etc.)
    2. Find markets matching each theme
    3. Size positions based on conviction
    4. Manage as a portfolio, not individual trades
    
    Configuration:
    - themes: List of MacroTheme objects
    - max_theme_exposure: Max exposure per theme
    - max_total_exposure: Max total portfolio exposure
    - min_edge_pct: Minimum edge to enter position
    """
    
    POLYMARKET_API = "https://gamma-api.polymarket.com"
    KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2"
    
    def __init__(
        self,
        themes: Optional[List[MacroTheme]] = None,
        max_theme_exposure_usd: float = 10000.0,
        max_total_exposure_usd: float = 50000.0,
        min_edge_pct: float = 5.0,
        position_size_pct: float = 2.0,  # % of target per position
        scan_interval_seconds: int = 300,  # 5 minutes
        on_opportunity: Optional[Callable] = None,
        db_client = None,
    ):
        self.themes = themes or DEFAULT_MACRO_THEMES.copy()
        self.max_theme_exposure = Decimal(str(max_theme_exposure_usd))
        self.max_total_exposure = Decimal(str(max_total_exposure_usd))
        self.min_edge_pct = Decimal(str(min_edge_pct))
        self.position_size_pct = Decimal(str(position_size_pct))
        self.scan_interval = scan_interval_seconds
        self.on_opportunity = on_opportunity
        self.db = db_client
        
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        self.stats = MacroBoardStats()
        
        # Theme lookup
        self._themes_by_id: Dict[str, MacroTheme] = {
            t.id: t for t in self.themes
        }
        
        # Market to theme mapping
        self._market_themes: Dict[str, str] = {}
    
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
    
    def _match_theme(self, title: str) -> Optional[MacroTheme]:
        """Match a market title to a macro theme"""
        title_lower = title.lower()
        
        best_match = None
        best_score = 0
        
        for theme in self.themes:
            score = 0
            for keyword in theme.keywords:
                if keyword.lower() in title_lower:
                    score += len(keyword)  # Longer keywords = stronger match
            
            if score > best_score:
                best_score = score
                best_match = theme
        
        return best_match if best_score > 0 else None
    
    async def fetch_macro_markets(self) -> List[Dict]:
        """Fetch markets matching macro themes"""
        session = await self._get_session()
        matched_markets = []
        
        try:
            # Fetch from Polymarket
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
                    
                    for market in markets:
                        title = market.get("question", "")
                        theme = self._match_theme(title)
                        
                        if theme:
                            market["_theme"] = theme
                            market["_platform"] = "polymarket"
                            matched_markets.append(market)
                            
                            # Track mapping
                            market_id = market.get("conditionId") or market.get("id")
                            self._market_themes[market_id] = theme.id
                            
                            # Add to theme
                            if market_id not in theme.market_ids:
                                theme.market_ids.append(market_id)
                                theme.market_titles.append(title)
            
            logger.info(f"Found {len(matched_markets)} macro-relevant markets")
            
        except Exception as e:
            logger.error(f"Error fetching macro markets: {e}")
        
        return matched_markets
    
    def calculate_fair_value(
        self,
        theme: MacroTheme,
        market_title: str,
        current_price: Decimal,
    ) -> Decimal:
        """
        Calculate fair value based on theme thesis.
        
        This is simplified - in production you'd use more
        sophisticated models based on thesis analysis.
        """
        # Base fair value on conviction and direction
        base = Decimal("0.5")
        
        if theme.direction == "bullish":
            # Bullish on YES
            adjustment = Decimal(str(theme.conviction / 200))  # Up to +0.5
            fair = base + adjustment
        elif theme.direction == "bearish":
            # Bearish on YES (bullish on NO)
            adjustment = Decimal(str(theme.conviction / 200))
            fair = base - adjustment
        else:
            # Neutral - fair value close to current
            fair = current_price
        
        # Clamp to valid range
        fair = max(Decimal("0.10"), min(fair, Decimal("0.90")))
        
        return fair
    
    async def analyze_market(
        self,
        market: Dict,
    ) -> Optional[MacroOpportunity]:
        """Analyze a macro market for opportunity"""
        
        try:
            import json
            
            theme = market.get("_theme")
            platform = market.get("_platform", "polymarket")
            
            if not theme:
                return None
            
            market_id = market.get("conditionId") or market.get("id")
            title = market.get("question", "Unknown")
            
            # Get current price
            prices_str = market.get("outcomePrices")
            if not prices_str:
                return None
            
            prices = json.loads(prices_str) if isinstance(prices_str, str) else prices_str
            if not prices:
                return None
            
            current_price = Decimal(str(prices[0]))
            
            # Calculate fair value
            fair_value = self.calculate_fair_value(theme, title, current_price)
            
            # Calculate edge
            edge = abs(fair_value - current_price) * 100
            
            if edge < self.min_edge_pct:
                return None
            
            # Determine side and size
            if fair_value > current_price:
                recommended_side = "YES"
            else:
                recommended_side = "NO"
            
            # Size based on theme target
            available = theme.target_exposure_usd - theme.total_exposure_usd
            position_size = min(
                available * self.position_size_pct / 100,
                Decimal("500"),  # Cap single position
            )
            
            if position_size < Decimal("10"):
                return None  # Too small
            
            # Create opportunity
            opp_id = f"MACRO-{datetime.utcnow().strftime('%H%M%S')}-{market_id[:8]}"
            
            opportunity = MacroOpportunity(
                id=opp_id,
                detected_at=datetime.now(timezone.utc),
                theme_id=theme.id,
                theme_name=theme.name,
                category=theme.category,
                platform=platform,
                market_id=market_id,
                market_title=title,
                current_price=current_price,
                fair_value=fair_value,
                edge_pct=edge,
                recommended_side=recommended_side,
                recommended_size_usd=position_size,
                conviction=theme.conviction,
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error analyzing macro market: {e}")
            return None
    
    async def scan_for_opportunities(self) -> List[MacroOpportunity]:
        """Scan for macro opportunities"""
        opportunities = []
        
        # Fetch macro markets
        markets = await self.fetch_macro_markets()
        
        # Update stats
        self.stats.themes_active = len([t for t in self.themes if t.market_ids])
        self.stats.markets_tracked = len(markets)
        
        # Analyze each market
        for market in markets:
            opp = await self.analyze_market(market)
            if opp:
                opportunities.append(opp)
                self.stats.opportunities_found += 1
        
        # Sort by edge
        opportunities.sort(key=lambda x: x.edge_pct, reverse=True)
        
        if opportunities:
            logger.info(f"🎯 Found {len(opportunities)} macro opportunities!")
            for opp in opportunities[:5]:
                logger.info(f"   {opp}")
        
        return opportunities
    
    async def run(self):
        """Run continuous scanning"""
        self._running = True
        logger.info("🌍 Starting Macro Board Strategy")
        logger.info(f"   Themes: {len(self.themes)}")
        logger.info(f"   Max exposure: ${self.max_total_exposure:,.0f}")
        
        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()
                
                # Callback
                if self.on_opportunity and opportunities:
                    for opp in opportunities:
                        await self.on_opportunity(opp)
                
                await asyncio.sleep(self.scan_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Macro board error: {e}")
                await asyncio.sleep(30)
        
        await self.close()
    
    def stop(self):
        """Stop the strategy"""
        self._running = False
    
    def add_theme(self, theme: MacroTheme):
        """Add a macro theme"""
        self.themes.append(theme)
        self._themes_by_id[theme.id] = theme
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get summary of macro portfolio"""
        summary = {
            "themes": [],
            "total_exposure": float(self.stats.total_exposure_usd),
            "total_markets": self.stats.markets_tracked,
        }
        
        for theme in self.themes:
            summary["themes"].append({
                "name": theme.name,
                "category": theme.category.value,
                "direction": theme.direction,
                "conviction": theme.conviction,
                "markets": len(theme.market_ids),
                "exposure": float(theme.total_exposure_usd),
                "target": float(theme.target_exposure_usd),
            })
        
        return summary


# Strategy info for UI
MACRO_BOARD_INFO = {
    "id": "macro_board",
    "name": "Macro Board Strategy",
    "confidence": 75,
    "expected_apy": "30-80%",
    "description": (
        "Build a portfolio of positions across macro themes: "
        "Fed rates, elections, crypto-adjacent, geopolitical. "
        "Based on ArmageddonRewardsBilly's $62K/month approach."
    ),
    "key_points": [
        "Portfolio approach, not individual trades",
        "High-conviction macro themes",
        "Fed, elections, MSTR, geopolitics",
        "$1.7M active exposure example",
        "Don't chase headlines - stick to thesis",
    ],
    "platforms": ["Polymarket", "Kalshi"],
    "risk_level": "medium",
    "category": "prediction",
}
