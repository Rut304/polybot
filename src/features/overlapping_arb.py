"""
Overlapping Market Arbitrage Detection

Finds markets with overlapping outcomes where combined probabilities
deviate significantly from 100%, indicating arbitrage opportunities.

Example: "Will Trump win?" vs "Will Trump be GOP nominee?" - if nominee
probability is lower than winning probability, that's an overlap opportunity.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Callable, Any
import httpx

logger = logging.getLogger(__name__)


@dataclass
class MarketData:
    """Represents a prediction market."""
    condition_id: str
    question: str
    slug: str
    outcomes: List[str]
    outcome_prices: Dict[str, float]
    tokens: List[Dict[str, Any]]
    volume: float
    liquidity: float
    end_date: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)

    @property
    def yes_price(self) -> float:
        """Get YES token price."""
        return self.outcome_prices.get("Yes", 0.0)

    @property
    def no_price(self) -> float:
        """Get NO token price."""
        return self.outcome_prices.get("No", 0.0)


@dataclass
class OverlapOpportunity:
    """Represents an overlapping arbitrage opportunity."""
    id: str
    market_a: MarketData
    market_b: MarketData
    relationship: str  # "implies", "mutually_exclusive", "correlated"
    combined_probability: float
    expected_probability: float  # Usually 100% for mutually exclusive
    deviation: float
    profit_potential: float
    confidence: float
    detected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "market_a": {
                "condition_id": self.market_a.condition_id,
                "question": self.market_a.question,
                "yes_price": self.market_a.yes_price,
            },
            "market_b": {
                "condition_id": self.market_b.condition_id,
                "question": self.market_b.question,
                "yes_price": self.market_b.yes_price,
            },
            "relationship": self.relationship,
            "combined_probability": self.combined_probability,
            "deviation": self.deviation,
            "profit_potential": self.profit_potential,
            "detected_at": self.detected_at.isoformat(),
        }


class OverlappingArbDetector:
    """
    Detects arbitrage opportunities in overlapping/related markets.

    Strategies:
    1. Implication: If A implies B, then P(A) <= P(B). Violation = opportunity
    2. Mutual Exclusion: If A and B can't both happen, P(A) + P(B) <= 100%
    3. Exhaustive: If A, B, C cover all outcomes, P(A) + P(B) + P(C) = 100%

    TUNING NOTES (Dec 2025):
    - Increased min_deviation from 3% to 5% to filter marginal opportunities
    - Added min_confidence filter (0.6) to skip low-confidence correlated trades
    - Increased liquidity requirements for confidence calculation
    - Correlated markets disabled by default (too risky without semantic analysis)
    """

    GAMMA_API = "https://gamma-api.polymarket.com"
    MIN_LIQUIDITY = 10000  # Increased from 5000 - need more liquid markets
    MIN_VOLUME = 5000      # Increased from 1000
    MIN_DEVIATION = 5.0    # Increased from 3.0 - require higher deviation to trade
    MIN_CONFIDENCE = 0.6   # NEW: Minimum confidence to generate signal
    ENABLE_CORRELATED = False  # NEW: Disable correlated markets (too risky)

    # Keywords that indicate related markets
    RELATION_KEYWORDS = {
        "trump": ["election", "president", "republican", "gop", "nominee"],
        "biden": ["election", "president", "democrat", "dnc"],
        "fed": ["rate", "interest", "fomc", "powell"],
        "btc": ["bitcoin", "crypto", "eth", "ethereum"],
        "ai": ["openai", "gpt", "chatgpt", "google", "anthropic"],
    }

    def __init__(
        self,
        min_liquidity: float = None,
        min_deviation: float = None,
        check_interval: int = 60,
    ):
        self.min_liquidity = min_liquidity or self.MIN_LIQUIDITY
        self.min_deviation = min_deviation or self.MIN_DEVIATION
        self.check_interval = check_interval
        self.markets_cache: Dict[str, MarketData] = {}
        self.known_opportunities: Dict[str, OverlapOpportunity] = {}
        self._running = False

    async def fetch_active_markets(self) -> List[MarketData]:
        """Fetch all active markets from Gamma API."""
        markets = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Fetch markets with good liquidity
                response = await client.get(
                    f"{self.GAMMA_API}/markets",
                    params={
                        "closed": "false",
                        "limit": 200,
                        "order": "liquidityNum",
                        "ascending": "false",
                    }
                )
                response.raise_for_status()
                data = response.json()

                for m in data:
                    try:
                        liquidity = float(m.get("liquidityNum", 0) or 0)
                        volume = float(m.get("volumeNum", 0) or 0)

                        if liquidity < self.min_liquidity:
                            continue

                        # Parse outcome prices
                        outcome_prices = {}
                        if m.get("outcomePrices"):
                            prices = m["outcomePrices"]
                            if isinstance(prices, str):
                                import json
                                prices = json.loads(prices)
                            outcomes = m.get("outcomes", ["Yes", "No"])
                            if isinstance(outcomes, str):
                                outcomes = json.loads(outcomes)
                            for i, outcome in enumerate(outcomes):
                                if i < len(prices):
                                    outcome_prices[outcome] = float(prices[i])

                        market = MarketData(
                            condition_id=m.get("conditionId", ""),
                            question=m.get("question", ""),
                            slug=m.get("slug", ""),
                            outcomes=m.get("outcomes", []),
                            outcome_prices=outcome_prices,
                            tokens=m.get("tokens", []),
                            volume=volume,
                            liquidity=liquidity,
                            tags=m.get("tags", []) or [],
                        )
                        markets.append(market)
                        self.markets_cache[market.condition_id] = market

                    except Exception as e:
                        logger.debug(f"Error parsing market: {e}")
                        continue

                logger.info(f"Fetched {len(markets)} active markets")

            except Exception as e:
                logger.error(f"Error fetching markets: {e}")

        return markets

    def find_related_markets(
        self,
        markets: List[MarketData]
    ) -> List[tuple]:
        """
        Find pairs of markets that might be related.

        Returns list of (market_a, market_b, relationship_type) tuples.
        """
        related_pairs = []

        for i, market_a in enumerate(markets):
            question_a = market_a.question.lower()

            for market_b in markets[i+1:]:
                question_b = market_b.question.lower()

                # Check for common keywords
                relationship = self._detect_relationship(question_a, question_b)
                if relationship:
                    related_pairs.append((market_a, market_b, relationship))

        logger.info(f"Found {len(related_pairs)} potentially related market pairs")
        return related_pairs

    def _detect_relationship(
        self,
        question_a: str,
        question_b: str
    ) -> Optional[str]:
        """Detect if two markets are related and how."""

        # Check for shared entity keywords
        for entity, keywords in self.RELATION_KEYWORDS.items():
            if entity in question_a and entity in question_b:
                return "correlated"

            # Check if entity in one and related keyword in other
            if entity in question_a:
                for kw in keywords:
                    if kw in question_b:
                        return "correlated"

        # Check for implication patterns
        implication_patterns = [
            ("win", "nominee"),  # Winning implies being nominee
            ("pass", "vote"),    # Bill passing implies vote happened
            ("exceed", "reach"), # Exceeding implies reaching
        ]

        for strong, weak in implication_patterns:
            if strong in question_a and weak in question_b:
                return "implies"
            if strong in question_b and weak in question_a:
                return "implies"

        # Check for mutually exclusive patterns
        exclusive_indicators = [
            ("democrat", "republican"),
            ("under", "over"),
            ("before", "after"),
            ("yes", "no"),
        ]

        for term_a, term_b in exclusive_indicators:
            if term_a in question_a and term_b in question_b:
                return "mutually_exclusive"
            if term_b in question_a and term_a in question_b:
                return "mutually_exclusive"

        return None

    def analyze_pair(
        self,
        market_a: MarketData,
        market_b: MarketData,
        relationship: str
    ) -> Optional[OverlapOpportunity]:
        """
        Analyze a pair of related markets for arbitrage opportunity.

        TUNING: Added confidence and relationship filters to reduce losing trades.
        """
        price_a = market_a.yes_price
        price_b = market_b.yes_price

        if price_a == 0 or price_b == 0:
            return None

        # TUNING: Skip correlated markets entirely (too risky)
        if relationship == "correlated" and not self.ENABLE_CORRELATED:
            return None

        opportunity = None

        if relationship == "implies":
            # If A implies B, then P(A) should be <= P(B)
            # If P(A) > P(B), buy B and sell A
            # TUNING: Increased buffer from 2% to 5%
            if price_a > price_b + 0.05:
                deviation = (price_a - price_b) * 100
                profit = price_a - price_b

                # TUNING: Higher confidence requirement (use higher liquidity divisor)
                confidence = min(0.9, min(
                    market_a.liquidity / 100000,  # Was 50000
                    market_b.liquidity / 100000
                ))

                opportunity = OverlapOpportunity(
                    id=f"impl_{market_a.condition_id[:8]}_{market_b.condition_id[:8]}",
                    market_a=market_a,
                    market_b=market_b,
                    relationship=relationship,
                    combined_probability=price_a + price_b,
                    expected_probability=1.0,
                    deviation=deviation,
                    profit_potential=profit,
                    confidence=confidence,
                )

        elif relationship == "mutually_exclusive":
            # If A and B are mutually exclusive, P(A) + P(B) should be <= 1
            # If sum > 1, sell both
            combined = price_a + price_b
            # TUNING: Increased buffer from 5% to 8%
            if combined > 1.08:
                deviation = (combined - 1.0) * 100
                profit = combined - 1.0

                # TUNING: Both markets must have good liquidity
                min_liq = min(market_a.liquidity, market_b.liquidity)
                confidence = min(0.85, min_liq / 100000)  # Was 50000

                opportunity = OverlapOpportunity(
                    id=f"excl_{market_a.condition_id[:8]}_{market_b.condition_id[:8]}",
                    market_a=market_a,
                    market_b=market_b,
                    relationship=relationship,
                    combined_probability=combined,
                    expected_probability=1.0,
                    deviation=deviation,
                    profit_potential=profit,
                    confidence=confidence,
                )

        elif relationship == "correlated" and self.ENABLE_CORRELATED:
            # For correlated markets, flag if prices diverge significantly
            # TUNING: Increased from 15% to 25% divergence requirement
            diff = abs(price_a - price_b)
            if diff > 0.25:
                opportunity = OverlapOpportunity(
                    id=f"corr_{market_a.condition_id[:8]}_{market_b.condition_id[:8]}",
                    market_a=market_a,
                    market_b=market_b,
                    relationship=relationship,
                    combined_probability=price_a + price_b,
                    expected_probability=1.0,
                    deviation=diff * 100,
                    profit_potential=diff * 0.2,  # Only 20% (was 30%)
                    confidence=0.4,  # Lower confidence (was 0.5)
                )

        # TUNING: Apply both deviation AND confidence filters
        if opportunity:
            if opportunity.deviation < self.min_deviation:
                return None
            if opportunity.confidence < self.MIN_CONFIDENCE:
                logger.debug(
                    f"Skipping low-confidence opportunity: {opportunity.confidence:.2f}"
                )
                return None
            return opportunity

        return None

    async def scan_for_opportunities(self) -> List[OverlapOpportunity]:
        """Scan all markets for overlapping arbitrage opportunities."""
        opportunities = []

        # Fetch fresh market data
        markets = await self.fetch_active_markets()

        if len(markets) < 2:
            logger.warning("Not enough markets to analyze")
            return opportunities

        # Find related pairs
        related_pairs = self.find_related_markets(markets)

        # Analyze each pair
        for market_a, market_b, relationship in related_pairs:
            opp = self.analyze_pair(market_a, market_b, relationship)
            if opp:
                opportunities.append(opp)
                self.known_opportunities[opp.id] = opp
                logger.info(
                    f"Found {relationship} opportunity: "
                    f"{opp.deviation:.1f}% deviation, "
                    f"${opp.profit_potential:.3f} potential"
                )

        # Sort by profit potential
        opportunities.sort(key=lambda x: x.profit_potential, reverse=True)

        return opportunities

    async def run(
        self,
        callback: Optional[Callable[[OverlapOpportunity], Any]] = None
    ) -> None:
        """
        Run continuous scanning for overlapping arbitrage opportunities.

        Args:
            callback: Function to call when new opportunity is found
        """
        self._running = True
        logger.info("Starting overlapping arbitrage detector")

        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()

                for opp in opportunities:
                    logger.info(
                        f"Overlap opportunity: {opp.relationship} - "
                        f"{opp.market_a.question[:50]}... vs "
                        f"{opp.market_b.question[:50]}... - "
                        f"Deviation: {opp.deviation:.1f}%"
                    )

                    if callback:
                        try:
                            result = callback(opp)
                            if asyncio.iscoroutine(result):
                                await result
                        except Exception as e:
                            logger.error(f"Callback error: {e}")

                logger.info(
                    f"Scan complete. Found {len(opportunities)} opportunities. "
                    f"Next scan in {self.check_interval}s"
                )

            except Exception as e:
                logger.error(f"Error in scan loop: {e}")

            await asyncio.sleep(self.check_interval)

    def stop(self) -> None:
        """Stop the detector."""
        self._running = False
        logger.info("Stopping overlapping arbitrage detector")


# Example usage
async def main():
    detector = OverlappingArbDetector(
        min_liquidity=5000,
        min_deviation=3.0,
        check_interval=120,
    )

    # Single scan
    opportunities = await detector.scan_for_opportunities()

    for opp in opportunities[:5]:
        print(f"\n{opp.relationship.upper()} Opportunity:")
        print(f"  Market A: {opp.market_a.question}")
        print(f"  Market B: {opp.market_b.question}")
        print(f"  Deviation: {opp.deviation:.1f}%")
        print(f"  Profit Potential: ${opp.profit_potential:.4f}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
