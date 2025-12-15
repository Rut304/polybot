'use client';

import { useState, useEffect } from 'react';
import { 
  Zap, DollarSign, Clock, Save, ChevronDown, ChevronRight, CheckCircle2, 
  AlertTriangle, TrendingUp, Target, Landmark, Brain, Crown, Activity, 
  Shield, BarChart3, Newspaper, Users, Grid3X3, Repeat, LineChart,
  Wallet, Globe, Flame, BookOpen, ArrowLeftRight, Bitcoin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBotConfig } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

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
        settings: [],
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
        settings: [
          { key: 'news_min_spread_pct', label: 'Min Spread %', type: 'number', defaultValue: 3, min: 1, max: 20, step: 0.5 },
          { key: 'news_max_lag_minutes', label: 'Max Lag (min)', type: 'number', defaultValue: 30, min: 5, max: 120, step: 5 },
          { key: 'news_position_size_usd', label: 'Position Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
        ],
      },
      {
        id: 'market_making',
        name: 'Market Making',
        description: 'Provide liquidity and earn spread on prediction markets',
        howItWorks: 'Places bid/ask orders on both sides of markets. Earns the spread when both sides fill.',
        confidence: 80,
        expectedReturn: '10-20% APR',
        riskLevel: 'medium',
        configKey: 'enable_market_making',
        icon: BarChart3,
        color: 'bg-indigo-500/20 text-indigo-400',
        settings: [
          { key: 'mm_target_spread_bps', label: 'Target Spread (bps)', type: 'number', defaultValue: 200, min: 50, max: 500, step: 10 },
          { key: 'mm_order_size_usd', label: 'Order Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
          { key: 'mm_max_inventory_usd', label: 'Max Inventory $', type: 'number', defaultValue: 500, min: 100, max: 5000, step: 100 },
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
        settings: [
          { key: 'whale_copy_min_win_rate', label: 'Min Win Rate %', type: 'number', defaultValue: 80, min: 50, max: 100, step: 5 },
          { key: 'whale_copy_delay_seconds', label: 'Copy Delay (sec)', type: 'number', defaultValue: 30, min: 5, max: 300, step: 5 },
          { key: 'whale_copy_max_size_usd', label: 'Max Size $', type: 'number', defaultValue: 50, min: 10, max: 500, step: 10 },
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
        settings: [
          { key: 'kalshi_snipe_min_mentions', label: 'Min Mentions', type: 'number', defaultValue: 10, min: 5, max: 100, step: 5 },
          { key: 'kalshi_snipe_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 100, min: 25, max: 500, step: 25 },
        ],
      },
      {
        id: 'btc_bracket_arb',
        name: 'BTC Bracket Arbitrage',
        description: 'Arbitrage BTC price brackets on Kalshi',
        howItWorks: 'Finds mispriced BTC price brackets. If brackets don\'t sum to 100%, buys all brackets for guaranteed profit.',
        confidence: 85,
        expectedReturn: '20-50% APY',
        riskLevel: 'low',
        configKey: 'enable_btc_bracket_arb',
        icon: Bitcoin,
        color: 'bg-orange-500/20 text-orange-400',
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
        settings: [
          { key: 'bracket_max_imbalance_threshold', label: 'Max Imbalance', type: 'number', defaultValue: 0.3, min: 0.1, max: 0.5, step: 0.05 },
          { key: 'bracket_take_profit_pct', label: 'Take Profit %', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
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
        requirements: ['Crypto exchange API (Binance/Bybit)', 'Futures trading enabled'],
        settings: [
          { key: 'funding_min_rate_pct', label: 'Min Rate %', type: 'number', defaultValue: 0.03, min: 0.01, max: 0.1, step: 0.01 },
          { key: 'funding_min_apy', label: 'Min APY %', type: 'number', defaultValue: 30, min: 10, max: 100, step: 5 },
          { key: 'funding_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 1000, min: 100, max: 10000, step: 100 },
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
        requirements: ['Crypto exchange API', 'Margin trading enabled'],
        settings: [
          { key: 'pairs_z_score_entry', label: 'Z-Score Entry', type: 'number', defaultValue: 2, min: 1.5, max: 3, step: 0.1 },
          { key: 'pairs_z_score_exit', label: 'Z-Score Exit', type: 'number', defaultValue: 0.5, min: 0, max: 1, step: 0.1 },
          { key: 'pairs_max_position_usd', label: 'Max Position $', type: 'number', defaultValue: 500, min: 100, max: 5000, step: 100 },
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
        requirements: ['Stock broker API'],
        settings: [
          { key: 'earnings_min_surprise_pct', label: 'Min Surprise %', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
        ],
      },
    ],
  },
  {
    id: 'options',
    name: '🎰 Options Strategies',
    description: 'Income-generating options strategies',
    icon: Shield,
    color: 'from-purple-500 to-violet-500',
    strategies: [
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
  const [activeTab, setActiveTab] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Sync config when loaded
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);
  
  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async (newConfig: Record<string, unknown>) => {
      const { error } = await supabase
        .from('polybot_config')
        .upsert({ id: 1, ...newConfig });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
              <h1 className="text-2xl font-bold text-white">Trading Strategies</h1>
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
                disabled={saving || !isAdmin}
                className={cn(
                  "hidden md:flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                  saving ? "bg-dark-border text-dark-muted" :
                  saveSuccess ? "bg-green-500 text-white" :
                  "bg-neon-green text-black hover:bg-neon-green/90",
                  !isAdmin && "opacity-50 cursor-not-allowed"
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
                                    <h3 className="font-medium text-white text-sm">{strategy.name}</h3>
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
                                <ToggleSwitch
                                  enabled={enabled}
                                  onToggle={() => toggleStrategy(strategy)}
                                  disabled={!isAdmin}
                                  size="sm"
                                />
                                <button
                                  onClick={() => toggleStrategyExpand(strategy.id)}
                                  className="p-1 hover:bg-dark-border rounded transition-colors"
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
          disabled={saving || !isAdmin}
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
    </div>
  );
}
