"""
Configuration management for PolyBot.
All settings loaded from environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


@dataclass
class TradingConfig:
    """Trading parameters and risk limits."""
    
    # Dry run mode - no real trades executed
    dry_run: bool = True
    
    # Simulation starting balance for paper trading (USD)
    simulation_starting_balance: float = 10000.0
    
    # Minimum profit threshold (percentage) to execute a trade
    min_profit_percent: float = 1.0
    
    # Maximum trade size in USD
    max_trade_size: float = 100.0
    
    # Maximum daily loss before circuit breaker triggers (USD)
    max_daily_loss: float = 50.0
    
    # Maximum number of consecutive failed trades before pause
    max_consecutive_failures: int = 3
    
    # Slippage tolerance - reject if price moved more than this (percentage)
    slippage_tolerance: float = 0.5
    
    # Time to wait between opportunity checks (seconds)
    scan_interval: float = 2.0
    
    # Require manual approval for first N trades (0 = fully autonomous)
    manual_approval_trades: int = 10
    
    # =========================================================================
    # ARBITRAGE STRATEGY TOGGLES
    # Enable/disable each of the 3 arbitrage types independently
    # =========================================================================
    
    # Single-platform arbitrage on Polymarket (intra-market price imbalances)
    # This is where the REAL money is - $40M extracted in 1 year!
    enable_polymarket_single_arb: bool = True
    
    # Single-platform arbitrage on Kalshi (intra-market price imbalances)
    enable_kalshi_single_arb: bool = True
    
    # Cross-platform arbitrage (Polymarket ↔ Kalshi same-market price differences)
    # Rare but real - ~$95K in opportunities found historically
    enable_cross_platform_arb: bool = True
    
    # =========================================================================
    # PER-STRATEGY SETTINGS (Independent thresholds!)
    # Each strategy type can have its own profit thresholds and position sizes
    # =========================================================================
    
    # =========================================================================
    # POLYMARKET SINGLE - PhD Research Optimized (Saguillo et al., 2025)
    # Academic data: $40M extracted at 0.3-2% margins, 0% trading fees
    # =========================================================================
    poly_single_min_profit_pct: float = 0.3    # Aggressive: 0% fees = micro-arb works
    poly_single_max_spread_pct: float = 30.0   # RAISED from 12% - big spreads are real!
    poly_single_max_position_usd: float = 100.0 # Single-plat is safest
    poly_single_scan_interval_sec: int = 5     # Every 5 seconds - catch all edges
    poly_single_min_conditions: int = 2        # Prioritize 3+ condition markets
    
    # =========================================================================
    # KALSHI SINGLE - Fee-Adjusted (7% on profits = need 8%+ gross)
    # Only profitable if spread exceeds fee drag significantly
    # =========================================================================
    kalshi_single_min_profit_pct: float = 8.0  # RAISED: 7% fees + 1% net = 8% minimum
    kalshi_single_max_spread_pct: float = 30.0 # RAISED from 15% - big spreads are real!
    kalshi_single_max_position_usd: float = 50.0  # Increased from 30 - scale wins
    kalshi_single_scan_interval_sec: int = 5   # FASTEST: every 5 seconds
    
    # =========================================================================
    # CROSS-PLATFORM - Asymmetric by buy platform (fee optimization)
    # Buy Poly = 0% fee, Buy Kalshi = 7% fee → different thresholds
    # =========================================================================
    # Cross-Platform (asymmetric based on buy platform)
    cross_plat_min_profit_buy_poly_pct: float = 2.5   # Lower (Poly has 0% fees)
    cross_plat_min_profit_buy_kalshi_pct: float = 9.0 # RAISED: must cover 7% Kalshi fee
    cross_plat_max_position_usd: float = 75.0   # Reduced from 100 - execution risk
    cross_plat_scan_interval_sec: int = 10      # FAST: every 10 seconds (cross-platform matching)
    cross_plat_min_similarity: float = 0.35     # Stricter matching (fewer false positives)
    
    # =========================================================================
    # MARKET MAKING STRATEGY (HIGH CONFIDENCE - 10-20% APR)
    # Post liquidity, earn bid-ask spread + Polymarket rewards
    # Academic evidence: This is how the $40M was ACTUALLY made
    # =========================================================================
    enable_market_making: bool = False          # OFF by default (requires capital)
    mm_target_spread_bps: int = 200             # 2% spread (200 basis points)
    mm_min_spread_bps: int = 50                 # 0.5% minimum spread
    mm_max_spread_bps: int = 500                # 5% maximum spread
    mm_order_size_usd: float = 50.0             # Default order size
    mm_max_inventory_usd: float = 500.0         # Max position per market
    mm_inventory_skew_factor: float = 0.1       # Skew quotes when inventory builds
    mm_quote_refresh_sec: int = 5               # How often to update quotes
    mm_min_volume_24h: float = 10000.0          # Only make markets with volume
    mm_max_markets: int = 5                     # Concurrent markets to quote
    
    # =========================================================================
    # NEWS ARBITRAGE STRATEGY (MEDIUM CONFIDENCE - Event-driven)
    # Exploit Polymarket→Kalshi price lag during news events
    # =========================================================================
    enable_news_arbitrage: bool = False         # OFF by default (risky timing)
    news_min_spread_pct: float = 3.0            # Min spread to trigger
    news_max_lag_minutes: int = 30              # Max time since news break
    news_position_size_usd: float = 50.0        # Position size per event
    news_scan_interval_sec: int = 30            # How often to check for events
    news_keywords: str = "election,fed,trump,bitcoin,crypto,verdict"  # Keywords
    
    # =========================================================================
    # FUNDING RATE ARBITRAGE (85% CONFIDENCE - HIGHEST PRIORITY)
    # Delta-neutral funding collection on crypto perpetuals
    # Academic basis: Retail long bias creates persistent positive funding
    # Expected returns: 15-50% APY
    # =========================================================================
    enable_funding_rate_arb: bool = False       # OFF by default
    funding_min_rate_pct: float = 0.03          # 0.03% per 8h = ~33% APY
    funding_min_apy: float = 30.0               # Minimum APY to enter
    funding_exit_threshold: float = 0.01        # Exit if funding drops below
    funding_max_position_usd: float = 1000.0    # Max position per symbol
    funding_min_position_usd: float = 100.0     # Min position worth trading
    funding_max_positions: int = 3              # Max concurrent positions
    funding_max_basis_pct: float = 1.0          # Max basis (futures premium)
    funding_max_leverage: int = 3               # Max leverage on futures leg
    funding_scan_interval_sec: int = 300        # 5 minute scans
    
    # =========================================================================
    # GRID TRADING STRATEGY (75% CONFIDENCE)
    # Profit from sideways price oscillation
    # Expected returns: 20-60% APY in ranging markets
    # =========================================================================
    enable_grid_trading: bool = False           # OFF by default
    grid_default_range_pct: float = 10.0        # ±10% from current price
    grid_default_levels: int = 20               # Number of grid levels
    grid_default_investment_usd: float = 500.0  # Default investment per grid
    grid_max_grids: int = 3                     # Max concurrent grids
    grid_max_investment_usd: float = 1000.0     # Max per grid
    grid_stop_loss_pct: float = 15.0            # Close if price breaks out
    grid_take_profit_pct: float = 50.0          # Close if profit target hit
    grid_check_interval_sec: int = 30           # Order check interval
    
    # =========================================================================
    # PAIRS TRADING / STATISTICAL ARBITRAGE (65% CONFIDENCE)
    # Mean reversion on correlated asset pairs
    # Expected returns: 10-25% APY
    # =========================================================================
    enable_pairs_trading: bool = False          # OFF by default
    pairs_entry_zscore: float = 2.0             # Enter when |z| > 2
    pairs_exit_zscore: float = 0.5              # Exit when |z| < 0.5
    pairs_stop_loss_zscore: float = 4.0         # Stop if |z| > 4
    pairs_position_size_usd: float = 500.0      # Position size per trade
    pairs_max_positions: int = 2                # Max concurrent positions
    pairs_max_hold_hours: float = 72.0          # Max 3 days
    pairs_max_loss_pct: float = 5.0             # Max loss per trade
    pairs_scan_interval_sec: int = 60           # Scan interval
    
    # =========================================================================
    # STOCK MEAN REVERSION STRATEGY (70% CONFIDENCE)
    # Buy stocks that deviate significantly from moving average
    # Expected returns: 15-30% APY
    # Requires Alpaca account
    # =========================================================================
    enable_stock_mean_reversion: bool = False   # OFF by default
    stock_mr_lookback_period: int = 20          # SMA period (days)
    stock_mr_entry_zscore: float = 2.0          # Buy when z-score < -2
    stock_mr_exit_zscore: float = 0.5           # Sell when z-score > -0.5
    stock_mr_stop_loss_pct: float = 5.0         # Max loss per trade
    stock_mr_position_size_usd: float = 500.0   # Position size per trade
    stock_mr_max_positions: int = 5             # Max concurrent positions
    stock_mr_max_hold_days: int = 3             # Max hold time
    stock_mr_scan_interval_sec: int = 300       # 5 minute scans
    stock_mr_watchlist: str = "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,V,MA"  # Default stocks
    
    # =========================================================================
    # STOCK MOMENTUM STRATEGY (70% CONFIDENCE)
    # Ride trends in high-momentum stocks
    # Expected returns: 20-40% APY
    # Requires Alpaca account
    # =========================================================================
    enable_stock_momentum: bool = False         # OFF by default
    momentum_min_score: float = 60.0            # Min momentum score (0-100) to enter
    stock_mom_roc_period: int = 10              # Rate of change period
    stock_mom_entry_threshold: float = 3.0      # Min ROC % to enter
    stock_mom_exit_threshold: float = -1.0      # Exit when ROC drops below
    stock_mom_rsi_overbought: float = 75.0      # Avoid overbought (RSI > 75)
    stock_mom_rsi_oversold: float = 40.0        # Don't buy oversold in uptrend
    stock_mom_position_size_usd: float = 500.0  # Position size per trade
    stock_mom_max_positions: int = 5            # Max concurrent positions
    stock_mom_max_hold_days: int = 5            # Max hold time
    stock_mom_stop_loss_pct: float = 7.0        # Wider stop for momentum
    stock_mom_scan_interval_sec: int = 300      # 5 minute scans
    stock_mom_watchlist: str = "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,AMD,CRM,NFLX"  # Momentum stocks
    
    # =========================================================================
    # EXCHANGE ENABLEMENT (which platforms to trade on)
    # =========================================================================
    # Prediction Markets
    enable_polymarket: bool = True              # Polymarket (0% fees)
    enable_kalshi: bool = True                  # Kalshi (7% fees on profit)
    
    # Crypto Exchanges (via CCXT)
    enable_binance: bool = False                # Binance Spot & Futures
    enable_bybit: bool = False                  # Bybit Unified
    enable_okx: bool = False                    # OKX
    enable_kraken: bool = False                 # Kraken
    enable_coinbase: bool = False               # Coinbase Pro
    enable_kucoin: bool = False                 # KuCoin
    
    # Stock Brokers
    enable_alpaca: bool = False                 # Alpaca (commission-free)
    enable_ibkr: bool = False                   # Interactive Brokers
    
    # =========================================================================
    # ADVANCED FRAMEWORK - PHASE 1 (Risk Management)
    # These enhance ALL strategies with better position sizing & risk control
    # =========================================================================
    
    # Kelly Criterion Position Sizing
    # Academic basis: Kelly (1956) - optimal bet sizing for max geometric growth
    kelly_sizing_enabled: bool = False          # OFF by default (advanced)
    kelly_fraction_cap: float = 0.25            # Half-Kelly (safer than full)
    kelly_min_confidence: float = 0.60          # Min confidence to size with Kelly
    kelly_max_position_pct: float = 10.0        # Max position % of portfolio
    
    # Market Regime Detection
    # Academic basis: Hamilton (1989) - regime-switching models
    regime_detection_enabled: bool = True       # ON by default
    regime_vix_low_threshold: float = 15.0      # VIX < 15 = LOW_VOLATILITY
    regime_vix_high_threshold: float = 25.0     # VIX > 25 = HIGH_VOLATILITY
    regime_vix_crisis_threshold: float = 35.0   # VIX > 35 = CRISIS
    regime_auto_adjust: bool = True             # Auto-adjust strategy params
    
    # Circuit Breaker System
    # Automatic trading halts on excessive drawdown
    circuit_breaker_enabled: bool = True        # ON by default (safety)
    circuit_breaker_level1_pct: float = 3.0     # Level 1: 3% drawdown → 50% size
    circuit_breaker_level2_pct: float = 5.0     # Level 2: 5% drawdown → 25% size
    circuit_breaker_level3_pct: float = 10.0    # Level 3: 10% drawdown → HALT
    circuit_breaker_reset_hours: int = 24       # Auto-reset after 24 hours
    
    # =========================================================================
    # STRATEGY ENHANCEMENTS - PHASE 2
    # =========================================================================
    
    # Time Decay Analysis (Prediction Markets)
    # Theta-style decay as markets approach resolution
    time_decay_enabled: bool = True             # ON by default
    time_decay_critical_days: int = 7           # Critical zone = 7 days
    time_decay_avoid_entry_hours: int = 48      # Don't enter < 48h to resolution
    time_decay_mid_prob_low: float = 0.35       # Mid-prob range start
    time_decay_mid_prob_high: float = 0.65      # Mid-prob range end
    
    # Order Flow Analysis
    # Real-time order book imbalance signals
    order_flow_enabled: bool = False            # OFF by default (requires data)
    order_flow_signal_threshold: float = 0.30   # OFI level for weak signal
    order_flow_strong_threshold: float = 0.60   # OFI level for strong signal
    order_flow_lookback_seconds: int = 300      # 5 minute lookback
    
    # Stablecoin Depeg Detection
    # Alert and arbitrage on stablecoin deviations
    depeg_detection_enabled: bool = True        # ON by default
    depeg_alert_threshold_pct: float = 0.30     # Alert at 0.3% deviation
    depeg_arbitrage_threshold_pct: float = 0.50 # Arb opportunity at 0.5%
    depeg_critical_threshold_pct: float = 5.0   # Critical at 5% (exit all)
    
    # Correlation Position Limits
    # Prevent over-concentration in correlated assets
    correlation_limits_enabled: bool = True     # ON by default
    correlation_max_cluster_pct: float = 30.0   # Max 30% in one cluster
    correlation_max_correlated_pct: float = 50.0  # Max 50% in correlated assets
    correlation_high_threshold: float = 0.70    # Correlation > 0.7 = "high"
    
    # =========================================================================
    # TWITTER-DERIVED STRATEGIES (2024)
    # High-conviction strategies from analyzing top traders on X/Twitter
    # =========================================================================
    
    # BTC Bracket Arbitrage (85% CONFIDENCE - $20K-200K/month potential)
    # Buy YES + NO when combined < $1.00 for guaranteed profit
    enable_btc_bracket_arb: bool = False        # OFF by default
    btc_bracket_min_discount_pct: float = 0.5   # Min combined discount (0.5%)
    btc_bracket_max_position_usd: float = 50.0  # Max position per bracket
    btc_bracket_scan_interval_sec: int = 15     # Scan every 15 seconds
    
    # Bracket Compression (70% CONFIDENCE - 15-30% APY)
    # Mean reversion on stretched bracket prices
    enable_bracket_compression: bool = False    # OFF by default
    bracket_max_imbalance_threshold: float = 0.30  # Max imbalance to trade
    bracket_take_profit_pct: float = 3.0        # Take profit at 3%
    bracket_stop_loss_pct: float = 10.0         # Stop loss at 10%
    bracket_max_position_usd: float = 100.0     # Max position size
    
    # Kalshi Mention Market Sniping (80% CONFIDENCE - $120+/event)
    # Fast execution on resolved mention markets
    enable_kalshi_mention_snipe: bool = False   # OFF by default
    kalshi_snipe_min_profit_cents: int = 2      # Min profit (2¢)
    kalshi_snipe_max_position_usd: float = 100.0  # Max position
    kalshi_snipe_max_latency_ms: int = 1000     # Max acceptable latency
    
    # Whale Copy Trading (75% CONFIDENCE - 25-50% APY)
    # Track and copy high win-rate wallets
    enable_whale_copy_trading: bool = False     # OFF by default
    whale_copy_min_win_rate: int = 80           # Min wallet win rate (%)
    whale_copy_delay_seconds: int = 30          # Delay before copying
    whale_copy_max_size_usd: float = 50.0       # Max copy size
    whale_copy_max_concurrent: int = 5          # Max concurrent copies
    
    # Macro Board Strategy (65% CONFIDENCE - $62K/month potential)
    # Heavy weighted exposure to macro events
    enable_macro_board: bool = False            # OFF by default
    macro_max_exposure_usd: float = 5000.0      # Max total exposure
    macro_min_conviction_score: int = 70        # Min conviction (0-100)
    macro_rebalance_interval_hours: int = 24    # Rebalance every 24h
    
    # Fear Premium Contrarian (70% CONFIDENCE - 25-60% APY)
    # Trade against extreme sentiment - 91.4% win rate approach
    enable_fear_premium_contrarian: bool = False  # OFF by default
    fear_extreme_low_threshold: float = 0.15    # YES < 15% = extreme fear
    fear_extreme_high_threshold: float = 0.85   # YES > 85% = extreme greed
    fear_min_premium_pct: int = 10              # Min fear premium (%)
    fear_max_position_usd: float = 200.0        # Max position size

    # Congressional Tracker (75% CONFIDENCE - 15-40% APY)
    # Copy Congress member stock trades (scaled to your bankroll)
    enable_congressional_tracker: bool = False  # OFF by default
    congress_tracked_politicians: str = ""      # Comma-separated names
    congress_chamber_filter: str = "both"       # house, senate, both
    congress_copy_scale_pct: float = 10.0       # % of bankroll to copy
    congress_min_trade_amount_usd: float = 100.0  # Min trade to copy
    congress_max_position_usd: float = 500.0    # Max position size
    congress_copy_delay_hours: int = 24         # Delay after disclosure
    congress_data_source: str = "house_watcher"  # Data source

    # Political Event Strategy (80% CONFIDENCE - 30-60% APY)
    # Trade high-conviction political events (elections, legislation, etc.)
    enable_political_event_strategy: bool = False  # OFF by default
    political_min_conviction_score: float = 0.75   # Min conviction (0-1)
    political_max_position_usd: float = 500.0      # Max position per event
    political_max_concurrent_events: int = 5       # Max simultaneous events
    political_event_categories: str = "election,legislation,hearing"  # CSV
    political_lead_time_hours: int = 48            # Min hours before event
    political_exit_buffer_hours: int = 2           # Exit before event ends

    # High Conviction Strategy (85% CONFIDENCE - 40-80% APY)
    # Focus on fewer, higher-confidence trades with multi-signal confirmation
    enable_high_conviction_strategy: bool = False  # OFF by default
    high_conviction_min_score: float = 0.75        # Min conviction (0-1)
    high_conviction_max_positions: int = 3         # Max concurrent positions
    high_conviction_min_signals: int = 3           # Min confirming signals
    high_conviction_position_pct: float = 15.0     # % of bankroll per trade
    high_conviction_use_kelly: bool = True         # Use Kelly criterion sizing
    high_conviction_kelly_fraction: float = 0.25   # Fractional Kelly (25%)

    # Selective Whale Copy Strategy (80% CONFIDENCE - 35-65% APY)
    # Performance-based whale selection (only copy winning whales)
    enable_selective_whale_copy: bool = False      # OFF by default
    selective_whale_min_win_rate: float = 0.65     # Min 65% win rate
    selective_whale_min_roi: float = 0.20          # Min 20% ROI
    selective_whale_min_trades: int = 10           # Min trades for stats
    selective_whale_max_tracked: int = 10          # Max whales to track
    selective_whale_auto_select: bool = True       # Auto-select top whales
    selective_whale_copy_scale_pct: float = 5.0    # % of whale position
    selective_whale_max_position_usd: float = 200.0  # Max position size


@dataclass
class PolymarketConfig:
    """Polymarket API configuration."""
    
    # WebSocket URL for order book updates
    ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    
    # REST API base URL
    api_url: str = "https://clob.polymarket.com"
    
    # Gamma API for market discovery
    gamma_url: str = "https://gamma-api.polymarket.com"
    
    # Chain ID (Polygon mainnet)
    chain_id: int = 137
    
    # API credentials for CLOB API
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    
    # Optional: Private key for on-chain signing (wallet trades)
    private_key: Optional[str] = None
    
    def __post_init__(self):
        self.api_key = os.getenv("POLYMARKET_API_KEY")
        self.api_secret = os.getenv("POLYMARKET_SECRET")
        self.private_key = os.getenv("POLYMARKET_PRIVATE_KEY")


@dataclass  
class KalshiConfig:
    """Kalshi API configuration."""
    
    # WebSocket URL for order book updates
    ws_url: str = "wss://api.elections.kalshi.com/trade-api/ws/v2"
    
    # REST API base URL
    api_url: str = "https://api.elections.kalshi.com/trade-api/v2"
    
    # API Key ID (loaded from env)
    api_key: Optional[str] = None
    
    # Path to private key file or the key content itself
    private_key: Optional[str] = None
    
    def __post_init__(self):
        self.api_key = os.getenv("KALSHI_API_KEY")
        # Try direct key first, then file path
        self.private_key = os.getenv("KALSHI_PRIVATE_KEY")
        if not self.private_key:
            key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH")
            if key_path and os.path.exists(key_path):
                with open(key_path, "r") as f:
                    self.private_key = f.read()


@dataclass
class DatabaseConfig:
    """
    Supabase configuration.
    
    IMPORTANT: Only uses SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_KEY/anon key)
    to ensure full database access with RLS bypass.
    """
    
    url: Optional[str] = None
    key: Optional[str] = None
    
    def __post_init__(self):
        # Get Supabase credentials from environment
        # ONLY use SERVICE_ROLE_KEY - anon key causes permission issues
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.key)


@dataclass
class NotificationsConfig:
    """Discord/Telegram notification configuration."""
    
    discord_webhook: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    
    def __post_init__(self):
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK")
        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")


class Config:
    """
    Main configuration container.
    
    Configuration Priority:
    1. Supabase polybot_config table (for autonomous cloud operation)
    2. Environment variables (fallback for local dev)
    3. Hardcoded defaults
    
    This ensures the bot can run autonomously on AWS Lightsail without
    depending on local .env files.
    """
    
    _supabase_config: Optional[dict] = None
    
    def __init__(self, db_client=None):
        """
        Initialize config.
        
        Args:
            db_client: Optional Database client to load config from Supabase
        """
        # Try to load from Supabase first
        self._supabase_config = None
        if db_client:
            self._supabase_config = db_client.get_trading_config()
            if self._supabase_config:
                import logging
                logging.getLogger(__name__).info(
                    "✅ Loaded config from Supabase (autonomous mode)"
                )
        
        # Build trading config from Supabase or env vars
        self.trading = TradingConfig(
            dry_run=self._get_bool("dry_run", "DRY_RUN", True),
            min_profit_percent=self._get_float(
                "min_profit_percent", "MIN_PROFIT_PERCENT", 1.0
            ),
            max_trade_size=self._get_float(
                "max_trade_size", "MAX_TRADE_SIZE", 100.0
            ),
            max_daily_loss=self._get_float(
                "max_daily_loss", "MAX_DAILY_LOSS", 50.0
            ),
            max_consecutive_failures=self._get_int(
                "max_consecutive_failures", "MAX_CONSECUTIVE_FAILURES", 3
            ),
            slippage_tolerance=self._get_float(
                "slippage_tolerance", "SLIPPAGE_TOLERANCE", 0.5
            ),
            scan_interval=self._get_float(
                "scan_interval", "SCAN_INTERVAL", 2.0
            ),
            manual_approval_trades=self._get_int(
                "manual_approval_trades", "MANUAL_APPROVAL_TRADES", 10
            ),
            # Arbitrage strategy toggles (from Supabase for autonomous operation)
            enable_polymarket_single_arb=self._get_bool(
                "enable_polymarket_single_arb", 
                "ENABLE_POLYMARKET_SINGLE_ARB", 
                True
            ),
            enable_kalshi_single_arb=self._get_bool(
                "enable_kalshi_single_arb", 
                "ENABLE_KALSHI_SINGLE_ARB", 
                True
            ),
            enable_cross_platform_arb=self._get_bool(
                "enable_cross_platform_arb", 
                "ENABLE_CROSS_PLATFORM_ARB", 
                True
            ),
            # ============================================================
            # PER-STRATEGY SETTINGS (loaded from Supabase)
            # ============================================================
            # Polymarket Single
            poly_single_min_profit_pct=self._get_float(
                "poly_single_min_profit_pct", "POLY_SINGLE_MIN_PROFIT_PCT", 0.5
            ),
            poly_single_max_spread_pct=self._get_float(
                "poly_single_max_spread_pct", "POLY_SINGLE_MAX_SPREAD_PCT", 15.0
            ),
            poly_single_max_position_usd=self._get_float(
                "poly_single_max_position_usd", "POLY_SINGLE_MAX_POS_USD", 50.0
            ),
            poly_single_scan_interval_sec=self._get_int(
                "poly_single_scan_interval_sec", "POLY_SINGLE_SCAN_SEC", 60
            ),
            # Kalshi Single (higher thresholds due to 7% fees)
            kalshi_single_min_profit_pct=self._get_float(
                "kalshi_single_min_profit_pct", "KALSHI_SINGLE_MIN_PROFIT_PCT", 2.0
            ),
            kalshi_single_max_spread_pct=self._get_float(
                "kalshi_single_max_spread_pct", "KALSHI_SINGLE_MAX_SPREAD_PCT", 15.0
            ),
            kalshi_single_max_position_usd=self._get_float(
                "kalshi_single_max_position_usd", "KALSHI_SINGLE_MAX_POS_USD", 50.0
            ),
            kalshi_single_scan_interval_sec=self._get_int(
                "kalshi_single_scan_interval_sec", "KALSHI_SINGLE_SCAN_SEC", 60
            ),
            # Cross-Platform (asymmetric based on buy platform)
            cross_plat_min_profit_buy_poly_pct=self._get_float(
                "cross_plat_min_profit_buy_poly_pct", "CROSS_MIN_PROFIT_BUY_POLY", 3.0
            ),
            cross_plat_min_profit_buy_kalshi_pct=self._get_float(
                "cross_plat_min_profit_buy_kalshi_pct", "CROSS_MIN_PROFIT_BUY_KALSHI", 5.0
            ),
            cross_plat_max_position_usd=self._get_float(
                "cross_plat_max_position_usd", "CROSS_MAX_POS_USD", 100.0
            ),
            cross_plat_scan_interval_sec=self._get_int(
                "cross_plat_scan_interval_sec", "CROSS_SCAN_SEC", 120
            ),
            cross_plat_min_similarity=self._get_float(
                "cross_plat_min_similarity", "CROSS_MIN_SIMILARITY", 0.30
            ),
            # ============================================================
            # MARKET MAKING SETTINGS
            # ============================================================
            enable_market_making=self._get_bool(
                "enable_market_making", "ENABLE_MARKET_MAKING", False
            ),
            mm_target_spread_bps=self._get_int(
                "mm_target_spread_bps", "MM_TARGET_SPREAD_BPS", 200
            ),
            mm_min_spread_bps=self._get_int(
                "mm_min_spread_bps", "MM_MIN_SPREAD_BPS", 50
            ),
            mm_max_spread_bps=self._get_int(
                "mm_max_spread_bps", "MM_MAX_SPREAD_BPS", 500
            ),
            mm_order_size_usd=self._get_float(
                "mm_order_size_usd", "MM_ORDER_SIZE_USD", 50.0
            ),
            mm_max_inventory_usd=self._get_float(
                "mm_max_inventory_usd", "MM_MAX_INVENTORY_USD", 500.0
            ),
            mm_inventory_skew_factor=self._get_float(
                "mm_inventory_skew_factor", "MM_INVENTORY_SKEW", 0.1
            ),
            mm_quote_refresh_sec=self._get_int(
                "mm_quote_refresh_sec", "MM_QUOTE_REFRESH_SEC", 5
            ),
            mm_min_volume_24h=self._get_float(
                "mm_min_volume_24h", "MM_MIN_VOLUME_24H", 10000.0
            ),
            mm_max_markets=self._get_int(
                "mm_max_markets", "MM_MAX_MARKETS", 5
            ),
            # ============================================================
            # NEWS ARBITRAGE SETTINGS
            # ============================================================
            enable_news_arbitrage=self._get_bool(
                "enable_news_arbitrage", "ENABLE_NEWS_ARBITRAGE", False
            ),
            news_min_spread_pct=self._get_float(
                "news_min_spread_pct", "NEWS_MIN_SPREAD_PCT", 3.0
            ),
            news_max_lag_minutes=self._get_int(
                "news_max_lag_minutes", "NEWS_MAX_LAG_MIN", 30
            ),
            news_position_size_usd=self._get_float(
                "news_position_size_usd", "NEWS_POSITION_SIZE_USD", 50.0
            ),
            news_scan_interval_sec=self._get_int(
                "news_scan_interval_sec", "NEWS_SCAN_INTERVAL_SEC", 30
            ),
            news_keywords=self._get_str(
                "news_keywords", "NEWS_KEYWORDS",
                "election,fed,trump,bitcoin,crypto,verdict"
            ),
            # ============================================================
            # FUNDING RATE ARBITRAGE SETTINGS (85% confidence)
            # ============================================================
            enable_funding_rate_arb=self._get_bool(
                "enable_funding_rate_arb", "ENABLE_FUNDING_RATE_ARB", False
            ),
            funding_min_rate_pct=self._get_float(
                "funding_min_rate_pct", "FUNDING_MIN_RATE_PCT", 0.03
            ),
            funding_min_apy=self._get_float(
                "funding_min_apy", "FUNDING_MIN_APY", 30.0
            ),
            funding_exit_threshold=self._get_float(
                "funding_exit_threshold", "FUNDING_EXIT_THRESHOLD", 0.01
            ),
            funding_max_position_usd=self._get_float(
                "funding_max_position_usd", "FUNDING_MAX_POS_USD", 1000.0
            ),
            funding_min_position_usd=self._get_float(
                "funding_min_position_usd", "FUNDING_MIN_POS_USD", 100.0
            ),
            funding_max_positions=self._get_int(
                "funding_max_positions", "FUNDING_MAX_POSITIONS", 3
            ),
            funding_max_basis_pct=self._get_float(
                "funding_max_basis_pct", "FUNDING_MAX_BASIS_PCT", 1.0
            ),
            funding_max_leverage=self._get_int(
                "funding_max_leverage", "FUNDING_MAX_LEVERAGE", 3
            ),
            funding_scan_interval_sec=self._get_int(
                "funding_scan_interval_sec", "FUNDING_SCAN_SEC", 300
            ),
            # ============================================================
            # GRID TRADING SETTINGS (75% confidence)
            # ============================================================
            enable_grid_trading=self._get_bool(
                "enable_grid_trading", "ENABLE_GRID_TRADING", False
            ),
            grid_default_range_pct=self._get_float(
                "grid_default_range_pct", "GRID_DEFAULT_RANGE_PCT", 10.0
            ),
            grid_default_levels=self._get_int(
                "grid_default_levels", "GRID_DEFAULT_LEVELS", 20
            ),
            grid_default_investment_usd=self._get_float(
                "grid_default_investment_usd", "GRID_DEFAULT_INV_USD", 500.0
            ),
            grid_max_grids=self._get_int(
                "grid_max_grids", "GRID_MAX_GRIDS", 3
            ),
            grid_max_investment_usd=self._get_float(
                "grid_max_investment_usd", "GRID_MAX_INV_USD", 1000.0
            ),
            grid_stop_loss_pct=self._get_float(
                "grid_stop_loss_pct", "GRID_STOP_LOSS_PCT", 15.0
            ),
            grid_take_profit_pct=self._get_float(
                "grid_take_profit_pct", "GRID_TAKE_PROFIT_PCT", 50.0
            ),
            grid_check_interval_sec=self._get_int(
                "grid_check_interval_sec", "GRID_CHECK_SEC", 30
            ),
            # ============================================================
            # PAIRS TRADING SETTINGS (65% confidence)
            # ============================================================
            enable_pairs_trading=self._get_bool(
                "enable_pairs_trading", "ENABLE_PAIRS_TRADING", False
            ),
            pairs_entry_zscore=self._get_float(
                "pairs_entry_zscore", "PAIRS_ENTRY_ZSCORE", 2.0
            ),
            pairs_exit_zscore=self._get_float(
                "pairs_exit_zscore", "PAIRS_EXIT_ZSCORE", 0.5
            ),
            pairs_stop_loss_zscore=self._get_float(
                "pairs_stop_loss_zscore", "PAIRS_STOP_ZSCORE", 4.0
            ),
            pairs_position_size_usd=self._get_float(
                "pairs_position_size_usd", "PAIRS_POS_SIZE_USD", 500.0
            ),
            pairs_max_positions=self._get_int(
                "pairs_max_positions", "PAIRS_MAX_POSITIONS", 2
            ),
            pairs_max_hold_hours=self._get_float(
                "pairs_max_hold_hours", "PAIRS_MAX_HOLD_HOURS", 72.0
            ),
            pairs_max_loss_pct=self._get_float(
                "pairs_max_loss_pct", "PAIRS_MAX_LOSS_PCT", 5.0
            ),
            pairs_scan_interval_sec=self._get_int(
                "pairs_scan_interval_sec", "PAIRS_SCAN_SEC", 60
            ),
            # ============================================================
            # EXCHANGE ENABLEMENT
            # ============================================================
            enable_polymarket=self._get_bool(
                "enable_polymarket", "ENABLE_POLYMARKET", True
            ),
            enable_kalshi=self._get_bool(
                "enable_kalshi", "ENABLE_KALSHI", True
            ),
            enable_binance=self._get_bool(
                "enable_binance", "ENABLE_BINANCE", False
            ),
            enable_bybit=self._get_bool(
                "enable_bybit", "ENABLE_BYBIT", False
            ),
            enable_okx=self._get_bool(
                "enable_okx", "ENABLE_OKX", False
            ),
            enable_kraken=self._get_bool(
                "enable_kraken", "ENABLE_KRAKEN", False
            ),
            enable_coinbase=self._get_bool(
                "enable_coinbase", "ENABLE_COINBASE", False
            ),
            enable_kucoin=self._get_bool(
                "enable_kucoin", "ENABLE_KUCOIN", False
            ),
            enable_alpaca=self._get_bool(
                "enable_alpaca", "ENABLE_ALPACA", False
            ),
            enable_ibkr=self._get_bool(
                "enable_ibkr", "ENABLE_IBKR", False
            ),
            # ============================================================
            # STOCK MEAN REVERSION SETTINGS (70% confidence)
            # ============================================================
            enable_stock_mean_reversion=self._get_bool(
                "enable_stock_mean_reversion", "ENABLE_STOCK_MEAN_REVERSION", False
            ),
            stock_mr_lookback_period=self._get_int(
                "stock_mr_lookback_period", "STOCK_MR_LOOKBACK", 20
            ),
            stock_mr_entry_zscore=self._get_float(
                "stock_mr_entry_zscore", "STOCK_MR_ENTRY_Z", 2.0
            ),
            stock_mr_exit_zscore=self._get_float(
                "stock_mr_exit_zscore", "STOCK_MR_EXIT_Z", 0.5
            ),
            stock_mr_stop_loss_pct=self._get_float(
                "stock_mr_stop_loss_pct", "STOCK_MR_STOP_LOSS", 5.0
            ),
            stock_mr_position_size_usd=self._get_float(
                "stock_mr_position_size_usd", "STOCK_MR_POS_SIZE", 500.0
            ),
            stock_mr_max_positions=self._get_int(
                "stock_mr_max_positions", "STOCK_MR_MAX_POS", 5
            ),
            stock_mr_max_hold_days=self._get_int(
                "stock_mr_max_hold_days", "STOCK_MR_MAX_HOLD_DAYS", 3
            ),
            stock_mr_scan_interval_sec=self._get_int(
                "stock_mr_scan_interval_sec", "STOCK_MR_SCAN_SEC", 300
            ),
            stock_mr_watchlist=self._get_str(
                "stock_mr_watchlist", "STOCK_MR_WATCHLIST",
                "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,V,MA"
            ),
            # ============================================================
            # STOCK MOMENTUM SETTINGS (70% confidence)
            # ============================================================
            enable_stock_momentum=self._get_bool(
                "enable_stock_momentum", "ENABLE_STOCK_MOMENTUM", False
            ),
            momentum_min_score=self._get_float(
                "momentum_min_score", "MOMENTUM_MIN_SCORE", 60.0
            ),
            stock_mom_roc_period=self._get_int(
                "stock_mom_roc_period", "STOCK_MOM_ROC_PERIOD", 10
            ),
            stock_mom_entry_threshold=self._get_float(
                "stock_mom_entry_threshold", "STOCK_MOM_ENTRY_THRESH", 3.0
            ),
            stock_mom_exit_threshold=self._get_float(
                "stock_mom_exit_threshold", "STOCK_MOM_EXIT_THRESH", -1.0
            ),
            stock_mom_rsi_overbought=self._get_float(
                "stock_mom_rsi_overbought", "STOCK_MOM_RSI_OB", 75.0
            ),
            stock_mom_rsi_oversold=self._get_float(
                "stock_mom_rsi_oversold", "STOCK_MOM_RSI_OS", 40.0
            ),
            stock_mom_position_size_usd=self._get_float(
                "stock_mom_position_size_usd", "STOCK_MOM_POS_SIZE", 500.0
            ),
            stock_mom_max_positions=self._get_int(
                "stock_mom_max_positions", "STOCK_MOM_MAX_POS", 5
            ),
            stock_mom_max_hold_days=self._get_int(
                "stock_mom_max_hold_days", "STOCK_MOM_MAX_HOLD_DAYS", 5
            ),
            stock_mom_stop_loss_pct=self._get_float(
                "stock_mom_stop_loss_pct", "STOCK_MOM_STOP_LOSS", 7.0
            ),
            stock_mom_scan_interval_sec=self._get_int(
                "stock_mom_scan_interval_sec", "STOCK_MOM_SCAN_SEC", 300
            ),
            stock_mom_watchlist=self._get_str(
                "stock_mom_watchlist", "STOCK_MOM_WATCHLIST",
                "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,AMD,CRM,NFLX"
            ),
            # ============================================================
            # ADVANCED FRAMEWORK - PHASE 1 (Risk Management)
            # ============================================================
            # Kelly Criterion Position Sizing
            kelly_sizing_enabled=self._get_bool(
                "kelly_sizing_enabled", "KELLY_SIZING_ENABLED", False
            ),
            kelly_fraction_cap=self._get_float(
                "kelly_fraction_cap", "KELLY_FRACTION_CAP", 0.25
            ),
            kelly_min_confidence=self._get_float(
                "kelly_min_confidence", "KELLY_MIN_CONFIDENCE", 0.60
            ),
            kelly_max_position_pct=self._get_float(
                "kelly_max_position_pct", "KELLY_MAX_POSITION_PCT", 10.0
            ),
            # Market Regime Detection
            regime_detection_enabled=self._get_bool(
                "regime_detection_enabled", "REGIME_DETECTION_ENABLED", True
            ),
            regime_vix_low_threshold=self._get_float(
                "regime_vix_low_threshold", "REGIME_VIX_LOW", 15.0
            ),
            regime_vix_high_threshold=self._get_float(
                "regime_vix_high_threshold", "REGIME_VIX_HIGH", 25.0
            ),
            regime_vix_crisis_threshold=self._get_float(
                "regime_vix_crisis_threshold", "REGIME_VIX_CRISIS", 35.0
            ),
            regime_auto_adjust=self._get_bool(
                "regime_auto_adjust", "REGIME_AUTO_ADJUST", True
            ),
            # Circuit Breaker System
            circuit_breaker_enabled=self._get_bool(
                "circuit_breaker_enabled", "CIRCUIT_BREAKER_ENABLED", True
            ),
            circuit_breaker_level1_pct=self._get_float(
                "circuit_breaker_level1_pct", "CB_LEVEL1_PCT", 3.0
            ),
            circuit_breaker_level2_pct=self._get_float(
                "circuit_breaker_level2_pct", "CB_LEVEL2_PCT", 5.0
            ),
            circuit_breaker_level3_pct=self._get_float(
                "circuit_breaker_level3_pct", "CB_LEVEL3_PCT", 10.0
            ),
            circuit_breaker_reset_hours=self._get_int(
                "circuit_breaker_reset_hours", "CB_RESET_HOURS", 24
            ),
            # ============================================================
            # STRATEGY ENHANCEMENTS - PHASE 2
            # ============================================================
            # Time Decay Analysis
            time_decay_enabled=self._get_bool(
                "time_decay_enabled", "TIME_DECAY_ENABLED", True
            ),
            time_decay_critical_days=self._get_int(
                "time_decay_critical_days", "TIME_DECAY_CRITICAL_DAYS", 7
            ),
            time_decay_avoid_entry_hours=self._get_int(
                "time_decay_avoid_entry_hours", "TIME_DECAY_AVOID_HOURS", 48
            ),
            time_decay_mid_prob_low=self._get_float(
                "time_decay_mid_prob_low", "TIME_DECAY_MID_PROB_LOW", 0.35
            ),
            time_decay_mid_prob_high=self._get_float(
                "time_decay_mid_prob_high", "TIME_DECAY_MID_PROB_HIGH", 0.65
            ),
            # Order Flow Analysis
            order_flow_enabled=self._get_bool(
                "order_flow_enabled", "ORDER_FLOW_ENABLED", False
            ),
            order_flow_signal_threshold=self._get_float(
                "order_flow_signal_threshold", "ORDER_FLOW_SIGNAL_THRESH", 0.30
            ),
            order_flow_strong_threshold=self._get_float(
                "order_flow_strong_threshold", "ORDER_FLOW_STRONG_THRESH", 0.60
            ),
            order_flow_lookback_seconds=self._get_int(
                "order_flow_lookback_seconds", "ORDER_FLOW_LOOKBACK_SEC", 300
            ),
            # Stablecoin Depeg Detection
            depeg_detection_enabled=self._get_bool(
                "depeg_detection_enabled", "DEPEG_DETECTION_ENABLED", True
            ),
            depeg_alert_threshold_pct=self._get_float(
                "depeg_alert_threshold_pct", "DEPEG_ALERT_PCT", 0.30
            ),
            depeg_arbitrage_threshold_pct=self._get_float(
                "depeg_arbitrage_threshold_pct", "DEPEG_ARB_PCT", 0.50
            ),
            depeg_critical_threshold_pct=self._get_float(
                "depeg_critical_threshold_pct", "DEPEG_CRITICAL_PCT", 5.0
            ),
            # Correlation Position Limits
            correlation_limits_enabled=self._get_bool(
                "correlation_limits_enabled", "CORRELATION_LIMITS_ENABLED", True
            ),
            correlation_max_cluster_pct=self._get_float(
                "correlation_max_cluster_pct", "CORRELATION_MAX_CLUSTER_PCT", 30.0
            ),
            correlation_max_correlated_pct=self._get_float(
                "correlation_max_correlated_pct", "CORRELATION_MAX_CORR_PCT", 50.0
            ),
            correlation_high_threshold=self._get_float(
                "correlation_high_threshold", "CORRELATION_HIGH_THRESH", 0.70
            ),
            # Twitter-Derived Strategies (2024)
            enable_btc_bracket_arb=self._get_bool(
                "enable_btc_bracket_arb", "ENABLE_BTC_BRACKET_ARB", False
            ),
            btc_bracket_min_discount_pct=self._get_float(
                "btc_bracket_min_discount_pct", "BTC_BRACKET_MIN_DISCOUNT", 0.5
            ),
            btc_bracket_max_position_usd=self._get_float(
                "btc_bracket_max_position_usd", "BTC_BRACKET_MAX_POS", 50.0
            ),
            btc_bracket_scan_interval_sec=self._get_int(
                "btc_bracket_scan_interval_sec", "BTC_BRACKET_SCAN_INT", 15
            ),
            enable_bracket_compression=self._get_bool(
                "enable_bracket_compression", "ENABLE_BRACKET_COMPRESSION", False
            ),
            bracket_max_imbalance_threshold=self._get_float(
                "bracket_max_imbalance_threshold", "BRACKET_MAX_IMBALANCE", 0.30
            ),
            bracket_take_profit_pct=self._get_float(
                "bracket_take_profit_pct", "BRACKET_TAKE_PROFIT", 3.0
            ),
            bracket_stop_loss_pct=self._get_float(
                "bracket_stop_loss_pct", "BRACKET_STOP_LOSS", 10.0
            ),
            bracket_max_position_usd=self._get_float(
                "bracket_max_position_usd", "BRACKET_MAX_POS", 100.0
            ),
            enable_kalshi_mention_snipe=self._get_bool(
                "enable_kalshi_mention_snipe", "ENABLE_KALSHI_SNIPE", False
            ),
            kalshi_snipe_min_profit_cents=self._get_int(
                "kalshi_snipe_min_profit_cents", "KALSHI_SNIPE_MIN_PROFIT", 2
            ),
            kalshi_snipe_max_position_usd=self._get_float(
                "kalshi_snipe_max_position_usd", "KALSHI_SNIPE_MAX_POS", 100.0
            ),
            kalshi_snipe_max_latency_ms=self._get_int(
                "kalshi_snipe_max_latency_ms", "KALSHI_SNIPE_LATENCY", 1000
            ),
            enable_whale_copy_trading=self._get_bool(
                "enable_whale_copy_trading", "ENABLE_WHALE_COPY", False
            ),
            whale_copy_min_win_rate=self._get_int(
                "whale_copy_min_win_rate", "WHALE_COPY_MIN_WIN", 80
            ),
            whale_copy_delay_seconds=self._get_int(
                "whale_copy_delay_seconds", "WHALE_COPY_DELAY", 30
            ),
            whale_copy_max_size_usd=self._get_float(
                "whale_copy_max_size_usd", "WHALE_COPY_MAX_SIZE", 50.0
            ),
            whale_copy_max_concurrent=self._get_int(
                "whale_copy_max_concurrent", "WHALE_COPY_MAX_CONCURRENT", 5
            ),
            enable_macro_board=self._get_bool(
                "enable_macro_board", "ENABLE_MACRO_BOARD", False
            ),
            macro_max_exposure_usd=self._get_float(
                "macro_max_exposure_usd", "MACRO_MAX_EXPOSURE", 5000.0
            ),
            macro_min_conviction_score=self._get_int(
                "macro_min_conviction_score", "MACRO_MIN_CONVICTION", 70
            ),
            macro_rebalance_interval_hours=self._get_int(
                "macro_rebalance_interval_hours", "MACRO_REBALANCE_HOURS", 24
            ),
            enable_fear_premium_contrarian=self._get_bool(
                "enable_fear_premium_contrarian", "ENABLE_FEAR_PREMIUM", False
            ),
            fear_extreme_low_threshold=self._get_float(
                "fear_extreme_low_threshold", "FEAR_EXTREME_LOW", 0.15
            ),
            fear_extreme_high_threshold=self._get_float(
                "fear_extreme_high_threshold", "FEAR_EXTREME_HIGH", 0.85
            ),
            fear_min_premium_pct=self._get_int(
                "fear_min_premium_pct", "FEAR_MIN_PREMIUM", 10
            ),
            fear_max_position_usd=self._get_float(
                "fear_max_position_usd", "FEAR_MAX_POS", 200.0
            ),
            # Congressional Tracker config
            enable_congressional_tracker=self._get_bool(
                "enable_congressional_tracker", "ENABLE_CONGRESS_TRACKER", False
            ),
            congress_tracked_politicians=self._get_str(
                "congress_tracked_politicians", "CONGRESS_TRACKED_POLS", ""
            ),
            congress_chamber_filter=self._get_str(
                "congress_chamber_filter", "CONGRESS_CHAMBER", "both"
            ),
            congress_copy_scale_pct=self._get_float(
                "congress_copy_scale_pct", "CONGRESS_COPY_SCALE", 10.0
            ),
            congress_min_trade_amount_usd=self._get_float(
                "congress_min_trade_amount_usd", "CONGRESS_MIN_TRADE", 100.0
            ),
            congress_max_position_usd=self._get_float(
                "congress_max_position_usd", "CONGRESS_MAX_POS", 500.0
            ),
            congress_copy_delay_hours=self._get_int(
                "congress_copy_delay_hours", "CONGRESS_COPY_DELAY", 24
            ),
            congress_data_source=self._get_str(
                "congress_data_source", "CONGRESS_DATA_SOURCE", "house_watcher"
            ),
            # Political Event Strategy config
            enable_political_event_strategy=self._get_bool(
                "enable_political_event_strategy", "ENABLE_POLITICAL_EVENT", False
            ),
            political_min_conviction_score=self._get_float(
                "political_min_conviction_score", "POLITICAL_MIN_CONVICTION", 0.75
            ),
            political_max_position_usd=self._get_float(
                "political_max_position_usd", "POLITICAL_MAX_POS", 500.0
            ),
            political_max_concurrent_events=self._get_int(
                "political_max_concurrent_events", "POLITICAL_MAX_EVENTS", 5
            ),
            political_event_categories=self._get_str(
                "political_event_categories", "POLITICAL_CATEGORIES", "election,legislation,hearing"
            ),
            political_lead_time_hours=self._get_int(
                "political_lead_time_hours", "POLITICAL_LEAD_TIME", 48
            ),
            political_exit_buffer_hours=self._get_int(
                "political_exit_buffer_hours", "POLITICAL_EXIT_BUFFER", 2
            ),
            # High Conviction Strategy config
            enable_high_conviction_strategy=self._get_bool(
                "enable_high_conviction_strategy", "ENABLE_HIGH_CONVICTION", False
            ),
            high_conviction_min_score=self._get_float(
                "high_conviction_min_score", "HIGH_CONVICTION_MIN", 0.75
            ),
            high_conviction_max_positions=self._get_int(
                "high_conviction_max_positions", "HIGH_CONVICTION_MAX_POS", 3
            ),
            high_conviction_min_signals=self._get_int(
                "high_conviction_min_signals", "HIGH_CONVICTION_MIN_SIGNALS", 3
            ),
            high_conviction_position_pct=self._get_float(
                "high_conviction_position_pct", "HIGH_CONVICTION_POS_PCT", 15.0
            ),
            high_conviction_use_kelly=self._get_bool(
                "high_conviction_use_kelly", "HIGH_CONVICTION_KELLY", True
            ),
            high_conviction_kelly_fraction=self._get_float(
                "high_conviction_kelly_fraction", "HIGH_CONVICTION_KELLY_FRAC", 0.25
            ),
            # Selective Whale Copy Strategy config
            enable_selective_whale_copy=self._get_bool(
                "enable_selective_whale_copy", "ENABLE_SELECTIVE_WHALE", False
            ),
            selective_whale_min_win_rate=self._get_float(
                "selective_whale_min_win_rate", "SELECTIVE_WHALE_WIN_RATE", 0.65
            ),
            selective_whale_min_roi=self._get_float(
                "selective_whale_min_roi", "SELECTIVE_WHALE_MIN_ROI", 0.20
            ),
            selective_whale_min_trades=self._get_int(
                "selective_whale_min_trades", "SELECTIVE_WHALE_MIN_TRADES", 10
            ),
            selective_whale_max_tracked=self._get_int(
                "selective_whale_max_tracked", "SELECTIVE_WHALE_MAX_TRACKED", 10
            ),
            selective_whale_auto_select=self._get_bool(
                "selective_whale_auto_select", "SELECTIVE_WHALE_AUTO", True
            ),
            selective_whale_copy_scale_pct=self._get_float(
                "selective_whale_copy_scale_pct", "SELECTIVE_WHALE_SCALE", 5.0
            ),
            selective_whale_max_position_usd=self._get_float(
                "selective_whale_max_position_usd", "SELECTIVE_WHALE_MAX_POS", 200.0
            ),
        )
        self.polymarket = PolymarketConfig()
        self.kalshi = KalshiConfig()
        self.database = DatabaseConfig()
        self.notifications = NotificationsConfig()
    
    def _get_bool(
        self, supabase_key: str, env_key: str, default: bool
    ) -> bool:
        """Get bool value from Supabase, then env, then default."""
        # Check Supabase first
        if self._supabase_config and supabase_key in self._supabase_config:
            val = self._supabase_config[supabase_key]
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() == "true"
        # Fall back to env var
        env_val = os.getenv(env_key)
        if env_val is not None:
            return env_val.lower() == "true"
        return default
    
    def _get_float(
        self, supabase_key: str, env_key: str, default: float
    ) -> float:
        """Get float value from Supabase, then env, then default."""
        if self._supabase_config and supabase_key in self._supabase_config:
            val = self._supabase_config[supabase_key]
            if val is not None:
                return float(val)
        env_val = os.getenv(env_key)
        if env_val is not None:
            return float(env_val)
        return default
    
    def _get_int(
        self, supabase_key: str, env_key: str, default: int
    ) -> int:
        """Get int value from Supabase, then env, then default."""
        if self._supabase_config and supabase_key in self._supabase_config:
            val = self._supabase_config[supabase_key]
            if val is not None:
                return int(val)
        env_val = os.getenv(env_key)
        if env_val is not None:
            return int(env_val)
        return default

    def _get_str(
        self, supabase_key: str, env_key: str, default: str
    ) -> str:
        """Get string value from Supabase, then env, then default."""
        if self._supabase_config and supabase_key in self._supabase_config:
            val = self._supabase_config[supabase_key]
            if val is not None:
                return str(val)
        env_val = os.getenv(env_key)
        if env_val is not None:
            return env_val
        return default
    
    def reload_from_supabase(self, db_client) -> bool:
        """
        Reload config from Supabase.
        
        Call this periodically to pick up config changes without restart.
        Returns True if config was updated.
        """
        new_config = db_client.get_trading_config()
        if new_config:
            self._supabase_config = new_config
            # Update ALL trading strategy enable flags
            self.trading.enable_polymarket_single_arb = self._get_bool(
                "enable_polymarket_single_arb", 
                "ENABLE_POLYMARKET_SINGLE_ARB", 
                True
            )
            self.trading.enable_kalshi_single_arb = self._get_bool(
                "enable_kalshi_single_arb", 
                "ENABLE_KALSHI_SINGLE_ARB", 
                True
            )
            self.trading.enable_cross_platform_arb = self._get_bool(
                "enable_cross_platform_arb", 
                "ENABLE_CROSS_PLATFORM_ARB", 
                True
            )
            self.trading.enable_market_making = self._get_bool(
                "enable_market_making",
                "ENABLE_MARKET_MAKING",
                False
            )
            self.trading.enable_news_arbitrage = self._get_bool(
                "enable_news_arbitrage",
                "ENABLE_NEWS_ARBITRAGE",
                False
            )
            self.trading.enable_funding_rate_arb = self._get_bool(
                "enable_funding_rate_arb",
                "ENABLE_FUNDING_RATE_ARB",
                False
            )
            self.trading.enable_grid_trading = self._get_bool(
                "enable_grid_trading",
                "ENABLE_GRID_TRADING",
                False
            )
            self.trading.enable_pairs_trading = self._get_bool(
                "enable_pairs_trading",
                "ENABLE_PAIRS_TRADING",
                False
            )
            self.trading.enable_stock_mean_reversion = self._get_bool(
                "enable_stock_mean_reversion",
                "ENABLE_STOCK_MEAN_REVERSION",
                False
            )
            self.trading.enable_stock_momentum = self._get_bool(
                "enable_stock_momentum",
                "ENABLE_STOCK_MOMENTUM",
                False
            )
            # Exchange enables
            self.trading.enable_binance = self._get_bool(
                "enable_binance",
                "ENABLE_BINANCE",
                False
            )
            self.trading.enable_coinbase = self._get_bool(
                "enable_coinbase",
                "ENABLE_COINBASE",
                False
            )
            self.trading.enable_alpaca = self._get_bool(
                "enable_alpaca",
                "ENABLE_ALPACA",
                False
            )
            self.trading.enable_bybit = self._get_bool(
                "enable_bybit",
                "ENABLE_BYBIT",
                False
            )
            self.trading.enable_okx = self._get_bool(
                "enable_okx",
                "ENABLE_OKX",
                False
            )
            return True
        return False
    
    def validate(self) -> list[str]:
        """Validate configuration and return list of errors."""
        errors = []
        
        if not self.trading.dry_run:
            if not self.polymarket.private_key:
                errors.append("POLYMARKET_PRIVATE_KEY required for live trading")
            if not self.kalshi.api_key or not self.kalshi.private_key:
                errors.append("KALSHI_API_KEY and KALSHI_PRIVATE_KEY required for live trading")
        
        if self.trading.max_trade_size <= 0:
            errors.append("MAX_TRADE_SIZE must be positive")
        
        if self.trading.min_profit_percent < 0:
            errors.append("MIN_PROFIT_PERCENT cannot be negative")
        
        return errors
    
    def print_summary(self):
        """Print configuration summary (hiding sensitive values)."""
        print("=" * 50)
        print("POLYBOT CONFIGURATION")
        print("=" * 50)
        dry_run_str = '🔵 DRY RUN' if self.trading.dry_run else '🟢 LIVE'
        print(f"Mode: {dry_run_str}")
        print(f"Min Profit: {self.trading.min_profit_percent}%")
        print(f"Max Trade Size: ${self.trading.max_trade_size}")
        print(f"Max Daily Loss: ${self.trading.max_daily_loss}")
        print(f"Slippage Tolerance: {self.trading.slippage_tolerance}%")
        print(f"Scan Interval: {self.trading.scan_interval}s")
        print(f"Manual Approval: {self.trading.manual_approval_trades} trades")
        print("-" * 50)
        print("ARBITRAGE STRATEGIES:")
        poly_s = "✅ ON" if self.trading.enable_polymarket_single_arb else "❌ OFF"
        kalshi_s = "✅ ON" if self.trading.enable_kalshi_single_arb else "❌ OFF"
        cross_s = "✅ ON" if self.trading.enable_cross_platform_arb else "❌ OFF"
        print(f"  Polymarket Single-Platform: {poly_s}")
        print(f"  Kalshi Single-Platform:     {kalshi_s}")
        print(f"  Cross-Platform (Poly↔Kalshi): {cross_s}")
        print("-" * 50)
        poly_key = '✅' if self.polymarket.private_key else '❌'
        kalshi_key = '✅' if self.kalshi.api_key else '❌'
        db_ok = '✅' if self.database.is_configured else '❌'
        discord_ok = '✅' if self.notifications.discord_webhook else '⚪'
        print(f"Polymarket Key: {poly_key}")
        print(f"Kalshi Key: {kalshi_key}")
        print(f"Database: {db_ok}")
        print(f"Discord: {discord_ok}")
        print("=" * 50)


# Global config instance
config = Config()
