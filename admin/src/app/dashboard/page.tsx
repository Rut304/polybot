'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
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
  HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  useBotStatus,
  useSimulationStats,
  useSimulatedTrades,
  useOpportunities,
  usePnLHistory,
  useRealTimeStats,
  useUserExchanges,
} from '@/lib/hooks';
import { formatCurrency, formatPercent, timeAgo, isRecent, cn } from '@/lib/utils';
import { Tooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';
import { TradeDetailsModal, TradeDetails } from '@/components/TradeDetailsModal';
import { Opportunity, SimulatedTrade } from '@/lib/supabase';
import { useTier } from '@/lib/useTier';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { usePlatforms } from '@/lib/PlatformContext';

// Lazy load heavy components to improve LCP
const PnLChart = dynamic(() => import('@/components/charts/PnLChart').then(m => ({ default: m.PnLChart })), {
  loading: () => <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />,
  ssr: false
});
const OpportunityChart = dynamic(() => import('@/components/charts/OpportunityChart').then(m => ({ default: m.OpportunityChart })), {
  loading: () => <div className="h-64 bg-dark-border/30 rounded-lg animate-pulse" />,
  ssr: false
});
const TradesList = dynamic(() => import('@/components/TradesList').then(m => ({ default: m.TradesList })), {
  loading: () => <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
});
const OpportunitiesFeed = dynamic(() => import('@/components/OpportunitiesFeed').then(m => ({ default: m.OpportunitiesFeed })), {
  loading: () => <div className="h-48 bg-dark-border/30 rounded-lg animate-pulse" />
});
const StatDetailModal = dynamic(() => import('@/components/StatDetailModal').then(m => ({ default: m.StatDetailModal })));
const StrategyPerformanceTable = dynamic(() => import('@/components/StrategyPerformanceTable').then(m => ({ default: m.StrategyPerformanceTable })), {
  loading: () => <div className="h-32 bg-dark-border/30 rounded-lg animate-pulse" />
});
const MoneyStatsWidget = dynamic(() => import('@/components/MoneyStatsWidget').then(m => ({ default: m.MoneyStatsWidget })));
const WelcomeBanner = dynamic(() => import('@/components/QuickStartGuide').then(m => ({ default: m.WelcomeBanner })));
const QuickStartFAB = dynamic(() => import('@/components/QuickStartGuide').then(m => ({ default: m.QuickStartFAB })));
const PageCTA = dynamic(() => import('@/components/QuickStartGuide').then(m => ({ default: m.PageCTA })));
const BotHealthIndicator = dynamic(() => import('@/components/BotHealthIndicator').then(m => ({ default: m.BotHealthIndicator })));
const ConnectedExchangesBadge = dynamic(() => import('@/components/ConnectedExchangesBadge').then(m => ({ default: m.ConnectedExchangesBadge })));
const TradingModeBanner = dynamic(() => import('@/components/TradingModeBanner').then(m => ({ default: m.TradingModeBanner })));
const StatusIndicator = dynamic(() => import('@/components/StatusIndicator').then(m => ({ default: m.StatusIndicator })));

// Timeframe options for global selector
const TIMEFRAME_OPTIONS = [
  { value: 1, label: '1 Hour' },
  { value: 6, label: '6 Hours' },
  { value: 24, label: '24 Hours' },
  { value: 168, label: '7 Days' },
  { value: 720, label: '30 Days' },
  { value: 0, label: 'All Time' },
];

// Data view mode options
type ViewMode = 'all' | 'paper' | 'live';

export default function Dashboard() {
  // Global timeframe state - all components use this
  const [globalTimeframeHours, setGlobalTimeframeHours] = useState<number>(24);
  
  // Get current trading mode from bot status first
  const { data: botStatus, isLoading: statusLoading } = useBotStatus();
  const botIsLive = botStatus?.dry_run_mode === false;
  
  // Default view mode to current bot mode (paper or live), NOT "all"
  // This prevents confusing combined data on first load
  const [viewMode, setViewMode] = useState<ViewMode>('paper');
  
  // Update view mode when bot status loads (if not already changed by user)
  const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false);
  
  // Auto-set to bot's current mode on first load
  if (!statusLoading && botStatus && !hasUserSelectedMode) {
    const currentMode = botIsLive ? 'live' : 'paper';
    if (viewMode !== currentMode) {
      setViewMode(currentMode);
    }
  }

  // Get current trading mode from user context
  const { isSimulation: isUserSimMode } = useTier();
  // Use viewMode for data filtering, fall back to user's current mode if 'all'
  const tradingMode: 'paper' | 'live' | undefined = viewMode === 'all' ? undefined : viewMode;

  const isSimulation = botStatus?.mode !== 'live';
  const { data: simStats, isLoading: statsLoading } = useSimulationStats();
  // Pass trading mode to get stats filtered by current mode (undefined = all)
  const { data: realTimeStats } = useRealTimeStats(globalTimeframeHours, tradingMode);
  const { data: trades } = useSimulatedTrades(20, tradingMode);
  // Fetch all trades for accurate modal calculations
  const { data: allTrades } = useSimulatedTrades(5000, tradingMode);
  const { data: opportunities } = useOpportunities(50, globalTimeframeHours);
  const { data: pnlHistory } = usePnLHistory(globalTimeframeHours || 8760, tradingMode); // 0 = All time = 1 year

  // Starting balance constant (6 platforms x $5,000 each = $30,000)
  // 6 platforms x $5,000 each = $30,000 total
  const STARTING_BALANCE = 30000;

  // Prefer real-time computed stats (more accurate - uses database aggregates)
  const balance = realTimeStats?.simulated_balance ?? simStats?.simulated_balance ?? STARTING_BALANCE;

  const totalPnl = realTimeStats?.total_pnl ?? simStats?.total_pnl ?? 0;
  const totalTrades = realTimeStats?.total_trades ?? simStats?.total_trades ?? 0;
  const winRate = realTimeStats?.win_rate ?? simStats?.win_rate ?? 0;
  const winningTrades = realTimeStats?.winning_trades ?? simStats?.stats_json?.winning_trades ?? 0;
  const losingTrades = realTimeStats?.losing_trades ?? simStats?.stats_json?.losing_trades ?? 0;
  const roiPct = realTimeStats?.roi_pct ?? simStats?.stats_json?.roi_pct ?? 0;
  const totalOpportunities = realTimeStats?.total_opportunities_seen ?? simStats?.stats_json?.total_opportunities_seen ?? 0;

  // Modal state
  const [modalType, setModalType] = useState<'balance' | 'pnl' | 'winrate' | 'opportunities' | null>(null);

  // Trade details modal state
  const [selectedTrade, setSelectedTrade] = useState<TradeDetails | null>(null);

  // Helper to convert Opportunity to TradeDetails
  const opportunityToTradeDetails = (opp: Opportunity): TradeDetails => {
    let type: TradeDetails['type'] = 'arbitrage';
    const s = opp.strategy?.toLowerCase() || '';

    if (s.includes('whale')) type = 'whale_copy';
    else if (s.includes('congress')) type = 'congress_copy';
    else if (s.includes('news')) type = 'news_trading';
    else if (s.includes('single')) type = 'scalping';

    return {
      id: opp.id.toString(),
      type,
      status: opp.status === 'executed' ? 'executed' : 'pending',
      marketTitle: opp.buy_market_name || opp.sell_market_name || 'Unknown Market',
      marketId: opp.buy_market_id || opp.sell_market_id,
      platform: opp.buy_platform === opp.sell_platform
        ? (opp.buy_platform as 'polymarket' | 'kalshi' | 'alpaca') || 'polymarket'
        : 'cross_platform',
      side: 'YES',
      entryPrice: opp.buy_price,
      currentPrice: opp.sell_price,
      size: 0,
      sizeUsd: opp.max_size || 0,
      detectedAt: opp.detected_at,
      arbitrageInfo: {
        type: opp.buy_platform === opp.sell_platform ? 'single_platform' : 'cross_platform',
        yesPrice: opp.buy_price * 100,
        noPrice: (1 - opp.sell_price) * 100,
        spread: opp.profit_percent,
        netProfit: opp.total_profit || opp.profit_percent,
      },
      convictionScore: opp.confidence,
      strategySignals: opp.strategy ? [{
        source: opp.strategy,
        signal: opp.profit_percent > 0 ? 'bullish' : 'neutral',
        confidence: opp.confidence || 70,
        reason: `${opp.profit_percent.toFixed(2)}% spread detected`,
      }] : undefined,
    }
  };

  // Helper to convert SimulatedTrade to TradeDetails
  const tradeToTradeDetails = (trade: SimulatedTrade): TradeDetails => {
    let type: TradeDetails['type'] = 'arbitrage';
    const s = trade.strategy?.toLowerCase() || '';

    if (s.includes('whale')) type = 'whale_copy';
    else if (s.includes('congress')) type = 'congress_copy';
    else if (s.includes('news')) type = 'news_trading';
    else if (s.includes('single')) type = 'scalping';

    return {
      id: trade.id.toString(),
      type,
      status: trade.outcome === 'won' ? 'executed' :
        trade.outcome === 'lost' ? 'failed' : 'pending',
      marketTitle: trade.polymarket_market_title || trade.kalshi_market_title || 'Unknown Market',
      marketId: trade.polymarket_token_id || trade.kalshi_ticker,
      platform: trade.polymarket_token_id ? 'polymarket' :
        trade.kalshi_ticker ? 'kalshi' : 'polymarket',
      side: 'YES',
      entryPrice: trade.polymarket_yes_price || trade.kalshi_yes_price || 0,
      exitPrice: undefined,
      size: 0,
      sizeUsd: trade.position_size_usd || 0,
      realizedPnl: trade.expected_profit_usd,
      pnlPercent: trade.expected_profit_pct,
      detectedAt: trade.created_at,
      executedAt: trade.created_at,
      exitedAt: trade.resolved_at || undefined,
      convictionScore: undefined,
    }
  };

  const isOnline = !!(botStatus?.is_running &&
    botStatus?.updated_at &&
    isRecent(botStatus.updated_at, 30000));

  return (
    <div className="p-8">
      {/* Trading Mode Banner - explains Simulation vs Live data filtering */}
      <TradingModeBanner />
      
      {/* Welcome Banner for new users */}
      <WelcomeBanner />
      
      {/* Page CTA */}
      <PageCTA page="dashboard" />
      
      {/* Quick Start FAB */}
      <QuickStartFAB />

      {/* Stat Detail Modal */}
      <StatDetailModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType || 'balance'}
        stats={simStats || null}
        realTimeStats={realTimeStats || null}
        trades={allTrades || trades || []}
        opportunities={opportunities || []}
        totalOpportunitiesSeen={totalOpportunities}
      />

      {/* Trade Details Modal */}
      <TradeDetailsModal
        isOpen={selectedTrade !== null}
        onClose={() => setSelectedTrade(null)}
        trade={selectedTrade}
      />

      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 text-neon-green" />
            Dashboard
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time overview of your arbitrage bot
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
              isUserSimMode ? 'bg-neon-green/20 text-neon-green' : 'bg-red-500/20 text-red-400'
            }`}>
              {isUserSimMode ? 'PAPER TRADING' : 'LIVE'}
            </span>
          </p>
        </div>

        {/* Trading Mode Toggle + Connected Exchanges + Global Timeframe Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <ConnectedExchangesBadge compact />
          <TradingModeToggle compact />
          <div className="flex items-center gap-2 bg-dark-card border border-dark-border rounded-xl px-4 py-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Showing:</span>
            <select
              value={globalTimeframeHours}
              onChange={(e) => setGlobalTimeframeHours(Number(e.target.value))}
              className="bg-dark-border rounded-lg px-3 py-1.5 text-sm border-none outline-none text-white cursor-pointer hover:bg-dark-border/70 transition-colors"
              title="Select timeframe for all dashboard data"
            >
              {TIMEFRAME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* View Mode Toggle - All/Paper/Live */}
          <div className="flex items-center bg-dark-card border border-dark-border rounded-xl p-1">
            {(['all', 'paper', 'live'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setHasUserSelectedMode(true); // User explicitly chose a mode
                }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  viewMode === mode
                    ? mode === 'live' ? 'bg-red-500/20 text-red-400' : mode === 'paper' ? 'bg-neon-green/20 text-neon-green' : 'bg-neon-blue/20 text-neon-blue'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode === 'all' ? 'All Data' : mode === 'paper' ? 'Paper' : 'Live'}
              </button>
            ))}
          </div>
        </div>
      </div>



      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title={isSimulation ? "Paper Balance" : "Real Balance"}
          tooltip={isSimulation ? METRIC_TOOLTIPS.simulatedBalance : "Your actual exchange balance"}
          value={formatCurrency(balance)}
          change={roiPct}
          icon={DollarSign}
          color="green"
          loading={statsLoading && !realTimeStats}
          onClick={() => setModalType('balance')}
          badge={isSimulation ? "PAPER" : "LIVE"}
        />
        <StatCard
          title={globalTimeframeHours === 0 ? "Net P&L (All Time)" : `Net P&L (${globalTimeframeHours}h)`}
          tooltip={METRIC_TOOLTIPS.totalPnL}
          value={formatCurrency(totalPnl)}
          subtitle={`${totalTrades} trades`}
          icon={TrendingUp}
          color="blue"
          loading={statsLoading && !realTimeStats}
          onClick={() => setModalType('pnl')}
        />
        <StatCard
          title="Win Rate"
          tooltip={METRIC_TOOLTIPS.winRate}
          value={`${winRate.toFixed(1)}%`}
          subtitle={`${winningTrades}W / ${losingTrades}L`}
          icon={Target}
          color="purple"
          loading={statsLoading && !realTimeStats}
          onClick={() => setModalType('winrate')}
        />
        <StatCard
          title="Opportunities"
          tooltip={METRIC_TOOLTIPS.opportunities}
          value={totalOpportunities.toString()}
          subtitle="Detected"
          icon={Activity}
          color="pink"
          loading={statsLoading && !realTimeStats}
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
            <span className="text-xs text-gray-500 bg-dark-border px-2 py-1 rounded">
              {TIMEFRAME_OPTIONS.find(o => o.value === globalTimeframeHours)?.label || '24 Hours'}
            </span>
          </div>
          <PnLChart data={pnlHistory || []} />
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

      {/* Money Stats Widget - DISABLED: Needs real failed trade data with pricing
      <div className="mb-8">
        <MoneyStatsWidget timeframeHours={globalTimeframeHours} />
      </div>
      */}

      {/* Connected Exchanges Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <ConnectedExchangesBadge showDetails />
      </motion.div>

      {/* Bot Health Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-8"
      >
        <BotHealthIndicator className="bg-dark-card" />
      </motion.div>

      {/* Strategy Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-purple" />
            Strategy Performance
          </h2>
        </div>
        <StrategyPerformanceTable tradingMode={isSimulation ? 'paper' : 'live'} limit={5} />
      </motion.div>

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
          <OpportunitiesFeed
            opportunities={opportunities || []}
            onOpportunityClick={(opp) => setSelectedTrade(opportunityToTradeDetails(opp))}
          />
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
          <TradesList
            trades={trades || []}
            onTradeClick={(trade) => setSelectedTrade(tradeToTradeDetails(trade))}
          />
        </motion.div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  tooltip,
  value,
  change,
  subtitle,
  icon: Icon,
  color,
  loading,
  onClick,
  badge
}: {
  title: string;
  tooltip?: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'pink';
  loading?: boolean;
  onClick?: () => void;
  badge?: string;
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
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-sm text-gray-400">{title}</p>
              {badge && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[10px] font-bold rounded uppercase",
                  badge === "LIVE"
                    ? "bg-neon-green/20 text-neon-green"
                    : "bg-yellow-500/20 text-yellow-400"
                )}>
                  {badge}
                </span>
              )}
              {tooltip && (
                <Tooltip content={tooltip} position="right">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
                </Tooltip>
              )}
            </div>
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
