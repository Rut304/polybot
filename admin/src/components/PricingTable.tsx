'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const TIERS = [
  {
    name: 'Free Tier',
    price: '$0',
    description: 'For hobbyists and testing.',
    features: ['Paper Trading Only', 'Standard Dashboards', 'Manual Execution', 'Community Support'],
    priceId: 'price_free_tier',
    mode: 'free'
  },
  {
    name: 'Pro Trader',
    price: '$99',
    period: '/month',
    description: 'For serious automated trading.',
    features: ['Live Trading Enabled', 'All Strategies', 'Priority Execution', 'Email Support', 'Cloud Hosting'],
    priceId: 'price_1ProTierPlaceholder', // REPLACE WITH REAL STRIPE PRICE ID
    mode: 'payment'
  },
  {
    name: 'Whale',
    price: '$499',
    period: '/month',
    description: 'For institutional volume.',
    features: ['Dedicated Instance', '0ms Latency', 'Custom Strategy Dev', '24/7 Phone Support', 'Audit Logs'],
    priceId: 'price_1WhaleTierPlaceholder', // REPLACE WITH REAL STRIPE PRICE ID
    mode: 'payment'
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`flex flex-col justify-between rounded-3xl bg-white p-8 shadow-xl ring-1 ring-gray-900/10 sm:p-10 ${tier.mode === 'payment' ? 'scale-105 ring-indigo-600' : ''}`}
        >
          <div>
            <h3 className="text-base font-semibold leading-7 text-indigo-600">{tier.name}</h3>
            <div className="mt-4 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-gray-900">{tier.price}</span>
              {tier.period && <span className="text-base font-semibold leading-7 text-gray-600">{tier.period}</span>}
            </div>
            <p className="mt-6 text-base leading-7 text-gray-600">{tier.description}</p>
            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-x-3">
                  <Check className="h-6 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => handleCheckout(tier.priceId, tier.mode)}
            disabled={loading !== null}
            className={`mt-8 block rounded-md px-3.5 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tier.mode === 'free'
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-indigo-600'
              }`}
          >
            {loading === tier.priceId ? 'Redirecting...' : (tier.mode === 'free' ? 'Current Plan' : 'Subscribe')}
          </button>
        </div>
      ))}
    </div>
  );
}
