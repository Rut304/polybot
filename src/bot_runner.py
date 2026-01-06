"""
PolyBot Unified Runner

Integrates all features into a single async runner:
- Copy Trading
- Overlapping Arbitrage Detection
- Position Management & Auto-Claim
- News/Sentiment Monitoring
- Cross-platform Arbitrage (Polymarket/Kalshi)

TRADING FLOWS AND STRATEGY ISOLATION:
======================================

1. PREDICTION MARKET STRATEGIES (Polymarket, Kalshi):
   - Single-platform arbitrage: Buys YES+NO on same market for guaranteed profit
   - Cross-platform arbitrage: Exploits price differences between Poly and Kalshi
   - Market making: Places limit orders on both sides, earns spread
   - News arbitrage: React to news faster than the market

   * These operate on DIFFERENT ASSET CLASSES than crypto strategies
   * No conflict possible between prediction markets and crypto

2. CRYPTO STRATEGIES (CCXT exchanges - Binance, Bybit, OKX, etc.):
   - Funding Rate Arb (85%): Delta-neutral BTC/ETH perp shorts collecting funding
   - Grid Trading (75%): Places buy/sell grid orders on sideways assets
   - Pairs Trading (65%): Long/short correlated pairs when spread widens

   POTENTIAL CONFLICTS (same symbol traded by multiple strategies):
   - Funding Rate Arb trades: BTC/USDT:USDT, ETH/USDT:USDT perpetuals
   - Grid Trading trades: BTC/USDT, ETH/USDT, SOL/USDT spot
   - Pairs Trading trades: BTC/USDT vs ETH/USDT (both legs)

   CONFLICT MITIGATION:
   - Each strategy tracks its OWN positions separately
   - Strategies use different order types/purposes
   - Enable only ONE crypto strategy per symbol in production
   - Use different symbols for different strategies (recommended)

RECOMMENDED PRODUCTION CONFIGURATION:
====================================
   - Funding Rate Arb: BTC perps only (most liquid)
   - Grid Trading: ETH, SOL, AVAX (avoid BTC)
   - Pairs Trading: LINK-UNI, ATOM-DOT (DeFi/L1 pairs)
"""

import asyncio
import logging
import signal
import sys
import os
from datetime import datetime
from typing import Optional, Dict

# Add src to path for imports when running as module
src_dir = os.path.dirname(os.path.abspath(__file__))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from src.database.client import Database
from src.features.copy_trading import CopyTradingEngine, CopySignal
from src.features.overlapping_arb import OverlappingArbDetector, OverlapOpportunity
from src.features.position_manager import PositionManager, ClaimResult, PortfolioSummary
from src.features.news_sentiment import NewsSentimentEngine, MarketAlert
from src.clients.polymarket_client import PolymarketClient
from src.clients.kalshi_client import KalshiClient
from src.simulation.paper_trader_realistic import RealisticPaperTrader
from src.arbitrage.detector import ArbitrageDetector, CrossPlatformScanner, Opportunity
from src.arbitrage.single_platform_scanner import (
    SinglePlatformScanner,
    SinglePlatformOpportunity,
    ArbitrageType,
)
from src.analytics.arbitrage_analytics import (
    ArbitrageAnalytics,
    get_analytics,
    reset_analytics,
)
from src.strategies import (
    MarketMakerStrategy,
    NewsArbitrageStrategy,
    FundingRateArbStrategy,
    GridTradingStrategy,
    PairsTradingStrategy,
    StockMeanReversionStrategy,
    StockMomentumStrategy,
    # Advanced Framework (Phase 1)
    KellyPositionSizer,
    RegimeDetector,
    CircuitBreaker,
    get_kelly_sizer,
    get_regime_detector,
    get_circuit_breaker,
    # Strategy Enhancements (Phase 2)
    TimeDecayAnalyzer,
    DepegDetector,
    CorrelationTracker,
    get_time_decay_analyzer,
    get_depeg_detector,
    get_correlation_tracker,
    # Twitter-Derived Strategies (2024)
    BTCBracketArbStrategy,
    BracketCompressionStrategy,
    KalshiMentionSnipeStrategy,
    WhaleCopyTradingStrategy,
    MacroBoardStrategy,
    FearPremiumContrarianStrategy,
)
from src.strategies.congressional_tracker import CongressionalTrackerStrategy
from src.strategies.political_event import PoliticalEventStrategy
from src.strategies.crypto_15min_scalping import Crypto15MinScalpingStrategy
from src.strategies.cross_exchange_arb import CrossExchangeArbStrategy
from src.strategies.liquidation import PolymarketLiquidationStrategy
from src.strategies.ibkr_futures_momentum import IBKRFuturesMomentumStrategy
from src.strategies.selective_whale_copy import SelectiveWhaleCopyStrategy
from src.strategies.ai_superforecasting import AISuperforecastingStrategy, AIForecast
from src.strategies.news_arbitrage import NewsArbitrageStrategy, NewsArbOpportunity
from src.strategies.high_conviction import HighConvictionStrategy, Signal
from src.strategies.spike_hunter import SpikeHunterStrategy, SpikeOpportunity, create_spike_hunter_from_config
# Stock strategies (require Alpaca)
from src.strategies.sector_rotation import SectorRotationStrategy
from src.strategies.dividend_growth import DividendGrowthStrategy
from src.strategies.earnings_momentum import EarningsMomentumStrategy
# Options strategies (require IBKR)
from src.strategies.options_strategies import (
    CoveredCallStrategy,
    CashSecuredPutStrategy,
    IronCondorStrategy,
    WheelStrategy,
)
from src.exchanges.ccxt_client import CCXTClient
from src.exchanges.alpaca_client import AlpacaClient
from src.exchanges.ibkr_client import IBKRClient
from src.exchanges.ibkr_web_client import IBKRWebClient
from src.notifications import Notifier, NotificationConfig
from src.logging_handler import setup_database_logging
from src.services.balance_aggregator import BalanceAggregator
from decimal import Decimal

logger = logging.getLogger(__name__)

# NOTE: Database logging (setup_database_logging) is now called AFTER
# logging.basicConfig() in main() to ensure stdout logging works first.
# Previously this was called at module import time which broke stdout logs.


class PolybotRunner:
    """
    Unified runner that orchestrates all bot features.
    """

    def __init__(
        self,
        wallet_address: Optional[str] = None,
        private_key: Optional[str] = None,
        kalshi_api_key: Optional[str] = None,
        kalshi_private_key: Optional[str] = None,
        news_api_key: Optional[str] = None,
        tracked_traders: Optional[list] = None,
        enable_copy_trading: bool = True,
        enable_arb_detection: bool = True,
        enable_position_manager: bool = True,
        enable_news_sentiment: bool = True,
        simulation_mode: bool = True,
        user_id: Optional[str] = None,
    ):
        self.simulation_mode = simulation_mode
        
        # Multi-tenant user_id: Use provided user_id, or fall back to BOT_USER_ID env var
        # This ensures all trades are associated with a user for proper filtering
        self.user_id = user_id or os.getenv("BOT_USER_ID")
        if not self.user_id:
            logger.warning("⚠️ No user_id set - trades will have user_id=NULL. Set BOT_USER_ID env var for multi-tenancy.")

        # Feature flags
        self.enable_copy_trading = enable_copy_trading
        self.enable_arb_detection = enable_arb_detection
        self.enable_position_manager = enable_position_manager
        self.enable_news_sentiment = enable_news_sentiment

        # Initialize database FIRST (needed for secrets)
        self.db = Database(user_id=self.user_id)

        # Load secrets from centralized Supabase store
        # This allows key rotation without code changes
        self.wallet_address = wallet_address or self.db.get_secret("POLYMARKET_WALLET_ADDRESS") or os.getenv("WALLET_ADDRESS", "")
        self.private_key = private_key or self.db.get_secret("POLYMARKET_PRIVATE_KEY") or os.getenv("PRIVATE_KEY")
        self.kalshi_api_key = kalshi_api_key or self.db.get_secret("KALSHI_API_KEY") or os.getenv("KALSHI_API_KEY")
        self.kalshi_private_key = kalshi_private_key or self.db.get_secret("KALSHI_PRIVATE_KEY") or os.getenv("KALSHI_PRIVATE_KEY")

        # News API keys - each source is independent for graceful degradation
        self.finnhub_api_key = self.db.get_secret("FINNHUB_API_KEY") or os.getenv("FINNHUB_API_KEY")
        self.twitter_bearer_token = self.db.get_secret("TWITTER_BEARER_TOKEN") or os.getenv("TWITTER_BEARER_TOKEN")
        self.news_api_key = news_api_key or self.db.get_secret("NEWS_API_KEY") or os.getenv("NEWS_API_KEY")

        # Load config from Supabase for autonomous operation
        # This allows config changes without redeployment
        from src.config import Config
        self.config = Config(db_client=self.db)

        # Blacklisted markets (fetched from Supabase)
        self.blacklisted_markets: set = set()

        # Initialize API clients for balance tracking
        self.polymarket_client = PolymarketClient()
        self.kalshi_client = KalshiClient(
            api_key=self.kalshi_api_key,
            private_key=self.kalshi_private_key,
        )

        # Initialize feature engines
        self.copy_trading: Optional[CopyTradingEngine] = None
        self.arb_detector: Optional[OverlappingArbDetector] = None
        self.position_manager: Optional[PositionManager] = None
        self.news_engine: Optional[NewsSentimentEngine] = None
        self.cross_platform_detector: Optional[ArbitrageDetector] = None
        self.cross_platform_scanner: Optional[CrossPlatformScanner] = None
        self.single_platform_scanner: Optional[SinglePlatformScanner] = None

        # NEW: Advanced strategies
        self.market_maker: Optional[MarketMakerStrategy] = None
        self.news_arbitrage: Optional[NewsArbitrageStrategy] = None

        # NEW: High-priority crypto strategies
        self.funding_rate_arb: Optional[FundingRateArbStrategy] = None
        self.grid_trading: Optional[GridTradingStrategy] = None
        self.pairs_trading: Optional[PairsTradingStrategy] = None

        # NEW: Stock trading strategies (Alpaca)
        self.stock_mean_reversion: Optional[StockMeanReversionStrategy] = None
        self.stock_momentum: Optional[StockMomentumStrategy] = None
        self.alpaca_client: Optional[AlpacaClient] = None
        self.ibkr_client: Optional[IBKRClient] = None


        # ==============================================
        # TWITTER-DERIVED STRATEGIES (2024)
        # ==============================================
        # High-conviction strategies from analyzing top traders on X

        # BTC Bracket Arb - YES+NO < $1.00 arbitrage
        self.btc_bracket_arb: Optional[BTCBracketArbStrategy] = None

        # Bracket Compression - mean reversion on stretched brackets
        self.bracket_compression: Optional[BracketCompressionStrategy] = None

        # Kalshi Mention Snipe - fast execution on resolved markets
        self.kalshi_mention_sniper: Optional[KalshiMentionSnipeStrategy] = None

        # Whale Copy Trading - follow profitable wallets
        self.whale_copy_trading: Optional[WhaleCopyTradingStrategy] = None

        # Congressional Tracker - copy stock trades from Congress
        self.congressional_tracker: Optional[CongressionalTrackerStrategy] = None

        # Macro Board - weighted macro event exposure
        self.macro_board: Optional[MacroBoardStrategy] = None

        # Fear Premium Contrarian - trade against extreme sentiment
        self.fear_premium_contrarian: Optional[FearPremiumContrarianStrategy] = None

        # ==============================================
        # NEW STRATEGIES (2025)
        # ==============================================

        # Political Event Strategy - high-conviction political events
        self.political_event_strategy: Optional[PoliticalEventStrategy] = None

        # High Conviction Strategy - fewer, higher-confidence trades
        self.high_conviction_strategy: Optional[HighConvictionStrategy] = None

        # Selective Whale Copy - performance-based whale selection
        self.selective_whale_copy: Optional[SelectiveWhaleCopyStrategy] = None

        # 15-Minute Crypto Scalping - Twitter-derived high-frequency scalping
        self.crypto_15min_scalping: Optional[Crypto15MinScalpingStrategy] = None

        # AI Superforecasting - Gemini-powered market analysis
        self.ai_superforecasting: Optional[AISuperforecastingStrategy] = None

        # Spike Hunter - detect and fade rapid price moves
        self.spike_hunter: Optional[SpikeHunterStrategy] = None

        # ==============================================
        # ADVANCED FRAMEWORK MODULES (Phase 1)
        # ==============================================
        # These enhance ALL strategies with better risk management

        # Kelly Criterion Position Sizer - optimal bet sizing
        self.kelly_sizer: Optional[KellyPositionSizer] = None

        # Market Regime Detector - adapts strategies to market conditions
        self.regime_detector: Optional[RegimeDetector] = None

        # Circuit Breaker - stops trading on excessive drawdown
        self.circuit_breaker: Optional[CircuitBreaker] = None

        # ==============================================
        # STRATEGY ENHANCEMENTS (Phase 2)
        # ==============================================

        # Time Decay Analyzer - prediction market theta analysis
        self.time_decay_analyzer: Optional[TimeDecayAnalyzer] = None

        # Depeg Detector - stablecoin depeg arbitrage
        self.depeg_detector: Optional[DepegDetector] = None

        # Correlation Tracker - position limit enforcement
        self.correlation_tracker: Optional[CorrelationTracker] = None

        # CCXT clients for crypto exchange access (multi-exchange support)
        # Key: exchange_id (e.g., 'binance', 'okx'), Value: CCXTClient instance
        self.ccxt_clients: Dict[str, CCXTClient] = {}
        # Primary client for strategies that don't support multi-exchange yet
        self.ccxt_client: Optional[CCXTClient] = None

        # Balance aggregator for multi-platform balance tracking
        self.balance_aggregator: Optional[BalanceAggregator] = None

        # Analytics tracker for per-strategy performance
        self.analytics: ArbitrageAnalytics = reset_analytics()

        # Paper trading simulator (for simulation mode)
        self.paper_trader: Optional[RealisticPaperTrader] = None

        # Notification handler for alerts
        self.notifier: Notifier = Notifier()

        # Default tracked traders (can be updated from Supabase)
        self.tracked_traders = tracked_traders or []

        self._running = False
        self._tasks = []

    async def _resilient_task(self, task_name: str, coro_func, *args, **kwargs):
        """
        Wrapper that makes any async task resilient by auto-restarting on failure.

        Args:
            task_name: Name for logging
            coro_func: The coroutine function to run
            *args, **kwargs: Arguments to pass to the function
        """
        restart_delay = 30  # Start with 30 second delay
        max_delay = 300  # Max 5 minutes between restarts

        while self._running:
            try:
                logger.info(f"🚀 Starting task: {task_name}")
                await coro_func(*args, **kwargs)
                # If the coroutine returns normally, it's done
                break
            except asyncio.CancelledError:
                logger.info(f"⏹️ Task {task_name} cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Task {task_name} failed: {e}")
                if self._running:
                    logger.info(f"🔄 Restarting {task_name} in {restart_delay}s...")
                    await asyncio.sleep(restart_delay)
                    # Exponential backoff
                    restart_delay = min(restart_delay * 2, max_delay)

    async def fetch_balances(self) -> dict:
        """Fetch balances from both Polymarket and Kalshi."""
        balances = {
            "polymarket": {"total_value": 0.0, "positions": []},
            "kalshi": {"total_value": 0.0, "positions": []},
            "combined_total": 0.0,
        }

        # Fetch Polymarket balance
        if self.wallet_address:
            try:
                pm_balance = self.polymarket_client.get_balance(self.wallet_address)
                balances["polymarket"] = pm_balance
                logger.info(
                    f"💰 Polymarket: ${pm_balance.get('total_value', 0):.2f} "
                    f"({pm_balance.get('position_count', 0)} positions)"
                )
            except Exception as e:
                logger.error(f"Failed to fetch Polymarket balance: {e}")

        # Fetch Kalshi balance
        if self.kalshi_client.is_authenticated:
            try:
                k_balance = self.kalshi_client.get_balance()
                balances["kalshi"] = k_balance
                logger.info(
                    f"💰 Kalshi: ${k_balance.get('total_value', 0):.2f} "
                    f"(${k_balance.get('balance', 0):.2f} cash, "
                    f"{k_balance.get('position_count', 0)} positions)"
                )
            except Exception as e:
                logger.error(f"Failed to fetch Kalshi balance: {e}")

        # Calculate combined total
        pm_total = balances["polymarket"].get("total_value", 0) or 0
        k_total = balances["kalshi"].get("total_value", 0) or 0
        balances["combined_total"] = pm_total + k_total

        logger.info(f"💎 Combined Portfolio Value: ${balances['combined_total']:.2f}")

        return balances

    async def refresh_blacklist(self):
        """Fetch blacklisted markets from Supabase."""
        try:
            if self.db and hasattr(self.db, '_client') and self.db._client:
                result = self.db._client.table(
                    "polybot_disabled_markets"
                ).select("market_id").execute()
                if result.data:
                    self.blacklisted_markets = {
                        m['market_id'] for m in result.data
                    }
                    logger.info(
                        f"📋 Loaded {len(self.blacklisted_markets)} "
                        f"blacklisted markets"
                    )
        except Exception as e:
            logger.warning(f"Could not fetch blacklist: {e}")

    async def is_market_blacklisted(self, market_id: str, title: str = "") -> bool:
        """Check if a market is in the blacklist."""
        # Simple check against cached set
        if market_id in self.blacklisted_markets:
            return True

        # Check title against keywords (only if we have keyword-style entries)
        title_lower = title.lower()
        for entry in self.blacklisted_markets:
            # Only do keyword matching for non-UUID entries (keywords are shorter)
            if len(entry) < 30 and entry in title_lower and len(entry) > 3:
                return True

        return False

    async def check_subscription(self) -> bool:
        """
        Check if the user has an active subscription.
        Returns True if active, False otherwise.
        """
        if not self.user_id:
            return True # Legacy/Global mode is always active

        try:
            # Query polybot_profiles - note: column is 'id' not 'user_id'
            response = self.db._client.table("polybot_profiles").select(
                "subscription_status"
            ).eq("id", self.user_id).single().execute()

            if not response.data:
                logger.warning(f"No profile found for user {self.user_id}")
                return False

            status = response.data.get("subscription_status", "inactive")

            # Valid statuses: active, trial, comped (complimentary access)
            if status in ["active", "trial", "comped", "trialing"]:
                return True
            else:
                logger.warning(f"Subscription status '{status}' is not valid for trading.")
                return False

        except Exception as e:
            logger.error(f"Error checking subscription: {e}")
            return False



    async def _handle_ai_forecast(self, forecast: AIForecast):
        """Handle AI forecast by sending to High Conviction strategy"""
        if not self.high_conviction_strategy or not self.high_conviction_strategy.enabled:
            return

        # Create signal
        signal = self.high_conviction_strategy.create_signal_from_ai_forecast(
            question=forecast.question,
            probability=forecast.ai_probability,
            confidence=forecast.ai_confidence,
            model=forecast.model_used,
        )

        # Add to strategy
        # Use market_id or question hash as key
        market_id = getattr(forecast, 'market_id', forecast.question)
        self.high_conviction_strategy.add_signal(market_id, signal)

    async def _handle_news_opportunity(self, opp: NewsArbOpportunity):
        """Handle news opportunity by sending to High Conviction strategy"""
        if not self.high_conviction_strategy or not self.high_conviction_strategy.enabled:
            return

        # Create signal directly? Accessing helper might be cleaner if exposed,
        # but we can create Signal directly here or add helper to strategy.
        # HighConvictionStrategy has `create_signal_from_news`.

        signal = self.high_conviction_strategy.create_signal_from_news(
            sentiment=opp.confidence if opp.direction.startswith('buy') else -opp.confidence,
            headline=opp.event.headline,
        )

        # Use topic/market identifier
        # NewsArbOpportunity usually has 'topic' or we use the headline/keywords
        market_id = f"news_{opp.event.keywords[0] if opp.event.keywords else 'unknown'}"

        self.high_conviction_strategy.add_signal(market_id, signal)

    async def _handle_spike_opportunity(self, opp: SpikeOpportunity):
        """Handle spike opportunity detected by Spike Hunter strategy."""
        logger.info(
            f"⚡ SPIKE DETECTED: {opp.spike_type.value} on {opp.market_id[:30]}..."
        )
        logger.info(
            f"  📈 Magnitude: {opp.spike_magnitude_pct:.1f}% in "
            f"{opp.spike_duration_sec:.1f}s"
        )
        logger.info(
            f"  💰 Entry: {opp.entry_side} @ ${opp.entry_price:.3f} | "
            f"Target: ${opp.target_price:.3f}"
        )

        # Log to database
        try:
            self.db.log_opportunity({
                "id": opp.id,
                "buy_platform": opp.platform,
                "sell_platform": opp.platform,
                "buy_market_id": opp.market_id,
                "sell_market_id": opp.market_id,
                "buy_market_name": opp.market_title[:200],
                "sell_market_name": f"Spike {opp.spike_type.value}",
                "buy_price": float(opp.entry_price),
                "sell_price": float(opp.target_price),
                "profit_percent": float(opp.expected_profit_pct),
                "total_profit": float(
                    opp.position_size_usd * opp.expected_profit_pct / 100
                ),
                "max_size": float(opp.position_size_usd),
                "confidence": 0.7,  # Spike trading has moderate confidence
                "strategy": "spike_hunter",
                "detected_at": opp.detected_at.isoformat(),
                "status": "detected",
            })
        except Exception as e:
            logger.error(f"Error logging spike opportunity: {e}")

        # Execute paper trade in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                # Paper trade the spike
                result = await self.paper_trader.execute_paper_trade(
                    strategy="spike_hunter",
                    platform=opp.platform,
                    market_id=opp.market_id,
                    market_title=opp.market_title,
                    side=opp.entry_side,
                    price=opp.entry_price,
                    size_usd=opp.position_size_usd,
                    confidence=0.7,
                )
                if result.get("success"):
                    logger.info(
                        f"  ✅ Paper trade executed: {result.get('shares', 0):.2f} "
                        f"shares @ ${result.get('fill_price', 0):.3f}"
                    )
                    # Enter position in spike hunter for tracking
                    self.spike_hunter.enter_position(opp)
                else:
                    logger.warning(
                        f"  ⚠️ Paper trade failed: {result.get('reason', 'Unknown')}"
                    )
            except Exception as e:
                logger.error(f"Error executing spike paper trade: {e}")

    async def initialize(self):
        """Initialize all enabled features."""
        logger.info(f"Initializing PolyBot features (User: {self.user_id or 'Global'})...")

        # Setup per-instance logging context if user_id is present
        if self.user_id:
            # We add a specific handler for this user context if needed,
            # or rely on the fact that existing logging might be global.
            # ideally, we'd want per-user logs.
            pass

        # Fetch initial balances
        logger.info("Fetching wallet balances...")
        await self.fetch_balances()

        # Fetch blacklisted markets
        await self.refresh_blacklist()

        # Check subscription status (Multi-tenant)
        if self.user_id:
            if not await self.check_subscription():
                logger.error(f"❌ Subscription check failed for user {self.user_id}. Stopping initialization.")
                return

        if self.enable_copy_trading:
            self.copy_trading = CopyTradingEngine(
                max_copy_size=100.0,
                min_copy_size=5.0,
                check_interval=60,
            )
            # Add tracked traders
            for trader in self.tracked_traders:
                if isinstance(trader, dict):
                    self.copy_trading.add_trader(
                        trader.get('address', ''),
                        trader.get('name', 'Unknown'),
                        trader.get('multiplier', 0.1),
                    )
                else:
                    self.copy_trading.add_trader(trader, 'Trader', 0.1)
            logger.info("✓ Copy Trading Engine initialized")

        if self.enable_arb_detection:
            self.arb_detector = OverlappingArbDetector(
                min_liquidity=10000,  # Increased from 5000
                min_deviation=5.0,    # Increased from 3.0 - require higher deviation
                check_interval=180,   # Increased from 120 - less frequent scanning
            )
            logger.info("✓ Overlapping Arbitrage Detector initialized (tuned)")
            logger.info("  📊 min_deviation=5%, min_liquidity=$10K, confidence>=0.6")

        if self.enable_position_manager and self.wallet_address:
            self.position_manager = PositionManager(
                wallet_address=self.wallet_address,
                private_key=self.private_key if not self.simulation_mode else None,
                auto_claim=not self.simulation_mode,
                check_interval=300,
            )
            logger.info("✓ Position Manager initialized")

        if self.enable_news_sentiment:
            self.news_engine = NewsSentimentEngine(
                news_api_key=self.news_api_key,
                finnhub_api_key=self.finnhub_api_key,
                twitter_bearer_token=self.twitter_bearer_token,
                check_interval=300,
                db_client=self.db,  # Save news to polybot_news_items
            )
            logger.info("✓ News/Sentiment Engine initialized (saves to DB)")

        # Initialize cross-platform arbitrage detector
        self.cross_platform_detector = ArbitrageDetector(
            min_profit_percent=0.5,  # 0.5% minimum profit to consider
            min_confidence=0.3,
        )
        logger.info("✓ Cross-Platform Arbitrage Detector initialized")

        # Initialize cross-platform scanner (the REAL arbitrage finder)
        self.cross_platform_scanner = CrossPlatformScanner(
            min_profit_percent=3.0,  # 3% minimum for Poly buy, 5% for Kalshi buy
            scan_interval=120,  # Scan every 2 minutes
            db_client=self.db,  # Log ALL cross-platform scans to Supabase
        )
        logger.info("✓ Cross-Platform Scanner initialized (Polymarket↔Kalshi)")
        logger.info("  📝 Logging ALL cross-platform scans to polybot_market_scans")

        # Initialize single-platform scanner (where the REAL money is!)
        # Academic research shows $40M extracted from Polymarket in 1 year
        # Pass db_client so ALL scans get logged (not just qualifying ones)
        # Use per-strategy config from Supabase (different thresholds for each platform)
        self.single_platform_scanner = SinglePlatformScanner(
            min_profit_pct=0.5,  # Default fallback
            scan_interval_seconds=60,  # Scan every minute
            on_opportunity=self.on_single_platform_opportunity,
            db_client=self.db,  # Log ALL market scans to Supabase
            # Per-platform thresholds from Supabase config
            poly_min_profit_pct=self.config.trading.poly_single_min_profit_pct,
            poly_max_spread_pct=self.config.trading.poly_single_max_spread_pct,
            poly_max_position_usd=self.config.trading.poly_single_max_position_usd,
            kalshi_min_profit_pct=self.config.trading.kalshi_single_min_profit_pct,
            kalshi_max_spread_pct=self.config.trading.kalshi_single_max_spread_pct,
            kalshi_max_position_usd=self.config.trading.kalshi_single_max_position_usd,
            # CRITICAL: Filter out long-dated markets (prevents year-long bets!)
            max_days_to_expiration=self.config.trading.max_days_to_expiration,
        )
        logger.info("✓ Single-Platform Scanner initialized (intra-market arb)")
        logger.info("  📝 Logging ALL market scans to polybot_market_scans")
        logger.info(
            f"  📊 Poly min: {self.config.trading.poly_single_min_profit_pct}% | "
            f"Kalshi min: {self.config.trading.kalshi_single_min_profit_pct}%"
        )
        logger.info(
            f"  📅 Max days to expiration: {self.config.trading.max_days_to_expiration}"
        )

        # Log arbitrage strategy configuration (from Supabase)
        poly_single = self.config.trading.enable_polymarket_single_arb
        kalshi_single = self.config.trading.enable_kalshi_single_arb
        cross_plat = self.config.trading.enable_cross_platform_arb
        logger.info(
            f"📊 Arbitrage Strategies (from Supabase): "
            f"Poly-Single={'ON' if poly_single else 'OFF'} | "
            f"Kalshi-Single={'ON' if kalshi_single else 'OFF'} | "
            f"Cross-Platform={'ON' if cross_plat else 'OFF'}"
        )

        # =====================================================================
        # ADVANCED STRATEGIES: Market Making & News Arbitrage
        # =====================================================================

        # Initialize Market Making Strategy (if enabled)
        if self.config.trading.enable_market_making:
            self.market_maker = MarketMakerStrategy(
                polymarket_client=self.polymarket_client,
                db_client=self.db,
                target_spread_bps=self.config.trading.mm_target_spread_bps,
                min_spread_bps=self.config.trading.mm_min_spread_bps,
                max_spread_bps=self.config.trading.mm_max_spread_bps,
                order_size_usd=self.config.trading.mm_order_size_usd,
                max_inventory_usd=self.config.trading.mm_max_inventory_usd,
                inventory_skew_factor=self.config.trading.mm_inventory_skew_factor,
                quote_refresh_sec=self.config.trading.mm_quote_refresh_sec,
                min_volume_24h=self.config.trading.mm_min_volume_24h,
                max_markets=self.config.trading.mm_max_markets,
            )
            logger.info("✓ Market Maker initialized (10-20% APR strategy)")
            logger.info(
                f"  💰 Spread: {self.config.trading.mm_target_spread_bps}bps | "
                f"Size: ${self.config.trading.mm_order_size_usd}"
            )
        else:
            logger.info("⏸️ Market Making DISABLED")

        # Initialize News Arbitrage Strategy (if enabled)
        if self.config.trading.enable_news_arbitrage:
            # Parse keywords from comma-separated string
            keywords_str = self.config.trading.news_keywords
            keywords = set(k.strip().lower() for k in keywords_str.split(","))

            self.news_arbitrage = NewsArbitrageStrategy(
                polymarket_client=self.polymarket_client,
                kalshi_client=self.kalshi_client,
                db_client=self.db,
                min_spread_pct=self.config.trading.news_min_spread_pct,
                max_lag_minutes=self.config.trading.news_max_lag_minutes,
                position_size_usd=self.config.trading.news_position_size_usd,
                scan_interval_sec=self.config.trading.news_scan_interval_sec,
                keywords=keywords,
                on_opportunity=self._handle_news_opportunity,
                # Pass news API keys for enhanced coverage
                news_api_key=self.news_api_key,
                finnhub_api_key=self.finnhub_api_key,
                twitter_bearer_token=self.twitter_bearer_token,
            )
            logger.info("✓ News Arbitrage initialized (5-30% per event)")
            logger.info(f"  🔑 Keywords: {keywords_str[:50]}...")
            # Log which news sources are enabled
            sources = ["RSS"]
            if self.news_api_key:
                sources.append("NewsAPI")
            if self.finnhub_api_key:
                sources.append("Finnhub")
            if self.twitter_bearer_token:
                sources.append("Twitter/X")
            logger.info(f"  📰 News sources: {', '.join(sources)}")
        else:
            logger.info("⏸️ News Arbitrage DISABLED")

        # =====================================================================
        # HIGH-PRIORITY CRYPTO STRATEGIES: Funding Rate, Grid, Pairs Trading
        # =====================================================================

        # Initialize CCXT client for crypto exchange access
        # Used by all crypto strategies
        any_crypto_enabled = (
            self.config.trading.enable_funding_rate_arb or
            self.config.trading.enable_grid_trading or
            self.config.trading.enable_pairs_trading
        )

        if any_crypto_enabled:
            # Check which exchanges are enabled
            enabled_exchanges = []
            if self.config.trading.enable_binance:
                enabled_exchanges.append("binance")
            if self.config.trading.enable_bybit:
                enabled_exchanges.append("bybit")
            if self.config.trading.enable_okx:
                enabled_exchanges.append("okx")
            if self.config.trading.enable_kraken:
                enabled_exchanges.append("kraken")
            if self.config.trading.enable_coinbase:
                enabled_exchanges.append("coinbase")
            if self.config.trading.enable_kucoin:
                enabled_exchanges.append("kucoin")

            if enabled_exchanges:
                # MULTI-EXCHANGE: Initialize ALL enabled exchanges (not just first success)
                # This allows strategies to pick the best exchange for each trade
                logger.info(
                    f"🔍 Initializing {len(enabled_exchanges)} exchanges: {enabled_exchanges}"
                )

                for exchange in enabled_exchanges:
                    client = None

                    # Multi-tenant: try per-user credentials first
                    if self.user_id:
                        client = await CCXTClient.create_for_user(
                            exchange_id=exchange,
                            user_id=self.user_id,
                            sandbox=False,
                            db_client=self.db
                        )
                        if client:
                            self.ccxt_clients[exchange] = client
                            logger.info(
                                f"  ✓ {exchange} connected (user credentials)"
                            )
                            continue  # Next exchange

                    # Fall back to global credentials
                    creds = self.db.get_exchange_credentials(exchange)
                    has_key = bool(creds.get('api_key'))
                    has_secret = bool(creds.get('api_secret'))

                    if has_key and has_secret:
                        logger.info(f"  Attempting {exchange}...")
                        client = CCXTClient(
                            exchange_id=exchange,
                            api_key=creds.get('api_key'),
                            api_secret=creds.get('api_secret'),
                            password=creds.get('password'),
                            sandbox=False,
                            user_id=self.user_id,
                        )
                        if await client.initialize():
                            self.ccxt_clients[exchange] = client
                            logger.info(f"  ✓ {exchange} connected")
                        else:
                            logger.warning(f"  ⚠️ {exchange} failed to connect")
                    else:
                        logger.info(
                            f"  ⏭️ {exchange} skipped (no credentials)"
                        )

                # Simulation mode fallback: try read-only exchanges if none connected
                if not self.ccxt_clients and self.simulation_mode:
                    logger.info("  Trying read-only exchanges (simulation mode)...")
                    fallback_exchanges = ["okx", "kraken", "kucoin", "gate"]
                    for exchange in fallback_exchanges:
                        logger.info(f"  Attempting {exchange} (read-only)...")
                        client = CCXTClient(
                            exchange_id=exchange,
                            api_key=None,
                            api_secret=None,
                            sandbox=False,
                        )
                        if await client.initialize():
                            self.ccxt_clients[exchange] = client
                            logger.info(f"  ✓ {exchange} connected (read-only)")
                            break  # One read-only fallback is enough
                        else:
                            client = None

                # Summary
                if self.ccxt_clients:
                    logger.info(
                        f"✓ CCXT Multi-Exchange: {len(self.ccxt_clients)} connected: "
                        f"{list(self.ccxt_clients.keys())}"
                    )
                    # Set primary client for backward compatibility with strategies
                    # that don't support multi-exchange yet
                    self.ccxt_client = next(iter(self.ccxt_clients.values()))
                else:
                    logger.error(
                        "❌ All CCXT exchanges failed - crypto strategies disabled"
                    )
                    logger.info(
                        "  💡 This may be due to geoblocking. Try enabling OKX, Kraken, or KuCoin."
                    )
            else:
                logger.warning(
                    "⚠️ Crypto strategies enabled but no exchanges enabled!"
                )

        # Initialize Funding Rate Arbitrage Strategy (85% CONFIDENCE - 15-50% APY)
        # NOTE: Requires exchange with futures support (Binance US does NOT have futures)
        has_futures = False
        if self.ccxt_client and hasattr(self.ccxt_client, 'exchange') and self.ccxt_client.exchange:
            has_futures = self.ccxt_client.exchange.has.get('fetchFundingRate', False)

        if self.config.trading.enable_funding_rate_arb and self.ccxt_client and has_futures:
            self.funding_rate_arb = FundingRateArbStrategy(
                ccxt_client=self.ccxt_client,
                db_client=self.db,
                min_funding_rate_pct=self.config.trading.funding_min_rate_pct,
                min_annualized_apy=self.config.trading.funding_min_apy,
                max_position_usd=self.config.trading.funding_max_position_usd,
                max_positions=self.config.trading.funding_max_positions,
                max_leverage=self.config.trading.funding_max_leverage,
                scan_interval_sec=self.config.trading.funding_scan_interval_sec,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Funding Rate Arb initialized (85% CONFIDENCE)")
            logger.info(
                f"  💰 Min rate: {self.config.trading.funding_min_rate_pct}% | "
                f"Min APY: {self.config.trading.funding_min_apy}%"
            )
        elif self.config.trading.enable_funding_rate_arb and self.ccxt_client and not has_futures:
            logger.info("⏸️ Funding Rate Arb DISABLED (exchange doesn't support futures)")
            logger.info(f"  💡 {getattr(self.ccxt_client, 'exchange_id', 'exchange')} is spot-only")
        elif self.config.trading.enable_funding_rate_arb:
            logger.info("⏸️ Funding Rate Arb DISABLED (no CCXT client)")
        else:
            logger.info("⏸️ Funding Rate Arb DISABLED")

        # Initialize Grid Trading Strategy (75% CONFIDENCE - 20-60% APY)
        if self.config.trading.enable_grid_trading and self.ccxt_client:
            self.grid_trading = GridTradingStrategy(
                ccxt_client=self.ccxt_client,
                db_client=self.db,
                default_range_pct=self.config.trading.grid_default_range_pct,
                default_grid_levels=self.config.trading.grid_default_levels,
                default_investment_usd=self.config.trading.grid_default_investment_usd,
                max_grids=self.config.trading.grid_max_grids,
                stop_loss_pct=self.config.trading.grid_stop_loss_pct,
                take_profit_pct=self.config.trading.grid_take_profit_pct,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Grid Trading initialized (75% CONFIDENCE)")
            logger.info(
                f"  📊 Range: ±{self.config.trading.grid_default_range_pct}% | "
                f"Levels: {self.config.trading.grid_default_levels}"
            )
        elif self.config.trading.enable_grid_trading:
            logger.info("⏸️ Grid Trading DISABLED (no CCXT client)")
        else:
            logger.info("⏸️ Grid Trading DISABLED")

        # Initialize Pairs Trading Strategy (65% CONFIDENCE - 10-25% APY)
        if self.config.trading.enable_pairs_trading and self.ccxt_client:
            # Detect exchange to use correct symbol format
            exchange_id = getattr(self.ccxt_client, 'exchange_id', 'binance')
            is_us_exchange = 'us' in exchange_id.lower()

            # Choose pairs based on exchange
            if is_us_exchange:
                # Binance US uses /USD pairs
                candidate_pairs = [
                    ("BTC/USD", "ETH/USD", "BTC-ETH", 0.85, 15.0),
                    ("SOL/USD", "AVAX/USD", "SOL-AVAX", 0.78, 3.5),
                ]
            else:
                # International exchanges use /USDT pairs
                candidate_pairs = [
                    ("BTC/USDT", "ETH/USDT", "BTC-ETH", 0.85, 15.0),
                    ("SOL/USDT", "AVAX/USDT", "SOL-AVAX", 0.78, 3.5),
                    ("LINK/USDT", "UNI/USDT", "LINK-UNI", 0.72, 1.8),
                ]

            # Filter pairs to only those with valid symbols on exchange
            custom_pairs = []
            if hasattr(self.ccxt_client, 'has_symbol'):
                for pair in candidate_pairs:
                    sym1, sym2, name, corr, hr = pair
                    if self.ccxt_client.has_symbol(sym1) and self.ccxt_client.has_symbol(sym2):
                        custom_pairs.append(pair)
                    else:
                        logger.debug(f"Skipping pair {name}: symbols not available")
            else:
                custom_pairs = candidate_pairs

            if not custom_pairs:
                logger.info("⏸️ Pairs Trading DISABLED (no valid pairs on exchange)")
            else:
                self.pairs_trading = PairsTradingStrategy(
                    ccxt_client=self.ccxt_client,
                    db_client=self.db,
                    entry_zscore=self.config.trading.pairs_entry_zscore,
                    exit_zscore=self.config.trading.pairs_exit_zscore,
                    position_size_usd=self.config.trading.pairs_position_size_usd,
                    max_positions=self.config.trading.pairs_max_positions,
                    max_hold_hours=self.config.trading.pairs_max_hold_hours,
                    custom_pairs=custom_pairs,
                    dry_run=self.simulation_mode,
                )
                logger.info("✓ Pairs Trading initialized (65% CONFIDENCE)")
                logger.info(
                    f"  📈 Entry z: {self.config.trading.pairs_entry_zscore} | "
                    f"Exit z: {self.config.trading.pairs_exit_zscore}"
                )
                logger.info(f"  🔗 Pairs: {[p[2] for p in custom_pairs]}")
        elif self.config.trading.enable_pairs_trading:
            logger.info("⏸️ Pairs Trading DISABLED (no CCXT client)")
        else:
            logger.info("⏸️ Pairs Trading DISABLED")

        # =====================================================================
        # STOCK STRATEGIES (Alpaca)
        # Multi-tenant: Per-user credentials from user_exchange_credentials
        # Falls back to global secrets if no per-user credentials
        # =====================================================================

        if self.config.trading.enable_alpaca:
            # Try multi-tenant approach first (per-user credentials)
            if self.user_id:
                self.alpaca_client = await AlpacaClient.create_for_user(
                    user_id=self.user_id,
                    paper=self.simulation_mode,
                    db_client=self.db
                )
                if self.alpaca_client:
                    mode_str = 'PAPER' if self.simulation_mode else 'LIVE'
                    logger.info(
                        f"✓ Alpaca client initialized ({mode_str}) "
                        f"- per-user credentials for {self.user_id}"
                    )

            # Fall back to global credentials (legacy behavior)
            if not self.alpaca_client:
                alpaca_creds = self.db.get_alpaca_credentials(
                    is_paper=self.simulation_mode
                )
                alpaca_api_key = alpaca_creds.get('api_key')
                alpaca_api_secret = alpaca_creds.get('api_secret')

                if alpaca_api_key and alpaca_api_secret:
                    self.alpaca_client = AlpacaClient(
                        api_key=alpaca_api_key,
                        api_secret=alpaca_api_secret,
                        paper=self.simulation_mode,
                        user_id=self.user_id,
                    )
                    alpaca_initialized = await self.alpaca_client.initialize()
                    if alpaca_initialized:
                        mode_str = 'PAPER' if self.simulation_mode else 'LIVE'
                        logger.info(
                            f"✓ Alpaca client initialized ({mode_str}) "
                            f"- global credentials"
                        )
                    else:
                        logger.error(
                            "❌ Alpaca client failed to initialize - "
                            "stock strategies will not work"
                        )
                        self.alpaca_client = None

        # Initialize IBKR Client (Interactive Brokers)
        # Uses IBKRWebClient for cloud deployment (no gateway container needed)
        # Falls back to IBKRClient if user has local IB Gateway running
        if self.config.trading.enable_ibkr:
            logger.info("Initializing IBKR integration...")

            # Try Web API first (works without gateway container)
            try:
                # For multi-tenant, we'd pass user_id here
                # For now, use default/admin user
                self.ibkr_client = IBKRWebClient(
                    sandbox=self.simulation_mode
                )
                ibkr_initialized = await self.ibkr_client.initialize()

                if ibkr_initialized:
                    logger.info(
                        "✓ IBKR Web API Client initialized "
                        f"({'PAPER' if self.simulation_mode else 'LIVE'} mode)"
                    )
                else:
                    # Web API not configured, try legacy gateway
                    logger.info(
                        "IBKR Web API not configured, "
                        "trying legacy IB Gateway..."
                    )
                    ibkr_port = 4002 if self.simulation_mode else 4001
                    self.ibkr_client = IBKRClient(
                        host='localhost',
                        port=ibkr_port,
                        sandbox=self.simulation_mode
                    )
                    ibkr_initialized = await self.ibkr_client.initialize()

                    if ibkr_initialized:
                        logger.info(
                            f"✓ IBKR Gateway Client on port {ibkr_port}"
                        )
                    else:
                        if self.simulation_mode:
                            logger.info(
                                "⏸️ IBKR not available - "
                                "continuing without IBKR in simulation mode"
                            )
                        else:
                            logger.error(
                                "❌ IBKR Client failed to initialize. "
                                "Check Web API tokens or IB Gateway."
                            )
                        self.ibkr_client = None
            except Exception as e:
                logger.error(f"IBKR initialization failed: {e}")
                self.ibkr_client = None
        else:
            logger.info("⏸️ IBKR Client DISABLED (enable_ibkr=False)")

        # =====================================================================
        # WEBULL CLIENT
        # =====================================================================
        if getattr(self.config.trading, 'enable_webull', False):
            try:
                from src.exchanges.webull_client import WebullClient
                if WebullClient and self.user_id:
                    self.webull_client = await WebullClient.create_for_user(
                        user_id=self.user_id,
                        paper=self.simulation_mode,
                        db_client=self.db
                    )
                    if self.webull_client:
                        mode_str = 'PAPER' if self.simulation_mode else 'LIVE'
                        logger.info(f"✓ Webull client initialized ({mode_str})")
                    else:
                        logger.info(
                            "⏸️ Webull - no credentials for this user"
                        )
                else:
                    logger.debug("Webull client not available")
            except ImportError:
                logger.info("⏸️ Webull DISABLED (webull not installed)")
            except Exception as e:
                logger.error(f"Webull initialization failed: {e}")
        else:
            logger.info("⏸️ Webull Client DISABLED")

        # Initialize IBKR Futures Momentum
        ibkr_futures_enabled = getattr(self.config.trading, 'enable_ibkr_futures_momentum', False)
        if ibkr_futures_enabled and self.ibkr_client:
             self.ibkr_futures_momentum = IBKRFuturesMomentumStrategy(
                 ibkr_client=self.ibkr_client,
                 db_client=self.db,
                 symbol=getattr(self.config.trading, 'ibkr_futures_symbol', 'ES')
             )
             logger.info(f"✓ IBKR Futures Momentum initialized (Symbol: {self.ibkr_futures_momentum.config.symbol})")
        elif ibkr_futures_enabled:
             logger.warning("⚠️ IBKR Futures Momentum DISABLED - No IBKR Client")
        else:
             logger.info("⏸️ IBKR Futures Momentum DISABLED")

        # Initialize Stock Mean Reversion Strategy (70% CONFIDENCE - 15-30% APY)
        if self.config.trading.enable_stock_mean_reversion and self.alpaca_client:
            watchlist = self.config.trading.stock_mr_watchlist.split(",")
            self.stock_mean_reversion = StockMeanReversionStrategy(
                alpaca_client=self.alpaca_client,
                db_client=self.db,
                watchlist=watchlist,
                lookback_period=self.config.trading.stock_mr_lookback_period,
                entry_threshold=self.config.trading.stock_mr_entry_zscore,
                exit_threshold=self.config.trading.stock_mr_exit_zscore,
                max_position_size=self.config.trading.stock_mr_position_size_usd,
                max_positions=self.config.trading.stock_mr_max_positions,
                stop_loss_pct=self.config.trading.stock_mr_stop_loss_pct,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Stock Mean Reversion initialized (70% CONFIDENCE)")
            logger.info(
                f"  📉 Entry z: {self.config.trading.stock_mr_entry_zscore} | "
                f"Exit z: {self.config.trading.stock_mr_exit_zscore}"
            )
            logger.info(f"  📊 Watchlist: {len(watchlist)} stocks")
        elif self.config.trading.enable_stock_mean_reversion:
            logger.info("⏸️ Stock Mean Reversion DISABLED (no Alpaca client)")
        else:
            logger.info("⏸️ Stock Mean Reversion DISABLED")

        # Initialize Stock Momentum Strategy (70% CONFIDENCE - 20-40% APY)
        if self.config.trading.enable_stock_momentum and self.alpaca_client:
            universe = self.config.trading.stock_mom_watchlist.split(",")
            self.stock_momentum = StockMomentumStrategy(
                alpaca_client=self.alpaca_client,
                db_client=self.db,
                universe=universe,
                min_momentum_score=self.config.trading.momentum_min_score,
                trailing_stop_pct=self.config.trading.stock_mom_stop_loss_pct,
                max_position_size=self.config.trading.stock_mom_position_size_usd,
                max_positions=self.config.trading.stock_mom_max_positions,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Stock Momentum initialized (70% CONFIDENCE)")
            logger.info(f"  📈 Min momentum score: 70.0")
            logger.info(f"  📊 Universe: {len(universe)} stocks")
        elif self.config.trading.enable_stock_momentum:
            logger.info("⏸️ Stock Momentum DISABLED (no Alpaca client)")
        else:
            logger.info("⏸️ Stock Momentum DISABLED")

        # =====================================================================
        # ADDITIONAL STOCK STRATEGIES (Require Alpaca)
        # =====================================================================

        # Initialize Sector Rotation Strategy (70% CONFIDENCE - 15-25% APY)
        sector_rotation_enabled = getattr(
            self.config.trading, 'enable_sector_rotation', False
        )
        if sector_rotation_enabled and self.alpaca_client:
            self.sector_rotation = SectorRotationStrategy(
                alpaca_client=self.alpaca_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Sector Rotation initialized (70% CONFIDENCE)")
            logger.info("  📊 Rotates into strongest sector ETFs")
        elif sector_rotation_enabled:
            logger.info("⏸️ Sector Rotation DISABLED (no Alpaca client)")
        else:
            logger.info("⏸️ Sector Rotation DISABLED")

        # Initialize Dividend Growth Strategy (65% CONFIDENCE - 10-20% APY)
        dividend_growth_enabled = getattr(
            self.config.trading, 'enable_dividend_growth', False
        )
        if dividend_growth_enabled and self.alpaca_client:
            self.dividend_growth = DividendGrowthStrategy(
                alpaca_client=self.alpaca_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Dividend Growth initialized (65% CONFIDENCE)")
            logger.info("  💰 Dividend aristocrats + growth")
        elif dividend_growth_enabled:
            logger.info("⏸️ Dividend Growth DISABLED (no Alpaca client)")
        else:
            logger.info("⏸️ Dividend Growth DISABLED")

        # Initialize Earnings Momentum Strategy (70% CONFIDENCE - 20-40% APY)
        earnings_momentum_enabled = getattr(
            self.config.trading, 'enable_earnings_momentum', False
        )
        if earnings_momentum_enabled and self.alpaca_client:
            self.earnings_momentum = EarningsMomentumStrategy(
                alpaca_client=self.alpaca_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Earnings Momentum initialized (70% CONFIDENCE)")
            logger.info("  📈 Post-earnings drift strategy")
        elif earnings_momentum_enabled:
            logger.info("⏸️ Earnings Momentum DISABLED (no Alpaca client)")
        else:
            logger.info("⏸️ Earnings Momentum DISABLED")

        # =====================================================================
        # OPTIONS STRATEGIES (Require IBKR)
        # =====================================================================

        # Initialize Covered Call Strategy (75% CONFIDENCE - 15-25% APY)
        covered_call_enabled = getattr(
            self.config.trading, 'enable_covered_calls', False
        )
        if covered_call_enabled and self.ibkr_client:
            self.covered_call = CoveredCallStrategy(
                ibkr_client=self.ibkr_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Covered Calls initialized (75% CONFIDENCE)")
            logger.info("  📝 Sell calls against stock positions")
        elif covered_call_enabled:
            logger.info("⏸️ Covered Calls DISABLED (no IBKR client)")
        else:
            logger.info("⏸️ Covered Calls DISABLED")

        # Initialize Cash Secured Put Strategy (75% CONFIDENCE - 15-25% APY)
        csp_enabled = getattr(
            self.config.trading, 'enable_cash_secured_puts', False
        )
        if csp_enabled and self.ibkr_client:
            self.cash_secured_put = CashSecuredPutStrategy(
                ibkr_client=self.ibkr_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Cash Secured Puts initialized (75% CONFIDENCE)")
            logger.info("  💵 Sell puts with cash collateral")
        elif csp_enabled:
            logger.info("⏸️ Cash Secured Puts DISABLED (no IBKR client)")
        else:
            logger.info("⏸️ Cash Secured Puts DISABLED")

        # Initialize Iron Condor Strategy (70% CONFIDENCE - 20-30% APY)
        iron_condor_enabled = getattr(
            self.config.trading, 'enable_iron_condor', False
        )
        if iron_condor_enabled and self.ibkr_client:
            self.iron_condor = IronCondorStrategy(
                ibkr_client=self.ibkr_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Iron Condor initialized (70% CONFIDENCE)")
            logger.info("  🦅 Sell OTM call & put spreads")
        elif iron_condor_enabled:
            logger.info("⏸️ Iron Condor DISABLED (no IBKR client)")
        else:
            logger.info("⏸️ Iron Condor DISABLED")

        # Initialize Wheel Strategy (80% CONFIDENCE - 20-35% APY)
        wheel_enabled = getattr(
            self.config.trading, 'enable_wheel_strategy', False
        )
        if wheel_enabled and self.ibkr_client:
            self.wheel_strategy = WheelStrategy(
                ibkr_client=self.ibkr_client,
                db_client=self.db,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Wheel Strategy initialized (80% CONFIDENCE)")
            logger.info("  🎡 CSP → Assignment → CC cycle")
        elif wheel_enabled:
            logger.info("⏸️ Wheel Strategy DISABLED (no IBKR client)")
        else:
            logger.info("⏸️ Wheel Strategy DISABLED")

        # =====================================================================
        # TWITTER-DERIVED STRATEGIES (2024)
        # High-conviction strategies from analyzing top traders on X/Twitter
        # =====================================================================

        # Initialize BTC Bracket Arbitrage (85% CONFIDENCE - $20K-200K/month)
        btc_bracket_enabled = getattr(self.config.trading, 'enable_btc_bracket_arb', False)
        if btc_bracket_enabled:
            self.btc_bracket_arb = BTCBracketArbStrategy(
                db_client=self.db,
                min_profit_pct=getattr(
                    self.config.trading, 'btc_bracket_min_discount_pct', 0.5
                ),
                max_position_usd=getattr(
                    self.config.trading, 'btc_bracket_max_position_usd', 50
                ),
                scan_interval_seconds=getattr(
                    self.config.trading, 'btc_bracket_scan_interval_sec', 15
                ),
            )
            logger.info("✓ BTC Bracket Arb initialized (85% CONFIDENCE)")
            logger.info("  🔥 15-min brackets | YES+NO < $1.00 arbitrage")
        else:
            logger.info("⏸️ BTC Bracket Arb DISABLED")

        # Initialize Bracket Compression (70% CONFIDENCE - 15-30% APY)
        bracket_compression_enabled = getattr(
            self.config.trading, 'enable_bracket_compression', False
        )
        if bracket_compression_enabled:
            self.bracket_compression = BracketCompressionStrategy(
                db_client=self.db,
                # Config has 'bracket_max_imbalance_threshold', map to strategy's 'entry_z_score'
                entry_z_score=getattr(
                    self.config.trading, 'bracket_max_imbalance_threshold', 0.30
                ) * 6.67,  # Convert 0.30 imbalance threshold to ~2.0 z-score
                min_profit_pct=getattr(
                    self.config.trading, 'bracket_take_profit_pct', 2.0
                ),
                stop_loss_pct=getattr(
                    self.config.trading, 'bracket_stop_loss_pct', 5.0
                ),
                max_position_usd=getattr(
                    self.config.trading, 'bracket_max_position_usd', 100
                ),
            )
            logger.info("✓ Bracket Compression initialized (70% CONFIDENCE)")
            logger.info("  📊 Mean reversion on stretched brackets")
        else:
            logger.info("⏸️ Bracket Compression DISABLED")

        # Initialize Kalshi Mention Sniper (80% CONFIDENCE - $120+/event)
        kalshi_snipe_enabled = getattr(
            self.config.trading, 'enable_kalshi_mention_snipe', False
        )
        if kalshi_snipe_enabled and self.kalshi_api_key:
            self.kalshi_mention_sniper = KalshiMentionSnipeStrategy(
                db_client=self.db,
                # Config has 'kalshi_snipe_min_profit_cents', convert to pct
                min_profit_pct=getattr(
                    self.config.trading, 'kalshi_snipe_min_profit_cents', 2
                ) / 100.0,  # Convert cents to percentage
                max_position_usd=getattr(
                    self.config.trading, 'kalshi_snipe_max_position_usd', 100
                ),
                scan_interval_seconds=getattr(
                    self.config.trading, 'kalshi_snipe_scan_interval_sec', 5
                ),
            )
            logger.info("✓ Kalshi Mention Sniper initialized (80% CONFIDENCE)")
            logger.info("  ⚡ Fast execution on resolved mention markets")
        elif kalshi_snipe_enabled:
            logger.info("⏸️ Kalshi Mention Sniper DISABLED (no Kalshi credentials)")
        else:
            logger.info("⏸️ Kalshi Mention Sniper DISABLED")

        # Initialize Whale Copy Trading (75% CONFIDENCE - 25-50% APY)
        whale_copy_enabled = getattr(
            self.config.trading, 'enable_whale_copy_trading', False
        )
        if whale_copy_enabled:
            self.whale_copy_trading = WhaleCopyTradingStrategy(
                db_client=self.db,
                min_win_rate=getattr(
                    self.config.trading, 'whale_copy_min_win_rate', 70.0
                ),
                copy_delay_seconds=getattr(
                    self.config.trading, 'whale_copy_delay_seconds', 30
                ),
                max_copy_size_usd=getattr(
                    self.config.trading, 'whale_copy_max_size_usd', 100.0
                ),
            )
            logger.info("✓ Whale Copy Trading initialized (75% CONFIDENCE)")
            logger.info("  🐋 Track and copy 80%+ win rate wallets")
        else:
            logger.info("⏸️ Whale Copy Trading DISABLED")

        # Initialize Macro Board Strategy (65% CONFIDENCE - $62K/month)
        macro_board_enabled = getattr(
            self.config.trading, 'enable_macro_board', False
        )
        if macro_board_enabled:
            self.macro_board = MacroBoardStrategy(
                db_client=self.db,
                max_total_exposure_usd=getattr(
                    self.config.trading, 'macro_max_exposure_usd', 50000.0
                ),
                # Config has 'macro_min_conviction_score', map to strategy's 'min_edge_pct'
                min_edge_pct=getattr(
                    self.config.trading, 'macro_min_conviction_score', 70
                ) / 10.0,  # Convert 55-70 score to 5.5-7.0% edge
                # Config has 'macro_rebalance_interval_hours', convert to seconds
                scan_interval_seconds=getattr(
                    self.config.trading, 'macro_rebalance_interval_hours', 24
                ) * 3600,  # Convert hours to seconds
            )
            logger.info("✓ Macro Board initialized (65% CONFIDENCE)")
            logger.info("  🌍 Weighted macro event exposure")
        else:
            logger.info("⏸️ Macro Board DISABLED")

        # Initialize Fear Premium Contrarian (70% CONFIDENCE - 25-60% APY)
        fear_premium_enabled = getattr(
            self.config.trading, 'enable_fear_premium_contrarian', False
        )
        if fear_premium_enabled:
            self.fear_premium_contrarian = FearPremiumContrarianStrategy(
                db_client=self.db,
                extreme_low_threshold=getattr(
                    self.config.trading, 'fear_extreme_low_threshold', 0.15
                ),
                extreme_high_threshold=getattr(
                    self.config.trading, 'fear_extreme_high_threshold', 0.85
                ),
                min_fear_premium_pct=getattr(
                    self.config.trading, 'fear_min_premium_pct', 10
                ),
                max_position_usd=getattr(
                    self.config.trading, 'fear_max_position_usd', 200
                ),
            )
            logger.info("✓ Fear Premium Contrarian initialized (70% CONFIDENCE)")
            logger.info("  😱 Trade against extreme sentiment | 91.4% win approach")
        else:
            logger.info("⏸️ Fear Premium Contrarian DISABLED")

        # Initialize Congressional Tracker (70% CONFIDENCE - 15-40% APY)
        congress_enabled = getattr(
            self.config.trading, 'enable_congressional_tracker', False
        )
        if congress_enabled:
            # Parse tracked politicians from config
            tracked_str = getattr(
                self.config.trading, 'congress_tracked_politicians',
                'Nancy Pelosi,Tommy Tuberville,Dan Crenshaw'
            )
            tracked_list = [
                p.strip() for p in tracked_str.split(',') if p.strip()
            ] if tracked_str else None

            # Get chambers setting
            chambers_str = getattr(
                self.config.trading, 'congress_chambers', 'both'
            )
            from src.strategies.congressional_tracker import Chamber
            chambers = Chamber(chambers_str) if chambers_str else Chamber.BOTH

            self.congressional_tracker = CongressionalTrackerStrategy(
                tracked_politicians=tracked_list,
                chambers=chambers,
                copy_scale_pct=getattr(
                    self.config.trading, 'congress_copy_scale_pct', 10.0
                ),
                max_position_usd=getattr(
                    self.config.trading, 'congress_max_position_usd', 500.0
                ),
                min_trade_amount_usd=getattr(
                    self.config.trading, 'congress_min_trade_amount_usd', 15000.0
                ),
                delay_hours=getattr(
                    self.config.trading, 'congress_delay_hours', 0
                ),
                scan_interval_seconds=getattr(
                    self.config.trading, 'congress_scan_interval_hours', 6
                ) * 3600,
                db_client=self.db,
            )
            logger.info("✓ Congressional Tracker initialized (70% CONFIDENCE)")
            logger.info(f"  🏛️ Tracking: {', '.join(tracked_list or ['ALL'])}")
        else:
            logger.info("⏸️ Congressional Tracker DISABLED")

        # =================================================================
        # NEW STRATEGIES (2025)
        # =================================================================

        # Initialize Political Event Strategy (80% CONFIDENCE)
        political_event_enabled = getattr(
            self.config.trading, 'enable_political_event_strategy', False
        )
        if political_event_enabled:
            event_categories_str = getattr(
                self.config.trading, 'political_event_categories',
                'election,legislation,hearing'
            )
            event_categories = [
                c.strip() for c in event_categories_str.split(',') if c.strip()
            ]
            # Create config dict for the strategy
            political_config = {
                "enable_political_event": True,
                "political_min_conviction": getattr(self.config.trading, 'political_min_conviction', "HIGH"),
                "political_max_position_usd": getattr(self.config.trading, 'political_max_position_usd', 500.0),
                "political_use_congressional": getattr(self.config.trading, 'political_use_congressional', True),
                "political_event_lookback_hours": getattr(self.config.trading, 'political_lead_time_hours', 48)
            }

            self.political_event_strategy = PoliticalEventStrategy(
                db_client=self.db,
                config=political_config
            )
            logger.info("✓ Political Event Strategy initialized (80% CONF)")
            logger.info("  🏛️ High-conviction political event trading")
        else:
            logger.info("⏸️ Political Event Strategy DISABLED")

        # Initialize High Conviction Strategy (85% CONFIDENCE)
        high_conviction_enabled = getattr(
            self.config.trading, 'enable_high_conviction_strategy', False
        )
        if high_conviction_enabled:
            # Create config dict for High Conviction Strategy
            high_conviction_config = {
                "enable_high_conviction": True,
                "high_conviction_min_score": getattr(self.config.trading, 'high_conviction_min_score', 0.75),
                "high_conviction_max_positions": getattr(self.config.trading, 'high_conviction_max_positions', 3),
                "high_conviction_min_signals": getattr(self.config.trading, 'high_conviction_min_signals', 3),
                "high_conviction_position_pct": getattr(self.config.trading, 'high_conviction_position_pct', 15.0),
                "high_conviction_use_kelly": getattr(self.config.trading, 'high_conviction_use_kelly', True),
                "high_conviction_kelly_fraction": getattr(self.config.trading, 'high_conviction_kelly_fraction', 0.25)
            }

            self.high_conviction_strategy = HighConvictionStrategy(
                config=high_conviction_config
            )
            # Inject DB client if needed by strategy (though init didn't ask for it, maybe set it after?)
            # The init signature shows no db_client argument.
            if hasattr(self.high_conviction_strategy, 'db'):
                 self.high_conviction_strategy.db = self.db
            logger.info("✓ High Conviction Strategy initialized (85% CONF)")
            logger.info("  🎯 Fewer, higher-confidence trades")
        else:
            logger.info("⏸️ High Conviction Strategy DISABLED")

        # Initialize Selective Whale Copy Strategy (80% CONFIDENCE)
        selective_whale_enabled = getattr(
            self.config.trading, 'enable_selective_whale_copy', False
        )
        if selective_whale_enabled:
            # Create config dict for Selective Whale Copy
            whale_config = {
                "enable_selective_whale_copy": True,
                "swc_min_win_rate": getattr(self.config.trading, 'selective_whale_min_win_rate', 0.65),
                "swc_min_roi_pct": getattr(self.config.trading, 'selective_whale_min_roi', 0.20),
                "swc_min_trades": getattr(self.config.trading, 'selective_whale_min_trades', 10),
                "swc_max_days_inactive": 7, # Default hardcoded or add to config if needed
                "swc_auto_select_count": 5,
                "swc_copy_scale_pct": getattr(self.config.trading, 'selective_whale_copy_scale_pct', 5.0),
                "swc_max_copy_usd": getattr(self.config.trading, 'selective_whale_max_position_usd', 200.0),
                "swc_max_concurrent_copies": 5
            }

            self.selective_whale_copy = SelectiveWhaleCopyStrategy(
                db_client=self.db,
                config=whale_config
            )
            logger.info("✓ Selective Whale Copy initialized (80% CONF)")
            logger.info("  🐋 Performance-based whale selection")
        else:
            logger.info("⏸️ Selective Whale Copy DISABLED")

        # Initialize 15-Minute Crypto Scalping Strategy (90% CONFIDENCE)
        crypto_scalp_enabled = getattr(
            self.config.trading, 'enable_15min_crypto_scalping', False
        )
        if crypto_scalp_enabled:
            self.crypto_15min_scalping = Crypto15MinScalpingStrategy(
                entry_threshold=getattr(
                    self.config.trading, 'crypto_scalp_entry_threshold', 0.45
                ),
                max_position_usd=getattr(
                    self.config.trading, 'crypto_scalp_max_position_usd', 100.0
                ),
                scan_interval_seconds=getattr(
                    self.config.trading, 'crypto_scalp_scan_interval_sec', 2
                ),
                use_kelly_sizing=getattr(
                    self.config.trading, 'crypto_scalp_kelly_enabled', True
                ),
                kelly_fraction=getattr(
                    self.config.trading, 'crypto_scalp_kelly_fraction', 0.25
                ),
                symbols=getattr(
                    self.config.trading, 'crypto_scalp_symbols', 'BTC,ETH'
                ).split(','),
                max_concurrent_trades=getattr(
                    self.config.trading, 'crypto_scalp_max_concurrent', 3
                ),
                db_client=self.db,
            )
            logger.info("✓ 15-Min Crypto Scalping initialized (90% CONF)")
            logger.info("  ⚡ High-frequency BTC/ETH binary options scalping")
        else:
            logger.info("⏸️ 15-Min Crypto Scalping DISABLED")

        # Initialize AI Superforecasting Strategy (85% CONFIDENCE)
        ai_forecast_enabled = getattr(
            self.config.trading, 'enable_ai_superforecasting', False
        )
        if ai_forecast_enabled:
            gemini_api_key = (
                self.db.get_secret("GEMINI_API_KEY") or
                os.getenv("GEMINI_API_KEY")
            )
            if gemini_api_key:
                self.ai_superforecasting = AISuperforecastingStrategy(
                    api_key=gemini_api_key,
                    model=getattr(
                        self.config.trading, 'ai_model', 'gemini-2.5-flash'
                    ),
                    verification_model=getattr(
                        self.config.trading, 'ai_verification_model',
                        'gemini-1.5-pro'
                    ),
                    enable_dual_verification=getattr(
                        self.config.trading, 'ai_enable_dual_verification',
                        False
                    ),
                    verification_agreement_threshold=getattr(
                        self.config.trading,
                        'ai_verification_agreement_threshold', 0.15
                    ),
                    min_divergence_pct=getattr(
                        self.config.trading, 'ai_min_divergence_pct', 10.0
                    ),
                    max_position_usd=getattr(
                        self.config.trading, 'ai_max_position_usd', 100.0
                    ),
                    scan_interval_seconds=getattr(
                        self.config.trading, 'ai_scan_interval_sec', 300
                    ),
                    confidence_threshold=getattr(
                        self.config.trading, 'ai_min_confidence', 0.65
                    ),
                    db_client=self.db,
                    on_forecast=self._handle_ai_forecast,
                )
                dual_mode = (
                    "with dual-AI verification" if getattr(
                        self.config.trading, 'ai_enable_dual_verification',
                        False
                    ) else "single AI mode"
                )
                logger.info(f"✓ AI Superforecasting initialized ({dual_mode})")
                logger.info("  🧠 Gemini 2.0 Flash market analysis")
            else:
                logger.warning("⚠️ AI Superforecasting DISABLED - No GEMINI_API_KEY")
        else:
            logger.info("⏸️ AI Superforecasting DISABLED")

        # Initialize Cross-Exchange Crypto Arb (CCXT)
        cross_arb_enabled = getattr(
            self.config.trading, 'enable_cross_exchange_arb', False
        )
        if cross_arb_enabled:
            self.cross_exchange_arb = CrossExchangeArbStrategy(
                db_client=self.db
            )
            logger.info("✓ Cross-Exchange Arb initialized")
            logger.info("  💱 Monitoring Binance/Kraken/OKX spreads")
        else:
            logger.info("⏸️ Cross-Exchange Arb DISABLED")

        # Initialize Polymarket Liquidation Bot
        poly_liq_enabled = getattr(
            self.config.trading, 'enable_polymarket_liquidation', False
        )
        if poly_liq_enabled and self.polymarket_client:
            self.polymarket_liquidation = PolymarketLiquidationStrategy(
                polymarket_client=self.polymarket_client,
                db_client=self.db,
                min_price=getattr(
                    self.config.trading, 'liquidation_threshold_price', 0.98
                ),
                min_days_to_expiry=getattr(
                    self.config.trading, 'liquidation_min_days', 2
                )
            )
            logger.info("✓ Polymarket Liquidation Bot initialized")
            logger.info("  ♻️ Recycling capital from locked high-prob positions")
        else:
            logger.info("⏸️ Polymarket Liquidation Bot DISABLED")

        # Initialize Spike Hunter Strategy (HIGH PRIORITY - $5K-100K/month)
        # Detects 2%+ price moves in <30s and fades them for mean reversion
        spike_hunter_enabled = getattr(
            self.config.trading, 'enable_spike_hunter', True
        )
        if spike_hunter_enabled and self.polymarket_client:
            self.spike_hunter = await create_spike_hunter_from_config(
                self.config.trading
            )
            # Set the opportunity callback to handle detected spikes
            self.spike_hunter.set_opportunity_callback(
                self._handle_spike_opportunity
            )
            logger.info("✓ Spike Hunter initialized (HIGH PRIORITY)")
            logger.info(
                f"  ⚡ Spike threshold: {self.config.trading.spike_min_magnitude_pct}% "
                f"in {self.config.trading.spike_max_duration_sec}s"
            )
            logger.info(
                f"  💰 Max position: ${self.config.trading.spike_max_position_usd} | "
                f"Max concurrent: {self.config.trading.spike_max_concurrent}"
            )
        elif spike_hunter_enabled:
            logger.info("⏸️ Spike Hunter DISABLED (no Polymarket client)")
        else:
            logger.info("⏸️ Spike Hunter DISABLED")

        # Initialize paper trader for simulation mode
        if self.simulation_mode:
            # Use configurable starting balance from database config
            starting_balance = Decimal(str(self.config.trading.simulation_starting_balance))
            self.paper_trader = RealisticPaperTrader(
                db_client=self.db,
                starting_balance=starting_balance,
            )
            logger.info("✓ Realistic Paper Trader initialized")
            logger.info(f"📊 Starting balance: ${starting_balance:,.2f}")
            logger.info("📉 Slippage, partial fills, failures enabled")
        else:
            # LIVE TRADING MODE - Initialize live execution clients
            logger.warning("=" * 60)
            logger.warning("🔴 LIVE TRADING MODE ENABLED 🔴")
            logger.warning("Real money will be used for trades!")
            logger.warning("=" * 60)

            # Initialize Polymarket ClobClient for live order execution
            if self.private_key:
                self._polymarket_clob_client = (
                    self.polymarket_client.create_clob_client(
                        private_key=self.private_key,
                        chain_id=137,  # Polygon mainnet
                    )
                )
                if self._polymarket_clob_client:
                    logger.info("✓ Polymarket LIVE trading client initialized")
                else:
                    logger.warning(
                        "⚠️ Polymarket live trading unavailable "
                        "(ClobClient failed)"
                    )
            else:
                self._polymarket_clob_client = None
                logger.warning(
                    "⚠️ Polymarket live trading unavailable "
                    "(no private key)"
                )

            # Kalshi client already initialized with auth
            if self.kalshi_client.is_authenticated:
                logger.info("✓ Kalshi LIVE trading client ready")
            else:
                logger.warning(
                    "⚠️ Kalshi live trading unavailable "
                    "(not authenticated)"
                )

        # Initialize balance aggregator for multi-platform balance tracking
        # Collects from: Polymarket, Kalshi, Crypto (CCXT), Stocks (Alpaca)
        self.balance_aggregator = BalanceAggregator(
            db_client=self.db,
            polymarket_client=self.polymarket_client,
            kalshi_client=self.kalshi_client,
            ccxt_clients=self.ccxt_clients,  # Multi-exchange support
            alpaca_client=self.alpaca_client,
        )
        connected_count = len(self.ccxt_clients)
        logger.info(
            f"✓ Balance Aggregator initialized ({connected_count} CCXT exchanges)"
        )

        # =====================================================================
        # ADVANCED FRAMEWORK MODULES (Phase 1)
        # These modules enhance ALL strategies with better risk management
        # =====================================================================

        # Initialize Kelly Criterion Position Sizer
        kelly_enabled = getattr(self.config.trading, 'kelly_sizing_enabled', False)
        if kelly_enabled:
            self.kelly_sizer = get_kelly_sizer()
            self.kelly_sizer.kelly_fraction = getattr(
                self.config.trading, 'kelly_fraction_cap', 0.25
            )
            self.kelly_sizer.min_confidence = getattr(
                self.config.trading, 'kelly_min_confidence', 0.6
            )
            logger.info("✓ Kelly Position Sizer initialized")
            logger.info(
                f"  📊 Kelly fraction: {self.kelly_sizer.kelly_fraction} | "
                f"Min conf: {self.kelly_sizer.min_confidence}"
            )
        else:
            logger.info("⏸️ Kelly Position Sizing DISABLED")

        # Initialize Market Regime Detector
        regime_enabled = getattr(self.config.trading, 'regime_detection_enabled', True)
        if regime_enabled:
            self.regime_detector = get_regime_detector()
            self.regime_detector.vix_low = getattr(
                self.config.trading, 'regime_vix_low_threshold', 15.0
            )
            self.regime_detector.vix_high = getattr(
                self.config.trading, 'regime_vix_high_threshold', 25.0
            )
            self.regime_detector.vix_crisis = getattr(
                self.config.trading, 'regime_vix_crisis_threshold', 35.0
            )
            logger.info("✓ Regime Detector initialized")
            logger.info(
                f"  📈 VIX thresholds: <{self.regime_detector.vix_low} LOW | "
                f">{self.regime_detector.vix_high} HIGH | "
                f">{self.regime_detector.vix_crisis} CRISIS"
            )
        else:
            logger.info("⏸️ Regime Detection DISABLED")

        # Initialize Circuit Breaker System
        cb_enabled = getattr(self.config.trading, 'circuit_breaker_enabled', True)
        if cb_enabled:
            self.circuit_breaker = get_circuit_breaker()
            # Update level thresholds from config
            level1_pct = getattr(self.config.trading, 'circuit_breaker_level1_pct', 5.0)
            level2_pct = getattr(self.config.trading, 'circuit_breaker_level2_pct', 10.0)
            level3_pct = getattr(self.config.trading, 'circuit_breaker_level3_pct', 15.0)
            # Update existing levels' thresholds
            if len(self.circuit_breaker.levels) >= 3:
                self.circuit_breaker.levels[0].threshold_pct = level1_pct
                self.circuit_breaker.levels[1].threshold_pct = level2_pct
                self.circuit_breaker.levels[2].threshold_pct = level3_pct
            logger.info("✓ Circuit Breaker initialized")
            logger.info(
                f"  🚨 Levels: {level1_pct}% → {level2_pct}% → {level3_pct}%"
            )
        else:
            logger.info("⏸️ Circuit Breaker DISABLED")

        # =====================================================================
        # STRATEGY ENHANCEMENT MODULES (Phase 2)
        # =====================================================================

        # Initialize Time Decay Analyzer (Prediction Markets)
        td_enabled = getattr(self.config.trading, 'time_decay_enabled', True)
        if td_enabled:
            self.time_decay_analyzer = get_time_decay_analyzer()
            self.time_decay_analyzer.critical_days = getattr(
                self.config.trading, 'time_decay_critical_days', 7
            )
            self.time_decay_analyzer.avoid_entry_hours = getattr(
                self.config.trading, 'time_decay_avoid_entry_hours', 48
            )
            logger.info("✓ Time Decay Analyzer initialized")
            logger.info(
                f"  ⏱️ Critical: {self.time_decay_analyzer.critical_days}d | "
                f"Avoid entry: <{self.time_decay_analyzer.avoid_entry_hours}h"
            )
        else:
            logger.info("⏸️ Time Decay Analysis DISABLED")

        # Initialize Stablecoin Depeg Detector
        depeg_enabled = getattr(self.config.trading, 'depeg_detection_enabled', True)
        if depeg_enabled:
            self.depeg_detector = get_depeg_detector()
            self.depeg_detector.alert_threshold = getattr(
                self.config.trading, 'depeg_alert_threshold_pct', 0.3
            )
            self.depeg_detector.arb_threshold = getattr(
                self.config.trading, 'depeg_arbitrage_threshold_pct', 0.5
            )
            logger.info("✓ Depeg Detector initialized")
            logger.info(
                f"  💰 Alert: {self.depeg_detector.alert_threshold}% | "
                f"Arb: {self.depeg_detector.arb_threshold}%"
            )
        else:
            logger.info("⏸️ Depeg Detection DISABLED")

        # Initialize Correlation Position Limiter
        corr_enabled = getattr(self.config.trading, 'correlation_limits_enabled', True)
        if corr_enabled:
            self.correlation_tracker = get_correlation_tracker()
            self.correlation_tracker.max_cluster_pct = getattr(
                self.config.trading, 'correlation_max_cluster_pct', 30.0
            )
            self.correlation_tracker.max_correlated_pct = getattr(
                self.config.trading, 'correlation_max_correlated_pct', 50.0
            )
            logger.info("✓ Correlation Tracker initialized")
            logger.info(
                f"  📊 Max cluster: {self.correlation_tracker.max_cluster_pct}% | "
                f"Max correlated: {self.correlation_tracker.max_correlated_pct}%"
            )
        else:
            logger.info("⏸️ Correlation Limits DISABLED")

        logger.info("All features initialized!")

    async def on_copy_signal(self, signal: CopySignal):
        """Handle copy trading signals."""
        logger.info(
            f"[COPY] Signal: {signal.action.upper()} {signal.size:.2f} shares "
            f"of {signal.outcome} @ ${signal.price:.3f} - "
            f"Market: {signal.market_slug}"
        )

        # Log to database with proper schema fields
        try:
            self.db.log_opportunity({
                "id": f"copy_{signal.market_slug[:20]}_{signal.detected_at.timestamp():.0f}",
                "buy_platform": "polymarket",
                "sell_platform": "polymarket",
                "buy_market_id": signal.market_slug,
                "sell_market_id": signal.market_slug,
                "buy_market_name": f"Copy: {signal.outcome} ({signal.trader_address[:10]}...)",
                "sell_market_name": signal.market_slug,
                "buy_price": float(signal.price),
                "sell_price": float(signal.price),
                "profit_percent": 0.0,  # Copy trading doesn't have guaranteed profit
                "strategy": "copy_trading",
                "detected_at": signal.detected_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging copy signal: {e}")

        if not self.simulation_mode:
            # LIVE TRADING: Execute actual copy trade
            await self._execute_live_copy_trade(signal)

    async def _execute_live_copy_trade(self, signal: CopySignal):
        """
        Execute a live copy trade based on signal.
        
        Supports both Polymarket and Kalshi platforms.
        """
        try:
            # Determine platform from signal (copy trading currently only Polymarket)
            platform = "polymarket"  # CopySignal comes from Polymarket whale tracking
            
            # Get current balance to verify we can afford the trade
            if platform == "polymarket":
                if not self.polymarket_client:
                    logger.error("❌ Copy trade failed: Polymarket client not initialized")
                    return
                
                # Check if we have the py-clob-client available for live trading
                from py_clob_client.client import ClobClient
                from py_clob_client.clob_types import OrderArgs
                
                # Calculate order parameters
                # signal.copy_size is already calculated based on copy_multiplier
                size_usd = min(signal.copy_size, float(self.config.trading.max_trade_size))
                price_cents = int(signal.price * 100)  # Convert to cents
                
                # Determine side based on signal
                side = "yes" if signal.outcome.lower() in ("yes", "y") else "no"
                action = signal.action.lower()  # 'buy' or 'sell'
                
                logger.info(
                    f"🔴 LIVE COPY TRADE: {action.upper()} ${size_usd:.2f} {side.upper()} "
                    f"@ {signal.price:.2%} - {signal.market_title[:50]}..."
                )
                
                # Execute via Polymarket client
                result = await self.polymarket_client.place_order(
                    token_id=signal.token_id,
                    side=side,
                    price=signal.price,
                    size=size_usd / signal.price,  # Convert USD to contracts
                    order_type="limit",
                )
                
                if result.get("success"):
                    logger.info(
                        f"✅ Copy trade executed: Order {result.get('order_id')} "
                        f"filled {result.get('filled_size', 0)} contracts"
                    )
                    # Log successful trade
                    self.db.log_opportunity({
                        "id": f"copy_exec_{signal.market_slug[:15]}_{datetime.utcnow().timestamp():.0f}",
                        "buy_platform": platform,
                        "sell_platform": platform,
                        "buy_market_id": signal.token_id,
                        "sell_market_id": signal.token_id,
                        "buy_market_name": f"Copy: {signal.outcome} @ {signal.price:.2%}",
                        "sell_market_name": signal.market_title[:200],
                        "buy_price": float(signal.price),
                        "sell_price": float(signal.price),
                        "profit_percent": 0.0,
                        "strategy": "copy_trading_live",
                        "detected_at": signal.detected_at.isoformat(),
                        "status": "executed",
                        "execution_result": "filled",
                    })
                else:
                    logger.error(
                        f"❌ Copy trade failed: {result.get('error', 'Unknown error')}"
                    )
            
            elif platform == "kalshi":
                # Future: Support Kalshi copy trading
                if not self.kalshi_client or not self.kalshi_client.is_authenticated:
                    logger.error("❌ Copy trade failed: Kalshi client not authenticated")
                    return
                
                # Kalshi order execution would go here
                # Currently copy trading only tracks Polymarket whales
                logger.warning("Kalshi copy trading not yet implemented")
                
        except ImportError:
            logger.error(
                "❌ Copy trade failed: py-clob-client not installed. "
                "Run: pip install py-clob-client"
            )
        except Exception as e:
            logger.error(f"❌ Copy trade execution error: {e}")
            import traceback
            traceback.print_exc()

    async def on_arb_opportunity(self, opp: OverlapOpportunity):
        """Handle overlapping arbitrage opportunities."""
        logger.info(
            f"[ARB] {opp.relationship} opportunity: "
            f"{opp.deviation:.1f}% deviation, "
            f"${opp.profit_potential:.4f} potential profit"
        )

        # Check if market is blacklisted
        market_a_id = opp.market_a.condition_id or "unknown"
        market_b_id = opp.market_b.condition_id or "unknown"

        skip_reason = None
        status = "detected"

        if await self.is_market_blacklisted(market_a_id, opp.market_a.question):
            skip_reason = f"Market A blacklisted: {opp.market_a.question[:50]}..."
            status = "skipped"
            logger.info(f"⛔ {skip_reason}")
        elif await self.is_market_blacklisted(market_b_id, opp.market_b.question):
            skip_reason = f"Market B blacklisted: {opp.market_b.question[:50]}..."
            status = "skipped"
            logger.info(f"⛔ {skip_reason}")

        # Generate ID
        opp_id = f"overlap_{opp.market_a.condition_id[:10]}_{opp.detected_at.timestamp():.0f}"

        # Calculate total_profit in USD based on trade size and profit %
        trade_size = float(self.config.trading.max_trade_size)
        profit_pct = float(opp.profit_potential * 100)
        total_profit_usd = trade_size * (profit_pct / 100.0)

        # Log to database with proper schema fields
        try:
            self.db.log_opportunity({
                "id": opp_id,
                "buy_platform": "polymarket",
                "sell_platform": "polymarket",
                "buy_market_id": opp.market_a.condition_id,
                "sell_market_id": opp.market_b.condition_id,
                "buy_market_name": opp.market_a.question[:200],
                "sell_market_name": opp.market_b.question[:200],
                "buy_price": 0.0,  # Overlapping arb doesn't have direct prices
                "sell_price": 0.0,
                "profit_percent": profit_pct,
                "total_profit": total_profit_usd,
                "max_size": trade_size,
                "confidence": float(opp.confidence),
                "strategy": f"overlapping_arb_{opp.relationship}",
                "detected_at": opp.detected_at.isoformat(),
                "status": status,
                "skip_reason": skip_reason,
            })
        except Exception as e:
            logger.error(f"Error logging arb opportunity: {e}")

        if status == "skipped":
            return

        # Paper trade if in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                # IMPORTANT: Pass arbitrage_type="overlapping_arb" to distinguish from
                # true single-platform arbitrage (YES+NO=$1). Overlapping arb is
                # correlation-based between DIFFERENT markets - much riskier!
                trade = await self.paper_trader.simulate_opportunity(
                    market_a_id=opp.market_a.condition_id or "unknown",
                    market_a_title=opp.market_a.question[:200],
                    market_b_id=opp.market_b.condition_id or "overlapping",
                    market_b_title=opp.market_b.question[:200],
                    platform_a="polymarket",
                    platform_b="polymarket",
                    price_a=Decimal(str(opp.market_a.yes_price or 0.5)),
                    price_b=Decimal(str(opp.market_b.yes_price or 0.5)),
                    spread_pct=Decimal(str(opp.deviation)),
                    trade_type=f"overlapping_{opp.relationship}",
                    arbitrage_type="overlapping_arb",  # CRITICAL: Not "polymarket_single"!
                )

                # Record trade result if executed
                if trade:
                    # Determine status and result
                    status = "executed"
                    exec_result = "unknown"

                    if trade.outcome.value in ("won", "lost"):
                        is_win = trade.outcome.value == "won"
                        exec_result = "won" if is_win else "lost"
                    elif trade.outcome.value == "failed_execution":
                        status = "failed"
                        exec_result = "execution_failed"

                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status=status,
                        executed_at=datetime.utcnow(),
                        execution_result=exec_result
                    )
                else:
                    # Paper trader returned None - it was skipped (cooldown, false positive, etc.)
                    # The paper trader already logged the skip reason, but update original record
                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status="skipped",
                        skip_reason="Paper trader skipped (see logs)"
                    )
            except Exception as e:
                logger.error(f"Error paper trading arb: {e}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=str(e)
                )
        else:
            # LIVE TRADING MODE - Execute real overlapping arb trade
            await self._execute_live_overlapping_arb_trade(opp, opp_id)

    async def on_cross_platform_opportunity(self, opp: Opportunity):
        """Handle cross-platform arbitrage opportunities (Polymarket↔Kalshi)."""
        logger.info(
            f"🎯 [CROSS-ARB] {opp.profit_percent:.1f}% profit: "
            f"Buy {opp.buy_platform} @ {opp.buy_price:.2f} → "
            f"Sell {opp.sell_platform} @ {opp.sell_price:.2f}"
        )
        logger.info(f"   Market: {opp.buy_market_name[:60]}...")

        # Send notification for opportunity
        self.notifier.send_opportunity(
            buy_platform=opp.buy_platform,
            sell_platform=opp.sell_platform,
            market=opp.buy_market_name[:100],
            profit_percent=opp.profit_percent,
            trade_size=self.config.trading.max_trade_size,
        )

        # Generate ID (use one provided if possible, else generate)
        if hasattr(opp, 'id') and opp.id:
            opp_id = opp.id
        else:
            opp_id = f"cross_{opp.buy_platform}_{opp.buy_market_id[:10]}_{opp.detected_at.timestamp():.0f}"

        # Calculate total_profit in USD based on trade size and profit %
        trade_size = float(self.config.trading.max_trade_size)
        total_profit_usd = trade_size * (opp.profit_percent / 100.0)

        # Log to database
        try:
            self.db.log_opportunity({
                "id": opp_id,
                "type": "cross_platform_arb",
                "buy_platform": opp.buy_platform,
                "sell_platform": opp.sell_platform,
                "buy_market_id": opp.buy_market_id,
                "sell_market_id": opp.sell_market_id,
                "buy_market_name": opp.buy_market_name[:200],
                "sell_market_name": opp.sell_market_name[:200],
                "buy_price": opp.buy_price,
                "sell_price": opp.sell_price,
                "profit_percent": opp.profit_percent,
                "total_profit": total_profit_usd,
                "max_size": trade_size,
                "confidence": opp.confidence,
                "strategy": opp.strategy,
                "detected_at": opp.detected_at.isoformat(),
                "status": "detected",
            })
        except Exception as e:
            logger.error(f"Error logging cross-platform opportunity: {e}")

        # Paper trade if in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                trade = await self.paper_trader.simulate_opportunity(
                    market_a_id=opp.buy_market_id,
                    market_a_title=opp.buy_market_name[:200],
                    market_b_id=opp.sell_market_id,
                    market_b_title=opp.sell_market_name[:200],
                    platform_a=opp.buy_platform,
                    platform_b=opp.sell_platform,
                    price_a=Decimal(str(opp.buy_price)),
                    price_b=Decimal(str(opp.sell_price)),
                    spread_pct=Decimal(str(opp.profit_percent)),
                    trade_type=f"cross_platform_{opp.buy_platform}_to_{opp.sell_platform}",
                    arbitrage_type="cross_platform",  # Explicit!
                )
                # Track in analytics
                self.analytics.record_opportunity(ArbitrageType.CROSS_PLATFORM)

                # Record trade result if executed
                if trade:
                    status = "executed"
                    exec_result = "unknown"

                    if trade.outcome.value in ("won", "lost"):
                        is_win = trade.outcome.value == "won"
                        exec_result = "won" if is_win else "lost"
                        self.analytics.record_trade(
                            ArbitrageType.CROSS_PLATFORM,
                            is_win=is_win,
                            gross_pnl=trade.gross_profit_usd,
                            fees=trade.total_fees_usd,
                        )
                    elif trade.outcome.value == "failed_execution":
                        status = "failed"
                        exec_result = "execution_failed"
                        self.analytics.record_failed_execution(ArbitrageType.CROSS_PLATFORM)

                    # Update status
                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status=status,
                        executed_at=datetime.utcnow(),
                        execution_result=exec_result
                    )
                else:
                    # Paper trader skipped this opportunity
                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status="skipped",
                        skip_reason="Paper trader skipped"
                    )
            except Exception as e:
                logger.error(f"Error paper trading cross-platform arb: {e}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=str(e)
                )
        else:
            # LIVE TRADING MODE - Execute real trades
            await self._execute_live_cross_platform_trade(opp, opp_id)

    async def on_single_platform_opportunity(
        self,
        opp: SinglePlatformOpportunity
    ):
        """Handle single-platform arbitrage opportunities (intra-market)."""
        arb_type = opp.arb_type

        logger.info(
            f"🎯 [SINGLE-ARB] {opp.platform.upper()} | "
            f"{opp.profit_pct:.2f}% profit | "
            f"Total={opp.total_price:.4f} | "
            f"{opp.market_title[:50]}..."
        )

        # Mark as traded IMMEDIATELY to prevent duplicate trades
        if self.single_platform_scanner:
            self.single_platform_scanner.mark_traded(opp.market_id, opp.platform)

        # Track in analytics
        self.analytics.record_opportunity(arb_type)

        # Send notification for opportunity
        self.notifier.send_opportunity(
            buy_platform=opp.platform,
            sell_platform=opp.platform,  # Same platform for single-platform
            market=opp.market_title[:100],
            profit_percent=float(opp.profit_pct),
            trade_size=self.config.trading.max_trade_size,
        )

        # Generate predictable ID
        opp_id = f"single_{opp.platform}_{opp.market_id[:20]}_{opp.detected_at.timestamp():.0f}"

        # Calculate total_profit in USD based on trade size and profit %
        trade_size = float(self.config.trading.max_trade_size)
        total_profit_usd = trade_size * (float(opp.profit_pct) / 100.0)

        # Log to database
        try:
            self.db.log_opportunity({
                "id": opp_id,
                "buy_platform": opp.platform,
                "sell_platform": opp.platform,
                "buy_market_id": opp.market_id,
                "sell_market_id": f"{opp.market_id}_resolution",
                "buy_market_name": opp.market_title[:200],
                "sell_market_name": f"Resolution: {opp.market_title[:100]}",
                "buy_price": float(opp.total_price),
                "sell_price": 1.0,  # Guaranteed $1 payout
                "profit_percent": float(opp.profit_pct),
                "total_profit": total_profit_usd,
                "max_size": trade_size,
                "strategy": f"single_platform_{opp.platform}",
                "detected_at": opp.detected_at.isoformat(),
                "status": "detected",
            })
        except Exception as e:
            logger.error(f"Error logging single-platform opportunity: {e}")

        # Paper trade if in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                # For single-platform, we buy ALL outcomes
                arb_type_str = arb_type.value  # "polymarket_single" or "kalshi_single"
                trade = await self.paper_trader.simulate_opportunity(
                    market_a_id=opp.market_id,
                    market_a_title=opp.market_title[:200],
                    market_b_id=f"{opp.market_id}_resolution",
                    market_b_title=f"Resolution: {opp.market_title[:100]}",
                    platform_a=opp.platform,
                    platform_b=opp.platform,  # Same platform!
                    price_a=opp.total_price,  # Total cost to buy all
                    price_b=Decimal("1.0"),   # Guaranteed $1 payout
                    spread_pct=opp.profit_pct,
                    trade_type=f"single_platform_{opp.platform}",
                    arbitrage_type=arb_type_str,  # Explicit!
                )

                # Record trade result if executed
                if trade:
                    # Determine status and result
                    status = "executed"
                    exec_result = "unknown"

                    if trade.outcome.value in ("won", "lost"):
                        is_win = trade.outcome.value == "won"
                        exec_result = "won" if is_win else "lost"
                        self.analytics.record_trade(
                            arb_type,
                            is_win=is_win,
                            gross_pnl=trade.gross_profit_usd,
                            fees=trade.total_fees_usd,
                        )
                    elif trade.outcome.value == "failed_execution":
                        status = "failed"
                        exec_result = "execution_failed"
                        self.analytics.record_failed_execution(arb_type)

                    # Update DB with result
                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status=status,
                        executed_at=datetime.utcnow(),
                        execution_result=exec_result
                    )
                else:
                    # Paper trader skipped this opportunity
                    self.db.update_opportunity_status(
                        opportunity_id=opp_id,
                        status="skipped",
                        skip_reason="Paper trader skipped"
                    )
            except Exception as e:
                logger.error(f"Error paper trading single-platform: {e}")
                # Log failure to DB
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=str(e)
                )
        else:
            # =========================================================
            # LIVE TRADING MODE
            # Execute real orders on Polymarket or Kalshi
            # =========================================================
            await self._execute_live_single_platform_trade(opp, opp_id, arb_type)

    async def on_position_claim(self, result: ClaimResult):
        """Handle position claim results."""
        if result.success:
            logger.info(
                f"[CLAIM] Successfully claimed ${result.amount_claimed:.2f} "
                f"from position {result.position_id}"
            )
        else:
            logger.warning(
                f"[CLAIM] Failed to claim position {result.position_id}: "
                f"{result.error}"
            )

    # =========================================================================
    # LIVE TRADING EXECUTION METHODS
    # These methods execute REAL orders when simulation_mode=False
    # =========================================================================

    async def _execute_live_single_platform_trade(
        self,
        opp: SinglePlatformOpportunity,
        opp_id: str,
        arb_type: ArbitrageType,
    ):
        """
        Execute a live single-platform arbitrage trade.

        For single-platform arb, we need to buy ALL outcomes so that
        we're guaranteed $1 at resolution regardless of outcome.

        Args:
            opp: The opportunity to execute
            opp_id: Database opportunity ID
            arb_type: Type of arbitrage (polymarket_single or kalshi_single)
        """
        # =========================================================================
        # CRITICAL: CHECK BALANCE BEFORE TRADING
        # =========================================================================
        MIN_BALANCE_REQUIRED = 1.0  # Minimum $1 required to trade
        
        try:
            if opp.platform == "kalshi":
                balance_data = self.kalshi_client.get_balance()
                available_balance = float(balance_data.get("balance", 0))
                logger.info(f"💰 Kalshi balance check: ${available_balance:.2f}")
            elif opp.platform == "polymarket":
                if self.polymarket_client and self.wallet_address:
                    balance_data = self.polymarket_client.get_balance(self.wallet_address)
                    available_balance = float(balance_data.get("balance", 0))
                else:
                    available_balance = 0.0
                logger.info(f"💰 Polymarket balance check: ${available_balance:.2f}")
            else:
                available_balance = 0.0
            
            if available_balance <= 0:
                logger.error(f"🚫 REFUSING TRADE: No balance on {opp.platform} (${available_balance:.2f})")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="skipped",
                    skip_reason=f"No balance available on {opp.platform}"
                )
                return
            
            if available_balance < MIN_BALANCE_REQUIRED:
                logger.error(f"🚫 REFUSING TRADE: Balance ${available_balance:.2f} below minimum ${MIN_BALANCE_REQUIRED}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="skipped",
                    skip_reason=f"Balance ${available_balance:.2f} below minimum ${MIN_BALANCE_REQUIRED}"
                )
                return
                
        except Exception as e:
            logger.error(f"🚫 REFUSING TRADE: Balance check failed: {e}")
            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="skipped",
                skip_reason=f"Balance check failed: {e}"
            )
            return
        # =========================================================================
        
        logger.warning(
            f"🔴 LIVE TRADE: {opp.platform.upper()} single-platform arb | "
            f"{opp.profit_pct:.2f}% profit | Balance: ${available_balance:.2f}"
        )

        try:
            # Calculate position size - LIMIT BY AVAILABLE BALANCE
            max_size = self.config.trading.max_trade_size
            position_size = min(max_size, 100, available_balance * 0.95)  # Use 95% of balance max

            if opp.platform == "polymarket":
                result = await self._execute_polymarket_live_trade(
                    opp, position_size
                )
            elif opp.platform == "kalshi":
                result = await self._execute_kalshi_live_trade(
                    opp, position_size
                )
            else:
                result = {
                    "success": False, "error": f"Unknown platform: {opp.platform}"
                }

            # Update database with result
            if result.get("success"):
                logger.info(f"✅ Live trade executed: {result.get('order_ids')}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="executed",
                    executed_at=datetime.utcnow(),
                    execution_result="pending_resolution"
                )
                # Track in analytics
                self.analytics.record_opportunity(arb_type)

                # Log to live trades table
                self.db.log_live_trade({
                    "opportunity_id": opp_id,
                    "platform": opp.platform,
                    "market_id": opp.market_id,
                    "market_title": opp.market_title[:200],
                    "position_size_usd": position_size,
                    "expected_profit_pct": float(opp.profit_pct),
                    "order_ids": result.get("order_ids", []),
                    "status": "open",
                })
            else:
                error = result.get("error", "Unknown error")
                logger.error(f"❌ Live trade failed: {error}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=f"Execution failed: {error}"
                )
                self.analytics.record_failed_execution(arb_type)
                
                # Log partial executions for audit trail
                partial_orders = result.get("partial_order_ids", [])
                cancelled_orders = result.get("cancelled_order_ids", [])
                if partial_orders or cancelled_orders:
                    self.db.log_live_trade({
                        "opportunity_id": opp_id,
                        "platform": opp.platform,
                        "market_id": opp.market_id,
                        "market_title": f"[FAILED] {opp.market_title[:180]}",
                        "position_size_usd": position_size,
                        "expected_profit_pct": float(opp.profit_pct),
                        "order_ids": partial_orders + cancelled_orders,
                        "status": "failed_cancelled" if cancelled_orders else "failed_orphan",
                    })

        except Exception as e:
            logger.error(f"❌ Live trade exception: {e}")
            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="failed",
                skip_reason=str(e)
            )

    async def _execute_polymarket_live_trade(
        self,
        opp: SinglePlatformOpportunity,
        position_size: float,
    ) -> dict:
        """
        Execute a live trade on Polymarket.

        For single-platform arb, we buy both YES and NO tokens.
        """
        clob_client = getattr(self, '_polymarket_clob_client', None)

        if not clob_client:
            return {
                "success": False,
                "error": "Polymarket ClobClient not initialized"
            }

        try:
            # Extract prices from conditions list
            # conditions is a list like [{"outcome": "YES", "price": 0.56, ...}]
            yes_price = 0.5
            no_price = 0.5
            yes_token_id = None
            no_token_id = None

            for cond in opp.conditions:
                outcome = cond.get("outcome", "").upper()
                if outcome == "YES":
                    yes_price = float(cond.get("price", 0.5))
                    yes_token_id = cond.get("token_id") or cond.get("condition_id")
                elif outcome == "NO":
                    no_price = float(cond.get("price", 0.5))
                    no_token_id = cond.get("token_id") or cond.get("condition_id")

            # For multi-condition markets, we need all condition token IDs
            if len(opp.conditions) > 2:
                # Multi-condition market - buy all outcomes
                return await self._execute_polymarket_multi_condition(
                    opp, position_size, clob_client
                )

            if not yes_token_id or not no_token_id:
                return {
                    "success": False,
                    "error": f"Missing token IDs (YES={yes_token_id}, NO={no_token_id})"
                }

            # Calculate shares to buy for each outcome
            # Total cost = yes_shares * yes_price + no_shares * no_price
            # For equal investment, buy equal dollar amounts
            yes_shares = (position_size / 2) / yes_price
            no_shares = (position_size / 2) / no_price

            order_ids = []

            # Buy YES tokens
            yes_result = await self.polymarket_client.place_order(
                clob_client=clob_client,
                token_id=yes_token_id,
                side="BUY",
                price=yes_price,
                size=yes_shares,
                order_type="GTC",
            )

            if yes_result.get("success"):
                order_ids.append(yes_result.get("order_id"))
            else:
                return {
                    "success": False,
                    "error": f"YES order failed: {yes_result.get('error')}"
                }

            # Buy NO tokens
            no_result = await self.polymarket_client.place_order(
                clob_client=clob_client,
                token_id=no_token_id,
                side="BUY",
                price=no_price,
                size=no_shares,
                order_type="GTC",
            )

            if no_result.get("success"):
                order_ids.append(no_result.get("order_id"))
                return {
                    "success": True,
                    "order_ids": order_ids,
                    "yes_order": yes_result,
                    "no_order": no_result,
                }
            else:
                # YES succeeded but NO failed - need to handle partial
                logger.warning(
                    f"Partial execution: YES succeeded, NO failed. "
                    f"Order {order_ids[0]} may need manual handling."
                )
                return {
                    "success": False,
                    "error": f"NO order failed: {no_result.get('error')}",
                    "partial_order_ids": order_ids,
                }

        except Exception as e:
            logger.error(f"Polymarket live trade error: {e}")
            return {"success": False, "error": str(e)}

    async def _execute_polymarket_multi_condition(
        self,
        opp: SinglePlatformOpportunity,
        position_size: float,
        clob_client,
    ) -> dict:
        """
        Execute multi-condition Polymarket arbitrage.

        For markets with 3+ conditions, we buy ALL conditions at once.
        """
        try:
            order_ids = []
            per_condition_size = position_size / len(opp.conditions)

            for cond in opp.conditions:
                token_id = cond.get("token_id") or cond.get("condition_id")
                price = float(cond.get("price", 0.5))

                if not token_id:
                    continue

                shares = per_condition_size / price

                result = await self.polymarket_client.place_order(
                    clob_client=clob_client,
                    token_id=token_id,
                    side="BUY",
                    price=price,
                    size=shares,
                    order_type="GTC",
                )

                if result.get("success"):
                    order_ids.append(result.get("order_id"))
                else:
                    return {
                        "success": False,
                        "error": f"Order failed: {result.get('error')}",
                        "partial_order_ids": order_ids,
                    }

            return {
                "success": True,
                "order_ids": order_ids,
            }

        except Exception as e:
            logger.error(f"Polymarket multi-condition error: {e}")
            return {"success": False, "error": str(e)}

    async def _execute_kalshi_live_trade(
        self,
        opp: SinglePlatformOpportunity,
        position_size: float,
    ) -> dict:
        """
        Execute a live trade on Kalshi.

        For single-platform arb, we buy both YES and NO contracts.
        """
        if not self.kalshi_client.is_authenticated:
            return {
                "success": False,
                "error": "Kalshi client not authenticated"
            }

        try:
            # Get ticker
            ticker = opp.market_id

            # Extract prices from conditions list
            # conditions is [{"outcome": "YES", "price": 0.56}, ...]
            yes_price = 0.5
            no_price = 0.5

            for cond in opp.conditions:
                outcome = cond.get("outcome", "").upper()
                if outcome == "YES":
                    yes_price = float(cond.get("price", 0.5))
                elif outcome == "NO":
                    no_price = float(cond.get("price", 0.5))

            # Calculate contracts to buy
            # CRITICAL: For guaranteed arbitrage, we need EQUAL contracts on both sides!
            # If we buy N YES and N NO, one side MUST win, paying N × $1.00
            # Total cost: N × (yes_price + no_price)
            # Profit: N × ($1.00 - yes_price - no_price)
            #
            # OLD (BROKEN): Split dollars evenly → unequal contracts → NOT guaranteed profit
            # NEW (CORRECT): Calculate max contracts at combined price
            combined_price = yes_price + no_price
            num_contracts = int(position_size / combined_price)
            
            yes_contracts = num_contracts
            no_contracts = num_contracts

            # Log the arbitrage calculation for transparency
            total_cost = num_contracts * combined_price
            guaranteed_payout = num_contracts * 1.0
            guaranteed_profit = guaranteed_payout - total_cost
            logger.info(
                f"📊 ARB CALC: {num_contracts} contracts × "
                f"(${yes_price:.2f} YES + ${no_price:.2f} NO) = "
                f"${total_cost:.2f} cost → ${guaranteed_profit:.2f} profit"
            )

            # Convert to cents with rounding (avoid float precision issues)
            yes_price_cents = round(yes_price * 100)
            no_price_cents = round(no_price * 100)

            # Validate prices are in valid range (1-99 cents)
            if yes_price_cents < 1 or yes_price_cents > 99:
                return {
                    "success": False,
                    "error": f"YES price {yes_price_cents}¢ out of range"
                }
            if no_price_cents < 1 or no_price_cents > 99:
                return {
                    "success": False,
                    "error": f"NO price {no_price_cents}¢ out of range"
                }

            # Validate we can afford at least 1 contract
            if num_contracts < 1:
                return {
                    "success": False,
                    "error": f"Position ${position_size} too small for "
                             f"combined price ${combined_price:.2f}"
                }

            order_ids = []

            # Buy YES contracts
            yes_result = await self.kalshi_client.place_order(
                ticker=ticker,
                side="yes",
                action="buy",
                count=yes_contracts,
                price_cents=yes_price_cents,
                order_type="limit",
            )

            if yes_result.get("success"):
                order_ids.append(yes_result.get("order_id"))
            else:
                return {
                    "success": False,
                    "error": f"YES order failed: {yes_result.get('error')}"
                }

            # Buy NO contracts
            no_result = await self.kalshi_client.place_order(
                ticker=ticker,
                side="no",
                action="buy",
                count=no_contracts,
                price_cents=no_price_cents,
                order_type="limit",
            )

            if no_result.get("success"):
                order_ids.append(no_result.get("order_id"))
                return {
                    "success": True,
                    "order_ids": order_ids,
                    "yes_order": yes_result,
                    "no_order": no_result,
                }
            else:
                # CRITICAL: NO order failed - cancel YES order to avoid one-sided position!
                yes_order_id = order_ids[0] if order_ids else None
                if yes_order_id:
                    logger.error(
                        f"🚨 NO order failed - cancelling YES order {yes_order_id} "
                        f"to avoid one-sided position"
                    )
                    cancel_result = await self.kalshi_client.cancel_order(yes_order_id)
                    if cancel_result.get("success"):
                        logger.info(f"✅ YES order {yes_order_id} cancelled successfully")
                    else:
                        logger.error(
                            f"❌ CRITICAL: Failed to cancel YES order {yes_order_id}! "
                            f"Manual intervention required. Error: {cancel_result.get('error')}"
                        )
                        # Log this to live trades with critical status for manual review
                        self.db.log_live_trade({
                            "opportunity_id": f"ORPHAN-{yes_order_id}",
                            "platform": "kalshi",
                            "market_id": ticker,
                            "market_title": f"ORPHAN: YES order needs manual cancel",
                            "position_size_usd": position_size / 2,
                            "expected_profit_pct": 0,
                            "order_ids": [yes_order_id],
                            "status": "critical_orphan",
                        })
                
                return {
                    "success": False,
                    "error": f"NO order failed: {no_result.get('error')} (YES order was cancelled)",
                    "cancelled_order_ids": order_ids,
                }

        except Exception as e:
            logger.error(f"Kalshi live trade error: {e}")
            return {"success": False, "error": str(e)}

    async def _execute_live_cross_platform_trade(
        self,
        opp: Opportunity,
        opp_id: str,
    ):
        """
        Execute a live cross-platform arbitrage trade.

        For cross-platform arb, we buy on one platform and sell on another.
        Example: Buy YES on Polymarket @ 0.45, Sell YES on Kalshi @ 0.55

        Args:
            opp: The cross-platform opportunity
            opp_id: Database opportunity ID
        """
        # =========================================================
        # CRITICAL: CHECK BALANCE BEFORE TRADING
        # =========================================================
        MIN_BALANCE_REQUIRED = 1.0
        
        try:
            if opp.buy_platform.lower() == "kalshi":
                balance_data = self.kalshi_client.get_balance()
                available_balance = float(balance_data.get("balance", 0))
            elif opp.buy_platform.lower() == "polymarket":
                if self.polymarket_client and self.wallet_address:
                    balance_data = self.polymarket_client.get_balance(
                        self.wallet_address
                    )
                    available_balance = float(balance_data.get("balance", 0))
                else:
                    available_balance = 0.0
            else:
                available_balance = 0.0
            
            logger.info(
                f"💰 {opp.buy_platform} balance: ${available_balance:.2f}"
            )
            
            if available_balance < MIN_BALANCE_REQUIRED:
                logger.error(
                    f"🚫 REFUSING TRADE: Balance ${available_balance:.2f} "
                    f"below minimum ${MIN_BALANCE_REQUIRED}"
                )
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="skipped",
                    skip_reason=f"Insufficient balance: ${available_balance:.2f}"
                )
                return
        except Exception as e:
            logger.error(f"🚫 Balance check failed: {e}")
            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="skipped",
                skip_reason=f"Balance check failed: {e}"
            )
            return
        # =========================================================
        
        logger.warning(
            f"🔴 LIVE CROSS-PLATFORM TRADE: "
            f"Buy {opp.buy_platform} @ {opp.buy_price:.2f} → "
            f"Sell {opp.sell_platform} @ {opp.sell_price:.2f} | "
            f"{opp.profit_percent:.2f}% profit | Balance: ${available_balance:.2f}"
        )

        try:
            max_size = self.config.trading.max_trade_size
            position_size = min(max_size, 100, available_balance * 0.95)

            # Execute buy leg first
            buy_result = await self._execute_cross_platform_leg(
                platform=opp.buy_platform,
                market_id=opp.buy_market_id,
                side="buy",
                price=opp.buy_price,
                position_size=position_size,
            )

            if not buy_result.get("success"):
                logger.error(
                    f"Buy leg failed: {buy_result.get('error')}"
                )
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=f"Buy leg failed: {buy_result.get('error')}"
                )
                return

            # Execute sell leg
            sell_result = await self._execute_cross_platform_leg(
                platform=opp.sell_platform,
                market_id=opp.sell_market_id,
                side="sell",
                price=opp.sell_price,
                position_size=position_size,
            )

            if not sell_result.get("success"):
                logger.error(
                    f"Sell leg failed (buy leg succeeded!): "
                    f"{sell_result.get('error')}"
                )
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="partial",
                    skip_reason=f"Sell leg failed: {sell_result.get('error')}",
                    execution_result="partial_buy_only"
                )
                # Alert for manual intervention - use trade_failed notification
                self.notifier.send_trade_failed(
                    platform=opp.buy_platform,
                    reason=(
                        f"⚠️ PARTIAL EXECUTION: Buy succeeded on "
                        f"{opp.buy_platform}, sell failed on {opp.sell_platform}"
                    )
                )
                return

            # Both legs succeeded
            logger.info(
                f"✅ Cross-platform trade executed: "
                f"Buy {buy_result.get('order_id')}, "
                f"Sell {sell_result.get('order_id')}"
            )

            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="executed",
                executed_at=datetime.utcnow(),
                execution_result="pending_resolution"
            )

            self.analytics.record_opportunity(ArbitrageType.CROSS_PLATFORM)

            self.db.log_live_trade({
                "opportunity_id": opp_id,
                "platform": f"{opp.buy_platform}_to_{opp.sell_platform}",
                "market_id": opp.buy_market_id,
                "market_title": opp.buy_market_name[:200],
                "position_size_usd": position_size,
                "expected_profit_pct": float(opp.profit_percent),
                "order_ids": [
                    buy_result.get("order_id"),
                    sell_result.get("order_id")
                ],
                "status": "open",
            })

        except Exception as e:
            logger.error(f"❌ Cross-platform trade exception: {e}")
            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="failed",
                skip_reason=str(e)
            )

    async def _execute_cross_platform_leg(
        self,
        platform: str,
        market_id: str,
        side: str,
        price: float,
        position_size: float,
    ) -> dict:
        """
        Execute a single leg of a cross-platform trade.

        Args:
            platform: "polymarket" or "kalshi"
            market_id: Market/ticker ID
            side: "buy" or "sell"
            price: Price to trade at
            position_size: USD amount to trade
        """
        contracts = int(position_size / price)

        if platform == "polymarket":
            clob_client = getattr(self, '_polymarket_clob_client', None)
            if not clob_client:
                return {
                    "success": False,
                    "error": "Polymarket ClobClient not initialized"
                }

            return await self.polymarket_client.place_order(
                clob_client=clob_client,
                token_id=market_id,
                side=side.upper(),
                price=price,
                size=contracts,
                order_type="GTC",
            )

        elif platform == "kalshi":
            if not self.kalshi_client.is_authenticated:
                return {
                    "success": False,
                    "error": "Kalshi client not authenticated"
                }

            # Validate price is in valid range (1-99 cents)
            price_cents = round(price * 100)
            if price_cents < 1 or price_cents > 99:
                return {
                    "success": False,
                    "error": f"Price {price_cents}¢ out of range (1-99)"
                }

            action = "buy" if side == "buy" else "sell"
            return await self.kalshi_client.place_order(
                ticker=market_id,
                side="yes",
                action=action,
                count=contracts,
                price_cents=price_cents,
                order_type="limit",
            )
        else:
            return {
                "success": False,
                "error": f"Unknown platform: {platform}"
            }

    async def _execute_live_overlapping_arb_trade(
        self,
        opp: OverlapOpportunity,
        opp_id: str,
    ):
        """
        Execute a live overlapping arbitrage trade on Polymarket.

        Overlapping arb exploits correlated markets. Example:
        - Market A: "Will X win election?" at 0.60
        - Market B: "Will X win primary?" at 0.40
        - If A implies B, buy B (underpriced) or sell A (overpriced)

        CAUTION: This is more speculative than pure YES+NO arb.
        """
        logger.warning(
            f"🔴 LIVE OVERLAPPING ARB: {opp.relationship} | "
            f"{opp.deviation:.1f}% deviation | "
            f"Potential: ${opp.profit_potential:.4f}"
        )

        try:
            max_size = self.config.trading.max_trade_size
            position_size = min(max_size, 50)

            clob_client = getattr(self, '_polymarket_clob_client', None)
            if not clob_client:
                logger.error("Polymarket ClobClient not initialized")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason="ClobClient not initialized"
                )
                return

            # Determine trade direction based on relationship
            # For "subset" relationship: if A implies B, and A > B, buy B
            # For "superset" relationship: if B implies A, and A < B, sell B
            trade_action = self._determine_overlap_trade_action(opp)

            if not trade_action:
                logger.warning(
                    f"Could not determine trade action for {opp.relationship}"
                )
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="skipped",
                    skip_reason="Could not determine trade action"
                )
                return

            # Execute the trade
            market_id = trade_action["market_id"]
            token_id = trade_action["token_id"]
            side = trade_action["side"]
            price = trade_action["price"]

            shares = int(position_size / price)

            result = await self.polymarket_client.place_order(
                clob_client=clob_client,
                token_id=token_id,
                side=side,
                price=price,
                size=shares,
                order_type="GTC",
            )

            if result.get("success"):
                logger.info(
                    f"✅ Overlapping arb executed: {result.get('order_id')}"
                )
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="executed",
                    executed_at=datetime.utcnow(),
                    execution_result="pending_resolution"
                )

                self.db.log_live_trade({
                    "opportunity_id": opp_id,
                    "platform": "polymarket",
                    "market_id": market_id,
                    "market_title": trade_action.get("market_title", "")[:200],
                    "position_size_usd": position_size,
                    "expected_profit_pct": float(opp.profit_potential * 100),
                    "order_ids": [result.get("order_id")],
                    "status": "open",
                })
            else:
                error = result.get("error", "Unknown error")
                logger.error(f"❌ Overlapping arb failed: {error}")
                self.db.update_opportunity_status(
                    opportunity_id=opp_id,
                    status="failed",
                    skip_reason=f"Execution failed: {error}"
                )

        except Exception as e:
            logger.error(f"❌ Overlapping arb exception: {e}")
            self.db.update_opportunity_status(
                opportunity_id=opp_id,
                status="failed",
                skip_reason=str(e)
            )

    def _determine_overlap_trade_action(
        self, opp: OverlapOpportunity
    ) -> Optional[dict]:
        """
        Determine the trade action for an overlapping arbitrage opportunity.

        Returns dict with: market_id, token_id, side, price, market_title
        or None if trade action cannot be determined.
        """
        # Get prices
        price_a = opp.market_a.yes_price or 0.5
        price_b = opp.market_b.yes_price or 0.5

        if opp.relationship == "subset":
            # A is subset of B (A implies B)
            # If A > B, B is underpriced - BUY B
            if price_a > price_b:
                return {
                    "market_id": opp.market_b.condition_id,
                    "token_id": opp.market_b.yes_token_id,
                    "side": "BUY",
                    "price": price_b,
                    "market_title": opp.market_b.question,
                }
            else:
                # A < B - A is overpriced, SELL A
                return {
                    "market_id": opp.market_a.condition_id,
                    "token_id": opp.market_a.yes_token_id,
                    "side": "SELL",
                    "price": price_a,
                    "market_title": opp.market_a.question,
                }

        elif opp.relationship == "superset":
            # B is subset of A (B implies A)
            # If B > A, A is underpriced - BUY A
            if price_b > price_a:
                return {
                    "market_id": opp.market_a.condition_id,
                    "token_id": opp.market_a.yes_token_id,
                    "side": "BUY",
                    "price": price_a,
                    "market_title": opp.market_a.question,
                }
            else:
                return {
                    "market_id": opp.market_b.condition_id,
                    "token_id": opp.market_b.yes_token_id,
                    "side": "SELL",
                    "price": price_b,
                    "market_title": opp.market_b.question,
                }

        elif opp.relationship == "complement":
            # A and B are complements (A + B should = 1)
            total = price_a + price_b
            if total > 1.02:
                # Overpriced overall - sell the higher one
                if price_a > price_b:
                    return {
                        "market_id": opp.market_a.condition_id,
                        "token_id": opp.market_a.yes_token_id,
                        "side": "SELL",
                        "price": price_a,
                        "market_title": opp.market_a.question,
                    }
                else:
                    return {
                        "market_id": opp.market_b.condition_id,
                        "token_id": opp.market_b.yes_token_id,
                        "side": "SELL",
                        "price": price_b,
                        "market_title": opp.market_b.question,
                    }
            elif total < 0.98:
                # Underpriced overall - buy the lower one
                if price_a < price_b:
                    return {
                        "market_id": opp.market_a.condition_id,
                        "token_id": opp.market_a.yes_token_id,
                        "side": "BUY",
                        "price": price_a,
                        "market_title": opp.market_a.question,
                    }
                else:
                    return {
                        "market_id": opp.market_b.condition_id,
                        "token_id": opp.market_b.yes_token_id,
                        "side": "BUY",
                        "price": price_b,
                        "market_title": opp.market_b.question,
                    }

        return None

    async def on_portfolio_update(self, summary: PortfolioSummary):
        """Handle portfolio updates."""
        logger.info(
            f"[PORTFOLIO] {summary.open_positions} open, "
            f"{summary.resolved_unclaimed} unclaimed, "
            f"PnL: ${summary.total_unrealized_pnl + summary.total_realized_pnl:.2f}, "
            f"Win rate: {summary.win_rate:.1f}%"
        )

    async def on_news_alert(self, alert: MarketAlert):
        """Handle news/sentiment alerts - informational signals, not arbitrage."""
        logger.info(
            f"[NEWS] {alert.alert_type}: {alert.news_item.title[:60]}... "
            f"-> {alert.suggested_action.upper()} confidence: {alert.confidence:.0%}"
        )

        # NOTE: News alerts are informational signals, NOT arbitrage opportunities.
        # They don't have guaranteed profit like arbitrage (YES+NO<$1).
        # Don't log them to opportunities table - they pollute missed money stats.
        #
        # If news creates price divergence between platforms, that gets
        # detected separately by NewsArbitrageStrategy with actual profit %.

    async def run_copy_trading(self):
        """Run copy trading engine."""
        if self.copy_trading:
            await self.copy_trading.run(callback=self.on_copy_signal)

    async def run_arb_detection(self):
        """Run overlapping arbitrage detection (Polymarket only)."""
        # Check if Polymarket is enabled - overlapping arb is Polymarket-only
        platform_poly = self.db.get_config("polymarket_enabled", True)
        if not platform_poly:
            logger.info("⏸️ Overlapping Arb DISABLED (Polymarket disabled)")
            return
            
        if self.arb_detector:
            await self.arb_detector.run(callback=self.on_arb_opportunity)

    async def run_cross_platform_scanner(self):
        """Run cross-platform arbitrage scanner (Polymarket↔Kalshi)."""
        # Refresh config from database to pick up UI changes
        self.db.load_config(force_refresh=True)
        
        # Check STRATEGY flag
        if not self.config.trading.enable_cross_platform_arb:
            logger.info("⏸️ Cross-platform arbitrage DISABLED (strategy)")
            return
        
        # Check PLATFORM flags - cross-platform requires BOTH platforms enabled
        platform_poly = self.db.get_config("polymarket_enabled", True)
        platform_kalshi = self.db.get_config("kalshi_enabled", True)
        
        if not platform_poly or not platform_kalshi:
            logger.info(
                f"⏸️ Cross-platform arbitrage DISABLED "
                f"(requires both platforms: Poly={platform_poly}, "
                f"Kalshi={platform_kalshi})"
            )
            return

        if self.cross_platform_scanner:
            logger.info("▶️ Starting Cross-Platform Scanner...")
            await self.cross_platform_scanner.run(
                callback=self.on_cross_platform_opportunity
            )

    async def run_single_platform_scanner(self):
        """Run single-platform arbitrage scanner (intra-market)."""
        # Refresh config from database to pick up UI changes
        self.db.load_config(force_refresh=True)
        
        # STRATEGY FLAGS: Whether single-platform arb is enabled per platform
        strategy_poly = self.config.trading.enable_polymarket_single_arb
        strategy_kalshi = self.config.trading.enable_kalshi_single_arb
        
        # PLATFORM FLAGS: Whether the platform is enabled in Settings UI
        # UI saves these as 'polymarket_enabled' and 'kalshi_enabled'
        # Must check BOTH strategy AND platform enablement
        platform_poly = self.db.get_config("polymarket_enabled", True)
        platform_kalshi = self.db.get_config("kalshi_enabled", True)
        
        # Only scan if BOTH platform is enabled AND strategy is enabled
        enable_poly = strategy_poly and platform_poly
        enable_kalshi = strategy_kalshi and platform_kalshi
        
        # Log what's happening for debugging
        logger.info(
            f"📊 Platform Settings: "
            f"Poly(plat={platform_poly},strat={strategy_poly})→{enable_poly} | "
            f"Kalshi(plat={platform_kalshi},strat={strategy_kalshi})→{enable_kalshi}"
        )

        if not enable_poly and not enable_kalshi:
            logger.info("⏸️ Single-platform arb DISABLED (both platforms)")
            return

        if self.single_platform_scanner:
            logger.info(
                f"▶️ Starting Single-Platform Scanner | "
                f"Polymarket={'ON' if enable_poly else 'OFF'} | "
                f"Kalshi={'ON' if enable_kalshi else 'OFF'}"
            )
            await self.single_platform_scanner.run(
                enable_polymarket=enable_poly,
                enable_kalshi=enable_kalshi,
            )

    async def run_market_maker(self):
        """Run market making strategy (10-20% APR)."""
        if not self.config.trading.enable_market_making:
            logger.info("⏸️ Market Making DISABLED")
            return

        if self.market_maker:
            logger.info("▶️ Starting Market Maker Strategy...")
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.market_maker.run(duration_seconds=3600)
                except Exception as e:
                    logger.error(f"Market maker error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_news_arbitrage(self):
        """Run news arbitrage strategy (5-30% per event)."""
        if not self.config.trading.enable_news_arbitrage:
            logger.info("⏸️ News Arbitrage DISABLED")
            return

        if self.news_arbitrage:
            logger.info("▶️ Starting News Arbitrage Scanner...")
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.news_arbitrage.run(duration_seconds=3600)
                except Exception as e:
                    logger.error(f"News arbitrage error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_funding_rate_arb(self):
        """Run funding rate arbitrage strategy (85% CONFIDENCE - 15-50% APY)."""
        if not self.config.trading.enable_funding_rate_arb:
            logger.info("⏸️ Funding Rate Arb DISABLED")
            return

        if self.funding_rate_arb:
            logger.info("▶️ Starting Funding Rate Arb Strategy...")
            logger.info("  💰 Delta-neutral: Long spot, short perp")
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.funding_rate_arb.run(duration_seconds=3600)
                except Exception as e:
                    logger.error(f"Funding rate arb error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_grid_trading(self):
        """Run grid trading strategy (75% CONFIDENCE - 20-60% APY)."""
        if not self.config.trading.enable_grid_trading:
            logger.info("⏸️ Grid Trading DISABLED")
            return

        if self.grid_trading:
            logger.info("▶️ Starting Grid Trading Strategy...")
            logger.info("  📊 Profit from sideways price oscillation")

            # Auto-create default grids if none exist
            # Detect exchange to use correct symbol format
            exchange_id = getattr(self.ccxt_client, 'exchange_id', 'binance')
            is_us_exchange = 'us' in exchange_id.lower()

            # Choose symbols based on exchange
            if is_us_exchange:
                # Binance US uses /USD pairs
                default_symbols = ["BTC/USD", "ETH/USD"]
            else:
                # International exchanges use /USDT pairs
                default_symbols = ["BTC/USDT", "ETH/USDT"]

            # Create grids for default symbols if none exist
            active_grids = len([g for g in self.grid_trading.grids.values() if g.is_active])
            if active_grids == 0:
                logger.info(f"  🔧 Auto-creating grids for {default_symbols}")
                for symbol in default_symbols:
                    # Check if symbol exists on the exchange first
                    if hasattr(self.ccxt_client, 'has_symbol'):
                        if not self.ccxt_client.has_symbol(symbol):
                            logger.info(f"  ⏭️ Skipping {symbol} - not available on {exchange_id}")
                            continue
                    try:
                        grid = await self.grid_trading.create_grid(
                            symbol=symbol,
                            investment=float(self.config.trading.grid_default_investment_usd),
                            grid_levels=self.config.trading.grid_default_levels,
                        )
                        if grid:
                            logger.info(f"  ✅ Created grid for {symbol}")
                        else:
                            logger.warning(f"  ⚠️ Failed to create grid for {symbol}")
                    except Exception as e:
                        logger.error(f"  ❌ Error creating grid for {symbol}: {e}")

            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.grid_trading.run(duration_seconds=3600)
                except Exception as e:
                    logger.error(f"Grid trading error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_pairs_trading(self):
        """Run pairs trading strategy (65% CONFIDENCE - 10-25% APY)."""
        if not self.config.trading.enable_pairs_trading:
            logger.info("⏸️ Pairs Trading DISABLED")
            return

        if self.pairs_trading:
            logger.info("▶️ Starting Pairs Trading Strategy...")
            logger.info("  📈 Statistical arb on correlated pairs")
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.pairs_trading.run(duration_seconds=3600)
                except Exception as e:
                    logger.error(f"Pairs trading error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_stock_mean_reversion(self):
        """Run stock mean reversion strategy (70% CONFIDENCE - 15-30% APY)."""
        if not self.config.trading.enable_stock_mean_reversion:
            logger.info("⏸️ Stock Mean Reversion DISABLED")
            return

        if self.stock_mean_reversion:
            logger.info("▶️ Starting Stock Mean Reversion Strategy...")
            logger.info("  📉 Buy oversold stocks reverting to mean")
            scan_interval = self.config.trading.stock_mr_scan_interval_sec
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.stock_mean_reversion.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Stock mean reversion error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_stock_momentum(self):
        """Run stock momentum strategy (70% CONFIDENCE - 20-40% APY)."""
        if not self.config.trading.enable_stock_momentum:
            logger.info("⏸️ Stock Momentum DISABLED")
            return

        if self.stock_momentum:
            logger.info("▶️ Starting Stock Momentum Strategy...")
            logger.info("  📈 Ride trends in high-momentum stocks")
            scan_interval = self.config.trading.stock_mom_scan_interval_sec
            # Run indefinitely until stopped
            while self._running:
                try:
                    await self.stock_momentum.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Stock momentum error: {e}")
                    await asyncio.sleep(60)  # Wait before restart

    async def run_sector_rotation(self):
        """Run sector rotation strategy (70% CONFIDENCE - 15-25% APY)."""
        if not getattr(self.config.trading, 'enable_sector_rotation', False):
            return

        if self.sector_rotation:
            logger.info("▶️ Starting Sector Rotation Strategy...")
            logger.info("  📊 Rotating into strongest sector ETFs")
            scan_interval = getattr(self.config.trading, 'sector_rotation_interval_sec', 3600)
            while self._running:
                try:
                    await self.sector_rotation.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Sector rotation error: {e}")
                    await asyncio.sleep(300)

    async def run_dividend_growth(self):
        """Run dividend growth strategy (65% CONFIDENCE - 10-20% APY)."""
        if not getattr(self.config.trading, 'enable_dividend_growth', False):
            return

        if self.dividend_growth:
            logger.info("▶️ Starting Dividend Growth Strategy...")
            logger.info("  💰 Accumulating dividend aristocrats")
            scan_interval = getattr(self.config.trading, 'dividend_growth_interval_sec', 86400)
            while self._running:
                try:
                    await self.dividend_growth.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Dividend growth error: {e}")
                    await asyncio.sleep(300)

    async def run_earnings_momentum(self):
        """Run earnings momentum strategy (70% CONFIDENCE - 20-40% APY)."""
        if not getattr(self.config.trading, 'enable_earnings_momentum', False):
            return

        if self.earnings_momentum:
            logger.info("▶️ Starting Earnings Momentum Strategy...")
            logger.info("  📈 Trading post-earnings drift")
            scan_interval = getattr(self.config.trading, 'earnings_momentum_interval_sec', 3600)
            while self._running:
                try:
                    await self.earnings_momentum.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Earnings momentum error: {e}")
                    await asyncio.sleep(300)

    async def run_covered_calls(self):
        """Run covered calls strategy (75% CONFIDENCE - 15-25% APY)."""
        if not getattr(self.config.trading, 'enable_covered_calls', False):
            return

        if self.covered_call:
            logger.info("▶️ Starting Covered Calls Strategy...")
            logger.info("  📝 Selling calls against stock positions")
            scan_interval = getattr(self.config.trading, 'covered_calls_interval_sec', 3600)
            while self._running:
                try:
                    await self.covered_call.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Covered calls error: {e}")
                    await asyncio.sleep(300)

    async def run_cash_secured_puts(self):
        """Run cash secured puts strategy (75% CONFIDENCE - 15-25% APY)."""
        if not getattr(self.config.trading, 'enable_cash_secured_puts', False):
            return

        if self.cash_secured_put:
            logger.info("▶️ Starting Cash Secured Puts Strategy...")
            logger.info("  💵 Selling puts with cash collateral")
            scan_interval = getattr(self.config.trading, 'csp_interval_sec', 3600)
            while self._running:
                try:
                    await self.cash_secured_put.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Cash secured puts error: {e}")
                    await asyncio.sleep(300)

    async def run_iron_condor(self):
        """Run iron condor strategy (70% CONFIDENCE - 20-30% APY)."""
        if not getattr(self.config.trading, 'enable_iron_condor', False):
            return

        if self.iron_condor:
            logger.info("▶️ Starting Iron Condor Strategy...")
            logger.info("  🦅 Selling OTM call & put spreads")
            scan_interval = getattr(self.config.trading, 'iron_condor_interval_sec', 3600)
            while self._running:
                try:
                    await self.iron_condor.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Iron condor error: {e}")
                    await asyncio.sleep(300)

    async def run_wheel_strategy(self):
        """Run wheel strategy (80% CONFIDENCE - 20-35% APY)."""
        if not getattr(self.config.trading, 'enable_wheel_strategy', False):
            return

        if self.wheel_strategy:
            logger.info("▶️ Starting Wheel Strategy...")
            logger.info("  🎡 CSP → Assignment → CC cycle")
            scan_interval = getattr(self.config.trading, 'wheel_interval_sec', 3600)
            while self._running:
                try:
                    await self.wheel_strategy.run_cycle()
                    await asyncio.sleep(scan_interval)
                except Exception as e:
                    logger.error(f"Wheel strategy error: {e}")
                    await asyncio.sleep(300)

    # =========================================================================
    # TWITTER-DERIVED STRATEGIES (2024)
    # High-conviction strategies from analyzing top traders on X/Twitter
    # =========================================================================

    async def run_btc_bracket_arb(self):
        """Run BTC Bracket Arbitrage (85% CONFIDENCE - $20K-200K/month)."""
        if not getattr(self.config.trading, 'enable_btc_bracket_arb', False):
            return

        if self.btc_bracket_arb:
            logger.info("▶️ Starting BTC Bracket Arb Strategy...")
            logger.info("  💰 YES + NO < $1.00 = guaranteed profit")
            # Use the strategy's own run method
            await self.btc_bracket_arb.run()

    async def run_bracket_compression(self):
        """Run Bracket Compression (70% CONFIDENCE - 15-30% APY)."""
        if not getattr(self.config.trading, 'enable_bracket_compression', False):
            return

        if self.bracket_compression:
            logger.info("▶️ Starting Bracket Compression Strategy...")
            logger.info("  📊 Mean reversion on stretched bracket prices")
            # Use the strategy's own run method
            await self.bracket_compression.run()

    async def run_kalshi_mention_sniper(self):
        """Run Kalshi Mention Sniper (80% CONFIDENCE - $120+/event)."""
        if not getattr(self.config.trading, 'enable_kalshi_mention_snipe', False):
            return

        if self.kalshi_mention_sniper:
            logger.info("▶️ Starting Kalshi Mention Sniper...")
            logger.info("  ⚡ Fast execution on resolved mention markets")
            # Use the strategy's own run method
            await self.kalshi_mention_sniper.run()

    async def run_whale_copy_trading(self):
        """Run Whale Copy Trading (75% CONFIDENCE - 25-50% APY)."""
        if not getattr(self.config.trading, 'enable_whale_copy_trading', False):
            return

        if self.whale_copy_trading:
            logger.info("▶️ Starting Whale Copy Trading Strategy...")
            logger.info("  🐋 Track and copy 80%+ win rate wallets")
            # Use the strategy's own run method which handles DB integration
            await self.whale_copy_trading.run()

    async def run_macro_board(self):
        """Run Macro Board Strategy (65% CONFIDENCE - $62K/month)."""
        if not getattr(self.config.trading, 'enable_macro_board', False):
            return

        if self.macro_board:
            logger.info("▶️ Starting Macro Board Strategy...")
            logger.info("  🌍 Weighted macro event exposure")
            # Use the strategy's own run method
            await self.macro_board.run()

    async def run_fear_premium_contrarian(self):
        """Run Fear Premium Contrarian (70% CONFIDENCE - 25-60% APY)."""
        if not getattr(self.config.trading, 'enable_fear_premium_contrarian', False):
            return

        if self.fear_premium_contrarian:
            logger.info("▶️ Starting Fear Premium Contrarian Strategy...")
            logger.info("  😱 Trade against extreme sentiment | 91.4% win approach")
            # Use the strategy's own run method
            await self.fear_premium_contrarian.run()

    async def run_congressional_tracker(self):
        """Run Congressional Tracker (75% CONFIDENCE - Copy Congress trades)."""
        if not getattr(self.config.trading, 'enable_congressional_tracker', False):
            return

        if self.congressional_tracker:
            logger.info("▶️ Starting Congressional Tracker...")
            logger.info("  🏛️ Copying Congress member trades")
            # Use the strategy's own run method
            await self.congressional_tracker.run()

    async def run_political_event_strategy(self):
        """Run Political Event Strategy (80% CONFIDENCE)."""
        if not getattr(
            self.config.trading, 'enable_political_event_strategy', False
        ):
            return

        if self.political_event_strategy:
            logger.info("▶️ Starting Political Event Strategy...")
            logger.info("  🏛️ High-conviction political event trading")
            await self.political_event_strategy.run()

    async def run_high_conviction_strategy(self):
        """Run High Conviction Strategy (85% CONFIDENCE)."""
        if not getattr(
            self.config.trading, 'enable_high_conviction_strategy', False
        ):
            return

        if self.high_conviction_strategy:
            logger.info("▶️ Starting High Conviction Strategy...")
            logger.info("  🎯 Fewer, higher-confidence trades")
            await self.high_conviction_strategy.run()

    async def run_selective_whale_copy(self):
        """Run Selective Whale Copy Strategy (80% CONFIDENCE)."""
        if not getattr(
            self.config.trading, 'enable_selective_whale_copy', False
        ):
            return

        if self.selective_whale_copy:
            logger.info("▶️ Starting Selective Whale Copy Strategy...")
            logger.info("  🐋 Performance-based whale selection")
            await self.selective_whale_copy.run()

    async def run_crypto_15min_scalping(self):
        """Run 15-Minute Crypto Scalping Strategy (90% CONFIDENCE)."""
        if not getattr(
            self.config.trading, 'enable_15min_crypto_scalping', False
        ):
            return

        if self.crypto_15min_scalping:
            logger.info("▶️ Starting 15-Min Crypto Scalping Strategy...")
            logger.info("  ⚡ High-frequency BTC/ETH binary scalping")
            await self.crypto_15min_scalping.run()

    async def run_ai_superforecasting(self):
        """Run AI Superforecasting Strategy (85% CONFIDENCE)."""
        if not getattr(
            self.config.trading, 'enable_ai_superforecasting', False
        ):
            return

        if self.ai_superforecasting:
            logger.info("▶️ Starting AI Superforecasting Strategy...")
            logger.info("  🧠 Gemini-powered market analysis")
            await self.ai_superforecasting.run()

    async def run_spike_hunter(self):
        """
        Run Spike Hunter Strategy (HIGH PRIORITY - $5K-100K/month).
        
        Continuously polls Polymarket prices and feeds them to the spike detector.
        When a 2%+ move in <30s is detected, fades the spike for mean reversion.
        """
        if not getattr(
            self.config.trading, 'enable_spike_hunter', True
        ):
            logger.info("⏸️ Spike Hunter DISABLED")
            return

        if not self.spike_hunter:
            logger.warning("⚠️ Spike Hunter not initialized")
            return

        if not self.polymarket_client:
            logger.warning("⚠️ Spike Hunter needs Polymarket client")
            return

        logger.info("▶️ Starting Spike Hunter Strategy...")
        logger.info(
            f"  ⚡ Detecting {self.config.trading.spike_min_magnitude_pct}%+ "
            f"moves in {self.config.trading.spike_max_duration_sec}s"
        )

        # Price polling interval - fast for spike detection (1-2 seconds)
        poll_interval = 2.0

        while self._running:
            try:
                # Fetch active markets from Polymarket
                markets = await self.polymarket_client.get_markets(
                    limit=100,
                    active_only=True,
                    min_liquidity=5000,  # Only liquid markets for spike trading
                )

                # Update spike hunter with current prices
                for market in markets:
                    market_id = market.get('conditionId') or market.get('id')
                    if not market_id:
                        continue

                    # Get current price (midpoint of best bid/ask, or last trade)
                    price = None
                    if 'outcomePrices' in market and market['outcomePrices']:
                        # Use YES price
                        try:
                            price = float(market['outcomePrices'][0])
                        except (IndexError, ValueError, TypeError):
                            pass

                    if price is None:
                        # Try lastTradePrice
                        price = market.get('lastTradePrice')
                        if price:
                            try:
                                price = float(price)
                            except (ValueError, TypeError):
                                price = None

                    if price is not None and 0 < price < 1:
                        # Get volume for better spike detection
                        volume = float(market.get('volume24hr', 0) or 0)
                        
                        # Feed price to spike hunter
                        opportunity = self.spike_hunter.update_price(
                            market_id=market_id,
                            price=price,
                            volume=volume,
                        )
                        
                        # If opportunity detected, it's already handled by callback
                        # But we can also explicitly check here
                        if opportunity:
                            logger.debug(
                                f"Spike opportunity detected: {opportunity.id}"
                            )

                # Also manage existing positions (check for exits)
                await self._manage_spike_positions()

                await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.error(f"Spike hunter error: {e}")
                await asyncio.sleep(10)  # Wait before retry

    async def _manage_spike_positions(self):
        """Manage open spike positions - check for exits."""
        if not self.spike_hunter:
            return

        # Get active positions
        positions = list(self.spike_hunter._active_positions.values())

        for pos in positions:
            try:
                # Fetch current price for the market
                market_data = await self.polymarket_client.get_market(
                    pos.opportunity.market_id
                )
                if not market_data:
                    continue

                # Get current price
                current_price = None
                if 'outcomePrices' in market_data and market_data['outcomePrices']:
                    try:
                        current_price = float(market_data['outcomePrices'][0])
                    except (IndexError, ValueError, TypeError):
                        pass

                if current_price is None:
                    continue

                # Update position and check for exit
                exit_reason = self.spike_hunter.update_position(
                    pos.opportunity.id, current_price
                )

                if exit_reason:
                    logger.info(
                        f"🎯 Spike position exit: {exit_reason} - "
                        f"{pos.opportunity.market_id[:30]}..."
                    )

                    # Record exit in paper trader
                    if self.simulation_mode and self.paper_trader:
                        # The position tracks P&L internally
                        pass  # Stats already updated by spike_hunter

            except Exception as e:
                logger.debug(f"Error managing spike position: {e}")

    async def run_position_manager(self):
        """Run position manager."""
        if self.position_manager:
            await self.position_manager.run(
                on_claim=self.on_position_claim,
                on_update=self.on_portfolio_update,
            )

    async def run_news_sentiment(self):
        """Run news/sentiment engine."""
        if self.news_engine:
            # Fetch markets for matching
            markets = []
            if self.arb_detector:
                await self.arb_detector.fetch_active_markets()
                markets = [
                    {"conditionId": m.condition_id, "question": m.question}
                    for m in self.arb_detector.markets_cache.values()
                ]

            await self.news_engine.run(
                markets=markets,
                on_alert=self.on_news_alert,
            )

    async def run_balance_tracker(self):
        """Periodically fetch and save balances to database."""
        while self._running:
            try:
                # Use aggregator to fetch from all platforms and save to DB
                if self.balance_aggregator:
                    balance = await self.balance_aggregator.fetch_all_balances(
                        force_refresh=True
                    )
                    logger.info(
                        f"💰 Portfolio: ${float(balance.total_portfolio_usd):,.2f} | "
                        f"Cash: ${float(balance.total_cash_usd):,.2f} | "
                        f"Positions: ${float(balance.total_positions_usd):,.2f} | "
                        f"Platforms: {len(balance.platforms)}"
                    )
                else:
                    # Fallback to simple balance fetch (no DB save)
                    await self.fetch_balances()
            except Exception as e:
                logger.error(f"Error fetching balances: {e}")

            # Check every 5 minutes
            await asyncio.sleep(300)

    async def run_heartbeat(self):
        """
        Periodically update heartbeat in polybot_status and polybot_heartbeat tables.
        This allows the Admin UI to know the bot is alive and monitor detailed metrics.
        Updates every 60 seconds.
        """
        version = get_version()
        scan_count = 0
        errors_last_hour = 0

        while self._running:
            try:
                # Count active strategies
                active_strategies = []
                if self.enable_copy_trading and self.copy_trading:
                    active_strategies.append("copy_trading")
                if self.enable_arb_detection and self.arb_detector:
                    active_strategies.append("arb_detection")
                if getattr(self, 'cross_platform_scanner', None):
                    active_strategies.append("cross_platform_arb")
                if getattr(self, 'single_platform_scanner', None):
                    active_strategies.append("single_platform_arb")
                if getattr(self, 'market_maker', None):
                    active_strategies.append("market_making")
                if getattr(self, 'news_arbitrage', None):
                    active_strategies.append("news_arbitrage")
                if getattr(self, 'funding_rate_arb', None):
                    active_strategies.append("funding_rate_arb")
                if getattr(self, 'grid_trading', None):
                    active_strategies.append("grid_trading")
                if getattr(self, 'pairs_trading', None):
                    active_strategies.append("pairs_trading")
                if getattr(self, 'stock_mean_reversion', None):
                    active_strategies.append("stock_mean_reversion")
                if getattr(self, 'stock_momentum', None):
                    active_strategies.append("stock_momentum")
                if getattr(self, 'whale_copy_trading', None):
                    active_strategies.append("whale_copy_trading")
                if getattr(self, 'congressional_tracker', None):
                    active_strategies.append("congressional_tracker")
                if getattr(self, 'spike_hunter', None):
                    active_strategies.append("spike_hunter")

                # Get trades in last hour from paper trader
                trades_last_hour = 0
                if self.paper_trader and hasattr(self.paper_trader, 'stats'):
                    trades_last_hour = getattr(self.paper_trader.stats, 'opportunities_traded', 0)

                # Get scan count from analytics
                if self.analytics:
                    scan_count = getattr(self.analytics, 'total_opportunities', 0)

                self.db.heartbeat(
                    version=version,
                    scan_count=scan_count,
                    active_strategies=active_strategies,
                    is_dry_run=self.simulation_mode,
                    errors_last_hour=errors_last_hour,
                    trades_last_hour=trades_last_hour,
                    user_id=getattr(self, 'user_id', None),
                    metadata={
                        "simulation_mode": self.simulation_mode,
                        "paper_balance": getattr(self.paper_trader.stats, 'current_balance', 0) if self.paper_trader else 0,
                    }
                )
                logger.debug("💓 Heartbeat sent")
            except Exception as e:
                logger.warning(f"Heartbeat failed: {e}")
                errors_last_hour += 1
            await asyncio.sleep(60)  # Update every 60 seconds

    async def run_mode_checker(self):
        """
        Periodically check if trading mode has changed in the database.
        This enables hot-reloading of live/paper mode without restarting.
        """
        while self._running:
            try:
                # Check every 30 seconds for mode changes
                new_mode = self.db.get_trading_mode(force_refresh=True)
                current_mode = 'paper' if self.simulation_mode else 'live'
                
                if new_mode != current_mode:
                    # Mode changed!
                    logger.warning(
                        f"🔄 TRADING MODE CHANGE DETECTED: "
                        f"{current_mode.upper()} → {new_mode.upper()}"
                    )
                    
                    self.simulation_mode = (new_mode == 'paper')
                    
                    if new_mode == 'live':
                        logger.warning(
                            "⚠️ ⚠️ ⚠️  SWITCHING TO LIVE MODE - "
                            "REAL MONEY AT RISK  ⚠️ ⚠️ ⚠️"
                        )
                        self.notifier.send_alert(
                            "🔴 LIVE MODE ACTIVATED",
                            "Bot has switched to LIVE trading mode. "
                            "Real money will be used for trades.",
                            severity="critical"
                        )
                    else:
                        logger.info("📊 Switched to PAPER trading mode")
                        self.notifier.send_info(
                            "📊 Paper Mode Activated",
                            "Bot has switched to paper trading mode. "
                            "No real money will be used."
                        )
                        
            except Exception as e:
                logger.warning(f"Mode checker error: {e}")
            
            await asyncio.sleep(30)  # Check every 30 seconds

    async def run_paper_trading_stats(self):
        """Periodically save paper trading stats and print summary."""
        while self._running:
            await asyncio.sleep(60)  # Save stats every minute

            if self.paper_trader:
                try:
                    # Save stats to database
                    await self.paper_trader.save_stats_to_db()

                    # Log summary
                    stats = self.paper_trader.stats
                    if stats.opportunities_seen > 0:
                        logger.info(
                            f"📊 REALISTIC SIM: "
                            f"Balance: ${stats.current_balance:.2f} | "
                            f"P&L: ${stats.total_pnl:+.2f} ({stats.roi_pct:+.1f}%) | "
                            f"Trades: {stats.opportunities_traded} | "
                            f"Win: {stats.win_rate:.0f}% | "
                            f"Exec: {stats.execution_success_rate:.0f}%"
                        )
                except Exception as e:
                    logger.error(f"Error saving paper trading stats: {e}")

            # Save per-strategy analytics
            try:
                await self.analytics.save_to_db(self.db)
                # Print strategy comparison every 5 minutes
                if self.analytics.total_opportunities > 0:
                    logger.info(self.analytics.get_comparison_summary())
            except Exception as e:
                logger.error(f"Error saving analytics: {e}")

    async def run(self):
        """Run all enabled features concurrently."""
        try:
            await self.initialize()
        except Exception as e:
            logger.error(f"❌ CRITICAL: Initialize failed: {e}")
            logger.error("Bot will continue with limited functionality")
            import traceback
            traceback.print_exc()

        self._running = True

        # Use self.config which was loaded from Supabase
        logger.info("=" * 60)
        logger.info("PolyBot Starting!")
        logger.info("✅ Config loaded from Supabase (autonomous mode)")
        mode_str = 'SIMULATION' if self.simulation_mode else 'LIVE'
        logger.info(f"Mode: {mode_str}")
        logger.info("Features enabled:")
        logger.info(f"  - Copy Trading: {self.enable_copy_trading}")
        logger.info(f"  - Arb Detection: {self.enable_arb_detection}")
        logger.info(f"  - Position Manager: {self.enable_position_manager}")
        logger.info(f"  - News/Sentiment: {self.enable_news_sentiment}")
        logger.info("-" * 60)
        # =================================================================
        # PLATFORM ENABLEMENT FLAGS (from UI Settings)
        # These are the MASTER switches that control which platforms can run
        # =================================================================
        poly_enabled = self.db.get_config("polymarket_enabled", True)
        kalshi_enabled = self.db.get_config("kalshi_enabled", True)
        logger.info("🔧 PLATFORM SETTINGS (from UI):")
        logger.info(f"  🟣 Polymarket: {'✅ ENABLED' if poly_enabled else '❌ DISABLED'}")
        logger.info(f"  🟢 Kalshi: {'✅ ENABLED' if kalshi_enabled else '❌ DISABLED'}")
        logger.info("-" * 60)
        logger.info("ARBITRAGE STRATEGIES (from Supabase polybot_config):")
        ps = self.config.trading.enable_polymarket_single_arb
        ks = self.config.trading.enable_kalshi_single_arb
        cp = self.config.trading.enable_cross_platform_arb
        mm = self.config.trading.enable_market_making
        na = self.config.trading.enable_news_arbitrage
        fra = self.config.trading.enable_funding_rate_arb
        gt = self.config.trading.enable_grid_trading
        pt = self.config.trading.enable_pairs_trading
        smr = self.config.trading.enable_stock_mean_reversion
        sm = self.config.trading.enable_stock_momentum
        logger.info(f"  🟣 Polymarket Single-Platform: {'ON' if ps and poly_enabled else 'OFF'}{' (platform disabled)' if ps and not poly_enabled else ''}")
        logger.info(f"  🟢 Kalshi Single-Platform: {'ON' if ks and kalshi_enabled else 'OFF'}{' (platform disabled)' if ks and not kalshi_enabled else ''}")
        logger.info(f"  🟣🟢 Cross-Platform (Poly↔Kalshi): {'ON' if cp and poly_enabled and kalshi_enabled else 'OFF'}{' (needs both platforms)' if cp and (not poly_enabled or not kalshi_enabled) else ''}")
        logger.info(f"  🟣 Market Making (10-20% APR): {'ON' if mm and poly_enabled else 'OFF'}{' (platform disabled)' if mm and not poly_enabled else ''}")
        logger.info(f"  - News Arbitrage (5-30%/event): {'ON' if na else 'OFF'}")
        logger.info("-" * 60)
        logger.info("CRYPTO STRATEGIES (HIGH PRIORITY):")
        logger.info(
            f"  - Funding Rate Arb (85%): {'ON' if fra else 'OFF'}"
        )
        logger.info(
            f"  - Grid Trading (75%): {'ON' if gt else 'OFF'}"
        )
        logger.info(
            f"  - Pairs Trading (65%): {'ON' if pt else 'OFF'}"
        )
        logger.info("-" * 60)
        logger.info("STOCK STRATEGIES (Alpaca):")
        logger.info(
            f"  - Stock Mean Reversion (70%): {'ON' if smr else 'OFF'}"
        )
        logger.info(
            f"  - Stock Momentum (70%): {'ON' if sm else 'OFF'}"
        )
        logger.info("-" * 60)
        logger.info("TWITTER-DERIVED STRATEGIES (2024):")
        btc_br = getattr(self.config.trading, 'enable_btc_bracket_arb', False)
        br_comp = getattr(self.config.trading, 'enable_bracket_compression', False)
        kal_snipe = getattr(self.config.trading, 'enable_kalshi_mention_snipe', False)
        wh_copy = getattr(self.config.trading, 'enable_whale_copy_trading', False)
        mac_board = getattr(self.config.trading, 'enable_macro_board', False)
        fear_pr = getattr(self.config.trading, 'enable_fear_premium_contrarian', False)
        cong_tr = getattr(self.config.trading, 'enable_congressional_tracker', False)
        # BTC Bracket uses BOTH platforms
        btc_can_run = btc_br and (poly_enabled or kalshi_enabled)
        logger.info(f"  🟣🟢 BTC Bracket Arb (85%): {'ON' if btc_can_run else 'OFF'}{' (no platforms enabled)' if btc_br and not btc_can_run else ''}")
        # Bracket Compression uses BOTH platforms
        br_can_run = br_comp and (poly_enabled or kalshi_enabled)
        logger.info(f"  🟣🟢 Bracket Compression (70%): {'ON' if br_can_run else 'OFF'}{' (no platforms enabled)' if br_comp and not br_can_run else ''}")
        # Kalshi Mention Snipe - Kalshi ONLY
        kal_can_run = kal_snipe and kalshi_enabled
        logger.info(f"  🟢 Kalshi Mention Snipe (80%): {'ON' if kal_can_run else 'OFF'}{' (Kalshi disabled)' if kal_snipe and not kalshi_enabled else ''}")
        # Whale Copy Trading - Polymarket ONLY
        wh_can_run = wh_copy and poly_enabled
        logger.info(f"  🟣 Whale Copy Trading (75%): {'ON' if wh_can_run else 'OFF'}{' (Polymarket disabled)' if wh_copy and not poly_enabled else ''}")
        # Macro Board uses BOTH platforms
        mac_can_run = mac_board and (poly_enabled or kalshi_enabled)
        logger.info(f"  🟣🟢 Macro Board (65%): {'ON' if mac_can_run else 'OFF'}{' (no platforms enabled)' if mac_board and not mac_can_run else ''}")
        # Fear Premium uses BOTH platforms
        fear_can_run = fear_pr and (poly_enabled or kalshi_enabled)
        logger.info(f"  🟣🟢 Fear Premium Contrarian (70%): {'ON' if fear_can_run else 'OFF'}{' (no platforms enabled)' if fear_pr and not fear_can_run else ''}")
        # Congressional Tracker - Stocks (Alpaca)
        logger.info(f"  📈 Congressional Tracker (75%): {'ON' if cong_tr else 'OFF'}")
        
        # Additional strategies with platform indicators
        crypto_scalp = getattr(self.config.trading, 'enable_15min_crypto_scalping', False)
        ai_forecast = getattr(self.config.trading, 'enable_ai_superforecasting', False)
        spike_hunt = getattr(self.config.trading, 'enable_spike_hunter', True)
        sel_whale = getattr(self.config.trading, 'enable_selective_whale_copy', False)
        logger.info("-" * 60)
        logger.info("ADDITIONAL PREDICTION MARKET STRATEGIES:")
        # 15-Min Crypto Scalping - Polymarket ONLY
        scalp_can_run = crypto_scalp and poly_enabled
        logger.info(f"  🟣 15-Min Crypto Scalping (90%): {'ON' if scalp_can_run else 'OFF'}{' (Polymarket disabled)' if crypto_scalp and not poly_enabled else ''}")
        # AI Superforecasting - Polymarket ONLY
        ai_can_run = ai_forecast and poly_enabled
        logger.info(f"  🟣 AI Superforecasting (85%): {'ON' if ai_can_run else 'OFF'}{' (Polymarket disabled)' if ai_forecast and not poly_enabled else ''}")
        # Spike Hunter - Polymarket ONLY
        spike_can_run = spike_hunt and poly_enabled
        logger.info(f"  🟣 Spike Hunter ($5K-100K/mo): {'ON' if spike_can_run else 'OFF'}{' (Polymarket disabled)' if spike_hunt and not poly_enabled else ''}")
        # Selective Whale Copy - Polymarket ONLY
        sel_can_run = sel_whale and poly_enabled
        logger.info(f"  🟣 Selective Whale Copy (80%): {'ON' if sel_can_run else 'OFF'}{' (Polymarket disabled)' if sel_whale and not poly_enabled else ''}")
        logger.info("=" * 60)

        # Send startup notification
        self.notifier.send_startup(
            dry_run=self.simulation_mode,
            max_trade_size=self.config.trading.max_trade_size,
        )

        # Create tasks for each enabled feature
        tasks = []

        if self.enable_copy_trading and self.copy_trading:
            tasks.append(asyncio.create_task(self.run_copy_trading()))

        # Overlapping arb is POLYMARKET ONLY - check platform enabled
        if self.enable_arb_detection and self.arb_detector and poly_enabled:
            tasks.append(asyncio.create_task(self.run_arb_detection()))

        # Run cross-platform scanner if enabled
        if cp and self.cross_platform_scanner:
            tasks.append(
                asyncio.create_task(
                    self._resilient_task("cross_platform_scanner",
                                        self.run_cross_platform_scanner)
                )
            )

        # Run single-platform scanner if either platform enabled
        if (ps or ks) and self.single_platform_scanner:
            tasks.append(
                asyncio.create_task(
                    self._resilient_task("single_platform_scanner",
                                        self.run_single_platform_scanner)
                )
            )

        # Run Market Making strategy (HIGH confidence - 10-20% APR)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        if mm and self.market_maker and poly_enabled:
            tasks.append(asyncio.create_task(self.run_market_maker()))
        elif mm and self.market_maker and not poly_enabled:
            logger.info("⏸️ Market Maker SKIPPED (Polymarket disabled)")

        # Run News Arbitrage strategy (MEDIUM confidence)
        if na and self.news_arbitrage:
            tasks.append(asyncio.create_task(self.run_news_arbitrage()))

        # =====================================================================
        # CRYPTO STRATEGIES (HIGH PRIORITY)
        # =====================================================================

        # Run Funding Rate Arb (85% CONFIDENCE - 15-50% APY)
        if fra and self.funding_rate_arb:
            tasks.append(asyncio.create_task(self.run_funding_rate_arb()))

        # Run Grid Trading (75% CONFIDENCE - 20-60% APY)
        if gt and self.grid_trading:
            tasks.append(asyncio.create_task(self.run_grid_trading()))

        # Run Pairs Trading (65% CONFIDENCE - 10-25% APY)
        if pt and self.pairs_trading:
            tasks.append(asyncio.create_task(self.run_pairs_trading()))

        # Run Stock Mean Reversion (70% CONFIDENCE - 15-30% APY)
        if smr and self.stock_mean_reversion:
            tasks.append(asyncio.create_task(self.run_stock_mean_reversion()))

        # Run Stock Momentum (70% CONFIDENCE - 20-40% APY)
        if sm and self.stock_momentum:
            tasks.append(asyncio.create_task(self.run_stock_momentum()))

        # =====================================================================
        # ADVANCED STOCK STRATEGIES (ALPACA)
        # =====================================================================

        # Run Sector Rotation (70% CONFIDENCE - 15-25% APY)
        sector_rot = getattr(
            self.config.trading, 'enable_sector_rotation', False
        )
        if sector_rot and getattr(self, 'sector_rotation', None):
            tasks.append(asyncio.create_task(self.run_sector_rotation()))

        # Run Dividend Growth (65% CONFIDENCE - 10-20% APY)
        div_growth = getattr(
            self.config.trading, 'enable_dividend_growth', False
        )
        if div_growth and getattr(self, 'dividend_growth', None):
            tasks.append(asyncio.create_task(self.run_dividend_growth()))

        # Run Earnings Momentum (70% CONFIDENCE - 20-40% APY)
        earn_mom = getattr(
            self.config.trading, 'enable_earnings_momentum', False
        )
        if earn_mom and getattr(self, 'earnings_momentum', None):
            tasks.append(asyncio.create_task(self.run_earnings_momentum()))

        # =====================================================================
        # OPTIONS STRATEGIES (IBKR)
        # =====================================================================

        # Run Covered Calls (75% CONFIDENCE - 15-25% APY)
        cov_calls = getattr(
            self.config.trading, 'enable_covered_calls', False
        )
        if cov_calls and getattr(self, 'covered_call', None):
            tasks.append(asyncio.create_task(self.run_covered_calls()))

        # Run Cash Secured Puts (75% CONFIDENCE - 15-25% APY)
        csp = getattr(
            self.config.trading, 'enable_cash_secured_puts', False
        )
        if csp and getattr(self, 'cash_secured_put', None):
            tasks.append(asyncio.create_task(self.run_cash_secured_puts()))

        # Run Iron Condor (70% CONFIDENCE - 20-30% APY)
        iron_cond = getattr(
            self.config.trading, 'enable_iron_condor', False
        )
        if iron_cond and getattr(self, 'iron_condor', None):
            tasks.append(asyncio.create_task(self.run_iron_condor()))

        # Run Wheel Strategy (80% CONFIDENCE - 20-35% APY)
        wheel = getattr(
            self.config.trading, 'enable_wheel_strategy', False
        )
        if wheel and getattr(self, 'wheel_strategy', None):
            tasks.append(asyncio.create_task(self.run_wheel_strategy()))

        # =====================================================================
        # TWITTER-DERIVED STRATEGIES (2024)
        # High-conviction strategies from analyzing top traders on X/Twitter
        # =====================================================================

        # Run BTC Bracket Arb (85% CONFIDENCE)
        # 🟣🟢 BOTH PLATFORMS - needs at least one enabled
        btc_bracket = getattr(
            self.config.trading, 'enable_btc_bracket_arb', False
        )
        if btc_bracket and self.btc_bracket_arb and (poly_enabled or kalshi_enabled):
            tasks.append(asyncio.create_task(self.run_btc_bracket_arb()))
        elif btc_bracket and self.btc_bracket_arb:
            logger.info("⏸️ BTC Bracket Arb SKIPPED (no platforms enabled)")

        # Run Bracket Compression (70% CONFIDENCE)
        # 🟣🟢 BOTH PLATFORMS - needs at least one enabled
        bracket_comp = getattr(
            self.config.trading, 'enable_bracket_compression', False
        )
        if bracket_comp and self.bracket_compression and (poly_enabled or kalshi_enabled):
            tasks.append(asyncio.create_task(self.run_bracket_compression()))
        elif bracket_comp and self.bracket_compression:
            logger.info("⏸️ Bracket Compression SKIPPED (no platforms enabled)")

        # Run Kalshi Mention Sniper (80% CONFIDENCE)
        # 🟢 KALSHI ONLY - requires kalshi_enabled
        kalshi_snipe = getattr(
            self.config.trading, 'enable_kalshi_mention_snipe', False
        )
        if kalshi_snipe and self.kalshi_mention_sniper and kalshi_enabled:
            tasks.append(asyncio.create_task(self.run_kalshi_mention_sniper()))
        elif kalshi_snipe and self.kalshi_mention_sniper:
            logger.info("⏸️ Kalshi Mention Sniper SKIPPED (Kalshi disabled)")

        # Run Whale Copy Trading (75% CONFIDENCE)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        whale_copy = getattr(
            self.config.trading, 'enable_whale_copy_trading', False
        )
        if whale_copy and self.whale_copy_trading and poly_enabled:
            tasks.append(asyncio.create_task(self.run_whale_copy_trading()))
        elif whale_copy and self.whale_copy_trading:
            logger.info("⏸️ Whale Copy Trading SKIPPED (Polymarket disabled)")

        # Run Macro Board (65% CONFIDENCE)
        # 🟣🟢 BOTH PLATFORMS - needs at least one enabled
        macro = getattr(self.config.trading, 'enable_macro_board', False)
        if macro and self.macro_board and (poly_enabled or kalshi_enabled):
            tasks.append(asyncio.create_task(self.run_macro_board()))
        elif macro and self.macro_board:
            logger.info("⏸️ Macro Board SKIPPED (no platforms enabled)")

        # Run Fear Premium Contrarian (70% CONFIDENCE)
        # 🟣🟢 BOTH PLATFORMS - needs at least one enabled
        fear_prem = getattr(
            self.config.trading, 'enable_fear_premium_contrarian', False
        )
        if fear_prem and self.fear_premium_contrarian and (poly_enabled or kalshi_enabled):
            tasks.append(asyncio.create_task(self.run_fear_premium_contrarian()))
        elif fear_prem and self.fear_premium_contrarian:
            logger.info("⏸️ Fear Premium Contrarian SKIPPED (no platforms enabled)")

        # Run Congressional Tracker (75% CONFIDENCE)
        congress = getattr(
            self.config.trading, 'enable_congressional_tracker', False
        )
        if congress and self.congressional_tracker:
            tasks.append(asyncio.create_task(self.run_congressional_tracker()))

        # Run Political Event Strategy (80% CONFIDENCE)
        pol_event = getattr(
            self.config.trading, 'enable_political_event_strategy', False
        )
        if pol_event and self.political_event_strategy:
            tasks.append(asyncio.create_task(self.run_political_event_strategy()))

        # Run High Conviction Strategy (85% CONFIDENCE)
        high_conv = getattr(
            self.config.trading, 'enable_high_conviction_strategy', False
        )
        if high_conv and self.high_conviction_strategy:
            tasks.append(asyncio.create_task(self.run_high_conviction_strategy()))

        # Run Selective Whale Copy (80% CONFIDENCE)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        sel_whale = getattr(
            self.config.trading, 'enable_selective_whale_copy', False
        )
        if sel_whale and self.selective_whale_copy and poly_enabled:
            tasks.append(asyncio.create_task(self.run_selective_whale_copy()))
        elif sel_whale and self.selective_whale_copy:
            logger.info("⏸️ Selective Whale Copy SKIPPED (Polymarket disabled)")

        # Run 15-Min Crypto Scalping (90% CONFIDENCE)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        crypto_scalp = getattr(
            self.config.trading, 'enable_15min_crypto_scalping', False
        )
        if crypto_scalp and self.crypto_15min_scalping and poly_enabled:
            tasks.append(asyncio.create_task(self.run_crypto_15min_scalping()))
        elif crypto_scalp and self.crypto_15min_scalping:
            logger.info("⏸️ 15-Min Crypto Scalping SKIPPED (Polymarket disabled)")

        # Run AI Superforecasting (85% CONFIDENCE)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        ai_forecast = getattr(
            self.config.trading, 'enable_ai_superforecasting', False
        )
        if ai_forecast and self.ai_superforecasting and poly_enabled:
            tasks.append(asyncio.create_task(self.run_ai_superforecasting()))
        elif ai_forecast and self.ai_superforecasting:
            logger.info("⏸️ AI Superforecasting SKIPPED (Polymarket disabled)")

        # Run Spike Hunter (HIGH PRIORITY - $5K-100K/month)
        # 🟣 POLYMARKET ONLY - requires polymarket_enabled
        spike_enabled = getattr(
            self.config.trading, 'enable_spike_hunter', True
        )
        if spike_enabled and self.spike_hunter and poly_enabled:
            tasks.append(asyncio.create_task(self.run_spike_hunter()))
        elif spike_enabled and self.spike_hunter:
            logger.info("⏸️ Spike Hunter SKIPPED (Polymarket disabled)")

        if self.enable_position_manager and self.position_manager:
            tasks.append(asyncio.create_task(self.run_position_manager()))

        if self.enable_news_sentiment and self.news_engine:
            tasks.append(asyncio.create_task(self.run_news_sentiment()))

        # Always run balance tracker (resilient)
        tasks.append(asyncio.create_task(
            self._resilient_task("balance_tracker", self.run_balance_tracker)
        ))

        # Always run heartbeat to update polybot_status (resilient)
        tasks.append(asyncio.create_task(
            self._resilient_task("heartbeat", self.run_heartbeat)
        ))

        # Always run trading mode checker (hot-reload mode changes)
        tasks.append(asyncio.create_task(
            self._resilient_task("mode_checker", self.run_mode_checker)
        ))

        # Run paper trading stats saver if in simulation mode
        if self.simulation_mode and self.paper_trader:
            tasks.append(asyncio.create_task(self.run_paper_trading_stats()))

        self._tasks = tasks

        if not tasks:
            logger.warning("No features enabled! Exiting.")
            return

        try:
            # Run all tasks concurrently
            # CRITICAL: return_exceptions=True prevents one failing task from crashing all others
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Log any exceptions that occurred
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    task_name = self._tasks[i].get_name() if hasattr(self._tasks[i], 'get_name') else f"task_{i}"
                    logger.error(f"Task {task_name} failed with error: {result}")

        except asyncio.CancelledError:
            logger.info("Tasks cancelled, shutting down...")
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            raise

    async def shutdown(self):
        """Gracefully shutdown all features."""
        logger.info("Shutting down PolyBot...")
        self._running = False

        # Send shutdown notification
        self.notifier.send_shutdown("Bot stopped by user")

        # Print final analytics summary
        logger.info("\n" + self.analytics.get_comparison_summary())
        logger.info(self.analytics.get_recommendation())

        if self.copy_trading:
            self.copy_trading.stop()
        if self.arb_detector:
            self.arb_detector.stop()
        if self.cross_platform_scanner:
            self.cross_platform_scanner.stop()
        if self.single_platform_scanner:
            self.single_platform_scanner.stop()
        if self.market_maker:
            self.market_maker.stop()
        if self.news_arbitrage:
            self.news_arbitrage.stop()
        if self.position_manager:
            self.position_manager.stop()
        if self.news_engine:
            self.news_engine.stop()

        # Stop crypto strategies
        if self.funding_rate_arb:
            await self.funding_rate_arb.stop()
        if self.grid_trading:
            await self.grid_trading.stop()
        if self.pairs_trading:
            await self.pairs_trading.stop()

        # Stop Twitter-derived strategies
        if self.btc_bracket_arb:
            self.btc_bracket_arb.stop()
        if self.bracket_compression:
            self.bracket_compression.stop()
        if self.kalshi_mention_sniper:
            self.kalshi_mention_sniper.stop()
        if self.whale_copy_trading:
            self.whale_copy_trading.stop()
        if self.macro_board:
            self.macro_board.stop()
        if self.fear_premium_contrarian:
            self.fear_premium_contrarian.stop()

        # Stop new strategies (2025)
        if self.political_event_strategy:
            self.political_event_strategy.stop()
        if self.high_conviction_strategy:
            self.high_conviction_strategy.stop()
        if self.selective_whale_copy:
            self.selective_whale_copy.stop()
        if self.crypto_15min_scalping:
            self.crypto_15min_scalping.stop()
        if self.ai_superforecasting:
            self.ai_superforecasting.stop()

        # Close exchange connections (prevents unclosed session warnings)
        # Close all CCXT clients (multi-exchange support)
        for exchange_id, client in self.ccxt_clients.items():
            try:
                await client.close()
                logger.debug(f"CCXT client {exchange_id} closed")
            except Exception as e:
                logger.debug(f"Error closing CCXT client {exchange_id}: {e}")

        if self.alpaca_client:
            try:
                await self.alpaca_client.close()
                logger.debug("Alpaca client closed")
            except Exception as e:
                logger.debug(f"Error closing Alpaca client: {e}")

        if self.single_platform_scanner:
            try:
                await self.single_platform_scanner.close()
                logger.debug("Scanner session closed")
            except Exception as e:
                logger.debug(f"Error closing scanner: {e}")

        # Cancel all running tasks
        for task in self._tasks:
            task.cancel()

        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

        logger.info("PolyBot shutdown complete")


def setup_signal_handlers(runner: PolybotRunner, loop: asyncio.AbstractEventLoop):
    """Setup graceful shutdown on SIGINT/SIGTERM."""
    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(runner.shutdown())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)


async def main():
    """Main entry point."""
    # Configure logging with force=True to override module-level handlers
    # The DatabaseLogHandler added at import time prevents basicConfig from
    # adding a StreamHandler to stdout, so we use force=True (Python 3.8+)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,  # CRITICAL: Override pre-existing handlers
    )

    # Also ensure we have stdout logging for container logs
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logging.getLogger().addHandler(console_handler)

    # NOW add database logging (after stdout is configured)
    # This writes logs to Supabase for the admin UI
    setup_database_logging()

    logger.info("🚀 PolyBot starting up...")

    # Global reference to bot runner for health server
    global_runner = {'instance': None}

    # CRITICAL: Start health server FIRST before anything else
    # This ensures Lightsail health checks pass even if bot init crashes
    logger.info("🏥 Starting health server FIRST for deployment health checks...")
    health_task = asyncio.create_task(start_health_server(bot_runner=None, runner_ref=global_runner))
    # Give health server time to start
    await asyncio.sleep(2)
    logger.info("✅ Health server started, proceeding with bot initialization...")

    # Load simulation mode from database (Admin UI setting)
    # This allows toggling simulation/live from the UI without code changes
    bot_user_id = os.getenv("BOT_USER_ID")
    db = Database(user_id=bot_user_id)  # Pass user_id for multi-tenancy
    simulation_mode = True  # Safe default
    
    try:
        if db._client:
            # First try to load from user's polybot_profiles (primary source of truth)
            if bot_user_id:
                profile_result = db._client.table('polybot_profiles').select(
                    'is_simulation'
                ).eq('id', bot_user_id).single().execute()
                
                if profile_result.data:
                    simulation_mode = profile_result.data.get('is_simulation', True)
                    mode_str = 'SIMULATION' if simulation_mode else '🔴 LIVE'
                    logger.info(f"📊 Loaded mode from polybot_profiles for user {bot_user_id[:8]}...: {mode_str}")
                else:
                    # Fallback to polybot_status for the user
                    status_result = db._client.table('polybot_status').select(
                        'dry_run_mode'
                    ).eq('user_id', bot_user_id).single().execute()
                    
                    if status_result.data:
                        simulation_mode = status_result.data.get('dry_run_mode', True)
                        mode_str = 'SIMULATION' if simulation_mode else '🔴 LIVE'
                        logger.info(f"📊 Loaded mode from polybot_status for user {bot_user_id[:8]}...: {mode_str}")
            else:
                # No user ID - try to get first row (backward compatibility)
                result = db._client.table('polybot_status').select(
                    'dry_run_mode'
                ).limit(1).execute()
                if result.data and len(result.data) > 0:
                    simulation_mode = result.data[0].get('dry_run_mode', True)
                    mode_str = 'SIMULATION' if simulation_mode else '🔴 LIVE'
                    logger.info(f"📊 Loaded mode from database (no user_id): {mode_str}")
                else:
                    logger.warning(
                        "No status row in polybot_status, defaulting to SIMULATION"
                    )
    except Exception as e:
        logger.warning(f"Could not load trading mode: {e}")
        simulation_mode = True
    
    # Log final mode decision with clear warning for LIVE
    if not simulation_mode:
        logger.warning("⚠️ ⚠️ ⚠️  LIVE TRADING MODE ENABLED - REAL MONEY AT RISK  ⚠️ ⚠️ ⚠️")

    # Example tracked traders (these are whale addresses on Polymarket)
    tracked_traders = [
        # Add trader addresses to copy here
    ]

    try:
        runner = PolybotRunner(
            tracked_traders=tracked_traders,
            enable_copy_trading=True,
            enable_arb_detection=True,
            enable_position_manager=True,
            enable_news_sentiment=True,
            simulation_mode=simulation_mode,
        )
        # Update global reference so health server can access it
        global_runner['instance'] = runner
        logger.info("✅ PolybotRunner initialized successfully!")
    except Exception as e:
        logger.error(f"❌ CRITICAL: Failed to create PolybotRunner: {e}")
        import traceback
        traceback.print_exc()
        # Mark as failed - health endpoint will now return 503
        # This ensures container will be restarted by orchestrator
        global_runner['instance'] = None
        global_runner['failed'] = True
        global_runner['error'] = str(e)
        logger.error("Bot initialization failed - health endpoint will report unhealthy")
        # Keep health server running briefly so we can see the error
        # Then exit to trigger container restart
        await asyncio.sleep(30)
        logger.error("Exiting due to initialization failure")
        return

    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    setup_signal_handlers(runner, loop)

    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"❌ CRITICAL: Bot runner crashed: {e}")
        import traceback
        traceback.print_exc()
        # Mark the runner as not running so health check fails
        if runner:
            runner._running = False
    finally:
        health_task.cancel()
        if runner:
            await runner.shutdown()


def get_version():
    """Get version from VERSION file."""
    import os
    version_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'VERSION')
    try:
        with open(version_file, 'r') as f:
            return f.read().strip()
    except:
        return "1.0.0"

def get_build_number():
    """Get build number from BUILD_NUMBER env var, git commit count, or BUILD file."""
    import subprocess
    import os

    # First check env var (set during docker build)
    env_build = os.environ.get('BUILD_NUMBER')
    if env_build:
        try:
            return int(env_build)
        except:
            pass

    # Check BUILD file
    build_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'BUILD')
    try:
        with open(build_file, 'r') as f:
            return int(f.read().strip())
    except:
        pass

    # Try git
    try:
        result = subprocess.run(['git', 'rev-list', '--count', 'HEAD'],
                                capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__)))
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass

    return 17  # Default to current deployment version


async def start_health_server(port: int = 8080, bot_runner=None, runner_ref=None):
    """Start a simple HTTP health check server for Lightsail.

    Args:
        port: Port to listen on
        bot_runner: Direct reference to PolybotRunner (legacy)
        runner_ref: Dict with 'instance' key that gets updated after init
    """
    from aiohttp import web
    import os

    version = get_version()
    build = get_build_number()

    def get_runner():
        """Get bot runner from direct ref or runner_ref dict."""
        if bot_runner:
            return bot_runner
        if runner_ref and runner_ref.get('instance'):
            return runner_ref['instance']
        return None

    async def health_handler(request):
        """
        Health check that ACTUALLY verifies the bot is running.
        Returns 503 if bot has stopped trading (even if web server is up).
        """
        # Check for initialization failure
        if runner_ref and runner_ref.get('failed'):
            error = runner_ref.get('error', 'Unknown error')
            return web.Response(
                text=f"UNHEALTHY: Bot failed to start - {error}",
                status=503
            )
        
        runner = get_runner()
        
        # Check 1: Is the runner initialized?
        if not runner:
            return web.Response(
                text="UNHEALTHY: Bot runner not initialized",
                status=503
            )
        
        # Check 2: Is the bot still in running state?
        if not runner._running:
            return web.Response(
                text="UNHEALTHY: Bot has stopped (_running=False)",
                status=503
            )
        
        # Check 3: Are there any active tasks?
        if hasattr(runner, '_tasks') and runner._tasks:
            active_tasks = [t for t in runner._tasks if not t.done()]
            if len(active_tasks) == 0:
                return web.Response(
                    text="UNHEALTHY: All tasks have stopped",
                    status=503
                )
        
        return web.Response(text="OK", status=200)

    async def status_handler(request):
        """Status endpoint with detailed health info."""
        runner = get_runner()
        
        # Determine actual health state
        health_status = "unhealthy"
        health_reason = "Bot not initialized"
        
        if runner:
            if runner._running:
                active_tasks = 0
                if hasattr(runner, '_tasks') and runner._tasks:
                    active_tasks = len([t for t in runner._tasks if not t.done()])
                
                if active_tasks > 0:
                    health_status = "healthy"
                    health_reason = f"{active_tasks} tasks running"
                else:
                    health_reason = "No active tasks"
            else:
                health_reason = "Bot stopped (_running=False)"
        
        return web.json_response({
            "status": health_status,
            "reason": health_reason,
            "service": "polybot",
            "version": version,
            "build": build,
            "fullVersion": f"v{version} (Build #{build})",
        })

    async def debug_secrets_handler(request):
        """Debug endpoint to check if secrets are being loaded."""
        try:
            runner = get_runner()
            # Debug info
            debug_info = {
                "bot_runner_direct": bot_runner is not None,
                "runner_ref_exists": runner_ref is not None,
                "runner_ref_has_instance": (runner_ref.get('instance') is not None
                                           if runner_ref else False),
                "get_runner_result": runner is not None,
            }
            if not runner:
                return web.json_response({
                    "error": "Bot not initialized - runner is None",
                    "debug": debug_info
                }, status=500)
            if not runner.db:
                return web.json_response({
                    "error": "Bot has no database connection",
                    "debug": debug_info
                }, status=500)

            db = runner.db

            # Check which secrets are loaded (show key names only, not values!)
            secrets_status = {}
            for key in ['BINANCE_API_KEY', 'BINANCE_API_SECRET',
                        'ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET',
                        'POLYMARKET_API_KEY', 'KALSHI_API_KEY']:
                val = db.get_secret(key)
                secrets_status[key] = "✅ Set" if val else "❌ Missing"

            # Check CCXT clients - show all connected exchanges
            ccxt_status = "❌ Not initialized"
            ccxt_details = {}
            if runner.ccxt_clients:
                ccxt_status = f"✅ {len(runner.ccxt_clients)} exchanges"
                ccxt_details = {
                    "connected_exchanges": list(runner.ccxt_clients.keys()),
                    "exchange_details": {},
                }
                for ex_id, client in runner.ccxt_clients.items():
                    if client.exchange:
                        ex = client.exchange
                        ccxt_details["exchange_details"][ex_id] = {
                            "markets_loaded": len(ex.markets) if ex.markets else 0,
                            "has_futures": ex.has.get('fetchFundingRate', False),
                            "has_spot": ex.has.get('fetchTicker', False),
                        }

            # Check Alpaca client
            alpaca_status = "✅ Initialized" if runner.alpaca_client else "❌ Not initialized"

            # News source configuration
            news_config = {
                "finnhub_api_key": "✅ Set" if runner.finnhub_api_key else "❌ Missing",
                "twitter_bearer_token": "✅ Set" if runner.twitter_bearer_token else "❌ Missing",
                "news_api_key": "✅ Set" if runner.news_api_key else "❌ Missing",
                "news_engine_active": "✅ Active" if runner.news_engine else "❌ Disabled",
            }

            # Check strategy status
            strategies = {
                "funding_rate_arb": "✅ Active" if runner.funding_rate_arb else "❌ Disabled",
                "grid_trading": "✅ Active" if runner.grid_trading else "❌ Disabled",
                "pairs_trading": "✅ Active" if runner.pairs_trading else "❌ Disabled",
                "stock_mean_reversion": "✅ Active" if runner.stock_mean_reversion else "❌ Disabled",
                "stock_momentum": "✅ Active" if runner.stock_momentum else "❌ Disabled",
            }

            # Check config
            config_status = {
                "enable_binance": getattr(runner.config.trading, 'enable_binance', False),
                "enable_alpaca": getattr(runner.config.trading, 'enable_alpaca', False),
                "enable_funding_rate_arb": getattr(runner.config.trading, 'enable_funding_rate_arb', False),
                "enable_grid_trading": getattr(runner.config.trading, 'enable_grid_trading', False),
                "enable_pairs_trading": getattr(runner.config.trading, 'enable_pairs_trading', False),
            }

            # Check if using service_role key by decoding JWT payload
            key_type = "unknown"
            if db.key:
                try:
                    import base64
                    # JWT has 3 parts: header.payload.signature
                    payload = db.key.split('.')[1]
                    # Add padding if needed
                    payload += '=' * (4 - len(payload) % 4)
                    decoded = base64.b64decode(payload).decode('utf-8')
                    key_type = "service_role" if '"role":"service_role"' in decoded else "anon"
                except:
                    key_type = "parse_error"

            # Check exchange credentials loading
            exchange_creds_check = {}
            for ex in ['binance', 'coinbase']:
                creds = db.get_exchange_credentials(ex)
                has_key = bool(creds.get('api_key'))
                has_secret = bool(creds.get('api_secret'))
                exchange_creds_check[ex] = f"key={has_key},secret={has_secret}"

            return web.json_response({
                "secrets": secrets_status,
                "ccxt_client": ccxt_status,
                "ccxt_details": ccxt_details,
                "alpaca_client": alpaca_status,
                "strategies": strategies,
                "config": config_status,
                "db_key_type": key_type,
                "enabled_exchanges": [ex for ex in ['binance', 'coinbase'] if getattr(runner.config.trading, f'enable_{ex}', False)],
                "exchange_credentials": exchange_creds_check,
                "news_sources": news_config,
                "stock_config": {
                    "enable_stock_mean_reversion": getattr(runner.config.trading, 'enable_stock_mean_reversion', False),
                    "enable_stock_momentum": getattr(runner.config.trading, 'enable_stock_momentum', False),
                },
            })
        except Exception as e:
            import traceback
            return web.json_response({
                "error": f"Handler exception: {str(e)}",
                "type": type(e).__name__,
                "traceback": traceback.format_exc()[:500],
            }, status=500)

    app = web.Application()
    app.router.add_get('/health', health_handler)
    app.router.add_get('/status', status_handler)
    app.router.add_get('/debug/secrets', debug_secrets_handler)
    app.router.add_get('/', health_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    logger.info(f"Health server started on port {port} - v{version} (Build #{build})")

    # Keep running until cancelled
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
