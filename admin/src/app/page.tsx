'use client';

import { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  Target,
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  useBotStatus, 
  useSimulationStats, 
  useSimulatedTrades,
  useOpportunities,
  useSimulationHistory,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, timeAgo, isRecent, cn } from '@/lib/utils';
import { PnLChart } from '@/components/charts/PnLChart';
import { OpportunityChart } from '@/components/charts/OpportunityChart';
import { TradesList } from '@/components/TradesList';
import { OpportunitiesFeed } from '@/components/OpportunitiesFeed';
import { StatusIndicator } from '@/components/StatusIndicator';
import { StatDetailModal } from '@/components/StatDetailModal';

export default function Dashboard() {
  const { data: botStatus, isLoading: statusLoading } = useBotStatus();
  const { data: simStats, isLoading: statsLoading } = useSimulationStats();
  const { data: trades } = useSimulatedTrades(20);
  const { data: opportunities } = useOpportunities(50);
  const { data: history } = useSimulationHistory(24);
  
  // Modal state
  const [modalType, setModalType] = useState<'balance' | 'pnl' | 'winrate' | 'opportunities' | null>(null);

  const isOnline = !!(botStatus?.is_running && 
    botStatus?.last_heartbeat_at && 
    isRecent(botStatus.last_heartbeat_at, 30000));

  return (
    <div className="p-8">
      {/* Modal */}
      <StatDetailModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType || 'balance'}
        stats={simStats || null}
        trades={trades || []}
        opportunities={opportunities || []}
      />
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="w-8 h-8 text-neon-green" />
          Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Real-time overview of your arbitrage bot</p>
      </div>
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Simulated Balance"
            value={simStats?.simulated_balance ? formatCurrency(simStats.simulated_balance) : '$1,000.00'}
            change={simStats?.stats_json?.roi_pct}
            icon={DollarSign}
            color="green"
            loading={statsLoading}
            onClick={() => setModalType('balance')}
          />
          <StatCard
            title="Total P&L"
            value={simStats?.total_pnl ? formatCurrency(simStats.total_pnl) : '$0.00'}
            subtitle={simStats?.total_trades ? `${simStats.total_trades} trades` : '0 trades'}
            icon={TrendingUp}
            color="blue"
            loading={statsLoading}
            onClick={() => setModalType('pnl')}
          />
          <StatCard
            title="Win Rate"
            value={simStats?.win_rate ? `${simStats.win_rate.toFixed(1)}%` : '0%'}
            subtitle={`${simStats?.stats_json?.winning_trades || 0}W / ${simStats?.stats_json?.losing_trades || 0}L`}
            icon={Target}
            color="purple"
            loading={statsLoading}
            onClick={() => setModalType('winrate')}
          />
          <StatCard
            title="Opportunities"
            value={simStats?.stats_json?.total_opportunities_seen?.toString() || '0'}
            subtitle="Detected"
            icon={Activity}
            color="pink"
            loading={statsLoading}
            onClick={() => setModalType('opportunities')}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neon-green" />
                P&L Over Time
              </h2>
              <select className="bg-dark-border rounded-lg px-3 py-1 text-sm border-none outline-none">
                <option value="24">24 Hours</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
              </select>
            </div>
            <PnLChart data={history || []} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-neon-blue" />
                Opportunity Distribution
              </h2>
            </div>
            <OpportunityChart data={opportunities || []} />
          </motion.div>
        </div>

        {/* Live Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-neon-yellow" />
                Live Opportunities
              </h2>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                Real-time
              </span>
            </div>
            <OpportunitiesFeed opportunities={opportunities || []} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-neon-purple" />
                Recent Paper Trades
              </h2>
            </div>
            <TradesList trades={trades || []} />
          </motion.div>
        </div>
      </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  change, 
  subtitle,
  icon: Icon, 
  color,
  loading,
  onClick
}: {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'pink';
  loading?: boolean;
  onClick?: () => void;
}) {
  const colorClasses = {
    green: 'text-neon-green glow-green',
    blue: 'text-neon-blue glow-blue',
    purple: 'text-neon-purple glow-purple',
    pink: 'text-neon-pink glow-pink',
  };

  const bgClasses = {
    green: 'bg-neon-green/10',
    blue: 'bg-neon-blue/10',
    purple: 'bg-neon-purple/10',
    pink: 'bg-neon-pink/10',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "card relative overflow-hidden group",
        onClick && "cursor-pointer hover:ring-2 hover:ring-neon-blue/50 transition-all"
      )}
    >
      {/* Background glow effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        bgClasses[color]
      )} />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{title}</p>
            {loading ? (
              <div className="h-8 w-24 bg-dark-border rounded animate-pulse" />
            ) : (
              <p className={cn("text-2xl font-bold", colorClasses[color])}>
                {value}
              </p>
            )}
            {change !== undefined && (
              <p className={cn(
                "text-sm mt-1",
                change >= 0 ? "text-neon-green" : "text-red-400"
              )}>
                {formatPercent(change)} ROI
              </p>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            bgClasses[color]
          )}>
            <Icon className={cn("w-6 h-6", colorClasses[color].split(' ')[0])} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
