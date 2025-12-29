'use client';

import { useState } from 'react';
import { X, Check, Sparkles, Crown, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { TIER_LIMITS, SubscriptionTier } from '@/lib/privy';

// Stripe Price IDs - set in environment variables
const STRIPE_PRICES = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
  elite: process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID || 'price_elite_monthly',
};

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  highlightTier?: 'pro' | 'elite';
  trigger?: string; // What triggered the modal (e.g., "strategy_limit", "live_trading")
}

export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  currentTier,
  highlightTier,
  trigger 
}: UpgradeModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<'pro' | 'elite' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (tier: 'pro' | 'elite') => {
    if (!user?.id) {
      setError('Please sign in to upgrade');
      return;
    }

    setLoading(tier);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[tier],
          userId: user.id,
          userEmail: user.email,
          successUrl: `${window.location.origin}/settings?upgraded=${tier}`,
          cancelUrl: `${window.location.origin}/settings?canceled=true`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to connect to payment system');
    } finally {
      setLoading(null);
    }
  };

  // Custom message based on trigger
  const getTriggerMessage = () => {
    switch (trigger) {
      case 'strategy_limit':
        return "You've reached the 3-strategy limit on the Free tier.";
      case 'live_trading':
        return "Live trading requires a Pro or Elite subscription.";
      case 'whale_tracker':
        return "Whale Tracker is an Elite-only feature.";
      case 'congress_tracker':
        return "Congress Tracker is an Elite-only feature.";
      default:
        return "Unlock more features with a premium subscription.";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-dark-card border border-dark-border rounded-2xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close upgrade modal"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-2xl font-bold text-white">Upgrade Your Plan</h2>
          <p className="text-gray-400 mt-1">{getTriggerMessage()}</p>
        </div>

        {/* Plans */}
        <div className="p-6 grid md:grid-cols-2 gap-4">
          {/* Pro Plan */}
          <div 
            className={`relative p-6 rounded-xl border-2 transition-all ${
              highlightTier === 'pro' 
                ? 'border-neon-blue bg-neon-blue/5' 
                : 'border-dark-border hover:border-gray-600'
            } ${currentTier === 'pro' ? 'opacity-50' : ''}`}
          >
            {highlightTier === 'pro' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-neon-blue text-white text-xs font-semibold rounded-full">
                Recommended
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Pro</h3>
                <p className="text-sm text-gray-400">For active traders</p>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold text-white">$9.99</span>
              <span className="text-gray-500">/month</span>
            </div>

            <ul className="space-y-2 mb-6 text-sm">
              {TIER_LIMITS.pro.features.slice(0, 5).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-neon-green flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={loading !== null || currentTier === 'pro'}
              className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                currentTier === 'pro'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-neon-blue hover:bg-blue-600 text-white'
              }`}
            >
              {loading === 'pro' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : currentTier === 'pro' ? (
                'Current Plan'
              ) : (
                <>Upgrade to Pro <ExternalLink className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Elite Plan */}
          <div 
            className={`relative p-6 rounded-xl border-2 transition-all ${
              highlightTier === 'elite' 
                ? 'border-yellow-500 bg-yellow-500/5' 
                : 'border-dark-border hover:border-gray-600'
            } ${currentTier === 'elite' ? 'opacity-50' : ''}`}
          >
            {highlightTier === 'elite' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-black text-xs font-semibold rounded-full">
                Recommended
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Elite</h3>
                <p className="text-sm text-gray-400">Maximum edge</p>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold text-white">$99.99</span>
              <span className="text-gray-500">/month</span>
            </div>

            <ul className="space-y-2 mb-6 text-sm">
              {TIER_LIMITS.elite.features.slice(0, 5).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade('elite')}
              disabled={loading !== null || currentTier === 'elite'}
              className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                currentTier === 'elite'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black'
              }`}
            >
              {loading === 'elite' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : currentTier === 'elite' ? (
                'Current Plan'
              ) : (
                <>Upgrade to Elite <ExternalLink className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 pb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-dark-border text-center text-sm text-gray-500">
          Cancel anytime. Start with free paper trading to learn the platform.
        </div>
      </div>
    </div>
  );
}
