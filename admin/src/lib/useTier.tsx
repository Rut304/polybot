'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { 
  UserProfile, 
  SubscriptionTier, 
  TIER_LIMITS, 
  hasFeatureAccess,
  canTrade,
  isAdminEmail,
} from '@/lib/privy';

interface TierContextType {
  // User profile
  profile: UserProfile | null;
  isLoading: boolean;
  
  // Tier helpers
  tier: SubscriptionTier;
  isPro: boolean;
  isElite: boolean;
  isFree: boolean;
  isAdmin: boolean;
  
  // Feature access
  hasFeature: (feature: string) => boolean;
  canDoTrade: (isLive: boolean) => { allowed: boolean; reason?: string };
  
  // Trade limits
  tradesUsed: number;
  tradesLimit: number;
  tradesRemaining: number;
  
  // Trading mode
  isSimulation: boolean;
  setTradingMode: (isSimulation: boolean) => Promise<void>;
  
  // Refresh
  refreshProfile: () => Promise<void>;
}

const TierContext = createContext<TierContextType | undefined>(undefined);

export function TierProvider({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('polybot_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Profile not found, creating default profile for user:', userId);
        // Create default profile in database
        const defaultProfileData = {
          id: userId,
          email: '', // Will be updated on next auth sync
          subscription_tier: 'free',
          subscription_status: 'inactive',
          monthly_trades_used: 0,
          monthly_trades_limit: TIER_LIMITS.free.monthlyTrades,
          onboarding_completed: false,
          is_simulation: true, // Start in paper trading mode
          updated_at: new Date().toISOString(),
        };
        
        // Upsert to create profile if not exists
        const { error: upsertError } = await supabase
          .from('polybot_profiles')
          .upsert(defaultProfileData, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('Error creating profile:', upsertError);
        }

        // Also create default user config with 3 strategies enabled
        const defaultConfigData = {
          user_id: userId,
          dry_run: true, // Paper trading enabled by default
          is_simulation: true,
          // Enable 3 default strategies so trades start happening immediately
          enabled_strategies: ['single_platform_arb', 'cross_platform_arb', 'whale_copy_trading'],
          enable_single_platform_arb: true,
          enable_cross_platform_arb: true,
          enable_copy_trading: true,
          enable_polymarket: true,
          enable_kalshi: true,
          updated_at: new Date().toISOString(),
        };

        const { error: configError } = await supabase
          .from('polybot_user_config')
          .upsert(defaultConfigData, { onConflict: 'user_id' });

        if (configError) {
          console.error('Error creating user config:', configError);
        }
        
        const defaultProfile: UserProfile = {
          id: userId,
          email: '',
          subscriptionTier: 'free',
          subscriptionStatus: 'inactive',
          monthlyTradesUsed: 0,
          monthlyTradesLimit: TIER_LIMITS.free.monthlyTrades,
          onboardingCompleted: false,
          isSimulation: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      } else {
        setProfile({
          id: data.id,
          email: data.email || '',
          privyUserId: data.privy_user_id,
          walletAddress: data.wallet_address,
          subscriptionTier: (data.subscription_tier || 'free') as SubscriptionTier,
          subscriptionStatus: data.subscription_status || 'inactive',
          stripeCustomerId: data.stripe_customer_id,
          monthlyTradesUsed: data.monthly_trades_used || 0,
          monthlyTradesLimit: data.monthly_trades_limit || TIER_LIMITS.free.monthlyTrades,
          trialEndsAt: data.trial_ends_at,
          onboardingCompleted: data.onboarding_completed || false,
          isSimulation: data.is_simulation ?? true,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setTradingMode = async (isSimulation: boolean) => {
    if (!userId || !profile) return;

    // Can't switch to live on free tier
    if (!isSimulation && profile.subscriptionTier === 'free') {
      throw new Error('Upgrade to Pro for live trading');
    }

    try {
      const { error } = await supabase
        .from('polybot_profiles')
        .update({ 
          is_simulation: isSimulation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, isSimulation } : null);
    } catch (err) {
      console.error('Failed to update trading mode:', err);
      throw err;
    }
  };

  const tier = profile?.subscriptionTier || 'free';
  const isPro = tier === 'pro' || tier === 'elite';
  const isElite = tier === 'elite';
  const isFree = tier === 'free';
  const isAdmin = profile?.email ? isAdminEmail(profile.email) : false;

  const tradesUsed = profile?.monthlyTradesUsed || 0;
  const tradesLimit = profile?.monthlyTradesLimit || TIER_LIMITS[tier].monthlyTrades;
  const tradesRemaining = tradesLimit === -1 ? Infinity : Math.max(0, tradesLimit - tradesUsed);

  const value: TierContextType = {
    profile,
    isLoading,
    tier,
    isPro,
    isElite,
    isFree,
    isAdmin,
    hasFeature: (feature: string) => hasFeatureAccess(tier, feature),
    canDoTrade: (isLive: boolean) => canTrade(tier, tradesUsed, isLive),
    tradesUsed,
    tradesLimit,
    tradesRemaining,
    isSimulation: profile?.isSimulation ?? true,
    setTradingMode,
    refreshProfile: fetchProfile,
  };

  return (
    <TierContext.Provider value={value}>
      {children}
    </TierContext.Provider>
  );
}

// Default values for public pages (when not inside TierProvider)
const defaultTierContext: TierContextType = {
  profile: null,
  isLoading: false,
  tier: 'free' as SubscriptionTier,
  isPro: false,
  isElite: false,
  isFree: true,
  isAdmin: false,
  hasFeature: () => false,
  canDoTrade: () => ({ allowed: false, reason: 'Not authenticated' }),
  tradesUsed: 0,
  tradesLimit: 10,
  tradesRemaining: 10,
  isSimulation: true,
  setTradingMode: async () => {},
  refreshProfile: async () => {},
};

export function useTier() {
  const context = useContext(TierContext);
  // Return default context for public pages (don't throw)
  if (context === undefined) {
    return defaultTierContext;
  }
  return context;
}

// Hook for feature gating
export function useFeatureAccess(feature: string): {
  hasAccess: boolean;
  requiredTier: SubscriptionTier;
} {
  const { tier, hasFeature } = useTier();
  
  // Determine which tier is required for this feature
  const requiredTier: SubscriptionTier = 
    TIER_LIMITS.free.features.some(f => f.toLowerCase().includes(feature.toLowerCase())) ? 'free' :
    TIER_LIMITS.pro.features.some(f => f.toLowerCase().includes(feature.toLowerCase())) ? 'pro' :
    'elite';
  
  return {
    hasAccess: hasFeature(feature),
    requiredTier,
  };
}

// Wrapper component that gets userId from AuthContext
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <TierProvider userId={user?.id}>
      {children}
    </TierProvider>
  );
}
