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
from typing import Optional

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
)
from src.exchanges.ccxt_client import CCXTClient
from src.exchanges.alpaca_client import AlpacaClient
from src.notifications import Notifier, NotificationConfig
from src.logging_handler import setup_database_logging
from src.services.balance_aggregator import BalanceAggregator
from decimal import Decimal

logger = logging.getLogger(__name__)

# Set up database logging (writes to Supabase for admin UI)
db_log_handler = setup_database_logging()


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
    ):
        self.simulation_mode = simulation_mode
        
        # Feature flags
        self.enable_copy_trading = enable_copy_trading
        self.enable_arb_detection = enable_arb_detection
        self.enable_position_manager = enable_position_manager
        self.enable_news_sentiment = enable_news_sentiment
        
        # Initialize database FIRST (needed for secrets)
        self.db = Database()
        
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
        
        # CCXT client for crypto exchange access
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

    def is_market_blacklisted(self, market_id: str, title: str = "") -> bool:
        """Check if a market is blacklisted."""
        # Check by ID
        if market_id in self.blacklisted_markets:
            return True
        # Check if any blacklisted term appears in title
        title_lower = title.lower()
        for blacklisted in self.blacklisted_markets:
            if blacklisted.lower() in title_lower:
                return True
        return False

    async def initialize(self):
        """Initialize all enabled features."""
        logger.info("Initializing PolyBot features...")
        
        # Fetch initial balances
        logger.info("Fetching wallet balances...")
        await self.fetch_balances()
        
        # Fetch blacklisted markets
        await self.refresh_blacklist()
        
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
                min_liquidity=5000,
                min_deviation=3.0,
                check_interval=120,
            )
            logger.info("✓ Overlapping Arbitrage Detector initialized")
        
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
        )
        logger.info("✓ Single-Platform Scanner initialized (intra-market arb)")
        logger.info("  📝 Logging ALL market scans to polybot_market_scans")
        logger.info(
            f"  📊 Poly min: {self.config.trading.poly_single_min_profit_pct}% | "
            f"Kalshi min: {self.config.trading.kalshi_single_min_profit_pct}%"
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
            )
            logger.info("✓ News Arbitrage initialized (5-30% per event)")
            logger.info(f"  🔑 Keywords: {keywords_str[:50]}...")
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
                # Try each enabled exchange until one works
                # Some exchanges may be geoblocked (Binance/Bybit from AWS)
                logger.info(f"🔍 Checking credentials for exchanges: {enabled_exchanges}")
                
                # First pass: try exchanges with credentials
                for exchange in enabled_exchanges:
                    creds = self.db.get_exchange_credentials(exchange)
                    has_key = bool(creds.get('api_key'))
                    has_secret = bool(creds.get('api_secret'))
                    logger.info(f"  {exchange}: api_key={'✓' if has_key else '✗'}, api_secret={'✓' if has_secret else '✗'}")
                    
                    if has_key and has_secret:
                        # Try to initialize this exchange
                        logger.info(f"  Attempting to connect to {exchange}...")
                        self.ccxt_client = CCXTClient(
                            exchange_id=exchange,
                            api_key=creds.get('api_key'),
                            api_secret=creds.get('api_secret'),
                            password=creds.get('password'),
                            sandbox=False,  # Production API (testnets often geoblocked)
                        )
                        ccxt_initialized = await self.ccxt_client.initialize()
                        if ccxt_initialized:
                            logger.info(
                                f"✓ CCXT Client initialized with {exchange}"
                            )
                            break  # Success!
                        else:
                            logger.warning(f"  ⚠️ {exchange} failed to connect (may be geoblocked)")
                            self.ccxt_client = None
                
                # Second pass (simulation mode only): try without credentials for read-only data
                if not self.ccxt_client and self.simulation_mode:
                    logger.info("  Trying exchanges without credentials (simulation mode)...")
                    # Exchanges known to work without auth for public data
                    fallback_exchanges = ["okx", "kraken", "kucoin", "gate"]
                    for exchange in fallback_exchanges:
                        if exchange in enabled_exchanges or True:  # Try even if not enabled
                            logger.info(f"  Attempting {exchange} without credentials...")
                            self.ccxt_client = CCXTClient(
                                exchange_id=exchange,
                                api_key=None,
                                api_secret=None,
                                sandbox=False,
                            )
                            ccxt_initialized = await self.ccxt_client.initialize()
                            if ccxt_initialized:
                                logger.info(
                                    f"✓ CCXT Client initialized with {exchange} (read-only)"
                                )
                                logger.info(
                                    f"  ℹ️ Add {exchange.upper()} credentials in Admin → Secrets for live trading"
                                )
                                break
                            else:
                                self.ccxt_client = None
                
                if not self.ccxt_client:
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
        if self.config.trading.enable_funding_rate_arb and self.ccxt_client:
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
            self.pairs_trading = PairsTradingStrategy(
                ccxt_client=self.ccxt_client,
                db_client=self.db,
                entry_zscore=self.config.trading.pairs_entry_zscore,
                exit_zscore=self.config.trading.pairs_exit_zscore,
                position_size_usd=self.config.trading.pairs_position_size_usd,
                max_positions=self.config.trading.pairs_max_positions,
                max_hold_hours=self.config.trading.pairs_max_hold_hours,
                dry_run=self.simulation_mode,
            )
            logger.info("✓ Pairs Trading initialized (65% CONFIDENCE)")
            logger.info(
                f"  📈 Entry z: {self.config.trading.pairs_entry_zscore} | "
                f"Exit z: {self.config.trading.pairs_exit_zscore}"
            )
        elif self.config.trading.enable_pairs_trading:
            logger.info("⏸️ Pairs Trading DISABLED (no CCXT client)")
        else:
            logger.info("⏸️ Pairs Trading DISABLED")
        
        # =====================================================================
        # STOCK STRATEGIES (Alpaca)
        # Uses centralized secrets from Supabase polybot_secrets table
        # =====================================================================
        
        # Get Alpaca credentials from centralized secrets manager
        # Automatically picks paper vs live keys based on simulation_mode
        alpaca_creds = self.db.get_alpaca_credentials(is_paper=self.simulation_mode)
        alpaca_api_key = alpaca_creds.get('api_key')
        alpaca_api_secret = alpaca_creds.get('api_secret')
        
        if self.config.trading.enable_alpaca and alpaca_api_key and alpaca_api_secret:
            self.alpaca_client = AlpacaClient(
                api_key=alpaca_api_key,
                api_secret=alpaca_api_secret,
                paper=self.simulation_mode,
            )
            # CRITICAL: Must call async initialize() to verify credentials!
            alpaca_initialized = await self.alpaca_client.initialize()
            if alpaca_initialized:
                mode_str = 'PAPER' if self.simulation_mode else 'LIVE'
                logger.info(f"✓ Alpaca client initialized ({mode_str}) - keys from Supabase")
            else:
                logger.error(
                    f"❌ Alpaca client failed to initialize - "
                    f"stock strategies will not work"
                )
                self.alpaca_client = None
        
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
                min_momentum_score=70.0,  # Default, could be configurable
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
        
        # Initialize paper trader for simulation mode
        if self.simulation_mode:
            self.paper_trader = RealisticPaperTrader(
                db_client=self.db,
                starting_balance=Decimal("1000.00"),
            )
            logger.info("✓ Realistic Paper Trader initialized")
            logger.info("📊 Starting balance: $1,000.00")
            logger.info("📉 Slippage, partial fills, failures enabled")
        
        # Initialize balance aggregator for multi-platform balance tracking
        # Collects from: Polymarket, Kalshi, Crypto (CCXT), Stocks (Alpaca)
        self.balance_aggregator = BalanceAggregator(
            db_client=self.db,
            polymarket_client=self.polymarket_client,
            kalshi_client=self.kalshi_client,
            ccxt_clients={},  # TODO: Add CCXT clients when multiple exchanges
            alpaca_client=self.alpaca_client,
        )
        logger.info("✓ Balance Aggregator initialized (saves to DB)")
        
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
            # TODO: Execute actual trade
            pass
    
    async def on_arb_opportunity(self, opp: OverlapOpportunity):
        """Handle overlapping arbitrage opportunities."""
        logger.info(
            f"[ARB] {opp.relationship} opportunity: "
            f"{opp.deviation:.1f}% deviation, "
            f"${opp.profit_potential:.4f} potential profit"
        )
        
        # Log to database with proper schema fields
        try:
            self.db.log_opportunity({
                "id": f"overlap_{opp.market_a.condition_id[:10]}_{opp.detected_at.timestamp():.0f}",
                "buy_platform": "polymarket",
                "sell_platform": "polymarket",
                "buy_market_id": opp.market_a.condition_id,
                "sell_market_id": opp.market_b.condition_id,
                "buy_market_name": opp.market_a.question[:200],
                "sell_market_name": opp.market_b.question[:200],
                "buy_price": 0.0,  # Overlapping arb doesn't have direct prices
                "sell_price": 0.0,
                "profit_percent": float(opp.profit_potential * 100),
                "confidence": float(opp.confidence),
                "strategy": f"overlapping_arb_{opp.relationship}",
                "detected_at": opp.detected_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging arb opportunity: {e}")
        
        # Check if market is blacklisted
        market_a_id = opp.market_a.condition_id or "unknown"
        market_b_id = opp.market_b.condition_id or "unknown"
        if self.is_market_blacklisted(market_a_id, opp.market_a.question):
            logger.info(f"⛔ Skipping blacklisted market: {opp.market_a.question[:50]}...")
            return
        if self.is_market_blacklisted(market_b_id, opp.market_b.question):
            logger.info(f"⛔ Skipping blacklisted market: {opp.market_b.question[:50]}...")
            return
        
        # Paper trade if in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                await self.paper_trader.simulate_opportunity(
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
                )
            except Exception as e:
                logger.error(f"Error paper trading arb: {e}")
    
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
        
        # Log to database
        try:
            self.db.log_opportunity({
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
                "confidence": opp.confidence,
                "strategy": opp.strategy,
                "detected_at": opp.detected_at.isoformat(),
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
                if trade and trade.outcome.value in ("won", "lost"):
                    is_win = trade.outcome.value == "won"
                    self.analytics.record_trade(
                        ArbitrageType.CROSS_PLATFORM,
                        is_win=is_win,
                        gross_pnl=trade.gross_profit_usd,
                        fees=trade.total_fees_usd,
                    )
                elif trade and trade.outcome.value == "failed_execution":
                    self.analytics.record_failed_execution(ArbitrageType.CROSS_PLATFORM)
            except Exception as e:
                logger.error(f"Error paper trading cross-platform arb: {e}")
    
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
        
        # Log to database
        try:
            self.db.log_opportunity({
                "id": f"single_{opp.platform}_{opp.market_id[:20]}_{opp.detected_at.timestamp():.0f}",
                "buy_platform": opp.platform,
                "sell_platform": opp.platform,
                "buy_market_id": opp.market_id,
                "sell_market_id": f"{opp.market_id}_resolution",
                "buy_market_name": opp.market_title[:200],
                "sell_market_name": f"Resolution: {opp.market_title[:100]}",
                "buy_price": float(opp.total_price),
                "sell_price": 1.0,  # Guaranteed $1 payout
                "profit_percent": float(opp.profit_pct),
                "strategy": f"single_platform_{opp.platform}",
                "detected_at": opp.detected_at.isoformat(),
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
                if trade and trade.outcome.value in ("won", "lost"):
                    is_win = trade.outcome.value == "won"
                    self.analytics.record_trade(
                        arb_type,
                        is_win=is_win,
                        gross_pnl=trade.gross_profit_usd,
                        fees=trade.total_fees_usd,
                    )
                elif trade and trade.outcome.value == "failed_execution":
                    self.analytics.record_failed_execution(arb_type)
            except Exception as e:
                logger.error(f"Error paper trading single-platform: {e}")
    
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
    
    async def on_portfolio_update(self, summary: PortfolioSummary):
        """Handle portfolio updates."""
        logger.info(
            f"[PORTFOLIO] {summary.open_positions} open, "
            f"{summary.resolved_unclaimed} unclaimed, "
            f"PnL: ${summary.total_unrealized_pnl + summary.total_realized_pnl:.2f}, "
            f"Win rate: {summary.win_rate:.1f}%"
        )
    
    async def on_news_alert(self, alert: MarketAlert):
        """Handle news/sentiment alerts."""
        logger.info(
            f"[NEWS] {alert.alert_type}: {alert.news_item.title[:60]}... "
            f"-> {alert.suggested_action.upper()} confidence: {alert.confidence:.0%}"
        )
        
        # Log to database with proper schema fields
        try:
            source_name = alert.news_item.source.value if hasattr(alert.news_item.source, 'value') else str(alert.news_item.source)
            self.db.log_opportunity({
                "id": f"news_{alert.market_condition_id[:15]}_{alert.created_at.timestamp():.0f}",
                "buy_platform": "polymarket",  # News alerts are for Polymarket
                "sell_platform": "polymarket",
                "buy_market_id": alert.market_condition_id,
                "sell_market_id": alert.market_condition_id,
                "buy_market_name": alert.news_item.title[:200],
                "sell_market_name": alert.market_question[:200],
                "buy_price": 0.0,  # News alerts don't have direct prices
                "sell_price": 0.0,
                "profit_percent": 0.0,
                "confidence": float(alert.confidence),
                "strategy": f"news_sentiment_{source_name}",
                "detected_at": alert.created_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging news alert: {e}")
    
    async def run_copy_trading(self):
        """Run copy trading engine."""
        if self.copy_trading:
            await self.copy_trading.run(callback=self.on_copy_signal)
    
    async def run_arb_detection(self):
        """Run arbitrage detection."""
        if self.arb_detector:
            await self.arb_detector.run(callback=self.on_arb_opportunity)
    
    async def run_cross_platform_scanner(self):
        """Run cross-platform arbitrage scanner (Polymarket↔Kalshi)."""
        # Use self.config (loaded from Supabase)
        if not self.config.trading.enable_cross_platform_arb:
            logger.info("⏸️ Cross-platform arbitrage DISABLED")
            return
            
        if self.cross_platform_scanner:
            logger.info("▶️ Starting Cross-Platform Scanner...")
            await self.cross_platform_scanner.run(
                callback=self.on_cross_platform_opportunity
            )
    
    async def run_single_platform_scanner(self):
        """Run single-platform arbitrage scanner (intra-market)."""
        # Use self.config (loaded from Supabase)
        enable_poly = self.config.trading.enable_polymarket_single_arb
        enable_kalshi = self.config.trading.enable_kalshi_single_arb
        
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
        await self.initialize()
        
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
        logger.info(f"  - Polymarket Single-Platform: {'ON' if ps else 'OFF'}")
        logger.info(f"  - Kalshi Single-Platform: {'ON' if ks else 'OFF'}")
        logger.info(f"  - Cross-Platform (Poly↔Kalshi): {'ON' if cp else 'OFF'}")
        logger.info(f"  - Market Making (10-20% APR): {'ON' if mm else 'OFF'}")
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
        
        if self.enable_arb_detection and self.arb_detector:
            tasks.append(asyncio.create_task(self.run_arb_detection()))
        
        # Run cross-platform scanner if enabled
        if cp and self.cross_platform_scanner:
            tasks.append(
                asyncio.create_task(self.run_cross_platform_scanner())
            )
        
        # Run single-platform scanner if either platform enabled
        if (ps or ks) and self.single_platform_scanner:
            tasks.append(
                asyncio.create_task(self.run_single_platform_scanner())
            )
        
        # Run Market Making strategy (HIGH confidence - 10-20% APR)
        if mm and self.market_maker:
            tasks.append(asyncio.create_task(self.run_market_maker()))
        
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
        
        if self.enable_position_manager and self.position_manager:
            tasks.append(asyncio.create_task(self.run_position_manager()))
        
        if self.enable_news_sentiment and self.news_engine:
            tasks.append(asyncio.create_task(self.run_news_sentiment()))
        
        # Always run balance tracker
        tasks.append(asyncio.create_task(self.run_balance_tracker()))
        
        # Run paper trading stats saver if in simulation mode
        if self.simulation_mode and self.paper_trader:
            tasks.append(asyncio.create_task(self.run_paper_trading_stats()))
        
        self._tasks = tasks
        
        if not tasks:
            logger.warning("No features enabled! Exiting.")
            return
        
        try:
            # Run all tasks concurrently
            await asyncio.gather(*tasks)
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
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # Load simulation mode from database (Admin UI setting)
    # This allows toggling simulation/live from the UI without code changes
    db = Database()
    simulation_mode = True  # Safe default
    try:
        if db._client:
            # Read from polybot_status table (same table Admin UI writes to)
            result = db._client.table('polybot_status').select(
                'dry_run_mode'
            ).limit(1).execute()
            if result.data and len(result.data) > 0:
                # dry_run_mode=True means simulation, False means LIVE
                simulation_mode = result.data[0].get('dry_run_mode', True)
                mode_str = 'SIMULATION' if simulation_mode else 'LIVE'
                logger.info(f"📊 Loaded mode from database: {mode_str}")
            else:
                logger.warning(
                    "No status row in polybot_status, defaulting to SIMULATION"
                )
    except Exception as e:
        logger.warning(f"Could not load dry_run_mode: {e}")
        simulation_mode = True
    
    # Example tracked traders (these are whale addresses on Polymarket)
    tracked_traders = [
        # Add trader addresses to copy here
    ]
    
    runner = PolybotRunner(
        tracked_traders=tracked_traders,
        enable_copy_trading=True,
        enable_arb_detection=True,
        enable_position_manager=True,
        enable_news_sentiment=True,
        simulation_mode=simulation_mode,  # Now read from database!
    )
    
    # Start health server for Lightsail health checks (pass runner for debug)
    health_task = asyncio.create_task(start_health_server(bot_runner=runner))
    
    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    setup_signal_handlers(runner, loop)
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        health_task.cancel()
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


async def start_health_server(port: int = 8080, bot_runner=None):
    """Start a simple HTTP health check server for Lightsail."""
    from aiohttp import web
    import os
    
    version = get_version()
    build = get_build_number()
    
    async def health_handler(request):
        return web.Response(text="OK", status=200)
    
    async def status_handler(request):
        return web.json_response({
            "status": "running",
            "service": "polybot",
            "version": version,
            "build": build,
            "fullVersion": f"v{version} (Build #{build})",
        })
    
    async def debug_secrets_handler(request):
        """Debug endpoint to check if secrets are being loaded."""
        if not bot_runner or not bot_runner.db:
            return web.json_response({"error": "Bot not initialized"}, status=500)
        
        db = bot_runner.db
        
        # Check which secrets are loaded (show key names only, not values!)
        secrets_status = {}
        for key in ['BINANCE_API_KEY', 'BINANCE_API_SECRET', 'ALPACA_PAPER_API_KEY', 
                    'ALPACA_PAPER_API_SECRET', 'POLYMARKET_API_KEY', 'KALSHI_API_KEY']:
            val = db.get_secret(key)
            secrets_status[key] = "✅ Set" if val else "❌ Missing"
        
        # Check CCXT client
        ccxt_status = "✅ Initialized" if bot_runner.ccxt_client else "❌ Not initialized"
        
        # Check Alpaca client  
        alpaca_status = "✅ Initialized" if bot_runner.alpaca_client else "❌ Not initialized"
        
        # Check strategy status
        strategies = {
            "funding_rate_arb": "✅ Active" if bot_runner.funding_rate_arb else "❌ Disabled",
            "grid_trading": "✅ Active" if bot_runner.grid_trading else "❌ Disabled",
            "pairs_trading": "✅ Active" if bot_runner.pairs_trading else "❌ Disabled",
            "stock_mean_reversion": "✅ Active" if bot_runner.stock_mean_reversion else "❌ Disabled",
            "stock_momentum": "✅ Active" if bot_runner.stock_momentum else "❌ Disabled",
        }
        
        # Check config
        config_status = {
            "enable_binance": getattr(bot_runner.config.trading, 'enable_binance', False),
            "enable_alpaca": getattr(bot_runner.config.trading, 'enable_alpaca', False),
            "enable_funding_rate_arb": getattr(bot_runner.config.trading, 'enable_funding_rate_arb', False),
            "enable_grid_trading": getattr(bot_runner.config.trading, 'enable_grid_trading', False),
            "enable_pairs_trading": getattr(bot_runner.config.trading, 'enable_pairs_trading', False),
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
            "alpaca_client": alpaca_status,
            "strategies": strategies,
            "config": config_status,
            "db_key_type": key_type,
            "enabled_exchanges": [ex for ex in ['binance', 'coinbase'] if getattr(bot_runner.config.trading, f'enable_{ex}', False)],
            "exchange_credentials": exchange_creds_check,
            "stock_config": {
                "enable_stock_mean_reversion": getattr(bot_runner.config.trading, 'enable_stock_mean_reversion', False),
                "enable_stock_momentum": getattr(bot_runner.config.trading, 'enable_stock_momentum', False),
            },
        })
    
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
