'use client';

import { useState, useEffect } from 'react';
import {
  Zap, DollarSign, Clock, Save, ChevronDown, ChevronRight, CheckCircle2,
  AlertTriangle, TrendingUp, Target, Landmark, Brain, Crown, Activity,
  Shield, BarChart3, Newspaper, Users, Grid3X3, Repeat, LineChart,
  Wallet, Globe, Flame, BookOpen, ArrowLeftRight, Bitcoin, X, ExternalLink,
  Sparkles, GitBranch, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBotConfig } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Strategy {
  id: string;
  name: string;
  description: string;
  howItWorks: string;
  confidence: number;
  expectedReturn: string;
  riskLevel: 'low' | 'medium' | 'high';
  configKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requirements?: string[];
  settings?: StrategySetting[];
  keyPoints?: string[];
  platforms?: string[];
  workflow?: string[];
}

interface StrategySetting {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  tooltip?: string;
}

interface StrategyCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  strategies: Strategy[];
}

// =============================================================================
// TOGGLE SWITCH COMPONENT
// =============================================================================

function ToggleSwitch({
  enabled,
  onToggle,
  disabled = false,
  size = 'md'
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const sizes = {
    sm: { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  };
  const s = sizes[size];

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors duration-200",
        s.track,
        enabled ? 'bg-neon-green' : 'bg-dark-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className={cn(
        "inline-block rounded-full bg-white shadow transform transition-transform duration-200",
        s.thumb,
        enabled ? s.translate : 'translate-x-0.5'
      )} />
    </button>
  );
}

// =============================================================================
// BADGE COMPONENTS
// =============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 85 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    confidence >= 70 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
      'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', color)}>
      {confidence}%
    </span>
  );
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase', colors[level])}>
      {level} risk
    </span>
  );
}

// =============================================================================
// STRATEGY DEFINITIONS BY CATEGORY
// =============================================================================

const STRATEGY_CATEGORIES: StrategyCategory[] = [
  {
    id: 'prediction-core',
    name: '🎯 Core Prediction Market',
    description: 'Fundamental arbitrage strategies for Polymarket & Kalshi',
    icon: Target,
    color: 'from-green-500 to-emerald-500',
    strategies: [
      {
        id: 'polymarket_single',
        name: 'Polymarket Single-Platform Arb',
        description: 'Buy YES+NO when combined < $1.00 for guaranteed profit',
        howItWorks: 'Scans Polymarket markets for mispricings where YES + NO < 100%. Buys both sides and profits on resolution. Zero directional risk.',
        confidence: 95,
        expectedReturn: '50-200% APY',
        riskLevel: 'low',
        configKey: 'enable_polymarket_single_arb',
        icon: Target,
        color: 'bg-polymarket/20 text-polymarket',
        platforms: ['Polymarket'],
        keyPoints: [
          'Zero directional risk - profit regardless of outcome',
          'Works when YES + NO < 100% (rare but happens)',
          'Polymarket has 0% fees - pure profit',
          'Academic research shows $40M extracted in 1 year',
          'Best for high-volume liquid markets',
        ],
        workflow: [
          'Scan all active markets every 30 seconds',
          'Calculate YES + NO total for each market',
          'If total < threshold (e.g., 99.5%), flag opportunity',
          'Execute buy orders for both outcomes',
          'Wait for market resolution',
          'Collect guaranteed profit',
        ],
        requirements: ['Polymarket wallet address', 'Private key', 'USDC on Polygon'],
        settings: [
          { key: 'poly_single_min_profit_pct', label: 'Min Profit %', type: 'number', defaultValue: 0.3, min: 0.1, max: 5, step: 0.1 },
          { key: 'poly_single_max_spread_pct', label: 'Max Spread %', type: 'number', defaultValue: 30, min: 1, max: 50, step: 1 },
          { key: 'poly_single_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 100, min: 10, max: 1000, step: 10 },
          { key: 'poly_single_scan_interval_sec', label: 'Scan Interval (sec)', type: 'number', defaultValue: 30, min: 10, max: 300, step: 5 },
        ],
      },
      {
        id: 'kalshi_single',
        name: 'Kalshi Single-Platform Arb',
        description: 'Same as Polymarket but accounting for 7% Kalshi fees',
        howItWorks: 'Scans Kalshi markets for YES + NO < 100% opportunities. Requires larger spreads due to 7% fee structure.',
        confidence: 90,
        expectedReturn: '30-100% APY',
        riskLevel: 'low',
        configKey: 'enable_kalshi_single_arb',
        icon: Target,
        color: 'bg-kalshi/20 text-kalshi',
        platforms: ['Kalshi'],
        keyPoints: [
          'Same concept as Polymarket arb',
          'Kalshi has 7% fees - need larger spreads',
          'CFTC-regulated, US-legal exchange',
          'Fewer markets but higher liquidity per market',
          'Requires 8%+ spread to be profitable',
        ],
        workflow: [
          'Scan Kalshi markets every 60 seconds',
          'Calculate YES + NO accounting for 7% fees',
          'If profit > 8%, flag opportunity',
          'Execute trades via Kalshi API',
          'Monitor position until resolution',
        ],
        requirements: ['Kalshi API key', 'Kalshi private key', 'USD balance on Kalshi'],
        settings: [
          { key: 'kalshi_single_min_profit_pct', label: 'Min Profit %', type: 'number', defaultValue: 8, min: 1, max: 20, step: 0.5 },
          { key: 'kalshi_single_max_spread_pct', label: 'Max Spread %', type: 'number', defaultValue: 30, min: 1, max: 50, step: 1 },
          { key: 'kalshi_single_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 30, min: 10, max: 500, step: 10 },
          { key: 'kalshi_single_scan_interval_sec', label: 'Scan Interval (sec)', type: 'number', defaultValue: 60, min: 10, max: 300, step: 5 },
        ],
      },
      {
        id: 'cross_platform',
        name: 'Cross-Platform Arbitrage',
        description: 'Same event, different prices on Polymarket vs Kalshi',
        howItWorks: 'Matches identical events across platforms using title similarity. Buys cheap side, hedges on other platform.',
        confidence: 85,
        expectedReturn: '~$95K historical',
        riskLevel: 'medium',
        configKey: 'enable_cross_platform_arb',
        icon: ArrowLeftRight,
        color: 'bg-neon-purple/20 text-neon-purple',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Exploits price differences between platforms',
          'Historical data shows ~$95K profit potential',
          'Uses fuzzy matching for market title matching',
          'Buy low on one platform, hedge on other',
          'Requires accounts on both platforms',
        ],
        workflow: [
          'Fetch active markets from both platforms',
          'Match markets using title similarity (>35%)',
          'Calculate cross-platform spread',
          'If profitable after fees, execute on both sides',
          'Monitor until resolution on both platforms',
        ],
        requirements: ['Polymarket wallet', 'Kalshi API credentials', 'Capital on both platforms'],
        settings: [
          { key: 'cross_plat_min_profit_buy_poly_pct', label: 'Min Profit (Buy Poly) %', type: 'number', defaultValue: 2.5, min: 0.5, max: 10, step: 0.5 },
          { key: 'cross_plat_min_profit_buy_kalshi_pct', label: 'Min Profit (Buy Kalshi) %', type: 'number', defaultValue: 9, min: 5, max: 20, step: 0.5 },
          { key: 'cross_plat_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 75, min: 10, max: 500, step: 10 },
          { key: 'cross_plat_min_similarity', label: 'Min Similarity', type: 'number', defaultValue: 0.35, min: 0.1, max: 1, step: 0.05 },
        ],
      },
      {
        id: 'overlapping_arb',
        name: 'Overlapping Arbitrage',
        description: 'Related markets on same platform with logical correlation',
        howItWorks: 'Finds correlated markets on same platform (e.g., "Trump wins" vs "Trump GOP nominee"). Exploits price inconsistencies.',
        confidence: 75,
        expectedReturn: 'Variable',
        riskLevel: 'medium',
        configKey: 'skip_same_platform_overlap',
        icon: Repeat,
        color: 'bg-amber-500/20 text-amber-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Finds logically correlated markets',
          'Example: If A implies B, B should cost >= A',
          'No cross-platform execution risk',
          'Requires careful correlation analysis',
          'Variable returns based on market conditions',
        ],
        workflow: [
          'Analyze market titles for logical relationships',
          'Calculate implied probabilities',
          'Identify mispriced correlations',
          'Execute when inconsistency detected',
        ],
        settings: [],
      },
      {
        id: 'polymarket_liquidation',
        name: 'Liquidation (Capital Recycling)',
        description: 'Sell high-probability positions early to recycle capital',
        howItWorks: 'Scans your portfolio for winning positions (e.g. trading at 98¢) that are locked until expiry. Sells them immediately to free up capital for higher ROI opportunities.',
        confidence: 90,
        expectedReturn: 'Boosts Portfolio IRR',
        riskLevel: 'low',
        configKey: 'enable_polymarket_liquidation',
        icon: Activity,
        color: 'bg-emerald-500/20 text-emerald-400',
        platforms: ['Polymarket'],
        keyPoints: [
          'Unlocks driven capital from "won" bets',
          'Improves annual return on capital (IRR)',
          'Avoids waiting weeks for final 1-2%',
          'Reinvests into new 50-100% opportunities',
          'Likely sells to market makers',
        ],
        workflow: [
          'Scan portfolio for positions > 98¢',
          'Check days to expiry (> 2 days)',
          'Calculate Opportunity Cost of holding',
          'If IRR of selling > holding, Sell Position',
          'Log capital recycling event',
        ],
        requirements: ['Polymarket positions'],
        settings: [
          { key: 'liquidation_threshold_price', label: 'Sell Price Threshold ($)', type: 'number', defaultValue: 0.98, min: 0.90, max: 0.99, step: 0.01 },
          { key: 'liquidation_min_days', label: 'Min Days to Expiry', type: 'number', defaultValue: 2, min: 1, max: 30, step: 1 },
        ],
      },
    ],
  },
  {
    id: 'prediction-advanced',
    name: '📰 Advanced Prediction',
    description: 'News-driven and market making strategies',
    icon: Newspaper,
    color: 'from-blue-500 to-cyan-500',
    strategies: [
      {
        id: 'news_arbitrage',
        name: 'News Arbitrage',
        description: 'Trade on news events before markets fully react',
        howItWorks: 'Monitors news feeds for keywords. When major news breaks, finds related markets that haven\'t yet adjusted.',
        confidence: 70,
        expectedReturn: '5-30% per event',
        riskLevel: 'medium',
        configKey: 'enable_news_arbitrage',
        icon: Newspaper,
        color: 'bg-blue-500/20 text-blue-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Speed is critical - first movers win',
          'Uses NewsAPI, Finnhub, or Twitter feeds',
          'Matches news keywords to market topics',
          'Higher risk but higher reward per event',
          'Best for breaking political/economic news',
        ],
        workflow: [
          'Monitor news feeds for keywords',
          'Match news to relevant prediction markets',
          'Analyze sentiment and likely impact',
          'Execute trades within minutes of news',
          'Set stop-loss for risk management',
        ],
        requirements: ['NewsAPI key or Twitter API', 'Low-latency execution'],
        settings: [
          { key: 'news_min_spread_pct', label: 'Min Spread %', type: 'number', defaultValue: 3, min: 1, max: 20, step: 0.5 },
          { key: 'news_max_lag_minutes', label: 'Max Lag (min)', type: 'number', defaultValue: 30, min: 5, max: 120, step: 5 },
          { key: 'news_position_size_usd', label: 'Position Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
        ],
      },
      {
        id: 'market_maker_v2',
        name: 'Market Maker V2',
        description: 'Provide liquidity and earn spread + rewards',
        howItWorks: 'Places two-sided quotes around mid-price. Skews quotes based on inventory to manage risk. Earns spread + protocol rewards.',
        confidence: 85,
        expectedReturn: '15-25% APR',
        riskLevel: 'medium',
        configKey: 'enable_market_making',
        icon: BarChart3,
        color: 'bg-indigo-500/20 text-indigo-400',
        platforms: ['Polymarket'],
        keyPoints: [
          'Proven strategy backed by academic research ($40M)',
          'Earns spread + liquidity rewards',
          'Delta-neutral inventory management',
          'Inventory skewing reduces risk',
          'Target 200 bps spread for profitability',
        ],
        workflow: [
          'Select high-volume markets (>$10k 24h)',
          'Calculate mid-price from order book',
          'Post bid/ask with inventory skew',
          'Rebalance when orders fill',
          'Monitor spread and inventory limits',
        ],
        requirements: ['Polymarket wallet', 'Capital for inventory'],
        settings: [
          { key: 'mm_target_spread_bps', label: 'Target Spread (bps)', type: 'number', defaultValue: 200, min: 50, max: 500, step: 10 },
          { key: 'mm_order_size_usd', label: 'Order Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
          { key: 'mm_max_inventory_usd', label: 'Max Inventory $', type: 'number', defaultValue: 500, min: 100, max: 5000, step: 100 },
          { key: 'mm_skew_factor', label: 'Skew Factor', type: 'number', defaultValue: 0.1, min: 0.0, max: 0.5, step: 0.05 },
        ],
      },
      {
        id: 'time_decay',
        name: 'Time Decay Analysis',
        description: 'Trade mispriced time decay in prediction markets',
        howItWorks: 'Analyzes how prices should converge to 0 or 100 as expiration approaches. Exploits markets that are mispriced relative to time remaining.',
        confidence: 80,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'time_decay_enabled',
        icon: Clock,
        color: 'bg-amber-500/20 text-green-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Theta decay concept from options',
          'Markets often overprice uncertainty near expiry',
          'Value converges faster as time passes',
          'Profits from "inevitable" conclusion',
          'Requires accurate fair value model',
        ],
        workflow: [
          'Calculate time to expiration',
          'Estimate theoretical fair value curve',
          'Compare current price to theoretical',
          'If price < fair (and trending): Buy',
          'If price > fair: Short/Sell',
          'Size based on time remaining',
        ],
        requirements: ['Market expiry dates', 'Fair value model'],
        settings: [
          { key: 'time_decay_min_diff', label: 'Min Diff %', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
          { key: 'time_decay_max_time_left_days', label: 'Max Days Left', type: 'number', defaultValue: 7, min: 1, max: 30, step: 1 },
        ],
      },
    ],
  },
  {
    id: 'prediction-whale',
    name: '🐋 Whale & Copy Trading',
    description: 'Follow smart money and successful traders',
    icon: Users,
    color: 'from-purple-500 to-pink-500',
    strategies: [
      {
        id: 'whale_copy_trading',
        name: 'Whale Copy Trading',
        description: 'Follow large, successful prediction market traders',
        howItWorks: 'Tracks whale wallets with high win rates. Copies their trades with a small delay and scaled position size.',
        confidence: 75,
        expectedReturn: 'Matches whale ROI',
        riskLevel: 'medium',
        configKey: 'enable_whale_copy_trading',
        icon: Users,
        color: 'bg-purple-500/20 text-purple-400',
        platforms: ['Polymarket'],
        keyPoints: [
          'Track wallets with 80%+ win rates',
          '100% win rate wallets exist (small sample)',
          'Copy with configurable delay (30s default)',
          'Scale position based on your risk tolerance',
          'On-chain transparency enables tracking',
          'NEW: Slippage protection built-in',
        ],
        workflow: [
          'Build list of top-performing wallets',
          'Monitor their new position entries',
          'Wait for configured delay (avoid front-running)',
          'Check slippage before executing',
          'Execute copy trade with scaled size',
          'Track performance vs original wallet',
        ],
        requirements: ['Polymarket wallet', 'List of whale addresses', 'On-chain monitoring'],
        settings: [
          { key: 'whale_copy_min_win_rate', label: 'Min Win Rate %', type: 'number', defaultValue: 80, min: 50, max: 100, step: 5 },
          { key: 'whale_copy_delay_seconds', label: 'Copy Delay (sec)', type: 'number', defaultValue: 30, min: 5, max: 300, step: 5 },
          { key: 'whale_copy_max_size_usd', label: 'Max Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
          { key: 'whale_max_slippage_pct', label: 'Max Slippage %', type: 'number', defaultValue: 2.0, min: 0.5, max: 10, step: 0.5 },
        ],
      },
      {
        id: 'selective_whale_copy',
        name: 'Selective Whale Copy',
        description: 'Auto-select best performing whales to copy',
        howItWorks: 'Analyzes historical whale performance. Automatically tracks top performers based on win rate and ROI.',
        confidence: 80,
        expectedReturn: '20-50% APY',
        riskLevel: 'medium',
        configKey: 'enable_selective_whale_copy',
        icon: Crown,
        color: 'bg-yellow-500/20 text-yellow-400',
        settings: [
          { key: 'selective_whale_min_win_rate', label: 'Min Win Rate', type: 'number', defaultValue: 0.65, min: 0.5, max: 0.95, step: 0.05 },
          { key: 'selective_whale_min_roi', label: 'Min ROI', type: 'number', defaultValue: 0.20, min: 0.05, max: 0.5, step: 0.05 },
          { key: 'selective_whale_max_tracked', label: 'Max Whales', type: 'number', defaultValue: 10, min: 1, max: 50, step: 1 },
        ],
      },
      {
        id: 'congressional_tracker',
        name: 'Congressional Tracker',
        description: 'Follow Congress members\' financial disclosures',
        howItWorks: 'Monitors STOCK Act disclosures. Copies trades from members with historically good timing.',
        confidence: 70,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_congressional_tracker',
        icon: Landmark,
        color: 'bg-slate-500/20 text-slate-400',
        platforms: ['US Stock Markets'],
        keyPoints: [
          'STOCK Act requires disclosure within 45 days',
          'Tracks members with best historical performance',
          'Focuses on committee-relevant trades',
          'Avoids members with poor timing records',
          'Scales position based on member confidence',
        ],
        workflow: [
          'Scrape STOCK Act filings from House/Senate',
          'Parse disclosure for ticker, amount, date',
          'Cross-reference member with performance history',
          'Filter: only high-performers, committee relevance',
          'Calculate position size based on confidence',
          'Execute trade via broker API',
          'Track performance for member ranking',
        ],
        settings: [
          { key: 'congress_copy_scale_pct', label: 'Copy Scale %', type: 'number', defaultValue: 10, min: 1, max: 50, step: 1 },
          { key: 'congress_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 500, min: 100, max: 5000, step: 100 },
        ],
      },
    ],
  },
  {
    id: 'prediction-macro',
    name: '🌍 Macro & Sentiment',
    description: 'Fear, greed, and market regime strategies',
    icon: Globe,
    color: 'from-orange-500 to-red-500',
    strategies: [
      {
        id: 'macro_board',
        name: 'Macro Dashboard',
        description: 'Trade based on macroeconomic indicators',
        howItWorks: 'Aggregates macro signals (Fed, inflation, employment). Adjusts position sizing and strategy based on regime.',
        confidence: 65,
        expectedReturn: 'Risk-adjusted',
        riskLevel: 'medium',
        configKey: 'enable_macro_board',
        icon: Globe,
        color: 'bg-orange-500/20 text-orange-400',
        platforms: ['Polymarket', 'Kalshi', 'Crypto Exchanges'],
        keyPoints: [
          'Monitors Fed rate decisions, CPI, employment',
          'Identifies economic regime (expansion/contraction)',
          'Adjusts risk appetite based on volatility',
          'Reduces exposure before major announcements',
          'Historical pattern matching for Fed days',
        ],
        workflow: [
          'Fetch economic calendar from data providers',
          'Calculate regime score (0-100)',
          'Identify upcoming high-impact events',
          'Adjust max position sizes based on regime',
          'Pre-position for expected outcomes',
          'Monitor live during announcements',
          'Quick exit if surprise outcome',
        ],
        settings: [
          { key: 'macro_max_exposure_usd', label: 'Max Exposure $', type: 'number', defaultValue: 5000, min: 1000, max: 50000, step: 500 },
          { key: 'macro_min_conviction_score', label: 'Min Conviction', type: 'number', defaultValue: 70, min: 50, max: 100, step: 5 },
        ],
      },
      {
        id: 'fear_premium_contrarian',
        name: 'Fear Premium Contrarian',
        description: 'Buy extreme fear, sell extreme greed',
        howItWorks: 'Monitors market prices for extreme fear (< 15%) or greed (> 85%). Takes contrarian positions.',
        confidence: 70,
        expectedReturn: '20-40% on reversals',
        riskLevel: 'high',
        configKey: 'enable_fear_premium_contrarian',
        icon: Activity,
        color: 'bg-red-500/20 text-red-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Behavioral finance: crowds overshoot',
          'Fear threshold: market < 15% = oversold',
          'Greed threshold: market > 85% = overbought',
          'Best on binary markets with clear resolution',
          'Requires patience for mean reversion',
        ],
        workflow: [
          'Scan all active markets for extreme prices',
          'Filter: only binary markets, sufficient volume',
          'Check historical resolution rates at extremes',
          'If fear (<15%), buy YES contracts',
          'If greed (>85%), buy NO contracts',
          'Size position inversely to extremity',
          'Exit on mean reversion or expiry',
        ],
        settings: [
          { key: 'fear_extreme_low_threshold', label: 'Fear Threshold', type: 'number', defaultValue: 0.15, min: 0.05, max: 0.3, step: 0.01 },
          { key: 'fear_extreme_high_threshold', label: 'Greed Threshold', type: 'number', defaultValue: 0.85, min: 0.7, max: 0.95, step: 0.01 },
          { key: 'fear_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 200, min: 50, max: 1000, step: 50 },
        ],
      },
      {
        id: 'high_conviction',
        name: 'High Conviction Strategy',
        description: 'Concentrate on highest-conviction opportunities',
        howItWorks: 'Only trades when multiple signals align. Uses Kelly criterion for position sizing.',
        confidence: 85,
        expectedReturn: '30-100% APY',
        riskLevel: 'medium',
        configKey: 'enable_high_conviction_strategy',
        icon: Brain,
        color: 'bg-cyan-500/20 text-cyan-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Kelly criterion for optimal bet sizing',
          'Requires 3+ signals to align',
          'Concentrated portfolio: max 3 positions',
          'Higher per-trade profit, fewer trades',
          'Best for experienced traders',
        ],
        workflow: [
          'Scan all strategies for opportunities',
          'Score each opportunity (0-100)',
          'Filter: only score ≥ 75 considered',
          'Rank by expected value',
          'Take top 3 opportunities only',
          'Apply Kelly sizing to each',
          'Monitor and exit on target/stop',
        ],
        settings: [
          { key: 'high_conviction_min_score', label: 'Min Score', type: 'number', defaultValue: 0.75, min: 0.5, max: 0.95, step: 0.05 },
          { key: 'high_conviction_max_positions', label: 'Max Positions', type: 'number', defaultValue: 3, min: 1, max: 10, step: 1 },
          { key: 'high_conviction_position_pct', label: 'Position %', type: 'number', defaultValue: 15, min: 5, max: 30, step: 1 },
        ],
      },
      {
        id: 'political_event',
        name: 'Political Event Strategy',
        description: 'Trade around scheduled political events',
        howItWorks: 'Tracks election dates, hearings, votes. Positions before events based on historical patterns.',
        confidence: 80,
        expectedReturn: '10-50% per event',
        riskLevel: 'medium',
        configKey: 'enable_political_event_strategy',
        icon: Landmark,
        color: 'bg-blue-600/20 text-blue-400',
        platforms: ['Polymarket', 'Kalshi', 'PredictIt'],
        keyPoints: [
          'Calendar-driven: elections, hearings, votes',
          'Historical patterns inform positioning',
          'Volatility spike before events = opportunity',
          'Exit before resolution to lock in gains',
          'Combine with polling data for edge',
        ],
        workflow: [
          'Maintain calendar of political events',
          'Identify markets related to upcoming events',
          'Analyze historical price patterns',
          'Position 24-48 hours before event',
          'Monitor live during event',
          'Exit on volatility spike or before resolution',
          'Log outcome for pattern refinement',
        ],
        settings: [
          { key: 'political_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 500, min: 100, max: 2000, step: 100 },
          { key: 'political_lead_time_hours', label: 'Lead Time (hrs)', type: 'number', defaultValue: 48, min: 12, max: 168, step: 12 },
        ],
      },
    ],
  },
  {
    id: 'prediction-twitter',
    name: '🐦 Twitter & Events',
    description: 'Social media and event-driven strategies',
    icon: Zap,
    color: 'from-sky-500 to-blue-500',
    strategies: [
      {
        id: 'kalshi_mention_snipe',
        name: 'Kalshi Mention Snipe',
        description: 'Trade when Kalshi markets get Twitter attention',
        howItWorks: 'Monitors Twitter for Kalshi market mentions. Front-runs retail flow when markets go viral.',
        confidence: 65,
        expectedReturn: '10-30% per event',
        riskLevel: 'high',
        configKey: 'enable_kalshi_mention_snipe',
        icon: Zap,
        color: 'bg-sky-500/20 text-sky-400',
        platforms: ['Kalshi', 'Twitter/X API'],
        keyPoints: [
          'Front-runs retail flow from viral tweets',
          'Monitors high-follower finance accounts',
          'Speed is critical: acts within seconds',
          'Exits before retail crowd arrives',
          'Works best on illiquid markets',
        ],
        workflow: [
          'Stream Twitter API for Kalshi mentions',
          'Filter by account follower count (>10K)',
          'Parse tweet for specific market ticker',
          'Check current market liquidity/price',
          'If liquid enough, enter position immediately',
          'Exit within 5-15 minutes (before crowd)',
          'Track viral tweet → price impact correlation',
        ],
        settings: [
          { key: 'kalshi_snipe_min_mentions', label: 'Min Mentions', type: 'number', defaultValue: 10, min: 5, max: 100, step: 5 },
          { key: 'kalshi_snipe_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 100, min: 25, max: 500, step: 25 },
        ],
      },
      {
        id: 'btc_bracket_arb',
        name: 'BTC Bracket Arbitrage',
        description: 'Exploit mispricings in BTC 15-minute price prediction brackets. Buy YES + NO when combined < $1.00 for guaranteed profit.',
        howItWorks: 'Finds mispriced BTC price brackets. If brackets don\'t sum to 100%, buys all brackets for guaranteed profit.',
        confidence: 85,
        expectedReturn: '20-50% APY',
        riskLevel: 'low',
        configKey: 'enable_btc_bracket_arb',
        icon: Bitcoin,
        color: 'bg-orange-500/20 text-orange-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Mispricing arbitrage: brackets must sum to 100%',
          'Low risk: guaranteed profit if mispriced',
          'Bots making $20K-$200K/month on this strategy',
          'Works on both Polymarket (0% fee) & Kalshi',
          'Capital efficient: no directional risk',
        ],
        workflow: [
          'Fetch all BTC bracket markets from Kalshi',
          'Sum YES prices across all brackets',
          'If sum < 100%, calculate arbitrage profit',
          'If profit > fees + threshold, execute',
          'Buy all bracket YES contracts proportionally',
          'Wait 15 minutes for resolution',
          'Collect guaranteed profit',
        ],
        settings: [
          { key: 'btc_bracket_min_discount_pct', label: 'Min Discount %', type: 'number', defaultValue: 0.5, min: 0.1, max: 5, step: 0.1 },
          { key: 'btc_bracket_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
        ],
      },
      {
        id: 'bracket_compression',
        name: 'Bracket Compression',
        description: 'Trade when bracket spreads compress',
        howItWorks: 'Monitors bracket market spreads. Trades when spreads narrow unexpectedly.',
        confidence: 70,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_bracket_compression',
        icon: TrendingUp,
        color: 'bg-emerald-500/20 text-emerald-400',
        platforms: ['Kalshi'],
        keyPoints: [
          'Spread compression signals directional move',
          'Identifies which bracket is absorbing flow',
          'Combines with volatility analysis',
          'Lower risk than pure directional bets',
          'Works best near expiration',
        ],
        workflow: [
          'Monitor all active bracket markets',
          'Calculate spread between adjacent brackets',
          'Detect when spreads narrow significantly',
          'Identify direction of compression',
          'Enter position on compressed bracket',
          'Take profit at 5% gain or roll',
          'Track compression patterns for optimization',
        ],
        settings: [
          { key: 'bracket_max_imbalance_threshold', label: 'Max Imbalance', type: 'number', defaultValue: 0.3, min: 0.1, max: 0.5, step: 0.05 },
          { key: 'bracket_take_profit_pct', label: 'Take Profit %', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
        ],
      },
      {
        id: 'crypto_15min_scalping',
        name: '⚡ 15-Min Crypto Scalping',
        description: 'High-frequency BTC/ETH binary options scalping',
        howItWorks: 'Targets 15-minute crypto binary markets. Buys when YES < 45¢, uses Kelly Criterion sizing. Based on Twitter success ($956→$208K).',
        confidence: 90,
        expectedReturn: '50-200% APY',
        riskLevel: 'high',
        configKey: 'enable_15min_crypto_scalping',
        icon: Zap,
        color: 'bg-yellow-500/20 text-yellow-400',
        platforms: ['Kalshi', 'Polymarket'],
        keyPoints: [
          'Twitter-proven: @0xReflection made $208K from $956',
          '15-minute expiration windows for quick profits',
          '45%+ entry threshold with Kelly fraction sizing',
          'Multi-indicator confluence: RSI, Bollinger, VWAP',
          'Conservative: 90%+ confidence required',
          'Slippage protection built-in',
        ],
        workflow: [
          'Scan BTC/ETH 15-min markets every 2 seconds',
          'Calculate RSI, Bollinger Bands, VWAP deviation',
          'Score opportunity (0-100) based on confluence',
          'If score ≥ 45 AND confidence ≥ 90%, enter trade',
          'Apply Kelly criterion for position sizing',
          'Track win/loss streaks for adjustment',
          'Auto-exit at expiration',
        ],
        requirements: ['Kalshi API (preferred)', 'Real-time BTC/ETH feeds', '$50+ starting balance'],
        settings: [
          { key: 'crypto_scalp_entry_threshold', label: 'Entry Threshold', type: 'number', defaultValue: 0.45, min: 0.30, max: 0.50, step: 0.01 },
          { key: 'crypto_scalp_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 100, min: 10, max: 1000, step: 10 },
          { key: 'crypto_scalp_scan_interval_sec', label: 'Scan Interval (sec)', type: 'number', defaultValue: 2, min: 1, max: 10, step: 1 },
          { key: 'crypto_scalp_kelly_fraction', label: 'Kelly Fraction', type: 'number', defaultValue: 0.25, min: 0.1, max: 0.5, step: 0.05 },
          { key: 'crypto_scalp_max_concurrent', label: 'Max Concurrent', type: 'number', defaultValue: 3, min: 1, max: 10, step: 1 },
        ],
      },
      {
        id: 'ai_superforecasting',
        name: '🧠 AI Superforecasting',
        description: 'Gemini-powered market probability estimation',
        howItWorks: 'Uses Google Gemini to analyze market questions. Trades when AI estimate diverges >10% from market consensus. Based on BlackSky bot architecture.',
        confidence: 85,
        expectedReturn: '30-60% APY',
        riskLevel: 'medium',
        configKey: 'enable_ai_superforecasting',
        icon: Brain,
        color: 'bg-purple-500/20 text-purple-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Uses Gemini 1.5 Flash for fast inference',
          'Inspired by Metaculus superforecaster research',
          'Trades on 10%+ probability divergence',
          '65%+ confidence threshold for entries',
          'Multi-factor analysis: fundamentals + sentiment',
          'Human-like reasoning chains for transparency',
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
        requirements: ['Gemini API Key (GEMINI_API_KEY)', 'Polymarket or Kalshi credentials'],
        settings: [
          { key: 'ai_min_divergence_pct', label: 'Min Divergence %', type: 'number', defaultValue: 10, min: 5, max: 30, step: 1 },
          { key: 'ai_min_confidence', label: 'Min Confidence', type: 'number', defaultValue: 0.65, min: 0.5, max: 0.9, step: 0.05 },
          { key: 'ai_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 100, min: 10, max: 1000, step: 10 },
          { key: 'ai_scan_interval_sec', label: 'Scan Interval (sec)', type: 'number', defaultValue: 300, min: 60, max: 900, step: 60 },
          { key: 'ai_max_concurrent', label: 'Max Concurrent', type: 'number', defaultValue: 5, min: 1, max: 10, step: 1 },
        ],
      },
      {
        id: 'spike_hunter',
        name: '🎯 Spike Hunter',
        description: 'Mean-reversion on rapid price spikes (2%+ in <30 seconds)',
        howItWorks: 'Monitors real-time prices via WebSocket. Detects rapid 2%+ moves in <30 seconds. Enters contrarian positions expecting mean reversion. Uses tight stops and quick exits.',
        confidence: 85,
        expectedReturn: '$5K-100K/month',
        riskLevel: 'high',
        configKey: 'enable_spike_hunter',
        icon: Zap,
        color: 'bg-red-500/20 text-red-400',
        platforms: ['Polymarket', 'Kalshi'],
        keyPoints: [
          'Twitter-proven: Multiple traders report $5K-$100K/month',
          'Uses WebSocket for real-time price monitoring',
          'Detects 2%+ price moves within 30 seconds',
          'Fades the spike - enters opposite direction',
          'Tight stops (3%) and quick take profit (1.5%)',
          'Max 5 minute hold time per trade',
          'Best for high-volatility prediction markets',
        ],
        workflow: [
          'Connect to market WebSocket feeds',
          'Build 60-second price history per market',
          'Detect price spike: 2%+ move in <30s',
          'Enter contrarian position (fade the spike)',
          'Set stop loss at 3% and target at 1.5%',
          'Exit on target, stop, or 5-min timeout',
          'Track spike patterns for optimization',
        ],
        requirements: ['WebSocket connection', 'Real-time price feeds', 'Fast execution'],
        settings: [
          { key: 'spike_min_magnitude_pct', label: 'Min Spike %', type: 'number', defaultValue: 2.0, min: 1.0, max: 5.0, step: 0.5 },
          { key: 'spike_max_duration_sec', label: 'Detection Window (sec)', type: 'number', defaultValue: 30, min: 10, max: 60, step: 5 },
          { key: 'spike_take_profit_pct', label: 'Take Profit %', type: 'number', defaultValue: 1.5, min: 0.5, max: 5.0, step: 0.5 },
          { key: 'spike_stop_loss_pct', label: 'Stop Loss %', type: 'number', defaultValue: 3.0, min: 1.0, max: 10.0, step: 0.5 },
          { key: 'spike_max_hold_sec', label: 'Max Hold (sec)', type: 'number', defaultValue: 300, min: 60, max: 600, step: 30 },
          { key: 'spike_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 50, min: 10, max: 200, step: 10 },
          { key: 'spike_max_concurrent', label: 'Max Concurrent', type: 'number', defaultValue: 3, min: 1, max: 5, step: 1 },
        ],
      },
    ],
  },
  {
    id: 'crypto',
    name: '₿ Crypto Strategies',
    description: 'Funding rate, grid trading, and pairs trading',
    icon: Bitcoin,
    color: 'from-orange-400 to-yellow-500',
    strategies: [
      {
        id: 'funding_rate_arb',
        name: 'Funding Rate Arbitrage',
        description: 'Capture perpetual futures funding rates',
        howItWorks: 'Goes long spot, short perpetual when funding is high (shorts pay longs). Delta-neutral profit.',
        confidence: 85,
        expectedReturn: '15-50% APY',
        riskLevel: 'low',
        configKey: 'enable_funding_rate_arb',
        icon: Zap,
        color: 'bg-yellow-500/20 text-yellow-400',
        platforms: ['Binance', 'Bybit', 'OKX'],
        keyPoints: [
          'Delta-neutral: no directional exposure',
          'Funding paid every 8 hours on perps',
          'High funding = shorts pay longs',
          'Capture 0.01-0.1% every 8 hours',
          'Annualized: 15-50% with low risk',
          'Requires both spot and futures access',
        ],
        workflow: [
          'Monitor funding rates across exchanges',
          'Identify coins with funding > threshold',
          'Calculate expected profit after fees',
          'Open spot long + perp short simultaneously',
          'Hold through funding payment',
          'Close both positions atomically',
          'Track realized vs expected funding',
        ],
        requirements: ['Crypto exchange API (Binance/Bybit)', 'Futures trading enabled'],
        settings: [
          { key: 'funding_min_rate_pct', label: 'Min Rate %', type: 'number', defaultValue: 0.03, min: 0.01, max: 0.1, step: 0.01 },
          { key: 'funding_min_apy', label: 'Min APY %', type: 'number', defaultValue: 30, min: 10, max: 100, step: 5 },
          { key: 'funding_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 1000, min: 100, max: 10000, step: 100 },
        ],
      },
      {
        id: 'cross_exchange_arb',
        name: 'Cross-Exchange Crypto Arb',
        description: 'Exploit price differences across exchanges (Binance vs Kraken)',
        howItWorks: 'Monitors multiple exchanges for the same asset. Buys lower, sells higher. Captures spread.',
        confidence: 80,
        expectedReturn: '10-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_cross_exchange_arb',
        icon: GitBranch,
        color: 'bg-teal-500/20 text-teal-400',
        platforms: ['Binance', 'Kraken', 'OKX'],
        keyPoints: [
          'Classic arbitrage strategy',
          'Profit from market inefficiencies',
          'Requires assets on multiple exchanges',
          'Execution speed is critical',
        ],
        workflow: [
          'Fetch prices from all configured exchanges',
          'Calculate spread matrix',
          'If spread > fees + threshold:',
          'Execute Buy on Exchange A',
          'Execute Sell on Exchange B',
          'Rebalance assets periodically',
        ],
        requirements: ['Multiple Exchange APIs (CCXT)'],
        settings: [
          { key: 'cross_exchange_min_profit_pct', label: 'Min Profit %', type: 'number', defaultValue: 0.5, min: 0.1, max: 5.0, step: 0.1 },
          { key: 'cross_exchange_symbols', label: 'Symbols (csv)', type: 'text', defaultValue: 'BTC/USDT,ETH/USDT' },
        ],
      },
      {
        id: 'grid_trading',
        name: 'Grid Trading',
        description: 'Automated buy/sell grid for range-bound markets',
        howItWorks: 'Places layered buy/sell orders at intervals. Profits from price oscillation within a range.',
        confidence: 75,
        expectedReturn: '20-40% APY',
        riskLevel: 'medium',
        configKey: 'enable_grid_trading',
        icon: Grid3X3,
        color: 'bg-green-500/20 text-green-400',
        platforms: ['Binance', 'Bybit', 'KuCoin'],
        keyPoints: [
          'Best for range-bound, volatile markets',
          'Places buy orders below current price',
          'Places sell orders above current price',
          'Profits from each oscillation',
          'Risk: breakout beyond grid range',
          'Can be combined with trend following',
        ],
        workflow: [
          'Identify range-bound asset (BTC, ETH)',
          'Define grid range (e.g., ±10%)',
          'Calculate grid levels (e.g., 10 levels)',
          'Place buy limit orders below price',
          'Place sell limit orders above price',
          'When buy fills, place new sell above',
          'When sell fills, place new buy below',
          'Continuously compound profits',
        ],
        requirements: ['Crypto exchange API'],
        settings: [
          { key: 'grid_default_range_pct', label: 'Grid Range %', type: 'number', defaultValue: 10, min: 2, max: 30, step: 1 },
          { key: 'grid_default_levels', label: 'Grid Levels', type: 'number', defaultValue: 10, min: 5, max: 50, step: 1 },
          { key: 'grid_default_investment_usd', label: 'Investment $', type: 'number', defaultValue: 1000, min: 100, max: 10000, step: 100 },
        ],
      },
      {
        id: 'pairs_trading',
        name: 'Pairs Trading',
        description: 'Trade correlated crypto pairs mean-reversion',
        howItWorks: 'Identifies correlated pairs (BTC/ETH). When spread diverges, goes long underperformer, short outperformer.',
        confidence: 80,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_pairs_trading',
        icon: Repeat,
        color: 'bg-purple-500/20 text-purple-400',
        platforms: ['Binance', 'Bybit', 'Any margin exchange'],
        keyPoints: [
          'Market-neutral: profits in any direction',
          'Requires high correlation between pairs',
          'Z-score entry: spread > 2 std deviations',
          'Exit when spread reverts to mean',
          'Lower risk than directional trading',
          'Works best in consolidating markets',
        ],
        workflow: [
          'Calculate rolling correlation (BTC/ETH)',
          'Compute spread z-score',
          'If z-score > 2: long underperformer, short outperformer',
          'If z-score < -2: opposite position',
          'Exit when z-score returns to ±0.5',
          'Stop loss at z-score ±3',
          'Track correlation stability over time',
        ],
        requirements: ['Crypto exchange API', 'Margin trading enabled'],
        settings: [
          { key: 'pairs_z_score_entry', label: 'Z-Score Entry', type: 'number', defaultValue: 2, min: 1.5, max: 3, step: 0.1 },
          { key: 'pairs_z_score_exit', label: 'Z-Score Exit', type: 'number', defaultValue: 0.5, min: 0, max: 1, step: 0.1 },
          { key: 'pairs_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 500, min: 100, max: 5000, step: 100 },
        ],
      },
      {
        id: 'depeg_detection',
        name: 'Stablecoin Depeg Detection',
        description: 'Monitor stablecoin pegs and trade depeg events',
        howItWorks: 'Monitors USDC/USDT/DAI prices. Alerts or trades when deviation > 0.5%. Buys fear-driven dips.',
        confidence: 75,
        expectedReturn: '5-50% per event',
        riskLevel: 'high',
        configKey: 'depeg_detection_enabled',
        icon: AlertTriangle,
        color: 'bg-rose-500/20 text-rose-400',
        platforms: ['Multiple exchanges'],
        keyPoints: [
          'USDC March 2023: $0.87 → recovered',
          'UST May 2022: Death spiral, never recovered',
          'Speed matters - best prices in minutes',
          'Due diligence critical',
          'Not all depegs recover',
        ],
        workflow: [
          'Monitor USDC/USDT/DAI prices',
          'Alert when deviation > 0.5%',
          'Analyze cause: technical vs fundamental',
          'For minor depegs: Buy the dip',
          'Set stop-loss for worst case',
          'Sell at $1.00 on recovery',
        ],
        requirements: ['Multi-exchange price feeds', 'Capital ready'],
        settings: [
          { key: 'depeg_threshold_pct', label: 'Depeg Threshold %', type: 'number', defaultValue: 0.5, min: 0.1, max: 5, step: 0.1 },
          { key: 'depeg_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 1000, min: 100, max: 10000, step: 100 },
        ],
      },
    ],
  },
  {
    id: 'stocks',
    name: '📈 Stock Strategies',
    description: 'Mean reversion, momentum, and dividend strategies',
    icon: LineChart,
    color: 'from-blue-500 to-indigo-500',
    strategies: [
      {
        id: 'stock_mean_reversion',
        name: 'Stock Mean Reversion',
        description: 'Buy oversold stocks, sell overbought',
        howItWorks: 'Uses RSI and Bollinger Bands to identify extremes. Buys when RSI < 30, sells when RSI > 70.',
        confidence: 70,
        expectedReturn: '15-25% APY',
        riskLevel: 'medium',
        configKey: 'enable_stock_mean_reversion',
        icon: Activity,
        color: 'bg-blue-500/20 text-blue-400',
        platforms: ['Alpaca', 'Interactive Brokers', 'TD Ameritrade'],
        keyPoints: [
          'RSI < 30 = oversold = buy signal',
          'RSI > 70 = overbought = sell signal',
          'Bollinger Band touch confirms entry',
          'Works best on liquid, large-cap stocks',
          'Avoid during strong trends',
          'Combine with volume confirmation',
        ],
        workflow: [
          'Scan stock universe for RSI extremes',
          'Filter: only stocks at Bollinger Band edge',
          'Confirm with volume (lower = better for reversal)',
          'Enter position with stop loss at recent extreme',
          'Exit when RSI crosses back to neutral (50)',
          'Or exit at opposite Bollinger Band',
          'Track mean reversion win rate by sector',
        ],
        requirements: ['Stock broker API (Alpaca/IBKR)'],
        settings: [
          { key: 'stock_mr_rsi_oversold', label: 'RSI Oversold', type: 'number', defaultValue: 30, min: 20, max: 40, step: 5 },
          { key: 'stock_mr_rsi_overbought', label: 'RSI Overbought', type: 'number', defaultValue: 70, min: 60, max: 80, step: 5 },
          { key: 'stock_mr_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 1000, min: 100, max: 10000, step: 100 },
        ],
      },
      {
        id: 'stock_momentum',
        name: 'Stock Momentum',
        description: 'Buy stocks with strong upward momentum',
        howItWorks: 'Ranks stocks by 12-month momentum. Buys top performers, rebalances monthly.',
        confidence: 75,
        expectedReturn: '20-40% APY',
        riskLevel: 'medium',
        configKey: 'enable_stock_momentum',
        icon: TrendingUp,
        color: 'bg-green-500/20 text-green-400',
        platforms: ['Alpaca', 'Interactive Brokers'],
        keyPoints: [
          'Academic research backs momentum factor',
          '12-month lookback, skip most recent month',
          'Top decile outperforms by 5-10% annually',
          'Monthly rebalancing captures trends',
          'Works across all market caps',
          'Combine with quality filters',
        ],
        workflow: [
          'Calculate 12-month returns for universe',
          'Rank all stocks by momentum',
          'Select top N stocks (e.g., 10)',
          'Equal weight or momentum weight',
          'Rebalance monthly',
          'Track factor exposure and attribution',
          'Adjust during momentum crashes',
        ],
        requirements: ['Stock broker API'],
        settings: [
          { key: 'stock_momentum_lookback_days', label: 'Lookback (days)', type: 'number', defaultValue: 252, min: 60, max: 365, step: 30 },
          { key: 'stock_momentum_top_n', label: 'Top N Stocks', type: 'number', defaultValue: 10, min: 5, max: 30, step: 1 },
        ],
      },
      {
        id: 'sector_rotation',
        name: 'Sector Rotation',
        description: 'Rotate between sectors based on economic cycle',
        howItWorks: 'Identifies economic regime. Rotates into sectors that historically outperform in current regime.',
        confidence: 70,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_sector_rotation',
        icon: Repeat,
        color: 'bg-indigo-500/20 text-indigo-400',
        platforms: ['Alpaca', 'Interactive Brokers'],
        keyPoints: [
          'Economic cycle: expansion → peak → contraction → trough',
          'Each phase favors different sectors',
          'Expansion: Technology, Consumer Discretionary',
          'Contraction: Utilities, Healthcare, Consumer Staples',
          'Uses yield curve, PMI, leading indicators',
          'Monthly regime assessment',
        ],
        workflow: [
          'Assess current economic regime',
          'Map regime to historical sector performance',
          'Select top 3 sectors for current regime',
          'Allocate to sector ETFs (XLK, XLV, etc.)',
          'Monthly regime reassessment',
          'Rotate if regime changes',
          'Track regime accuracy and sector performance',
        ],
        requirements: ['Stock broker API'],
        settings: [
          { key: 'sector_rotation_top_n', label: 'Top N Sectors', type: 'number', defaultValue: 3, min: 1, max: 5, step: 1 },
        ],
      },
      {
        id: 'dividend_growth',
        name: 'Dividend Growth',
        description: 'Buy stocks with consistent dividend growth',
        howItWorks: 'Screens for stocks with 10+ years of dividend increases. Focuses on yield + growth.',
        confidence: 80,
        expectedReturn: '10-15% APY + Dividends',
        riskLevel: 'low',
        configKey: 'enable_dividend_growth',
        icon: DollarSign,
        color: 'bg-emerald-500/20 text-emerald-400',
        platforms: ['Alpaca', 'Interactive Brokers', 'Fidelity'],
        keyPoints: [
          'Dividend Aristocrats: 25+ years of increases',
          'Dividend Champions: 10+ years of increases',
          'Focus on payout ratio < 60%',
          'Yield + growth = total return',
          'Lower volatility than market',
          'Compound dividends for growth',
        ],
        workflow: [
          'Screen for dividend growth streak (10+ years)',
          'Filter by payout ratio (<60%)',
          'Filter by minimum yield (>2%)',
          'Rank by dividend growth rate',
          'Build diversified portfolio (20+ stocks)',
          'Reinvest dividends automatically',
          'Annual rebalancing and screening',
        ],
        requirements: ['Stock broker API'],
        settings: [
          { key: 'dividend_min_yield_pct', label: 'Min Yield %', type: 'number', defaultValue: 2, min: 1, max: 5, step: 0.5 },
          { key: 'dividend_min_growth_years', label: 'Min Growth Years', type: 'number', defaultValue: 10, min: 5, max: 25, step: 1 },
        ],
      },
      {
        id: 'earnings_momentum',
        name: 'Earnings Momentum',
        description: 'Trade around earnings surprises',
        howItWorks: 'Identifies stocks with positive earnings surprises. Rides post-earnings drift.',
        confidence: 65,
        expectedReturn: '20-50% APY',
        riskLevel: 'high',
        configKey: 'enable_earnings_momentum',
        icon: BarChart3,
        color: 'bg-yellow-500/20 text-yellow-400',
        platforms: ['Alpaca', 'Interactive Brokers'],
        keyPoints: [
          'Post-Earnings Announcement Drift (PEAD)',
          'Stocks drift in direction of surprise',
          'Bigger surprise = bigger drift',
          'Effect lasts 60-90 days',
          'Combine with options for leverage',
          'Avoid before earnings (binary event)',
        ],
        workflow: [
          'Monitor earnings calendar',
          'Wait for earnings release',
          'Calculate surprise % (actual vs estimate)',
          'If surprise > 5%, enter long',
          'If surprise < -5%, enter short',
          'Hold for 30-60 days (PEAD window)',
          'Track drift by surprise magnitude',
        ],
        requirements: ['Stock broker API'],
        settings: [
          { key: 'earnings_min_surprise_pct', label: 'Min Surprise %', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
        ],
      },
    ],
  },
  {
    id: 'options',
    name: 'Derivatives (Options & Futures)',
    description: 'Income-generating options strategies',
    icon: Shield,
    color: 'from-purple-500 to-violet-500',
    strategies: [
      {
        id: 'ibkr_futures_momentum',
        name: 'Futures Momentum (IBKR)',
        description: 'Trend following on S&P 500 / Nasdaq Futures',
        howItWorks: 'Monitors ES/NQ futures prices on Interactive Brokers. Enters Long/Short when price deviates significantly from Moving Average, riding the momentum.',
        confidence: 75,
        expectedReturn: '20-50% APY',
        riskLevel: 'high',
        configKey: 'enable_ibkr_futures_momentum',
        icon: TrendingUp,
        color: 'bg-blue-600/20 text-blue-400',
        platforms: ['Interactive Brokers'],
        keyPoints: [
          'Trades E-mini S&P 500 (ES) & Nasdaq (NQ)',
          'Momentum-based entries',
          'Requires IBKR TWS/Gateway',
          'Leveraged returns (and risks)',
          'Strict stop losses essential',
        ],
        workflow: [
          'Connect to IBKR Gateway',
          'Stream live futures data',
          'Calculate Rolling Moving Average',
          'If Price > MA + Threshold -> BUY',
          'If Price < MA - Threshold -> SELL',
          'Exit on MA reversion or Stop Loss',
        ],
        requirements: ['IBKR Account', 'TWS/Gateway Running'],
        settings: [
          { key: 'ibkr_futures_symbol', label: 'Symbol', type: 'text', defaultValue: 'ES' },
        ],
      },
      {
        id: 'covered_calls',
        name: 'Covered Calls',
        description: 'Sell calls against stock holdings for income',
        howItWorks: 'Owns 100 shares, sells OTM call. Collects premium. Caps upside but generates steady income.',
        confidence: 85,
        expectedReturn: '8-15% APY',
        riskLevel: 'low',
        configKey: 'enable_covered_calls',
        icon: Shield,
        color: 'bg-purple-500/20 text-purple-400',
        platforms: ['TD Ameritrade', 'Interactive Brokers', 'Tastytrade'],
        keyPoints: [
          'Own 100 shares per contract sold',
          'Sell OTM call (30 delta typical)',
          'Collect premium = immediate income',
          'Max profit = premium + strike - cost basis',
          'Best in flat to slightly bullish markets',
          'Assignment = sell shares at profit',
        ],
        workflow: [
          'Identify stocks you own (100 shares each)',
          'Select strike 30 delta OTM',
          'Choose 30-45 DTE expiration',
          'Sell call option, collect premium',
          'If assigned, sell shares at strike',
          'If expires worthless, keep premium',
          'Repeat monthly for income',
        ],
        requirements: ['Options-enabled broker'],
        settings: [
          { key: 'covered_call_days_to_expiry', label: 'Days to Expiry', type: 'number', defaultValue: 30, min: 7, max: 60, step: 7 },
          { key: 'covered_call_delta_target', label: 'Delta Target', type: 'number', defaultValue: 0.3, min: 0.1, max: 0.5, step: 0.05 },
        ],
      },
      {
        id: 'cash_secured_puts',
        name: 'Cash-Secured Puts',
        description: 'Sell puts to buy stocks at discount',
        howItWorks: 'Sells OTM puts on stocks you want to own. Collects premium. May get assigned at lower price.',
        confidence: 80,
        expectedReturn: '10-20% APY',
        riskLevel: 'medium',
        configKey: 'enable_cash_secured_puts',
        icon: Wallet,
        color: 'bg-green-500/20 text-green-400',
        platforms: ['TD Ameritrade', 'Interactive Brokers', 'Tastytrade'],
        keyPoints: [
          'Keep cash = strike × 100 reserved',
          'Sell OTM put (30 delta typical)',
          'Premium = income if not assigned',
          'Assignment = buy shares at discount',
          'Win-win: either income or cheap shares',
          'Best on stocks you want to own',
        ],
        workflow: [
          'Identify stocks you want to own',
          'Reserve cash = strike × 100',
          'Select strike 30 delta OTM',
          'Choose 30-45 DTE expiration',
          'Sell put option, collect premium',
          'If assigned, buy shares at strike',
          'If expires worthless, keep premium',
          'Repeat for continuous income',
        ],
        requirements: ['Options-enabled broker'],
        settings: [
          { key: 'csp_days_to_expiry', label: 'Days to Expiry', type: 'number', defaultValue: 30, min: 7, max: 60, step: 7 },
          { key: 'csp_delta_target', label: 'Delta Target', type: 'number', defaultValue: -0.3, min: -0.5, max: -0.1, step: 0.05 },
        ],
      },
      {
        id: 'iron_condor',
        name: 'Iron Condor',
        description: 'Profit from low volatility, range-bound markets',
        howItWorks: 'Sells OTM call spread + OTM put spread. Profits if price stays within range.',
        confidence: 70,
        expectedReturn: '15-30% APY',
        riskLevel: 'medium',
        configKey: 'enable_iron_condor',
        icon: BarChart3,
        color: 'bg-blue-500/20 text-blue-400',
        platforms: ['TD Ameritrade', 'Interactive Brokers', 'Tastytrade'],
        keyPoints: [
          'Sell OTM call spread above current price',
          'Sell OTM put spread below current price',
          'Max profit = total premium collected',
          'Max loss = wing width - premium',
          'Best in low IV, range-bound markets',
          'Profit zone = between short strikes',
        ],
        workflow: [
          'Identify range-bound underlying',
          'Check IV rank (prefer high IV)',
          'Sell call spread (short call + long call)',
          'Sell put spread (short put + long put)',
          'Collect net premium',
          'Manage at 50% profit or 21 DTE',
          'Close or roll if tested',
        ],
        requirements: ['Options-enabled broker', 'Level 3 options'],
        settings: [
          { key: 'iron_condor_days_to_expiry', label: 'Days to Expiry', type: 'number', defaultValue: 45, min: 14, max: 60, step: 7 },
          { key: 'iron_condor_wing_width', label: 'Wing Width', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
        ],
      },
      {
        id: 'wheel_strategy',
        name: 'Wheel Strategy',
        description: 'Sell puts → get assigned → sell calls → repeat',
        howItWorks: 'Continuous cycle: sell CSP until assigned, then sell covered calls until called away. Repeat.',
        confidence: 80,
        expectedReturn: '15-25% APY',
        riskLevel: 'medium',
        configKey: 'enable_wheel_strategy',
        icon: Repeat,
        color: 'bg-orange-500/20 text-orange-400',
        platforms: ['TD Ameritrade', 'Interactive Brokers', 'Tastytrade'],
        keyPoints: [
          'The "Wheel": CSP → assignment → CC → called away → repeat',
          'Continuous premium income machine',
          'Need capital = 100 × strike reserved',
          'Works best on stable, dividend stocks',
          'Combines CSP and covered call benefits',
          'True passive income strategy',
        ],
        workflow: [
          'Start: Sell cash-secured put on quality stock',
          'If not assigned: keep premium, sell another',
          'If assigned: now own 100 shares',
          'Sell covered call against shares',
          'If not called away: keep premium, sell another',
          'If called away: sell shares, collect premium',
          'Return to step 1, repeat cycle',
        ],
        requirements: ['Options-enabled broker', '$10K+ capital'],
        settings: [
          { key: 'wheel_position_size_usd', label: 'Position Size $', type: 'number', defaultValue: 5000, min: 1000, max: 50000, step: 1000 },
        ],
      },
    ],
  },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function StrategiesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: config, isLoading } = useBotConfig();

  // State
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['prediction-core']));
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  // Sync config when loaded
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async (newConfig: Record<string, unknown>) => {
      if (!config?.id) throw new Error('Implementation Error: Missing config ID');

      const { error } = await supabase
        .from('polybot_config')
        .upsert({
          ...newConfig,
          id: config.id, // CRITICAL FIX: Use actual config ID, not hardcoded 1
          user_id: user?.id, // Ensure user ownership
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: Error) => {
      console.error('Save failed:', error);
      setSaveError(error.message || 'Failed to save settings');
      setTimeout(() => setSaveError(null), 5000);
    },
  });

  // Handlers
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleStrategyExpand = (strategyId: string) => {
    setExpandedStrategies(prev => {
      const next = new Set(prev);
      if (next.has(strategyId)) next.delete(strategyId);
      else next.add(strategyId);
      return next;
    });
  };

  const isStrategyEnabled = (strategy: Strategy): boolean => {
    const value = localConfig[strategy.configKey];
    // Handle inverted toggle (overlapping_arb uses skip_same_platform_overlap)
    if (strategy.configKey === 'skip_same_platform_overlap') {
      return value === false;
    }
    return value === true;
  };

  const toggleStrategy = (strategy: Strategy) => {
    const currentValue = isStrategyEnabled(strategy);
    let newValue: boolean;

    if (strategy.configKey === 'skip_same_platform_overlap') {
      newValue = currentValue; // Invert: enable = false, disable = true
    } else {
      newValue = !currentValue;
    }

    setLocalConfig(prev => ({ ...prev, [strategy.configKey]: newValue }));
  };

  const updateSetting = (key: string, value: number | string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig.mutateAsync(localConfig);
    } finally {
      setSaving(false);
    }
  };

  // Count enabled strategies
  const enabledCount = STRATEGY_CATEGORIES.flatMap(c => c.strategies)
    .filter(s => isStrategyEnabled(s)).length;
  const totalCount = STRATEGY_CATEGORIES.flatMap(c => c.strategies).length;

  // Filter strategies based on tab
  const filterStrategies = (strategies: Strategy[]) => {
    if (activeTab === 'enabled') return strategies.filter(s => isStrategyEnabled(s));
    if (activeTab === 'disabled') return strategies.filter(s => !isStrategyEnabled(s));
    return strategies;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pb-20 md:pb-0">
      {/* Header */}
      <div className="border-b border-dark-border bg-dark-card/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Trading Strategies (v1.1.91)</h1>
              <p className="text-dark-muted text-sm mt-1">
                {enabledCount} of {totalCount} strategies enabled
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Tab filter */}
              <div className="flex bg-dark-bg rounded-lg p-1">
                {(['all', 'enabled', 'disabled'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                      activeTab === tab
                        ? 'bg-dark-card text-white'
                        : 'text-dark-muted hover:text-white'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "hidden md:flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                  saving ? "bg-dark-border text-dark-muted" :
                    saveSuccess ? "bg-green-500 text-white" :
                      "bg-neon-green text-black hover:bg-neon-green/90",
                  saveError && "bg-red-500"
                )}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-muted border-t-white" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Categories */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {STRATEGY_CATEGORIES.map(category => {
          const filteredStrategies = filterStrategies(category.strategies);
          if (filteredStrategies.length === 0) return null;

          const isExpanded = expandedCategories.has(category.id);
          const enabledInCategory = category.strategies.filter(s => isStrategyEnabled(s)).length;

          return (
            <div key={category.id} className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-dark-bg/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-gradient-to-r', category.color)}>
                    <category.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-semibold text-white">{category.name}</h2>
                    <p className="text-xs text-dark-muted">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-dark-muted">
                    {enabledInCategory}/{category.strategies.length} enabled
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-dark-muted" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-dark-muted" />
                  )}
                </div>
              </button>

              {/* Strategies */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="border-t border-dark-border divide-y divide-dark-border">
                      {filteredStrategies.map(strategy => {
                        const enabled = isStrategyEnabled(strategy);
                        const isStratExpanded = expandedStrategies.has(strategy.id);

                        return (
                          <div key={strategy.id} className={cn(
                            'transition-colors',
                            enabled ? 'bg-dark-bg/30' : ''
                          )}>
                            {/* Strategy Row */}
                            <div className="px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={cn('p-1.5 rounded-lg', strategy.color)}>
                                  <strategy.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => setSelectedStrategy(strategy)}
                                      className="font-medium text-white text-sm hover:text-neon-green transition-colors text-left"
                                    >
                                      {strategy.name}
                                    </button>
                                    <ConfidenceBadge confidence={strategy.confidence} />
                                    <RiskBadge level={strategy.riskLevel} />
                                  </div>
                                  <p className="text-xs text-dark-muted truncate">{strategy.description}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 ml-4">
                                <span className="text-xs text-dark-muted hidden sm:block">
                                  {strategy.expectedReturn}
                                </span>
                                {/* View Details Button */}
                                <button
                                  onClick={() => setSelectedStrategy(strategy)}
                                  className="p-1.5 hover:bg-dark-border rounded transition-colors text-blue-400 hover:text-blue-300"
                                  title="View full details"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                <ToggleSwitch
                                  enabled={enabled}
                                  onToggle={() => toggleStrategy(strategy)}
                                  disabled={!isAdmin}
                                  size="sm"
                                />
                                <button
                                  onClick={() => toggleStrategyExpand(strategy.id)}
                                  className="p-1 hover:bg-dark-border rounded transition-colors"
                                  title="Expand settings"
                                >
                                  {isStratExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-dark-muted" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-dark-muted" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Strategy Details */}
                            <AnimatePresence>
                              {isStratExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-dark-border bg-dark-bg/50"
                                >
                                  <div className="px-4 py-4 space-y-4">
                                    {/* How it works */}
                                    <div>
                                      <h4 className="text-xs font-medium text-dark-muted uppercase tracking-wider mb-2">
                                        How It Works
                                      </h4>
                                      <p className="text-sm text-gray-300">{strategy.howItWorks}</p>
                                    </div>

                                    {/* Requirements */}
                                    {strategy.requirements && strategy.requirements.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-medium text-dark-muted uppercase tracking-wider mb-2">
                                          Requirements
                                        </h4>
                                        <ul className="text-sm text-gray-400 space-y-1">
                                          {strategy.requirements.map((req, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                              <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                              {req}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Settings */}
                                    {strategy.settings && strategy.settings.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-medium text-dark-muted uppercase tracking-wider mb-3">
                                          Settings
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {strategy.settings.map(setting => (
                                            <div key={setting.key}>
                                              <label className="text-xs text-gray-400 block mb-1">
                                                {setting.label}
                                              </label>
                                              <input
                                                type={setting.type}
                                                value={(localConfig[setting.key] as number | string) ?? setting.defaultValue}
                                                onChange={(e) => updateSetting(
                                                  setting.key,
                                                  setting.type === 'number'
                                                    ? parseFloat(e.target.value)
                                                    : e.target.value
                                                )}
                                                min={setting.min}
                                                max={setting.max}
                                                step={setting.step}
                                                disabled={!isAdmin}
                                                className="w-full bg-dark-border border border-dark-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-neon-green disabled:opacity-50"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom Save Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-dark-card border-t border-dark-border p-4 md:hidden z-20">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
            saving ? "bg-dark-border text-dark-muted" :
              saveSuccess ? "bg-green-500 text-white" :
                "bg-neon-green text-black"
          )}
        >
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Strategy Detail Modal (same as workflows page) */}
      <AnimatePresence>
        {selectedStrategy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedStrategy(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-xl', selectedStrategy.color)}>
                    <selectedStrategy.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedStrategy.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <RiskBadge level={selectedStrategy.riskLevel} />
                      <ConfidenceBadge confidence={selectedStrategy.confidence} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="text-gray-400 hover:text-white p-1"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-bg rounded-xl p-4 text-center">
                  <div className={cn(
                    "text-3xl font-bold",
                    selectedStrategy.confidence >= 85 ? "text-green-400" :
                      selectedStrategy.confidence >= 70 ? "text-yellow-400" : "text-orange-400"
                  )}>
                    {selectedStrategy.confidence}%
                  </div>
                  <div className="text-sm text-gray-400">Confidence</div>
                </div>
                <div className="bg-dark-bg rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">{selectedStrategy.expectedReturn}</div>
                  <div className="text-sm text-gray-400">Expected APY</div>
                </div>
                <div className="bg-dark-bg rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">{selectedStrategy.platforms?.length || 1}</div>
                  <div className="text-sm text-gray-400">Platforms</div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Description
                </h3>
                <p className="text-gray-300 leading-relaxed">{selectedStrategy.howItWorks}</p>
              </div>

              {/* Key Points */}
              {selectedStrategy.keyPoints && selectedStrategy.keyPoints.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
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
              )}

              {/* Platforms */}
              {selectedStrategy.platforms && selectedStrategy.platforms.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Platforms Used
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedStrategy.platforms.map((platform) => (
                      <span key={platform} className="px-3 py-1 bg-dark-bg rounded-full text-sm text-gray-300">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {selectedStrategy.requirements && selectedStrategy.requirements.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
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
              )}

              {/* Workflow */}
              {selectedStrategy.workflow && selectedStrategy.workflow.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-white">
                    <GitBranch className="w-5 h-5 text-cyan-400" />
                    Execution Workflow
                  </h3>
                  <div className="relative">
                    <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-purple-500/50" />
                    <div className="space-y-3">
                      {selectedStrategy.workflow.map((step, i) => (
                        <div key={i} className="flex items-start gap-4 pl-1">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10",
                            i === 0 ? 'bg-cyan-500' :
                              i === selectedStrategy.workflow!.length - 1 ? 'bg-purple-500' :
                                'bg-blue-500'
                          )}>
                            {i + 1}
                          </div>
                          <div className="text-gray-300 text-sm leading-relaxed">{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Config Key */}
              <div className="p-4 bg-dark-bg rounded-xl mb-6">
                <div className="text-xs text-gray-400 mb-1">Config Key (polybot_config)</div>
                <code className="text-sm text-green-400">{selectedStrategy.configKey}</code>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-dark-border">
                <Link
                  href="/secrets"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 transition-colors py-3 rounded-xl text-center font-medium text-white"
                >
                  Configure API Keys
                </Link>
                <button
                  onClick={() => {
                    toggleStrategy(selectedStrategy);
                    setSelectedStrategy(null);
                  }}
                  disabled={!isAdmin}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-center font-medium transition-colors",
                    isStrategyEnabled(selectedStrategy)
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-neon-green hover:bg-neon-green/90 text-black"
                  )}
                >
                  {isStrategyEnabled(selectedStrategy) ? 'Disable Strategy' : 'Enable Strategy'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
