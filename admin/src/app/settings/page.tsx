'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBotStatus, useBotConfig } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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
  const { data: botStatus } = useBotStatus();
  const { data: config } = useBotConfig();
  
  // Local state for settings
  const [botEnabled, setBotEnabled] = useState(botStatus?.is_running ?? false);
  const [polymarketEnabled, setPolymarketEnabled] = useState(config?.polymarket_enabled ?? true);
  const [kalshiEnabled, setKalshiEnabled] = useState(config?.kalshi_enabled ?? true);
  const [dryRunMode, setDryRunMode] = useState(botStatus?.mode === 'simulation');
  
  // Trading parameters
  const [minProfitPercent, setMinProfitPercent] = useState(config?.min_profit_percent ?? 1.0);
  const [maxTradeSize, setMaxTradeSize] = useState(config?.max_trade_size ?? 100);
  const [maxDailyLoss, setMaxDailyLoss] = useState(config?.max_daily_loss ?? 50);
  const [scanInterval, setScanInterval] = useState(config?.scan_interval ?? 2);

  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        mode: dryRunMode ? 'simulation' : 'live',
      });
      await updateConfig.mutateAsync({
        polymarket_enabled: polymarketEnabled,
        kalshi_enabled: kalshiEnabled,
        min_profit_percent: minProfitPercent,
        max_trade_size: maxTradeSize,
        max_daily_loss: maxDailyLoss,
        scan_interval: scanInterval,
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
            <ToggleSwitch enabled={botEnabled} onToggle={handleBotToggle} size="lg" />
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
            <ToggleSwitch enabled={dryRunMode} onToggle={() => setDryRunMode(!dryRunMode)} size="lg" />
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
              <ToggleSwitch enabled={polymarketEnabled} onToggle={() => setPolymarketEnabled(!polymarketEnabled)} />
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
              <ToggleSwitch enabled={kalshiEnabled} onToggle={() => setKalshiEnabled(!kalshiEnabled)} />
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

      {/* Save Button */}
      <div className="flex items-center gap-4">
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
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-md mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <h3 className="text-xl font-semibold">Confirm Action</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Are you sure you want to disable the bot? Any pending trades will continue, but no new trades will be made.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setBotEnabled(false);
                  setShowConfirm(null);
                }}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Yes, Disable
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
