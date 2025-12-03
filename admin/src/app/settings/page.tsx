'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Power, 
  AlertTriangle,
  Zap,
  DollarSign,
  Percent,
  Clock,
  Shield,
  Save,
  RotateCcw,
  Lock,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Activity,
  Target,
  TrendingDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useBotStatus, useBotConfig, useDisabledMarkets, useResetSimulation } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// Platform logos as SVG components
const PolymarketLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#5865F2"/>
    <text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">P</text>
  </svg>
);

const KalshiLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#00C853"/>
    <text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">K</text>
  </svg>
);

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function ToggleSwitch({ enabled, onToggle, disabled, size = 'md' }: ToggleSwitchProps) {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
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
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transform transition-transform duration-200",
          s.thumb,
          enabled ? s.translate : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: botStatus } = useBotStatus();
  const { data: config } = useBotConfig();
  
  // Local state for settings
  const [botEnabled, setBotEnabled] = useState(botStatus?.is_running ?? false);
  const [polymarketEnabled, setPolymarketEnabled] = useState(config?.polymarket_enabled ?? true);
  const [kalshiEnabled, setKalshiEnabled] = useState(config?.kalshi_enabled ?? true);
  const [dryRunMode, setDryRunMode] = useState(botStatus?.dry_run_mode ?? true);
  const [requireApproval, setRequireApproval] = useState(false); // Will be stored in localStorage until DB column is added
  
  // Basic trading parameters
  const [minProfitPercent, setMinProfitPercent] = useState(config?.min_profit_percent ?? 1.0);
  const [maxTradeSize, setMaxTradeSize] = useState(config?.max_trade_size ?? 100);
  const [maxDailyLoss, setMaxDailyLoss] = useState(config?.max_daily_loss ?? 50);
  const [scanInterval, setScanInterval] = useState(config?.scan_interval ?? 2);
  
  // REALISTIC PAPER TRADING PARAMETERS
  // Spread constraints
  const [maxRealisticSpreadPct, setMaxRealisticSpreadPct] = useState(config?.max_realistic_spread_pct ?? 12.0);
  const [minProfitThresholdPct, setMinProfitThresholdPct] = useState(config?.min_profit_threshold_pct ?? 5.0);
  
  // Execution simulation
  const [slippageMinPct, setSlippageMinPct] = useState(config?.slippage_min_pct ?? 0.3);
  const [slippageMaxPct, setSlippageMaxPct] = useState(config?.slippage_max_pct ?? 2.0);
  const [spreadCostPct, setSpreadCostPct] = useState(config?.spread_cost_pct ?? 1.0);
  const [executionFailureRate, setExecutionFailureRate] = useState(config?.execution_failure_rate ?? 0.25);
  const [partialFillChance, setPartialFillChance] = useState(config?.partial_fill_chance ?? 0.20);
  const [partialFillMinPct, setPartialFillMinPct] = useState(config?.partial_fill_min_pct ?? 0.50);
  
  // Market resolution risk
  const [resolutionLossRate, setResolutionLossRate] = useState(config?.resolution_loss_rate ?? 0.18);
  const [lossSeverityMin, setLossSeverityMin] = useState(config?.loss_severity_min ?? 0.25);
  const [lossSeverityMax, setLossSeverityMax] = useState(config?.loss_severity_max ?? 0.85);
  
  // Position sizing
  const [maxPositionPct, setMaxPositionPct] = useState(config?.max_position_pct ?? 3.0);
  const [maxPositionUsd, setMaxPositionUsd] = useState(config?.max_position_usd ?? 30.0);
  const [minPositionUsd, setMinPositionUsd] = useState(config?.min_position_usd ?? 5.0);
  
  // UI state
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showUserAdmin, setShowUserAdmin] = useState(false);

  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Use the reset simulation hook
  const resetSimulation = useResetSimulation();
  
  // Fetch users for admin
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Mutation to update bot status
  const updateBotStatus = useMutation({
    mutationFn: async (updates: Partial<typeof botStatus>) => {
      const { error } = await supabase
        .from('polybot_status')
        .update(updates)
        .eq('id', botStatus?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botStatus'] });
    },
  });

  // Mutation to update config
  const updateConfig = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase
        .from('polybot_config')
        .upsert({ id: 1, ...updates });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
    },
  });

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateBotStatus.mutateAsync({
        is_running: botEnabled,
        dry_run_mode: dryRunMode,
      });
      await updateConfig.mutateAsync({
        polymarket_enabled: polymarketEnabled,
        kalshi_enabled: kalshiEnabled,
        min_profit_percent: minProfitPercent,
        max_trade_size: maxTradeSize,
        max_daily_loss: maxDailyLoss,
        scan_interval: scanInterval,
        // Realistic paper trading parameters
        max_realistic_spread_pct: maxRealisticSpreadPct,
        min_profit_threshold_pct: minProfitThresholdPct,
        slippage_min_pct: slippageMinPct,
        slippage_max_pct: slippageMaxPct,
        spread_cost_pct: spreadCostPct,
        execution_failure_rate: executionFailureRate,
        partial_fill_chance: partialFillChance,
        partial_fill_min_pct: partialFillMinPct,
        resolution_loss_rate: resolutionLossRate,
        loss_severity_min: lossSeverityMin,
        loss_severity_max: lossSeverityMax,
        max_position_pct: maxPositionPct,
        max_position_usd: maxPositionUsd,
        min_position_usd: minPositionUsd,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBotToggle = () => {
    if (botEnabled) {
      setShowConfirm('bot');
    } else {
      setBotEnabled(true);
    }
  };

  // Reset simulation - clears all trades and resets balance
  const handleResetSimulation = async () => {
    try {
      await resetSimulation.mutateAsync();
      setShowConfirm(null);
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Read-Only Mode Banner */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3"
        >
          <Lock className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="font-semibold text-yellow-500">Read-Only Mode</p>
            <p className="text-sm text-yellow-500/70">You can view settings but cannot make changes. Contact an admin to modify settings.</p>
          </div>
        </motion.div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="w-8 h-8 text-neon-purple" />
          Bot Settings
        </h1>
        <p className="text-gray-400 mt-2">Configure your trading bot parameters and platform connections</p>
      </div>

      {/* Master Controls */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-6"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Power className="w-5 h-5 text-neon-green" />
          Master Controls
        </h2>

        <div className="space-y-6">
          {/* Bot Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                botEnabled ? "bg-neon-green/20" : "bg-red-500/20"
              )}>
                <Zap className={cn("w-6 h-6", botEnabled ? "text-neon-green" : "text-red-500")} />
              </div>
              <div>
                <h3 className="font-semibold">Bot Status</h3>
                <p className="text-sm text-gray-400">
                  {botEnabled ? 'Bot is actively scanning for opportunities' : 'Bot is paused'}
                </p>
              </div>
            </div>
            <ToggleSwitch enabled={botEnabled} onToggle={handleBotToggle} size="lg" disabled={!isAdmin} />
          </div>

          {/* Dry Run Mode */}
          <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold">Simulation Mode (Dry Run)</h3>
                <p className="text-sm text-gray-400">
                  {dryRunMode ? 'Paper trading - no real money' : '⚠️ LIVE TRADING - Real money at risk!'}
                </p>
              </div>
            </div>
            <ToggleSwitch enabled={dryRunMode} onToggle={() => setDryRunMode(!dryRunMode)} size="lg" disabled={!isAdmin} />
          </div>

          {/* Approval Queue Mode */}
          <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                requireApproval ? "bg-neon-purple/20" : "bg-gray-500/20"
              )}>
                <Lock className={cn("w-6 h-6", requireApproval ? "text-neon-purple" : "text-gray-500")} />
              </div>
              <div>
                <h3 className="font-semibold">Require Manual Approval</h3>
                <p className="text-sm text-gray-400">
                  {requireApproval 
                    ? 'All trades must be approved before execution' 
                    : 'Bot trades autonomously without approval'}
                </p>
              </div>
            </div>
            <ToggleSwitch enabled={requireApproval} onToggle={() => setRequireApproval(!requireApproval)} size="lg" disabled={!isAdmin} />
          </div>
        </div>
      </motion.div>

      {/* Platform Controls */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-6"
      >
        <h2 className="text-xl font-semibold mb-6">Platform Connections</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Polymarket */}
          <div className={cn(
            "p-4 rounded-xl border-2 transition-colors",
            polymarketEnabled ? "border-polymarket bg-polymarket/10" : "border-dark-border bg-dark-border/30"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-polymarket flex items-center justify-center">
                  <span className="text-lg font-bold text-white">P</span>
                </div>
                <div>
                  <h3 className="font-semibold">Polymarket</h3>
                  <p className="text-xs text-gray-400">USDC on Polygon</p>
                </div>
              </div>
              <ToggleSwitch enabled={polymarketEnabled} onToggle={() => setPolymarketEnabled(!polymarketEnabled)} disabled={!isAdmin} />
            </div>
            <div className="text-xs text-gray-500">
              {polymarketEnabled ? '✓ Trading enabled' : '○ Trading disabled'}
            </div>
          </div>

          {/* Kalshi */}
          <div className={cn(
            "p-4 rounded-xl border-2 transition-colors",
            kalshiEnabled ? "border-kalshi bg-kalshi/10" : "border-dark-border bg-dark-border/30"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-kalshi flex items-center justify-center">
                  <span className="text-lg font-bold text-white">K</span>
                </div>
                <div>
                  <h3 className="font-semibold">Kalshi</h3>
                  <p className="text-xs text-gray-400">USD Direct</p>
                </div>
              </div>
              <ToggleSwitch enabled={kalshiEnabled} onToggle={() => setKalshiEnabled(!kalshiEnabled)} disabled={!isAdmin} />
            </div>
            <div className="text-xs text-gray-500">
              {kalshiEnabled ? '✓ Trading enabled' : '○ Trading disabled'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Trading Parameters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card mb-6"
      >
        <h2 className="text-xl font-semibold mb-6">Trading Parameters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <Percent className="w-4 h-4" />
              Minimum Profit %
            </label>
            <input
              type="number"
              value={minProfitPercent}
              onChange={(e) => setMinProfitPercent(parseFloat(e.target.value))}
              step="0.1"
              min="0"
              max="10"
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green"
            />
            <p className="text-xs text-gray-500 mt-1">Only trade when profit exceeds this %</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <DollarSign className="w-4 h-4" />
              Max Trade Size ($)
            </label>
            <input
              type="number"
              value={maxTradeSize}
              onChange={(e) => setMaxTradeSize(parseFloat(e.target.value))}
              step="10"
              min="1"
              max="10000"
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum position size per trade</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Max Daily Loss ($)
            </label>
            <input
              type="number"
              value={maxDailyLoss}
              onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value))}
              step="10"
              min="0"
              max="1000"
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green"
            />
            <p className="text-xs text-gray-500 mt-1">Stop trading if daily loss exceeds this</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <Clock className="w-4 h-4" />
              Scan Interval (seconds)
            </label>
            <input
              type="number"
              value={scanInterval}
              onChange={(e) => setScanInterval(parseFloat(e.target.value))}
              step="0.5"
              min="0.5"
              max="60"
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green"
            />
            <p className="text-xs text-gray-500 mt-1">How often to check for opportunities</p>
          </div>
        </div>
      </motion.div>

      {/* Advanced Realistic Trading Parameters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowAdvancedParams(!showAdvancedParams)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle advanced parameters"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-purple" />
            Advanced Simulation Parameters
          </h2>
          {showAdvancedParams ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Fine-tune realistic paper trading simulation</p>

        <AnimatePresence>
          {showAdvancedParams && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Spread Constraints */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-neon-green" />
                  Spread Constraints
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                      Max Realistic Spread %
                    </label>
                    <input
                      type="number"
                      value={maxRealisticSpreadPct}
                      onChange={(e) => setMaxRealisticSpreadPct(parseFloat(e.target.value))}
                      step="0.5"
                      min="1"
                      max="50"
                      disabled={!isAdmin}
                      placeholder="12.0"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Reject spreads above this (likely false positive)</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                      Min Profit Threshold %
                    </label>
                    <input
                      type="number"
                      value={minProfitThresholdPct}
                      onChange={(e) => setMinProfitThresholdPct(parseFloat(e.target.value))}
                      step="0.5"
                      min="0"
                      max="20"
                      disabled={!isAdmin}
                      placeholder="5.0"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Only trade when profit exceeds this after costs</p>
                  </div>
                </div>
              </div>

              {/* Execution Simulation */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Execution Simulation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Slippage Min %</label>
                    <input
                      type="number"
                      value={slippageMinPct}
                      onChange={(e) => setSlippageMinPct(parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="5"
                      disabled={!isAdmin}
                      placeholder="0.3"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Slippage Max %</label>
                    <input
                      type="number"
                      value={slippageMaxPct}
                      onChange={(e) => setSlippageMaxPct(parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="10"
                      disabled={!isAdmin}
                      placeholder="2.0"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Spread Cost %</label>
                    <input
                      type="number"
                      value={spreadCostPct}
                      onChange={(e) => setSpreadCostPct(parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="5"
                      disabled={!isAdmin}
                      placeholder="1.0"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Execution Failure Rate</label>
                    <input
                      type="number"
                      value={executionFailureRate}
                      onChange={(e) => setExecutionFailureRate(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.25"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = never fails, 1 = always fails</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Partial Fill Chance</label>
                    <input
                      type="number"
                      value={partialFillChance}
                      onChange={(e) => setPartialFillChance(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.20"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Partial Fill Min %</label>
                    <input
                      type="number"
                      value={partialFillMinPct}
                      onChange={(e) => setPartialFillMinPct(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.50"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Market Resolution Risk */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Market Resolution Risk
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Resolution Loss Rate</label>
                    <input
                      type="number"
                      value={resolutionLossRate}
                      onChange={(e) => setResolutionLossRate(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.18"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Chance market resolves against you</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Loss Severity Min</label>
                    <input
                      type="number"
                      value={lossSeverityMin}
                      onChange={(e) => setLossSeverityMin(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.25"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Loss Severity Max</label>
                    <input
                      type="number"
                      value={lossSeverityMax}
                      onChange={(e) => setLossSeverityMax(parseFloat(e.target.value))}
                      step="0.05"
                      min="0"
                      max="1"
                      disabled={!isAdmin}
                      placeholder="0.85"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Position Sizing */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4 text-neon-blue" />
                  Position Sizing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Max Position % of Balance</label>
                    <input
                      type="number"
                      value={maxPositionPct}
                      onChange={(e) => setMaxPositionPct(parseFloat(e.target.value))}
                      step="0.5"
                      min="0.5"
                      max="25"
                      disabled={!isAdmin}
                      placeholder="3.0"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Max Position USD</label>
                    <input
                      type="number"
                      value={maxPositionUsd}
                      onChange={(e) => setMaxPositionUsd(parseFloat(e.target.value))}
                      step="5"
                      min="1"
                      max="1000"
                      disabled={!isAdmin}
                      placeholder="30"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Min Position USD</label>
                    <input
                      type="number"
                      value={minPositionUsd}
                      onChange={(e) => setMinPositionUsd(parseFloat(e.target.value))}
                      step="1"
                      min="1"
                      max="100"
                      disabled={!isAdmin}
                      placeholder="5"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* User Administration */}
      {isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card mb-6"
        >
          <button
            onClick={() => setShowUserAdmin(!showUserAdmin)}
            className="w-full flex items-center justify-between"
            type="button"
            title="Toggle user administration"
          >
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-blue" />
              User Administration
            </h2>
            {showUserAdmin ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          <AnimatePresence>
            {showUserAdmin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">Manage user access and permissions</p>
                  </div>
                  
                  {/* Users List */}
                  <div className="space-y-2">
                    {users.map((u: any) => (
                      <div 
                        key={u.id}
                        className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                            u.role === 'admin' ? 'bg-neon-purple/20 text-neon-purple' :
                            u.role === 'readonly' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-neon-green/20 text-neon-green'
                          )}>
                            {u.username?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{u.username || u.email}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              await supabase
                                .from('polybot_user_profiles')
                                .update({ role: newRole })
                                .eq('id', u.id);
                              refetchUsers();
                            }}
                            disabled={u.id === user?.id}
                            title="Change user role"
                            className="bg-dark-border border border-dark-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-purple disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="readonly">Read Only</option>
                          </select>
                          {u.id !== user?.id && (
                            <button
                              onClick={async () => {
                                if (confirm(`Delete user ${u.username || u.email}?`)) {
                                  await supabase
                                    .from('polybot_user_profiles')
                                    .delete()
                                    .eq('id', u.id);
                                  refetchUsers();
                                }
                              }}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {users.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No users found</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-4">
        {isAdmin ? (
          <>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-green to-neon-blue text-dark-bg font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-dark-border text-gray-300 font-semibold rounded-xl hover:bg-dark-border/80 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 px-6 py-3 bg-dark-border/50 text-gray-500 font-semibold rounded-xl cursor-not-allowed">
            <Lock className="w-5 h-5" />
            Read-Only Mode - Cannot Save
          </div>
        )}
      </div>

      {/* Danger Zone - Reset Simulation */}
      {isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 card border-red-500/30"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>
          
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-red-400">Reset Simulation</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Delete all paper trades and reset balance to $1,000. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowConfirm('reset')}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Reset All Data
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-md mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className={cn(
                "w-8 h-8",
                showConfirm === 'reset' ? "text-red-500" : "text-yellow-500"
              )} />
              <h3 className="text-xl font-semibold">
                {showConfirm === 'reset' ? 'Reset All Data?' : 'Confirm Action'}
              </h3>
            </div>
            <p className="text-gray-400 mb-6">
              {showConfirm === 'reset' 
                ? 'This will delete ALL paper trades and reset your simulated balance to $1,000. This action cannot be undone!'
                : 'Are you sure you want to disable the bot? Any pending trades will continue, but no new trades will be made.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (showConfirm === 'reset') {
                    handleResetSimulation();
                  } else {
                    setBotEnabled(false);
                    setShowConfirm(null);
                  }
                }}
                disabled={resetSimulation.isPending}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {showConfirm === 'reset' 
                  ? (resetSimulation.isPending ? 'Resetting...' : 'Yes, Reset Everything')
                  : 'Yes, Disable'}
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 bg-dark-border rounded-lg hover:bg-dark-border/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
