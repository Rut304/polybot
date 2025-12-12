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
  TrendingUp,
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
  // STOCK STRATEGIES (New - via Alpaca)
  // =========================================================================
  
  // Stock Mean Reversion (70% confidence - 15-30% APY)
  const [enableStockMeanReversion, setEnableStockMeanReversion] = useState(config?.enable_stock_mean_reversion ?? false);
  const [meanRevRsiOversold, setMeanRevRsiOversold] = useState(config?.mean_rev_rsi_oversold ?? 30);
  const [meanRevRsiOverbought, setMeanRevRsiOverbought] = useState(config?.mean_rev_rsi_overbought ?? 70);
  const [meanRevPositionSizeUsd, setMeanRevPositionSizeUsd] = useState(config?.mean_rev_position_size_usd ?? 1000);
  const [meanRevMaxPositions, setMeanRevMaxPositions] = useState(config?.mean_rev_max_positions ?? 5);
  const [meanRevStopLossPct, setMeanRevStopLossPct] = useState(config?.mean_rev_stop_loss_pct ?? 5);
  const [meanRevTakeProfitPct, setMeanRevTakeProfitPct] = useState(config?.mean_rev_take_profit_pct ?? 10);
  
  // Stock Momentum (75% confidence - 20-40% APY)
  const [enableStockMomentum, setEnableStockMomentum] = useState(config?.enable_stock_momentum ?? false);
  const [momentumLookbackDays, setMomentumLookbackDays] = useState(config?.momentum_lookback_days ?? 20);
  const [momentumMinScore, setMomentumMinScore] = useState(config?.momentum_min_score ?? 70);
  const [momentumPositionSizeUsd, setMomentumPositionSizeUsd] = useState(config?.momentum_position_size_usd ?? 1000);
  const [momentumMaxPositions, setMomentumMaxPositions] = useState(config?.momentum_max_positions ?? 10);
  const [momentumTrailingStopPct, setMomentumTrailingStopPct] = useState(config?.momentum_trailing_stop_pct ?? 8);
  
  // Sector Rotation (70% confidence - 15-25% APY)
  const [enableSectorRotation, setEnableSectorRotation] = useState(config?.enable_sector_rotation ?? false);
  const [sectorRotationPeriodDays, setSectorRotationPeriodDays] = useState(config?.sector_rotation_period_days ?? 30);
  const [sectorTopN, setSectorTopN] = useState(config?.sector_top_n ?? 3);
  const [sectorPositionSizeUsd, setSectorPositionSizeUsd] = useState(config?.sector_position_size_usd ?? 2000);
  const [sectorRebalanceFrequencyDays, setSectorRebalanceFrequencyDays] = useState(config?.sector_rebalance_frequency_days ?? 7);
  
  // Dividend Growth (65% confidence - 8-12% APY + dividends)
  const [enableDividendGrowth, setEnableDividendGrowth] = useState(config?.enable_dividend_growth ?? false);
  const [dividendMinYieldPct, setDividendMinYieldPct] = useState(config?.dividend_min_yield_pct ?? 2.0);
  const [dividendMinGrowthYears, setDividendMinGrowthYears] = useState(config?.dividend_min_growth_years ?? 10);
  const [dividendPositionSizeUsd, setDividendPositionSizeUsd] = useState(config?.dividend_position_size_usd ?? 2000);
  const [dividendMaxPositions, setDividendMaxPositions] = useState(config?.dividend_max_positions ?? 15);
  
  // Earnings Momentum (60% confidence - 15-30% APY, higher risk)
  const [enableEarningsMomentum, setEnableEarningsMomentum] = useState(config?.enable_earnings_momentum ?? false);
  const [earningsMinSurprisePct, setEarningsMinSurprisePct] = useState(config?.earnings_min_surprise_pct ?? 5);
  const [earningsHoldDays, setEarningsHoldDays] = useState(config?.earnings_hold_days ?? 5);
  const [earningsPositionSizeUsd, setEarningsPositionSizeUsd] = useState(config?.earnings_position_size_usd ?? 500);
  const [earningsMaxPositions, setEarningsMaxPositions] = useState(config?.earnings_max_positions ?? 3);
  
  // =========================================================================
  // OPTIONS STRATEGIES (Requires IBKR or options-enabled broker)
  // =========================================================================
  
  // Covered Calls (80% confidence - 10-20% APY)
  const [enableCoveredCalls, setEnableCoveredCalls] = useState(config?.enable_covered_calls ?? false);
  const [coveredCallDaysToExpiry, setCoveredCallDaysToExpiry] = useState(config?.covered_call_days_to_expiry ?? 30);
  const [coveredCallDeltaTarget, setCoveredCallDeltaTarget] = useState(config?.covered_call_delta_target ?? 0.30);
  const [coveredCallMinPremiumPct, setCoveredCallMinPremiumPct] = useState(config?.covered_call_min_premium_pct ?? 1.0);
  
  // Cash-Secured Puts (75% confidence - 15-30% APY)
  const [enableCashSecuredPuts, setEnableCashSecuredPuts] = useState(config?.enable_cash_secured_puts ?? false);
  const [cspDaysToExpiry, setCspDaysToExpiry] = useState(config?.csp_days_to_expiry ?? 30);
  const [cspDeltaTarget, setCspDeltaTarget] = useState(config?.csp_delta_target ?? -0.30);
  const [cspMinPremiumPct, setCspMinPremiumPct] = useState(config?.csp_min_premium_pct ?? 1.5);
  
  // Iron Condor (70% confidence - 20-40% APY)
  const [enableIronCondor, setEnableIronCondor] = useState(config?.enable_iron_condor ?? false);
  const [ironCondorDaysToExpiry, setIronCondorDaysToExpiry] = useState(config?.iron_condor_days_to_expiry ?? 45);
  const [ironCondorWingWidth, setIronCondorWingWidth] = useState(config?.iron_condor_wing_width ?? 5);
  const [ironCondorMinPremiumPct, setIronCondorMinPremiumPct] = useState(config?.iron_condor_min_premium_pct ?? 2.0);
  
  // Wheel Strategy (75% confidence - 20-35% APY)
  const [enableWheelStrategy, setEnableWheelStrategy] = useState(config?.enable_wheel_strategy ?? false);
  const [wheelStockList, setWheelStockList] = useState(config?.wheel_stock_list ?? 'AAPL,MSFT,GOOGL,AMZN,NVDA');
  const [wheelPositionSizeUsd, setWheelPositionSizeUsd] = useState(config?.wheel_position_size_usd ?? 5000);
  
  // UI state for new strategy sections
  const [showStockStrategies, setShowStockStrategies] = useState(false);
  const [showOptionsStrategies, setShowOptionsStrategies] = useState(false);
  
  // =========================================================================
  // TWITTER-DERIVED STRATEGIES (2024) - Based on profitable trader analysis
  // High-conviction strategies from analyzing top prediction market traders
  // =========================================================================
  
  // UI state for Twitter strategies section
  const [showTwitterStrategies, setShowTwitterStrategies] = useState(false);
  
  // BTC Bracket Arbitrage (85% confidence - $20K-200K/month potential)
  // Buy YES + NO on same bracket when combined < $1.00
  const [enableBtcBracketArb, setEnableBtcBracketArb] = useState(config?.enable_btc_bracket_arb ?? false);
  const [btcBracketMinDiscountPct, setBtcBracketMinDiscountPct] = useState(config?.btc_bracket_min_discount_pct ?? 0.5);
  const [btcBracketMaxPositionUsd, setBtcBracketMaxPositionUsd] = useState(config?.btc_bracket_max_position_usd ?? 50);
  const [btcBracketScanIntervalSec, setBtcBracketScanIntervalSec] = useState(config?.btc_bracket_scan_interval_sec ?? 15);
  
  // Bracket Compression (70% confidence - 15-30% APY)
  // Mean reversion on stretched bracket prices
  const [enableBracketCompression, setEnableBracketCompression] = useState(config?.enable_bracket_compression ?? false);
  const [bracketMaxImbalanceThreshold, setBracketMaxImbalanceThreshold] = useState(config?.bracket_max_imbalance_threshold ?? 0.30);
  const [bracketTakeProfitPct, setBracketTakeProfitPct] = useState(config?.bracket_take_profit_pct ?? 3.0);
  const [bracketStopLossPct, setBracketStopLossPct] = useState(config?.bracket_stop_loss_pct ?? 10.0);
  const [bracketMaxPositionUsd, setBracketMaxPositionUsd] = useState(config?.bracket_max_position_usd ?? 100);
  
  // Kalshi Mention Market Sniping (80% confidence - $120+/event)
  // Fast execution on resolved mention markets
  const [enableKalshiMentionSnipe, setEnableKalshiMentionSnipe] = useState(config?.enable_kalshi_mention_snipe ?? false);
  const [kalshiSnipeMinProfitCents, setKalshiSnipeMinProfitCents] = useState(config?.kalshi_snipe_min_profit_cents ?? 2);
  const [kalshiSnipeMaxPositionUsd, setKalshiSnipeMaxPositionUsd] = useState(config?.kalshi_snipe_max_position_usd ?? 100);
  const [kalshiSnipeMaxLatencyMs, setKalshiSnipeMaxLatencyMs] = useState(config?.kalshi_snipe_max_latency_ms ?? 1000);
  
  // Whale Copy Trading (75% confidence - 25-50% APY)
  // Track and copy high win-rate wallets
  const [enableWhaleCopyTrading, setEnableWhaleCopyTrading] = useState(config?.enable_whale_copy_trading ?? false);
  const [whaleCopyMinWinRate, setWhaleCopyMinWinRate] = useState(config?.whale_copy_min_win_rate ?? 80);
  const [whaleCopyDelaySeconds, setWhaleCopyDelaySeconds] = useState(config?.whale_copy_delay_seconds ?? 30);
  const [whaleCopyMaxSizeUsd, setWhaleCopyMaxSizeUsd] = useState(config?.whale_copy_max_size_usd ?? 50);
  const [whaleCopyMaxConcurrent, setWhaleCopyMaxConcurrent] = useState(config?.whale_copy_max_concurrent ?? 5);
  
  // Macro Board Strategy (65% confidence - $62K/month potential)
  // Heavy weighted exposure to macro events
  const [enableMacroBoard, setEnableMacroBoard] = useState(config?.enable_macro_board ?? false);
  const [macroMaxExposureUsd, setMacroMaxExposureUsd] = useState(config?.macro_max_exposure_usd ?? 5000);
  const [macroMinConvictionScore, setMacroMinConvictionScore] = useState(config?.macro_min_conviction_score ?? 70);
  const [macroRebalanceIntervalHours, setMacroRebalanceIntervalHours] = useState(config?.macro_rebalance_interval_hours ?? 24);
  
  // Fear Premium Contrarian (70% confidence - 25-60% APY)
  // Trade against extreme sentiment - 91.4% win rate approach
  const [enableFearPremiumContrarian, setEnableFearPremiumContrarian] = useState(config?.enable_fear_premium_contrarian ?? false);
  const [fearExtremeLowThreshold, setFearExtremeLowThreshold] = useState(config?.fear_extreme_low_threshold ?? 0.15);
  const [fearExtremeHighThreshold, setFearExtremeHighThreshold] = useState(config?.fear_extreme_high_threshold ?? 0.85);
  const [fearMinPremiumPct, setFearMinPremiumPct] = useState(config?.fear_min_premium_pct ?? 10);
  const [fearMaxPositionUsd, setFearMaxPositionUsd] = useState(config?.fear_max_position_usd ?? 200);
  
  // =========================================================================
  // ADVANCED RISK FRAMEWORK (Kelly, Regime, Circuit Breaker, etc.)
  // These modules enhance ALL strategies with better risk management
  // =========================================================================
  
  // Kelly Criterion Position Sizing
  const [kellySizingEnabled, setKellySizingEnabled] = useState(config?.kelly_sizing_enabled ?? false);
  const [kellyFractionCap, setKellyFractionCap] = useState(config?.kelly_fraction_cap ?? 0.25);
  const [kellyMinConfidence, setKellyMinConfidence] = useState(config?.kelly_min_confidence ?? 0.60);
  const [kellyMaxPositionPct, setKellyMaxPositionPct] = useState(config?.kelly_max_position_pct ?? 10.0);
  
  // Market Regime Detection
  const [regimeDetectionEnabled, setRegimeDetectionEnabled] = useState(config?.regime_detection_enabled ?? true);
  const [regimeVixLowThreshold, setRegimeVixLowThreshold] = useState(config?.regime_vix_low_threshold ?? 15.0);
  const [regimeVixHighThreshold, setRegimeVixHighThreshold] = useState(config?.regime_vix_high_threshold ?? 25.0);
  const [regimeVixCrisisThreshold, setRegimeVixCrisisThreshold] = useState(config?.regime_vix_crisis_threshold ?? 35.0);
  const [regimeAutoAdjust, setRegimeAutoAdjust] = useState(config?.regime_auto_adjust ?? true);
  
  // Circuit Breaker System
  const [circuitBreakerEnabled, setCircuitBreakerEnabled] = useState(config?.circuit_breaker_enabled ?? true);
  const [circuitBreakerLevel1Pct, setCircuitBreakerLevel1Pct] = useState(config?.circuit_breaker_level1_pct ?? 3.0);
  const [circuitBreakerLevel2Pct, setCircuitBreakerLevel2Pct] = useState(config?.circuit_breaker_level2_pct ?? 5.0);
  const [circuitBreakerLevel3Pct, setCircuitBreakerLevel3Pct] = useState(config?.circuit_breaker_level3_pct ?? 10.0);
  const [circuitBreakerResetHours, setCircuitBreakerResetHours] = useState(config?.circuit_breaker_reset_hours ?? 24);
  
  // Time Decay Analysis
  const [timeDecayEnabled, setTimeDecayEnabled] = useState(config?.time_decay_enabled ?? true);
  const [timeDecayCriticalDays, setTimeDecayCriticalDays] = useState(config?.time_decay_critical_days ?? 7);
  const [timeDecayAvoidEntryHours, setTimeDecayAvoidEntryHours] = useState(config?.time_decay_avoid_entry_hours ?? 48);
  
  // Order Flow Analysis
  const [orderFlowEnabled, setOrderFlowEnabled] = useState(config?.order_flow_enabled ?? false);
  const [orderFlowSignalThreshold, setOrderFlowSignalThreshold] = useState(config?.order_flow_signal_threshold ?? 0.30);
  const [orderFlowStrongThreshold, setOrderFlowStrongThreshold] = useState(config?.order_flow_strong_threshold ?? 0.60);
  
  // Stablecoin Depeg Detection
  const [depegDetectionEnabled, setDepegDetectionEnabled] = useState(config?.depeg_detection_enabled ?? true);
  const [depegAlertThresholdPct, setDepegAlertThresholdPct] = useState(config?.depeg_alert_threshold_pct ?? 0.30);
  const [depegArbitrageThresholdPct, setDepegArbitrageThresholdPct] = useState(config?.depeg_arbitrage_threshold_pct ?? 0.50);
  const [depegCriticalThresholdPct, setDepegCriticalThresholdPct] = useState(config?.depeg_critical_threshold_pct ?? 5.0);
  
  // Correlation Position Limits
  const [correlationLimitsEnabled, setCorrelationLimitsEnabled] = useState(config?.correlation_limits_enabled ?? true);
  const [correlationMaxClusterPct, setCorrelationMaxClusterPct] = useState(config?.correlation_max_cluster_pct ?? 30.0);
  const [correlationMaxCorrelatedPct, setCorrelationMaxCorrelatedPct] = useState(config?.correlation_max_correlated_pct ?? 50.0);
  const [correlationHighThreshold, setCorrelationHighThreshold] = useState(config?.correlation_high_threshold ?? 0.70);
  
  // UI state for Advanced Risk Framework section
  const [showAdvancedRiskFramework, setShowAdvancedRiskFramework] = useState(false);
  
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
  
  // =========================================================================
  // STARTING BALANCES (for P&L tracking - not secrets)
  // Each platform starts with this amount for easy P&L comparison
  // =========================================================================
  const [polymarketStartingBalance, setPolymarketStartingBalance] = useState(config?.polymarket_starting_balance ?? 20000);
  const [kalshiStartingBalance, setKalshiStartingBalance] = useState(config?.kalshi_starting_balance ?? 20000);
  const [binanceStartingBalance, setBinanceStartingBalance] = useState(config?.binance_starting_balance ?? 20000);
  const [coinbaseStartingBalance, setCoinbaseStartingBalance] = useState(config?.coinbase_starting_balance ?? 20000);
  const [alpacaStartingBalance, setAlpacaStartingBalance] = useState(config?.alpaca_starting_balance ?? 20000);
  const [showStartingBalances, setShowStartingBalances] = useState(false);
  
  // UI state for strategy settings section
  const [showStrategySettings, setShowStrategySettings] = useState(false);
  const [showCoreArbStrategies, setShowCoreArbStrategies] = useState(true);
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
      
      // Stock Strategies (NEW)
      if (config.enable_stock_mean_reversion !== undefined) setEnableStockMeanReversion(config.enable_stock_mean_reversion);
      if (config.mean_rev_rsi_oversold !== undefined) setMeanRevRsiOversold(config.mean_rev_rsi_oversold);
      if (config.mean_rev_rsi_overbought !== undefined) setMeanRevRsiOverbought(config.mean_rev_rsi_overbought);
      if (config.mean_rev_position_size_usd !== undefined) setMeanRevPositionSizeUsd(config.mean_rev_position_size_usd);
      if (config.mean_rev_max_positions !== undefined) setMeanRevMaxPositions(config.mean_rev_max_positions);
      if (config.mean_rev_stop_loss_pct !== undefined) setMeanRevStopLossPct(config.mean_rev_stop_loss_pct);
      if (config.mean_rev_take_profit_pct !== undefined) setMeanRevTakeProfitPct(config.mean_rev_take_profit_pct);
      
      if (config.enable_stock_momentum !== undefined) setEnableStockMomentum(config.enable_stock_momentum);
      if (config.momentum_lookback_days !== undefined) setMomentumLookbackDays(config.momentum_lookback_days);
      if (config.momentum_min_score !== undefined) setMomentumMinScore(config.momentum_min_score);
      if (config.momentum_position_size_usd !== undefined) setMomentumPositionSizeUsd(config.momentum_position_size_usd);
      if (config.momentum_max_positions !== undefined) setMomentumMaxPositions(config.momentum_max_positions);
      if (config.momentum_trailing_stop_pct !== undefined) setMomentumTrailingStopPct(config.momentum_trailing_stop_pct);
      
      if (config.enable_sector_rotation !== undefined) setEnableSectorRotation(config.enable_sector_rotation);
      if (config.sector_rotation_period_days !== undefined) setSectorRotationPeriodDays(config.sector_rotation_period_days);
      if (config.sector_top_n !== undefined) setSectorTopN(config.sector_top_n);
      if (config.sector_position_size_usd !== undefined) setSectorPositionSizeUsd(config.sector_position_size_usd);
      if (config.sector_rebalance_frequency_days !== undefined) setSectorRebalanceFrequencyDays(config.sector_rebalance_frequency_days);
      
      if (config.enable_dividend_growth !== undefined) setEnableDividendGrowth(config.enable_dividend_growth);
      if (config.dividend_min_yield_pct !== undefined) setDividendMinYieldPct(config.dividend_min_yield_pct);
      if (config.dividend_min_growth_years !== undefined) setDividendMinGrowthYears(config.dividend_min_growth_years);
      if (config.dividend_position_size_usd !== undefined) setDividendPositionSizeUsd(config.dividend_position_size_usd);
      if (config.dividend_max_positions !== undefined) setDividendMaxPositions(config.dividend_max_positions);
      
      if (config.enable_earnings_momentum !== undefined) setEnableEarningsMomentum(config.enable_earnings_momentum);
      if (config.earnings_min_surprise_pct !== undefined) setEarningsMinSurprisePct(config.earnings_min_surprise_pct);
      if (config.earnings_hold_days !== undefined) setEarningsHoldDays(config.earnings_hold_days);
      if (config.earnings_position_size_usd !== undefined) setEarningsPositionSizeUsd(config.earnings_position_size_usd);
      if (config.earnings_max_positions !== undefined) setEarningsMaxPositions(config.earnings_max_positions);
      
      // Options Strategies (NEW)
      if (config.enable_covered_calls !== undefined) setEnableCoveredCalls(config.enable_covered_calls);
      if (config.covered_call_days_to_expiry !== undefined) setCoveredCallDaysToExpiry(config.covered_call_days_to_expiry);
      if (config.covered_call_delta_target !== undefined) setCoveredCallDeltaTarget(config.covered_call_delta_target);
      if (config.covered_call_min_premium_pct !== undefined) setCoveredCallMinPremiumPct(config.covered_call_min_premium_pct);
      
      if (config.enable_cash_secured_puts !== undefined) setEnableCashSecuredPuts(config.enable_cash_secured_puts);
      if (config.csp_days_to_expiry !== undefined) setCspDaysToExpiry(config.csp_days_to_expiry);
      if (config.csp_delta_target !== undefined) setCspDeltaTarget(config.csp_delta_target);
      if (config.csp_min_premium_pct !== undefined) setCspMinPremiumPct(config.csp_min_premium_pct);
      
      if (config.enable_iron_condor !== undefined) setEnableIronCondor(config.enable_iron_condor);
      if (config.iron_condor_days_to_expiry !== undefined) setIronCondorDaysToExpiry(config.iron_condor_days_to_expiry);
      if (config.iron_condor_wing_width !== undefined) setIronCondorWingWidth(config.iron_condor_wing_width);
      if (config.iron_condor_min_premium_pct !== undefined) setIronCondorMinPremiumPct(config.iron_condor_min_premium_pct);
      
      if (config.enable_wheel_strategy !== undefined) setEnableWheelStrategy(config.enable_wheel_strategy);
      if (config.wheel_stock_list !== undefined) setWheelStockList(config.wheel_stock_list);
      if (config.wheel_position_size_usd !== undefined) setWheelPositionSizeUsd(config.wheel_position_size_usd);
      
      // Twitter-Derived Strategies (2024)
      if (config.enable_btc_bracket_arb !== undefined) setEnableBtcBracketArb(config.enable_btc_bracket_arb);
      if (config.btc_bracket_min_discount_pct !== undefined) setBtcBracketMinDiscountPct(config.btc_bracket_min_discount_pct);
      if (config.btc_bracket_max_position_usd !== undefined) setBtcBracketMaxPositionUsd(config.btc_bracket_max_position_usd);
      if (config.btc_bracket_scan_interval_sec !== undefined) setBtcBracketScanIntervalSec(config.btc_bracket_scan_interval_sec);
      
      if (config.enable_bracket_compression !== undefined) setEnableBracketCompression(config.enable_bracket_compression);
      if (config.bracket_max_imbalance_threshold !== undefined) setBracketMaxImbalanceThreshold(config.bracket_max_imbalance_threshold);
      if (config.bracket_take_profit_pct !== undefined) setBracketTakeProfitPct(config.bracket_take_profit_pct);
      if (config.bracket_stop_loss_pct !== undefined) setBracketStopLossPct(config.bracket_stop_loss_pct);
      if (config.bracket_max_position_usd !== undefined) setBracketMaxPositionUsd(config.bracket_max_position_usd);
      
      if (config.enable_kalshi_mention_snipe !== undefined) setEnableKalshiMentionSnipe(config.enable_kalshi_mention_snipe);
      if (config.kalshi_snipe_min_profit_cents !== undefined) setKalshiSnipeMinProfitCents(config.kalshi_snipe_min_profit_cents);
      if (config.kalshi_snipe_max_position_usd !== undefined) setKalshiSnipeMaxPositionUsd(config.kalshi_snipe_max_position_usd);
      if (config.kalshi_snipe_max_latency_ms !== undefined) setKalshiSnipeMaxLatencyMs(config.kalshi_snipe_max_latency_ms);
      
      if (config.enable_whale_copy_trading !== undefined) setEnableWhaleCopyTrading(config.enable_whale_copy_trading);
      if (config.whale_copy_min_win_rate !== undefined) setWhaleCopyMinWinRate(config.whale_copy_min_win_rate);
      if (config.whale_copy_delay_seconds !== undefined) setWhaleCopyDelaySeconds(config.whale_copy_delay_seconds);
      if (config.whale_copy_max_size_usd !== undefined) setWhaleCopyMaxSizeUsd(config.whale_copy_max_size_usd);
      if (config.whale_copy_max_concurrent !== undefined) setWhaleCopyMaxConcurrent(config.whale_copy_max_concurrent);
      
      if (config.enable_macro_board !== undefined) setEnableMacroBoard(config.enable_macro_board);
      if (config.macro_max_exposure_usd !== undefined) setMacroMaxExposureUsd(config.macro_max_exposure_usd);
      if (config.macro_min_conviction_score !== undefined) setMacroMinConvictionScore(config.macro_min_conviction_score);
      if (config.macro_rebalance_interval_hours !== undefined) setMacroRebalanceIntervalHours(config.macro_rebalance_interval_hours);
      
      if (config.enable_fear_premium_contrarian !== undefined) setEnableFearPremiumContrarian(config.enable_fear_premium_contrarian);
      if (config.fear_extreme_low_threshold !== undefined) setFearExtremeLowThreshold(config.fear_extreme_low_threshold);
      if (config.fear_extreme_high_threshold !== undefined) setFearExtremeHighThreshold(config.fear_extreme_high_threshold);
      if (config.fear_min_premium_pct !== undefined) setFearMinPremiumPct(config.fear_min_premium_pct);
      if (config.fear_max_position_usd !== undefined) setFearMaxPositionUsd(config.fear_max_position_usd);
      
      // Exchange Enablement (NEW)
      if (config.enable_binance !== undefined) setEnableBinance(config.enable_binance);
      if (config.enable_bybit !== undefined) setEnableBybit(config.enable_bybit);
      if (config.enable_okx !== undefined) setEnableOkx(config.enable_okx);
      if (config.enable_kraken !== undefined) setEnableKraken(config.enable_kraken);
      if (config.enable_coinbase !== undefined) setEnableCoinbase(config.enable_coinbase);
      if (config.enable_kucoin !== undefined) setEnableKucoin(config.enable_kucoin);
      if (config.enable_alpaca !== undefined) setEnableAlpaca(config.enable_alpaca);
      if (config.enable_ibkr !== undefined) setEnableIbkr(config.enable_ibkr);
      
      // Starting Balances (for P&L tracking)
      if (config.polymarket_starting_balance !== undefined) setPolymarketStartingBalance(config.polymarket_starting_balance);
      if (config.kalshi_starting_balance !== undefined) setKalshiStartingBalance(config.kalshi_starting_balance);
      if (config.binance_starting_balance !== undefined) setBinanceStartingBalance(config.binance_starting_balance);
      if (config.coinbase_starting_balance !== undefined) setCoinbaseStartingBalance(config.coinbase_starting_balance);
      if (config.alpaca_starting_balance !== undefined) setAlpacaStartingBalance(config.alpaca_starting_balance);
      
      // Advanced Risk Framework
      if (config.kelly_sizing_enabled !== undefined) setKellySizingEnabled(config.kelly_sizing_enabled);
      if (config.kelly_fraction_cap !== undefined) setKellyFractionCap(config.kelly_fraction_cap);
      if (config.kelly_min_confidence !== undefined) setKellyMinConfidence(config.kelly_min_confidence);
      if (config.kelly_max_position_pct !== undefined) setKellyMaxPositionPct(config.kelly_max_position_pct);
      if (config.regime_detection_enabled !== undefined) setRegimeDetectionEnabled(config.regime_detection_enabled);
      if (config.regime_vix_low_threshold !== undefined) setRegimeVixLowThreshold(config.regime_vix_low_threshold);
      if (config.regime_vix_high_threshold !== undefined) setRegimeVixHighThreshold(config.regime_vix_high_threshold);
      if (config.regime_vix_crisis_threshold !== undefined) setRegimeVixCrisisThreshold(config.regime_vix_crisis_threshold);
      if (config.regime_auto_adjust !== undefined) setRegimeAutoAdjust(config.regime_auto_adjust);
      if (config.circuit_breaker_enabled !== undefined) setCircuitBreakerEnabled(config.circuit_breaker_enabled);
      if (config.circuit_breaker_level1_pct !== undefined) setCircuitBreakerLevel1Pct(config.circuit_breaker_level1_pct);
      if (config.circuit_breaker_level2_pct !== undefined) setCircuitBreakerLevel2Pct(config.circuit_breaker_level2_pct);
      if (config.circuit_breaker_level3_pct !== undefined) setCircuitBreakerLevel3Pct(config.circuit_breaker_level3_pct);
      if (config.circuit_breaker_reset_hours !== undefined) setCircuitBreakerResetHours(config.circuit_breaker_reset_hours);
      if (config.time_decay_enabled !== undefined) setTimeDecayEnabled(config.time_decay_enabled);
      if (config.time_decay_critical_days !== undefined) setTimeDecayCriticalDays(config.time_decay_critical_days);
      if (config.time_decay_avoid_entry_hours !== undefined) setTimeDecayAvoidEntryHours(config.time_decay_avoid_entry_hours);
      if (config.order_flow_enabled !== undefined) setOrderFlowEnabled(config.order_flow_enabled);
      if (config.order_flow_signal_threshold !== undefined) setOrderFlowSignalThreshold(config.order_flow_signal_threshold);
      if (config.order_flow_strong_threshold !== undefined) setOrderFlowStrongThreshold(config.order_flow_strong_threshold);
      if (config.depeg_detection_enabled !== undefined) setDepegDetectionEnabled(config.depeg_detection_enabled);
      if (config.depeg_alert_threshold_pct !== undefined) setDepegAlertThresholdPct(config.depeg_alert_threshold_pct);
      if (config.depeg_arbitrage_threshold_pct !== undefined) setDepegArbitrageThresholdPct(config.depeg_arbitrage_threshold_pct);
      if (config.depeg_critical_threshold_pct !== undefined) setDepegCriticalThresholdPct(config.depeg_critical_threshold_pct);
      if (config.correlation_limits_enabled !== undefined) setCorrelationLimitsEnabled(config.correlation_limits_enabled);
      if (config.correlation_max_cluster_pct !== undefined) setCorrelationMaxClusterPct(config.correlation_max_cluster_pct);
      if (config.correlation_max_correlated_pct !== undefined) setCorrelationMaxCorrelatedPct(config.correlation_max_correlated_pct);
      if (config.correlation_high_threshold !== undefined) setCorrelationHighThreshold(config.correlation_high_threshold);
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
        // Stock Strategies
        enable_stock_mean_reversion: enableStockMeanReversion,
        mean_rev_rsi_oversold: meanRevRsiOversold,
        mean_rev_rsi_overbought: meanRevRsiOverbought,
        mean_rev_position_size_usd: meanRevPositionSizeUsd,
        mean_rev_max_positions: meanRevMaxPositions,
        mean_rev_stop_loss_pct: meanRevStopLossPct,
        mean_rev_take_profit_pct: meanRevTakeProfitPct,
        enable_stock_momentum: enableStockMomentum,
        momentum_lookback_days: momentumLookbackDays,
        momentum_min_score: momentumMinScore,
        momentum_position_size_usd: momentumPositionSizeUsd,
        momentum_max_positions: momentumMaxPositions,
        momentum_trailing_stop_pct: momentumTrailingStopPct,
        enable_sector_rotation: enableSectorRotation,
        sector_rotation_period_days: sectorRotationPeriodDays,
        sector_top_n: sectorTopN,
        sector_position_size_usd: sectorPositionSizeUsd,
        sector_rebalance_frequency_days: sectorRebalanceFrequencyDays,
        enable_dividend_growth: enableDividendGrowth,
        dividend_min_yield_pct: dividendMinYieldPct,
        dividend_min_growth_years: dividendMinGrowthYears,
        dividend_position_size_usd: dividendPositionSizeUsd,
        dividend_max_positions: dividendMaxPositions,
        enable_earnings_momentum: enableEarningsMomentum,
        earnings_min_surprise_pct: earningsMinSurprisePct,
        earnings_hold_days: earningsHoldDays,
        earnings_position_size_usd: earningsPositionSizeUsd,
        earnings_max_positions: earningsMaxPositions,
        // Options Strategies
        enable_covered_calls: enableCoveredCalls,
        covered_call_days_to_expiry: coveredCallDaysToExpiry,
        covered_call_delta_target: coveredCallDeltaTarget,
        covered_call_min_premium_pct: coveredCallMinPremiumPct,
        enable_cash_secured_puts: enableCashSecuredPuts,
        csp_days_to_expiry: cspDaysToExpiry,
        csp_delta_target: cspDeltaTarget,
        csp_min_premium_pct: cspMinPremiumPct,
        enable_iron_condor: enableIronCondor,
        iron_condor_days_to_expiry: ironCondorDaysToExpiry,
        iron_condor_wing_width: ironCondorWingWidth,
        iron_condor_min_premium_pct: ironCondorMinPremiumPct,
        enable_wheel_strategy: enableWheelStrategy,
        wheel_stock_list: wheelStockList,
        wheel_position_size_usd: wheelPositionSizeUsd,
        // Twitter-Derived Strategies (2024)
        enable_btc_bracket_arb: enableBtcBracketArb,
        btc_bracket_min_discount_pct: btcBracketMinDiscountPct,
        btc_bracket_max_position_usd: btcBracketMaxPositionUsd,
        btc_bracket_scan_interval_sec: btcBracketScanIntervalSec,
        enable_bracket_compression: enableBracketCompression,
        bracket_max_imbalance_threshold: bracketMaxImbalanceThreshold,
        bracket_take_profit_pct: bracketTakeProfitPct,
        bracket_stop_loss_pct: bracketStopLossPct,
        bracket_max_position_usd: bracketMaxPositionUsd,
        enable_kalshi_mention_snipe: enableKalshiMentionSnipe,
        kalshi_snipe_min_profit_cents: kalshiSnipeMinProfitCents,
        kalshi_snipe_max_position_usd: kalshiSnipeMaxPositionUsd,
        kalshi_snipe_max_latency_ms: kalshiSnipeMaxLatencyMs,
        enable_whale_copy_trading: enableWhaleCopyTrading,
        whale_copy_min_win_rate: whaleCopyMinWinRate,
        whale_copy_delay_seconds: whaleCopyDelaySeconds,
        whale_copy_max_size_usd: whaleCopyMaxSizeUsd,
        whale_copy_max_concurrent: whaleCopyMaxConcurrent,
        enable_macro_board: enableMacroBoard,
        macro_max_exposure_usd: macroMaxExposureUsd,
        macro_min_conviction_score: macroMinConvictionScore,
        macro_rebalance_interval_hours: macroRebalanceIntervalHours,
        enable_fear_premium_contrarian: enableFearPremiumContrarian,
        fear_extreme_low_threshold: fearExtremeLowThreshold,
        fear_extreme_high_threshold: fearExtremeHighThreshold,
        fear_min_premium_pct: fearMinPremiumPct,
        fear_max_position_usd: fearMaxPositionUsd,
        // Exchange Enablement
        enable_binance: enableBinance,
        enable_bybit: enableBybit,
        enable_okx: enableOkx,
        enable_kraken: enableKraken,
        enable_coinbase: enableCoinbase,
        enable_kucoin: enableKucoin,
        enable_alpaca: enableAlpaca,
        enable_ibkr: enableIbkr,
        // Starting Balances (for P&L tracking)
        polymarket_starting_balance: polymarketStartingBalance,
        kalshi_starting_balance: kalshiStartingBalance,
        binance_starting_balance: binanceStartingBalance,
        coinbase_starting_balance: coinbaseStartingBalance,
        alpaca_starting_balance: alpacaStartingBalance,
        // Advanced Risk Framework
        kelly_sizing_enabled: kellySizingEnabled,
        kelly_fraction_cap: kellyFractionCap,
        kelly_min_confidence: kellyMinConfidence,
        kelly_max_position_pct: kellyMaxPositionPct,
        regime_detection_enabled: regimeDetectionEnabled,
        regime_vix_low_threshold: regimeVixLowThreshold,
        regime_vix_high_threshold: regimeVixHighThreshold,
        regime_vix_crisis_threshold: regimeVixCrisisThreshold,
        regime_auto_adjust: regimeAutoAdjust,
        circuit_breaker_enabled: circuitBreakerEnabled,
        circuit_breaker_level1_pct: circuitBreakerLevel1Pct,
        circuit_breaker_level2_pct: circuitBreakerLevel2Pct,
        circuit_breaker_level3_pct: circuitBreakerLevel3Pct,
        circuit_breaker_reset_hours: circuitBreakerResetHours,
        time_decay_enabled: timeDecayEnabled,
        time_decay_critical_days: timeDecayCriticalDays,
        time_decay_avoid_entry_hours: timeDecayAvoidEntryHours,
        order_flow_enabled: orderFlowEnabled,
        order_flow_signal_threshold: orderFlowSignalThreshold,
        order_flow_strong_threshold: orderFlowStrongThreshold,
        depeg_detection_enabled: depegDetectionEnabled,
        depeg_alert_threshold_pct: depegAlertThresholdPct,
        depeg_arbitrage_threshold_pct: depegArbitrageThresholdPct,
        depeg_critical_threshold_pct: depegCriticalThresholdPct,
        correlation_limits_enabled: correlationLimitsEnabled,
        correlation_max_cluster_pct: correlationMaxClusterPct,
        correlation_max_correlated_pct: correlationMaxCorrelatedPct,
        correlation_high_threshold: correlationHighThreshold,
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

      {/* Starting Balances - for P&L tracking */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowStartingBalances(!showStartingBalances)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle starting balances settings"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-neon-green" />
            Starting Balances
          </h2>
          {showStartingBalances ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">
          Set starting balance for each platform to track P&L performance (Total: ${(polymarketStartingBalance + kalshiStartingBalance + binanceStartingBalance + coinbaseStartingBalance + alpacaStartingBalance).toLocaleString()})
        </p>

        <AnimatePresence>
          {showStartingBalances && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-300">
                    <strong>💡 Tip:</strong> These are reference balances for P&L tracking. Set them to match your actual deposits on each platform. 
                    Default is $20,000 per platform ($100K total) for easy comparison.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Polymarket */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-400">P</span>
                      </div>
                      <div>
                        <p className="font-medium">Polymarket</p>
                        <p className="text-xs text-gray-500">Prediction Market</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={polymarketStartingBalance}
                        onChange={(e) => setPolymarketStartingBalance(parseFloat(e.target.value) || 0)}
                        step="1000"
                        min="0"
                        disabled={!isAdmin}
                        title="Polymarket starting balance"
                        placeholder="20000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Kalshi */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-400">K</span>
                      </div>
                      <div>
                        <p className="font-medium">Kalshi</p>
                        <p className="text-xs text-gray-500">Prediction Market</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={kalshiStartingBalance}
                        onChange={(e) => setKalshiStartingBalance(parseFloat(e.target.value) || 0)}
                        step="1000"
                        min="0"
                        disabled={!isAdmin}
                        title="Kalshi starting balance"
                        placeholder="20000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-green-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Binance */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-yellow-400">B</span>
                      </div>
                      <div>
                        <p className="font-medium">Binance</p>
                        <p className="text-xs text-gray-500">Crypto Exchange</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={binanceStartingBalance}
                        onChange={(e) => setBinanceStartingBalance(parseFloat(e.target.value) || 0)}
                        step="1000"
                        min="0"
                        disabled={!isAdmin}
                        title="Binance starting balance"
                        placeholder="20000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-yellow-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Coinbase */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-400">C</span>
                      </div>
                      <div>
                        <p className="font-medium">Coinbase</p>
                        <p className="text-xs text-gray-500">Crypto Exchange</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={coinbaseStartingBalance}
                        onChange={(e) => setCoinbaseStartingBalance(parseFloat(e.target.value) || 0)}
                        step="1000"
                        min="0"
                        disabled={!isAdmin}
                        title="Coinbase starting balance"
                        placeholder="20000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Alpaca */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-orange-400">A</span>
                      </div>
                      <div>
                        <p className="font-medium">Alpaca</p>
                        <p className="text-xs text-gray-500">Stock Broker</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={alpacaStartingBalance}
                        onChange={(e) => setAlpacaStartingBalance(parseFloat(e.target.value) || 0)}
                        step="1000"
                        min="0"
                        disabled={!isAdmin}
                        title="Alpaca starting balance"
                        placeholder="20000"
                        className="w-full bg-dark-border border border-dark-border rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="p-4 bg-dark-border/30 rounded-xl">
                    <p className="font-medium mb-3">Quick Presets</p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPolymarketStartingBalance(20000);
                          setKalshiStartingBalance(20000);
                          setBinanceStartingBalance(20000);
                          setCoinbaseStartingBalance(20000);
                          setAlpacaStartingBalance(20000);
                        }}
                        disabled={!isAdmin}
                        className="w-full px-3 py-2 text-sm bg-neon-green/20 hover:bg-neon-green/30 text-neon-green rounded-lg transition-colors disabled:opacity-50"
                      >
                        $100K Total ($20K each)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPolymarketStartingBalance(10000);
                          setKalshiStartingBalance(10000);
                          setBinanceStartingBalance(10000);
                          setCoinbaseStartingBalance(10000);
                          setAlpacaStartingBalance(10000);
                        }}
                        disabled={!isAdmin}
                        className="w-full px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                      >
                        $50K Total ($10K each)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        <button
          onClick={() => setShowCoreArbStrategies(!showCoreArbStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-green" />
            Core Arbitrage Strategies
          </h2>
          {showCoreArbStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        <AnimatePresence>
          {showCoreArbStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
        <p className="text-sm text-gray-500 mb-6 mt-2">Each strategy exploits different market inefficiencies. Enable/disable and tune independently.</p>

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
          )}
        </AnimatePresence>
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

      {/* Advanced Risk Framework: Kelly, Regime, Circuit Breaker, etc. */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.235 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowAdvancedRiskFramework(!showAdvancedRiskFramework)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle advanced risk framework"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-neon-green" />
            Advanced Risk Framework
            <span className="text-xs bg-neon-green/20 text-neon-green px-2 py-0.5 rounded-full font-normal">7 MODULES</span>
          </h2>
          {showAdvancedRiskFramework ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Kelly Criterion, Regime Detection, Circuit Breaker, Time Decay, Order Flow, Depeg Detection, Correlation Limits</p>

        <AnimatePresence>
          {showAdvancedRiskFramework && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Kelly Criterion Position Sizing */}
              <div className="mt-6 rounded-xl border-2 border-neon-purple overflow-hidden">
                <div className="bg-neon-purple/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon-purple flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Kelly Criterion Sizing
                        <span className="text-xs bg-neon-purple/30 text-neon-purple px-2 py-0.5 rounded-full">OPTIMAL</span>
                      </h3>
                      <p className="text-xs text-neon-purple">Mathematically optimal bet sizing</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={kellySizingEnabled} 
                    onToggle={() => setKellySizingEnabled(!kellySizingEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-neon-purple/5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Fraction Cap (Half-Kelly)
                      </label>
                      <input
                        type="number"
                        value={kellyFractionCap}
                        onChange={(e) => setKellyFractionCap(parseFloat(e.target.value))}
                        step="0.05"
                        min="0.1"
                        max="1.0"
                        disabled={!isAdmin}
                        placeholder="0.25"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">0.25 = Quarter-Kelly (conservative)</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Min Confidence
                      </label>
                      <input
                        type="number"
                        value={kellyMinConfidence}
                        onChange={(e) => setKellyMinConfidence(parseFloat(e.target.value))}
                        step="0.05"
                        min="0.5"
                        max="0.95"
                        disabled={!isAdmin}
                        placeholder="0.60"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Minimum edge to use Kelly</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Percent className="w-3 h-3" />
                        Max Position (% of portfolio)
                      </label>
                      <input
                        type="number"
                        value={kellyMaxPositionPct}
                        onChange={(e) => setKellyMaxPositionPct(parseFloat(e.target.value))}
                        step="1"
                        min="1"
                        max="25"
                        disabled={!isAdmin}
                        placeholder="10"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Hard cap on single position</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Regime Detection */}
              <div className="mt-4 rounded-xl border-2 border-blue-500 overflow-hidden">
                <div className="bg-blue-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Market Regime Detection
                        <span className="text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full">ADAPTIVE</span>
                      </h3>
                      <p className="text-xs text-blue-400">Adapts strategies to market conditions</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={regimeDetectionEnabled} 
                    onToggle={() => setRegimeDetectionEnabled(!regimeDetectionEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-blue-500/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        VIX Low (Bull)
                      </label>
                      <input
                        type="number"
                        value={regimeVixLowThreshold}
                        onChange={(e) => setRegimeVixLowThreshold(parseFloat(e.target.value))}
                        step="1"
                        min="10"
                        max="20"
                        disabled={!isAdmin}
                        placeholder="15"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        VIX High (Volatile)
                      </label>
                      <input
                        type="number"
                        value={regimeVixHighThreshold}
                        onChange={(e) => setRegimeVixHighThreshold(parseFloat(e.target.value))}
                        step="1"
                        min="20"
                        max="35"
                        disabled={!isAdmin}
                        placeholder="25"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        VIX Crisis
                      </label>
                      <input
                        type="number"
                        value={regimeVixCrisisThreshold}
                        onChange={(e) => setRegimeVixCrisisThreshold(parseFloat(e.target.value))}
                        step="1"
                        min="30"
                        max="50"
                        disabled={!isAdmin}
                        placeholder="35"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                        <input
                          type="checkbox"
                          checked={regimeAutoAdjust}
                          onChange={(e) => setRegimeAutoAdjust(e.target.checked)}
                          disabled={!isAdmin}
                          className="w-4 h-4 rounded"
                        />
                        Auto-adjust params
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Circuit Breaker System */}
              <div className="mt-4 rounded-xl border-2 border-red-500 overflow-hidden">
                <div className="bg-red-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Circuit Breaker
                        <span className="text-xs bg-red-500/30 text-red-400 px-2 py-0.5 rounded-full">SAFETY</span>
                      </h3>
                      <p className="text-xs text-red-400">Stops trading on excessive drawdown</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={circuitBreakerEnabled} 
                    onToggle={() => setCircuitBreakerEnabled(!circuitBreakerEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-red-500/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Level 1 (50% size)
                      </label>
                      <input
                        type="number"
                        value={circuitBreakerLevel1Pct}
                        onChange={(e) => setCircuitBreakerLevel1Pct(parseFloat(e.target.value))}
                        step="0.5"
                        min="1"
                        max="5"
                        disabled={!isAdmin}
                        placeholder="3"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">% drawdown</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Level 2 (25% size)
                      </label>
                      <input
                        type="number"
                        value={circuitBreakerLevel2Pct}
                        onChange={(e) => setCircuitBreakerLevel2Pct(parseFloat(e.target.value))}
                        step="0.5"
                        min="3"
                        max="10"
                        disabled={!isAdmin}
                        placeholder="5"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">% drawdown</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Level 3 (HALT)
                      </label>
                      <input
                        type="number"
                        value={circuitBreakerLevel3Pct}
                        onChange={(e) => setCircuitBreakerLevel3Pct(parseFloat(e.target.value))}
                        step="1"
                        min="5"
                        max="20"
                        disabled={!isAdmin}
                        placeholder="10"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">% drawdown</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Reset After (hours)
                      </label>
                      <input
                        type="number"
                        value={circuitBreakerResetHours}
                        onChange={(e) => setCircuitBreakerResetHours(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="72"
                        disabled={!isAdmin}
                        placeholder="24"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Decay Analysis */}
              <div className="mt-4 rounded-xl border-2 border-orange-500 overflow-hidden">
                <div className="bg-orange-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Time Decay Analysis
                        <span className="text-xs bg-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">PREDICTION MARKETS</span>
                      </h3>
                      <p className="text-xs text-orange-400">Event horizon theta analysis</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={timeDecayEnabled} 
                    onToggle={() => setTimeDecayEnabled(!timeDecayEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-orange-500/5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Critical Days
                      </label>
                      <input
                        type="number"
                        value={timeDecayCriticalDays}
                        onChange={(e) => setTimeDecayCriticalDays(parseInt(e.target.value))}
                        step="1"
                        min="1"
                        max="30"
                        disabled={!isAdmin}
                        placeholder="7"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Days before resolution</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Avoid Entry (hours)
                      </label>
                      <input
                        type="number"
                        value={timeDecayAvoidEntryHours}
                        onChange={(e) => setTimeDecayAvoidEntryHours(parseInt(e.target.value))}
                        step="6"
                        min="6"
                        max="168"
                        disabled={!isAdmin}
                        placeholder="48"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Don&apos;t enter within this window</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Flow Analysis */}
              <div className="mt-4 rounded-xl border-2 border-cyan-500 overflow-hidden">
                <div className="bg-cyan-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Order Flow Analysis
                        <span className="text-xs bg-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded-full">ADVANCED</span>
                      </h3>
                      <p className="text-xs text-cyan-400">Order flow imbalance signals</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={orderFlowEnabled} 
                    onToggle={() => setOrderFlowEnabled(!orderFlowEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-cyan-500/5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Signal Threshold
                      </label>
                      <input
                        type="number"
                        value={orderFlowSignalThreshold}
                        onChange={(e) => setOrderFlowSignalThreshold(parseFloat(e.target.value))}
                        step="0.05"
                        min="0.1"
                        max="0.5"
                        disabled={!isAdmin}
                        placeholder="0.30"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">OFI threshold for weak signal</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Strong Signal Threshold
                      </label>
                      <input
                        type="number"
                        value={orderFlowStrongThreshold}
                        onChange={(e) => setOrderFlowStrongThreshold(parseFloat(e.target.value))}
                        step="0.05"
                        min="0.4"
                        max="0.9"
                        disabled={!isAdmin}
                        placeholder="0.60"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">OFI threshold for strong signal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stablecoin Depeg Detection */}
              <div className="mt-4 rounded-xl border-2 border-green-500 overflow-hidden">
                <div className="bg-green-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Depeg Detection
                        <span className="text-xs bg-green-500/30 text-green-400 px-2 py-0.5 rounded-full">STABLECOINS</span>
                      </h3>
                      <p className="text-xs text-green-400">Arbitrage on stablecoin depegs</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={depegDetectionEnabled} 
                    onToggle={() => setDepegDetectionEnabled(!depegDetectionEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-green-500/5">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Alert Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={depegAlertThresholdPct}
                        onChange={(e) => setDepegAlertThresholdPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.1"
                        max="1.0"
                        disabled={!isAdmin}
                        placeholder="0.30"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Arb Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={depegArbitrageThresholdPct}
                        onChange={(e) => setDepegArbitrageThresholdPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0.2"
                        max="2.0"
                        disabled={!isAdmin}
                        placeholder="0.50"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Critical (%)
                      </label>
                      <input
                        type="number"
                        value={depegCriticalThresholdPct}
                        onChange={(e) => setDepegCriticalThresholdPct(parseFloat(e.target.value))}
                        step="0.5"
                        min="1"
                        max="10"
                        disabled={!isAdmin}
                        placeholder="5.0"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Correlation Position Limits */}
              <div className="mt-4 rounded-xl border-2 border-pink-500 overflow-hidden">
                <div className="bg-pink-500/20 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Correlation Limits
                        <span className="text-xs bg-pink-500/30 text-pink-400 px-2 py-0.5 rounded-full">PORTFOLIO</span>
                      </h3>
                      <p className="text-xs text-pink-400">Cross-asset correlation tracking</p>
                    </div>
                  </div>
                  <ToggleSwitch 
                    enabled={correlationLimitsEnabled} 
                    onToggle={() => setCorrelationLimitsEnabled(!correlationLimitsEnabled)} 
                    disabled={!isAdmin}
                    size="md"
                  />
                </div>
                <div className="p-4 bg-pink-500/5">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Cluster (%)
                      </label>
                      <input
                        type="number"
                        value={correlationMaxClusterPct}
                        onChange={(e) => setCorrelationMaxClusterPct(parseFloat(e.target.value))}
                        step="5"
                        min="10"
                        max="50"
                        disabled={!isAdmin}
                        placeholder="30"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Max % in correlated cluster</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        Max Correlated (%)
                      </label>
                      <input
                        type="number"
                        value={correlationMaxCorrelatedPct}
                        onChange={(e) => setCorrelationMaxCorrelatedPct(parseFloat(e.target.value))}
                        step="5"
                        min="20"
                        max="70"
                        disabled={!isAdmin}
                        placeholder="50"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Max % in any correlation group</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        High Threshold
                      </label>
                      <input
                        type="number"
                        value={correlationHighThreshold}
                        onChange={(e) => setCorrelationHighThreshold(parseFloat(e.target.value))}
                        step="0.05"
                        min="0.5"
                        max="0.95"
                        disabled={!isAdmin}
                        placeholder="0.70"
                        className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 text-sm disabled:opacity-50"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Correlation coefficient threshold</p>
                    </div>
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

      {/* Stock Strategies */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowStockStrategies(!showStockStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle stock strategies"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-500" />
            Stock Strategies (via Alpaca)
          </h2>
          {showStockStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Mean reversion, momentum, sector rotation, dividends, and earnings strategies</p>

        <AnimatePresence>
          {showStockStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Stock Mean Reversion */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Stock Mean Reversion</h3>
                    <p className="text-sm text-gray-500">Buy oversold, sell overbought stocks (15-30% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableStockMeanReversion} onToggle={() => setEnableStockMeanReversion(!enableStockMeanReversion)} disabled={!isAdmin} />
                </div>
                {enableStockMeanReversion && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">RSI Oversold</label>
                      <input type="number" value={meanRevRsiOversold} onChange={(e) => setMeanRevRsiOversold(parseFloat(e.target.value))} step="5" min="10" max="40" disabled={!isAdmin} title="RSI oversold threshold" placeholder="30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">RSI Overbought</label>
                      <input type="number" value={meanRevRsiOverbought} onChange={(e) => setMeanRevRsiOverbought(parseFloat(e.target.value))} step="5" min="60" max="90" disabled={!isAdmin} title="RSI overbought threshold" placeholder="70" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={meanRevPositionSizeUsd} onChange={(e) => setMeanRevPositionSizeUsd(parseFloat(e.target.value))} step="100" min="100" disabled={!isAdmin} title="Position size in USD" placeholder="1000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Positions</label>
                      <input type="number" value={meanRevMaxPositions} onChange={(e) => setMeanRevMaxPositions(parseInt(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Maximum number of positions" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stop Loss %</label>
                      <input type="number" value={meanRevStopLossPct} onChange={(e) => setMeanRevStopLossPct(parseFloat(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Stop loss percentage" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Take Profit %</label>
                      <input type="number" value={meanRevTakeProfitPct} onChange={(e) => setMeanRevTakeProfitPct(parseFloat(e.target.value))} step="1" min="1" max="50" disabled={!isAdmin} title="Take profit percentage" placeholder="10" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Momentum */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Stock Momentum</h3>
                    <p className="text-sm text-gray-500">Ride trending stocks with trailing stops (20-40% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableStockMomentum} onToggle={() => setEnableStockMomentum(!enableStockMomentum)} disabled={!isAdmin} />
                </div>
                {enableStockMomentum && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Lookback Days</label>
                      <input type="number" value={momentumLookbackDays} onChange={(e) => setMomentumLookbackDays(parseInt(e.target.value))} step="5" min="5" max="90" disabled={!isAdmin} title="Momentum lookback period" placeholder="20" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Score (0-100)</label>
                      <input type="number" value={momentumMinScore} onChange={(e) => setMomentumMinScore(parseInt(e.target.value))} step="5" min="50" max="95" disabled={!isAdmin} title="Minimum momentum score" placeholder="70" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={momentumPositionSizeUsd} onChange={(e) => setMomentumPositionSizeUsd(parseFloat(e.target.value))} step="100" min="100" disabled={!isAdmin} title="Position size in USD" placeholder="1000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Positions</label>
                      <input type="number" value={momentumMaxPositions} onChange={(e) => setMomentumMaxPositions(parseInt(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Maximum positions" placeholder="10" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Trailing Stop %</label>
                      <input type="number" value={momentumTrailingStopPct} onChange={(e) => setMomentumTrailingStopPct(parseFloat(e.target.value))} step="1" min="3" max="20" disabled={!isAdmin} title="Trailing stop percentage" placeholder="8" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Sector Rotation */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Sector Rotation</h3>
                    <p className="text-sm text-gray-500">Rotate into strongest sectors via ETFs (15-25% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableSectorRotation} onToggle={() => setEnableSectorRotation(!enableSectorRotation)} disabled={!isAdmin} />
                </div>
                {enableSectorRotation && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Lookback Days</label>
                      <input type="number" value={sectorRotationPeriodDays} onChange={(e) => setSectorRotationPeriodDays(parseInt(e.target.value))} step="5" min="5" max="90" disabled={!isAdmin} title="Sector rotation lookback" placeholder="30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Top N Sectors</label>
                      <input type="number" value={sectorTopN} onChange={(e) => setSectorTopN(parseInt(e.target.value))} step="1" min="1" max="5" disabled={!isAdmin} title="Number of top sectors" placeholder="3" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={sectorPositionSizeUsd} onChange={(e) => setSectorPositionSizeUsd(parseFloat(e.target.value))} step="500" min="500" disabled={!isAdmin} title="Position size per sector" placeholder="2000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Rebalance Days</label>
                      <input type="number" value={sectorRebalanceFrequencyDays} onChange={(e) => setSectorRebalanceFrequencyDays(parseInt(e.target.value))} step="1" min="1" max="30" disabled={!isAdmin} title="Rebalance frequency" placeholder="7" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Dividend Growth */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Dividend Growth</h3>
                    <p className="text-sm text-gray-500">Income from quality dividend growers (8-12% APY + dividends)</p>
                  </div>
                  <ToggleSwitch enabled={enableDividendGrowth} onToggle={() => setEnableDividendGrowth(!enableDividendGrowth)} disabled={!isAdmin} />
                </div>
                {enableDividendGrowth && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Yield %</label>
                      <input type="number" value={dividendMinYieldPct} onChange={(e) => setDividendMinYieldPct(parseFloat(e.target.value))} step="0.5" min="0.5" max="10" disabled={!isAdmin} title="Minimum dividend yield" placeholder="2.0" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Growth Years</label>
                      <input type="number" value={dividendMinGrowthYears} onChange={(e) => setDividendMinGrowthYears(parseInt(e.target.value))} step="1" min="5" max="25" disabled={!isAdmin} title="Minimum consecutive years of growth" placeholder="10" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={dividendPositionSizeUsd} onChange={(e) => setDividendPositionSizeUsd(parseFloat(e.target.value))} step="500" min="500" disabled={!isAdmin} title="Position size per stock" placeholder="2000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Positions</label>
                      <input type="number" value={dividendMaxPositions} onChange={(e) => setDividendMaxPositions(parseInt(e.target.value))} step="1" min="5" max="30" disabled={!isAdmin} title="Maximum positions" placeholder="15" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Earnings Momentum */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Earnings Momentum</h3>
                    <p className="text-sm text-gray-500">Trade around earnings surprises (15-30% APY, higher risk)</p>
                  </div>
                  <ToggleSwitch enabled={enableEarningsMomentum} onToggle={() => setEnableEarningsMomentum(!enableEarningsMomentum)} disabled={!isAdmin} />
                </div>
                {enableEarningsMomentum && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Surprise %</label>
                      <input type="number" value={earningsMinSurprisePct} onChange={(e) => setEarningsMinSurprisePct(parseFloat(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Minimum earnings surprise" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Hold Days</label>
                      <input type="number" value={earningsHoldDays} onChange={(e) => setEarningsHoldDays(parseInt(e.target.value))} step="1" min="1" max="30" disabled={!isAdmin} title="Days to hold after earnings" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={earningsPositionSizeUsd} onChange={(e) => setEarningsPositionSizeUsd(parseFloat(e.target.value))} step="100" min="100" disabled={!isAdmin} title="Position size per trade" placeholder="500" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Positions</label>
                      <input type="number" value={earningsMaxPositions} onChange={(e) => setEarningsMaxPositions(parseInt(e.target.value))} step="1" min="1" max="10" disabled={!isAdmin} title="Maximum positions" placeholder="3" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Options Strategies */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.242 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowOptionsStrategies(!showOptionsStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle options strategies"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-500" />
            Options Strategies (Requires IBKR)
          </h2>
          {showOptionsStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">Covered calls, cash-secured puts, iron condors, and the wheel strategy</p>
        <p className="text-xs text-yellow-500 mt-1">⚠️ Requires IBKR or options-enabled broker (not yet implemented)</p>

        <AnimatePresence>
          {showOptionsStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Covered Calls */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Covered Calls</h3>
                    <p className="text-sm text-gray-500">Generate income on long stock positions (10-20% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableCoveredCalls} onToggle={() => setEnableCoveredCalls(!enableCoveredCalls)} disabled={!isAdmin} />
                </div>
                {enableCoveredCalls && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Days to Expiry</label>
                      <input type="number" value={coveredCallDaysToExpiry} onChange={(e) => setCoveredCallDaysToExpiry(parseInt(e.target.value))} step="7" min="7" max="60" disabled={!isAdmin} title="Days to expiration" placeholder="30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Delta Target</label>
                      <input type="number" value={coveredCallDeltaTarget} onChange={(e) => setCoveredCallDeltaTarget(parseFloat(e.target.value))} step="0.05" min="0.1" max="0.5" disabled={!isAdmin} title="Target delta for calls" placeholder="0.30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Premium %</label>
                      <input type="number" value={coveredCallMinPremiumPct} onChange={(e) => setCoveredCallMinPremiumPct(parseFloat(e.target.value))} step="0.25" min="0.5" max="5" disabled={!isAdmin} title="Minimum premium collected" placeholder="1.0" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Cash-Secured Puts */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Cash-Secured Puts</h3>
                    <p className="text-sm text-gray-500">Acquire stocks at discount or collect premium (15-30% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableCashSecuredPuts} onToggle={() => setEnableCashSecuredPuts(!enableCashSecuredPuts)} disabled={!isAdmin} />
                </div>
                {enableCashSecuredPuts && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Days to Expiry</label>
                      <input type="number" value={cspDaysToExpiry} onChange={(e) => setCspDaysToExpiry(parseInt(e.target.value))} step="7" min="7" max="60" disabled={!isAdmin} title="Days to expiration" placeholder="30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Delta Target</label>
                      <input type="number" value={cspDeltaTarget} onChange={(e) => setCspDeltaTarget(parseFloat(e.target.value))} step="0.05" min="-0.5" max="-0.1" disabled={!isAdmin} title="Target delta for puts (negative)" placeholder="-0.30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Premium %</label>
                      <input type="number" value={cspMinPremiumPct} onChange={(e) => setCspMinPremiumPct(parseFloat(e.target.value))} step="0.25" min="0.5" max="5" disabled={!isAdmin} title="Minimum premium collected" placeholder="1.5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Iron Condor */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Iron Condor</h3>
                    <p className="text-sm text-gray-500">Range-bound premium collection (20-40% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableIronCondor} onToggle={() => setEnableIronCondor(!enableIronCondor)} disabled={!isAdmin} />
                </div>
                {enableIronCondor && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Days to Expiry</label>
                      <input type="number" value={ironCondorDaysToExpiry} onChange={(e) => setIronCondorDaysToExpiry(parseInt(e.target.value))} step="7" min="14" max="60" disabled={!isAdmin} title="Days to expiration" placeholder="45" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Wing Width ($)</label>
                      <input type="number" value={ironCondorWingWidth} onChange={(e) => setIronCondorWingWidth(parseInt(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Width between strikes" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Premium %</label>
                      <input type="number" value={ironCondorMinPremiumPct} onChange={(e) => setIronCondorMinPremiumPct(parseFloat(e.target.value))} step="0.5" min="1" max="10" disabled={!isAdmin} title="Minimum premium collected" placeholder="2.0" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Wheel Strategy */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Wheel Strategy</h3>
                    <p className="text-sm text-gray-500">Systematic CSP → Covered Call rotation (20-35% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableWheelStrategy} onToggle={() => setEnableWheelStrategy(!enableWheelStrategy)} disabled={!isAdmin} />
                </div>
                {enableWheelStrategy && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stock List</label>
                      <input type="text" value={wheelStockList} onChange={(e) => setWheelStockList(e.target.value)} disabled={!isAdmin} title="Comma-separated stock symbols" placeholder="AAPL,MSFT,GOOGL" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                      <p className="text-[10px] text-gray-500 mt-1">Comma-separated symbols</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Position Size ($)</label>
                      <input type="number" value={wheelPositionSizeUsd} onChange={(e) => setWheelPositionSizeUsd(parseFloat(e.target.value))} step="1000" min="1000" disabled={!isAdmin} title="Position size per stock" placeholder="5000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Twitter-Derived Strategies (2024) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.243 }}
        className="card mb-6"
      >
        <button
          onClick={() => setShowTwitterStrategies(!showTwitterStrategies)}
          className="w-full flex items-center justify-between"
          type="button"
          title="Toggle Twitter strategies"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-500" />
            Twitter-Derived Strategies (2024)
          </h2>
          {showTwitterStrategies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1">High-conviction strategies from analyzing top prediction market traders on X/Twitter</p>
        <p className="text-xs text-green-500 mt-1">✨ New! Based on profitable traders making $20K-200K/month</p>

        <AnimatePresence>
          {showTwitterStrategies && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* BTC Bracket Arbitrage */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">🔥 BTC Bracket Arbitrage</h3>
                    <p className="text-sm text-gray-500">Buy YES + NO when combined &lt; $1.00 for guaranteed profit ($20K-200K/month potential)</p>
                  </div>
                  <ToggleSwitch enabled={enableBtcBracketArb} onToggle={() => setEnableBtcBracketArb(!enableBtcBracketArb)} disabled={!isAdmin} />
                </div>
                {enableBtcBracketArb && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Discount %</label>
                      <input type="number" value={btcBracketMinDiscountPct} onChange={(e) => setBtcBracketMinDiscountPct(parseFloat(e.target.value))} step="0.1" min="0.1" max="5" disabled={!isAdmin} title="Minimum combined discount" placeholder="0.5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Position ($)</label>
                      <input type="number" value={btcBracketMaxPositionUsd} onChange={(e) => setBtcBracketMaxPositionUsd(parseFloat(e.target.value))} step="10" min="10" disabled={!isAdmin} title="Maximum position size" placeholder="50" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Scan Interval (s)</label>
                      <input type="number" value={btcBracketScanIntervalSec} onChange={(e) => setBtcBracketScanIntervalSec(parseInt(e.target.value))} step="5" min="5" max="120" disabled={!isAdmin} title="Scan interval in seconds" placeholder="15" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bracket Compression */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">📊 Bracket Compression</h3>
                    <p className="text-sm text-gray-500">Mean reversion on stretched bracket prices (15-30% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableBracketCompression} onToggle={() => setEnableBracketCompression(!enableBracketCompression)} disabled={!isAdmin} />
                </div>
                {enableBracketCompression && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Imbalance</label>
                      <input type="number" value={bracketMaxImbalanceThreshold} onChange={(e) => setBracketMaxImbalanceThreshold(parseFloat(e.target.value))} step="0.05" min="0.1" max="0.5" disabled={!isAdmin} title="Maximum imbalance threshold" placeholder="0.30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Take Profit %</label>
                      <input type="number" value={bracketTakeProfitPct} onChange={(e) => setBracketTakeProfitPct(parseFloat(e.target.value))} step="0.5" min="1" max="10" disabled={!isAdmin} title="Take profit percentage" placeholder="3.0" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stop Loss %</label>
                      <input type="number" value={bracketStopLossPct} onChange={(e) => setBracketStopLossPct(parseFloat(e.target.value))} step="1" min="5" max="25" disabled={!isAdmin} title="Stop loss percentage" placeholder="10" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Position ($)</label>
                      <input type="number" value={bracketMaxPositionUsd} onChange={(e) => setBracketMaxPositionUsd(parseFloat(e.target.value))} step="25" min="25" disabled={!isAdmin} title="Maximum position size" placeholder="100" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Kalshi Mention Sniping */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">⚡ Kalshi Mention Sniping</h3>
                    <p className="text-sm text-gray-500">Fast execution on resolved mention markets ($120+/event)</p>
                  </div>
                  <ToggleSwitch enabled={enableKalshiMentionSnipe} onToggle={() => setEnableKalshiMentionSnipe(!enableKalshiMentionSnipe)} disabled={!isAdmin} />
                </div>
                {enableKalshiMentionSnipe && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Profit (¢)</label>
                      <input type="number" value={kalshiSnipeMinProfitCents} onChange={(e) => setKalshiSnipeMinProfitCents(parseInt(e.target.value))} step="1" min="1" max="10" disabled={!isAdmin} title="Minimum profit in cents" placeholder="2" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Position ($)</label>
                      <input type="number" value={kalshiSnipeMaxPositionUsd} onChange={(e) => setKalshiSnipeMaxPositionUsd(parseFloat(e.target.value))} step="25" min="25" disabled={!isAdmin} title="Maximum position size" placeholder="100" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Latency (ms)</label>
                      <input type="number" value={kalshiSnipeMaxLatencyMs} onChange={(e) => setKalshiSnipeMaxLatencyMs(parseInt(e.target.value))} step="100" min="100" max="5000" disabled={!isAdmin} title="Maximum acceptable latency" placeholder="1000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Whale Copy Trading */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">🐋 Whale Copy Trading</h3>
                    <p className="text-sm text-gray-500">Track and copy high win-rate wallets (25-50% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableWhaleCopyTrading} onToggle={() => setEnableWhaleCopyTrading(!enableWhaleCopyTrading)} disabled={!isAdmin} />
                </div>
                {enableWhaleCopyTrading && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Win Rate %</label>
                      <input type="number" value={whaleCopyMinWinRate} onChange={(e) => setWhaleCopyMinWinRate(parseInt(e.target.value))} step="5" min="60" max="100" disabled={!isAdmin} title="Minimum wallet win rate" placeholder="80" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Copy Delay (s)</label>
                      <input type="number" value={whaleCopyDelaySeconds} onChange={(e) => setWhaleCopyDelaySeconds(parseInt(e.target.value))} step="10" min="0" max="300" disabled={!isAdmin} title="Delay before copying" placeholder="30" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Size ($)</label>
                      <input type="number" value={whaleCopyMaxSizeUsd} onChange={(e) => setWhaleCopyMaxSizeUsd(parseFloat(e.target.value))} step="10" min="10" disabled={!isAdmin} title="Maximum copy size" placeholder="50" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Concurrent</label>
                      <input type="number" value={whaleCopyMaxConcurrent} onChange={(e) => setWhaleCopyMaxConcurrent(parseInt(e.target.value))} step="1" min="1" max="20" disabled={!isAdmin} title="Maximum concurrent copies" placeholder="5" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Macro Board Strategy */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">🌍 Macro Board Strategy</h3>
                    <p className="text-sm text-gray-500">Heavy weighted exposure to macro events ($62K/month potential)</p>
                  </div>
                  <ToggleSwitch enabled={enableMacroBoard} onToggle={() => setEnableMacroBoard(!enableMacroBoard)} disabled={!isAdmin} />
                </div>
                {enableMacroBoard && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Exposure ($)</label>
                      <input type="number" value={macroMaxExposureUsd} onChange={(e) => setMacroMaxExposureUsd(parseFloat(e.target.value))} step="500" min="500" disabled={!isAdmin} title="Maximum total exposure" placeholder="5000" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Conviction</label>
                      <input type="number" value={macroMinConvictionScore} onChange={(e) => setMacroMinConvictionScore(parseInt(e.target.value))} step="5" min="50" max="100" disabled={!isAdmin} title="Minimum conviction score" placeholder="70" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Rebalance (hrs)</label>
                      <input type="number" value={macroRebalanceIntervalHours} onChange={(e) => setMacroRebalanceIntervalHours(parseInt(e.target.value))} step="6" min="6" max="168" disabled={!isAdmin} title="Rebalance interval in hours" placeholder="24" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fear Premium Contrarian */}
              <div className="mt-6 pt-6 border-t border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">😱 Fear Premium Contrarian</h3>
                    <p className="text-sm text-gray-500">Trade against extreme sentiment - 91.4% win rate approach (25-60% APY)</p>
                  </div>
                  <ToggleSwitch enabled={enableFearPremiumContrarian} onToggle={() => setEnableFearPremiumContrarian(!enableFearPremiumContrarian)} disabled={!isAdmin} />
                </div>
                {enableFearPremiumContrarian && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Extreme Low</label>
                      <input type="number" value={fearExtremeLowThreshold} onChange={(e) => setFearExtremeLowThreshold(parseFloat(e.target.value))} step="0.01" min="0.05" max="0.25" disabled={!isAdmin} title="Extreme low price threshold" placeholder="0.15" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Extreme High</label>
                      <input type="number" value={fearExtremeHighThreshold} onChange={(e) => setFearExtremeHighThreshold(parseFloat(e.target.value))} step="0.01" min="0.75" max="0.95" disabled={!isAdmin} title="Extreme high price threshold" placeholder="0.85" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Premium %</label>
                      <input type="number" value={fearMinPremiumPct} onChange={(e) => setFearMinPremiumPct(parseInt(e.target.value))} step="5" min="5" max="50" disabled={!isAdmin} title="Minimum fear premium" placeholder="10" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Position ($)</label>
                      <input type="number" value={fearMaxPositionUsd} onChange={(e) => setFearMaxPositionUsd(parseFloat(e.target.value))} step="25" min="25" disabled={!isAdmin} title="Maximum position size" placeholder="200" className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                )}
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
