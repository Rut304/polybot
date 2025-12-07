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
  HelpCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useBotStatus, useBotConfig, useDisabledMarkets, useResetSimulation } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Tooltip, LabelWithTooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';

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
  const [slippageMinPct, setSlippageMinPct] = useState(config?.slippage_min_pct ?? 0.2);
  const [slippageMaxPct, setSlippageMaxPct] = useState(config?.slippage_max_pct ?? 1.0);
  const [spreadCostPct, setSpreadCostPct] = useState(config?.spread_cost_pct ?? 0.5);
  const [executionFailureRate, setExecutionFailureRate] = useState(config?.execution_failure_rate ?? 0.15);
  const [partialFillChance, setPartialFillChance] = useState(config?.partial_fill_chance ?? 0.15);
  const [partialFillMinPct, setPartialFillMinPct] = useState(config?.partial_fill_min_pct ?? 0.70);
  
  // Market resolution risk
  const [resolutionLossRate, setResolutionLossRate] = useState(config?.resolution_loss_rate ?? 0.08);
  const [lossSeverityMin, setLossSeverityMin] = useState(config?.loss_severity_min ?? 0.10);
  const [lossSeverityMax, setLossSeverityMax] = useState(config?.loss_severity_max ?? 0.40);
  
  // Position sizing
  const [maxPositionPct, setMaxPositionPct] = useState(config?.max_position_pct ?? 5.0);
  const [maxPositionUsd, setMaxPositionUsd] = useState(config?.max_position_usd ?? 50.0);
  const [minPositionUsd, setMinPositionUsd] = useState(config?.min_position_usd ?? 5.0);
  
  // =========================================================================
  // PER-STRATEGY SETTINGS (Independent for each arbitrage type!)
  // =========================================================================
  
  // Strategy toggles
  const [enablePolySingleArb, setEnablePolySingleArb] = useState(config?.enable_polymarket_single_arb ?? true);
  const [enableKalshiSingleArb, setEnableKalshiSingleArb] = useState(config?.enable_kalshi_single_arb ?? true);
  const [enableCrossPlatArb, setEnableCrossPlatArb] = useState(config?.enable_cross_platform_arb ?? true);
  
  // Polymarket Single settings (PhD Research Optimized - Saguillo 2025)
  // Research: $40M extracted at 0.3-2% margins, 0% fees = aggressive thresholds
  const [polySingleMinProfit, setPolySingleMinProfit] = useState(config?.poly_single_min_profit_pct ?? 0.3);
  const [polySingleMaxSpread, setPolySingleMaxSpread] = useState(config?.poly_single_max_spread_pct ?? 12.0);
  const [polySingleMaxPos, setPolySingleMaxPos] = useState(config?.poly_single_max_position_usd ?? 100.0);
  const [polySingleScanInt, setPolySingleScanInt] = useState(config?.poly_single_scan_interval_sec ?? 30);
  
  // Kalshi Single settings (Fee-Adjusted: 7% fees = need 8%+ gross profit)
  const [kalshiSingleMinProfit, setKalshiSingleMinProfit] = useState(config?.kalshi_single_min_profit_pct ?? 8.0);
  const [kalshiSingleMaxSpread, setKalshiSingleMaxSpread] = useState(config?.kalshi_single_max_spread_pct ?? 15.0);
  const [kalshiSingleMaxPos, setKalshiSingleMaxPos] = useState(config?.kalshi_single_max_position_usd ?? 30.0);
  const [kalshiSingleScanInt, setKalshiSingleScanInt] = useState(config?.kalshi_single_scan_interval_sec ?? 60);
  
  // Cross-Platform settings (Asymmetric: Buy Poly 0% fee, Buy Kalshi 7% fee)
  const [crossPlatMinProfitBuyPoly, setCrossPlatMinProfitBuyPoly] = useState(config?.cross_plat_min_profit_buy_poly_pct ?? 2.5);
  const [crossPlatMinProfitBuyKalshi, setCrossPlatMinProfitBuyKalshi] = useState(config?.cross_plat_min_profit_buy_kalshi_pct ?? 9.0);
  const [crossPlatMaxPos, setCrossPlatMaxPos] = useState(config?.cross_plat_max_position_usd ?? 75.0);
  const [crossPlatScanInt, setCrossPlatScanInt] = useState(config?.cross_plat_scan_interval_sec ?? 90);
  const [crossPlatMinSimilarity, setCrossPlatMinSimilarity] = useState(config?.cross_plat_min_similarity ?? 0.35);
  
  // =========================================================================
  // ADVANCED STRATEGIES (Market Making & News Arbitrage)
  // =========================================================================
  
  // Market Making (HIGH confidence - 10-20% APR)
  const [enableMarketMaking, setEnableMarketMaking] = useState(config?.enable_market_making ?? false);
  const [mmTargetSpreadBps, setMmTargetSpreadBps] = useState(config?.mm_target_spread_bps ?? 200);
  const [mmMinSpreadBps, setMmMinSpreadBps] = useState(config?.mm_min_spread_bps ?? 50);
  const [mmMaxSpreadBps, setMmMaxSpreadBps] = useState(config?.mm_max_spread_bps ?? 500);
  const [mmOrderSizeUsd, setMmOrderSizeUsd] = useState(config?.mm_order_size_usd ?? 50.0);
  const [mmMaxInventoryUsd, setMmMaxInventoryUsd] = useState(config?.mm_max_inventory_usd ?? 500.0);
  const [mmQuoteRefreshSec, setMmQuoteRefreshSec] = useState(config?.mm_quote_refresh_sec ?? 5);
  const [mmMinVolume24h, setMmMinVolume24h] = useState(config?.mm_min_volume_24h ?? 10000.0);
  const [mmMaxMarkets, setMmMaxMarkets] = useState(config?.mm_max_markets ?? 5);
  
  // News Arbitrage (MEDIUM confidence - 5-30% per event)
  const [enableNewsArbitrage, setEnableNewsArbitrage] = useState(config?.enable_news_arbitrage ?? false);
  const [newsMinSpreadPct, setNewsMinSpreadPct] = useState(config?.news_min_spread_pct ?? 3.0);
  const [newsMaxLagMinutes, setNewsMaxLagMinutes] = useState(config?.news_max_lag_minutes ?? 30);
  const [newsPositionSizeUsd, setNewsPositionSizeUsd] = useState(config?.news_position_size_usd ?? 50.0);
  const [newsScanIntervalSec, setNewsScanIntervalSec] = useState(config?.news_scan_interval_sec ?? 30);
  const [newsKeywords, setNewsKeywords] = useState(config?.news_keywords ?? 'election,fed,trump,bitcoin,crypto,verdict');
  
  // =========================================================================
  // CRYPTO STRATEGIES (NEW - High Priority from Research)
  // =========================================================================
  
  // Funding Rate Arbitrage (85% confidence - 15-50% APY)
  const [enableFundingRateArb, setEnableFundingRateArb] = useState(config?.enable_funding_rate_arb ?? false);
  const [fundingMinRatePct, setFundingMinRatePct] = useState(config?.funding_min_rate_pct ?? 0.03);
  const [fundingMinApy, setFundingMinApy] = useState(config?.funding_min_apy ?? 30.0);
  const [fundingMaxPositionUsd, setFundingMaxPositionUsd] = useState(config?.funding_max_position_usd ?? 1000.0);
  const [fundingMaxPositions, setFundingMaxPositions] = useState(config?.funding_max_positions ?? 3);
  const [fundingMaxLeverage, setFundingMaxLeverage] = useState(config?.funding_max_leverage ?? 3);
  const [fundingScanIntervalSec, setFundingScanIntervalSec] = useState(config?.funding_scan_interval_sec ?? 300);
  
  // Grid Trading (75% confidence - 20-60% APY in ranging markets)
  const [enableGridTrading, setEnableGridTrading] = useState(config?.enable_grid_trading ?? false);
  const [gridDefaultRangePct, setGridDefaultRangePct] = useState(config?.grid_default_range_pct ?? 10.0);
  const [gridDefaultLevels, setGridDefaultLevels] = useState(config?.grid_default_levels ?? 20);
  const [gridDefaultInvestmentUsd, setGridDefaultInvestmentUsd] = useState(config?.grid_default_investment_usd ?? 500.0);
  const [gridMaxGrids, setGridMaxGrids] = useState(config?.grid_max_grids ?? 3);
  const [gridStopLossPct, setGridStopLossPct] = useState(config?.grid_stop_loss_pct ?? 15.0);
  const [gridTakeProfitPct, setGridTakeProfitPct] = useState(config?.grid_take_profit_pct ?? 50.0);
  
  // Pairs Trading (65% confidence - 10-25% APY)
  const [enablePairsTrading, setEnablePairsTrading] = useState(config?.enable_pairs_trading ?? false);
  const [pairsEntryZscore, setPairsEntryZscore] = useState(config?.pairs_entry_zscore ?? 2.0);
  const [pairsExitZscore, setPairsExitZscore] = useState(config?.pairs_exit_zscore ?? 0.5);
  const [pairsPositionSizeUsd, setPairsPositionSizeUsd] = useState(config?.pairs_position_size_usd ?? 500.0);
  const [pairsMaxPositions, setPairsMaxPositions] = useState(config?.pairs_max_positions ?? 2);
  const [pairsMaxHoldHours, setPairsMaxHoldHours] = useState(config?.pairs_max_hold_hours ?? 72.0);
  
  // =========================================================================
  // EXCHANGE ENABLEMENT (which platforms to trade on)
  // =========================================================================
  
  // Crypto Exchanges
  const [enableBinance, setEnableBinance] = useState(config?.enable_binance ?? false);
  const [enableBybit, setEnableBybit] = useState(config?.enable_bybit ?? false);
  const [enableOkx, setEnableOkx] = useState(config?.enable_okx ?? false);
  const [enableKraken, setEnableKraken] = useState(config?.enable_kraken ?? false);
  const [enableCoinbase, setEnableCoinbase] = useState(config?.enable_coinbase ?? false);
  const [enableKucoin, setEnableKucoin] = useState(config?.enable_kucoin ?? false);
  
  // Stock Brokers
  const [enableAlpaca, setEnableAlpaca] = useState(config?.enable_alpaca ?? false);
  const [enableIbkr, setEnableIbkr] = useState(config?.enable_ibkr ?? false);
  
  // UI state for strategy settings section
  const [showStrategySettings, setShowStrategySettings] = useState(false);
  const [showAdvancedStrategies, setShowAdvancedStrategies] = useState(false);
  const [showCryptoStrategies, setShowCryptoStrategies] = useState(false);
  const [showExchangeSettings, setShowExchangeSettings] = useState(false);
  
  // UI state
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showUserAdmin, setShowUserAdmin] = useState(false);

  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Sync state when config loads from database
  // Skip sync while saving to prevent race conditions
  useEffect(() => {
    if (config && !saving) {
      // Basic trading parameters
      if (config.min_profit_percent !== undefined) setMinProfitPercent(config.min_profit_percent);
      if (config.max_trade_size !== undefined) setMaxTradeSize(config.max_trade_size);
      if (config.max_daily_loss !== undefined) setMaxDailyLoss(config.max_daily_loss);
      if (config.scan_interval !== undefined) setScanInterval(config.scan_interval);
      if (config.polymarket_enabled !== undefined) setPolymarketEnabled(config.polymarket_enabled);
      if (config.kalshi_enabled !== undefined) setKalshiEnabled(config.kalshi_enabled);
      
      // Advanced parameters
      if (config.max_realistic_spread_pct !== undefined) setMaxRealisticSpreadPct(config.max_realistic_spread_pct);
      if (config.min_profit_threshold_pct !== undefined) setMinProfitThresholdPct(config.min_profit_threshold_pct);
      if (config.slippage_min_pct !== undefined) setSlippageMinPct(config.slippage_min_pct);
      if (config.slippage_max_pct !== undefined) setSlippageMaxPct(config.slippage_max_pct);
      if (config.spread_cost_pct !== undefined) setSpreadCostPct(config.spread_cost_pct);
      if (config.execution_failure_rate !== undefined) setExecutionFailureRate(config.execution_failure_rate);
      if (config.partial_fill_chance !== undefined) setPartialFillChance(config.partial_fill_chance);
      if (config.partial_fill_min_pct !== undefined) setPartialFillMinPct(config.partial_fill_min_pct);
      if (config.resolution_loss_rate !== undefined) setResolutionLossRate(config.resolution_loss_rate);
      if (config.loss_severity_min !== undefined) setLossSeverityMin(config.loss_severity_min);
      if (config.loss_severity_max !== undefined) setLossSeverityMax(config.loss_severity_max);
      if (config.max_position_pct !== undefined) setMaxPositionPct(config.max_position_pct);
      if (config.max_position_usd !== undefined) setMaxPositionUsd(config.max_position_usd);
      if (config.min_position_usd !== undefined) setMinPositionUsd(config.min_position_usd);
      
      // Per-strategy settings
      if (config.enable_polymarket_single_arb !== undefined) setEnablePolySingleArb(config.enable_polymarket_single_arb);
      if (config.enable_kalshi_single_arb !== undefined) setEnableKalshiSingleArb(config.enable_kalshi_single_arb);
      if (config.enable_cross_platform_arb !== undefined) setEnableCrossPlatArb(config.enable_cross_platform_arb);
      // Polymarket Single
      if (config.poly_single_min_profit_pct !== undefined) setPolySingleMinProfit(config.poly_single_min_profit_pct);
      if (config.poly_single_max_spread_pct !== undefined) setPolySingleMaxSpread(config.poly_single_max_spread_pct);
      if (config.poly_single_max_position_usd !== undefined) setPolySingleMaxPos(config.poly_single_max_position_usd);
      if (config.poly_single_scan_interval_sec !== undefined) setPolySingleScanInt(config.poly_single_scan_interval_sec);
      // Kalshi Single
      if (config.kalshi_single_min_profit_pct !== undefined) setKalshiSingleMinProfit(config.kalshi_single_min_profit_pct);
      if (config.kalshi_single_max_spread_pct !== undefined) setKalshiSingleMaxSpread(config.kalshi_single_max_spread_pct);
      if (config.kalshi_single_max_position_usd !== undefined) setKalshiSingleMaxPos(config.kalshi_single_max_position_usd);
      if (config.kalshi_single_scan_interval_sec !== undefined) setKalshiSingleScanInt(config.kalshi_single_scan_interval_sec);
      // Cross-Platform
      if (config.cross_plat_min_profit_buy_poly_pct !== undefined) setCrossPlatMinProfitBuyPoly(config.cross_plat_min_profit_buy_poly_pct);
      if (config.cross_plat_min_profit_buy_kalshi_pct !== undefined) setCrossPlatMinProfitBuyKalshi(config.cross_plat_min_profit_buy_kalshi_pct);
      if (config.cross_plat_max_position_usd !== undefined) setCrossPlatMaxPos(config.cross_plat_max_position_usd);
      if (config.cross_plat_scan_interval_sec !== undefined) setCrossPlatScanInt(config.cross_plat_scan_interval_sec);
      if (config.cross_plat_min_similarity !== undefined) setCrossPlatMinSimilarity(config.cross_plat_min_similarity);
      
      // Market Making
      if (config.enable_market_making !== undefined) setEnableMarketMaking(config.enable_market_making);
      if (config.mm_target_spread_bps !== undefined) setMmTargetSpreadBps(config.mm_target_spread_bps);
      if (config.mm_min_spread_bps !== undefined) setMmMinSpreadBps(config.mm_min_spread_bps);
      if (config.mm_max_spread_bps !== undefined) setMmMaxSpreadBps(config.mm_max_spread_bps);
      if (config.mm_order_size_usd !== undefined) setMmOrderSizeUsd(config.mm_order_size_usd);
      if (config.mm_max_inventory_usd !== undefined) setMmMaxInventoryUsd(config.mm_max_inventory_usd);
      if (config.mm_quote_refresh_sec !== undefined) setMmQuoteRefreshSec(config.mm_quote_refresh_sec);
      if (config.mm_min_volume_24h !== undefined) setMmMinVolume24h(config.mm_min_volume_24h);
      if (config.mm_max_markets !== undefined) setMmMaxMarkets(config.mm_max_markets);
      
      // News Arbitrage
      if (config.enable_news_arbitrage !== undefined) setEnableNewsArbitrage(config.enable_news_arbitrage);
      if (config.news_min_spread_pct !== undefined) setNewsMinSpreadPct(config.news_min_spread_pct);
      if (config.news_max_lag_minutes !== undefined) setNewsMaxLagMinutes(config.news_max_lag_minutes);
      if (config.news_position_size_usd !== undefined) setNewsPositionSizeUsd(config.news_position_size_usd);
      if (config.news_scan_interval_sec !== undefined) setNewsScanIntervalSec(config.news_scan_interval_sec);
      if (config.news_keywords !== undefined) setNewsKeywords(config.news_keywords);
      
      // Funding Rate Arbitrage (NEW)
      if (config.enable_funding_rate_arb !== undefined) setEnableFundingRateArb(config.enable_funding_rate_arb);
      if (config.funding_min_rate_pct !== undefined) setFundingMinRatePct(config.funding_min_rate_pct);
      if (config.funding_min_apy !== undefined) setFundingMinApy(config.funding_min_apy);
      if (config.funding_max_position_usd !== undefined) setFundingMaxPositionUsd(config.funding_max_position_usd);
      if (config.funding_max_positions !== undefined) setFundingMaxPositions(config.funding_max_positions);
      if (config.funding_max_leverage !== undefined) setFundingMaxLeverage(config.funding_max_leverage);
      if (config.funding_scan_interval_sec !== undefined) setFundingScanIntervalSec(config.funding_scan_interval_sec);
      
      // Grid Trading (NEW)
      if (config.enable_grid_trading !== undefined) setEnableGridTrading(config.enable_grid_trading);
      if (config.grid_default_range_pct !== undefined) setGridDefaultRangePct(config.grid_default_range_pct);
      if (config.grid_default_levels !== undefined) setGridDefaultLevels(config.grid_default_levels);
      if (config.grid_default_investment_usd !== undefined) setGridDefaultInvestmentUsd(config.grid_default_investment_usd);
      if (config.grid_max_grids !== undefined) setGridMaxGrids(config.grid_max_grids);
      if (config.grid_stop_loss_pct !== undefined) setGridStopLossPct(config.grid_stop_loss_pct);
      if (config.grid_take_profit_pct !== undefined) setGridTakeProfitPct(config.grid_take_profit_pct);
      
      // Pairs Trading (NEW)
      if (config.enable_pairs_trading !== undefined) setEnablePairsTrading(config.enable_pairs_trading);
      if (config.pairs_entry_zscore !== undefined) setPairsEntryZscore(config.pairs_entry_zscore);
      if (config.pairs_exit_zscore !== undefined) setPairsExitZscore(config.pairs_exit_zscore);
      if (config.pairs_position_size_usd !== undefined) setPairsPositionSizeUsd(config.pairs_position_size_usd);
      if (config.pairs_max_positions !== undefined) setPairsMaxPositions(config.pairs_max_positions);
      if (config.pairs_max_hold_hours !== undefined) setPairsMaxHoldHours(config.pairs_max_hold_hours);
      
      // Exchange Enablement (NEW)
      if (config.enable_binance !== undefined) setEnableBinance(config.enable_binance);
      if (config.enable_bybit !== undefined) setEnableBybit(config.enable_bybit);
      if (config.enable_okx !== undefined) setEnableOkx(config.enable_okx);
      if (config.enable_kraken !== undefined) setEnableKraken(config.enable_kraken);
      if (config.enable_coinbase !== undefined) setEnableCoinbase(config.enable_coinbase);
      if (config.enable_kucoin !== undefined) setEnableKucoin(config.enable_kucoin);
      if (config.enable_alpaca !== undefined) setEnableAlpaca(config.enable_alpaca);
      if (config.enable_ibkr !== undefined) setEnableIbkr(config.enable_ibkr);
    }
  }, [config, saving]);
  
  // Sync bot status state when it loads
  useEffect(() => {
    if (botStatus) {
      if (botStatus.is_running !== undefined) setBotEnabled(botStatus.is_running);
      if (botStatus.dry_run_mode !== undefined) setDryRunMode(botStatus.dry_run_mode);
    }
  }, [botStatus]);
  
  // Use the reset simulation hook
  const resetSimulation = useResetSimulation();
  
  // Fetch users for admin via API (uses service key to bypass RLS)
  const { data: users = [], refetch: refetchUsers, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users', isAdmin],
    queryFn: async () => {
      console.log('Fetching users, isAdmin:', isAdmin);
      const response = await fetch('/api/users');
      const result = await response.json();
      console.log('Users API response:', result);
      if (!response.ok) throw new Error(result.error);
      return result.users || [];
    },
    enabled: isAdmin,
    staleTime: 0,
  });
  
  // Debug logging
  useEffect(() => {
    console.log('Settings: user=', user, 'isAdmin=', isAdmin, 'users=', users, 'usersLoading=', usersLoading, 'usersError=', usersError);
  }, [user, isAdmin, users, usersLoading, usersError]);

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

  // State for save feedback
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      // Save bot status first
      await updateBotStatus.mutateAsync({
        is_running: botEnabled,
        dry_run_mode: dryRunMode,
      });
      
      // Save config with all settings
      const configToSave = {
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
        // Per-strategy settings
        enable_polymarket_single_arb: enablePolySingleArb,
        enable_kalshi_single_arb: enableKalshiSingleArb,
        enable_cross_platform_arb: enableCrossPlatArb,
        // Polymarket Single
        poly_single_min_profit_pct: polySingleMinProfit,
        poly_single_max_spread_pct: polySingleMaxSpread,
        poly_single_max_position_usd: polySingleMaxPos,
        poly_single_scan_interval_sec: polySingleScanInt,
        // Kalshi Single
        kalshi_single_min_profit_pct: kalshiSingleMinProfit,
        kalshi_single_max_spread_pct: kalshiSingleMaxSpread,
        kalshi_single_max_position_usd: kalshiSingleMaxPos,
        kalshi_single_scan_interval_sec: kalshiSingleScanInt,
        // Cross-Platform
        cross_plat_min_profit_buy_poly_pct: crossPlatMinProfitBuyPoly,
        cross_plat_min_profit_buy_kalshi_pct: crossPlatMinProfitBuyKalshi,
        cross_plat_max_position_usd: crossPlatMaxPos,
        cross_plat_scan_interval_sec: crossPlatScanInt,
        cross_plat_min_similarity: crossPlatMinSimilarity,
        // Market Making
        enable_market_making: enableMarketMaking,
        mm_target_spread_bps: mmTargetSpreadBps,
        mm_min_spread_bps: mmMinSpreadBps,
        mm_max_spread_bps: mmMaxSpreadBps,
        mm_order_size_usd: mmOrderSizeUsd,
        mm_max_inventory_usd: mmMaxInventoryUsd,
        mm_quote_refresh_sec: mmQuoteRefreshSec,
        mm_min_volume_24h: mmMinVolume24h,
        mm_max_markets: mmMaxMarkets,
        // News Arbitrage
        enable_news_arbitrage: enableNewsArbitrage,
        news_min_spread_pct: newsMinSpreadPct,
        news_max_lag_minutes: newsMaxLagMinutes,
        news_position_size_usd: newsPositionSizeUsd,
        news_scan_interval_sec: newsScanIntervalSec,
        news_keywords: newsKeywords,
        // Funding Rate Arbitrage
        enable_funding_rate_arb: enableFundingRateArb,
        funding_min_rate_pct: fundingMinRatePct,
        funding_min_apy: fundingMinApy,
        funding_max_position_usd: fundingMaxPositionUsd,
        funding_max_positions: fundingMaxPositions,
        funding_max_leverage: fundingMaxLeverage,
        funding_scan_interval_sec: fundingScanIntervalSec,
        // Grid Trading
        enable_grid_trading: enableGridTrading,
        grid_default_range_pct: gridDefaultRangePct,
        grid_default_levels: gridDefaultLevels,
        grid_default_investment_usd: gridDefaultInvestmentUsd,
        grid_max_grids: gridMaxGrids,
        grid_stop_loss_pct: gridStopLossPct,
        grid_take_profit_pct: gridTakeProfitPct,
        // Pairs Trading
        enable_pairs_trading: enablePairsTrading,
        pairs_entry_zscore: pairsEntryZscore,
        pairs_exit_zscore: pairsExitZscore,
        pairs_position_size_usd: pairsPositionSizeUsd,
        pairs_max_positions: pairsMaxPositions,
        pairs_max_hold_hours: pairsMaxHoldHours,
        // Exchange Enablement
        enable_binance: enableBinance,
        enable_bybit: enableBybit,
        enable_okx: enableOkx,
        enable_kraken: enableKraken,
        enable_coinbase: enableCoinbase,
        enable_kucoin: enableKucoin,
        enable_alpaca: enableAlpaca,
        enable_ibkr: enableIbkr,
        // Add updated_at timestamp
        updated_at: new Date().toISOString(),
      };
      
      console.log('Saving config:', configToSave);
      await updateConfig.mutateAsync(configToSave);
      
      setSaveSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings. Please try again.');
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
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold">Bot Status</h3>
                  <Tooltip content={METRIC_TOOLTIPS.botRunning} position="right">
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <p className="text-sm text-gray-400">
                  {botEnabled ? 'Bot is actively scanning for opportunities' : 'Bot is paused'}
                </p>
              </div>
            </div>
            <ToggleSwitch enabled={botEnabled} onToggle={handleBotToggle} size="lg" disabled={!isAdmin} />
          </div>

          {/* Dry Run Mode */}
          <div className={cn(
            "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
            dryRunMode 
              ? "bg-dark-border/30 border-transparent" 
              : "bg-red-900/20 border-red-500/50 shadow-lg shadow-red-500/10"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                dryRunMode ? "bg-yellow-500/20" : "bg-red-500/20"
              )}>
                {dryRunMode ? (
                  <Shield className="w-6 h-6 text-yellow-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {dryRunMode ? 'Simulation Mode (Paper Trading)' : '🔴 LIVE TRADING MODE'}
                  </h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    dryRunMode 
                      ? "bg-yellow-500/20 text-yellow-400" 
                      : "bg-red-500/30 text-red-400"
                  )}>
                    {dryRunMode ? 'PAPER' : 'REAL MONEY'}
                  </span>
                  <Tooltip content={METRIC_TOOLTIPS.dryRunMode} position="right">
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <p className={cn(
                  "text-sm",
                  dryRunMode ? "text-gray-400" : "text-red-400 font-medium"
                )}>
                  {dryRunMode 
                    ? 'Safe mode - No real money at risk. All trades are simulated.' 
                    : '⚠️ CAUTION: Real money is at risk! All trades will execute on live markets.'}
                </p>
              </div>
            </div>
            <ToggleSwitch 
              enabled={dryRunMode} 
              onToggle={() => {
                if (dryRunMode) {
                  // Switching FROM simulation TO live - show confirmation
                  setShowConfirm('live-trading');
                } else {
                  // Switching from live to simulation - no confirmation needed
                  setDryRunMode(true);
                }
              }} 
              size="lg" 
              disabled={!isAdmin} 
            />
          </div>

          {/* Live Trading Confirmation Modal */}
          <AnimatePresence>
            {showConfirm === 'live-trading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
                onClick={() => setShowConfirm(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-dark-card border-2 border-red-500/50 rounded-2xl p-6 max-w-md mx-4 shadow-2xl shadow-red-500/20"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-red-400">Enable Live Trading?</h3>
                      <p className="text-sm text-gray-400">This action cannot be undone automatically</p>
                    </div>
                  </div>
                  
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                    <p className="text-red-300 font-medium mb-2">⚠️ Warning: Real Money at Risk</p>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• All trades will execute with real funds</li>
                      <li>• Losses are permanent and irreversible</li>
                      <li>• Ensure your API keys have trading permissions</li>
                      <li>• Start with small position sizes</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirm(null)}
                      className="flex-1 px-4 py-3 bg-dark-border hover:bg-dark-border/70 rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setDryRunMode(false);
                        setShowConfirm(null);
                      }}
                      className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
                    >
                      Yes, Enable Live Trading
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold">Polymarket</h3>
                    <Tooltip content={METRIC_TOOLTIPS.polymarketEnabled} position="right">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
                    </Tooltip>
                  </div>
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
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold">Kalshi</h3>
                    <Tooltip content={METRIC_TOOLTIPS.kalshiEnabled} position="right">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
                    </Tooltip>
                  </div>
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
              <LabelWithTooltip label="Minimum Profit %" tooltip={METRIC_TOOLTIPS.minProfitPercent} />
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
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <DollarSign className="w-4 h-4" />
              <LabelWithTooltip label="Max Trade Size ($)" tooltip={METRIC_TOOLTIPS.maxTradeSize} />
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
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <LabelWithTooltip label="Max Daily Loss ($)" tooltip={METRIC_TOOLTIPS.maxDailyLoss} />
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
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <Clock className="w-4 h-4" />
              <LabelWithTooltip label="Scan Interval (seconds)" tooltip={METRIC_TOOLTIPS.scanInterval} />
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

      {/* Per-Strategy Arbitrage Settings */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="card mb-6"
      >
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-green" />
          Core Arbitrage Strategies
        </h2>
        <p className="text-sm text-gray-500 mb-6">Each strategy exploits different market inefficiencies. Enable/disable and tune independently.</p>

        {/* ══════════════════════════════════════════════════════════════════════
            POLYMARKET SINGLE-PLATFORM ARBITRAGE
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-xl border-2 border-polymarket overflow-hidden">
          {/* Header with toggle */}
          <div className="bg-polymarket/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-polymarket flex items-center justify-center">
                <span className="text-lg font-bold text-white">P</span>
              </div>
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  Polymarket Single-Platform
                  <span className="text-xs bg-neon-green/30 text-neon-green px-2 py-0.5 rounded-full">★ HIGHEST ROI</span>
                </h3>
                <p className="text-xs text-polymarket">Intra-market price imbalances • 0% trading fees</p>
              </div>
            </div>
            <ToggleSwitch enabled={enablePolySingleArb} onToggle={() => setEnablePolySingleArb(!enablePolySingleArb)} disabled={!isAdmin} size="md" />
          </div>
          
          {/* Strategy explanation */}
          <div className="px-4 py-3 bg-dark-bg/50 border-b border-polymarket/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                <p className="text-gray-300">Finds markets where YES + NO {">"} $1.00 (guaranteed profit) or multi-outcome markets where probabilities don&apos;t sum to 100%.</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Why It&apos;s Profitable</p>
                <p className="text-gray-300">PhD research (Saguillo 2025) found <span className="text-neon-green font-semibold">$40M extracted</span> at 0.3-2% margins. Zero fees means even tiny edges are profitable.</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                <p className="text-gray-300">
                  <span className="text-neon-green font-semibold">20-100% APY</span> depending on capital deployed. 
                  Win rate: ~85% (market mispricing is real edge).
                </p>
              </div>
            </div>
          </div>
          
          {/* Settings */}
          <div className="p-4 bg-polymarket/5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Percent className="w-3 h-3" />
                  Min Profit %
                </label>
                <input
                  type="number"
                  value={polySingleMinProfit}
                  onChange={(e) => setPolySingleMinProfit(parseFloat(e.target.value))}
                  step="0.1"
                  min="0.1"
                  max="5"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-polymarket text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">0.3% captures most edges</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Target className="w-3 h-3" />
                  Max Spread %
                </label>
                <input
                  type="number"
                  value={polySingleMaxSpread}
                  onChange={(e) => setPolySingleMaxSpread(parseFloat(e.target.value))}
                  step="1"
                  min="1"
                  max="50"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-polymarket text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">{">"}12% likely stale data</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <DollarSign className="w-3 h-3" />
                  Max Position $
                </label>
                <input
                  type="number"
                  value={polySingleMaxPos}
                  onChange={(e) => setPolySingleMaxPos(parseFloat(e.target.value))}
                  step="10"
                  min="1"
                  max="1000"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-polymarket text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Safest strategy - go bigger</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Clock className="w-3 h-3" />
                  Scan Interval (sec)
                </label>
                <input
                  type="number"
                  value={polySingleScanInt}
                  onChange={(e) => setPolySingleScanInt(parseInt(e.target.value))}
                  step="5"
                  min="5"
                  max="300"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-polymarket text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Faster = more edges found</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            KALSHI SINGLE-PLATFORM ARBITRAGE
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 rounded-xl border-2 border-kalshi overflow-hidden">
          {/* Header with toggle */}
          <div className="bg-kalshi/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-kalshi flex items-center justify-center">
                <span className="text-lg font-bold text-white">K</span>
              </div>
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  Kalshi Single-Platform
                  <span className="text-xs bg-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full">⚠️ 7% FEES</span>
                </h3>
                <p className="text-xs text-kalshi">Regulated US exchange • USD settlement</p>
              </div>
            </div>
            <ToggleSwitch enabled={enableKalshiSingleArb} onToggle={() => setEnableKalshiSingleArb(!enableKalshiSingleArb)} disabled={!isAdmin} size="md" />
          </div>
          
          {/* Strategy explanation */}
          <div className="px-4 py-3 bg-dark-bg/50 border-b border-kalshi/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                <p className="text-gray-300">Same logic as Polymarket - find YES + NO {">"} $1.00 imbalances within Kalshi&apos;s binary event markets.</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">The Fee Challenge</p>
                <p className="text-gray-300">Kalshi takes <span className="text-yellow-400 font-semibold">7% of profits</span>. If you find an 8% edge, you only keep 1%. Need larger spreads to be worthwhile.</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                <p className="text-gray-300">
                  <span className="text-kalshi font-semibold">5-15% APY</span> after fees.
                  Lower frequency but fully regulated (legal certainty).
                </p>
              </div>
            </div>
          </div>
          
          {/* Settings */}
          <div className="p-4 bg-kalshi/5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Percent className="w-3 h-3" />
                  Min Profit %
                </label>
                <input
                  type="number"
                  value={kalshiSingleMinProfit}
                  onChange={(e) => setKalshiSingleMinProfit(parseFloat(e.target.value))}
                  step="0.5"
                  min="1"
                  max="20"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-kalshi text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">8%+ to net 1% after fees</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Target className="w-3 h-3" />
                  Max Spread %
                </label>
                <input
                  type="number"
                  value={kalshiSingleMaxSpread}
                  onChange={(e) => setKalshiSingleMaxSpread(parseFloat(e.target.value))}
                  step="1"
                  min="1"
                  max="50"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-kalshi text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Filter illiquid markets</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <DollarSign className="w-3 h-3" />
                  Max Position $
                </label>
                <input
                  type="number"
                  value={kalshiSingleMaxPos}
                  onChange={(e) => setKalshiSingleMaxPos(parseFloat(e.target.value))}
                  step="10"
                  min="1"
                  max="500"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-kalshi text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Keep small - fees hurt</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Clock className="w-3 h-3" />
                  Scan Interval (sec)
                </label>
                <input
                  type="number"
                  value={kalshiSingleScanInt}
                  onChange={(e) => setKalshiSingleScanInt(parseInt(e.target.value))}
                  step="5"
                  min="5"
                  max="300"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-kalshi text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Less frequent is fine</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            CROSS-PLATFORM ARBITRAGE
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border-2 border-neon-purple overflow-hidden">
          {/* Header with toggle */}
          <div className="bg-neon-purple/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-polymarket to-kalshi flex items-center justify-center">
                <span className="text-lg font-bold text-white">⇄</span>
              </div>
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  Cross-Platform Arbitrage
                  <span className="text-xs bg-neon-purple/30 text-neon-purple px-2 py-0.5 rounded-full">ASYMMETRIC</span>
                </h3>
                <p className="text-xs text-neon-purple">Polymarket ↔ Kalshi price differences • Same event, different prices</p>
              </div>
            </div>
            <ToggleSwitch enabled={enableCrossPlatArb} onToggle={() => setEnableCrossPlatArb(!enableCrossPlatArb)} disabled={!isAdmin} size="md" />
          </div>
          
          {/* Strategy explanation */}
          <div className="px-4 py-3 bg-dark-bg/50 border-b border-neon-purple/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                <p className="text-gray-300">Matches same events across platforms. If Poly says 60¢ YES and Kalshi says 35¢ YES, buy cheap side and hedge or wait for convergence.</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Asymmetric Thresholds</p>
                <p className="text-gray-300">
                  <span className="text-polymarket">Buy Poly</span> = 0% fee → lower threshold needed.<br/>
                  <span className="text-kalshi">Buy Kalshi</span> = 7% fee → need bigger spread.
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                <p className="text-gray-300">
                  <span className="text-neon-purple font-semibold">~$95K historical</span> in documented opportunities.
                  Rare but real. Higher execution complexity.
                </p>
              </div>
            </div>
          </div>
          
          {/* Settings */}
          <div className="p-4 bg-neon-purple/5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <span className="text-polymarket">P</span> Min Profit %
                </label>
                <input
                  type="number"
                  value={crossPlatMinProfitBuyPoly}
                  onChange={(e) => setCrossPlatMinProfitBuyPoly(parseFloat(e.target.value))}
                  step="0.5"
                  min="0.5"
                  max="20"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-polymarket text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">When buying on Poly</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <span className="text-kalshi">K</span> Min Profit %
                </label>
                <input
                  type="number"
                  value={crossPlatMinProfitBuyKalshi}
                  onChange={(e) => setCrossPlatMinProfitBuyKalshi(parseFloat(e.target.value))}
                  step="0.5"
                  min="1"
                  max="20"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-kalshi text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">When buying on Kalshi</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <DollarSign className="w-3 h-3" />
                  Max Position $
                </label>
                <input
                  type="number"
                  value={crossPlatMaxPos}
                  onChange={(e) => setCrossPlatMaxPos(parseFloat(e.target.value))}
                  step="10"
                  min="1"
                  max="500"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Execution risk - be careful</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Clock className="w-3 h-3" />
                  Scan Interval (sec)
                </label>
                <input
                  type="number"
                  value={crossPlatScanInt}
                  onChange={(e) => setCrossPlatScanInt(parseInt(e.target.value))}
                  step="5"
                  min="10"
                  max="300"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Cross-platform matching</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                  <Target className="w-3 h-3" />
                  Min Similarity
                </label>
                <input
                  type="number"
                  value={crossPlatMinSimilarity}
                  onChange={(e) => setCrossPlatMinSimilarity(parseFloat(e.target.value))}
                  step="0.05"
                  min="0.1"
                  max="1"
                  disabled={!isAdmin}
                  className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-500 mt-1">Market matching strictness</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Advanced Strategies: Market Making & News Arbitrage */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.23 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowAdvancedStrategies(!showAdvancedStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle advanced strategies"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Advanced Strategies
            <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-normal">NEW</span>
          </h2>
          {showAdvancedStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Market Making (10-20% APR) & News Arbitrage (5-30% per event)</p>

        <AnimatePresence>
          {showAdvancedStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Market Making Strategy - Full Card Layout */}
              <div className="mt-6 rounded-xl border-2 border-neon-green overflow-hidden">
                {/* Header with toggle */}
                <div className="bg-neon-green/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon-green flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Market Making
                        <span className="text-xs bg-neon-green/30 text-neon-green px-2 py-0.5 rounded-full">HIGH CONFIDENCE</span>
                      </h3>
                      <p className="text-xs text-neon-green">Provide liquidity • Earn spreads + rewards</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={enableMarketMaking} 
                    onToggle={() => setEnableMarketMaking(!enableMarketMaking)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                
                {/* Strategy explanation */}
                <div className="px-4 py-3 bg-dark-bg/50 border-b border-neon-green/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                      <p className="text-gray-300">Posts simultaneous buy/sell orders around the current price. You profit from the bid-ask spread when both sides fill.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Why It&apos;s Profitable</p>
                      <p className="text-gray-300">Polymarket offers <span className="text-neon-green font-semibold">liquidity mining rewards</span> (extra USDC) to market makers. You earn spread + rewards with minimal directional risk.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                      <p className="text-gray-300">
                        <span className="text-neon-green font-semibold">10-20% APR</span> from spreads + rewards.
                        Risk: inventory accumulation if market moves sharply.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="p-4 bg-neon-green/5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Target Spread (bps)
                      </label>
                      <input
                        type="number"
                        value={mmTargetSpreadBps}
                        onChange={(e) => setMmTargetSpreadBps(parseInt(e.target.value))}
                        step="10"
                        min="10"
                        max="1000"
                        disabled={!isAdmin}
                        placeholder="200"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">200 bps = 2% spread</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Order Size ($)
                      </label>
                      <input
                        type="number"
                        value={mmOrderSizeUsd}
                        onChange={(e) => setMmOrderSizeUsd(parseFloat(e.target.value))}
                        step="10"
                        min="5"
                        max="500"
                        disabled={!isAdmin}
                        placeholder="50"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Max Inventory ($)
                      </label>
                      <input
                        type="number"
                        value={mmMaxInventoryUsd}
                        onChange={(e) => setMmMaxInventoryUsd(parseFloat(e.target.value))}
                        step="50"
                        min="50"
                        max="5000"
                        disabled={!isAdmin}
                        placeholder="500"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max position per market</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Min 24h Volume ($)
                      </label>
                      <input
                        type="number"
                        value={mmMinVolume24h}
                        onChange={(e) => setMmMinVolume24h(parseFloat(e.target.value))}
                        step="1000"
                        min="1000"
                        max="100000"
                        disabled={!isAdmin}
                        placeholder="10000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Only liquid markets</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Quote Refresh (sec)
                      </label>
                      <input
                        type="number"
                        value={mmQuoteRefreshSec}
                        onChange={(e) => setMmQuoteRefreshSec(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="60"
                        disabled={!isAdmin}
                        placeholder="5"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400 mb-2 block">
                        Max Markets
                      </label>
                      <input
                        type="number"
                        value={mmMaxMarkets}
                        onChange={(e) => setMmMaxMarkets(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="20"
                        disabled={!isAdmin}
                        placeholder="5"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Concurrent markets</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* News Arbitrage Strategy - Full Card Layout */}
              <div className="mt-6 rounded-xl border-2 border-yellow-500 overflow-hidden">
                {/* Header with toggle */}
                <div className="bg-yellow-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        News Arbitrage
                        <span className="text-xs bg-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full">MEDIUM CONFIDENCE</span>
                      </h3>
                      <p className="text-xs text-yellow-400">Exploit Polymarket→Kalshi price lag on breaking news</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={enableNewsArbitrage} 
                    onToggle={() => setEnableNewsArbitrage(!enableNewsArbitrage)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                
                {/* Strategy explanation */}
                <div className="px-4 py-3 bg-dark-bg/50 border-b border-yellow-500/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                      <p className="text-gray-300">When breaking news hits, Polymarket (crypto-fast) reprices before Kalshi (regulated, slower). Bot buys on Kalshi before it catches up.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">The Timing Edge</p>
                      <p className="text-gray-300">Polymarket moves in <span className="text-yellow-400 font-semibold">10-30 seconds</span>. Kalshi often lags by <span className="text-yellow-400 font-semibold">2-5 minutes</span> on major events (earnings, court rulings, Fed announcements).</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                      <p className="text-gray-300">
                        <span className="text-yellow-400 font-semibold">5-30% per event</span>.
                        Rare but lucrative. Requires fast execution during high-volatility moments.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="p-4 bg-yellow-500/5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Min Spread (%)
                      </label>
                      <input
                        type="number"
                        value={newsMinSpreadPct}
                        onChange={(e) => setNewsMinSpreadPct(parseFloat(e.target.value))}
                        step="0.5"
                        min="1"
                        max="20"
                        disabled={!isAdmin}
                        placeholder="3.0"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Trigger threshold</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <DollarSign className="w-3 h-3" />
                        Position Size ($)
                      </label>
                      <input
                        type="number"
                        value={newsPositionSizeUsd}
                        onChange={(e) => setNewsPositionSizeUsd(parseFloat(e.target.value))}
                        step="10"
                        min="5"
                        max="500"
                        disabled={!isAdmin}
                        placeholder="50"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Per trade</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Clock className="w-3 h-3" />
                        Scan Interval (sec)
                      </label>
                      <input
                        type="number"
                        value={newsScanIntervalSec}
                        onChange={(e) => setNewsScanIntervalSec(parseInt(e.target.value))}
                        step="5"
                        min="10"
                        max="300"
                        disabled={!isAdmin}
                        placeholder="30"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Price comparison</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                      Keywords to Watch (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={newsKeywords}
                      onChange={(e) => setNewsKeywords(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="election,fed,trump,bitcoin,crypto,verdict"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm disabled:opacity-50"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Markets containing these keywords will be monitored for price divergence</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Crypto Strategies: Funding Rate, Grid Trading, Pairs Trading */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowCryptoStrategies(!showCryptoStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle crypto strategies"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-neon-purple" />
            Crypto Strategies
            <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full font-normal">HIGH PRIORITY</span>
          </h2>
          {showCryptoStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Funding Rate Arb (15-50% APY), Grid Trading (20-60% APY), Pairs Trading (10-25% APY)</p>

        <AnimatePresence>
          {showCryptoStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Funding Rate Arbitrage - Full Card Layout */}
              <div className="mt-6 rounded-xl border-2 border-neon-green overflow-hidden">
                {/* Header with toggle */}
                <div className="bg-neon-green/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon-green flex items-center justify-center">
                      <Percent className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Funding Rate Arbitrage
                        <span className="text-xs bg-neon-green/30 text-neon-green px-2 py-0.5 rounded-full">85% CONFIDENCE</span>
                      </h3>
                      <p className="text-xs text-neon-green">Delta-neutral • Via CCXT (100+ exchanges)</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={enableFundingRateArb} 
                    onToggle={() => setEnableFundingRateArb(!enableFundingRateArb)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                
                {/* Strategy explanation */}
                <div className="px-4 py-3 bg-dark-bg/50 border-b border-neon-green/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                      <p className="text-gray-300">Buy spot (BTC), short perpetual futures (BTC-PERP). When funding is positive, shorts collect from longs every 8h. Zero directional risk.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Why It&apos;s Profitable</p>
                      <p className="text-gray-300">In bull markets, longs pay shorts <span className="text-neon-green font-semibold">0.01-0.1% every 8h</span> (30-100%+ APY annualized). CCXT connects to Binance, Bybit, OKX, etc.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                      <p className="text-gray-300">
                        <span className="text-neon-green font-semibold">15-50% APY</span> consistently.
                        Risk: exchange failure, liquidation if not properly hedged.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="p-4 bg-neon-green/5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Min Funding Rate (%)
                      </label>
                      <input
                        type="number"
                        value={fundingMinRatePct}
                        onChange={(e) => setFundingMinRatePct(parseFloat(e.target.value))}
                        step="0.01"
                        min="0.01"
                        max="0.5"
                        disabled={!isAdmin}
                        placeholder="0.03"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Per 8h period</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Target className="w-3 h-3" />
                        Min APY (%)
                      </label>
                      <input
                        type="number"
                        value={fundingMinApy}
                        onChange={(e) => setFundingMinApy(parseFloat(e.target.value))}
                        step="5"
                        min="10"
                        max="100"
                        disabled={!isAdmin}
                        placeholder="30"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Entry threshold</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <DollarSign className="w-3 h-3" />
                        Max Position ($)
                      </label>
                      <input
                        type="number"
                        value={fundingMaxPositionUsd}
                        onChange={(e) => setFundingMaxPositionUsd(parseFloat(e.target.value))}
                        step="100"
                        min="100"
                        max="10000"
                        disabled={!isAdmin}
                        placeholder="1000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Per pair</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Positions
                      </label>
                      <input
                        type="number"
                        value={fundingMaxPositions}
                        onChange={(e) => setFundingMaxPositions(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="10"
                        disabled={!isAdmin}
                        placeholder="3"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Concurrent</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Leverage
                      </label>
                      <input
                        type="number"
                        value={fundingMaxLeverage}
                        onChange={(e) => setFundingMaxLeverage(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="10"
                        disabled={!isAdmin}
                        placeholder="3"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Futures leg</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Clock className="w-3 h-3" />
                        Scan Interval (sec)
                      </label>
                      <input
                        type="number"
                        value={fundingScanIntervalSec}
                        onChange={(e) => setFundingScanIntervalSec(parseInt(e.target.value))}
                        step="60"
                        min="60"
                        max="900"
                        disabled={!isAdmin}
                        placeholder="300"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-green text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Rate check</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Trading - Full Card Layout */}
              <div className="mt-6 rounded-xl border-2 border-blue-500 overflow-hidden">
                {/* Header with toggle */}
                <div className="bg-blue-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Grid Trading
                        <span className="text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full">75% CONFIDENCE</span>
                      </h3>
                      <p className="text-xs text-blue-400">Profit from sideways markets • Via CCXT</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={enableGridTrading} 
                    onToggle={() => setEnableGridTrading(!enableGridTrading)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                
                {/* Strategy explanation */}
                <div className="px-4 py-3 bg-dark-bg/50 border-b border-blue-500/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                      <p className="text-gray-300">Places buy orders below current price and sell orders above. As price oscillates, bot continuously buys low and sells high.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Best Market Conditions</p>
                      <p className="text-gray-300">Works best in <span className="text-blue-400 font-semibold">ranging/sideways markets</span>. BTC often moves ±10% and returns. Grid captures every oscillation.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                      <p className="text-gray-300">
                        <span className="text-blue-400 font-semibold">20-60% APY</span> in ranging markets.
                        Risk: loses if price trends strongly in one direction (breakout).
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="p-4 bg-blue-500/5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Range (±%)
                      </label>
                      <input
                        type="number"
                        value={gridDefaultRangePct}
                        onChange={(e) => setGridDefaultRangePct(parseFloat(e.target.value))}
                        step="1"
                        min="3"
                        max="30"
                        disabled={!isAdmin}
                        placeholder="10"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Price range from current</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Grid Levels
                      </label>
                      <input
                        type="number"
                        value={gridDefaultLevels}
                        onChange={(e) => setGridDefaultLevels(parseInt(e.target.value))}
                        step="5"
                        min="5"
                        max="100"
                        disabled={!isAdmin}
                        placeholder="20"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Buy/sell orders</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <DollarSign className="w-3 h-3" />
                        Investment ($)
                      </label>
                      <input
                        type="number"
                        value={gridDefaultInvestmentUsd}
                        onChange={(e) => setGridDefaultInvestmentUsd(parseFloat(e.target.value))}
                        step="50"
                        min="100"
                        max="5000"
                        disabled={!isAdmin}
                        placeholder="500"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Per grid</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Grids
                      </label>
                      <input
                        type="number"
                        value={gridMaxGrids}
                        onChange={(e) => setGridMaxGrids(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="10"
                        disabled={!isAdmin}
                        placeholder="3"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Concurrent</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <TrendingDown className="w-3 h-3" />
                        Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        value={gridStopLossPct}
                        onChange={(e) => setGridStopLossPct(parseFloat(e.target.value))}
                        step="1"
                        min="5"
                        max="30"
                        disabled={!isAdmin}
                        placeholder="15"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Breakout exit</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Target className="w-3 h-3" />
                        Take Profit (%)
                      </label>
                      <input
                        type="number"
                        value={gridTakeProfitPct}
                        onChange={(e) => setGridTakeProfitPct(parseFloat(e.target.value))}
                        step="5"
                        min="10"
                        max="100"
                        disabled={!isAdmin}
                        placeholder="50"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Close grid</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pairs Trading - Full Card Layout */}
              <div className="mt-6 rounded-xl border-2 border-orange-500 overflow-hidden">
                {/* Header with toggle */}
                <div className="bg-orange-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Pairs Trading
                        <span className="text-xs bg-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">65% CONFIDENCE</span>
                      </h3>
                      <p className="text-xs text-orange-400">Statistical arbitrage on correlated pairs</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={enablePairsTrading} 
                    onToggle={() => setEnablePairsTrading(!enablePairsTrading)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                
                {/* Strategy explanation */}
                <div className="px-4 py-3 bg-dark-bg/50 border-b border-orange-500/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">How It Works</p>
                      <p className="text-gray-300">BTC and ETH are ~90% correlated. When their ratio deviates (z-score {">"}2), bet on mean reversion: long the underperformer, short the outperformer.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">The Statistical Edge</p>
                      <p className="text-gray-300">Uses <span className="text-orange-400 font-semibold">z-score analysis</span>: when the BTC/ETH ratio is 2+ standard deviations from mean, it almost always reverts within 1-3 days.</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Returns</p>
                      <p className="text-gray-300">
                        <span className="text-orange-400 font-semibold">10-25% APY</span> with low volatility.
                        Market-neutral strategy (hedged against overall market direction).
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div className="p-4 bg-orange-500/5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Entry Z-Score
                      </label>
                      <input
                        type="number"
                        value={pairsEntryZscore}
                        onChange={(e) => setPairsEntryZscore(parseFloat(e.target.value))}
                        step="0.1"
                        min="1"
                        max="4"
                        disabled={!isAdmin}
                        placeholder="2.0"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Enter when |z| {">"} this</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Exit Z-Score
                      </label>
                      <input
                        type="number"
                        value={pairsExitZscore}
                        onChange={(e) => setPairsExitZscore(parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="2"
                        disabled={!isAdmin}
                        placeholder="0.5"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Exit when |z| {"<"} this</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <DollarSign className="w-3 h-3" />
                        Position Size ($)
                      </label>
                      <input
                        type="number"
                        value={pairsPositionSizeUsd}
                        onChange={(e) => setPairsPositionSizeUsd(parseFloat(e.target.value))}
                        step="50"
                        min="100"
                        max="5000"
                        disabled={!isAdmin}
                        placeholder="500"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Per leg</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Positions
                      </label>
                      <input
                        type="number"
                        value={pairsMaxPositions}
                        onChange={(e) => setPairsMaxPositions(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="5"
                        disabled={!isAdmin}
                        placeholder="2"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Concurrent pairs</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Clock className="w-3 h-3" />
                        Max Hold (hours)
                      </label>
                      <input
                        type="number"
                        value={pairsMaxHoldHours}
                        onChange={(e) => setPairsMaxHoldHours(parseFloat(e.target.value))}
                        step="12"
                        min="12"
                        max="168"
                        disabled={!isAdmin}
                        placeholder="72"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Time-based exit</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Exchange Enablement */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.245 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowExchangeSettings(!showExchangeSettings)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle exchange settings"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Exchange Connections
          </h2>
          {showExchangeSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Enable/disable trading platforms for crypto, stocks, and prediction markets</p>

        <AnimatePresence>
          {showExchangeSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Prediction Markets */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium mb-4">Prediction Markets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <PolymarketLogo />
                      </div>
                      <div>
                        <p className="font-medium">Polymarket</p>
                        <p className="text-xs text-gray-500">0% fees, high liquidity</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={polymarketEnabled} 
                      onToggle={() => setPolymarketEnabled(!polymarketEnabled)} 
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <KalshiLogo />
                      </div>
                      <div>
                        <p className="font-medium">Kalshi</p>
                        <p className="text-xs text-gray-500">7% fees, US regulated</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={kalshiEnabled} 
                      onToggle={() => setKalshiEnabled(!kalshiEnabled)} 
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              {/* Crypto Exchanges */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium mb-4">Crypto Exchanges (via CCXT)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Binance</p>
                      <p className="text-xs text-gray-500">Futures + Spot</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableBinance} 
                      onToggle={() => setEnableBinance(!enableBinance)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Bybit</p>
                      <p className="text-xs text-gray-500">Unified V5 API</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableBybit} 
                      onToggle={() => setEnableBybit(!enableBybit)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">OKX</p>
                      <p className="text-xs text-gray-500">Perps + Options</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableOkx} 
                      onToggle={() => setEnableOkx(!enableOkx)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Kraken</p>
                      <p className="text-xs text-gray-500">US friendly</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableKraken} 
                      onToggle={() => setEnableKraken(!enableKraken)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Coinbase</p>
                      <p className="text-xs text-gray-500">Pro API</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableCoinbase} 
                      onToggle={() => setEnableCoinbase(!enableCoinbase)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">KuCoin</p>
                      <p className="text-xs text-gray-500">Futures</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableKucoin} 
                      onToggle={() => setEnableKucoin(!enableKucoin)} 
                      disabled={!isAdmin}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Brokers */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium mb-4">Stock Brokers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Alpaca</p>
                      <p className="text-xs text-gray-500">Commission-free, REST API</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableAlpaca} 
                      onToggle={() => setEnableAlpaca(!enableAlpaca)} 
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <p className="font-medium">Interactive Brokers</p>
                      <p className="text-xs text-gray-500">TWS API - Options/Futures</p>
                    </div>
                    <ToggleSwitch 
                      enabled={enableIbkr} 
                      onToggle={() => setEnableIbkr(!enableIbkr)} 
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Simulation Realism Settings */}
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
          title="Toggle simulation realism settings"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-purple" />
            Simulation Realism
            <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-normal">Paper Trading Only</span>
          </h2>
          {showAdvancedParams ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">These settings simulate real-world trading friction: slippage, partial fills, and execution failures. Higher values = more conservative simulation.</p>

        <AnimatePresence>
          {showAdvancedParams && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Execution Simulation */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Execution Simulation
                </h3>
                <p className="text-xs text-gray-500 mb-4">Simulates real-world order execution challenges. In live trading, orders don&apos;t always execute perfectly.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <LabelWithTooltip 
                      label="Slippage Min %" 
                      tooltip={METRIC_TOOLTIPS.slippageMinPct} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <p className="text-xs text-gray-500 mt-1">Price moves against you</p>
                  </div>
                  <div>
                    <LabelWithTooltip 
                      label="Slippage Max %" 
                      tooltip={METRIC_TOOLTIPS.slippageMaxPct} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <p className="text-xs text-gray-500 mt-1">Worst-case slippage</p>
                  </div>
                  <div>
                    <LabelWithTooltip 
                      label="Spread Cost %" 
                      tooltip={METRIC_TOOLTIPS.spreadCostPct} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Execution Failure Rate" 
                      tooltip={METRIC_TOOLTIPS.executionFailureRate} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Partial Fill Chance" 
                      tooltip={METRIC_TOOLTIPS.partialFillChance} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Partial Fill Min %" 
                      tooltip={METRIC_TOOLTIPS.partialFillMinPct} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Resolution Loss Rate" 
                      tooltip={METRIC_TOOLTIPS.resolutionLossRate} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Loss Severity Min" 
                      tooltip={METRIC_TOOLTIPS.lossSeverityMin} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Loss Severity Max" 
                      tooltip={METRIC_TOOLTIPS.lossSeverityMax} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Max Position % of Balance" 
                      tooltip={METRIC_TOOLTIPS.maxPositionPct} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Max Position USD" 
                      tooltip={METRIC_TOOLTIPS.maxPositionUsd} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <LabelWithTooltip 
                      label="Min Position USD" 
                      tooltip={METRIC_TOOLTIPS.minPositionUsd} 
                      className="text-sm font-medium text-gray-400 mb-2"
                    />
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
                    <button
                      onClick={() => refetchUsers()}
                      className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                      disabled={usersLoading}
                    >
                      <RefreshCw className={cn("w-3 h-3", usersLoading && "animate-spin")} />
                      Refresh
                    </button>
                  </div>
                  
                  {/* Loading State */}
                  {usersLoading && (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                      <span className="ml-2 text-gray-400">Loading users...</span>
                    </div>
                  )}
                  
                  {/* Error State */}
                  {usersError && !usersLoading && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                      <p className="text-red-400 text-sm">
                        Failed to load users: {(usersError as Error).message}
                      </p>
                      <button
                        onClick={() => refetchUsers()}
                        className="mt-2 text-xs text-red-400 hover:text-red-300"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  
                  {/* Empty State */}
                  {!usersLoading && !usersError && users.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No users found</p>
                      <p className="text-xs text-gray-500 mt-1">Users will appear here once they sign up</p>
                    </div>
                  )}
                  
                  {/* Users List */}
                  {!usersLoading && !usersError && users.length > 0 && (
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
                            u.role === 'viewer' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-neon-green/20 text-neon-green'
                          )}>
                            {u.display_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{u.display_name || u.email}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                            {u.last_sign_in_at && (
                              <p className="text-xs text-gray-600">
                                Last login: {new Date(u.last_sign_in_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              try {
                                const res = await fetch('/api/users', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: u.id, updates: { role: newRole } }),
                                });
                                if (!res.ok) throw new Error('Failed to update');
                                refetchUsers();
                              } catch (err) {
                                console.error('Failed to update user role:', err);
                              }
                            }}
                            disabled={u.id === user?.id}
                            title="Change user role"
                            className="bg-dark-border border border-dark-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-purple disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Read Only</option>
                          </select>
                          {u.id !== user?.id && (
                            <button
                              onClick={async () => {
                                if (confirm(`Delete user ${u.display_name || u.email}?`)) {
                                  try {
                                    const res = await fetch(`/api/users?userId=${u.id}`, {
                                      method: 'DELETE',
                                    });
                                    if (!res.ok) throw new Error('Failed to delete');
                                    refetchUsers();
                                  } catch (err) {
                                    console.error('Failed to delete user:', err);
                                  }
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
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Save Button */}
      <div className="flex flex-col gap-4">
        {/* Error and Success Messages */}
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-500">Failed to Save</p>
              <p className="text-sm text-red-500/70">{saveError}</p>
            </div>
            <button 
              onClick={() => setSaveError(null)}
              className="ml-auto text-red-500 hover:text-red-400"
            >
              ×
            </button>
          </motion.div>
        )}
        
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-neon-green/10 border border-neon-green/30 rounded-xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-neon-green" />
            <p className="font-semibold text-neon-green">Settings saved successfully!</p>
          </motion.div>
        )}
        
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
                  Delete all paper trades, opportunities, and reset balance to $5,000. This cannot be undone.
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
                ? 'This will delete ALL paper trades, opportunities, and reset your simulated balance to $5,000. This action cannot be undone!'
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
