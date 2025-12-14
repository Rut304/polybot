'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  ChevronDown, 
  ChevronRight,
  Activity,
  Target,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStrategyPerformance } from '@/lib/hooks';
import { formatCurrency, formatPercent, cn, timeAgo } from '@/lib/utils';

// Strategy display config
const STRATEGY_CONFIG: Record<string, { name: string; color: string; icon: React.ElementType }> = {
  'kalshi_single': { name: 'Kalshi Single Platform', color: '#00C853', icon: Target },
  'poly_single': { name: 'Polymarket Single Platform', color: '#5865F2', icon: Activity },
  'polymarket_single': { name: 'Polymarket Single Platform', color: '#5865F2', icon: Activity },
  'cross_platform': { name: 'Cross-Platform Arbitrage', color: '#8b5cf6', icon: Zap },
  'whale_copy': { name: 'Whale Copy Trading', color: '#06b6d4', icon: Activity },
  'whale_copy_trading': { name: 'Whale Copy Trading', color: '#06b6d4', icon: Activity },
  'congressional': { name: 'Congressional Tracker', color: '#f59e0b', icon: Activity },
  'congressional_tracker': { name: 'Congressional Tracker', color: '#f59e0b', icon: Activity },
  'btc_bracket': { name: 'BTC Bracket Arb', color: '#ea580c', icon: Target },
  'btc_bracket_arb': { name: 'BTC Bracket Arb', color: '#ea580c', icon: Target },
  'bracket_compression': { name: 'Bracket Compression', color: '#8b5cf6', icon: BarChart3 },
  'kalshi_mention': { name: 'Kalshi Mention Snipe', color: '#14b8a6', icon: Zap },
  'kalshi_mention_snipe': { name: 'Kalshi Mention Snipe', color: '#14b8a6', icon: Zap },
  'macro_board': { name: 'Macro Board', color: '#10b981', icon: BarChart3 },
  'fear_premium': { name: 'Fear Premium Contrarian', color: '#ef4444', icon: Activity },
  'fear_premium_contrarian': { name: 'Fear Premium Contrarian', color: '#ef4444', icon: Activity },
  'funding_rate': { name: 'Funding Rate Arb', color: '#eab308', icon: Target },
  'funding_rate_arb': { name: 'Funding Rate Arb', color: '#eab308', icon: Target },
  'grid_trading': { name: 'Grid Trading', color: '#14b8a6', icon: BarChart3 },
  'pairs_trading': { name: 'Pairs Trading', color: '#ec4899', icon: Activity },
  'market_making': { name: 'Market Making', color: '#a855f7', icon: BarChart3 },
  'news_arbitrage': { name: 'News Arbitrage', color: '#f97316', icon: Zap },
  'overlapping_arb': { name: 'Overlapping Arb', color: '#3b82f6', icon: Target },
  'manual': { name: 'Manual Trades', color: '#fbbf24', icon: BarChart3 },
  'unknown': { name: 'Unknown Strategy', color: '#6b7280', icon: BarChart3 },
};

function getStrategyConfig(strategy: string) {
  const normalizedStrategy = strategy.toLowerCase().replace(/-/g, '_');
  return STRATEGY_CONFIG[normalizedStrategy] || {
    name: strategy.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: '#00d4ff',
    icon: BarChart3,
  };
}

interface StrategyCardProps {
  strategy: string;
  trading_mode: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  total_pnl: number;
  avg_trade_pnl: number;
  best_trade: number;
  worst_trade: number;
  first_trade_at: string;
  last_trade_at: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function StrategyCard({
  strategy,
  trading_mode,
  total_trades,
  winning_trades,
  losing_trades,
  win_rate_pct,
  total_pnl,
  avg_trade_pnl,
  best_trade,
  worst_trade,
  first_trade_at,
  last_trade_at,
  isExpanded,
  onToggle,
}: StrategyCardProps) {
  const config = getStrategyConfig(strategy);
  const Icon = config.icon;
  const isProfitable = total_pnl >= 0;
  
  return (
    <motion.div 
      layout
      className="bg-dark-card border border-dark-border rounded-xl overflow-hidden"
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-dark-border/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">{config.name}</h3>
            <p className="text-xs text-gray-500">
              {total_trades} trades • Last: {timeAgo(last_trade_at)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Quick stats */}
          <div className="text-right hidden sm:block">
            <p className={cn(
              "text-lg font-bold",
              isProfitable ? "text-neon-green" : "text-red-400"
            )}>
              {isProfitable ? '+' : ''}{formatCurrency(total_pnl)}
            </p>
            <p className="text-xs text-gray-500">
              {win_rate_pct.toFixed(0)}% win rate
            </p>
          </div>
          
          {/* Expand/collapse */}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 bg-dark-bg/50 border-t border-dark-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Win/Loss */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Win / Loss</p>
                  <p className="text-lg font-semibold">
                    <span className="text-neon-green">{winning_trades}</span>
                    <span className="text-gray-500"> / </span>
                    <span className="text-red-400">{losing_trades}</span>
                  </p>
                </div>
                
                {/* Win Rate */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-lg font-semibold",
                      win_rate_pct >= 60 ? "text-neon-green" : 
                      win_rate_pct >= 40 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {win_rate_pct.toFixed(1)}%
                    </p>
                    <div className="flex-1 h-2 bg-dark-border rounded-full overflow-hidden max-w-[60px]">
                      <div 
                        className="h-full bg-neon-green rounded-full"
                        style={{ width: `${Math.min(win_rate_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Avg Trade */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg Trade</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    avg_trade_pnl >= 0 ? "text-neon-green" : "text-red-400"
                  )}>
                    {avg_trade_pnl >= 0 ? '+' : ''}{formatCurrency(avg_trade_pnl)}
                  </p>
                </div>
                
                {/* Total P&L */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total P&L</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    total_pnl >= 0 ? "text-neon-green" : "text-red-400"
                  )}>
                    {total_pnl >= 0 ? '+' : ''}{formatCurrency(total_pnl)}
                  </p>
                </div>
              </div>
              
              {/* Best/Worst trades */}
              <div className="mt-4 pt-4 border-t border-dark-border grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-neon-green" />
                  <span className="text-sm text-gray-400">Best:</span>
                  <span className="text-sm font-semibold text-neon-green">
                    +{formatCurrency(best_trade)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-400">Worst:</span>
                  <span className="text-sm font-semibold text-red-400">
                    {formatCurrency(worst_trade)}
                  </span>
                </div>
              </div>
              
              {/* Time range */}
              <div className="mt-3 text-xs text-gray-500">
                First trade: {new Date(first_trade_at).toLocaleDateString()} • 
                Last: {new Date(last_trade_at).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface StrategyBreakdownProps {
  tradingMode?: 'paper' | 'live';
  showTitle?: boolean;
}

export function StrategyBreakdown({ tradingMode, showTitle = true }: StrategyBreakdownProps) {
  const { data: strategies = [], isLoading } = useStrategyPerformance(tradingMode);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  
  // Sort by total P&L (most profitable first)
  const sortedStrategies = [...strategies].sort((a, b) => b.total_pnl - a.total_pnl);
  
  // Calculate totals
  const totals = strategies.reduce((acc, s) => ({
    trades: acc.trades + s.total_trades,
    pnl: acc.pnl + s.total_pnl,
    wins: acc.wins + s.winning_trades,
    losses: acc.losses + s.losing_trades,
  }), { trades: 0, pnl: 0, wins: 0, losses: 0 });
  
  const overallWinRate = totals.wins + totals.losses > 0 
    ? (totals.wins / (totals.wins + totals.losses)) * 100 
    : 0;
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 bg-dark-border rounded" />
        <div className="h-24 bg-dark-border rounded-xl" />
        <div className="h-24 bg-dark-border rounded-xl" />
      </div>
    );
  }
  
  if (strategies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No strategy data available yet.</p>
        <p className="text-sm">Start trading to see per-strategy performance.</p>
      </div>
    );
  }
  
  return (
    <div>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-purple" />
            Strategy Performance
          </h2>
          <div className="text-sm text-gray-400">
            <span className={cn(totals.pnl >= 0 ? "text-neon-green" : "text-red-400")}>
              {totals.pnl >= 0 ? '+' : ''}{formatCurrency(totals.pnl)}
            </span>
            <span className="mx-2">•</span>
            <span>{overallWinRate.toFixed(0)}% win rate</span>
            <span className="mx-2">•</span>
            <span>{totals.trades} trades</span>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {sortedStrategies.map((strat) => (
          <StrategyCard
            key={`${strat.trading_mode}:${strat.strategy}`}
            {...strat}
            isExpanded={expandedStrategy === `${strat.trading_mode}:${strat.strategy}`}
            onToggle={() => setExpandedStrategy(
              expandedStrategy === `${strat.trading_mode}:${strat.strategy}` 
                ? null 
                : `${strat.trading_mode}:${strat.strategy}`
            )}
          />
        ))}
      </div>
    </div>
  );
}
