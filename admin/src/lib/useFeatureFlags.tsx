'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface FeatureFlag {
  id: number;
  flag_key: string;
  flag_name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  category: string;
}

interface UserOverride {
  id: number;
  user_id: string;
  flag_key: string;
  enabled: boolean;
  expires_at: string | null;
}

interface FeatureFlagsData {
  flags: FeatureFlag[];
  overrides: UserOverride[];
}

/**
 * Hook to check if a feature is enabled for the current user
 * Considers global flags, rollout percentages, and user-specific overrides
 */
export function useFeatureFlag(flagKey: string): {
  enabled: boolean;
  loading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  
  const { data, isLoading, error } = useQuery<FeatureFlagsData>({
    queryKey: ['feature-flags', user?.id],
    queryFn: async () => {
      const { data: flags, error: flagsError } = await supabase
        .from('polybot_feature_flags')
        .select('*');
      
      if (flagsError) throw flagsError;
      
      // Fetch user-specific overrides if logged in
      let overrides: UserOverride[] = [];
      if (user?.id) {
        const { data: userOverrides, error: overridesError } = await supabase
          .from('polybot_user_feature_overrides')
          .select('*')
          .eq('user_id', user.id);
        
        if (!overridesError && userOverrides) {
          overrides = userOverrides;
        }
      }
      
      return { flags: flags || [], overrides };
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: 1,
  });

  // Determine if the feature is enabled
  const enabled = (() => {
    if (!data?.flags) return false;
    
    const flag = data.flags.find(f => f.flag_key === flagKey);
    if (!flag) return false;
    
    // Check for user override first
    if (user?.id && data.overrides.length > 0) {
      const override = data.overrides.find(o => o.flag_key === flagKey);
      if (override) {
        // Check if override has expired
        if (override.expires_at && new Date(override.expires_at) < new Date()) {
          // Override expired, fall through to global check
        } else {
          return override.enabled;
        }
      }
    }
    
    // Check global flag
    if (!flag.enabled) return false;
    
    // Check rollout percentage
    if (flag.rollout_percentage < 100 && user?.id) {
      // Use a deterministic hash based on user ID for consistent rollout
      const hash = hashString(user.id);
      if ((hash % 100) >= flag.rollout_percentage) {
        return false;
      }
    }
    
    return true;
  })();

  return {
    enabled,
    loading: isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get all feature flags with their current state
 */
export function useAllFeatureFlags() {
  const { user } = useAuth();
  
  return useQuery<FeatureFlagsData>({
    queryKey: ['feature-flags', user?.id],
    queryFn: async () => {
      const { data: flags, error: flagsError } = await supabase
        .from('polybot_feature_flags')
        .select('*')
        .order('category', { ascending: true });
      
      if (flagsError) throw flagsError;
      
      let overrides: UserOverride[] = [];
      if (user?.id) {
        const { data: userOverrides } = await supabase
          .from('polybot_user_feature_overrides')
          .select('*')
          .eq('user_id', user.id);
        
        overrides = userOverrides || [];
      }
      
      return { flags: flags || [], overrides };
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Component wrapper that only renders children if feature is enabled
 */
export function FeatureEnabled({ 
  flagKey, 
  children, 
  fallback = null 
}: { 
  flagKey: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  const { enabled, loading } = useFeatureFlag(flagKey);
  
  if (loading) return null;
  if (!enabled) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component wrapper that only renders children if feature is disabled
 */
export function FeatureDisabled({ 
  flagKey, 
  children 
}: { 
  flagKey: string; 
  children: React.ReactNode; 
}) {
  const { enabled, loading } = useFeatureFlag(flagKey);
  
  if (loading) return null;
  if (enabled) return null;
  
  return <>{children}</>;
}

// Simple string hash function for consistent rollout
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Export feature flag keys as constants for type safety
export const FeatureFlags = {
  // System
  MAINTENANCE_MODE: 'maintenance_mode',
  NEW_SIGNUPS_ENABLED: 'new_signups_enabled',
  LIVE_TRADING_ENABLED: 'live_trading_enabled',
  
  // Trading
  CROSS_PLATFORM_ARB: 'cross_platform_arb',
  KALSHI_TRADING: 'kalshi_trading',
  POLYMARKET_TRADING: 'polymarket_trading',
  STOCK_TRADING: 'stock_trading',
  CRYPTO_TRADING: 'crypto_trading',
  
  // UI
  MISSED_OPPORTUNITIES: 'missed_opportunities',
  LEADERBOARD: 'leaderboard',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  STRATEGY_BUILDER: 'strategy_builder',
  
  // Beta
  AI_ASSISTANT: 'ai_assistant',
  SOCIAL_TRADING: 'social_trading',
  AUTO_REBALANCING: 'auto_rebalancing',
  CONGRESSIONAL_TRACKER: 'congressional_tracker',
} as const;

export type FeatureFlagKey = typeof FeatureFlags[keyof typeof FeatureFlags];
