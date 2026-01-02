/**
 * Subscription Tier Validation Utilities
 * Server-side tier checks for API routes
 */

import { SubscriptionTier } from '@/lib/privy';

// =============================================================================
// STRATEGY TIER REQUIREMENTS
// Defines which subscription tier is required for each strategy
// =============================================================================
type StrategyTier = 'free' | 'pro' | 'elite';

export const STRATEGY_TIER_REQUIREMENTS: Record<string, StrategyTier> = {
  // FREE TIER - Basic arbitrage and simple strategies
  enable_polymarket_single_arb: 'free',
  enable_kalshi_single_arb: 'free',
  enable_15min_crypto_scalping: 'free',  // NOTE: Markets no longer exist (Jan 2025)
  enable_news_arbitrage: 'free',
  enable_market_making: 'free',
  
  // PRO TIER - Cross-platform and advanced strategies
  enable_cross_platform_arb: 'pro',
  enable_ai_superforecasting: 'pro',
  enable_congressional_tracker: 'pro',
  enable_funding_rate_arb: 'pro',
  enable_grid_trading: 'pro',
  enable_stock_mean_reversion: 'pro',
  enable_stock_momentum: 'pro',
  enable_autonomous_rsi: 'pro',
  enable_rsi_trading: 'pro',
  
  // ELITE TIER - Premium and whale strategies
  enable_btc_bracket_arb: 'elite',
  enable_whale_copy_trading: 'elite',
  enable_copy_trading: 'elite',
  enable_fear_premium_contrarian: 'elite',
  enable_pairs_trading: 'elite',
  enable_bracket_compression: 'elite',
  enable_political_event: 'elite',
  enable_cross_exchange_arb: 'elite',
  enable_custom_strategy: 'elite',
};

// Strategies that are deprecated or have markets that no longer exist
export const DEPRECATED_STRATEGIES: Set<string> = new Set([
  'enable_15min_crypto_scalping',  // 15-min BTC/ETH markets no longer exist
]);

// =============================================================================
// FEATURE TIER REQUIREMENTS
// Defines which subscription tier is required for each feature
// =============================================================================
export const FEATURE_TIER_REQUIREMENTS: Record<string, StrategyTier> = {
  // FREE TIER
  simulation_trading: 'free',
  basic_analytics: 'free',
  discord_access: 'free',
  
  // PRO TIER
  live_trading: 'pro',
  advanced_analytics: 'pro',
  missed_money_analysis: 'pro',
  ai_insights: 'pro',
  email_support: 'pro',
  
  // ELITE TIER
  whale_tracker: 'elite',
  congress_tracker: 'elite',
  tax_reports: 'elite',
  custom_strategies: 'elite',
  api_access: 'elite',
  priority_support: 'elite',
};

// Helper to check if a tier meets the required tier
export function tierMeetsRequirement(userTier: SubscriptionTier, requiredTier: StrategyTier): boolean {
  const tierOrder: Record<string, number> = { free: 0, pro: 1, elite: 2 };
  return tierOrder[userTier] >= tierOrder[requiredTier];
}

// Get strategy tier mapping for frontend
export function getStrategyTierMap(): Record<string, StrategyTier> {
  return { ...STRATEGY_TIER_REQUIREMENTS };
}

// Check if user can access a specific feature
export function canAccessFeature(userTier: SubscriptionTier, feature: string): boolean {
  const requiredTier = FEATURE_TIER_REQUIREMENTS[feature];
  if (!requiredTier) return true; // Unknown feature = allow
  return tierMeetsRequirement(userTier, requiredTier);
}

// Check if user can enable a specific strategy
export function canEnableStrategy(userTier: SubscriptionTier, strategyKey: string): boolean {
  const requiredTier = STRATEGY_TIER_REQUIREMENTS[strategyKey];
  if (!requiredTier) return true; // Unknown strategy = allow
  return tierMeetsRequirement(userTier, requiredTier);
}

// Validate and filter strategy updates based on user's tier
export function validateStrategyUpdates(
  updates: Record<string, any>,
  userTier: SubscriptionTier
): { valid: Record<string, any>; blocked: string[] } {
  const valid: Record<string, any> = {};
  const blocked: string[] = [];
  
  for (const [key, value] of Object.entries(updates)) {
    // Check if this is a strategy enable key
    if (key.startsWith('enable_') && STRATEGY_TIER_REQUIREMENTS[key]) {
      const requiredTier = STRATEGY_TIER_REQUIREMENTS[key];
      
      // Only block if trying to ENABLE (value is true)
      if (value === true && !tierMeetsRequirement(userTier, requiredTier)) {
        blocked.push(`${key} requires ${requiredTier} tier`);
        continue;
      }
    }
    
    // Allow the update
    valid[key] = value;
  }
  
  return { valid, blocked };
}

// Get list of strategies available for a tier
export function getStrategiesForTier(tier: StrategyTier): string[] {
  return Object.entries(STRATEGY_TIER_REQUIREMENTS)
    .filter(([_, requiredTier]) => tierMeetsRequirement(tier, requiredTier))
    .map(([key]) => key);
}

// Get tier label for display
export function getTierLabel(tier: SubscriptionTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
