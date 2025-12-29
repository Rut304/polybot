'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Settings,
  CheckCircle2,
  TrendingDown,
  BrainCircuit,
  Sliders,
  Info,
  XCircle,
  RotateCcw,
  Clock,
  DollarSign,
  Target,
  Lightbulb,
  ChevronRight,
  Shield,
  RefreshCw,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, timeAgo, cn } from '@/lib/utils';
import { Tooltip } from '@/components/Tooltip';
import { ProFeature } from '@/components/FeatureGate';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// Failed trade reasons - these are actual losses/failures
const FAILED_TRADE_STATUSES = [
  'execution_failed',
  'timeout',
  'slippage_exceeded',
  'insufficient_balance',
  'api_error',
  'rejected',
  'canceled',
  'expired',
  'failed_execution',
  'lost',
];

interface FailedTrade {
  id: number;
  created_at: string;
  platform: string;
  market_title: string;
  outcome: string;
  expected_profit_usd: number;
  actual_profit_usd: number;
  position_size_usd: number;
  skip_reason?: string;
  error_message?: string;
  strategy_type?: string;
  can_retry?: boolean;
}

interface OptimizationOpportunity {
  id: string;
  type: 'config_tuning' | 'strategy_suggestion' | 'risk_management';
  title: string;
  description: string;
  potential_impact: number;
  confidence: 'high' | 'medium' | 'low';
  actionPath?: string;
  autoFix?: Record<string, unknown>;
}

function TradingOptimizationsContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'failed' | 'optimization'>('failed');
  const [timeframeHours, setTimeframeHours] = useState(24);

  // Fetch failed trades from the database
  const { data: failedTrades = [], isLoading: loadingTrades, refetch: refetchTrades } = useQuery({
    queryKey: ['failed-trades', user?.id, timeframeHours],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('polybot_trades')
        .select('*')
        .eq('user_id', user.id)
        .in('outcome', FAILED_TRADE_STATUSES)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching failed trades:', error);
        return [];
      }
      
      return (data || []).map(trade => ({
        ...trade,
        can_retry: ['execution_failed', 'timeout', 'api_error'].includes(trade.outcome),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch optimization suggestions based on trade history analysis
  const { data: optimizations = [], isLoading: loadingOpts } = useQuery({
    queryKey: ['optimization-suggestions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Analyze recent trades to generate optimization suggestions
      const { data: recentTrades } = await supabase
        .from('polybot_trades')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);
      
      const { data: config } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      const suggestions: OptimizationOpportunity[] = [];
      
      if (!recentTrades || recentTrades.length === 0) {
        suggestions.push({
          id: 'no-data',
          type: 'strategy_suggestion',
          title: 'Start Trading to Get Insights',
          description: 'Run some trades in simulation mode to get personalized optimization suggestions based on your trading patterns.',
          potential_impact: 0,
          confidence: 'medium',
          actionPath: '/settings',
        });
        return suggestions;
      }
      
      // Analyze win rate
      const wins = recentTrades.filter(t => t.outcome === 'won').length;
      const total = recentTrades.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      
      if (winRate < 50 && total >= 10) {
        suggestions.push({
          id: 'low-win-rate',
          type: 'config_tuning',
          title: 'Win Rate Below Target',
          description: `Your win rate is ${winRate.toFixed(1)}% over the last ${total} trades. Consider tightening entry criteria or adjusting position sizing.`,
          potential_impact: (50 - winRate) * 10,
          confidence: 'high',
          actionPath: '/strategies',
        });
      }
      
      // Analyze slippage
      const slippageTrades = recentTrades.filter(t => t.slippage_pct && t.slippage_pct > 1);
      if (slippageTrades.length > total * 0.2) {
        suggestions.push({
          id: 'high-slippage',
          type: 'risk_management',
          title: 'High Slippage Detected',
          description: `${slippageTrades.length} trades had slippage >1%. Consider using limit orders or smaller position sizes.`,
          potential_impact: slippageTrades.reduce((sum, t) => sum + (t.slippage_pct || 0), 0),
          confidence: 'high',
          actionPath: '/settings',
        });
      }
      
      // Analyze timing
      const hourCounts: Record<number, { wins: number; total: number }> = {};
      recentTrades.forEach(t => {
        const hour = new Date(t.created_at).getHours();
        if (!hourCounts[hour]) hourCounts[hour] = { wins: 0, total: 0 };
        hourCounts[hour].total++;
        if (t.outcome === 'won') hourCounts[hour].wins++;
      });
      
      const bestHours = Object.entries(hourCounts)
        .filter(([, v]) => v.total >= 3 && v.wins / v.total > 0.6)
        .map(([h]) => parseInt(h));
      
      if (bestHours.length > 0) {
        suggestions.push({
          id: 'timing-optimization',
          type: 'strategy_suggestion',
          title: 'Optimal Trading Hours',
          description: `Your best trading hours are ${bestHours.slice(0, 3).join(', ')} UTC. Consider focusing trading during these windows.`,
          potential_impact: 15,
          confidence: 'medium',
        });
      }
      
      // Position sizing check
      if (config?.max_position_pct && config.max_position_pct > 5) {
        suggestions.push({
          id: 'position-sizing',
          type: 'risk_management',
          title: 'Consider Smaller Positions',
          description: `Your max position is ${config.max_position_pct}% of balance. Reducing to 3-5% can improve risk-adjusted returns.`,
          potential_impact: 10,
          confidence: 'medium',
          autoFix: { max_position_pct: 5 },
        });
      }
      
      return suggestions;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Retry a failed trade
  const retryTrade = useMutation({
    mutationFn: async (tradeId: number) => {
      // This would call the bot API to retry the trade
      const response = await fetch('/api/trades/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      if (!response.ok) throw new Error('Failed to retry trade');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-trades'] });
    },
  });

  // Calculate total lost from failed trades
  const totalLost = useMemo(() => {
    return failedTrades.reduce((sum, t) => sum + Math.abs(t.actual_profit_usd || 0), 0);
  }, [failedTrades]);

  // Group failed trades by reason
  const failuresByReason = useMemo(() => {
    const groups: Record<string, FailedTrade[]> = {};
    failedTrades.forEach(t => {
      const reason = t.outcome || 'unknown';
      if (!groups[reason]) groups[reason] = [];
      groups[reason].push(t);
    });
    return groups;
  }, [failedTrades]);

  const isLoading = loadingTrades || loadingOpts;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
              <Target className="w-8 h-8 text-neon-blue" />
              Trading Optimizations
            </h1>
            <p className="text-gray-400 mt-1">
              Review failed trades and get optimization suggestions
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeframeHours}
            onChange={(e) => setTimeframeHours(parseInt(e.target.value))}
            className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm"
            aria-label="Timeframe selection"
          >
            <option value={24}>Last 24h</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
          <button
            onClick={() => refetchTrades()}
            disabled={isLoading}
            className="p-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-dark-border pb-4">
        <button
          onClick={() => setActiveTab('failed')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
            activeTab === 'failed' 
              ? "bg-red-500/20 border border-red-500/50 text-red-400"
              : "bg-dark-card border border-dark-border text-gray-400 hover:text-white"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          Failed Trades
          {failedTrades.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-red-500/30 rounded-full">{failedTrades.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('optimization')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
            activeTab === 'optimization' 
              ? "bg-neon-blue/20 border border-neon-blue/50 text-neon-blue"
              : "bg-dark-card border border-dark-border text-gray-400 hover:text-white"
          )}
        >
          <Lightbulb className="w-4 h-4" />
          Optimization Insights
          {optimizations.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-neon-blue/30 rounded-full">{optimizations.length}</span>
          )}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Failed Trades
          </p>
          <p className={cn("text-2xl font-bold", failedTrades.length > 0 ? "text-red-400" : "text-gray-500")}>
            {failedTrades.length}
          </p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Total Impact
          </p>
          <p className={cn("text-2xl font-bold", totalLost > 0 ? "text-red-400" : "text-gray-500")}>
            {formatCurrency(totalLost)}
          </p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Suggestions
          </p>
          <p className="text-2xl font-bold text-neon-blue">{optimizations.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Retriable
          </p>
          <p className="text-2xl font-bold text-yellow-400">
            {failedTrades.filter(t => t.can_retry).length}
          </p>
        </div>
      </div>

      {/* Failed Trades Tab Content */}
      {activeTab === 'failed' && (
        <div className="space-y-6">
          {failedTrades.length === 0 ? (
            <div className="card border-dashed border-green-500/30 bg-green-500/5 p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Failed Trades!</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                All your trades in the selected timeframe executed successfully. 
                Your bot is running smoothly.
              </p>
            </div>
          ) : (
            <>
              {/* Failed Trades by Reason */}
              {Object.entries(failuresByReason).map(([reason, trades]) => (
                <div key={reason} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="capitalize">{reason.replace('_', ' ')}</span>
                      <span className="text-gray-500 font-normal">({trades.length})</span>
                    </h3>
                    {trades.some(t => t.can_retry) && (
                      <button
                        onClick={() => trades.filter(t => t.can_retry).forEach(t => retryTrade.mutate(t.id))}
                        disabled={retryTrade.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
                      >
                        <RotateCcw className={cn("w-4 h-4", retryTrade.isPending && "animate-spin")} />
                        Retry All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {trades.slice(0, 5).map(trade => (
                      <div 
                        key={trade.id}
                        className="flex items-center justify-between p-3 bg-dark-bg/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white truncate max-w-[300px]">
                            {trade.market_title}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(trade.created_at)}
                            <span className="text-gray-600">•</span>
                            {trade.platform}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-red-400 font-mono">
                              {formatCurrency(Math.abs(trade.actual_profit_usd || 0))}
                            </p>
                            <p className="text-xs text-gray-500">
                              expected {formatCurrency(trade.expected_profit_usd || 0)}
                            </p>
                          </div>
                          {trade.can_retry && (
                            <button
                              onClick={() => retryTrade.mutate(trade.id)}
                              disabled={retryTrade.isPending}
                              className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                              title="Retry this trade"
                            >
                              <RotateCcw className={cn("w-4 h-4", retryTrade.isPending && "animate-spin")} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {trades.length > 5 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        + {trades.length - 5} more trades
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Optimization Tab Content */}
      {activeTab === 'optimization' && (
        <div className="space-y-4">
          {optimizations.length === 0 ? (
            <div className="card border-dashed border-green-500/30 bg-green-500/5 p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Looking Good!</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                No optimization suggestions at this time. Your trading parameters appear well-tuned.
              </p>
            </div>
          ) : (
            optimizations.map(opt => (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "card border-l-4 relative overflow-hidden",
                  opt.type === 'config_tuning' && "border-l-neon-blue",
                  opt.type === 'strategy_suggestion' && "border-l-neon-purple",
                  opt.type === 'risk_management' && "border-l-yellow-500"
                )}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {opt.type === 'config_tuning' && <Settings className="w-4 h-4 text-neon-blue" />}
                      {opt.type === 'strategy_suggestion' && <BrainCircuit className="w-4 h-4 text-neon-purple" />}
                      {opt.type === 'risk_management' && <Shield className="w-4 h-4 text-yellow-500" />}
                      <h3 className="text-lg font-bold text-white">{opt.title}</h3>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        opt.confidence === 'high' && "bg-green-500/20 text-green-400",
                        opt.confidence === 'medium' && "bg-yellow-500/20 text-yellow-400",
                        opt.confidence === 'low' && "bg-gray-500/20 text-gray-400"
                      )}>
                        {opt.confidence} confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {opt.description}
                    </p>
                    {opt.potential_impact > 0 && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Potential improvement: ~{opt.potential_impact.toFixed(0)}%
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {opt.actionPath && (
                      <Link
                        href={opt.actionPath}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-bg border border-dark-border rounded-lg hover:border-neon-blue transition-colors text-sm"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Default export with tier gate
export default function MissedOpportunitiesPage() {
  return (
    <ProFeature>
      <TradingOptimizationsContent />
    </ProFeature>
  );
}
