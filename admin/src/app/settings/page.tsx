'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  ChevronRight,
  Activity,
  Target,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  CheckCircle2,
  Database,
  RefreshCw,
  Gift,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useBotStatus, useBotConfig, useDisabledMarkets, useResetSimulation, useUpdateBotConfig, useUpdateBotStatus } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Tooltip, LabelWithTooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';

// Platform logos as SVG components
const PolymarketLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#5865F2" />
    <text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">P</text>
  </svg>
);

const KalshiLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#00C853" />
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

import { CircuitBreakerStatus } from '@/components/CircuitBreakerStatus';
import { useTier } from '@/lib/useTier';
import { Crown, Sparkles, CreditCard, ExternalLink } from 'lucide-react';

// Subscription Section Component
function SubscriptionSection() {
  const { tier, profile, isPro, isElite, isFree, refreshProfile } = useTier();
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleManageSubscription = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          returnUrl: window.location.href,
        }),
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!profile?.id) return;
    setCancelLoading(true);
    setCancelMessage(null);
    
    try {
      const response = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCancelMessage({ 
          type: 'success', 
          text: 'Your subscription has been cancelled. You\'ll retain access until the end of your billing period.' 
        });
        setShowCancelConfirm(false);
        // Refresh profile to get updated subscription status
        setTimeout(() => refreshProfile?.(), 2000);
      } else {
        setCancelMessage({ type: 'error', text: data.error || 'Failed to cancel subscription' });
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setCancelMessage({ type: 'error', text: 'An error occurred while cancelling. Please try again.' });
    } finally {
      setCancelLoading(false);
    }
  };

  const getTierBadge = () => {
    if (isElite) return { icon: Crown, color: 'yellow', label: 'Elite' };
    if (isPro) return { icon: Sparkles, color: 'blue', label: 'Pro' };
    return { icon: Gift, color: 'gray', label: 'Free' };
  };

  const badge = getTierBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-neon-blue" />
        Subscription
      </h2>
      
      <div className="p-4 bg-dark-border/30 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              badge.color === 'yellow' && "bg-yellow-500/20",
              badge.color === 'blue' && "bg-blue-500/20",
              badge.color === 'gray' && "bg-gray-500/20",
            )}>
              <BadgeIcon className={cn(
                "w-6 h-6",
                badge.color === 'yellow' && "text-yellow-400",
                badge.color === 'blue' && "text-blue-400",
                badge.color === 'gray' && "text-gray-400",
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{badge.label} Plan</h3>
                {profile?.subscriptionStatus === 'active' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">
                {isFree 
                  ? 'Unlimited paper trading, 3 strategies' 
                  : isPro 
                    ? '1,000 live trades/month, all strategies'
                    : 'Unlimited live trades, premium features'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!isFree && profile?.stripeCustomerId && (
              <button
                onClick={handleManageSubscription}
                disabled={loading}
                className="px-4 py-2 bg-dark-border hover:bg-gray-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                {loading ? 'Loading...' : <>Manage Billing <ExternalLink className="w-4 h-4" /></>}
              </button>
            )}
            
            {!isElite && (
              <button
                onClick={() => setShowUpgrade(true)}
                className={cn(
                  "px-4 py-2 rounded-lg font-semibold text-sm",
                  isFree
                    ? "bg-neon-blue hover:bg-blue-600 text-white"
                    : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black"
                )}
              >
                {isFree ? 'Upgrade to Pro' : 'Upgrade to Elite'}
              </button>
            )}
          </div>
        </div>
        
        {/* Cancel subscription message */}
        {cancelMessage && (
          <div className={cn(
            "mt-4 p-4 rounded-lg text-sm",
            cancelMessage.type === 'success' ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
          )}>
            {cancelMessage.text}
          </div>
        )}
        
        {/* Trade limits for Pro users */}
        {isPro && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Live trades this month</span>
              <span className="text-white">
                {profile?.monthlyTradesUsed || 0} / {profile?.monthlyTradesLimit || 1000}
              </span>
            </div>
            <div className="mt-2 h-2 bg-dark-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-neon-blue rounded-full transition-all"
                style={{ 
                  width: `${Math.min(((profile?.monthlyTradesUsed || 0) / (profile?.monthlyTradesLimit || 1000)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        )}
        
        {/* Cancel Subscription Link */}
        {!isFree && profile?.stripeCustomerId && profile?.subscriptionStatus === 'active' && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors underline"
            >
              Cancel subscription
            </button>
          </div>
        )}
      </div>
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Cancel Subscription?</h3>
            </div>
            
            <p className="text-gray-400 text-sm">
              Are you sure you want to cancel your {tier === 'elite' ? 'Elite' : 'Pro'} subscription? 
              You&apos;ll lose access to:
            </p>
            
            <ul className="text-sm text-gray-300 space-y-2 pl-4">
              <li>• Live trading capabilities</li>
              <li>• AI-powered insights and analytics</li>
              <li>• Advanced strategies</li>
              {tier === 'elite' && <li>• Congress & Whale tracking</li>}
            </ul>
            
            <p className="text-sm text-gray-500">
              Your access will continue until the end of your current billing period.
            </p>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-3 bg-dark-border hover:bg-gray-700 rounded-xl font-semibold text-sm"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-xl font-semibold text-sm"
              >
                {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Upgrade Modal - Dynamically imported to avoid SSR issues */}
      {showUpgrade && (
        <UpgradeModalWrapper 
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          currentTier={tier}
          highlightTier={isFree ? 'pro' : 'elite'}
        />
      )}
    </div>
  );
}

// Wrapper component for UpgradeModal to handle dynamic import
function UpgradeModalWrapper(props: { isOpen: boolean; onClose: () => void; currentTier: 'free' | 'pro' | 'elite'; highlightTier?: 'pro' | 'elite' }) {
  const [UpgradeModal, setUpgradeModal] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    import('@/components/UpgradeModal').then(mod => setUpgradeModal(() => mod.default));
  }, []);
  
  if (!UpgradeModal) return null;
  return <UpgradeModal {...props} />;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { isPro, isElite } = useTier();
  const { data: status } = useBotStatus();
  const { data: config, isLoading: configLoading } = useBotConfig();

  // Mutations
  // State for settings tabs - default to URL param or 'general'
  const initialTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState(initialTab);

  const updateBotStatus = useUpdateBotStatus();
  const updateConfig = useUpdateBotConfig();

  const TABS = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'strategies', label: 'Strategies', icon: Target },
    { id: 'risk', label: 'Risk & Safety', icon: Shield },
    { id: 'platforms', label: 'Platforms', icon: Database },
    { id: 'simulation', label: 'Simulation', icon: Activity },
  ] as const;

  // Local state for settings
  const [botEnabled, setBotEnabled] = useState(status?.is_running ?? false);
  const [polymarketEnabled, setPolymarketEnabled] = useState(config?.polymarket_enabled ?? true);
  const [kalshiEnabled, setKalshiEnabled] = useState(config?.kalshi_enabled ?? true);
  const [dryRunMode, setDryRunMode] = useState(status?.dry_run_mode ?? true);
  const [requireApproval, setRequireApproval] = useState(false); // Will be stored in localStorage until DB column is added

  // Basic trading parameters
  const [minProfitPercent, setMinProfitPercent] = useState(config?.min_profit_percent ?? 1.0);
  const [maxTradeSize, setMaxTradeSize] = useState(config?.max_trade_size ?? 100);
  const [maxDailyLoss, setMaxDailyLoss] = useState(config?.max_daily_loss ?? 50);
  const [scanInterval, setScanInterval] = useState(config?.scan_interval ?? 2);

  // REALISTIC PAPER TRADING PARAMETERS
  // Spread constraints - v1.1.13: Raised max spread to 25% (was 12%)
  const [maxRealisticSpreadPct, setMaxRealisticSpreadPct] = useState(config?.max_realistic_spread_pct ?? 25.0);
  // NOTE: minProfitThresholdPct is DEPRECATED - use strategy-specific thresholds instead
  const [minProfitThresholdPct, setMinProfitThresholdPct] = useState(config?.min_profit_threshold_pct ?? 0.3);

  // Execution simulation
  // Execution simulation - v1.1.14: Reduced rates for prediction markets
  const [slippageMinPct, setSlippageMinPct] = useState(config?.slippage_min_pct ?? 0.3);
  const [slippageMaxPct, setSlippageMaxPct] = useState(config?.slippage_max_pct ?? 1.0);
  const [spreadCostPct, setSpreadCostPct] = useState(config?.spread_cost_pct ?? 0.5);
  const [executionFailureRate, setExecutionFailureRate] = useState(config?.execution_failure_rate ?? 0.15);
  const [partialFillChance, setPartialFillChance] = useState(config?.partial_fill_chance ?? 0.15);
  const [partialFillMinPct, setPartialFillMinPct] = useState(config?.partial_fill_min_pct ?? 0.70);

  // Market resolution risk - v1.1.14: Reduced for true arbitrage (was too aggressive)
  // Note: Single-platform arb now uses separate SINGLE_PLATFORM_LOSS_RATE=3% (not configurable via UI)
  const [resolutionLossRate, setResolutionLossRate] = useState(config?.resolution_loss_rate ?? 0.12);
  const [lossSeverityMin, setLossSeverityMin] = useState(config?.loss_severity_min ?? 0.03);
  const [lossSeverityMax, setLossSeverityMax] = useState(config?.loss_severity_max ?? 0.15);
  // DEBUG: Track last save error
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

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
  // Overlapping Arb: same-platform correlated markets (inverted skip toggle)
  const [enableOverlappingArb, setEnableOverlappingArb] = useState(!(config?.skip_same_platform_overlap ?? true));

  // Polymarket Single settings (PhD Research Optimized - Saguillo 2025)
  // Research: $40M extracted at 0.3-2% margins, 0% fees = aggressive thresholds
  // v1.1.13: Max spread raised to 30% (was 12%) to capture high-profit opportunities
  const [polySingleMinProfit, setPolySingleMinProfit] = useState(config?.poly_single_min_profit_pct ?? 0.3);
  const [polySingleMaxSpread, setPolySingleMaxSpread] = useState(config?.poly_single_max_spread_pct ?? 30.0);
  const [polySingleMaxPos, setPolySingleMaxPos] = useState(config?.poly_single_max_position_usd ?? 100.0);
  const [polySingleScanInt, setPolySingleScanInt] = useState(config?.poly_single_scan_interval_sec ?? 30);

  // Kalshi Single settings (Fee-Adjusted: 7% fees = need 8%+ gross profit)
  // v1.1.13: Max spread raised to 30% (was 15%) to capture high-profit opportunities
  const [kalshiSingleMinProfit, setKalshiSingleMinProfit] = useState(config?.kalshi_single_min_profit_pct ?? 8.0);
  const [kalshiSingleMaxSpread, setKalshiSingleMaxSpread] = useState(config?.kalshi_single_max_spread_pct ?? 30.0);
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
  const [newsKeywords, setNewsKeywords] = useState(config?.news_keywords ?? 'fed,fomc,powell,rate cut,rate hike,inflation,cpi,ppi,jobs report,unemployment,nonfarm,gdp,recession,tariff,sanctions,iran,israel,ukraine,russia,china,taiwan,north korea,missile,nuclear,war,ceasefire,invasion,bitcoin,btc,eth,ethereum,crypto,sec,gensler,etf approval,halving,binance,coinbase,tether,stablecoin,trump,biden,harris,vance,impeach,pardon,executive order,indictment,verdict,guilty,acquit,trial,scotus,supreme court,roe,abortion,gun,shooting,fbi,doj,subpoena,elon,musk,tesla,spacex,openai,gpt,ai,nvidia,apple,google,meta,amazon,microsoft,earnings,guidance,layoffs,merger,acquisition,ipo,bankruptcy,default,downgrade,upgrade');

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

  // 15-Min Crypto Scalping (90% confidence - 100-500%+ APY - HIGH RISK)
  const [enable15MinCryptoScalping, setEnable15MinCryptoScalping] = useState(config?.enable_15min_crypto_scalping ?? true);
  const [scalp15MinEntryThreshold, setScalp15MinEntryThreshold] = useState(config?.scalp_15min_entry_threshold ?? 0.45);
  const [scalp15MinMaxPositionUsd, setScalp15MinMaxPositionUsd] = useState(config?.scalp_15min_max_position_usd ?? 50.0);
  const [scalp15MinMinPositionUsd, setScalp15MinMinPositionUsd] = useState(config?.scalp_15min_min_position_usd ?? 10.0);
  const [scalp15MinScanIntervalSec, setScalp15MinScanIntervalSec] = useState(config?.scalp_15min_scan_interval_sec ?? 2);
  const [scalp15MinUseKellySizing, setScalp15MinUseKellySizing] = useState(config?.scalp_15min_use_kelly ?? true);
  const [scalp15MinKellyFraction, setScalp15MinKellyFraction] = useState(config?.scalp_15min_kelly_fraction ?? 0.25);
  const [scalp15MinMaxConcurrentTrades, setScalp15MinMaxConcurrentTrades] = useState(config?.scalp_15min_max_concurrent ?? 5);

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

  // Autonomous RSI Optimization (Pro feature - auto-adjusts RSI thresholds)
  const [enableAutonomousRsi, setEnableAutonomousRsi] = useState(config?.autonomous_rsi_enabled ?? false);
  const [autonomousRsiMinTrades, setAutonomousRsiMinTrades] = useState(config?.autonomous_rsi_min_trades ?? 20);
  const [autonomousRsiAdjustmentPct, setAutonomousRsiAdjustmentPct] = useState(config?.autonomous_rsi_adjustment_pct ?? 5.0);
  const [autonomousRsiLearningRate, setAutonomousRsiLearningRate] = useState(config?.autonomous_rsi_learning_rate ?? 0.1);

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

  // Congressional Tracker (70% confidence - 15-40% APY)
  // Copy trades made by members of Congress using STOCK Act disclosures
  const [enableCongressionalTracker, setEnableCongressionalTracker] = useState(config?.enable_congressional_tracker ?? false);
  const [congressChambers, setCongressChambers] = useState<string>(config?.congress_chambers ?? 'both'); // house, senate, both
  const [congressParties, setCongressParties] = useState<string>(config?.congress_parties ?? 'any'); // D, R, I, any
  const [congressCopyScalePct, setCongressCopyScalePct] = useState(config?.congress_copy_scale_pct ?? 10);
  const [congressMaxPositionUsd, setCongressMaxPositionUsd] = useState(config?.congress_max_position_usd ?? 500);
  const [congressMinTradeAmountUsd, setCongressMinTradeAmountUsd] = useState(config?.congress_min_trade_amount_usd ?? 15000);
  const [congressDelayHours, setCongressDelayHours] = useState(config?.congress_delay_hours ?? 0);
  const [congressScanIntervalHours, setCongressScanIntervalHours] = useState(config?.congress_scan_interval_hours ?? 6);
  const [congressTrackedPoliticians, setCongressTrackedPoliticians] = useState<string>(config?.congress_tracked_politicians ?? 'Nancy Pelosi,Tommy Tuberville,Dan Crenshaw');

  // =========================================================================
  // NEW HIGH-CONFIDENCE STRATEGIES (85% and 80%)
  // =========================================================================

  // High Conviction Strategy (85% confidence - 40-80% APY)
  const [enableHighConvictionStrategy, setEnableHighConvictionStrategy] = useState(config?.enable_high_conviction_strategy ?? false);
  const [highConvictionMinScore, setHighConvictionMinScore] = useState(config?.high_conviction_min_score ?? 80);
  const [highConvictionMaxPositions, setHighConvictionMaxPositions] = useState(config?.high_conviction_max_positions ?? 3);
  const [highConvictionMinSignals, setHighConvictionMinSignals] = useState(config?.high_conviction_min_signals ?? 3);
  const [highConvictionPositionPct, setHighConvictionPositionPct] = useState(config?.high_conviction_position_pct ?? 15.0);
  const [highConvictionUseKelly, setHighConvictionUseKelly] = useState(config?.high_conviction_use_kelly ?? true);
  const [highConvictionKellyFraction, setHighConvictionKellyFraction] = useState(config?.high_conviction_kelly_fraction ?? 0.25);
  const [highConvictionMinVolume, setHighConvictionMinVolume] = useState(config?.high_conviction_min_volume ?? 50000);
  const [highConvictionMaxPosition, setHighConvictionMaxPosition] = useState(config?.high_conviction_max_position_usd ?? 250);
  const [highConvictionScanInterval, setHighConvictionScanInterval] = useState(config?.high_conviction_scan_interval_sec ?? 120);

  // Political Event Strategy (80% confidence - 30-60% APY)
  const [enablePoliticalEventStrategy, setEnablePoliticalEventStrategy] = useState(config?.enable_political_event_strategy ?? false);
  const [politicalMinConvictionScore, setPoliticalMinConvictionScore] = useState(config?.political_min_conviction_score ?? 0.75);
  const [politicalMaxPositionUsd, setPoliticalMaxPositionUsd] = useState(config?.political_max_position_usd ?? 500);
  const [politicalMaxConcurrentEvents, setPoliticalMaxConcurrentEvents] = useState(config?.political_max_concurrent_events ?? 5);
  const [politicalEventCategories, setPoliticalEventCategories] = useState<string>(config?.political_event_categories ?? 'elections,legislation,policy,appointments');
  const [politicalLeadTimeHours, setPoliticalLeadTimeHours] = useState(config?.political_lead_time_hours ?? 48);
  const [politicalExitBufferHours, setPoliticalExitBufferHours] = useState(config?.political_exit_buffer_hours ?? 2);
  const [politicalEventMinEdge, setPoliticalEventMinEdge] = useState(config?.political_event_min_edge_pct ?? 5);
  const [politicalEventMaxPosition, setPoliticalEventMaxPosition] = useState(config?.political_event_max_position_usd ?? 200);
  const [politicalEventMonitorInterval, setPoliticalEventMonitorInterval] = useState(config?.political_event_monitor_interval_sec ?? 300);

  // Selective Whale Copy Strategy (80% confidence - 35-70% APY)
  const [enableSelectiveWhaleCopy, setEnableSelectiveWhaleCopy] = useState(config?.enable_selective_whale_copy ?? false);
  const [selectiveWhaleMinWinRate, setSelectiveWhaleMinWinRate] = useState(config?.selective_whale_min_win_rate ?? 65);
  const [selectiveWhaleMinRoi, setSelectiveWhaleMinRoi] = useState(config?.selective_whale_min_roi ?? 0.20);
  const [selectiveWhaleMinTrades, setSelectiveWhaleMinTrades] = useState(config?.selective_whale_min_trades ?? 10);
  const [selectiveWhaleMaxTracked, setSelectiveWhaleMaxTracked] = useState(config?.selective_whale_max_tracked ?? 10);
  const [selectiveWhaleAutoSelect, setSelectiveWhaleAutoSelect] = useState(config?.selective_whale_auto_select ?? true);
  const [selectiveWhaleCopyScalePct, setSelectiveWhaleCopyScalePct] = useState(config?.selective_whale_copy_scale_pct ?? 5.0);
  const [selectiveWhaleMaxPositionUsd, setSelectiveWhaleMaxPositionUsd] = useState(config?.selective_whale_max_position_usd ?? 200);
  const [selectiveWhaleMinPnl, setSelectiveWhaleMinPnl] = useState(config?.selective_whale_min_pnl ?? 5000);
  const [selectiveWhaleMaxCopySize, setSelectiveWhaleMaxCopySize] = useState(config?.selective_whale_max_copy_size_usd ?? 100);
  const [selectiveWhaleDelaySeconds, setSelectiveWhaleDelaySeconds] = useState(config?.selective_whale_delay_seconds ?? 30);

  // Spike Hunter Strategy (85% confidence - $5K-100K/month)
  // Mean-reversion on rapid price spikes (2%+ in <30 seconds)
  const [enableSpikeHunter, setEnableSpikeHunter] = useState(config?.enable_spike_hunter ?? true);
  const [spikeMinMagnitudePct, setSpikeMinMagnitudePct] = useState(config?.spike_min_magnitude_pct ?? 2.0);
  const [spikeMaxDurationSec, setSpikeMaxDurationSec] = useState(config?.spike_max_duration_sec ?? 30);
  const [spikeTakeProfitPct, setSpikeTakeProfitPct] = useState(config?.spike_take_profit_pct ?? 1.5);
  const [spikeStopLossPct, setSpikeStopLossPct] = useState(config?.spike_stop_loss_pct ?? 3.0);
  const [spikeMaxHoldSec, setSpikeMaxHoldSec] = useState(config?.spike_max_hold_sec ?? 300);
  const [spikeMaxPositionUsd, setSpikeMaxPositionUsd] = useState(config?.spike_max_position_usd ?? 50);
  const [spikeMaxConcurrent, setSpikeMaxConcurrent] = useState(config?.spike_max_concurrent ?? 3);

  // UI state for new strategy sections
  const [showNewHighConfidenceStrategies, setShowNewHighConfidenceStrategies] = useState(false);

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
  const [ibkrStartingBalance, setIbkrStartingBalance] = useState(config?.ibkr_starting_balance ?? 20000);
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
      // Overlapping Arb (inverted skip toggle)
      if (config.skip_same_platform_overlap !== undefined) setEnableOverlappingArb(!config.skip_same_platform_overlap);
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

      // 15-Min Crypto Scalping
      if (config.enable_15min_crypto_scalping !== undefined) setEnable15MinCryptoScalping(config.enable_15min_crypto_scalping);
      if (config.scalp_15min_entry_threshold !== undefined) setScalp15MinEntryThreshold(config.scalp_15min_entry_threshold);
      if (config.scalp_15min_max_position_usd !== undefined) setScalp15MinMaxPositionUsd(config.scalp_15min_max_position_usd);
      if (config.scalp_15min_min_position_usd !== undefined) setScalp15MinMinPositionUsd(config.scalp_15min_min_position_usd);
      if (config.scalp_15min_scan_interval_sec !== undefined) setScalp15MinScanIntervalSec(config.scalp_15min_scan_interval_sec);
      if (config.scalp_15min_use_kelly !== undefined) setScalp15MinUseKellySizing(config.scalp_15min_use_kelly);
      if (config.scalp_15min_kelly_fraction !== undefined) setScalp15MinKellyFraction(config.scalp_15min_kelly_fraction);
      if (config.scalp_15min_max_concurrent !== undefined) setScalp15MinMaxConcurrentTrades(config.scalp_15min_max_concurrent);

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

      // Autonomous RSI (Pro feature)
      if (config.autonomous_rsi_enabled !== undefined) setEnableAutonomousRsi(config.autonomous_rsi_enabled);
      if (config.autonomous_rsi_min_trades !== undefined) setAutonomousRsiMinTrades(config.autonomous_rsi_min_trades);
      if (config.autonomous_rsi_adjustment_pct !== undefined) setAutonomousRsiAdjustmentPct(config.autonomous_rsi_adjustment_pct);
      if (config.autonomous_rsi_learning_rate !== undefined) setAutonomousRsiLearningRate(config.autonomous_rsi_learning_rate);

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

      // Congressional Tracker
      if (config.enable_congressional_tracker !== undefined) setEnableCongressionalTracker(config.enable_congressional_tracker);
      if (config.congress_chambers !== undefined) setCongressChambers(config.congress_chambers);
      if (config.congress_parties !== undefined) setCongressParties(config.congress_parties);
      if (config.congress_copy_scale_pct !== undefined) setCongressCopyScalePct(config.congress_copy_scale_pct);
      if (config.congress_max_position_usd !== undefined) setCongressMaxPositionUsd(config.congress_max_position_usd);
      if (config.congress_min_trade_amount_usd !== undefined) setCongressMinTradeAmountUsd(config.congress_min_trade_amount_usd);
      if (config.congress_delay_hours !== undefined) setCongressDelayHours(config.congress_delay_hours);
      if (config.congress_scan_interval_hours !== undefined) setCongressScanIntervalHours(config.congress_scan_interval_hours);
      if (config.congress_tracked_politicians !== undefined) setCongressTrackedPoliticians(config.congress_tracked_politicians);

      // High Conviction Strategy (85% confidence)
      if (config.enable_high_conviction_strategy !== undefined) setEnableHighConvictionStrategy(config.enable_high_conviction_strategy);
      if (config.high_conviction_min_score !== undefined) setHighConvictionMinScore(config.high_conviction_min_score);
      if (config.high_conviction_min_volume !== undefined) setHighConvictionMinVolume(config.high_conviction_min_volume);
      if (config.high_conviction_max_position_usd !== undefined) setHighConvictionMaxPosition(config.high_conviction_max_position_usd);
      if (config.high_conviction_scan_interval_sec !== undefined) setHighConvictionScanInterval(config.high_conviction_scan_interval_sec);

      // Political Event Strategy (80% confidence)
      if (config.enable_political_event_strategy !== undefined) setEnablePoliticalEventStrategy(config.enable_political_event_strategy);
      if (config.political_event_categories !== undefined) setPoliticalEventCategories(config.political_event_categories);
      if (config.political_event_min_edge_pct !== undefined) setPoliticalEventMinEdge(config.political_event_min_edge_pct);
      if (config.political_event_max_position_usd !== undefined) setPoliticalEventMaxPosition(config.political_event_max_position_usd);
      if (config.political_event_monitor_interval_sec !== undefined) setPoliticalEventMonitorInterval(config.political_event_monitor_interval_sec);

      // Selective Whale Copy (80% confidence)
      if (config.enable_selective_whale_copy !== undefined) setEnableSelectiveWhaleCopy(config.enable_selective_whale_copy);
      if (config.selective_whale_min_win_rate !== undefined) setSelectiveWhaleMinWinRate(config.selective_whale_min_win_rate);
      if (config.selective_whale_min_pnl !== undefined) setSelectiveWhaleMinPnl(config.selective_whale_min_pnl);
      if (config.selective_whale_max_copy_size_usd !== undefined) setSelectiveWhaleMaxCopySize(config.selective_whale_max_copy_size_usd);
      if (config.selective_whale_delay_seconds !== undefined) setSelectiveWhaleDelaySeconds(config.selective_whale_delay_seconds);

      // Spike Hunter Strategy (85% confidence)
      if (config.enable_spike_hunter !== undefined) setEnableSpikeHunter(config.enable_spike_hunter);
      if (config.spike_min_magnitude_pct !== undefined) setSpikeMinMagnitudePct(config.spike_min_magnitude_pct);
      if (config.spike_max_duration_sec !== undefined) setSpikeMaxDurationSec(config.spike_max_duration_sec);
      if (config.spike_take_profit_pct !== undefined) setSpikeTakeProfitPct(config.spike_take_profit_pct);
      if (config.spike_stop_loss_pct !== undefined) setSpikeStopLossPct(config.spike_stop_loss_pct);
      if (config.spike_max_hold_sec !== undefined) setSpikeMaxHoldSec(config.spike_max_hold_sec);
      if (config.spike_max_position_usd !== undefined) setSpikeMaxPositionUsd(config.spike_max_position_usd);
      if (config.spike_max_concurrent !== undefined) setSpikeMaxConcurrent(config.spike_max_concurrent);

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
      if (config.ibkr_starting_balance !== undefined) setIbkrStartingBalance(config.ibkr_starting_balance);

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

  // Update local state when remote state defaults change (initial load)
  useEffect(() => {
    if (status?.dry_run_mode !== undefined) {
      setDryRunMode(status.dry_run_mode);
    }
    if (status?.is_running !== undefined) {
      setBotEnabled(status.is_running);
    }
  }, [status]);

  const handleToggleBot = () => {
    // Optimistic update
    const newState = !botEnabled;
    setBotEnabled(newState);

    // Call API
    updateBotStatus.mutate({
      is_running: newState
    });
  };

  const handleToggleSimulation = () => {
    // Optimistic update
    const newState = !dryRunMode;
    setDryRunMode(newState);

    // Call API
    updateBotStatus.mutate({
      mode: newState ? 'simulation' : 'live'
    });
  };

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



  // State for save feedback
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Calculate hasChanges to enable save button
  const hasChanges = useMemo(() => {
    if (!config || !status) return false;

    // Check main toggles
    if (botEnabled !== status.is_running) return true;
    if (dryRunMode !== status.dry_run_mode) return true;
    if (requireApproval !== (status.require_approval ?? false)) return true;

    // Check platform toggles
    if (polymarketEnabled !== (config.polymarket_enabled ?? true)) return true;
    if (kalshiEnabled !== (config.kalshi_enabled ?? true)) return true;
    if (enableBinance !== (config.enable_binance ?? false)) return true;
    if (enableCoinbase !== (config.enable_coinbase ?? false)) return true;
    if (enableAlpaca !== (config.enable_alpaca ?? false)) return true;
    if (enableIbkr !== (config.enable_ibkr ?? false)) return true;

    // Check trading params
    if (minProfitPercent !== (config.min_profit_percent ?? 1.0)) return true;
    if (maxTradeSize !== (config.max_trade_size ?? 100)) return true;
    if (maxDailyLoss !== (config.max_daily_loss ?? 50)) return true;
    if (scanInterval !== (config.scan_interval ?? 2)) return true;

    // Check balances
    if (polymarketStartingBalance !== (config.polymarket_starting_balance ?? 20000)) return true;
    if (kalshiStartingBalance !== (config.kalshi_starting_balance ?? 20000)) return true;
    if (binanceStartingBalance !== (config.binance_starting_balance ?? 20000)) return true;
    if (coinbaseStartingBalance !== (config.coinbase_starting_balance ?? 20000)) return true;
    if (alpacaStartingBalance !== (config.alpaca_starting_balance ?? 20000)) return true;
    if (ibkrStartingBalance !== (config.ibkr_starting_balance ?? 20000)) return true;

    return false;
  }, [
    config, status,
    botEnabled, dryRunMode, requireApproval,
    polymarketEnabled, kalshiEnabled, enableBinance, enableCoinbase, enableAlpaca, enableIbkr,
    minProfitPercent, maxTradeSize, maxDailyLoss, scanInterval,
    polymarketStartingBalance, kalshiStartingBalance, binanceStartingBalance,
    coinbaseStartingBalance, alpacaStartingBalance, ibkrStartingBalance
  ]);

  const handleSaveSettings = async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    setLastSaveError(null);

    try {
      console.log('Starting save operation... Payload construction beginning.');

      // 1. Update Bot Status (toggles)
      await updateBotStatus.mutateAsync({
        is_running: botEnabled,
        dry_run_mode: dryRunMode,
        require_approval: requireApproval
      });

      // 2. Update Config (all other fields)
      await updateConfig.mutateAsync({
        polymarket_enabled: polymarketEnabled,
        kalshi_enabled: kalshiEnabled,
        enable_binance: enableBinance,
        enable_coinbase: enableCoinbase,
        enable_alpaca: enableAlpaca,
        enable_ibkr: enableIbkr,

        min_profit_percent: minProfitPercent,
        max_trade_size: maxTradeSize,
        max_daily_loss: maxDailyLoss,
        scan_interval: scanInterval,

        polymarket_starting_balance: polymarketStartingBalance,
        kalshi_starting_balance: kalshiStartingBalance,
        binance_starting_balance: binanceStartingBalance,
        coinbase_starting_balance: coinbaseStartingBalance,
        alpaca_starting_balance: alpacaStartingBalance,
        ibkr_starting_balance: ibkrStartingBalance,

        // Strategy params
        poly_single_min_profit_pct: polySingleMinProfit,
        kalshi_single_min_profit_pct: kalshiSingleMinProfit,
        enable_polymarket_single_arb: enablePolySingleArb,
        enable_kalshi_single_arb: enableKalshiSingleArb,
        enable_cross_platform_arb: enableCrossPlatArb,
        skip_same_platform_overlap: !enableOverlappingArb,

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

        // 15-Min Crypto Scalping
        enable_15min_crypto_scalping: enable15MinCryptoScalping,
        scalp_15min_entry_threshold: scalp15MinEntryThreshold,
        scalp_15min_max_position_usd: scalp15MinMaxPositionUsd,
        scalp_15min_min_position_usd: scalp15MinMinPositionUsd,
        scalp_15min_scan_interval_sec: scalp15MinScanIntervalSec,
        scalp_15min_use_kelly: scalp15MinUseKellySizing,
        scalp_15min_kelly_fraction: scalp15MinKellyFraction,
        scalp_15min_max_concurrent: scalp15MinMaxConcurrentTrades,

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
        stock_mr_rsi_oversold: meanRevRsiOversold,
        stock_mr_rsi_overbought: meanRevRsiOverbought,
        stock_mr_position_size_usd: meanRevPositionSizeUsd,
        stock_mr_max_positions: meanRevMaxPositions,
        stock_mr_stop_loss_pct: meanRevStopLossPct,
        stock_mr_take_profit_pct: meanRevTakeProfitPct,

        // Autonomous RSI (Pro feature)
        autonomous_rsi_enabled: enableAutonomousRsi,
        autonomous_rsi_min_trades: autonomousRsiMinTrades,
        autonomous_rsi_adjustment_pct: autonomousRsiAdjustmentPct,
        autonomous_rsi_learning_rate: autonomousRsiLearningRate,

        enable_stock_momentum: enableStockMomentum,
        stock_momentum_lookback_days: momentumLookbackDays,
        stock_momentum_min_score: momentumMinScore,
        stock_mom_position_size_usd: momentumPositionSizeUsd,
        stock_mom_max_positions: momentumMaxPositions,
        stock_momentum_trailing_stop_pct: momentumTrailingStopPct,

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

        // Twitter Strategies
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

        // Congressional Tracker
        enable_congressional_tracker: enableCongressionalTracker,
        congress_chambers: congressChambers,
        congress_parties: congressParties,
        congress_copy_scale_pct: congressCopyScalePct,
        congress_max_position_usd: congressMaxPositionUsd,
        congress_min_trade_amount_usd: congressMinTradeAmountUsd,
        congress_delay_hours: congressDelayHours,
        congress_scan_interval_hours: congressScanIntervalHours,
        congress_tracked_politicians: congressTrackedPoliticians,

        // High Conviction
        enable_high_conviction_strategy: enableHighConvictionStrategy,
        high_conviction_min_score: highConvictionMinScore,
        high_conviction_min_volume: highConvictionMinVolume,
        high_conviction_max_position_usd: highConvictionMaxPosition,
        high_conviction_scan_interval_sec: highConvictionScanInterval,

        // Political Event
        enable_political_event_strategy: enablePoliticalEventStrategy,
        political_event_categories: politicalEventCategories,
        political_event_min_edge_pct: politicalEventMinEdge,
        political_event_max_position_usd: politicalEventMaxPosition,
        political_event_monitor_interval_sec: politicalEventMonitorInterval,

        // Selective Whale
        enable_selective_whale_copy: enableSelectiveWhaleCopy,
        selective_whale_min_win_rate: selectiveWhaleMinWinRate,
        selective_whale_min_pnl: selectiveWhaleMinPnl,
        selective_whale_max_copy_size_usd: selectiveWhaleMaxCopySize,
        selective_whale_delay_seconds: selectiveWhaleDelaySeconds,

        // Spike Hunter Strategy
        enable_spike_hunter: enableSpikeHunter,
        spike_min_magnitude_pct: spikeMinMagnitudePct,
        spike_max_duration_sec: spikeMaxDurationSec,
        spike_take_profit_pct: spikeTakeProfitPct,
        spike_stop_loss_pct: spikeStopLossPct,
        spike_max_hold_sec: spikeMaxHoldSec,
        spike_max_position_usd: spikeMaxPositionUsd,
        spike_max_concurrent: spikeMaxConcurrent,

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

        // Simulation Params
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
        min_position_usd: minPositionUsd
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Force refresh of data
      await Promise.all([
        updateBotStatus.reset(),
        updateConfig.reset()
      ]);
    } catch (error) {
      console.error('Failed to save settings:', error);
      const msg = error instanceof Error ? error.message : 'Failed to save settings. Please try again.';
      setSaveError(msg);
      setLastSaveError(msg);
      // Alert the user visibly to the error
      window.alert(`SAVE FAILED (Debug Mode):\n\n${msg}\n\nCheck console for full payload details.`);
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Read-Only Mode Banner */}
      {!isAdmin && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
          <Lock className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="font-semibold text-yellow-500">Read-Only Mode</p>
            <p className="text-sm text-yellow-500/70">You can view settings but cannot make changes. Contact an admin to modify settings.</p>
          </div>
        </div>
      )}

      {/* Header & Save Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8 text-neon-blue" />
            Settings
          </h1>
          <p className="text-gray-400 mt-2">Configure your autonomous trading bot</p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={updateBotStatus.isPending || updateConfig.isPending}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all",
            "bg-neon-blue hover:bg-neon-blue/80 text-white shadow-neon-blue/20"
          )}
        >
          {updateBotStatus.isPending || updateConfig.isPending ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {updateBotStatus.isPending || updateConfig.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide border-b border-dark-border/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-t-xl font-medium transition-all whitespace-nowrap border-b-2",
                isActive
                  ? "border-neon-blue text-neon-blue bg-neon-blue/5"
                  : "border-transparent text-gray-400 hover:text-white hover:bg-dark-border/30"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[500px]">
        {/* ================= GENERAL TAB ================= */}
        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Master Controls */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Power className="w-5 h-5 text-neon-green" />
                Master Controls
              </h2>
              <div className="grid gap-6">
                <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      botEnabled ? "bg-neon-green/20" : "bg-red-500/20"
                    )}>
                      <Power className={cn("w-6 h-6", botEnabled ? "text-neon-green" : "text-red-500")} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Bot Status</h3>
                      <p className="text-sm text-gray-400">
                        {botEnabled
                          ? 'System is ONLINE and scanning for opportunities'
                          : 'System is OFFLINE. No trades will be taken.'}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch enabled={botEnabled} onToggle={handleBotToggle} size="lg" disabled={!isAdmin} />
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Live Trading Mode</h3>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                          dryRunMode ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-500"
                        )}>
                          {dryRunMode ? 'PAPER' : 'LIVE'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {dryRunMode
                          ? 'Safe mode. No real money used.'
                          : 'Real money is at risk.'}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    enabled={!dryRunMode}
                    onToggle={() => dryRunMode ? setShowConfirm('live-trading') : setDryRunMode(true)}
                    size="lg"
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </div>

            {/* Subscription Section */}
            <SubscriptionSection />

            {/* Autonomous RSI Section (Pro/Elite only) */}
            {(isPro || isElite) && (
              <div className="card mt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      Autonomous RSI Optimization
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                        AI-Powered
                      </span>
                    </h3>
                    <p className="text-sm text-gray-400">
                      Automatically adjusts RSI thresholds based on market performance
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-border/30 rounded-xl">
                    <div>
                      <h4 className="font-medium">Enable Autonomous RSI</h4>
                      <p className="text-sm text-gray-500">
                        Let AI optimize your RSI oversold/overbought thresholds based on trade outcomes
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={enableAutonomousRsi}
                      onToggle={() => setEnableAutonomousRsi(!enableAutonomousRsi)}
                      disabled={!isAdmin}
                    />
                  </div>

                  {enableAutonomousRsi && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-dark-border/20 rounded-xl">
                      <div>
                        <label className="text-sm text-gray-400">Min Trades Before Adjusting</label>
                        <input
                          type="number"
                          value={autonomousRsiMinTrades}
                          onChange={(e) => setAutonomousRsiMinTrades(Number(e.target.value))}
                          className="w-full bg-dark-border rounded-lg p-2 mt-1"
                          placeholder="20"
                        />
                        <p className="text-xs text-gray-500 mt-1">Trades needed for reliable data</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Max Adjustment %</label>
                        <input
                          type="number"
                          step="0.5"
                          value={autonomousRsiAdjustmentPct}
                          onChange={(e) => setAutonomousRsiAdjustmentPct(Number(e.target.value))}
                          className="w-full bg-dark-border rounded-lg p-2 mt-1"
                          placeholder="5.0"
                        />
                        <p className="text-xs text-gray-500 mt-1">Max RSI change per cycle</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Learning Rate</label>
                        <input
                          type="number"
                          step="0.05"
                          value={autonomousRsiLearningRate}
                          onChange={(e) => setAutonomousRsiLearningRate(Number(e.target.value))}
                          className="w-full bg-dark-border rounded-lg p-2 mt-1"
                          placeholder="0.1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Adaptation speed (0-1)</p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                      <div className="text-sm text-purple-300">
                        <strong>How it works:</strong> After {autonomousRsiMinTrades} trades, the system analyzes win rates
                        at different RSI levels and gradually shifts thresholds toward more profitable zones.
                        Current RSI: Oversold ≤{meanRevRsiOversold}, Overbought ≥{meanRevRsiOverbought}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ================= STRATEGIES TAB ================= */}
        {activeTab === 'strategies' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="card"
          >
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-blue-400">Strategy Specific Configs</h3>
                <p className="text-sm text-blue-300">Fine-tune individual strategies (Whale Watcher, News Trading, etc.)</p>
              </div>
              <Link href="/strategies" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold">
                Configure Strategies &rarr;
              </Link>
            </div>
          </motion.div>
        )}

        {/* ================= RISK TAB ================= */}
        {activeTab === 'risk' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-neon-green" />
                Global Risk Parameters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <LabelWithTooltip label="Min Profit %" tooltip="Minimum profit required to execute a trade." />
                  <input type="number" step="0.1" value={minProfitPercent} onChange={e => setMinProfitPercent(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3 mt-1" />
                </div>
                <div>
                  <LabelWithTooltip label="Max Trade Size ($)" tooltip="Maximum capital per trade." />
                  <input type="number" value={maxTradeSize} onChange={e => setMaxTradeSize(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3 mt-1" />
                </div>
                <div>
                  <LabelWithTooltip label="Max Daily Loss (%)" tooltip="Stop trading if daily loss exceeds this %." />
                  <input type="number" value={maxDailyLoss} onChange={e => setMaxDailyLoss(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3 mt-1" />
                </div>
                <div>
                  <LabelWithTooltip label="Scan Interval (sec)" tooltip="How often to scan markets." />
                  <input type="number" value={scanInterval} onChange={e => setScanInterval(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3 mt-1" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= PLATFORMS TAB ================= */}
        {activeTab === 'platforms' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-neon-purple" />
                Exchange Connections
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Polymarket</span>
                  <ToggleSwitch enabled={polymarketEnabled} onToggle={() => setPolymarketEnabled(!polymarketEnabled)} />
                </div>
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Kalshi</span>
                  <ToggleSwitch enabled={kalshiEnabled} onToggle={() => setKalshiEnabled(!kalshiEnabled)} />
                </div>
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Binance</span>
                  <ToggleSwitch enabled={enableBinance} onToggle={() => setEnableBinance(!enableBinance)} />
                </div>
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Coinbase</span>
                  <ToggleSwitch enabled={enableCoinbase} onToggle={() => setEnableCoinbase(!enableCoinbase)} />
                </div>
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Alpaca (Stocks)</span>
                  <ToggleSwitch enabled={enableAlpaca} onToggle={() => setEnableAlpaca(!enableAlpaca)} />
                </div>
                <div className="flex justify-between items-center p-4 bg-dark-border/30 rounded-xl">
                  <span>Interactive Brokers</span>
                  <ToggleSwitch enabled={enableIbkr} onToggle={() => setEnableIbkr(!enableIbkr)} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= SIMULATION TAB ================= */}
        {activeTab === 'simulation' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-yellow-500" />
                Simulation Realism (Paper Trading Only)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <LabelWithTooltip label="Slippage Min %" tooltip="Minimum simulated slippage percentage." />
                  <input type="number" step="0.1" value={slippageMinPct} onChange={e => setSlippageMinPct(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3" />
                </div>
                <div>
                  <LabelWithTooltip label="Slippage Max %" tooltip="Maximum simulated slippage percentage." />
                  <input type="number" step="0.1" value={slippageMaxPct} onChange={e => setSlippageMaxPct(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3" />
                </div>
                <div>
                  <LabelWithTooltip label="Execution Failure Rate (0-1)" tooltip="Probability (0-1) that an order fails to execute." />
                  <input type="number" step="0.05" value={executionFailureRate} onChange={e => setExecutionFailureRate(Number(e.target.value))} className="w-full bg-dark-border rounded-lg p-3" />
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-dark-border">
                <h3 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h3>
                <button onClick={() => setShowConfirm('reset')} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg transition-colors flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Reset Simulation Data
                </button>
              </div>
            </div>

            {/* Starting Balances (Moved to Simulation) */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-neon-green" />
                Starting Balances (For P&L Calc)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Polymarket</label>
                  <input type="number" value={polymarketStartingBalance} onChange={e => setPolymarketStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Kalshi</label>
                  <input type="number" value={kalshiStartingBalance} onChange={e => setKalshiStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Binance</label>
                  <input type="number" value={binanceStartingBalance} onChange={e => setBinanceStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Coinbase</label>
                  <input type="number" value={coinbaseStartingBalance} onChange={e => setCoinbaseStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Alpaca</label>
                  <input type="number" value={alpacaStartingBalance} onChange={e => setAlpacaStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">IBKR</label>
                  <input type="number" value={ibkrStartingBalance} onChange={e => setIbkrStartingBalance(Number(e.target.value))} className="input-field w-full bg-dark-border/50 border-dark-border p-2 rounded-lg" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>

      {/* Modals (Live Trading Confirm, Bot Toggle Confirm, Reset Confirm) */}
      <AnimatePresence>
        {showConfirm === 'live-trading' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-red-500 mb-2">Enable Live Trading?</h3>
              <p className="text-gray-300 mb-6">Real money will be at risk. This cannot be undone automatically.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 rounded-xl bg-dark-border hover:bg-dark-border/80 font-bold">Cancel</button>
                <button onClick={() => { setDryRunMode(false); setShowConfirm(null); }} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">Enable Live</button>
              </div>
            </div>
          </div>
        )}
        {showConfirm === 'bot' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">Stop Bot?</h3>
              <p className="text-gray-300 mb-6">The bot will stop scanning and no new trades will be taken.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 rounded-xl bg-dark-border hover:bg-dark-border/80 font-bold">Cancel</button>
                <button onClick={() => { setBotEnabled(false); setShowConfirm(null); }} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">Stop Bot</button>
              </div>
            </div>
          </div>
        )}
        {showConfirm === 'reset' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-card border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-red-500 mb-2">Reset Simulation?</h3>
              <p className="text-gray-300 mb-6">This will delete ALL trade history and reset metrics. This action is irreversible.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 rounded-xl bg-dark-border hover:bg-dark-border/80 font-bold">Cancel</button>
                <button onClick={handleResetSimulation} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">Reset All</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div >
  );
}

