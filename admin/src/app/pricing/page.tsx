'use client';

import PricingTable from '@/components/PricingTable';
import { useTier } from '@/lib/useTier';
import { Crown, Sparkles, Zap, CheckCircle2, XCircle, ArrowRight, TrendingUp, Shield, Bot, BarChart3 } from 'lucide-react';

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
              Scale Your Trading with PolyParlay
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Start free with unlimited paper trading. Upgrade when you&apos;re ready to trade with real money.
            </p>
          </div>

          {/* Why Upgrade Section */}
          <div className="bg-gradient-to-r from-neon-blue/10 to-purple-500/10 border border-neon-blue/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neon-blue" />
              Why Upgrade?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-neon-blue/20 rounded-lg flex-shrink-0">
                  <Bot className="w-5 h-5 text-neon-blue" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Automated Trading</h3>
                  <p className="text-sm text-gray-400">Let AI execute trades 24/7 based on proven strategies</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-green/20 rounded-lg flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-brand-green" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Advanced Analytics</h3>
                  <p className="text-sm text-gray-400">Missed money analysis, AI insights, and whale tracking</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                  <Shield className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Real Money Trading</h3>
                  <p className="text-sm text-gray-400">Execute live trades on Polymarket & Kalshi</p>
                </div>
              </div>
            </div>
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

          {/* Feature Comparison Table */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Feature Comparison</h2>
            <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                    <th className="text-center p-4 text-gray-400 font-medium">Free</th>
                    <th className="text-center p-4 text-neon-blue font-medium">Pro</th>
                    <th className="text-center p-4 text-yellow-400 font-medium">Elite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  <tr>
                    <td className="p-4 text-gray-300">Paper Trading</td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr className="bg-dark-hover/30">
                    <td className="p-4 text-gray-300">Live Trading</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><span className="text-sm text-neon-blue">1,000/mo</span></td>
                    <td className="p-4 text-center"><span className="text-sm text-yellow-400">Unlimited</span></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-300">Basic Strategies (Arbitrage, RSI, News)</td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr className="bg-dark-hover/30">
                    <td className="p-4 text-gray-300">Advanced Strategies (10+)</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-300">Missed Money Analysis</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr className="bg-dark-hover/30">
                    <td className="p-4 text-gray-300">AI Market Insights</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-300">Whale Tracker</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr className="bg-dark-hover/30">
                    <td className="p-4 text-gray-300">Congress Tracker</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-300">Tax Reports</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr className="bg-dark-hover/30">
                    <td className="p-4 text-gray-300">Custom Strategy Builder</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-300">API Access</td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><XCircle className="w-5 h-5 text-gray-600 mx-auto" /></td>
                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 text-brand-green mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ or Trust Signals */}
          <div className="mt-16 text-center">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-2">🎯 Start Free, Upgrade When Ready</h3>
              <p className="text-gray-400">
                Free accounts include <span className="text-brand-green font-medium">unlimited paper trading</span> so you can master strategies risk-free.
                When you&apos;re confident, upgrade to Pro or Elite to trade with real money. Cancel anytime.
              </p>
              <p className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                <span className="text-brand-green">🔒</span>
                <span><strong className="text-gray-300">100% Non-Custodial:</strong> We never have access to your funds. Your wallet, your keys, your money.</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-6">
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
