'use client';

import { useState } from 'react';
import { 
  BookOpen, 
  Target,
  Repeat,
  BarChart3,
  Newspaper,
  Users,
  DollarSign,
  Grid3X3,
  LineChart,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Landmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface StrategyDoc {
  id: string;
  name: string;
  confidence: number;
  expectedApy: string;
  riskLevel: 'low' | 'medium' | 'high';
  category: 'prediction' | 'crypto' | 'stocks';
  icon: JSX.Element;
  color: string;
  description: string;
  howItWorks: string[];
  keyPoints: string[];
  configParams: { name: string; default: string; description: string }[];
  requiredCredentials: string[];
  academicRefs?: string[];
}

const STRATEGY_DOCS: StrategyDoc[] = [
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    confidence: 95,
    expectedApy: '50-200%',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Target className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-500',
    description: 'Exploit mispricings within a single prediction market by buying both YES and NO outcomes when their combined price is less than $1.00. This guarantees a profit regardless of the market outcome.',
    howItWorks: [
      'Scan all active markets on Polymarket/Kalshi every 60 seconds',
      'Calculate YES price + NO price for each market',
      'If combined price < threshold (e.g., 99.5%), an arbitrage opportunity exists',
      'Execute simultaneous buy orders for both YES and NO',
      'Wait for market resolution - one side wins, you collect $1.00',
      'Profit = $1.00 - (YES cost + NO cost)',
    ],
    keyPoints: [
      'Zero directional risk - You profit regardless of the outcome',
      'Rare opportunities - Mispricings are quickly corrected',
      'Polymarket advantage - 0% fees means smaller spreads are profitable',
      'Kalshi constraint - 7% fee on profits requires larger spreads (>7%)',
      'Academic validation - Research shows $40M+ extracted via this strategy in 1 year',
    ],
    configParams: [
      { name: 'poly_single_min_profit_pct', default: '0.5', description: 'Min profit threshold for Polymarket' },
      { name: 'poly_single_max_spread_pct', default: '5.0', description: 'Max bid-ask spread to consider' },
      { name: 'poly_single_max_position_usd', default: '500', description: 'Max position per opportunity' },
      { name: 'kalshi_single_min_profit_pct', default: '8.0', description: 'Min profit for Kalshi (>7% fees)' },
    ],
    requiredCredentials: [
      'WALLET_ADDRESS - Polymarket wallet address',
      'PRIVATE_KEY - Polymarket signing key',
      'KALSHI_API_KEY - Kalshi API key (optional)',
      'KALSHI_PRIVATE_KEY - Kalshi private key (optional)',
    ],
  },
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    confidence: 90,
    expectedApy: '30-100%',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Repeat className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-500',
    description: 'Exploit price differences between Polymarket and Kalshi for the same event. When YES on Polymarket is cheaper than NO on Kalshi (or vice versa), execute trades on both platforms for a guaranteed profit.',
    howItWorks: [
      'Fetch active markets from both Polymarket and Kalshi',
      'Match similar events using fuzzy string matching',
      'Compare YES prices across platforms',
      'Calculate spread after accounting for Kalshi\'s 7% fee',
      'If spread > threshold, execute cross-platform trade',
      'Wait for resolution - you hold opposite positions that cancel out',
    ],
    keyPoints: [
      'Asymmetric fees - Buy on Polymarket (0%) preferred over Kalshi (7%)',
      'Event matching - Must find identical events across platforms',
      'Settlement risk - Both platforms must resolve the same way',
      'Capital efficiency - Requires funds on both platforms',
    ],
    configParams: [
      { name: 'cross_plat_min_profit_buy_poly_pct', default: '3.0', description: 'Min profit when buying on Poly' },
      { name: 'cross_plat_min_profit_buy_kalshi_pct', default: '10.0', description: 'Min profit when buying on Kalshi' },
      { name: 'cross_plat_max_position_usd', default: '1000', description: 'Max position per opportunity' },
    ],
    requiredCredentials: [
      'All Polymarket credentials',
      'All Kalshi credentials',
      'Capital funded on both platforms',
    ],
  },
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    confidence: 85,
    expectedApy: '15-50%',
    riskLevel: 'low',
    category: 'crypto',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'from-yellow-500 to-amber-500',
    description: 'Collect perpetual futures funding payments by holding delta-neutral positions. When funding is positive (longs pay shorts), go long spot and short perpetual to earn funding without directional risk.',
    howItWorks: [
      'Scan funding rates across all supported exchanges',
      'Filter for rates > 0.03% per 8 hours (~30% APY)',
      'Calculate optimal position size based on limits',
      'Buy spot asset (or long with 1x leverage)',
      'Short an equivalent amount on perpetual futures',
      'Collect funding every 8 hours',
      'Exit when funding turns negative or spread narrows',
    ],
    keyPoints: [
      'Delta neutral - No exposure to price direction',
      'Structural alpha - Retail longs create persistent positive funding',
      'Math-based - Earning a fee, not predicting direction',
      'Historical data - BTC funding averages 0.01%/8h = 10.95% APY base',
      'Leverage management - Keep futures leverage low (2-3x max)',
    ],
    configParams: [
      { name: 'funding_min_rate_pct', default: '0.03', description: 'Min 0.03% per 8h' },
      { name: 'funding_min_apy', default: '30.0', description: 'Min 30% annualized' },
      { name: 'funding_max_position_usd', default: '1000', description: 'Max per position' },
      { name: 'funding_max_positions', default: '3', description: 'Max concurrent positions' },
      { name: 'funding_max_leverage', default: '3', description: 'Futures leverage limit' },
    ],
    requiredCredentials: [
      'BINANCE_API_KEY + BINANCE_API_SECRET',
      'BYBIT_API_KEY + BYBIT_API_SECRET',
      'OKX_API_KEY + OKX_API_SECRET + OKX_PASSPHRASE',
    ],
    academicRefs: [
      'Statistical Arbitrage in Cryptocurrency Markets - Journal of Finance',
      'Binance historical funding data analysis',
    ],
  },
  // ===== NEW HIGH-CONFIDENCE STRATEGIES (85% and 80%) =====
  {
    id: 'high_conviction',
    name: 'High Conviction Strategy',
    confidence: 85,
    expectedApy: '40-80%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Target className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Multi-signal convergence strategy that only trades when multiple independent signals align. Combines whale tracking, news sentiment, order flow, and technical analysis for high-probability entries.',
    howItWorks: [
      'Aggregate signals from whale tracking, news, order flow',
      'Calculate conviction score (0-100) based on signal alignment',
      'Filter for opportunities with 3+ agreeing signals',
      'Apply Kelly Criterion for optimal position sizing',
      'Execute trade only when conviction score > 75%',
      'Monitor position until resolution or stop-loss triggered',
    ],
    keyPoints: [
      'Multi-signal convergence - Only trades when signals align',
      'High conviction threshold - Requires 75%+ conviction score',
      'Larger position sizes - 10-15% of portfolio per trade',
      'Kelly sizing - Mathematically optimal bet sizing',
      'Limited positions - Maximum 3 concurrent trades',
      'Higher win rate target - Selective entry criteria',
    ],
    configParams: [
      { name: 'high_conviction_min_score', default: '0.75', description: 'Min conviction score (0-1)' },
      { name: 'high_conviction_max_positions', default: '3', description: 'Max concurrent positions' },
      { name: 'high_conviction_min_signals', default: '3', description: 'Min signals to agree' },
      { name: 'high_conviction_position_pct', default: '15.0', description: 'Position size % of portfolio' },
      { name: 'high_conviction_use_kelly', default: 'true', description: 'Use Kelly Criterion sizing' },
      { name: 'high_conviction_kelly_fraction', default: '0.25', description: 'Fractional Kelly (safety)' },
    ],
    requiredCredentials: [
      'WALLET_ADDRESS - Polymarket wallet address',
      'PRIVATE_KEY - Polymarket signing key',
      'NEWS_API_KEY - For sentiment analysis (optional)',
    ],
  },
  {
    id: 'political_event',
    name: 'Political Event Strategy',
    confidence: 80,
    expectedApy: '30-60%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Landmark className="w-5 h-5" />,
    color: 'from-blue-500 to-indigo-500',
    description: 'Trade prediction markets around scheduled political events like elections, hearings, and legislation votes. Enter positions before events and exit based on event timing.',
    howItWorks: [
      'Scan for upcoming political events (elections, hearings, votes)',
      'Calculate conviction score based on event type and market data',
      'Enter positions 24-48 hours before scheduled event',
      'Monitor news and event progress continuously',
      'Exit positions 2+ hours before expected resolution',
      'Capture pre-event price movements and volatility',
    ],
    keyPoints: [
      'Scheduled events - Focus on predictable political calendar',
      'Lead time entry - Enter 24-48 hours before event',
      'Early exit - Exit 2+ hours before resolution to reduce risk',
      'Event categories - Elections, legislation, hearings',
      'Position limits - Maximum 5 concurrent event positions',
      'Conviction scoring - Based on event type + market sentiment',
    ],
    configParams: [
      { name: 'political_min_conviction_score', default: '0.75', description: 'Min conviction to trade' },
      { name: 'political_max_position_usd', default: '500', description: 'Max position per event' },
      { name: 'political_max_concurrent_events', default: '5', description: 'Max concurrent positions' },
      { name: 'political_event_categories', default: 'election,legislation,hearing', description: 'Event types' },
      { name: 'political_lead_time_hours', default: '48', description: 'Enter X hours before event' },
      { name: 'political_exit_buffer_hours', default: '2', description: 'Exit X hours before resolution' },
    ],
    requiredCredentials: [
      'WALLET_ADDRESS - Polymarket wallet address',
      'PRIVATE_KEY - Polymarket signing key',
      'Political calendar data source (built-in)',
    ],
  },
  {
    id: 'selective_whale_copy',
    name: 'Selective Whale Copy',
    confidence: 80,
    expectedApy: '35-70%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-5 h-5" />,
    color: 'from-cyan-500 to-blue-500',
    description: 'Advanced whale copy trading that automatically selects top-performing wallets based on win rate, ROI, and trade history. Only copies trades from proven performers with verified track records.',
    howItWorks: [
      'Fetch trader leaderboard from Polymarket Data API',
      'Filter wallets by win rate > 65% and ROI > 20%',
      'Require minimum 10 trades for qualification',
      'Auto-select top 10 qualifying wallets to track',
      'Monitor tracked wallets for new positions',
      'Copy trade at 5% of whale position size (max $200)',
    ],
    keyPoints: [
      'Auto-selection - Automatically finds top performers',
      'Win rate filter - Only copies traders with >65% win rate',
      'ROI threshold - Requires >20% historical ROI',
      'Track record - Minimum 10 trades required',
      'Position scaling - Copy at 5% of whale size',
      'Risk limits - Maximum $200 per copied position',
    ],
    configParams: [
      { name: 'selective_whale_min_win_rate', default: '0.65', description: 'Min win rate to qualify' },
      { name: 'selective_whale_min_roi', default: '0.20', description: 'Min ROI to qualify' },
      { name: 'selective_whale_min_trades', default: '10', description: 'Min trades for track record' },
      { name: 'selective_whale_max_tracked', default: '10', description: 'Max wallets to track' },
      { name: 'selective_whale_auto_select', default: 'true', description: 'Auto-select top performers' },
      { name: 'selective_whale_copy_scale_pct', default: '5.0', description: 'Copy at X% of whale size' },
      { name: 'selective_whale_max_position_usd', default: '200', description: 'Max per copied position' },
    ],
    requiredCredentials: [
      'WALLET_ADDRESS - Polymarket wallet address',
      'PRIVATE_KEY - Polymarket signing key',
      'Polymarket Data API access (built-in)',
    ],
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    confidence: 75,
    expectedApy: '20-60%',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <Grid3X3 className="w-5 h-5" />,
    color: 'from-teal-500 to-cyan-500',
    description: 'Profit from sideways price oscillation by placing a grid of buy orders below current price and sell orders above. Each time price oscillates through the grid, you capture profit.',
    howItWorks: [
      'Select an asset with sideways/ranging price action',
      'Define price range (e.g., ±10% from current)',
      'Divide range into levels (e.g., 20 levels)',
      'Place buy limit orders at each level below current price',
      'Place sell limit orders at each level above current price',
      'When a buy fills, immediately place a sell at the next level up',
      'When a sell fills, immediately place a buy at the next level down',
    ],
    keyPoints: [
      'Range-bound profit - Works best when price oscillates',
      'Trend risk - Can lose money in strong up/down trends',
      'Automation required - Orders must be placed immediately on fills',
      'Level optimization - More levels = more trades but smaller profits each',
      'Stop-loss important - Exit if price breaks out of range',
    ],
    configParams: [
      { name: 'grid_default_range_pct', default: '10.0', description: '±10% range' },
      { name: 'grid_default_levels', default: '20', description: 'Number of grid levels' },
      { name: 'grid_default_investment_usd', default: '500', description: 'Capital per grid' },
      { name: 'grid_max_grids', default: '3', description: 'Max concurrent grids' },
      { name: 'grid_stop_loss_pct', default: '15.0', description: 'Exit if price breaks out' },
    ],
    requiredCredentials: [
      'Any CCXT-supported exchange API keys',
      'Sufficient capital deposited',
    ],
  },
  {
    id: 'pairs_trading',
    name: 'Pairs Trading / Statistical Arbitrage',
    confidence: 65,
    expectedApy: '10-25%',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <LineChart className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-500',
    description: 'Trade the spread between two correlated assets. When the spread widens beyond normal (z-score > 2), long the underperformer and short the outperformer, expecting mean reversion.',
    howItWorks: [
      'Calculate rolling 30-day correlation between pair (e.g., BTC/ETH)',
      'Compute spread: Price_A - (Beta × Price_B)',
      'Calculate mean and standard deviation of spread',
      'Compute z-score: (current_spread - mean) / std_dev',
      'If z-score > +2: Short A, Long B (A outperformed)',
      'If z-score < -2: Long A, Short B (B outperformed)',
      'Exit when z-score returns to <0.5',
    ],
    keyPoints: [
      'Mean reversion - Spreads tend to return to normal',
      'Correlation risk - Correlation can break down (regime change)',
      'Market neutral - Long + short cancel directional risk',
      'Statistical basis - Backed by academic research',
      'Best pairs: BTC/ETH, SOL/AVAX, LINK/UNI',
    ],
    configParams: [
      { name: 'pairs_entry_zscore', default: '2.0', description: 'Enter when |z| > 2' },
      { name: 'pairs_exit_zscore', default: '0.5', description: 'Exit when |z| < 0.5' },
      { name: 'pairs_position_size_usd', default: '500', description: 'Size per leg' },
      { name: 'pairs_max_positions', default: '2', description: 'Max concurrent pairs' },
      { name: 'pairs_max_hold_hours', default: '72', description: 'Max 3 days holding' },
    ],
    requiredCredentials: [
      'Exchange API with margin/futures access',
      'Ability to short on the exchange',
    ],
    academicRefs: [
      'Algorithmic Trading of Co-Integrated Assets - SSRN',
      'QuantConnect: Optimal Pairs Trading strategy library',
    ],
  },
  {
    id: 'market_making',
    name: 'Market Making',
    confidence: 75,
    expectedApy: '10-20%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Provide liquidity to prediction markets by placing limit orders on both the bid and ask sides. Earn the spread each time both orders get filled.',
    howItWorks: [
      'Select high-volume markets (>$5,000 24h volume)',
      'Calculate fair value from current order book',
      'Place bid order below fair value',
      'Place ask order above fair value',
      'When bid fills, place a new ask at higher price',
      'When ask fills, place a new bid at lower price',
      'Adjust quote sizes based on inventory position',
    ],
    keyPoints: [
      'Spread capture - Earn 1-5% on each round trip',
      'Inventory risk - Can get stuck with one-sided position',
      'Active management - Requires constant quote refreshing',
      'Market selection - Best on high-volume, volatile markets',
      'Capital intensive - Same capital backs both sides',
    ],
    configParams: [
      { name: 'mm_target_spread_bps', default: '300', description: 'Target 3% spread' },
      { name: 'mm_order_size_usd', default: '50', description: 'Size per quote' },
      { name: 'mm_max_inventory_usd', default: '500', description: 'Max one-sided inventory' },
      { name: 'mm_quote_refresh_sec', default: '30', description: 'Refresh frequency' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
    ],
  },
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    confidence: 60,
    expectedApy: '5-30% per event',
    riskLevel: 'high',
    category: 'prediction',
    icon: <Newspaper className="w-5 h-5" />,
    color: 'from-orange-500 to-red-500',
    description: 'React to breaking news faster than the market. When news breaks that affects a prediction market outcome, trade before prices fully adjust.',
    howItWorks: [
      'Monitor news feeds (NewsAPI, Twitter, RSS)',
      'Match news keywords to active prediction markets',
      'Analyze sentiment and likely market impact',
      'Execute trades within minutes of news breaking',
      'Set stop-losses to manage risk',
    ],
    keyPoints: [
      'Speed critical - Minutes matter, not hours',
      'Interpretation risk - News impact can be misread',
      'High reward - Can capture 10-50% moves',
      'Keyword matching - Link news to relevant markets',
      'Short holding period - Exit when market adjusts',
    ],
    configParams: [
      { name: 'news_min_spread_pct', default: '5.0', description: 'Min price move to trade' },
      { name: 'news_max_lag_minutes', default: '30', description: 'Max time since news' },
      { name: 'news_position_size_usd', default: '100', description: 'Conservative sizing' },
    ],
    requiredCredentials: [
      'NEWS_API_KEY - NewsAPI.org',
      'TWITTER_BEARER_TOKEN - Twitter API (optional)',
      'Trading platform credentials',
    ],
  },
  {
    id: 'copy_trading',
    name: 'Copy Trading',
    confidence: 70,
    expectedApy: '20-50%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-5 h-5" />,
    color: 'from-indigo-500 to-violet-500',
    description: 'Automatically copy trades from successful "whale" traders. Leverage their research and conviction by mirroring their positions at a configurable scale.',
    howItWorks: [
      'Monitor specified wallet addresses for new positions',
      'Detect when a tracked trader opens a position',
      'Calculate your position size (e.g., 10% of their size)',
      'Execute the same trade with slight delay',
      'Track performance vs original trader',
    ],
    keyPoints: [
      'Whale following - Copy traders with proven track records',
      'Transparent data - Polymarket trades are on-chain',
      'Configurable scale - Set your copy multiplier',
      'Delay inherent - You trade after them',
      'Address curation - Finding good traders is key',
    ],
    configParams: [
      { name: 'max_copy_size', default: '100', description: 'Max position size to copy' },
      { name: 'min_copy_size', default: '5', description: 'Min position to trigger copy' },
      { name: 'copy_multiplier', default: '0.1', description: '10% of whale size' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
      'List of whale addresses to track',
    ],
  },
  // ========== STOCK STRATEGIES ==========
  {
    id: 'stock_mean_reversion',
    name: 'Stock Mean Reversion',
    confidence: 70,
    expectedApy: '10-25%',
    riskLevel: 'medium',
    category: 'stocks',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-emerald-500 to-green-500',
    description: 'Trade stocks that have deviated significantly from their historical average price, expecting them to revert back to the mean. Buy oversold stocks, sell overbought stocks.',
    howItWorks: [
      'Calculate 20-day moving average for each stock',
      'Compute standard deviation from the mean',
      'Calculate z-score: (current price - mean) / std_dev',
      'If z-score < -2: Buy (oversold)',
      'If z-score > +2: Short or sell (overbought)',
      'Exit when z-score returns to ±0.5',
    ],
    keyPoints: [
      'Statistical basis - Prices tend to revert to mean',
      'Works best on range-bound stocks',
      'Avoid trending stocks - can lose money if trend continues',
      'Requires liquid, large-cap stocks for reliable patterns',
      'Paper trading recommended to validate signals',
    ],
    configParams: [
      { name: 'stock_mean_reversion_lookback_days', default: '20', description: 'Lookback period for mean' },
      { name: 'stock_mean_reversion_entry_zscore', default: '2.0', description: 'Enter when |z| > 2' },
      { name: 'stock_mean_reversion_exit_zscore', default: '0.5', description: 'Exit when |z| < 0.5' },
      { name: 'stock_mean_reversion_max_position_usd', default: '1000', description: 'Max per position' },
    ],
    requiredCredentials: [
      'ALPACA_PAPER_API_KEY + ALPACA_PAPER_API_SECRET',
      'Or ALPACA_LIVE_API_KEY + ALPACA_LIVE_API_SECRET for live trading',
    ],
  },
  {
    id: 'stock_momentum',
    name: 'Stock Momentum',
    confidence: 65,
    expectedApy: '15-40%',
    riskLevel: 'medium',
    category: 'stocks',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-blue-500 to-indigo-500',
    description: 'Follow the trend - buy stocks that have been going up, short stocks that have been going down. Momentum strategies are backed by decades of academic research.',
    howItWorks: [
      'Calculate 12-month return for each stock',
      'Rank stocks by momentum (highest to lowest)',
      'Buy top 10% performers (momentum winners)',
      'Optionally short bottom 10% (momentum losers)',
      'Rebalance monthly to capture new momentum',
      'Use stop-losses to protect against reversals',
    ],
    keyPoints: [
      'Academic validation - Momentum premium documented since 1993',
      'Trend following - Winners tend to keep winning',
      'Transaction costs - Frequent trading can erode returns',
      'Crash risk - Momentum can reverse sharply',
      'Best combined with other factors (value, quality)',
    ],
    configParams: [
      { name: 'stock_momentum_lookback_days', default: '252', description: '12-month lookback' },
      { name: 'stock_momentum_top_pct', default: '10', description: 'Buy top 10%' },
      { name: 'stock_momentum_rebalance_days', default: '30', description: 'Monthly rebalance' },
      { name: 'stock_momentum_max_positions', default: '10', description: 'Max concurrent positions' },
    ],
    requiredCredentials: [
      'ALPACA_PAPER_API_KEY + ALPACA_PAPER_API_SECRET',
    ],
    academicRefs: [
      'Jegadeesh & Titman (1993) - Returns to Buying Winners',
      'Carhart Four-Factor Model',
    ],
  },
  {
    id: 'sector_rotation',
    name: 'Sector Rotation',
    confidence: 60,
    expectedApy: '8-20%',
    riskLevel: 'medium',
    category: 'stocks',
    icon: <Repeat className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Rotate capital between sectors based on economic cycle indicators. Different sectors outperform during different phases of the business cycle.',
    howItWorks: [
      'Monitor economic indicators (PMI, yield curve, etc.)',
      'Identify current phase of business cycle',
      'Rotate to sectors that historically outperform in that phase:',
      '- Early cycle: Consumer Discretionary, Financials',
      '- Mid cycle: Technology, Industrials',
      '- Late cycle: Energy, Materials',
      '- Recession: Utilities, Consumer Staples, Healthcare',
    ],
    keyPoints: [
      'Macro-driven - Based on economic cycle',
      'Low turnover - Rotate monthly or quarterly',
      'ETFs preferred - Use sector ETFs for diversification',
      'Lag risk - Cycle transitions can be unpredictable',
      'Defensive allocation - Always have some defensive sectors',
    ],
    configParams: [
      { name: 'sector_rotation_rebalance_days', default: '30', description: 'Monthly rotation' },
      { name: 'sector_rotation_top_sectors', default: '3', description: 'Allocate to top 3 sectors' },
      { name: 'sector_rotation_max_allocation_pct', default: '40', description: 'Max 40% to any sector' },
    ],
    requiredCredentials: [
      'ALPACA_PAPER_API_KEY + ALPACA_PAPER_API_SECRET',
    ],
  },
  {
    id: 'dividend_growth',
    name: 'Dividend Growth',
    confidence: 75,
    expectedApy: '6-12%',
    riskLevel: 'low',
    category: 'stocks',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'from-green-500 to-teal-500',
    description: 'Build a portfolio of companies with consistent dividend growth. Focus on companies that have raised dividends for 10+ consecutive years (Dividend Aristocrats).',
    howItWorks: [
      'Screen for stocks with 10+ years of dividend growth',
      'Filter by dividend yield (2-5% sweet spot)',
      'Check payout ratio (<60% for sustainability)',
      'Verify earnings growth supports dividend growth',
      'Build diversified portfolio across sectors',
      'Reinvest dividends (DRIP) for compounding',
    ],
    keyPoints: [
      'Compounding power - Reinvested dividends compound over time',
      'Quality signal - Consistent dividends signal financial health',
      'Downside protection - Dividends cushion losses',
      'Low volatility - Dividend stocks are typically less volatile',
      'Tax consideration - Qualified dividends taxed at favorable rates',
    ],
    configParams: [
      { name: 'dividend_min_yield_pct', default: '2.0', description: 'Min 2% yield' },
      { name: 'dividend_max_yield_pct', default: '6.0', description: 'Max 6% (avoid traps)' },
      { name: 'dividend_min_growth_years', default: '10', description: '10+ year streak' },
      { name: 'dividend_max_payout_ratio', default: '60', description: 'Max 60% payout' },
    ],
    requiredCredentials: [
      'ALPACA_PAPER_API_KEY + ALPACA_PAPER_API_SECRET',
    ],
    academicRefs: [
      'Dividend Aristocrats Index Performance',
      'Compounding Returns - Rule of 72',
    ],
  },
  {
    id: 'earnings_momentum',
    name: 'Earnings Momentum',
    confidence: 65,
    expectedApy: '15-35%',
    riskLevel: 'high',
    category: 'stocks',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-yellow-500 to-orange-500',
    description: 'Trade around earnings announcements. Stocks that beat earnings estimates tend to continue outperforming (Post-Earnings Announcement Drift - PEAD).',
    howItWorks: [
      'Track upcoming earnings dates',
      'Analyze consensus estimates vs whisper numbers',
      'For pre-earnings: Position based on expected surprise',
      'For post-earnings: Buy beats, sell misses',
      'Capture PEAD - drift continues for ~60 days',
      'Use options for defined risk around events',
    ],
    keyPoints: [
      'PEAD documented - Academic anomaly since 1968',
      'Event-driven - Known catalyst dates',
      'High volatility - Prices can gap significantly',
      'Options can define risk - Limit downside',
      'Analyst revisions - Follow earnings estimate changes',
    ],
    configParams: [
      { name: 'earnings_min_surprise_pct', default: '5.0', description: 'Min 5% beat/miss' },
      { name: 'earnings_hold_days', default: '30', description: 'Hold for PEAD capture' },
      { name: 'earnings_max_position_usd', default: '500', description: 'Max per earnings play' },
    ],
    requiredCredentials: [
      'ALPACA_PAPER_API_KEY + ALPACA_PAPER_API_SECRET',
    ],
    academicRefs: [
      'Ball & Brown (1968) - Post-Earnings Announcement Drift',
      'Bernard & Thomas (1989) - PEAD Evidence',
    ],
  },
  // ========== ADVANCED FRAMEWORK MODULES ==========
  {
    id: 'kelly_criterion',
    name: 'Kelly Criterion Position Sizing',
    confidence: 90,
    expectedApy: 'Risk-adjusted',
    riskLevel: 'low',
    category: 'prediction',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-violet-500 to-purple-500',
    description: 'Mathematically optimal position sizing based on the Kelly Criterion. Calculates the ideal fraction of capital to risk on each trade to maximize long-term geometric growth while accounting for edge and odds.',
    howItWorks: [
      'Calculate edge: probability × (payout + 1) - 1',
      'Apply Kelly formula: f* = edge / odds',
      'Use fractional Kelly (typically 0.25-0.5) for safety',
      'Adjust position size based on confidence level',
      'Scale down during drawdowns automatically',
      'Never risk more than max_position_pct of capital',
    ],
    keyPoints: [
      'Mathematical foundation - Proven optimal for long-term growth',
      'Fractional Kelly - Use 25-50% Kelly to reduce variance',
      'Edge-dependent - Position size scales with edge quality',
      'Drawdown protection - Naturally reduces size after losses',
      'Prevents over-betting - Never risk ruin on any single trade',
    ],
    configParams: [
      { name: 'kelly_enabled', default: 'true', description: 'Enable Kelly sizing' },
      { name: 'kelly_fraction', default: '0.25', description: 'Fractional Kelly (0.25 = quarter Kelly)' },
      { name: 'kelly_max_position_pct', default: '5.0', description: 'Max 5% of capital per trade' },
      { name: 'kelly_min_edge', default: '2.0', description: 'Min 2% edge to trade' },
    ],
    requiredCredentials: [
      'None - Works with all strategies',
    ],
    academicRefs: [
      'Kelly, J.L. (1956) - A New Interpretation of Information Rate',
      'Thorp, E. (2006) - The Kelly Criterion in Practice',
    ],
  },
  {
    id: 'regime_detection',
    name: 'Market Regime Detection',
    confidence: 85,
    expectedApy: 'Adaptive',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <LineChart className="w-5 h-5" />,
    color: 'from-cyan-500 to-blue-500',
    description: 'Automatically detect market regimes (bull, bear, high volatility, low volatility) using VIX, price trends, and volume patterns. Adapt strategy parameters based on current market conditions.',
    howItWorks: [
      'Monitor VIX levels (< 20 low vol, > 30 high vol)',
      'Calculate 20-day price momentum for trend detection',
      'Analyze volume patterns for confirmation',
      'Classify regime: BULL, BEAR, HIGH_VOL, LOW_VOL, CRISIS',
      'Auto-adjust position sizes and stop-losses per regime',
      'Reduce risk during HIGH_VOL and CRISIS regimes',
    ],
    keyPoints: [
      'VIX-based - Industry standard fear gauge',
      'Multi-factor - Combines price, volume, volatility',
      'Adaptive - Strategy adjusts to market conditions',
      'Risk reduction - Automatically de-risks in volatile markets',
      'Regime persistence - Assumes regimes persist (momentum)',
    ],
    configParams: [
      { name: 'regime_enabled', default: 'true', description: 'Enable regime detection' },
      { name: 'vix_low', default: '15', description: 'VIX below = low volatility' },
      { name: 'vix_high', default: '25', description: 'VIX above = high volatility' },
      { name: 'vix_crisis', default: '35', description: 'VIX above = crisis mode' },
      { name: 'regime_lookback_days', default: '20', description: 'Days for trend calculation' },
    ],
    requiredCredentials: [
      'FINNHUB_API_KEY - For real-time VIX data',
    ],
    academicRefs: [
      'Hamilton (1989) - Regime-Switching Models',
      'Ang & Bekaert (2002) - Regime Switches in Interest Rates',
    ],
  },
  {
    id: 'circuit_breaker',
    name: 'Circuit Breaker System',
    confidence: 95,
    expectedApy: 'Protection',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Shield className="w-5 h-5" />,
    color: 'from-red-500 to-orange-500',
    description: 'Risk management system that halts trading when drawdowns exceed thresholds. Implements daily, weekly, and all-time circuit breakers to prevent catastrophic losses.',
    howItWorks: [
      'Track P&L in real-time (daily, weekly, all-time)',
      'Compare current drawdown to configured limits',
      'If daily loss > 5%: Pause for 1 hour (Level 1)',
      'If daily loss > 10%: Halt for rest of day (Level 2)',
      'If weekly loss > 15%: Halt for rest of week (Level 3)',
      'Manual override available for experienced traders',
    ],
    keyPoints: [
      'Prevents tilt trading - Stops after losing streaks',
      'Tiered levels - Graduated response to drawdown severity',
      'Auto-recovery - Resumes trading after pause period',
      'Capital preservation - Primary goal is survival',
      'Exchange-inspired - Based on NYSE/CME circuit breakers',
    ],
    configParams: [
      { name: 'circuit_breaker_enabled', default: 'true', description: 'Enable circuit breakers' },
      { name: 'max_daily_loss_pct', default: '5.0', description: 'Max 5% daily loss' },
      { name: 'max_weekly_loss_pct', default: '10.0', description: 'Max 10% weekly loss' },
      { name: 'max_drawdown_pct', default: '20.0', description: 'Max 20% total drawdown' },
      { name: 'cooldown_minutes', default: '60', description: 'Pause duration after trigger' },
    ],
    requiredCredentials: [
      'None - Works with all strategies',
    ],
  },
  {
    id: 'time_decay',
    name: 'Time Decay Analysis',
    confidence: 80,
    expectedApy: 'Variable',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Target className="w-5 h-5" />,
    color: 'from-amber-500 to-yellow-500',
    description: 'Analyze how prediction market prices should move as events approach expiration. Markets often misprice time decay, creating opportunities as resolution nears.',
    howItWorks: [
      'Calculate time remaining until market resolution',
      'Estimate fair value decay curve based on uncertainty',
      'Compare current price to theoretical decay curve',
      'If price < fair value: Opportunity to buy',
      'If price > fair value: Opportunity to short',
      'Adjust position size based on time remaining',
    ],
    keyPoints: [
      'Options-inspired - Based on theta decay concepts',
      'Time premium - Markets often overprice uncertainty',
      'Accelerating decay - Value converges faster near expiry',
      'Binary outcomes - Different from options (only 0 or 1)',
      'Information arrival - News can shift fair value suddenly',
    ],
    configParams: [
      { name: 'time_decay_enabled', default: 'true', description: 'Enable time decay analysis' },
      { name: 'min_hours_to_expiry', default: '24', description: 'Min 24h to expiry' },
      { name: 'max_hours_to_expiry', default: '720', description: 'Max 30 days to expiry' },
      { name: 'decay_model', default: 'linear', description: 'Decay model (linear/exponential)' },
    ],
    requiredCredentials: [
      'None - Works with all prediction market strategies',
    ],
  },
  {
    id: 'order_flow',
    name: 'Order Flow Analysis',
    confidence: 70,
    expectedApy: '10-30%',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-green-500 to-teal-500',
    description: 'Analyze order book depth, trade flow, and whale activity to predict short-term price movements. Large buy/sell imbalances often precede price moves.',
    howItWorks: [
      'Monitor order book depth (bid/ask sizes)',
      'Track trade tape (buyer vs seller initiated)',
      'Calculate buy/sell imbalance ratio',
      'Detect large orders (whale activity)',
      'Signal when imbalance exceeds threshold (e.g., 60/40)',
      'Trade in direction of flow momentum',
    ],
    keyPoints: [
      'Leading indicator - Order flow precedes price',
      'Whale tracking - Large orders move markets',
      'Spoofing risk - Some large orders are fake',
      'Exchange-specific - Data varies by platform',
      'Short-term focus - Best for scalping/day trading',
    ],
    configParams: [
      { name: 'order_flow_enabled', default: 'true', description: 'Enable order flow analysis' },
      { name: 'min_imbalance_pct', default: '60', description: 'Min 60/40 imbalance' },
      { name: 'whale_threshold_usd', default: '50000', description: 'Whale order size' },
      { name: 'depth_levels', default: '10', description: 'Order book depth levels' },
    ],
    requiredCredentials: [
      'Exchange WebSocket access for real-time order book',
    ],
    academicRefs: [
      'Kyle (1985) - Continuous Auctions and Insider Trading',
      'Easley & O\'Hara - Market Microstructure',
    ],
  },
  {
    id: 'depeg_detection',
    name: 'Stablecoin Depeg Detection',
    confidence: 75,
    expectedApy: '5-50% per event',
    riskLevel: 'high',
    category: 'crypto',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'from-rose-500 to-red-500',
    description: 'Monitor stablecoin pegs and trade depeg events. When stablecoins like USDC, USDT, or DAI trade below $1.00, there are often opportunities to buy the dip or arbitrage.',
    howItWorks: [
      'Monitor stablecoin prices across exchanges',
      'Alert when price deviates > 0.5% from $1.00',
      'Analyze cause: technical glitch vs fundamental issue',
      'For minor depegs: Buy the dip, sell at $1.00',
      'For major depegs: Trade prediction markets on repeg',
      'Set stop-losses for worst-case scenarios',
    ],
    keyPoints: [
      'High risk/reward - Can make 5-50% on recovery',
      'Due diligence critical - Not all depegs recover',
      'USDC March 2023 - Dropped to $0.87, recovered in days',
      'UST May 2022 - Death spiral, never recovered',
      'Speed matters - Best prices in first minutes',
    ],
    configParams: [
      { name: 'depeg_enabled', default: 'true', description: 'Enable depeg detection' },
      { name: 'depeg_alert_threshold', default: '0.5', description: 'Alert at 0.5% deviation' },
      { name: 'depeg_trade_threshold', default: '2.0', description: 'Trade at 2% deviation' },
      { name: 'monitored_stables', default: 'USDC,USDT,DAI', description: 'Stablecoins to monitor' },
    ],
    requiredCredentials: [
      'Exchange API for price feeds',
      'Capital ready on multiple exchanges',
    ],
  },
  {
    id: 'correlation_limits',
    name: 'Correlation Position Limits',
    confidence: 85,
    expectedApy: 'Risk-adjusted',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Grid3X3 className="w-5 h-5" />,
    color: 'from-indigo-500 to-blue-500',
    description: 'Manage portfolio-level risk by limiting exposure to correlated positions. Prevents concentration in similar trades that would all lose together.',
    howItWorks: [
      'Calculate pairwise correlation between all positions',
      'Group positions by correlation (> 0.7 = same group)',
      'Limit total exposure per correlation group',
      'Reduce new position sizes if group limit reached',
      'Prefer uncorrelated positions for diversification',
      'Rebalance when correlations shift significantly',
    ],
    keyPoints: [
      'Diversification - Reduces portfolio variance',
      'Correlation clusters - Similar bets lose together',
      'Dynamic adjustment - Correlations change over time',
      'Maximum diversification - Aim for uncorrelated alpha',
      'Risk parity inspired - Equal risk contribution goal',
    ],
    configParams: [
      { name: 'correlation_limit_enabled', default: 'true', description: 'Enable correlation limits' },
      { name: 'correlation_threshold', default: '0.7', description: 'Group at 70% correlation' },
      { name: 'max_correlated_exposure_pct', default: '20.0', description: 'Max 20% in correlated group' },
      { name: 'correlation_lookback_days', default: '30', description: 'Days for correlation calc' },
    ],
    requiredCredentials: [
      'None - Works with all strategies',
    ],
    academicRefs: [
      'Markowitz (1952) - Portfolio Selection',
      'Risk Parity - Bridgewater All Weather',
    ],
  },
  // ========== TWITTER-DERIVED STRATEGIES (2024) ==========
  {
    id: 'whale_copy_trading',
    name: 'Whale Copy Trading',
    confidence: 75,
    expectedApy: '25-50%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-5 h-5" />,
    color: 'from-cyan-500 to-blue-500',
    description: 'Track and copy trades from high win-rate whale wallets on Polymarket. Leverage their research edge by mirroring their on-chain positions with configurable delay and sizing.',
    howItWorks: [
      'Auto-discover whales from Polymarket leaderboard',
      'Track wallet activity via on-chain monitoring',
      'Filter whales by win rate (65%+ recommended)',
      'Detect new positions in real-time',
      'Copy trade with configurable delay (to confirm conviction)',
      'Scale position size to your bankroll (typically 10% of whale)',
    ],
    keyPoints: [
      'Information edge - Whales have research/insider knowledge',
      'On-chain transparency - All Polymarket trades are public',
      'Proven track records - Track wallets with verified history',
      'Delayed entry - Copy after whale confirms position',
      'Diversification - Track multiple whales to spread risk',
    ],
    configParams: [
      { name: 'enable_whale_copy_trading', default: 'true', description: 'Enable whale copy trading' },
      { name: 'whale_copy_min_win_rate', default: '80', description: 'Min 80% win rate to follow' },
      { name: 'whale_copy_delay_seconds', default: '30', description: 'Delay before copying' },
      { name: 'whale_copy_max_size_usd', default: '50', description: 'Max per copy trade' },
      { name: 'whale_copy_max_concurrent', default: '5', description: 'Max concurrent copies' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
      'List of whale addresses (auto-discovered from leaderboard)',
    ],
    academicRefs: [
      'Social Trading - MIT Sloan Research',
      'Information Cascades in Financial Markets',
    ],
  },
  {
    id: 'congressional_tracker',
    name: 'Congressional Tracker',
    confidence: 70,
    expectedApy: '15-40%',
    riskLevel: 'medium',
    category: 'stocks',
    icon: <Users className="w-5 h-5" />,
    color: 'from-amber-500 to-yellow-500',
    description: 'Copy stock trades made by members of Congress. Under the STOCK Act, Congress members must disclose trades within 45 days. Studies show they outperform the S&P 500 by ~12% annually.',
    howItWorks: [
      'Fetch trades from House/Senate Stock Watcher APIs (free)',
      'Filter by tracked politicians, party, or chamber',
      'Analyze trade size ($1K-$50M+ ranges disclosed)',
      'Calculate copy size based on your bankroll scaling',
      'Execute trades via Alpaca or your broker',
      'Track performance per politician over time',
    ],
    keyPoints: [
      'Information edge - Congress has briefings & legislation knowledge',
      'STOCK Act - Required 45-day disclosure creates lag opportunity',
      'Public data - Free APIs from House/Senate Stock Watcher',
      'Track record - Studies show 12%+ annual outperformance',
      'Selective following - Some politicians perform better than others',
    ],
    configParams: [
      { name: 'enable_congressional_tracker', default: 'true', description: 'Enable congressional tracking' },
      { name: 'congress_chambers', default: 'both', description: 'house, senate, or both' },
      { name: 'congress_parties', default: 'any', description: 'D, R, I, or any' },
      { name: 'congress_copy_scale_pct', default: '10', description: '% of their trade to copy' },
      { name: 'congress_max_position_usd', default: '500', description: 'Max per copy trade' },
      { name: 'congress_min_trade_amount_usd', default: '15000', description: 'Min politician trade' },
      { name: 'congress_tracked_politicians', default: 'Nancy Pelosi,Tommy Tuberville', description: 'Names to track' },
    ],
    requiredCredentials: [
      'ALPACA_API_KEY + ALPACA_API_SECRET (paper or live)',
      'No API keys needed for congressional data (public)',
    ],
    academicRefs: [
      'Capitol Assets - Partisan Politics and Wealth Inequality',
      'Unusual Whales - Congressional Trading Analysis',
      'STOCK Act (2012) - Stop Trading on Congressional Knowledge Act',
    ],
  },
  {
    id: 'btc_bracket_arb',
    name: 'BTC Bracket Arbitrage',
    confidence: 85,
    expectedApy: '50-200%',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Target className="w-5 h-5" />,
    color: 'from-orange-500 to-amber-500',
    description: 'Exploit mispricings in Bitcoin price bracket markets. Buy YES + NO on the same bracket when combined < $1.00 for guaranteed profit regardless of where BTC settles.',
    howItWorks: [
      'Scan BTC price bracket markets (e.g., "BTC between $90K-$95K")',
      'For each bracket, calculate YES + NO combined price',
      'If combined < $1.00 (e.g., $0.995), arbitrage exists',
      'Buy both YES and NO at current prices',
      'One side will settle at $1.00, covering both costs + profit',
      'High-frequency: New opportunities appear with price volatility',
    ],
    keyPoints: [
      'Guaranteed profit - No directional risk',
      'Market inefficiency - Bracket markets often misprice',
      'Polymarket advantage - 0% fees mean tiny spreads work',
      'Scalable - Can run multiple brackets simultaneously',
      'Twitter-proven - Top traders make $20K-200K/month on this',
    ],
    configParams: [
      { name: 'enable_btc_bracket_arb', default: 'true', description: 'Enable BTC bracket arb' },
      { name: 'btc_bracket_min_discount_pct', default: '0.5', description: 'Min 0.5% discount' },
      { name: 'btc_bracket_max_position_usd', default: '50', description: 'Max per bracket' },
      { name: 'btc_bracket_scan_interval_sec', default: '15', description: 'Scan frequency' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
    ],
  },
  {
    id: 'fear_premium_contrarian',
    name: 'Fear Premium Contrarian',
    confidence: 70,
    expectedApy: '25-60%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-red-500 to-pink-500',
    description: 'Trade against extreme market sentiment. When fear pushes prices to extremes (<15¢ or >85¢), fade the crowd and bet on mean reversion. Based on 91.4% win rate analysis.',
    howItWorks: [
      'Monitor all prediction markets for extreme prices',
      'Identify markets where fear/greed has overreacted',
      'Calculate "fear premium" - deviation from fair value',
      'When price < 15¢: Market overly pessimistic, buy YES',
      'When price > 85¢: Market overly optimistic, buy NO',
      'Exit when price reverts toward 50¢ (fair value)',
    ],
    keyPoints: [
      'Contrarian edge - Markets overreact to news',
      'Mean reversion - Extreme prices tend to normalize',
      '91.4% historical win rate - Based on backtesting',
      'Patience required - Wait for extreme setups only',
      'Risk management - Always use position limits',
    ],
    configParams: [
      { name: 'enable_fear_premium_contrarian', default: 'true', description: 'Enable fear premium' },
      { name: 'fear_extreme_low_threshold', default: '0.15', description: 'Buy YES below 15¢' },
      { name: 'fear_extreme_high_threshold', default: '0.85', description: 'Buy NO above 85¢' },
      { name: 'fear_min_premium_pct', default: '10', description: 'Min premium required' },
      { name: 'fear_max_position_usd', default: '200', description: 'Max per position' },
    ],
    requiredCredentials: [
      'Polymarket or Kalshi credentials',
    ],
    academicRefs: [
      'Behavioral Finance - Overreaction Hypothesis',
      'DeBondt & Thaler (1985) - Stock Market Overreaction',
    ],
  },
  {
    id: 'macro_board',
    name: 'Macro Board Strategy',
    confidence: 65,
    expectedApy: '30-100%',
    riskLevel: 'high',
    category: 'prediction',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-emerald-500 to-green-500',
    description: 'Build a portfolio of high-conviction macro event bets. Heavy weighted exposure to Fed decisions, elections, and geopolitical events with systematic rebalancing.',
    howItWorks: [
      'Research macro events with high conviction outcomes',
      'Assign conviction scores (50-100) to each thesis',
      'Allocate capital weighted by conviction score',
      'Monitor and rebalance as new information arrives',
      'Scale up positions as resolution approaches',
      'Exit positions at target prices or resolution',
    ],
    keyPoints: [
      'Directional bets - Taking informed positions on outcomes',
      'Research edge - Deep analysis of macro events',
      'High variance - Can have big wins and losses',
      'Portfolio approach - Multiple bets diversify risk',
      '$62K/month potential - Based on top trader analysis',
    ],
    configParams: [
      { name: 'enable_macro_board', default: 'true', description: 'Enable macro board' },
      { name: 'macro_max_exposure_usd', default: '5000', description: 'Max total exposure' },
      { name: 'macro_min_conviction_score', default: '70', description: 'Min conviction to enter' },
      { name: 'macro_rebalance_interval_hours', default: '24', description: 'Rebalance frequency' },
    ],
    requiredCredentials: [
      'Polymarket or Kalshi credentials',
      'Capital for multiple concurrent positions',
    ],
  },
  {
    id: 'crypto_15min_scalping',
    name: '15-Min Crypto Scalping',
    confidence: 90,
    expectedApy: '50-200%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-yellow-400 to-orange-500',
    description: 'High-frequency scalping on 15-minute BTC/ETH binary option markets. Based on Twitter analysis showing $956→$208K success. Uses Kelly Criterion for optimal sizing.',
    howItWorks: [
      'Scan for "BTC up/down in 15 min" markets on Polymarket',
      'Look for YES prices below entry threshold (default 45¢)',
      'Calculate Kelly-optimal position size based on win rate',
      'Execute trade with ultra-fast 2-second scan intervals',
      'Wait for 15-minute resolution',
      'Profit when direction prediction is correct',
    ],
    keyPoints: [
      'Twitter proven - $956 to $208K documented success',
      'Kelly sizing - Optimal bet sizing for geometric growth',
      'High frequency - 2-second scans catch opportunities',
      'BTC/ETH focus - Most liquid crypto binary markets',
      'Quick resolution - 15-minute timeframe means rapid feedback',
    ],
    configParams: [
      { name: 'enable_15min_crypto_scalping', default: 'false', description: 'Enable 15-min scalping' },
      { name: 'crypto_scalp_entry_threshold', default: '0.45', description: 'Buy when YES < 45¢' },
      { name: 'crypto_scalp_max_position_usd', default: '100', description: 'Max position per trade' },
      { name: 'crypto_scalp_scan_interval_sec', default: '2', description: 'Ultra-fast 2-second scans' },
      { name: 'crypto_scalp_kelly_fraction', default: '0.25', description: 'Quarter-Kelly for safety' },
    ],
    requiredCredentials: [
      'Polymarket credentials (WALLET_ADDRESS, PRIVATE_KEY)',
    ],
    academicRefs: [
      'Kelly (1956) - A New Interpretation of Information Rate',
      'Thorp (2006) - The Kelly Criterion in Blackjack and Sports Betting',
    ],
  },
  {
    id: 'ai_superforecasting',
    name: 'AI Superforecasting',
    confidence: 85,
    expectedApy: '30-60%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-purple-500 to-violet-500',
    description: 'Gemini-powered AI analysis of prediction market questions. Trades when AI probability estimate diverges significantly from market consensus. Based on BlackSky bot architecture.',
    howItWorks: [
      'Fetch active markets from Polymarket',
      'Send market questions to Gemini for probability estimation',
      'Gemini uses base rates, factor analysis, and reasoning',
      'Compare AI estimate to current market price',
      'If divergence > 10%, potential trade opportunity',
      'Execute trade on side AI favors more than market',
    ],
    keyPoints: [
      'AI edge - Large language models can spot mispricings',
      'Calibration - AI trained for probability estimation',
      'Base rates - AI considers historical frequencies',
      'Factor analysis - AI weighs relevant considerations',
      'Divergence threshold - Only trade significant disagreements',
    ],
    configParams: [
      { name: 'enable_ai_superforecasting', default: 'false', description: 'Enable AI forecasting' },
      { name: 'ai_model', default: 'gemini-1.5-flash', description: 'Gemini model to use' },
      { name: 'ai_min_divergence_pct', default: '10', description: 'Min divergence to trade' },
      { name: 'ai_min_confidence', default: '0.65', description: 'Min AI confidence required' },
      { name: 'ai_max_position_usd', default: '100', description: 'Max position per trade' },
    ],
    requiredCredentials: [
      'GEMINI_API_KEY - Google Gemini API key',
      'Polymarket credentials',
    ],
    academicRefs: [
      'Tetlock (2015) - Superforecasting',
      'Silver (2012) - The Signal and the Noise',
    ],
  },
];

const riskColors = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function DocsPage() {
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredDocs = filterCategory 
    ? STRATEGY_DOCS.filter(s => s.category === filterCategory)
    : STRATEGY_DOCS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            Strategy Documentation
          </h1>
          <p className="text-gray-400 mt-1">
            Complete reference for all trading strategies, parameters, and requirements
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-lg transition-all ${
              !filterCategory ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All ({STRATEGY_DOCS.length})
          </button>
          <button
            onClick={() => setFilterCategory('prediction')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'prediction' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🎯 Prediction ({STRATEGY_DOCS.filter(s => s.category === 'prediction').length})
          </button>
          <button
            onClick={() => setFilterCategory('crypto')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'crypto' ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ₿ Crypto ({STRATEGY_DOCS.filter(s => s.category === 'crypto').length})
          </button>
          <button
            onClick={() => setFilterCategory('stocks')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'stocks' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            📈 Stocks ({STRATEGY_DOCS.filter(s => s.category === 'stocks').length})
          </button>
        </div>
      </div>

      {/* Summary Table */}
      <div className="card p-4 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4">Strategy Comparison</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="pb-3 pr-4">Strategy</th>
              <th className="pb-3 pr-4">Confidence</th>
              <th className="pb-3 pr-4">Expected APY</th>
              <th className="pb-3 pr-4">Risk</th>
              <th className="pb-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGY_DOCS.map((strategy) => (
              <tr 
                key={strategy.id} 
                className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setExpandedStrategy(expandedStrategy === strategy.id ? null : strategy.id)}
              >
                <td className="py-3 pr-4 font-medium">{strategy.name}</td>
                <td className="py-3 pr-4">
                  <span className="text-green-400 font-bold">{strategy.confidence}%</span>
                </td>
                <td className="py-3 pr-4 text-blue-400">{strategy.expectedApy}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${riskColors[strategy.riskLevel].bg} ${riskColors[strategy.riskLevel].text}`}>
                    {strategy.riskLevel}
                  </span>
                </td>
                <td className="py-3">
                  {strategy.category === 'prediction' ? '🎯' : strategy.category === 'crypto' ? '₿' : '📈'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Strategy Details */}
      <div className="space-y-4">
        {filteredDocs.map((strategy) => (
          <motion.div
            key={strategy.id}
            initial={false}
            className="card overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedStrategy(expandedStrategy === strategy.id ? null : strategy.id)}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-r ${strategy.color}`}>
                  {strategy.icon}
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{strategy.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="text-green-400">{strategy.confidence}% confidence</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-blue-400">{strategy.expectedApy} APY</span>
                    <span className="text-gray-500">•</span>
                    <span className={`px-2 py-0.5 rounded-full ${riskColors[strategy.riskLevel].bg} ${riskColors[strategy.riskLevel].text}`}>
                      {strategy.riskLevel} risk
                    </span>
                  </div>
                </div>
              </div>
              {expandedStrategy === strategy.id ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
              {expandedStrategy === strategy.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-gray-700"
                >
                  <div className="p-5 space-y-6">
                    {/* Description */}
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Description
                      </h4>
                      <p className="text-gray-300 leading-relaxed">{strategy.description}</p>
                    </div>

                    {/* How It Works */}
                    <div>
                      <h4 className="font-bold text-purple-400 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        How It Works
                      </h4>
                      <ol className="space-y-2">
                        {strategy.howItWorks.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 bg-purple-500/30 text-purple-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-gray-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Key Points */}
                    <div>
                      <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Key Points
                      </h4>
                      <ul className="space-y-2">
                        {strategy.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300">
                            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Configuration Parameters */}
                      <div>
                        <h4 className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Configuration Parameters
                        </h4>
                        <div className="bg-gray-900/50 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <tbody>
                              {strategy.configParams.map((param, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-gray-800/30' : ''}>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{param.name}</td>
                                  <td className="px-3 py-2 text-right font-mono text-yellow-400">{param.default}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Required Credentials */}
                      <div>
                        <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Required Credentials
                        </h4>
                        <ul className="space-y-2">
                          {strategy.requiredCredentials.map((cred, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              {cred}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Academic References */}
                    {strategy.academicRefs && (
                      <div>
                        <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Academic References
                        </h4>
                        <ul className="space-y-1">
                          {strategy.academicRefs.map((ref, i) => (
                            <li key={i} className="text-gray-400 text-sm italic">
                              • {ref}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-gray-700">
                      <Link
                        href="/secrets"
                        className="flex-1 bg-purple-600 hover:bg-purple-700 py-2.5 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Configure API Keys
                      </Link>
                      <Link
                        href="/settings"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Enable Strategy
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Additional Resources */}
      <div className="card p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <ExternalLink className="text-blue-400" />
          Additional Resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/workflows"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Workflow Diagrams</div>
            <div className="text-sm text-gray-400">Visual flowcharts of all strategies</div>
          </Link>
          <a 
            href="https://github.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Source Code</div>
            <div className="text-sm text-gray-400">View strategy implementations</div>
          </a>
          <Link 
            href="/analytics"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Performance Analytics</div>
            <div className="text-sm text-gray-400">Track strategy performance</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
