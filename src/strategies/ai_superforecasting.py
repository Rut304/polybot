"""
AI Superforecasting Strategy with Google Gemini

Based on GitHub research (BlackSky-Jose/PolyMarket-trading-AI-model - 340 stars):
- Uses LLM to analyze prediction market questions
- Compares AI probability estimate vs market price
- Only trades when AI confidence diverges significantly from market

Strategy:
1. Fetch active markets from Polymarket/Kalshi
2. Use Gemini to analyze each question and estimate probability
3. Compare AI estimate vs current market price
4. If divergence > threshold (default 10%), flag opportunity
5. Use high-conviction sizing for trades

Key Gemini Prompt Engineering:
- Act as a superforecaster with calibration training
- Consider base rates and historical patterns
- Factor in current events and recent news
- Output probability with confidence interval

Expected returns: 30-60% APY
Risk: Medium (depends on AI accuracy)
"""

import asyncio
import logging
import os
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional
import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class AIForecast:
    """An AI-generated probability forecast"""
    market_id: str
    platform: str
    question: str

    # AI Analysis
    ai_probability: float  # 0-1
    ai_confidence: float  # 0-1 (how confident AI is in its estimate)
    reasoning: str
    factors: List[str] = field(default_factory=list)

    # Market Comparison
    market_probability: float = 0.0
    divergence_pct: float = 0.0  # How much AI differs from market

    # Recommendation
    direction: str = ""  # "buy_yes", "buy_no", or ""
    recommended_size_usd: Decimal = Decimal("0")

    # Dual AI Verification (optional)
    verification_probability: Optional[float] = None  # 2nd AI estimate
    verification_model: Optional[str] = None
    verification_agreed: bool = True  # Did both AIs agree within threshold?
    dual_verified: bool = False  # Was dual verification performed?

    # Metadata
    model_used: str = "gemini-2.0-flash"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __str__(self) -> str:
        return (
            f"AI Forecast: {self.question[:50]}... | "
            f"AI: {self.ai_probability:.0%} vs Market: {self.market_probability:.0%} | "
            f"Divergence: {self.divergence_pct:+.1f}%"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "market_id": self.market_id,
            "platform": self.platform,
            "question": self.question,
            "ai_probability": self.ai_probability,
            "ai_confidence": self.ai_confidence,
            "reasoning": self.reasoning,
            "factors": self.factors,
            "market_probability": self.market_probability,
            "divergence_pct": self.divergence_pct,
            "direction": self.direction,
            "recommended_size_usd": float(self.recommended_size_usd),
            "model_used": self.model_used,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class SuperforecastingStats:
    """Statistics for the AI superforecasting strategy"""
    markets_analyzed: int = 0
    opportunities_found: int = 0
    trades_executed: int = 0
    trades_won: int = 0
    trades_lost: int = 0
    total_profit_usd: Decimal = Decimal("0")

    # AI Performance
    avg_divergence_pct: float = 0.0
    predictions_correct: int = 0
    predictions_total: int = 0

    def accuracy(self) -> float:
        if self.predictions_total == 0:
            return 0.0
        return (self.predictions_correct / self.predictions_total) * 100

    def win_rate(self) -> float:
        total = self.trades_won + self.trades_lost
        if total == 0:
            return 0.0
        return (self.trades_won / total) * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "markets_analyzed": self.markets_analyzed,
            "opportunities_found": self.opportunities_found,
            "trades_executed": self.trades_executed,
            "win_rate": self.win_rate(),
            "accuracy": self.accuracy(),
            "total_profit_usd": float(self.total_profit_usd),
        }


class GeminiClient:
    """Client for Google Gemini API."""

    API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
    ):
        self.api_key = api_key
        self.model = model
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def generate(self, prompt: str) -> Optional[str]:
        """Generate text using Gemini API."""
        session = await self._get_session()

        url = f"{self.API_URL}/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,  # Lower = more deterministic
                "topP": 0.8,
                "topK": 40,
                "maxOutputTokens": 1024,
            }
        }

        try:
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Extract text from response
                    candidates = data.get("candidates", [])
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    error_text = await resp.text()
                    logger.error(f"Gemini API error {resp.status}: {error_text}")
        except Exception as e:
            logger.error(f"Gemini API exception: {e}")

        return None


class AISuperforecastingStrategy:
    """
    AI-powered superforecasting strategy using Google Gemini.

    Analyzes prediction market questions and estimates probabilities
    using large language model reasoning. Trades when AI estimate
    diverges significantly from market consensus.

    Configuration:
    - min_divergence_pct: Minimum divergence to trigger trade (default 10%)
    - confidence_threshold: Minimum AI confidence required (default 0.75)
    - max_position_usd: Maximum position per trade
    - cooldown_hours: Don't re-analyze same market within this period
    - categories: Market categories to analyze
    """

    POLYMARKET_API = "https://gamma-api.polymarket.com"

    # Superforecaster prompt template
    FORECAST_PROMPT = """You are a professional superforecaster trained in probability calibration.

Analyze this prediction market question and estimate the probability that it resolves YES.

**Question:** {question}

**Current Market Info:**
- Current YES price: {yes_price}% (market consensus)
- Trading volume: ${volume:,}
- Category: {category}

**Your Task:**
1. Consider base rates and historical patterns for similar events
2. Identify key factors that would influence the outcome
3. Account for any recent news or developments
4. Estimate the probability with proper calibration

**Output Format (JSON only):**
{{
    "probability": 0.XX,
    "confidence": 0.XX,
    "factors": ["factor1", "factor2", "factor3"],
    "reasoning": "Brief explanation of your estimate"
}}

Important:
- probability: Your estimate (0.0 to 1.0)
- confidence: How confident you are in this estimate (0.0 to 1.0)
- Be calibrated: If you say 70%, events should happen ~70% of the time
- Consider your uncertainty - lower confidence if information is limited

Output ONLY the JSON, no other text."""

    # Verification prompt for 2nd AI (more skeptical)
    VERIFICATION_PROMPT = """You are a skeptical analyst reviewing a probability estimate.

**Question:** {question}

**Current Market Price:** {yes_price}%
**First AI Estimate:** {first_ai_prob}%
**First AI Reasoning:** {first_reasoning}

**Your Task:**
1. Challenge the first AI's reasoning - what did they miss?
2. Consider contrarian factors and tail risks
3. Estimate your own probability independently
4. Be calibrated - your estimates should match real frequencies

**Output Format (JSON only):**
{{
    "probability": 0.XX,
    "confidence": 0.XX,
    "critique": "What the first AI got wrong or missed",
    "reasoning": "Your independent analysis"
}}

Output ONLY the JSON, no other text."""

    def __init__(
        self,
        api_key: str = None,
        model: str = "gemini-2.0-flash",
        verification_model: str = "gemini-1.5-pro",
        enable_dual_verification: bool = False,
        verification_agreement_threshold: float = 0.15,
        min_divergence_pct: float = 10.0,
        confidence_threshold: float = 0.75,
        max_position_usd: float = 100.0,
        min_position_usd: float = 10.0,
        cooldown_hours: int = 24,
        categories: List[str] = None,
        min_volume_usd: float = 10000.0,
        scan_interval_seconds: int = 300,  # 5 minutes
        on_forecast: Optional[Callable] = None,
        on_opportunity: Optional[Callable] = None,
        db_client=None,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model
        self.verification_model = verification_model
        self.enable_dual_verification = enable_dual_verification
        self.verification_threshold = verification_agreement_threshold
        self.min_divergence = min_divergence_pct
        self.confidence_threshold = confidence_threshold
        self.max_position = Decimal(str(max_position_usd))
        self.min_position = Decimal(str(min_position_usd))
        self.cooldown_hours = cooldown_hours
        self.categories = categories or ["politics", "crypto", "sports", "entertainment"]
        self.min_volume = min_volume_usd
        self.scan_interval = scan_interval_seconds

        self.on_forecast = on_forecast
        self.on_opportunity = on_opportunity
        self.db = db_client

        # Primary Gemini client (fast model for initial analysis)
        self.gemini = GeminiClient(self.api_key, self.model) if self.api_key else None
        # Secondary Gemini client (different model for verification)
        self.gemini_verifier = (
            GeminiClient(self.api_key, self.verification_model) 
            if self.api_key and self.enable_dual_verification else None
        )
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None

        # Cache for analyzed markets
        self._forecast_cache: Dict[str, AIForecast] = {}
        self._cooldown_tracker: Dict[str, datetime] = {}

        self.stats = SuperforecastingStats()

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15)
            )
        return self._session

    async def close(self):
        if self.gemini:
            await self.gemini.close()
        if self.gemini_verifier:
            await self.gemini_verifier.close()
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_markets(self, limit: int = 50) -> List[Dict]:
        """Fetch active markets from Polymarket."""
        session = await self._get_session()
        markets = []

        try:
            url = f"{self.POLYMARKET_API}/markets"
            params = {
                "closed": "false",
                "limit": limit,
            }

            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    all_markets = data if isinstance(data, list) else data.get("markets", [])

                    for market in all_markets:
                        # Filter by volume
                        volume = float(market.get("volume", 0) or 0)
                        if volume >= self.min_volume:
                            markets.append(market)

        except Exception as e:
            logger.error(f"Error fetching markets: {e}")

        return markets

    def _parse_ai_response(self, response: str) -> Optional[Dict]:
        """Parse JSON response from Gemini."""
        try:
            # Try to extract JSON from response
            # Sometimes models include extra text
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response: {e}")
            logger.debug(f"Raw response: {response}")
            return None

    async def analyze_market(self, market: Dict) -> Optional[AIForecast]:
        """
        Analyze a market using Gemini and compare to current price.
        """
        if not self.gemini:
            logger.warning("Gemini client not initialized - missing API key")
            return None

        market_id = market.get("id") or market.get("condition_id", "")
        question = market.get("question", "") or market.get("title", "")

        if not market_id or not question:
            return None

        # Check cooldown
        if market_id in self._cooldown_tracker:
            last_analyzed = self._cooldown_tracker[market_id]
            if datetime.now(timezone.utc) - last_analyzed < timedelta(hours=self.cooldown_hours):
                return self._forecast_cache.get(market_id)

        # Get current market price
        tokens = market.get("tokens", [])
        yes_price = 0.5
        for token in tokens:
            outcome = (token.get("outcome") or "").lower()
            if outcome == "yes":
                yes_price = float(token.get("price", 0.5))
                break

        volume = float(market.get("volume", 0) or 0)
        category = market.get("category", "general")

        # Build prompt
        prompt = self.FORECAST_PROMPT.format(
            question=question,
            yes_price=int(yes_price * 100),
            volume=volume,
            category=category,
        )

        # Call Gemini
        logger.debug(f"Analyzing: {question[:60]}...")
        response = await self.gemini.generate(prompt)

        if not response:
            return None

        # Parse response
        parsed = self._parse_ai_response(response)
        if not parsed:
            return None

        ai_prob = float(parsed.get("probability", 0.5))
        ai_confidence = float(parsed.get("confidence", 0.5))
        reasoning = parsed.get("reasoning", "")
        factors = parsed.get("factors", [])

        # Dual AI verification (optional - improves accuracy but slower)
        verification_prob = None
        verification_agreed = True
        dual_verified = False
        
        if self.enable_dual_verification and self.gemini_verifier and ai_confidence >= 0.5:
            logger.debug(f"  🔍 Running dual verification with {self.verification_model}...")
            verification_prompt = self.VERIFICATION_PROMPT.format(
                question=question,
                yes_price=int(yes_price * 100),
                first_ai_prob=int(ai_prob * 100),
                first_reasoning=reasoning[:500],
            )
            
            verify_response = await self.gemini_verifier.generate(verification_prompt)
            if verify_response:
                verify_parsed = self._parse_ai_response(verify_response)
                if verify_parsed:
                    verification_prob = float(verify_parsed.get("probability", ai_prob))
                    dual_verified = True
                    
                    # Check if AIs agree within threshold
                    prob_diff = abs(ai_prob - verification_prob)
                    verification_agreed = prob_diff <= self.verification_threshold
                    
                    if not verification_agreed:
                        logger.info(
                            f"  ⚠️ AIs DISAGREE: Primary={ai_prob:.0%}, "
                            f"Verifier={verification_prob:.0%} (diff={prob_diff:.0%})"
                        )
                        # Average the probabilities when they disagree
                        ai_prob = (ai_prob + verification_prob) / 2
                        ai_confidence *= 0.7  # Reduce confidence when AIs disagree
                    else:
                        logger.debug(
                            f"  ✅ AIs agree: {ai_prob:.0%} vs {verification_prob:.0%}"
                        )
                        ai_confidence = min(ai_confidence * 1.1, 0.95)  # Boost confidence

        # Calculate divergence
        divergence = (ai_prob - yes_price) * 100  # Positive = AI thinks higher

        # Determine direction
        direction = ""
        recommended_size = Decimal("0")

        if abs(divergence) >= self.min_divergence and ai_confidence >= self.confidence_threshold:
            # If dual verification was run and AIs disagreed significantly, skip
            if dual_verified and not verification_agreed:
                logger.info(f"  ⏭️ Skipping trade - AIs disagreed on {question[:40]}...")
            else:
                if divergence > 0:
                    # AI thinks probability is higher than market → buy YES
                    direction = "buy_yes"
                else:
                    # AI thinks probability is lower than market → buy NO
                    direction = "buy_no"

                # Size based on divergence and confidence
                divergence_factor = min(abs(divergence) / 20, 1.0)  # Scale 0-1
                confidence_factor = ai_confidence
                size_factor = divergence_factor * confidence_factor

                recommended_size = self.min_position + (
                    (self.max_position - self.min_position) * Decimal(str(size_factor))
                )
                recommended_size = recommended_size.quantize(Decimal("0.01"))

        forecast = AIForecast(
            market_id=market_id,
            platform="polymarket",
            question=question,
            ai_probability=ai_prob,
            ai_confidence=ai_confidence,
            reasoning=reasoning,
            factors=factors,
            market_probability=yes_price,
            divergence_pct=divergence,
            direction=direction,
            recommended_size_usd=recommended_size,
            verification_probability=verification_prob,
            verification_model=self.verification_model if dual_verified else None,
            verification_agreed=verification_agreed,
            dual_verified=dual_verified,
            model_used=self.model,
        )

        # Update cache and cooldown
        self._forecast_cache[market_id] = forecast
        self._cooldown_tracker[market_id] = datetime.now(timezone.utc)

        # Update stats
        self.stats.markets_analyzed += 1
        if direction:
            self.stats.opportunities_found += 1

        return forecast

    async def save_forecast(self, forecast: AIForecast):
        """Save forecast to database."""
        if not self.db:
            return

        try:
            await self.db.client.table("polybot_ai_forecasts").upsert({
                "market_id": forecast.market_id,
                "platform": forecast.platform,
                "question": forecast.question[:500],  # Truncate
                "ai_probability": forecast.ai_probability,
                "ai_confidence": forecast.ai_confidence,
                "market_probability": forecast.market_probability,
                "divergence_pct": forecast.divergence_pct,
                "direction": forecast.direction,
                "reasoning": forecast.reasoning[:1000],  # Truncate
                "model_used": forecast.model_used,
                "created_at": forecast.created_at.isoformat(),
            }, on_conflict="market_id,platform").execute()
        except Exception as e:
            logger.error(f"Error saving forecast: {e}")

    async def scan_for_opportunities(self) -> List[AIForecast]:
        """Scan markets and identify opportunities using AI analysis."""
        opportunities = []

        markets = await self.fetch_markets()
        logger.info(f"🧠 Analyzing {len(markets)} markets with Gemini...")

        for market in markets:
            forecast = await self.analyze_market(market)

            if forecast:
                logger.info(f"   {forecast}")

                if forecast.direction:
                    opportunities.append(forecast)

                    # Callback
                    if self.on_forecast:
                        await self.on_forecast(forecast)

                    # Save to DB
                    await self.save_forecast(forecast)

            # Rate limiting for Gemini API
            await asyncio.sleep(1)

        # Sort by divergence (highest first)
        opportunities.sort(key=lambda x: abs(x.divergence_pct), reverse=True)

        return opportunities

    async def run(self):
        """Run continuous AI forecasting."""
        if not self.api_key:
            logger.error("❌ Cannot start AI Superforecasting - GEMINI_API_KEY not set")
            return

        self._running = True
        logger.info(
            f"🧠 Starting AI Superforecasting Strategy\n"
            f"   Model: {self.model}\n"
            f"   Min divergence: {self.min_divergence}%\n"
            f"   Confidence threshold: {self.confidence_threshold:.0%}\n"
            f"   Scan interval: {self.scan_interval}s"
        )

        while self._running:
            try:
                opportunities = await self.scan_for_opportunities()

                if opportunities:
                    logger.info(
                        f"🎯 Found {len(opportunities)} AI opportunities:\n" +
                        "\n".join(f"   • {o.direction}: {o.question[:40]}... ({o.divergence_pct:+.1f}%)"
                                  for o in opportunities[:5])
                    )

                    # Callback for top opportunities
                    if self.on_opportunity:
                        for opp in opportunities[:3]:  # Top 3
                            await self.on_opportunity(opp)

                await asyncio.sleep(self.scan_interval)

            except Exception as e:
                logger.error(f"Error in AI forecasting: {e}")
                await asyncio.sleep(self.scan_interval)

        await self.close()

    def stop(self):
        """Stop the strategy."""
        self._running = False
        logger.info("🛑 Stopping AI Superforecasting Strategy")

    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics."""
        return self.stats.to_dict()

    def get_cached_forecasts(self) -> List[Dict]:
        """Get all cached forecasts."""
        return [f.to_dict() for f in self._forecast_cache.values()]


# Strategy info for UI display
AI_SUPERFORECASTING_INFO = {
    "id": "ai_superforecasting",
    "name": "AI Superforecasting",
    "confidence": 70,
    "expected_apy": "30-60%",
    "risk_level": "medium",
    "description": (
        "Uses Google Gemini 2.0 Flash to analyze prediction market questions "
        "and estimate probabilities. Trades when AI estimate diverges "
        "significantly from market consensus. Optional dual-AI verification "
        "for improved accuracy."
    ),
    "key_points": [
        "Gemini 2.0 Flash for fast, accurate analysis",
        "Optional dual-AI verification (2nd model checks 1st)",
        "Considers base rates, factors, and current events",
        "Only trades when divergence > 10% (configurable)",
        "Higher AI confidence = larger position size",
        "Skips trades when AIs disagree significantly",
    ],
    "github_source": "BlackSky-Jose/PolyMarket-trading-AI-model (340 stars)",
    "model": "gemini-2.0-flash",
    "verification_model": "gemini-1.5-pro",
    "api_required": "GEMINI_API_KEY",
}
