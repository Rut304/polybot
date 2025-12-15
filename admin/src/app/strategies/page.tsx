'use client';

import { useState, useEffect } from 'react';
import { 
  Zap,
  DollarSign,
  Percent,
  Clock,
  Save,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
  Fish,
  Landmark,
  Brain,
  Crown,
  Activity,
  Shield,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBotConfig } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { LabelWithTooltip } from '@/components/Tooltip';

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

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                confidence >= 70 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                'bg-orange-500/20 text-orange-400 border-orange-500/30';
  
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', color)}>
      {confidence}% Conf
    </span>
  );
}

// Strategy card component
interface StrategyCardProps {
  title: string;
  description: string;
  confidence: number;
  potentialReturn: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  expanded: boolean;
  onExpand: () => void;
  disabled?: boolean;
}

function StrategyCard({ 
  title, 
  description, 
  confidence, 
  potentialReturn,
  icon: Icon, 
  iconColor,
  enabled, 
  onToggle, 
  children,
  expanded,
  onExpand,
  disabled = false,
}: StrategyCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-dark-card border rounded-xl overflow-hidden transition-all",
        enabled ? 'border-neon-green/30' : 'border-dark-border'
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', iconColor)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{title}</h3>
                <ConfidenceBadge confidence={confidence} />
              </div>
              <p className="text-xs text-dark-muted mt-0.5">{potentialReturn}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch enabled={enabled} onToggle={onToggle} disabled={disabled} />
            <button 
              onClick={onExpand}
              className="p-1 hover:bg-dark-bg rounded transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-dark-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-dark-muted" />
              )}
            </button>
          </div>
        </div>
        <p className="text-sm text-dark-muted mt-2">{description}</p>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-dark-border"
          >
            <div className="p-4 space-y-4 bg-dark-bg/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Input row component for settings
function SettingRow({ 
  label, 
  tooltip, 
  children 
}: { 
  label: string; 
  tooltip?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">{label}</span>
        {tooltip && (
          <HelpCircle className="w-4 h-4 text-dark-muted cursor-help" title={tooltip} />
        )}
      </div>
      {children}
    </div>
  );
}

export default function StrategiesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: config } = useBotConfig();
  
  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Expanded sections
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  
  // =========================================================================
  // PREDICTION MARKET STRATEGIES
  // =========================================================================
  
  // Whale Copy Trading (75% confidence)
  const [enableWhaleCopyTrading, setEnableWhaleCopyTrading] = useState(config?.enable_whale_copy_trading ?? false);
  const [whaleCopyMinWinRate, setWhaleCopyMinWinRate] = useState(config?.whale_copy_min_win_rate ?? 80);
  const [whaleCopyDelaySeconds, setWhaleCopyDelaySeconds] = useState(config?.whale_copy_delay_seconds ?? 30);
  const [whaleCopyMaxSizeUsd, setWhaleCopyMaxSizeUsd] = useState(config?.whale_copy_max_size_usd ?? 50);
  
  // Selective Whale Copy (80% confidence) - NEW
  const [enableSelectiveWhaleCopy, setEnableSelectiveWhaleCopy] = useState(config?.enable_selective_whale_copy ?? false);
  const [selectiveWhaleMinWinRate, setSelectiveWhaleMinWinRate] = useState(config?.selective_whale_min_win_rate ?? 0.65);
  const [selectiveWhaleMinRoi, setSelectiveWhaleMinRoi] = useState(config?.selective_whale_min_roi ?? 0.20);
  const [selectiveWhaleMinTrades, setSelectiveWhaleMinTrades] = useState(config?.selective_whale_min_trades ?? 10);
  const [selectiveWhaleMaxTracked, setSelectiveWhaleMaxTracked] = useState(config?.selective_whale_max_tracked ?? 10);
  const [selectiveWhaleAutoSelect, setSelectiveWhaleAutoSelect] = useState(config?.selective_whale_auto_select ?? true);
  const [selectiveWhaleCopyScalePct, setSelectiveWhaleCopyScalePct] = useState(config?.selective_whale_copy_scale_pct ?? 5.0);
  const [selectiveWhaleMaxPositionUsd, setSelectiveWhaleMaxPositionUsd] = useState(config?.selective_whale_max_position_usd ?? 200);
  
  // Political Event Strategy (80% confidence) - NEW
  const [enablePoliticalEventStrategy, setEnablePoliticalEventStrategy] = useState(config?.enable_political_event_strategy ?? false);
  const [politicalMinConvictionScore, setPoliticalMinConvictionScore] = useState(config?.political_min_conviction_score ?? 0.75);
  const [politicalMaxPositionUsd, setPoliticalMaxPositionUsd] = useState(config?.political_max_position_usd ?? 500);
  const [politicalMaxConcurrentEvents, setPoliticalMaxConcurrentEvents] = useState(config?.political_max_concurrent_events ?? 5);
  const [politicalEventCategories, setPoliticalEventCategories] = useState(config?.political_event_categories ?? 'election,legislation,hearing');
  const [politicalLeadTimeHours, setPoliticalLeadTimeHours] = useState(config?.political_lead_time_hours ?? 48);
  const [politicalExitBufferHours, setPoliticalExitBufferHours] = useState(config?.political_exit_buffer_hours ?? 2);
  
  // High Conviction Strategy (85% confidence) - NEW
  const [enableHighConvictionStrategy, setEnableHighConvictionStrategy] = useState(config?.enable_high_conviction_strategy ?? false);
  const [highConvictionMinScore, setHighConvictionMinScore] = useState(config?.high_conviction_min_score ?? 0.75);
  const [highConvictionMaxPositions, setHighConvictionMaxPositions] = useState(config?.high_conviction_max_positions ?? 3);
  const [highConvictionMinSignals, setHighConvictionMinSignals] = useState(config?.high_conviction_min_signals ?? 3);
  const [highConvictionPositionPct, setHighConvictionPositionPct] = useState(config?.high_conviction_position_pct ?? 15);
  const [highConvictionUseKelly, setHighConvictionUseKelly] = useState(config?.high_conviction_use_kelly ?? true);
  const [highConvictionKellyFraction, setHighConvictionKellyFraction] = useState(config?.high_conviction_kelly_fraction ?? 0.25);
  
  // Congressional Tracker (70% confidence)
  const [enableCongressionalTracker, setEnableCongressionalTracker] = useState(config?.enable_congressional_tracker ?? false);
  const [congressChambers, setCongressChambers] = useState(config?.congress_chambers ?? 'both');
  const [congressCopyScalePct, setCongressCopyScalePct] = useState(config?.congress_copy_scale_pct ?? 10);
  const [congressMaxPositionUsd, setCongressMaxPositionUsd] = useState(config?.congress_max_position_usd ?? 500);
  const [congressMinTradeAmountUsd, setCongressMinTradeAmountUsd] = useState(config?.congress_min_trade_amount_usd ?? 15000);
  
  // Fear Premium Contrarian (70% confidence)
  const [enableFearPremiumContrarian, setEnableFearPremiumContrarian] = useState(config?.enable_fear_premium_contrarian ?? false);
  const [fearExtremeLowThreshold, setFearExtremeLowThreshold] = useState(config?.fear_extreme_low_threshold ?? 0.15);
  const [fearExtremeHighThreshold, setFearExtremeHighThreshold] = useState(config?.fear_extreme_high_threshold ?? 0.85);
  const [fearMaxPositionUsd, setFearMaxPositionUsd] = useState(config?.fear_max_position_usd ?? 200);
  
  // Macro Board (65% confidence)
  const [enableMacroBoard, setEnableMacroBoard] = useState(config?.enable_macro_board ?? false);
  const [macroMaxExposureUsd, setMacroMaxExposureUsd] = useState(config?.macro_max_exposure_usd ?? 5000);
  const [macroMinConvictionScore, setMacroMinConvictionScore] = useState(config?.macro_min_conviction_score ?? 70);
  
  // BTC Bracket Arbitrage (85% confidence)
  const [enableBtcBracketArb, setEnableBtcBracketArb] = useState(config?.enable_btc_bracket_arb ?? false);
  const [btcBracketMinDiscountPct, setBtcBracketMinDiscountPct] = useState(config?.btc_bracket_min_discount_pct ?? 0.5);
  const [btcBracketMaxPositionUsd, setBtcBracketMaxPositionUsd] = useState(config?.btc_bracket_max_position_usd ?? 50);
  
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
    },
  });
  
  // Toggle strategy expansion
  const toggleExpanded = (strategyId: string) => {
    setExpandedStrategies(prev => {
      const next = new Set(prev);
      if (next.has(strategyId)) {
        next.delete(strategyId);
      } else {
        next.add(strategyId);
      }
      return next;
    });
  };
  
  // Sync state with config when it loads
  useEffect(() => {
    if (config) {
      setEnableWhaleCopyTrading(config.enable_whale_copy_trading ?? false);
      setWhaleCopyMinWinRate(config.whale_copy_min_win_rate ?? 80);
      setWhaleCopyDelaySeconds(config.whale_copy_delay_seconds ?? 30);
      setWhaleCopyMaxSizeUsd(config.whale_copy_max_size_usd ?? 50);
      
      setEnableSelectiveWhaleCopy(config.enable_selective_whale_copy ?? false);
      setSelectiveWhaleMinWinRate(config.selective_whale_min_win_rate ?? 0.65);
      setSelectiveWhaleMinRoi(config.selective_whale_min_roi ?? 0.20);
      setSelectiveWhaleMinTrades(config.selective_whale_min_trades ?? 10);
      setSelectiveWhaleMaxTracked(config.selective_whale_max_tracked ?? 10);
      setSelectiveWhaleAutoSelect(config.selective_whale_auto_select ?? true);
      setSelectiveWhaleCopyScalePct(config.selective_whale_copy_scale_pct ?? 5.0);
      setSelectiveWhaleMaxPositionUsd(config.selective_whale_max_position_usd ?? 200);
      
      setEnablePoliticalEventStrategy(config.enable_political_event_strategy ?? false);
      setPoliticalMinConvictionScore(config.political_min_conviction_score ?? 0.75);
      setPoliticalMaxPositionUsd(config.political_max_position_usd ?? 500);
      setPoliticalMaxConcurrentEvents(config.political_max_concurrent_events ?? 5);
      setPoliticalEventCategories(config.political_event_categories ?? 'election,legislation,hearing');
      setPoliticalLeadTimeHours(config.political_lead_time_hours ?? 48);
      setPoliticalExitBufferHours(config.political_exit_buffer_hours ?? 2);
      
      setEnableHighConvictionStrategy(config.enable_high_conviction_strategy ?? false);
      setHighConvictionMinScore(config.high_conviction_min_score ?? 0.75);
      setHighConvictionMaxPositions(config.high_conviction_max_positions ?? 3);
      setHighConvictionMinSignals(config.high_conviction_min_signals ?? 3);
      setHighConvictionPositionPct(config.high_conviction_position_pct ?? 15);
      setHighConvictionUseKelly(config.high_conviction_use_kelly ?? true);
      setHighConvictionKellyFraction(config.high_conviction_kelly_fraction ?? 0.25);
      
      setEnableCongressionalTracker(config.enable_congressional_tracker ?? false);
      setCongressChambers(config.congress_chambers ?? 'both');
      setCongressCopyScalePct(config.congress_copy_scale_pct ?? 10);
      setCongressMaxPositionUsd(config.congress_max_position_usd ?? 500);
      setCongressMinTradeAmountUsd(config.congress_min_trade_amount_usd ?? 15000);
      
      setEnableFearPremiumContrarian(config.enable_fear_premium_contrarian ?? false);
      setFearExtremeLowThreshold(config.fear_extreme_low_threshold ?? 0.15);
      setFearExtremeHighThreshold(config.fear_extreme_high_threshold ?? 0.85);
      setFearMaxPositionUsd(config.fear_max_position_usd ?? 200);
      
      setEnableMacroBoard(config.enable_macro_board ?? false);
      setMacroMaxExposureUsd(config.macro_max_exposure_usd ?? 5000);
      setMacroMinConvictionScore(config.macro_min_conviction_score ?? 70);
      
      setEnableBtcBracketArb(config.enable_btc_bracket_arb ?? false);
      setBtcBracketMinDiscountPct(config.btc_bracket_min_discount_pct ?? 0.5);
      setBtcBracketMaxPositionUsd(config.btc_bracket_max_position_usd ?? 50);
    }
  }, [config]);
  
  // Save all strategy settings
  const handleSave = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const strategyConfig = {
        // Whale Copy Trading
        enable_whale_copy_trading: enableWhaleCopyTrading,
        whale_copy_min_win_rate: whaleCopyMinWinRate,
        whale_copy_delay_seconds: whaleCopyDelaySeconds,
        whale_copy_max_size_usd: whaleCopyMaxSizeUsd,
        
        // Selective Whale Copy
        enable_selective_whale_copy: enableSelectiveWhaleCopy,
        selective_whale_min_win_rate: selectiveWhaleMinWinRate,
        selective_whale_min_roi: selectiveWhaleMinRoi,
        selective_whale_min_trades: selectiveWhaleMinTrades,
        selective_whale_max_tracked: selectiveWhaleMaxTracked,
        selective_whale_auto_select: selectiveWhaleAutoSelect,
        selective_whale_copy_scale_pct: selectiveWhaleCopyScalePct,
        selective_whale_max_position_usd: selectiveWhaleMaxPositionUsd,
        
        // Political Event Strategy
        enable_political_event_strategy: enablePoliticalEventStrategy,
        political_min_conviction_score: politicalMinConvictionScore,
        political_max_position_usd: politicalMaxPositionUsd,
        political_max_concurrent_events: politicalMaxConcurrentEvents,
        political_event_categories: politicalEventCategories,
        political_lead_time_hours: politicalLeadTimeHours,
        political_exit_buffer_hours: politicalExitBufferHours,
        
        // High Conviction Strategy
        enable_high_conviction_strategy: enableHighConvictionStrategy,
        high_conviction_min_score: highConvictionMinScore,
        high_conviction_max_positions: highConvictionMaxPositions,
        high_conviction_min_signals: highConvictionMinSignals,
        high_conviction_position_pct: highConvictionPositionPct,
        high_conviction_use_kelly: highConvictionUseKelly,
        high_conviction_kelly_fraction: highConvictionKellyFraction,
        
        // Congressional Tracker
        enable_congressional_tracker: enableCongressionalTracker,
        congress_chambers: congressChambers,
        congress_copy_scale_pct: congressCopyScalePct,
        congress_max_position_usd: congressMaxPositionUsd,
        congress_min_trade_amount_usd: congressMinTradeAmountUsd,
        
        // Fear Premium Contrarian
        enable_fear_premium_contrarian: enableFearPremiumContrarian,
        fear_extreme_low_threshold: fearExtremeLowThreshold,
        fear_extreme_high_threshold: fearExtremeHighThreshold,
        fear_max_position_usd: fearMaxPositionUsd,
        
        // Macro Board
        enable_macro_board: enableMacroBoard,
        macro_max_exposure_usd: macroMaxExposureUsd,
        macro_min_conviction_score: macroMinConvictionScore,
        
        // BTC Bracket Arb
        enable_btc_bracket_arb: enableBtcBracketArb,
        btc_bracket_min_discount_pct: btcBracketMinDiscountPct,
        btc_bracket_max_position_usd: btcBracketMaxPositionUsd,
        
        updated_at: new Date().toISOString(),
      };
      
      await updateConfig.mutateAsync(strategyConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save strategy settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  // Count enabled strategies
  const enabledCount = [
    enableWhaleCopyTrading,
    enableSelectiveWhaleCopy,
    enablePoliticalEventStrategy,
    enableHighConvictionStrategy,
    enableCongressionalTracker,
    enableFearPremiumContrarian,
    enableMacroBoard,
    enableBtcBracketArb,
  ].filter(Boolean).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-neon-green" />
            Strategy Settings
          </h1>
          <p className="text-dark-muted mt-1">
            Configure trading strategies and their parameters
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-dark-muted">Active Strategies</p>
            <p className="text-xl font-bold text-neon-green">{enabledCount}</p>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving || !isAdmin}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all",
              saving ? "bg-dark-border text-dark-muted" :
              "bg-neon-green text-dark-bg hover:bg-neon-green/90"
            )}
          >
            {saving ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Save className="w-5 h-5" />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-green-400">Settings saved successfully!</span>
          </motion.div>
        )}
        
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{saveError}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Read-only banner for non-admins */}
      {!isAdmin && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400">View-only mode. Admin access required to modify settings.</span>
        </div>
      )}
      
      {/* Strategy Categories */}
      <div className="space-y-8">
        {/* High Conviction Strategies */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            High Conviction Strategies
          </h2>
          <div className="space-y-4">
            {/* High Conviction Strategy (NEW) */}
            <StrategyCard
              title="High Conviction Strategy"
              description="Focus on fewer, higher-confidence trades with multi-signal confirmation and Kelly sizing"
              confidence={85}
              potentialReturn="40-80% APY"
              icon={Target}
              iconColor="bg-purple-500/20 text-purple-400"
              enabled={enableHighConvictionStrategy}
              onToggle={() => setEnableHighConvictionStrategy(!enableHighConvictionStrategy)}
              expanded={expandedStrategies.has('high-conviction')}
              onExpand={() => toggleExpanded('high-conviction')}
              disabled={!isAdmin}
            >
              <SettingRow label="Min Conviction Score" tooltip="Minimum score (0-1) to trigger a trade">
                <input
                  type="number"
                  value={highConvictionMinScore}
                  onChange={(e) => setHighConvictionMinScore(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Concurrent Positions" tooltip="Maximum number of open positions">
                <input
                  type="number"
                  value={highConvictionMaxPositions}
                  onChange={(e) => setHighConvictionMaxPositions(parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Min Confirming Signals" tooltip="Minimum number of signals that must agree">
                <input
                  type="number"
                  value={highConvictionMinSignals}
                  onChange={(e) => setHighConvictionMinSignals(parseInt(e.target.value))}
                  min="2"
                  max="6"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Position Size (% of Bankroll)" tooltip="Percentage of bankroll per trade">
                <input
                  type="number"
                  value={highConvictionPositionPct}
                  onChange={(e) => setHighConvictionPositionPct(parseFloat(e.target.value))}
                  step="1"
                  min="5"
                  max="50"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Use Kelly Criterion" tooltip="Use Kelly formula for optimal position sizing">
                <ToggleSwitch 
                  enabled={highConvictionUseKelly} 
                  onToggle={() => setHighConvictionUseKelly(!highConvictionUseKelly)} 
                  size="sm"
                />
              </SettingRow>
              {highConvictionUseKelly && (
                <SettingRow label="Kelly Fraction" tooltip="Fraction of Kelly (0.25 = quarter Kelly)">
                  <input
                    type="number"
                    value={highConvictionKellyFraction}
                    onChange={(e) => setHighConvictionKellyFraction(parseFloat(e.target.value))}
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                  />
                </SettingRow>
              )}
            </StrategyCard>
            
            {/* Political Event Strategy (NEW) */}
            <StrategyCard
              title="Political Event Strategy"
              description="Trade high-conviction political events like elections, legislation, hearings"
              confidence={80}
              potentialReturn="30-60% APY"
              icon={Landmark}
              iconColor="bg-blue-500/20 text-blue-400"
              enabled={enablePoliticalEventStrategy}
              onToggle={() => setEnablePoliticalEventStrategy(!enablePoliticalEventStrategy)}
              expanded={expandedStrategies.has('political-event')}
              onExpand={() => toggleExpanded('political-event')}
              disabled={!isAdmin}
            >
              <SettingRow label="Min Conviction Score" tooltip="Minimum conviction (0-1) to enter trade">
                <input
                  type="number"
                  value={politicalMinConvictionScore}
                  onChange={(e) => setPoliticalMinConvictionScore(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Position ($)" tooltip="Maximum position size per event">
                <input
                  type="number"
                  value={politicalMaxPositionUsd}
                  onChange={(e) => setPoliticalMaxPositionUsd(parseFloat(e.target.value))}
                  step="50"
                  min="50"
                  max="5000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Concurrent Events" tooltip="Maximum simultaneous event positions">
                <input
                  type="number"
                  value={politicalMaxConcurrentEvents}
                  onChange={(e) => setPoliticalMaxConcurrentEvents(parseInt(e.target.value))}
                  min="1"
                  max="20"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Event Categories" tooltip="Comma-separated list of event types">
                <input
                  type="text"
                  value={politicalEventCategories}
                  onChange={(e) => setPoliticalEventCategories(e.target.value)}
                  className="w-48 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                  placeholder="election,legislation,hearing"
                />
              </SettingRow>
              <SettingRow label="Lead Time (hours)" tooltip="Minimum hours before event to enter">
                <input
                  type="number"
                  value={politicalLeadTimeHours}
                  onChange={(e) => setPoliticalLeadTimeHours(parseInt(e.target.value))}
                  min="1"
                  max="168"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Exit Buffer (hours)" tooltip="Hours before event end to exit">
                <input
                  type="number"
                  value={politicalExitBufferHours}
                  onChange={(e) => setPoliticalExitBufferHours(parseInt(e.target.value))}
                  min="0"
                  max="24"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
            
            {/* BTC Bracket Arbitrage */}
            <StrategyCard
              title="BTC Bracket Arbitrage"
              description="Buy YES + NO on same bracket when combined < $1.00 for guaranteed profit"
              confidence={85}
              potentialReturn="$20K-200K/month"
              icon={Zap}
              iconColor="bg-orange-500/20 text-orange-400"
              enabled={enableBtcBracketArb}
              onToggle={() => setEnableBtcBracketArb(!enableBtcBracketArb)}
              expanded={expandedStrategies.has('btc-bracket')}
              onExpand={() => toggleExpanded('btc-bracket')}
              disabled={!isAdmin}
            >
              <SettingRow label="Min Discount (%)" tooltip="Minimum discount below $1.00 to trade">
                <input
                  type="number"
                  value={btcBracketMinDiscountPct}
                  onChange={(e) => setBtcBracketMinDiscountPct(parseFloat(e.target.value))}
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Position ($)" tooltip="Maximum position size">
                <input
                  type="number"
                  value={btcBracketMaxPositionUsd}
                  onChange={(e) => setBtcBracketMaxPositionUsd(parseFloat(e.target.value))}
                  step="10"
                  min="10"
                  max="1000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
          </div>
        </section>
        
        {/* Whale Copy Strategies */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Fish className="w-5 h-5 text-blue-400" />
            Whale Copy Strategies
          </h2>
          <div className="space-y-4">
            {/* Selective Whale Copy (NEW) */}
            <StrategyCard
              title="Selective Whale Copy"
              description="Performance-based whale selection - only copy whales with proven track records"
              confidence={80}
              potentialReturn="35-65% APY"
              icon={Fish}
              iconColor="bg-cyan-500/20 text-cyan-400"
              enabled={enableSelectiveWhaleCopy}
              onToggle={() => setEnableSelectiveWhaleCopy(!enableSelectiveWhaleCopy)}
              expanded={expandedStrategies.has('selective-whale')}
              onExpand={() => toggleExpanded('selective-whale')}
              disabled={!isAdmin}
            >
              <SettingRow label="Min Win Rate" tooltip="Minimum win rate to copy (0-1)">
                <input
                  type="number"
                  value={selectiveWhaleMinWinRate}
                  onChange={(e) => setSelectiveWhaleMinWinRate(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Min ROI" tooltip="Minimum ROI to qualify (0-1)">
                <input
                  type="number"
                  value={selectiveWhaleMinRoi}
                  onChange={(e) => setSelectiveWhaleMinRoi(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Min Trades for Stats" tooltip="Minimum trades to consider whale">
                <input
                  type="number"
                  value={selectiveWhaleMinTrades}
                  onChange={(e) => setSelectiveWhaleMinTrades(parseInt(e.target.value))}
                  min="5"
                  max="100"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Whales to Track" tooltip="Maximum number of whales to follow">
                <input
                  type="number"
                  value={selectiveWhaleMaxTracked}
                  onChange={(e) => setSelectiveWhaleMaxTracked(parseInt(e.target.value))}
                  min="1"
                  max="50"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Auto-Select Top Whales" tooltip="Automatically select best performers">
                <ToggleSwitch 
                  enabled={selectiveWhaleAutoSelect} 
                  onToggle={() => setSelectiveWhaleAutoSelect(!selectiveWhaleAutoSelect)} 
                  size="sm"
                />
              </SettingRow>
              <SettingRow label="Copy Scale (%)" tooltip="% of whale position to copy">
                <input
                  type="number"
                  value={selectiveWhaleCopyScalePct}
                  onChange={(e) => setSelectiveWhaleCopyScalePct(parseFloat(e.target.value))}
                  step="1"
                  min="1"
                  max="100"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Position ($)" tooltip="Maximum position size per copy">
                <input
                  type="number"
                  value={selectiveWhaleMaxPositionUsd}
                  onChange={(e) => setSelectiveWhaleMaxPositionUsd(parseFloat(e.target.value))}
                  step="25"
                  min="25"
                  max="2000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
            
            {/* Basic Whale Copy Trading */}
            <StrategyCard
              title="Whale Copy Trading"
              description="Track and copy high win-rate wallets with configurable delay"
              confidence={75}
              potentialReturn="25-50% APY"
              icon={Fish}
              iconColor="bg-blue-500/20 text-blue-400"
              enabled={enableWhaleCopyTrading}
              onToggle={() => setEnableWhaleCopyTrading(!enableWhaleCopyTrading)}
              expanded={expandedStrategies.has('whale-copy')}
              onExpand={() => toggleExpanded('whale-copy')}
              disabled={!isAdmin}
            >
              <SettingRow label="Min Win Rate (%)" tooltip="Minimum wallet win rate to copy">
                <input
                  type="number"
                  value={whaleCopyMinWinRate}
                  onChange={(e) => setWhaleCopyMinWinRate(parseInt(e.target.value))}
                  min="50"
                  max="100"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Copy Delay (sec)" tooltip="Seconds to wait before copying">
                <input
                  type="number"
                  value={whaleCopyDelaySeconds}
                  onChange={(e) => setWhaleCopyDelaySeconds(parseInt(e.target.value))}
                  min="0"
                  max="300"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Copy Size ($)" tooltip="Maximum copy position size">
                <input
                  type="number"
                  value={whaleCopyMaxSizeUsd}
                  onChange={(e) => setWhaleCopyMaxSizeUsd(parseFloat(e.target.value))}
                  step="10"
                  min="10"
                  max="1000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
          </div>
        </section>
        
        {/* Copy Trading Strategies */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-green-400" />
            Institutional Copy Trading
          </h2>
          <div className="space-y-4">
            {/* Congressional Tracker */}
            <StrategyCard
              title="Congressional Tracker"
              description="Copy trades made by members of Congress using STOCK Act disclosures"
              confidence={70}
              potentialReturn="15-40% APY"
              icon={Landmark}
              iconColor="bg-green-500/20 text-green-400"
              enabled={enableCongressionalTracker}
              onToggle={() => setEnableCongressionalTracker(!enableCongressionalTracker)}
              expanded={expandedStrategies.has('congress')}
              onExpand={() => toggleExpanded('congress')}
              disabled={!isAdmin}
            >
              <SettingRow label="Chambers" tooltip="Which chambers to track">
                <select
                  value={congressChambers}
                  onChange={(e) => setCongressChambers(e.target.value)}
                  className="w-32 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                >
                  <option value="both">Both</option>
                  <option value="house">House</option>
                  <option value="senate">Senate</option>
                </select>
              </SettingRow>
              <SettingRow label="Copy Scale (%)" tooltip="% of their trade to copy">
                <input
                  type="number"
                  value={congressCopyScalePct}
                  onChange={(e) => setCongressCopyScalePct(parseFloat(e.target.value))}
                  step="1"
                  min="1"
                  max="100"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Position ($)" tooltip="Maximum position size">
                <input
                  type="number"
                  value={congressMaxPositionUsd}
                  onChange={(e) => setCongressMaxPositionUsd(parseFloat(e.target.value))}
                  step="100"
                  min="100"
                  max="10000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Min Trade Size ($)" tooltip="Minimum trade to copy">
                <input
                  type="number"
                  value={congressMinTradeAmountUsd}
                  onChange={(e) => setCongressMinTradeAmountUsd(parseFloat(e.target.value))}
                  step="1000"
                  min="1000"
                  max="100000"
                  className="w-28 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
          </div>
        </section>
        
        {/* Sentiment & Macro Strategies */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-400" />
            Sentiment & Macro
          </h2>
          <div className="space-y-4">
            {/* Fear Premium Contrarian */}
            <StrategyCard
              title="Fear Premium Contrarian"
              description="Trade against extreme sentiment - 91.4% win rate approach"
              confidence={70}
              potentialReturn="25-60% APY"
              icon={TrendingUp}
              iconColor="bg-red-500/20 text-red-400"
              enabled={enableFearPremiumContrarian}
              onToggle={() => setEnableFearPremiumContrarian(!enableFearPremiumContrarian)}
              expanded={expandedStrategies.has('fear-premium')}
              onExpand={() => toggleExpanded('fear-premium')}
              disabled={!isAdmin}
            >
              <SettingRow label="Extreme Low Threshold" tooltip="YES price below this = extreme fear">
                <input
                  type="number"
                  value={fearExtremeLowThreshold}
                  onChange={(e) => setFearExtremeLowThreshold(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.05"
                  max="0.30"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Extreme High Threshold" tooltip="YES price above this = extreme greed">
                <input
                  type="number"
                  value={fearExtremeHighThreshold}
                  onChange={(e) => setFearExtremeHighThreshold(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.70"
                  max="0.95"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Max Position ($)" tooltip="Maximum position size">
                <input
                  type="number"
                  value={fearMaxPositionUsd}
                  onChange={(e) => setFearMaxPositionUsd(parseFloat(e.target.value))}
                  step="25"
                  min="25"
                  max="1000"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
            
            {/* Macro Board */}
            <StrategyCard
              title="Macro Board Strategy"
              description="Heavy weighted exposure to macro events with high conviction"
              confidence={65}
              potentialReturn="$62K/month potential"
              icon={BarChart3}
              iconColor="bg-indigo-500/20 text-indigo-400"
              enabled={enableMacroBoard}
              onToggle={() => setEnableMacroBoard(!enableMacroBoard)}
              expanded={expandedStrategies.has('macro-board')}
              onExpand={() => toggleExpanded('macro-board')}
              disabled={!isAdmin}
            >
              <SettingRow label="Max Exposure ($)" tooltip="Maximum total exposure">
                <input
                  type="number"
                  value={macroMaxExposureUsd}
                  onChange={(e) => setMacroMaxExposureUsd(parseFloat(e.target.value))}
                  step="500"
                  min="500"
                  max="100000"
                  className="w-28 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
              <SettingRow label="Min Conviction Score" tooltip="Minimum conviction to trade (0-100)">
                <input
                  type="number"
                  value={macroMinConvictionScore}
                  onChange={(e) => setMacroMinConvictionScore(parseInt(e.target.value))}
                  min="50"
                  max="100"
                  className="w-24 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                />
              </SettingRow>
            </StrategyCard>
          </div>
        </section>
      </div>
      
      {/* Sticky Save Button for Mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button
          onClick={handleSave}
          disabled={saving || !isAdmin}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-medium shadow-lg transition-all",
            saving ? "bg-dark-border text-dark-muted" :
            "bg-neon-green text-dark-bg hover:bg-neon-green/90"
          )}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
