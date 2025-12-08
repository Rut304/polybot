'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Activity, Target, DollarSign, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { SimulationStats, SimulatedTrade, Opportunity } from '@/lib/supabase';
import { useBotConfig } from '@/lib/hooks';

interface StatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'balance' | 'pnl' | 'winrate' | 'opportunities';
  stats: SimulationStats | null;
  trades?: SimulatedTrade[];
  opportunities?: Opportunity[];
}

export function StatDetailModal({ isOpen, onClose, type, stats, trades = [], opportunities = [] }: StatDetailModalProps) {
  const statsJson = stats?.stats_json;
  const { data: config } = useBotConfig();
  
  // Calculate total starting balance from config
  const totalStartingBalance = useMemo(() => {
    const polyStarting = config?.polymarket_starting_balance || 20000;
    const kalshiStarting = config?.kalshi_starting_balance || 20000;
    const binanceStarting = config?.binance_starting_balance || 20000;
    const coinbaseStarting = config?.coinbase_starting_balance || 20000;
    const alpacaStarting = config?.alpaca_starting_balance || 20000;
    return polyStarting + kalshiStarting + binanceStarting + coinbaseStarting + alpacaStarting;
  }, [config]);
  
  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  const getTitle = () => {
    switch (type) {
      case 'balance': return 'Balance Details';
      case 'pnl': return 'P&L Breakdown';
      case 'winrate': return 'Win Rate Analysis';
      case 'opportunities': return 'Opportunity Statistics';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'balance': return DollarSign;
      case 'pnl': return TrendingUp;
      case 'winrate': return Target;
      case 'opportunities': return Activity;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'balance': return 'text-neon-green';
      case 'pnl': return 'text-neon-blue';
      case 'winrate': return 'text-neon-purple';
      case 'opportunities': return 'text-neon-pink';
    }
  };

  const Icon = getIcon();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="w-full max-w-2xl bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn("text-xl font-bold flex items-center gap-2", getColor())}>
                  <Icon className="w-6 h-6" />
                  {getTitle()}
                </h2>
                <button
                  onClick={onClose}
                  title="Close modal"
                  className="p-2 rounded-lg hover:bg-dark-border transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                {type === 'balance' && (
                  <BalanceDetails stats={stats} statsJson={statsJson} trades={trades} startingBalance={totalStartingBalance} />
                )}
                {type === 'pnl' && (
                  <PnLDetails stats={stats} statsJson={statsJson} trades={trades} />
                )}
                {type === 'winrate' && (
                  <WinRateDetails stats={stats} statsJson={statsJson} trades={trades} />
                )}
                {type === 'opportunities' && (
                  <OpportunityDetails statsJson={statsJson} opportunities={opportunities} trades={trades} />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BalanceDetails({ stats, statsJson, trades, startingBalance }: { stats: SimulationStats | null; statsJson: SimulationStats['stats_json'] | undefined; trades: SimulatedTrade[]; startingBalance: number }) {
  // Compute from actual trades for accuracy
  const validTrades = trades.filter(t => t.outcome !== 'failed_execution');
  const computedPnL = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
  const expectedTotal = validTrades.reduce((sum, t) => sum + (t.expected_profit_usd || 0), 0);
  const computedFees = Math.max(0, expectedTotal - computedPnL);
  
  const totalPnL = computedPnL || stats?.total_pnl || 0;
  const currentBalance = startingBalance + totalPnL;
  const roiPct = startingBalance > 0 ? (totalPnL / startingBalance) * 100 : 0;
  const totalFees = computedFees || parseFloat(statsJson?.total_fees_paid || '0');
  const balancePct = Math.min(200, (currentBalance / startingBalance) * 100);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Starting Balance" value={formatCurrency(startingBalance)} color="gray" />
        <StatBox label="Current Balance" value={formatCurrency(currentBalance)} color="green" />
        <StatBox label="Total P&L" value={formatCurrency(totalPnL)} color={totalPnL >= 0 ? 'green' : 'red'} />
        <StatBox label="ROI" value={formatPercent(roiPct)} color={roiPct >= 0 ? 'green' : 'red'} />
        <StatBox label="Total Fees Paid" value={formatCurrency(totalFees)} color="yellow" />
        <StatBox label="Net After Fees" value={formatCurrency(totalPnL)} color={totalPnL >= 0 ? 'green' : 'red'} />
      </div>
      
      <div className="bg-dark-border/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Balance Growth</h4>
        <div className="relative h-8 bg-dark-bg rounded-full overflow-hidden">
          <div 
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all",
              balancePct >= 100 ? "bg-gradient-to-r from-neon-green/80 to-neon-green" : "bg-red-500"
            )}
            style={{ width: `${Math.min(100, balancePct)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
            {balancePct.toFixed(1)}% of starting
          </div>
        </div>
      </div>
    </div>
  );
}

function PnLDetails({ stats, statsJson, trades }: { stats: SimulationStats | null; statsJson: SimulationStats['stats_json'] | undefined; trades: SimulatedTrade[] }) {
  // Compute stats from actual trades for accuracy
  const validTrades = trades.filter(t => t.outcome !== 'failed_execution');
  const wonTradesAll = validTrades.filter(t => t.outcome === 'won');
  const lostTradesAll = validTrades.filter(t => t.outcome === 'lost');
  
  // Calculate P&L from actual trade data (net profit after fees)
  const computedPnL = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
  const totalPnL = computedPnL || stats?.total_pnl || 0;
  const totalTrades = validTrades.length || stats?.total_trades || 0;
  
  // Calculate losses (sum of negative actual_profit_usd)
  const computedLosses = Math.abs(lostTradesAll.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0));
  const totalLosses = computedLosses || parseFloat(statsJson?.total_losses || '0');
  
  // Calculate gross profit from expected_profit_usd (before fees) for won trades
  // expected_profit_usd = gross profit before fees
  // actual_profit_usd = net profit after fees
  const totalGrossProfit = wonTradesAll.reduce((sum, t) => sum + (t.expected_profit_usd || 0), 0);
  
  // Fees = Expected profit - Actual profit (the difference is fees + slippage)
  const expectedTotal = validTrades.reduce((sum, t) => sum + (t.expected_profit_usd || 0), 0);
  const computedFees = Math.max(0, expectedTotal - computedPnL);
  const totalFees = computedFees || parseFloat(statsJson?.total_fees_paid || '0');
  
  // Best/worst from actual trades
  const computedBestTrade = validTrades.reduce((best, t) => 
    (t.actual_profit_usd || 0) > best ? (t.actual_profit_usd || 0) : best, 0);
  const computedWorstTrade = validTrades.reduce((worst, t) => 
    (t.actual_profit_usd || 0) < worst ? (t.actual_profit_usd || 0) : worst, 0);
  
  const bestTrade = computedBestTrade || parseFloat(statsJson?.best_trade_profit || '0');
  const worstTrade = computedWorstTrade || parseFloat(statsJson?.worst_trade_loss || '0');
  
  const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
  
  const recentTrades = trades.slice(0, 10);
  const wonTrades = recentTrades.filter(t => t.outcome === 'won').length;
  const lostTrades = recentTrades.filter(t => t.outcome === 'lost').length;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Net P&L" value={formatCurrency(totalPnL)} color={totalPnL >= 0 ? 'green' : 'red'} />
        <StatBox label="Gross Profit" value={formatCurrency(totalGrossProfit)} color="blue" icon={TrendingUp} />
        <StatBox label="Total Losses" value={formatCurrency(totalLosses)} color="red" icon={TrendingDown} />
        <StatBox label="Fees + Slippage" value={formatCurrency(totalFees)} color="yellow" />
        <StatBox label="Avg P&L / Trade" value={formatCurrency(avgPnL)} color={avgPnL >= 0 ? 'green' : 'red'} />
        <StatBox label="# Trades" value={totalTrades.toString()} color="blue" />
        <StatBox label="Best Trade" value={`+${formatCurrency(bestTrade)}`} color="green" icon={TrendingUp} />
        <StatBox label="Worst Trade" value={formatCurrency(worstTrade)} color="red" icon={TrendingDown} />
      </div>

      <div className="bg-dark-border/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Trades (Last 10)</h4>
        <div className="flex gap-1">
          {recentTrades.map((trade, i) => (
            <div
              key={trade.id || i}
              className={cn(
                "flex-1 h-8 rounded transition-all hover:scale-110 cursor-pointer",
                trade.outcome === 'won' ? 'bg-neon-green/60' :
                trade.outcome === 'lost' ? 'bg-red-500/60' :
                'bg-yellow-500/60'
              )}
              title={`${trade.outcome}: ${formatCurrency(trade.actual_profit_usd || 0)}`}
            />
          ))}
          {recentTrades.length === 0 && (
            <p className="text-gray-500 text-sm">No recent trades</p>
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span className="text-neon-green">{wonTrades} Won</span>
          <span className="text-red-400">{lostTrades} Lost</span>
        </div>
      </div>
    </div>
  );
}

function WinRateDetails({ stats, statsJson, trades }: { stats: SimulationStats | null; statsJson: SimulationStats['stats_json'] | undefined; trades: SimulatedTrade[] }) {
  // Compute from actual trades
  const validTrades = trades.filter(t => t.outcome !== 'failed_execution');
  const wonTradesAll = validTrades.filter(t => t.outcome === 'won');
  const lostTradesAll = validTrades.filter(t => t.outcome === 'lost');
  const failedAll = trades.filter(t => t.outcome === 'failed_execution');
  
  const winningTrades = wonTradesAll.length || statsJson?.winning_trades || 0;
  const losingTrades = lostTradesAll.length || statsJson?.losing_trades || 0;
  const totalTrades = winningTrades + losingTrades;
  const failedExecutions = failedAll.length || statsJson?.failed_executions || 0;
  
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : (stats?.win_rate || 0);
  const executionRate = (totalTrades + failedExecutions) > 0 
    ? (totalTrades / (totalTrades + failedExecutions)) * 100 
    : (statsJson?.execution_success_rate_pct || 100);
  
  const winPct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const lossPct = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Win Rate" value={`${winRate.toFixed(1)}%`} color="purple" icon={Target} />
        <StatBox label="Execution Rate" value={`${executionRate.toFixed(1)}%`} color="blue" icon={Zap} />
        <StatBox label="Winning Trades" value={winningTrades.toString()} color="green" icon={CheckCircle2} />
        <StatBox label="Losing Trades" value={losingTrades.toString()} color="red" icon={XCircle} />
        <StatBox label="Failed Executions" value={failedExecutions.toString()} color="yellow" icon={AlertCircle} />
        <StatBox label="Total Attempts" value={(totalTrades + failedExecutions).toString()} color="gray" />
      </div>

      <div className="bg-dark-border/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Win/Loss Distribution</h4>
        <div className="flex gap-2 items-center">
          <div className="flex-1 h-6 bg-dark-bg rounded-full overflow-hidden flex">
            <div 
              className="bg-neon-green h-full transition-all"
              style={{ width: `${winPct}%` }}
            />
            <div 
              className="bg-red-500 h-full transition-all"
              style={{ width: `${lossPct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-neon-green">{winningTrades} Wins ({winPct.toFixed(1)}%)</span>
          <span className="text-red-400">{losingTrades} Losses ({lossPct.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}

function OpportunityDetails({ statsJson, opportunities, trades }: { statsJson: SimulationStats['stats_json'] | undefined; opportunities: Opportunity[]; trades: SimulatedTrade[] }) {
  // Use actual trade count (excluding failed executions)
  const validTrades = trades.filter(t => t.outcome !== 'failed_execution');
  const totalTraded = validTrades.length;
  
  // For total seen, use opportunities array length (current session)
  // If no opportunities in current session, show message
  const totalSeen = opportunities.length;
  const conversionRate = totalSeen > 0 ? (totalTraded / totalSeen) * 100 : 0;
  
  const byStrategy = opportunities.reduce((acc, opp) => {
    const strategy = opp.strategy || 'unknown';
    acc[strategy] = (acc[strategy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const recentOpps = opportunities.slice(0, 5);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Total Seen" value={totalSeen.toString()} color="pink" icon={Activity} />
        <StatBox label="Total Traded" value={totalTraded.toString()} color="green" icon={CheckCircle2} />
        <StatBox label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} color="blue" />
        <StatBox label="Skipped" value={(totalSeen - totalTraded).toString()} color="gray" />
      </div>

      {Object.keys(byStrategy).length > 0 && (
        <div className="bg-dark-border/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">By Strategy</h4>
          <div className="space-y-2">
            {Object.entries(byStrategy).map(([strategy, count]) => (
              <div key={strategy} className="flex items-center justify-between">
                <span className="text-sm text-gray-300 capitalize">{strategy.replace(/_/g, ' ')}</span>
                <span className="text-sm font-medium text-neon-blue">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentOpps.length > 0 && (
        <div className="bg-dark-border/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Opportunities</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentOpps.map((opp, i) => (
              <div key={opp.id || i} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 truncate max-w-[200px]" title={opp.buy_market_name || ''}>
                  {(opp.buy_market_name || 'Unknown').substring(0, 30)}...
                </span>
                <span className="text-neon-green font-medium">
                  {formatPercent(opp.profit_percent || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ 
  label, 
  value, 
  color, 
  icon: Icon 
}: { 
  label: string; 
  value: string; 
  color: 'green' | 'blue' | 'purple' | 'pink' | 'yellow' | 'red' | 'gray';
  icon?: React.ElementType;
}) {
  const colorClasses = {
    green: 'text-neon-green border-neon-green/30',
    blue: 'text-neon-blue border-neon-blue/30',
    purple: 'text-neon-purple border-neon-purple/30',
    pink: 'text-neon-pink border-neon-pink/30',
    yellow: 'text-yellow-400 border-yellow-400/30',
    red: 'text-red-400 border-red-400/30',
    gray: 'text-gray-400 border-gray-500/30',
  };

  return (
    <div className={cn(
      "bg-dark-border/30 rounded-xl p-4 border",
      colorClasses[color]
    )}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 opacity-70" />}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={cn("text-xl font-bold", colorClasses[color].split(' ')[0])}>
        {value}
      </p>
    </div>
  );
}
