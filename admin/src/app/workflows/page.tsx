'use client';

import { useState, useEffect } from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  ArrowDown,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  BarChart3,
  LineChart,
  Grid3X3,
  Repeat,
  Newspaper,
  Users,
  Wallet,
  Shield,
  Clock,
  DollarSign,
  Activity,
  Target,
  BookOpen,
  Flame,
  Globe,
  Brain,
  AlertCircle,
  Landmark,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Strategy {
  id: string;
  name: string;
  confidence: number;
  expectedApy: string;
  description: string;
  keyPoints: string[];
  platforms: string[];
  riskLevel: 'low' | 'medium' | 'high';
  category: 'prediction' | 'crypto' | 'stock' | 'framework';
  icon: JSX.Element;
  color: string;
  requirements: string[];
  workflow: string[];
  configKey?: string;
  emoji?: string;
}

// =============================================================================
// STRATEGIES SORTED BY CONFIDENCE % (HIGHEST FIRST)
// Display order: Top-left to right, then down
// =============================================================================
const STRATEGIES: Strategy[] = [
  // ===== 95% CONFIDENCE =====
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    confidence: 95,
    expectedApy: '50-200%',
    description: 'Exploit mispricings within a single prediction market by buying YES + NO when combined price < $1.00. Guaranteed profit on resolution.',
    keyPoints: [
      'Zero directional risk - you profit regardless of outcome',
      'Works when YES + NO < 100% (rare but happens)',
      'Polymarket has 0% fees - pure profit',
      'Kalshi has 7% fees - need larger spreads',
      'Academic research shows $40M extracted in 1 year',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Target className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    requirements: [
      'Polymarket wallet address & private key',
      'Kalshi API key & private key (optional)',
      'USDC balance on Polygon network',
    ],
    workflow: [
      'Scan all active markets every 60 seconds',
      'Calculate YES + NO total for each market',
      'If total < threshold (e.g., 99.5%), flag opportunity',
      'Execute buy orders for both outcomes',
      'Wait for market resolution',
      'Collect guaranteed profit',
    ],
    configKey: 'enable_polymarket_single_arb',
  },
  {
    id: 'circuit_breaker',
    name: 'Circuit Breaker System',
    confidence: 95,
    expectedApy: 'Risk Protection',
    description: 'Risk management system that halts trading when drawdowns exceed thresholds. Prevents catastrophic losses during losing streaks.',
    keyPoints: [
      'Level 1: 3% daily loss → reduce size 50%',
      'Level 2: 5% daily loss → reduce size 75%',
      'Level 3: 10% daily loss → HALT trading',
      'Auto-recovery after cooldown period',
      'Inspired by NYSE/CME circuit breakers',
    ],
    platforms: ['All strategies'],
    riskLevel: 'low',
    category: 'framework',
    icon: <Shield className="w-6 h-6" />,
    color: 'from-red-500 to-orange-500',
    requirements: [
      'Real-time P&L tracking',
      'Works with any trading strategy',
    ],
    workflow: [
      'Track P&L in real-time',
      'Calculate daily/weekly drawdowns',
      'If daily loss > 3%: Level 1 trigger',
      'If daily loss > 5%: Level 2 trigger',
      'If daily loss > 10%: Level 3 HALT',
      'Auto-resume after cooldown expires',
    ],
    configKey: 'circuit_breaker_enabled',
  },

  // ===== 90% CONFIDENCE =====
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    confidence: 90,
    expectedApy: '30-100%',
    description: 'Exploit price differences between Polymarket and Kalshi for the same event. Buy low on one platform, sell high on another.',
    keyPoints: [
      'Same event can have different prices on different platforms',
      'Buy YES on cheaper platform, buy NO on expensive platform',
      'Asymmetric thresholds: Buy Poly needs lower spread (0% fees)',
      'Requires matching events across platforms',
      'Settlement timing must align',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Repeat className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
    requirements: [
      'Polymarket wallet + private key',
      'Kalshi API credentials',
      'Capital on both platforms',
    ],
    workflow: [
      'Fetch markets from both platforms',
      'Match similar events using fuzzy matching',
      'Compare YES prices: Poly vs Kalshi',
      'Calculate spread after fees (7% Kalshi)',
      'If spread > threshold, execute cross-trade',
      'Monitor both positions until resolution',
    ],
    configKey: 'enable_cross_platform_arb',
  },
  {
    id: 'polymarket_liquidation',
    name: 'Liquidation (Capital Recycling)',
    confidence: 90,
    expectedApy: 'Boosted IRR',
    description: 'Sell winning positions early (e.g. at 99¢) to free up capital for new high-yield opportunities. Maximizes velocity of money.',
    keyPoints: [
      'Recycles "dead" capital locked in winning bets',
      'Sells at 98-99¢ instead of waiting for $1.00',
      'Reinvests into new 50-100% opportunities',
      'Significantly boosts annualized returns (IRR)',
      'Automated portfolio scanning',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Activity className="w-6 h-6" />,
    color: 'from-emerald-500 to-green-500',
    requirements: [
      'Polymarket portfolio',
      'Positions near $1.00 or $0.00',
    ],
    workflow: [
      'Scan portfolio for locked winning positions',
      'Calculate days to expiry vs current price',
      'If IRR of selling > holding, liquidate',
      'Reallocate capital to high-yield strategies',
    ],
    configKey: 'enable_polymarket_liquidation',
  },
  {
    id: 'kelly_criterion',
    name: 'Kelly Criterion Position Sizing',
    confidence: 90,
    expectedApy: 'Optimized Returns',
    description: 'Mathematically optimal position sizing to maximize long-term growth while managing risk. Uses edge and odds to calculate ideal bet size.',
    keyPoints: [
      'Formula: f* = edge / odds',
      'Use fractional Kelly (25-50%) for safety',
      'Position size scales with edge quality',
      'Naturally reduces size after losses',
      'Prevents over-betting and ruin',
    ],
    platforms: ['All strategies'],
    riskLevel: 'low',
    category: 'framework',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-violet-500 to-purple-500',
    requirements: [
      'Estimate of edge/probability',
      'Works with any trading strategy',
    ],
    workflow: [
      'Calculate edge for opportunity',
      'Apply Kelly formula: f* = edge / odds',
      'Multiply by fractional Kelly (0.25)',
      'Cap at max_position_pct limit',
      'Adjust for current drawdown',
      'Execute with calculated size',
    ],
    configKey: 'kelly_sizing_enabled',
  },

  // ===== 85% CONFIDENCE =====
  {
    id: 'high_conviction',
    name: 'High Conviction Strategy',
    emoji: '🎯',
    confidence: 85,
    expectedApy: '40-80%',
    description: 'Multi-signal convergence strategy that only trades when multiple independent signals align. Combines whale tracking, news sentiment, order flow, and technical analysis for high-probability entries.',
    keyPoints: [
      'Requires 3+ independent signals to align',
      'Uses Kelly Criterion for optimal sizing',
      'Tracks whale movements + news + order flow',
      'Maximum 3 concurrent positions',
      'Higher position sizes (10-15% of portfolio)',
      'Only trades with conviction score > 75%',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Target className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    requirements: [
      'Polymarket wallet + private key',
      'Optional: News API, whale tracking',
      'Multiple data sources recommended',
    ],
    workflow: [
      'Aggregate signals from multiple sources',
      'Calculate conviction score (0-100)',
      'If score > 75% and 3+ signals agree',
      'Apply Kelly Criterion for position size',
      'Execute trade with larger allocation',
      'Monitor until resolution or stop-loss',
    ],
    configKey: 'enable_high_conviction_strategy',
  },
  {
    id: 'regime_detection',
    name: 'Market Regime Detection',
    confidence: 85,
    expectedApy: 'Adaptive',
    description: 'Detect market conditions (bull/bear/high vol/crisis) and automatically adapt strategy parameters for optimal performance.',
    keyPoints: [
      'VIX-based volatility classification',
      'Multi-factor: price, volume, volatility',
      'Automatic risk reduction in volatile markets',
      'Regime persistence (momentum)',
      '5 regimes: BULL, BEAR, HIGH_VOL, LOW_VOL, CRISIS',
    ],
    platforms: ['All crypto & stock strategies'],
    riskLevel: 'medium',
    category: 'framework',
    icon: <LineChart className="w-6 h-6" />,
    color: 'from-cyan-500 to-blue-500',
    requirements: [
      'FINNHUB_API_KEY for VIX data',
      'Works with any trading strategy',
    ],
    workflow: [
      'Fetch current VIX level',
      'Calculate 20-day price momentum',
      'Analyze volume patterns',
      'Classify regime (BULL/BEAR/etc.)',
      'Adjust position sizes per regime',
      'Reduce risk in HIGH_VOL/CRISIS',
    ],
    configKey: 'regime_detection_enabled',
  },
  {
    id: 'btc_bracket_arb',
    name: 'BTC Bracket Arbitrage',
    emoji: '🔥',
    confidence: 85,
    expectedApy: '$20K-200K/month',
    description: 'Exploit mispricings in BTC 15-minute price prediction brackets. Buy YES + NO when combined < $1.00 for guaranteed profit.',
    keyPoints: [
      'Bots making $20K-$200K/month on this strategy',
      'Focus on Polymarket & Kalshi BTC brackets',
      'Scan every 15 seconds for opportunities',
      '0% fees on Polymarket, 7% on Kalshi (adjusted)',
      'Resolution in 15 minutes = fast capital turnover',
      'Academic research: $40M extracted in one year',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Flame className="w-6 h-6" />,
    color: 'from-orange-500 to-yellow-500',
    requirements: [
      'Polymarket wallet + private key',
      'Kalshi API Credentials (optional)',
      'USDC balance on Polygon',
    ],
    workflow: [
      'Scan BTC price bracket markets',
      'Calculate YES + NO combined price',
      'If combined < $0.995, flag opportunity',
      'Buy equal amounts of YES and NO',
      'Wait 15 minutes for resolution',
      'Collect guaranteed profit ($0.005-$0.02/share)',
    ],
    configKey: 'enable_btc_bracket_arb',
  },
  {
    id: 'crypto_15min_scalping',
    name: '15-Min Crypto Scalping',
    emoji: '⚡',
    confidence: 90,
    expectedApy: '50-200%',
    description: 'High-frequency BTC/ETH binary options scalping. Targets 15-minute markets when price < 45¢. Based on Twitter strategy ($956→$208K).',
    keyPoints: [
      'Twitter-proven: @0xReflection made $208K',
      '15-minute expiration windows',
      '45%+ entry threshold with Kelly fraction',
      'Multi-indicator confluence (RSI, VWAP)',
      'Conservative 90% confidence required',
    ],
    platforms: ['Kalshi', 'Polymarket'],
    riskLevel: 'high',
    category: 'prediction',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-yellow-500 to-yellow-600',
    requirements: [
      'Kalshi API or Polymarket Wallet',
      'Real-time BTC/ETH data feed',
      '$50+ starting balance',
    ],
    workflow: [
      'Scan 15-min markets every 2 seconds',
      'Calculate technical indicators',
      'Check entry threshold (< 45¢)',
      'Enter trade with Kelly sizing',
      'Auto-exit at resolution',
    ],
    configKey: 'enable_15min_crypto_scalping',
  },
  {
    id: 'correlation_limits',
    name: 'Correlation Position Limits',
    confidence: 85,
    expectedApy: 'Risk-adjusted',
    description: 'Manage portfolio risk by limiting exposure to correlated positions. Prevents concentration in similar trades.',
    keyPoints: [
      'Groups positions by correlation (>0.7)',
      'Limits exposure per correlation cluster',
      'Reduces portfolio variance',
      'Dynamic correlation tracking',
      'Risk parity inspired approach',
    ],
    platforms: ['All strategies'],
    riskLevel: 'low',
    category: 'framework',
    icon: <Grid3X3 className="w-6 h-6" />,
    color: 'from-indigo-500 to-blue-500',
    requirements: [
      'Position correlation data',
      'Works with any trading strategy',
    ],
    workflow: [
      'Calculate pairwise correlations',
      'Group positions (>70% correlation)',
      'Check group exposure limits',
      'If limit reached: Reduce size',
      'Prefer uncorrelated positions',
      'Rebalance when correlations shift',
    ],
    configKey: 'correlation_limits_enabled',
  },
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    confidence: 85,
    expectedApy: '15-50%',
    description: 'Collect perpetual futures funding payments by holding delta-neutral positions. Long spot + short perp when funding is positive.',
    keyPoints: [
      'Delta-neutral: No directional exposure',
      'Funding paid every 8 hours on most exchanges',
      'BTC funding averages 0.01%/8h = 10.95% APY base',
      'Higher funding during bull markets',
      '⚠️ Requires FUTURES exchange (not Binance US)',
    ],
    platforms: ['Bybit', 'OKX', 'Binance International'],
    riskLevel: 'low',
    category: 'crypto',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'from-yellow-500 to-amber-500',
    requirements: [
      'Exchange API keys (Bybit/OKX - NOT Binance US)',
      'Futures trading enabled',
      'Capital for spot + collateral',
    ],
    workflow: [
      'Scan funding rates across exchanges',
      'Filter for rates > 0.03% (30% APY)',
      'Calculate optimal position size',
      'Buy spot on one exchange',
      'Short perpetual futures (1x leverage)',
      'Collect funding every 8 hours',
      'Exit when funding turns negative',
    ],
    configKey: 'enable_funding_rate_arb',
  },
  {
    id: 'cross_exchange_arb',
    name: 'Cross-Exchange Crypto Arb',
    confidence: 80,
    expectedApy: '10-30%',
    description: 'Classic arbitrage between exchanges (e.g. Binance vs Kraken). Buy BTC on lower price exchange, sell on higher.',
    keyPoints: [
      'Profit from market inefficiencies',
      'Delta neutral - no directional risk',
      'Requires capital on multiple exchanges',
      'Execution speed is critical',
      'Must account for transfer/trading fees',
    ],
    platforms: ['Binance', 'Kraken', 'OKX'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <GitBranch className="w-6 h-6" />,
    color: 'from-teal-500 to-cyan-500',
    requirements: [
      'Accounts on multiple exchanges',
      'USDT/USD liquidity on all',
      'CCXT API Keys',
    ],
    workflow: [
      'Monitor tickers across exchanges',
      'Calculate spread matrix',
      'If spread > fees, execute dual trade',
      'Rebalance funds periodically',
    ],
    configKey: 'enable_cross_exchange_arb',
  },

  // ===== 80% CONFIDENCE =====
  {
    id: 'political_event',
    name: 'Political Event Strategy',
    emoji: '🏛️',
    confidence: 80,
    expectedApy: '30-60%',
    description: 'Trade prediction markets around scheduled political events like elections, hearings, and legislation votes. Enter positions before events and exit based on event timing.',
    keyPoints: [
      'Focus on scheduled events (elections, hearings, votes)',
      'Enter positions 24-48 hours before event',
      'Exit 2+ hours before event resolution',
      'Categories: elections, legislation, hearings',
      'Maximum 5 concurrent event positions',
      'Conviction scoring based on event type + market data',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Landmark className="w-6 h-6" />,
    color: 'from-blue-500 to-indigo-500',
    requirements: [
      'Polymarket wallet + private key',
      'Political calendar data source',
      'Optional: News API for event monitoring',
    ],
    workflow: [
      'Scan for upcoming political events',
      'Calculate conviction score for each',
      'Enter 24-48h before scheduled event',
      'Monitor event progress and news',
      'Exit 2+ hours before resolution',
      'Capture pre-event price movements',
    ],
    configKey: 'enable_political_event_strategy',
  },
  {
    id: 'selective_whale_copy',
    name: 'Selective Whale Copy',
    emoji: '🐋',
    confidence: 80,
    expectedApy: '35-70%',
    description: 'Advanced whale copy trading that automatically selects top-performing wallets based on win rate, ROI, and trade history. Only copies trades from proven performers.',
    keyPoints: [
      'Auto-selects top whales by win rate (>65%)',
      'Minimum ROI filter (>20% historical)',
      'Requires 10+ trades for qualification',
      'Tracks up to 10 elite wallets',
      'Scales position size to 5% of whale size',
      'Maximum $200 per copy position',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-6 h-6" />,
    color: 'from-cyan-500 to-blue-500',
    requirements: [
      'Polymarket wallet + private key',
      'On-chain data access',
      'Whale tracking infrastructure',
    ],
    workflow: [
      'Fetch leaderboard from Polymarket Data API',
      'Filter by win rate > 65%, ROI > 20%',
      'Select top 10 qualifying wallets',
      'Monitor for new positions',
      'Copy trade at 5% of their size',
      'Remove underperforming wallets',
    ],
    configKey: 'enable_selective_whale_copy',
  },
  {
    id: 'kalshi_mention_snipe',
    name: 'Kalshi Mention Sniping',
    emoji: '⚡',
    confidence: 80,
    expectedApy: '$120+/event',
    description: 'Fast execution on resolved mention markets after keyword is said. Slam 99¢ YES contracts when outcome is known.',
    keyPoints: [
      'Real example: +$120.26 profit on single event',
      'Watch SOTU/speeches for word mentions',
      'Once word said, market is resolved',
      'Buy YES at 98-99¢ to capture 1-2¢ spread',
      'Latency critical - milliseconds matter',
    ],
    platforms: ['Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    requirements: [
      'Kalshi API credentials',
      'Low-latency execution infrastructure',
      'Live event monitoring capability',
    ],
    workflow: [
      'Monitor upcoming speech events',
      'Track mention market for keywords',
      'Watch live stream for keyword',
      'Once mentioned, execute buy immediately',
      'Buy YES at 98-99¢ market price',
      'Hold until resolution for guaranteed profit',
    ],
    configKey: 'enable_kalshi_mention_snipe',
  },
  {
    id: 'time_decay',
    name: 'Time Decay Analysis',
    confidence: 80,
    expectedApy: 'Variable',
    description: 'Analyze how prediction market prices should move as events approach expiration. Identify mispricings in time decay.',
    keyPoints: [
      'Options-inspired theta decay concepts',
      'Markets often overprice uncertainty',
      'Value converges faster near expiry',
      'Binary outcomes differ from options',
      'Information arrival shifts fair value',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'framework',
    icon: <Clock className="w-6 h-6" />,
    color: 'from-amber-500 to-yellow-500',
    requirements: [
      'Market expiry dates',
      'Fair value model',
    ],
    workflow: [
      'Calculate time to expiration',
      'Estimate fair value decay curve',
      'Compare current price to theoretical',
      'If price < fair: Buy opportunity',
      'If price > fair: Short opportunity',
      'Size based on time remaining',
    ],
    configKey: 'time_decay_enabled',
  },

  // ===== 75% CONFIDENCE =====
  {
    id: 'market_maker_v2',
    name: 'Market Maker V2',
    confidence: 85,
    expectedApy: '15-25%',
    description: 'Provide liquidity and earn spread + rewards. Places two-sided quotes around mid-price with inventory skewing to manage risk.',
    keyPoints: [
      'Proven strategy backed by academic research ($40M)',
      'Earns spread + liquidity rewards',
      'Delta-neutral inventory management',
      'Inventory skewing reduces risk',
      'Target 200 bps spread for profitability',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-indigo-500 to-indigo-400',
    requirements: [
      'Polymarket wallet',
      'Capital for inventory',
      'Understanding of spread logic',
    ],
    workflow: [
      'Select high-volume markets (>$10k 24h)',
      'Calculate mid-price from order book',
      'Post bid/ask with inventory skew',
      'Rebalance when orders fill',
      'Monitor spread and inventory limits',
    ],
    configKey: 'enable_market_making',
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    confidence: 75,
    expectedApy: '20-60%',
    description: 'Profit from sideways price movement by placing a grid of buy and sell orders. Each oscillation generates profit.',
    keyPoints: [
      'Works best in ranging/sideways markets',
      'Automated buy-low, sell-high execution',
      'Configurable grid levels and range',
      'Can lose money in strong trends',
      'Round-trip = one buy + one sell',
    ],
    platforms: ['Binance', 'Coinbase', 'OKX', 'KuCoin'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <Grid3X3 className="w-6 h-6" />,
    color: 'from-teal-500 to-cyan-500',
    requirements: [
      'Exchange API with order placement',
      'Capital for grid investment',
      'Understanding of grid mechanics',
    ],
    workflow: [
      'Select sideways-trending asset',
      'Define price range (e.g., ±10%)',
      'Place buy orders below current price',
      'Place sell orders above current price',
      'When buy fills, place new sell above it',
      'When sell fills, place new buy below it',
      'Track round-trip profits',
    ],
    configKey: 'enable_grid_trading',
  },
  {
    id: 'ibkr_futures_momentum',
    name: 'Futures Momentum (IBKR)',
    confidence: 75,
    expectedApy: '20-50%',
    description: 'Trend following strategy on S&P 500 (ES) and Nasdaq (NQ) futures using Interactive Brokers.',
    keyPoints: [
      'Leveraged exposure to major indices',
      'Momentum entries on MA crossovers',
      'Captures strong intraday trends',
      'Strict risk management required',
      'Professional grade execution via IBKR',
    ],
    platforms: ['Interactive Brokers'],
    riskLevel: 'high',
    category: 'stock',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-blue-600 to-indigo-600',
    requirements: [
      'IBKR Account & TWS Gateway',
      'Futures trading permissions',
      'Min $2k margin per contract (MES)',
    ],
    workflow: [
      'Stream live futures data (ES/NQ)',
      'Calculate moving averages',
      'Buy/Sell on significant deviation',
      'Trail stops to lock in profits',
    ],
    configKey: 'enable_ibkr_futures_momentum',
  },
  {
    id: 'whale_copy_trading',
    name: 'Whale Copy Trading',
    emoji: '🐋',
    confidence: 75,
    expectedApy: '25-50%',
    description: 'Track and copy trades from high win-rate wallets on Polymarket. Leverage their research and conviction.',
    keyPoints: [
      'Track wallets with 80%+ win rates',
      '100% win rate wallets exist (small sample)',
      'Copy with configurable delay (30s default)',
      'Scale position based on your risk tolerance',
      'On-chain transparency enables tracking',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-6 h-6" />,
    color: 'from-violet-500 to-purple-500',
    requirements: [
      'Polymarket wallet + private key',
      'List of whale addresses to track',
      'On-chain data monitoring',
    ],
    workflow: [
      'Build list of top-performing wallets',
      'Monitor their new position entries',
      'Wait for configured delay (avoid front-running)',
      'Execute copy trade with scaled size',
      'Track performance vs original wallet',
      'Remove wallets that underperform',
    ],
    configKey: 'enable_whale_copy_trading',
  },
  {
    id: 'dividend_growth',
    name: 'Dividend Growth',
    confidence: 75,
    expectedApy: '6-12%',
    description: 'Build a portfolio of companies with consistent dividend growth. Focus on Dividend Aristocrats - 10+ years of consecutive increases.',
    keyPoints: [
      '2-5% yield sweet spot (avoid traps)',
      'Payout ratio < 60% for sustainability',
      'Compounding power over time',
      'Lower volatility than growth stocks',
      'Tax-advantaged qualified dividends',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'low',
    category: 'stock',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'from-green-500 to-teal-500',
    requirements: [
      'Alpaca API key',
      'Dividend data (history, yield)',
      'Financial screening criteria',
    ],
    workflow: [
      'Screen for 10+ year dividend growth',
      'Filter by yield (2-5%)',
      'Check payout ratio < 60%',
      'Verify earnings support dividend',
      'Build diversified portfolio',
      'Enable dividend reinvestment (DRIP)',
    ],
    configKey: 'enable_dividend_growth',
  },
  {
    id: 'depeg_detection',
    name: 'Stablecoin Depeg Detection',
    confidence: 75,
    expectedApy: '5-50% per event',
    description: 'Monitor stablecoin pegs and trade depeg events. Buy the dip on minor depegs, avoid death spirals.',
    keyPoints: [
      'USDC March 2023: $0.87 → recovered',
      'UST May 2022: Death spiral, never recovered',
      'Speed matters - best prices in minutes',
      'Due diligence critical',
      'Not all depegs recover',
    ],
    platforms: ['Multiple exchanges'],
    riskLevel: 'high',
    category: 'crypto',
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'from-rose-500 to-red-500',
    requirements: [
      'Multi-exchange price feeds',
      'Capital ready on multiple platforms',
    ],
    workflow: [
      'Monitor USDC/USDT/DAI prices',
      'Alert when deviation > 0.5%',
      'Analyze cause: technical vs fundamental',
      'For minor depegs: Buy the dip',
      'Set stop-loss for worst case',
      'Sell at $1.00 on recovery',
    ],
    configKey: 'depeg_detection_enabled',
  },

  // ===== 70% CONFIDENCE =====
  {
    id: 'stock_mean_reversion',
    name: 'Stock Mean Reversion',
    confidence: 70,
    expectedApy: '10-25%',
    description: 'Trade stocks that have deviated significantly from their historical average price, expecting them to revert back to the mean.',
    keyPoints: [
      'Buy when z-score < -2 (oversold)',
      'Sell/short when z-score > +2 (overbought)',
      'Exit when z-score returns to ±0.5',
      'Works best on range-bound stocks',
      'Avoid trending stocks',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-emerald-500 to-green-500',
    requirements: [
      'Alpaca API key (paper or live)',
      'Historical price data',
      'Stock screener criteria',
    ],
    workflow: [
      'Screen for liquid, large-cap stocks',
      'Calculate 20-day moving average',
      'Compute z-score for each stock',
      'If z < -2: Buy (oversold)',
      'If z > +2: Short/avoid (overbought)',
      'Exit when |z| < 0.5',
      'Use stop-loss for trend protection',
    ],
    configKey: 'enable_stock_mean_reversion',
  },
  {
    id: 'bracket_compression',
    name: 'Bracket Compression',
    emoji: '📊',
    confidence: 70,
    expectedApy: '15-30%',
    description: 'Mean reversion trading on stretched bracket prices. Wait for imbalance, build opposite leg, exit on compression.',
    keyPoints: [
      'Brackets tend to revert to fair value',
      'Large imbalances create opportunities',
      'Target 3% profit with 10% stop loss',
      'Works on all price bracket markets',
      'Avoid markets near expiry',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-cyan-500 to-blue-500',
    requirements: [
      'Polymarket or Kalshi account',
      'Understanding of mean reversion',
    ],
    workflow: [
      'Scan brackets for price imbalance',
      'Calculate deviation from fair value',
      'If imbalance > 30%, prepare entry',
      'Build position on stretched side',
      'Wait for compression to fair value',
      'Exit at take profit (3%) or stop loss (10%)',
    ],
    configKey: 'enable_bracket_compression',
  },
  {
    id: 'copy_trading',
    name: 'Copy Trading',
    confidence: 70,
    expectedApy: '20-50%',
    description: 'Automatically copy trades from successful "whale" traders. Leverage their research and conviction.',
    keyPoints: [
      'Track top performers by address',
      'Configurable copy multiplier',
      'Delay between detection and execution',
      'Works best with transparent on-chain data',
      'Can filter by minimum trade size',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-6 h-6" />,
    color: 'from-indigo-500 to-violet-500',
    requirements: [
      'Polymarket wallet + private key',
      'List of whale addresses to track',
      'Capital for position sizing',
    ],
    workflow: [
      'Monitor whale wallet activity',
      'Detect new position entries',
      'Calculate scaled position size',
      'Execute copy trade',
      'Track performance vs original',
    ],
  },
  {
    id: 'order_flow',
    name: 'Order Flow Analysis',
    confidence: 70,
    expectedApy: '10-30%',
    description: 'Analyze order book depth, trade flow, and whale activity to predict short-term price movements.',
    keyPoints: [
      'Order flow precedes price moves',
      'Whale tracking for large orders',
      'Buy/sell imbalance signals',
      'Best for scalping/day trading',
      'Exchange-specific data quality',
    ],
    platforms: ['Binance', 'Bybit', 'OKX'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <Activity className="w-6 h-6" />,
    color: 'from-green-500 to-teal-500',
    requirements: [
      'WebSocket access for order book',
      'Real-time trade tape data',
    ],
    workflow: [
      'Monitor order book depth',
      'Track trade tape (buyer/seller initiated)',
      'Calculate buy/sell imbalance',
      'Detect whale orders (>$50k)',
      'Signal when imbalance > 60/40',
      'Trade in direction of flow',
    ],
    configKey: 'order_flow_enabled',
  },
  {
    id: 'fear_premium_contrarian',
    name: 'Fear Premium Contrarian',
    emoji: '😱',
    confidence: 70,
    expectedApy: '25-60%',
    description: 'Trade against extreme sentiment in scary/controversial markets. Fear creates mispricing opportunities.',
    keyPoints: [
      'Based on @goatyishere - 91.4% win rate, 3,084 predictions',
      'Markets with high fear are underpriced',
      'Target YES < 15% or YES > 85%',
      'Controversial themes = fear premium',
      'Buy what others fear, sell what they love',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-red-500 to-pink-500',
    requirements: [
      'Polymarket or Kalshi account',
      'Ability to trade unpopular positions',
      'Patience for sentiment to normalize',
    ],
    workflow: [
      'Scan for extreme sentiment markets',
      'Identify controversial themes',
      'Calculate fear premium (fair value gap)',
      'If premium > 10%, enter contrarian position',
      'Size based on conviction',
      'Exit when sentiment normalizes',
    ],
    configKey: 'enable_fear_premium_contrarian',
  },
  {
    id: 'congressional_tracker',
    name: 'Congressional Tracker',
    emoji: '🏛️',
    confidence: 70,
    expectedApy: '15-40%',
    description: 'Copy stock trades from members of Congress. STOCK Act requires 45-day disclosure. Studies show ~12% annual outperformance vs S&P 500.',
    keyPoints: [
      'Free data from House/Senate Stock Watcher APIs',
      'Congress has information edge from briefings & legislation',
      'Top performers: Pelosi, Tuberville, Crenshaw',
      'Scale trades to your bankroll (10% default)',
      'Filter by politician, party, or chamber',
    ],
    platforms: ['Alpaca', 'IBKR', 'Any Broker'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <Users className="w-6 h-6" />,
    color: 'from-amber-500 to-yellow-500',
    requirements: [
      'Stock broker with API (Alpaca recommended)',
      'Capital for stock purchases',
      'Patience for disclosure lag (up to 45 days)',
    ],
    workflow: [
      'Fetch trades from House/Senate Stock Watcher',
      'Filter by tracked politicians or criteria',
      'Calculate copy size (% of their trade)',
      'Execute via broker API',
      'Track performance per politician',
      'Adjust tracking list based on results',
    ],
    configKey: 'enable_congressional_tracker',
  },

  // ===== 65% CONFIDENCE =====
  {
    id: 'stock_momentum',
    name: 'Stock Momentum',
    confidence: 65,
    expectedApy: '15-40%',
    description: 'Follow the trend - buy stocks that have been going up, short stocks that have been going down. Academic evidence supports momentum.',
    keyPoints: [
      'Momentum premium documented since 1993',
      'Winners tend to keep winning',
      'Monthly rebalancing recommended',
      'Crash risk during reversals',
      'Best combined with value/quality factors',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-blue-500 to-indigo-500',
    requirements: [
      'Alpaca API key',
      '12-month historical prices',
      'Stock ranking system',
    ],
    workflow: [
      'Calculate 12-month returns for universe',
      'Rank stocks by momentum',
      'Buy top 10% performers',
      'Optionally short bottom 10%',
      'Rebalance monthly',
      'Use stop-losses for protection',
    ],
    configKey: 'enable_stock_momentum',
  },
  {
    id: 'pairs_trading',
    name: 'Pairs Trading / Statistical Arbitrage',
    confidence: 65,
    expectedApy: '10-25%',
    description: 'Trade the spread between two correlated assets. Long the underperformer, short the outperformer when spread widens.',
    keyPoints: [
      'Based on mean reversion of correlated pairs',
      'BTC/ETH historically ~0.85 correlation',
      'Enter when z-score > 2 (spread too wide)',
      'Exit when z-score < 0.5 (mean reversion)',
      'Requires statistical analysis',
    ],
    platforms: ['Binance', 'Coinbase', 'OKX'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <LineChart className="w-6 h-6" />,
    color: 'from-rose-500 to-pink-500',
    requirements: [
      'Exchange API for both assets',
      'Margin/futures for shorting',
      'Historical price data',
    ],
    workflow: [
      'Calculate rolling correlation (30 days)',
      'Compute spread: Price_A - Beta × Price_B',
      'Calculate z-score of current spread',
      'If |z| > 2: Enter position',
      '  - Long the underperformer',
      '  - Short the outperformer',
      'If |z| < 0.5: Exit position',
      'Stop-loss if |z| > 4',
    ],
    configKey: 'enable_pairs_trading',
  },
  {
    id: 'earnings_momentum',
    name: 'Earnings Momentum',
    confidence: 65,
    expectedApy: '15-35%',
    description: 'Trade around earnings announcements. Stocks that beat estimates tend to continue outperforming (Post-Earnings Announcement Drift).',
    keyPoints: [
      'PEAD documented academically since 1968',
      'Drift continues for ~60 days',
      'High volatility around announcements',
      'Options can define risk',
      'Track analyst revisions',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'high',
    category: 'stock',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-yellow-500 to-orange-500',
    requirements: [
      'Alpaca API key',
      'Earnings calendar data',
      'Analyst estimates data',
    ],
    workflow: [
      'Track upcoming earnings dates',
      'Compare estimates vs whisper numbers',
      'Position before earnings (optional)',
      'Buy stocks that beat estimates',
      'Sell/short stocks that miss',
      'Hold for ~30 days for PEAD capture',
    ],
    configKey: 'enable_earnings_momentum',
  },
  {
    id: 'macro_board',
    name: 'Macro Board Strategy',
    emoji: '🌍',
    confidence: 65,
    expectedApy: '$62K/month',
    description: 'Heavy weighted exposure to high-conviction macro events. Focus on rates, treasuries, elections, and crypto prices.',
    keyPoints: [
      'Based on top trader making $62,856/month',
      'Weight portfolio by conviction level',
      'Focus on: Interest rates, BTC, elections',
      'Rebalance every 24 hours',
      'Requires macro research capability',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'high',
    category: 'prediction',
    icon: <Globe className="w-6 h-6" />,
    color: 'from-blue-500 to-indigo-500',
    requirements: [
      'Macro research capability',
      'Larger capital for diversification',
      'News and data monitoring',
    ],
    workflow: [
      'Identify high-impact macro markets',
      'Score conviction level (1-100)',
      'Allocate capital weighted by conviction',
      'Set maximum exposure limits',
      'Rebalance on schedule (24h)',
      'Exit positions as events resolve',
    ],
    configKey: 'enable_macro_board',
  },

  // ===== 60% CONFIDENCE =====
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    confidence: 60,
    expectedApy: '5-30% per event',
    description: 'React to breaking news faster than the market. Buy/sell positions before prices adjust to new information.',
    keyPoints: [
      'Requires fast news feed access',
      'High risk: News interpretation can be wrong',
      'Best for binary events with clear outcomes',
      'Keyword matching to relevant markets',
      'Time-sensitive: Minutes matter',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'high',
    category: 'prediction',
    icon: <Newspaper className="w-6 h-6" />,
    color: 'from-orange-500 to-red-500',
    requirements: [
      'NewsAPI key or Twitter API',
      'Trading credentials',
      'Low-latency execution',
    ],
    workflow: [
      'Monitor news feeds for keywords',
      'Match news to relevant markets',
      'Analyze sentiment and impact',
      'Execute trades within minutes',
      'Set stop-loss for risk management',
    ],
    configKey: 'enable_news_arbitrage',
  },
  {
    id: 'sector_rotation',
    name: 'Sector Rotation',
    confidence: 60,
    expectedApy: '8-20%',
    description: 'Rotate capital between sectors based on economic cycle. Different sectors outperform during different phases of the business cycle.',
    keyPoints: [
      'Early cycle: Consumer Discretionary, Financials',
      'Mid cycle: Technology, Industrials',
      'Late cycle: Energy, Materials',
      'Recession: Utilities, Staples, Healthcare',
      'Use sector ETFs for diversification',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <Repeat className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    requirements: [
      'Alpaca API key',
      'Economic indicators data',
      'Sector ETF access (XLF, XLK, etc.)',
    ],
    workflow: [
      'Monitor economic indicators (PMI, yield curve)',
      'Identify current business cycle phase',
      'Map phase to outperforming sectors',
      'Rotate to target sectors monthly',
      'Maintain defensive allocation',
      'Rebalance as cycle shifts',
    ],
    configKey: 'enable_sector_rotation',
  },
  
  // ===== AI & ADVANCED STRATEGIES (2024) =====
  {
    id: 'ai_superforecasting',
    name: 'AI Superforecasting',
    emoji: '🧠',
    confidence: 85,
    expectedApy: '30-80%',
    description: 'Gemini-powered market probability estimation. AI analyzes market context, historical data, and sentiment to generate independent forecasts. Trades when AI probability diverges significantly from market price.',
    keyPoints: [
      'Uses Gemini 1.5 Flash for fast inference',
      'Inspired by Metaculus superforecaster research',
      'Trades on 10%+ probability divergence',
      '65%+ confidence threshold for entries',
      'Multi-factor analysis: fundamentals + sentiment',
      'Human-like reasoning chains for transparency',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Brain className="w-6 h-6" />,
    color: 'from-purple-500 to-blue-500',
    requirements: [
      'Gemini API key (GEMINI_API_KEY)',
      'Polymarket or Kalshi trading credentials',
      'Historical market data for context',
    ],
    workflow: [
      'Fetch active prediction markets',
      'Build context: market title, current price, volume',
      'Send prompt to Gemini for probability estimation',
      'Parse AI response for probability + confidence',
      'If divergence ≥ 10% AND confidence ≥ 65%, trade',
      'Position sizing based on divergence magnitude',
      'Log forecasts for accuracy tracking',
      'Weekly recalibration of model prompts',
    ],
    configKey: 'enable_ai_superforecasting',
  },
];

const categoryColors = {
  prediction: 'border-purple-500/30 bg-purple-500/5',
  crypto: 'border-orange-500/30 bg-orange-500/5',
  stock: 'border-green-500/30 bg-green-500/5',
  framework: 'border-blue-500/30 bg-blue-500/5',
};

const categoryTitles = {
  prediction: { title: 'Prediction Markets', icon: '🎯', subtitle: 'Polymarket & Kalshi' },
  crypto: { title: 'Crypto Strategies', icon: '₿', subtitle: 'CCXT Exchanges' },
  stock: { title: 'Stock Trading', icon: '📈', subtitle: 'Alpaca' },
  framework: { title: 'Risk Management & Enhancements', icon: '🛡️', subtitle: 'Applied to all strategies' },
};

const riskColors = {
  low: 'text-green-400 bg-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/20',
  high: 'text-red-400 bg-red-500/20',
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return 'text-green-400';
  if (confidence >= 80) return 'text-emerald-400';
  if (confidence >= 70) return 'text-yellow-400';
  if (confidence >= 60) return 'text-orange-400';
  return 'text-red-400';
};

export default function WorkflowsPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Separate strategies from frameworks
  const tradingStrategies = STRATEGIES.filter(s => s.category !== 'framework');
  const riskFrameworks = STRATEGIES.filter(s => s.category === 'framework');
  
  // Sort by confidence (already sorted in STRATEGIES array)
  const sortedStrategies = [...tradingStrategies].sort((a, b) => b.confidence - a.confidence);
  const sortedFrameworks = [...riskFrameworks].sort((a, b) => b.confidence - a.confidence);
  
  const filteredStrategies = filterCategory 
    ? (filterCategory === 'framework' 
        ? sortedFrameworks 
        : sortedStrategies.filter(s => s.category === filterCategory))
    : sortedStrategies;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitBranch className="text-purple-400" />
            Trading Workflows
          </h1>
          <p className="text-gray-400 mt-1">
            {tradingStrategies.length} trading strategies + {riskFrameworks.length} risk frameworks • Click any card for details
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-lg transition-all ${
              !filterCategory ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All Strategies ({tradingStrategies.length})
          </button>
          <button
            onClick={() => setFilterCategory('prediction')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'prediction' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🎯 Prediction
          </button>
          <button
            onClick={() => setFilterCategory('crypto')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'crypto' ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ₿ Crypto
          </button>
          <button
            onClick={() => setFilterCategory('stock')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'stock' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            📈 Stocks
          </button>
          <button
            onClick={() => setFilterCategory('framework')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'framework' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🛡️ Risk
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4 flex-wrap">
        <Link 
          href="/secrets" 
          className="card p-4 flex items-center gap-3 hover:border-purple-500/50 transition-all group"
        >
          <Shield className="text-purple-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Configure API Keys</div>
            <div className="text-xs text-gray-400">Set up credentials for each platform</div>
          </div>
        </Link>
        <Link 
          href="/settings" 
          className="card p-4 flex items-center gap-3 hover:border-blue-500/50 transition-all group"
        >
          <Activity className="text-blue-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Strategy Settings</div>
            <div className="text-xs text-gray-400">Enable/disable and tune parameters</div>
          </div>
        </Link>
        <Link 
          href="/whales" 
          className="card p-4 flex items-center gap-3 hover:border-cyan-500/50 transition-all group"
        >
          <Users className="text-cyan-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Whale Tracker</div>
            <div className="text-xs text-gray-400">Track & copy high win-rate wallets</div>
          </div>
        </Link>
        <Link 
          href="/docs" 
          className="card p-4 flex items-center gap-3 hover:border-green-500/50 transition-all group"
        >
          <BookOpen className="text-green-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Documentation</div>
            <div className="text-xs text-gray-400">Learn how each strategy works</div>
          </div>
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          FULL SYSTEM ARCHITECTURE DIAGRAM
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Activity className="text-blue-400" />
          System Architecture Overview
        </h2>
        
        {/* Visual Flow Diagram */}
        <div className="relative bg-gray-900/50 rounded-xl p-8 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Data Sources Layer */}
            <div className="text-center mb-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Data Sources</span>
            </div>
            <div className="flex justify-center gap-6 mb-6">
              <div className="text-center">
                <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 w-28 hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">🎯</div>
                  <div className="text-sm font-medium">Polymarket</div>
                  <div className="text-xs text-gray-400">0% fees</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 w-28 hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium">Kalshi</div>
                  <div className="text-xs text-gray-400">7% fees</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 w-28 hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">₿</div>
                  <div className="text-sm font-medium">CCXT</div>
                  <div className="text-xs text-gray-400">106+ exchanges</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 w-28 hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">📈</div>
                  <div className="text-sm font-medium">Alpaca</div>
                  <div className="text-xs text-gray-400">US Stocks</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-xl p-4 w-28 hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">📰</div>
                  <div className="text-sm font-medium">News APIs</div>
                  <div className="text-xs text-gray-400">Finnhub/NewsAPI</div>
                </div>
              </div>
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center gap-6 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-28 flex justify-center">
                  <ArrowDown className="text-gray-600 w-5 h-5" />
                </div>
              ))}
            </div>
            
            {/* Bot Core */}
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/40 rounded-2xl p-6 w-[600px]">
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="text-xl font-bold">PolyBot Core</div>
                  <div className="text-sm text-gray-400">Async Strategy Orchestrator • v1.1.16</div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                    <div className="font-medium text-purple-400">Config</div>
                    <div className="text-xs text-gray-500">Supabase</div>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                    <div className="font-medium text-blue-400">Risk Mgr</div>
                    <div className="text-xs text-gray-500">Limits & Stops</div>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                    <div className="font-medium text-green-400">Paper/Live</div>
                    <div className="text-xs text-gray-500">Simulation</div>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg p-3 text-center">
                    <div className="font-medium text-orange-400">Analytics</div>
                    <div className="text-xs text-gray-500">P&L Track</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center mb-4">
              <ArrowDown className="text-gray-600 w-5 h-5" />
            </div>
            
            {/* Strategy Execution Layer */}
            <div className="text-center mb-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Strategy Execution ({STRATEGIES.length} strategies)</span>
            </div>
            <div className="flex justify-center gap-3 flex-wrap mb-6">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-purple-400">🎯 Prediction Arb</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-purple-400">🔄 Cross-Platform</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-purple-400">📊 Market Making</span>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-orange-400">💰 Funding Rate</span>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-orange-400">📶 Grid Trading</span>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-green-400">📈 Mean Reversion</span>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-green-400">🚀 Momentum</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-blue-400">🛡️ Risk Framework</span>
              </div>
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center mb-4">
              <ArrowDown className="text-gray-600 w-5 h-5" />
            </div>
            
            {/* Output Layer */}
            <div className="text-center mb-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Outputs</span>
            </div>
            <div className="flex justify-center gap-6">
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 w-32 text-center hover:scale-105 transition-transform">
                <Wallet className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <div className="text-sm font-medium">Trades</div>
                <div className="text-xs text-gray-400">Execute orders</div>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 w-32 text-center hover:scale-105 transition-transform">
                <BarChart3 className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <div className="text-sm font-medium">Analytics</div>
                <div className="text-xs text-gray-400">Track P&L</div>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 w-32 text-center hover:scale-105 transition-transform">
                <Shield className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <div className="text-sm font-medium">Alerts</div>
                <div className="text-xs text-gray-400">Discord/Telegram</div>
              </div>
              <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 w-32 text-center hover:scale-105 transition-transform">
                <Activity className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                <div className="text-sm font-medium">Logs</div>
                <div className="text-xs text-gray-400">Supabase</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Grid - Sorted by Confidence */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="text-green-400" />
            Trading Strategies (Sorted by Confidence %)
          </h2>
          <div className="text-sm text-gray-400">
            These are active trading systems that generate buy/sell signals
          </div>
        </div>
        
        {/* Explanation Box */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-yellow-400 mb-1">What are Trading Strategies?</div>
              <p className="text-sm text-gray-300">
                Trading strategies are <strong>active systems that generate trading signals</strong>. Each strategy 
                analyzes specific market conditions and executes trades when opportunities are found. 
                Strategies can run independently or together - enable multiple strategies to diversify your trading.
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredStrategies.map((strategy, index) => (
            <motion.div
              key={strategy.id}
              whileHover={{ scale: 1.03, y: -3 }}
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                categoryColors[strategy.category]
              } hover:border-opacity-70`}
              onClick={() => setSelectedStrategy(strategy)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${strategy.color}`}>
                  {strategy.icon}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getConfidenceColor(strategy.confidence)} bg-gray-800`}>
                  {strategy.confidence}%
                </span>
              </div>
              <div className="text-sm font-bold leading-tight mb-2">
                {strategy.emoji && <span className="mr-1">{strategy.emoji}</span>}
                {strategy.name}
              </div>
              <div className="text-xs text-gray-400 mb-2 line-clamp-2">
                {strategy.description.substring(0, 80)}...
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[strategy.riskLevel]}`}>
                  {strategy.riskLevel}
                </span>
                <span className="text-xs text-blue-400 font-medium">
                  {strategy.expectedApy}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          RISK FRAMEWORKS SECTION - Separate from Trading Strategies
          ════════════════════════════════════════════════════════════════════════ */}
      {filterCategory !== 'prediction' && filterCategory !== 'crypto' && filterCategory !== 'stock' && (
        <div className="card p-6 border-blue-500/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="text-blue-400" />
              Risk Management Frameworks
            </h2>
            <div className="text-sm text-blue-400">
              These enhance ALL trading strategies - not standalone trading systems
            </div>
          </div>
          
          {/* Framework Explanation Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-blue-400 mb-2">How do Frameworks differ from Strategies?</div>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <strong className="text-white">Strategies</strong> generate trading signals (buy/sell decisions). 
                    <strong className="text-white"> Frameworks</strong> are <em>risk management layers</em> that modify 
                    HOW those trades are executed.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-yellow-400 font-medium mb-1">⚡ Single Strategy Mode</div>
                      <p className="text-xs">If you run ONE strategy (e.g., Arbitrage), frameworks apply to that strategy&apos;s trades only.</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-green-400 font-medium mb-1">🔄 Multi-Strategy Mode</div>
                      <p className="text-xs">If you run MULTIPLE strategies, frameworks apply to ALL of them - providing unified risk management.</p>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 mt-3">
                    <div className="text-purple-400 font-medium mb-1">⚙️ Do frameworks override strategy settings?</div>
                    <p className="text-xs">
                      <strong>No</strong> - frameworks work <em>alongside</em> strategy settings. For example, if a strategy wants to trade $100 
                      but Kelly Criterion calculates $50 based on your edge, it will use $50. If Circuit Breaker is triggered, 
                      ALL strategies pause. Think of frameworks as safety rails that protect your capital.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {sortedFrameworks.map((framework) => (
              <motion.div
                key={framework.id}
                whileHover={{ scale: 1.03, y: -3 }}
                className={`cursor-pointer rounded-xl p-4 border transition-all ${
                  categoryColors[framework.category]
                } hover:border-opacity-70`}
                onClick={() => setSelectedStrategy(framework)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${framework.color}`}>
                    {framework.icon}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getConfidenceColor(framework.confidence)} bg-gray-800`}>
                    {framework.confidence}%
                  </span>
                </div>
                <div className="text-sm font-bold leading-tight mb-2">
                  {framework.emoji && <span className="mr-1">{framework.emoji}</span>}
                  {framework.name}
                </div>
                <div className="text-xs text-gray-400 mb-2 line-clamp-2">
                  {framework.description.substring(0, 80)}...
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    Enhancement
                  </span>
                  <span className="text-xs text-blue-400 font-medium">
                    {framework.expectedApy}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedStrategy(null)}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${selectedStrategy.color}`}>
                  {selectedStrategy.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedStrategy.emoji && <span className="mr-2">{selectedStrategy.emoji}</span>}
                    {selectedStrategy.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-400">
                      {categoryTitles[selectedStrategy.category].icon} {categoryTitles[selectedStrategy.category].title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[selectedStrategy.riskLevel]}`}>
                      {selectedStrategy.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStrategy(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className={`text-3xl font-bold ${getConfidenceColor(selectedStrategy.confidence)}`}>
                  {selectedStrategy.confidence}%
                </div>
                <div className="text-sm text-gray-400">Confidence</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{selectedStrategy.expectedApy}</div>
                <div className="text-sm text-gray-400">Expected APY</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{selectedStrategy.platforms.length}</div>
                <div className="text-sm text-gray-400">Platforms</div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Description
              </h3>
              <p className="text-gray-300 leading-relaxed">{selectedStrategy.description}</p>
            </div>

            {/* Key Points */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Key Points
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Platforms */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Platforms Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedStrategy.platforms.map((platform) => (
                  <span key={platform} className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Requirements
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            {/* Workflow */}
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-cyan-400" />
                Execution Workflow
              </h3>
              <div className="relative">
                <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-purple-500/50" />
                <div className="space-y-3">
                  {selectedStrategy.workflow.map((step, i) => (
                    <div key={i} className="flex items-start gap-4 pl-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                        i === 0 ? 'bg-cyan-500' :
                        i === selectedStrategy.workflow.length - 1 ? 'bg-purple-500' :
                        'bg-blue-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="text-gray-300 text-sm leading-relaxed">{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Config Key */}
            {selectedStrategy.configKey && (
              <div className="mt-6 p-4 bg-gray-800/50 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Config Key (polybot_config)</div>
                <code className="text-sm text-green-400">{selectedStrategy.configKey}</code>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-700">
              <Link 
                href="/secrets"
                className="flex-1 bg-purple-600 hover:bg-purple-700 transition-colors py-3 rounded-xl text-center font-medium"
              >
                Configure API Keys
              </Link>
              <Link 
                href="/settings"
                className="flex-1 bg-blue-600 hover:bg-blue-700 transition-colors py-3 rounded-xl text-center font-medium"
              >
                Enable Strategy
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Confidence Legend */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          Confidence Level Guide
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-400">90-100%:</span>
            <span className="text-green-400">Very High - Proven strategies with strong backtests</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-gray-400">80-89%:</span>
            <span className="text-emerald-400">High - Well-tested with good risk/reward</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-gray-400">70-79%:</span>
            <span className="text-yellow-400">Medium - Solid strategies with some risk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span className="text-gray-400">60-69%:</span>
            <span className="text-orange-400">Lower - Higher risk, requires expertise</span>
          </div>
        </div>
      </div>
    </div>
  );
}
