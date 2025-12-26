/**
 * Privy Authentication Configuration
 * Ported from poly-parlay with modifications for Next.js
 * 
 * Features:
 * - Email OTP login
 * - SMS 2FA for admin accounts
 * - Embedded wallets for Polygon
 * - Non-custodial trade execution
 */

// Admin accounts requiring 2FA
export const ADMIN_EMAILS = ['rutrohd@gmail.com', 'admin@polyparlay.io'];

export const ADMIN_PHONE_NUMBERS: Record<string, string> = {
  'rutrohd@gmail.com': '+16178750001',
};

// Privy configuration
export const PRIVY_CONFIG = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  // Login methods enabled
  loginMethods: ['email', 'sms', 'wallet'] as const,
  // Appearance
  appearance: {
    theme: 'dark' as const,
    accentColor: '#10B981', // neon-green to match PolyBot theme
    logo: '/logo.png',
    showWalletLoginFirst: false,
  },
  // Embedded wallet config
  embeddedWallets: {
    createOnLogin: 'users-without-wallets' as const,
    noPromptOnSignature: false,
  },
  // Supported chains
  supportedChains: [
    {
      id: 137,
      name: 'Polygon',
      network: 'matic',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://polygon-rpc.com'] },
        public: { http: ['https://polygon-rpc.com'] },
      },
      blockExplorers: {
        default: { name: 'PolygonScan', url: 'https://polygonscan.com' },
      },
    },
  ],
  // Default chain for embedded wallets
  defaultChain: {
    id: 137,
    name: 'Polygon',
  },
};

// Check if user is admin (requires 2FA)
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Get admin phone number for 2FA
export function getAdminPhone(email: string): string | null {
  return ADMIN_PHONE_NUMBERS[email.toLowerCase()] || null;
}

// Subscription tier types
export type SubscriptionTier = 'free' | 'pro' | 'elite';

export interface UserProfile {
  id: string;
  email: string;
  privyUserId?: string;
  walletAddress?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: 'active' | 'inactive' | 'trialing' | 'canceled';
  stripeCustomerId?: string;
  monthlyTradesUsed: number;
  monthlyTradesLimit: number;
  trialEndsAt?: string;
  onboardingCompleted: boolean;
  isSimulation: boolean;
  createdAt: string;
  updatedAt: string;
}

// Tier limits
export const TIER_LIMITS: Record<SubscriptionTier, {
  monthlyTrades: number;      // Live trades per month (-1 = unlimited)
  simulationTrades: number;   // Sim trades per month (-1 = unlimited)
  features: string[];
  price: number;
}> = {
  free: {
    monthlyTrades: 0,           // No live trading
    simulationTrades: -1,       // Unlimited simulation
    features: [
      'Unlimited Simulation Trading',
      'Top 3 Strategies (Arbitrage, RSI, News)',
      'Basic Dashboard & Analytics',
      'Community Discord Access',
    ],
    price: 0,
  },
  pro: {
    monthlyTrades: 1000,
    simulationTrades: -1,       // Unlimited simulation
    features: [
      'Everything in Free',
      '1,000 Live Trades/Month',
      'All 10+ Automated Strategies',
      'Automated RSI Trading',
      'Advanced Analytics Dashboard',
      'AI Market Insights',
      'Email Support',
    ],
    price: 9.99,
  },
  elite: {
    monthlyTrades: -1,          // Unlimited live trades
    simulationTrades: -1,       // Unlimited simulation
    features: [
      'Everything in Pro',
      'Unlimited Live Trades',
      'Whale Tracker',
      'Congress Tracker', 
      'Tax Analysis & Reports',
      'Custom Strategy Builder',
      'API Access',
      'Priority Support',
    ],
    price: 49.99,
  },
};

// Check if feature is available for tier
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: string
): boolean {
  const tierFeatures = TIER_LIMITS[tier].features;
  
  // Elite has access to everything
  if (tier === 'elite') return true;
  
  // Check if feature is in tier's feature list
  return tierFeatures.some(f => 
    f.toLowerCase().includes(feature.toLowerCase())
  );
}

// Check if user can trade (within limits)
export function canTrade(
  tier: SubscriptionTier,
  tradesUsed: number,
  isLive: boolean
): { allowed: boolean; reason?: string } {
  // Simulation trades are always unlimited for all tiers
  if (!isLive) {
    return { allowed: true };
  }
  
  // Free tier cannot do live trading at all
  if (tier === 'free') {
    return { allowed: false, reason: 'Upgrade to Pro for live trading' };
  }
  
  const limit = TIER_LIMITS[tier].monthlyTrades;
  
  // Unlimited live trades for elite
  if (limit === -1) {
    return { allowed: true };
  }
  
  // Check live trade limit (Pro tier)
  if (tradesUsed >= limit) {
    return { 
      allowed: false, 
      reason: `Monthly live trade limit reached (${limit}). Upgrade to Elite for unlimited.` 
    };
  }
  
  return { allowed: true };
}
