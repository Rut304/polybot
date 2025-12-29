'use client';

import PricingTable from '@/components/PricingTable';
import { useTier } from '@/lib/useTier';
import { Crown, Sparkles, Zap } from 'lucide-react';

export default function PricingPage() {
  const { tier, tradesUsed, tradesLimit, tradesRemaining } = useTier();

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="p-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              Pricing Plans
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Scale Your Trading with PolyBot
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              From paper trading to institutional volume. Choose the plan that fits your trading style.
            </p>
          </div>

          {/* Current Plan Status */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  tier === 'elite' ? 'bg-yellow-500/20' :
                  tier === 'pro' ? 'bg-neon-blue/20' :
                  'bg-gray-700'
                }`}>
                  {tier === 'elite' && <Crown className="w-6 h-6 text-yellow-400" />}
                  {tier === 'pro' && <Sparkles className="w-6 h-6 text-neon-blue" />}
                  {tier === 'free' && <Zap className="w-6 h-6 text-gray-400" />}
                </div>
                <div>
                  <h3 className="text-white font-semibold capitalize">{tier} Plan</h3>
                  <p className="text-gray-400 text-sm">Your current subscription</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">
                  {tradesLimit === -1 ? '∞' : tradesUsed} / {tradesLimit === -1 ? '∞' : tradesLimit}
                </div>
                <p className="text-gray-400 text-sm">Monthly trades used</p>
              </div>
            </div>
            {tradesLimit !== -1 && (
              <div className="mt-4">
                <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-green to-neon-blue rounded-full transition-all"
                    style={{ width: `${Math.min(100, (tradesUsed / tradesLimit) * 100)}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {tradesRemaining === Infinity ? 'Unlimited' : tradesRemaining} trades remaining this month
                </p>
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <PricingTable />

          {/* FAQ or Trust Signals */}
          <div className="mt-16 text-center">
            <p className="text-gray-500 text-sm">
              Free accounts include unlimited paper trading. Upgrade when you&apos;re ready to go live. Cancel anytime.
            </p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 rounded bg-polymarket flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">P</span>
                </div>
                Polymarket
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 rounded bg-kalshi flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">K</span>
                </div>
                Kalshi
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
