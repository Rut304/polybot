'use client';

import { ReactNode } from 'react';
import { useTier, useFeatureAccess } from '@/lib/useTier';
import { SubscriptionTier, TIER_LIMITS } from '@/lib/privy';
import { Lock, Sparkles, Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface FeatureGateProps {
  children: ReactNode;
  feature: string;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

/**
 * Gate content behind subscription tiers
 * Shows upgrade prompt for users without access
 */
export function FeatureGate({ 
  children, 
  feature, 
  fallback,
  showUpgrade = true 
}: FeatureGateProps) {
  const { hasAccess, requiredTier } = useFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return <UpgradePrompt feature={feature} requiredTier={requiredTier} />;
}

/**
 * Wrapper for Pro-only features
 */
export function ProFeature({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isPro } = useTier();

  if (isPro) {
    return <>{children}</>;
  }

  return fallback || <UpgradePrompt feature="Pro features" requiredTier="pro" />;
}

/**
 * Wrapper for Elite-only features
 */
export function EliteFeature({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isElite } = useTier();

  if (isElite) {
    return <>{children}</>;
  }

  return fallback || <UpgradePrompt feature="Elite features" requiredTier="elite" />;
}

/**
 * Upgrade prompt component
 */
function UpgradePrompt({ 
  feature, 
  requiredTier 
}: { 
  feature: string; 
  requiredTier: SubscriptionTier;
}) {
  const tierConfig = TIER_LIMITS[requiredTier];
  const Icon = requiredTier === 'elite' ? Crown : Sparkles;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-dark-card/50 rounded-xl border border-dark-border">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-neon-purple" />
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">
        {requiredTier === 'pro' ? 'Pro' : 'Elite'} Feature
      </h3>
      
      <p className="text-gray-400 text-center mb-4 max-w-sm">
        {feature} requires a {requiredTier === 'pro' ? 'Pro' : 'Elite'} subscription.
        Upgrade to unlock this and more powerful features.
      </p>

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Icon className="w-4 h-4" />
        <span>${tierConfig.price}/month</span>
      </div>

      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-green to-neon-blue text-dark-bg font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        Upgrade Now
        <ArrowRight className="w-4 h-4" />
      </Link>

      <div className="mt-6 text-xs text-gray-500">
        <p>Includes:</p>
        <ul className="mt-2 space-y-1">
          {tierConfig.features.slice(0, 4).map((f, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-neon-green">✓</span> {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Inline upgrade badge for nav items
 */
export function TierBadge({ tier }: { tier: SubscriptionTier }) {
  if (tier === 'free') return null;

  const config = {
    pro: {
      label: 'PRO',
      className: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
    },
    elite: {
      label: 'ELITE',
      className: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
    },
  };

  const { label, className } = config[tier];

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${className}`}>
      {label}
    </span>
  );
}

/**
 * Lock icon for gated nav items
 */
export function GatedNavItem({ 
  requiredTier,
  children 
}: { 
  requiredTier: SubscriptionTier;
  children: ReactNode;
}) {
  const { tier } = useTier();
  
  const hasAccess = 
    requiredTier === 'free' ||
    (requiredTier === 'pro' && (tier === 'pro' || tier === 'elite')) ||
    (requiredTier === 'elite' && tier === 'elite');

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative group">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <TierBadge tier={requiredTier} />
      </div>
    </div>
  );
}
