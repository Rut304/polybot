'use client';

import { useState } from 'react';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { TIER_LIMITS, SubscriptionTier } from '@/lib/privy';

const TIERS = [
  {
    name: 'Free',
    tier: 'free' as SubscriptionTier,
    price: '$0',
    description: 'Unlimited paper trading to learn the ropes.',
    features: TIER_LIMITS.free.features,
    priceId: null, // No Stripe product for free
    mode: 'free',
    icon: Zap,
    popular: false,
    highlight: 'Forever Free',
  },
  {
    name: 'Pro Trader',
    tier: 'pro' as SubscriptionTier,
    price: '$9.99',
    period: '/month',
    description: 'Go live with automated strategies.',
    features: TIER_LIMITS.pro.features,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_pro_placeholder',
    mode: 'subscription',
    icon: Sparkles,
    popular: true,
    highlight: 'Most Popular',
  },
  {
    name: 'Elite',
    tier: 'elite' as SubscriptionTier,
    price: '$49.99',
    period: '/month',
    description: 'Full power with custom strategies & intel.',
    features: TIER_LIMITS.elite.features,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE || 'price_elite_placeholder',
    mode: 'subscription',
    icon: Crown,
    popular: false,
    highlight: 'Best Value',
  },
];

export default function PricingTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, mode: string) => {
    if (mode === 'free') return; // Handled differently or just default
    if (!user) {
      alert('Please log in first');
      return;
    }
    setLoading(priceId);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          userEmail: user.email,
          successUrl: window.location.origin + '/dashboard?session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: window.location.origin + '/pricing',
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Checkout failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {TIERS.map((tier) => {
        const Icon = tier.icon;
        return (
          <div
            key={tier.name}
            className={`relative flex flex-col justify-between rounded-2xl p-8 ${
              tier.popular 
                ? 'bg-gradient-to-b from-brand-green/20 to-dark-card border-2 border-brand-green shadow-lg shadow-brand-green/20' 
                : 'bg-dark-card border border-dark-border'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-brand-green text-dark-bg px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  Most Popular
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tier.popular ? 'bg-brand-green/20' : 'bg-dark-border'}`}>
                  <Icon className={`h-5 w-5 ${tier.popular ? 'text-brand-green' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              </div>
              <div className="mt-6 flex items-baseline gap-x-2">
                <span className="text-4xl font-bold tracking-tight text-white">{tier.price}</span>
                {tier.period && <span className="text-sm font-medium text-gray-400">{tier.period}</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-400">{tier.description}</p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3 text-gray-300">
                    <Check className={`h-5 w-5 flex-none ${tier.popular ? 'text-brand-green' : 'text-gray-500'}`} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => handleCheckout(tier.priceId!, tier.mode)}
              disabled={loading !== null || tier.mode === 'free'}
              className={`mt-8 w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all duration-200 ${
                tier.mode === 'free'
                  ? 'bg-dark-border text-gray-400 cursor-default'
                  : tier.popular
                    ? 'bg-brand-green text-dark-bg hover:bg-brand-green/90 shadow-lg shadow-brand-green/30'
                    : 'bg-dark-border text-white hover:bg-dark-hover border border-dark-border'
              }`}
            >
              {loading === tier.priceId ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                tier.mode === 'free' ? 'Current Plan' : 'Get Started'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
