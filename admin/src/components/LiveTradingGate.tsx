'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  Shield,
  ArrowRight,
  Lock,
  Key,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useTier } from '@/lib/useTier';
import { supabase } from '@/lib/supabase';

interface LiveTradingGateProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enabledStrategies: string[]) => void;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  requiresTier: 'free' | 'pro' | 'elite';
}

const ALL_STRATEGIES: Strategy[] = [
  // Core arbitrage strategies
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    description: 'Find YES+NO mispricing on same market',
    risk: 'Low',
    requiresTier: 'free',
  },
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    description: 'Exploit price differences between Polymarket & Kalshi',
    risk: 'Low',
    requiresTier: 'free',
  },
  {
    id: 'market_making',
    name: 'Market Making',
    description: 'Capture bid-ask spreads',
    risk: 'Low',
    requiresTier: 'free',
  },
  // Pro strategies
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    description: 'Trade price discrepancies after breaking news',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: '15min_crypto_scalping',
    name: '15-Min Crypto Scalping',
    description: 'RSI-based crypto momentum trades',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    description: 'Exploit perpetual swap funding rates',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    description: 'Automated buy/sell grid orders',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: 'pairs_trading',
    name: 'Pairs Trading',
    description: 'Trade correlated asset pairs',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: 'spike_hunter',
    name: 'Spike Hunter',
    description: 'Mean-reversion on rapid price spikes',
    risk: 'High',
    requiresTier: 'pro',
  },
  {
    id: 'stock_mean_reversion',
    name: 'Stock Mean Reversion',
    description: 'RSI-based stock entries',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  {
    id: 'stock_momentum',
    name: 'Stock Momentum',
    description: 'Ride trending stocks',
    risk: 'Medium',
    requiresTier: 'pro',
  },
  // Elite strategies
  {
    id: 'whale_copy_trading',
    name: 'Whale Copy Trading',
    description: 'Mirror top wallet trades',
    risk: 'Medium',
    requiresTier: 'elite',
  },
  {
    id: 'congressional_tracker',
    name: 'Congressional Tracker',
    description: 'Trade alongside congress members',
    risk: 'Medium',
    requiresTier: 'elite',
  },
  {
    id: 'ai_superforecasting',
    name: 'AI Superforecasting',
    description: 'AI-powered market predictions',
    risk: 'Medium',
    requiresTier: 'elite',
  },
];

export function LiveTradingGate({ isOpen, onClose, onConfirm }: LiveTradingGateProps) {
  const { tier, profile } = useTier();
  const [step, setStep] = useState<'warning' | 'strategies' | 'confirm'>('warning');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToRisks, setAgreedToRisks] = useState(false);

  // Check if user has API keys configured
  useEffect(() => {
    const checkApiKeys = async () => {
      if (!profile?.id) return;
      try {
        const { data } = await supabase
          .from('polybot_secrets')
          .select('key_name')
          .eq('user_id', profile.id)
          .not('key_value', 'is', null);
        
        setHasApiKeys((data?.length || 0) > 0);
      } catch (err) {
        console.error('Failed to check API keys:', err);
      }
    };
    checkApiKeys();
  }, [profile?.id]);

  const availableStrategies = ALL_STRATEGIES.filter(s => {
    if (s.requiresTier === 'elite' && tier !== 'elite') return false;
    if (s.requiresTier === 'pro' && tier === 'free') return false;
    return true;
  });

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        return prev.filter(id => id !== strategyId);
      }
      return [...prev, strategyId];
    });
  };

  const handleConfirm = () => {
    onConfirm(selectedStrategies);
    onClose();
  };

  const getRiskColor = (risk: Strategy['risk']) => {
    switch (risk) {
      case 'Low': return 'text-green-400';
      case 'Medium': return 'text-yellow-400';
      case 'High': return 'text-red-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dark-card border border-red-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Enable Live Trading</h2>
              <p className="text-sm text-gray-400">This will use real funds</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            {step === 'warning' && (
              <motion.div
                key="warning"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {/* API Key Check */}
                {!hasApiKeys && (
                  <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-400 font-medium">No API Keys Configured</p>
                        <p className="text-sm text-gray-400 mt-1">
                          You need to add API keys for at least one platform before live trading.
                        </p>
                        <Link
                          href="/secrets"
                          className="inline-flex items-center gap-1 mt-2 text-sm text-neon-green hover:underline"
                        >
                          Go to Settings → Secrets
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning list */}
                <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-white font-medium mb-3">
                    ⚠️ By switching to live mode, you acknowledge:
                  </p>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>All trades will execute with <strong className="text-red-400">real money</strong> from your connected accounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>Losses are <strong className="text-red-400">permanent</strong> and cannot be reversed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>You are responsible for tax reporting on all gains</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>Past simulation performance does not guarantee live results</span>
                    </li>
                  </ul>
                </div>

                {/* All strategies disabled notice */}
                <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-neon-blue flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-neon-blue font-medium">All Strategies Start Disabled</p>
                      <p className="text-sm text-gray-400 mt-1">
                        When you switch to live, NO strategies are enabled by default. 
                        You must explicitly choose which strategies to activate with real money.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Checkbox agreement */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedToRisks}
                    onChange={(e) => setAgreedToRisks(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-500 bg-dark-bg text-neon-green focus:ring-neon-green focus:ring-offset-dark-bg"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    I understand that live trading uses real funds and I accept all risks associated with automated trading.
                  </span>
                </label>
              </motion.div>
            )}

            {step === 'strategies' && (
              <motion.div
                key="strategies"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-1">Select Strategies for Live Trading</h3>
                  <p className="text-sm text-gray-400">
                    Only checked strategies will execute real trades. 
                    {selectedStrategies.length === 0 && (
                      <span className="text-amber-400"> Select at least one strategy.</span>
                    )}
                  </p>
                </div>

                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {availableStrategies.map((strategy) => {
                    const isSelected = selectedStrategies.includes(strategy.id);
                    
                    return (
                      <button
                        key={strategy.id}
                        onClick={() => toggleStrategy(strategy.id)}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                          ${isSelected
                            ? 'bg-neon-green/10 border-neon-green/50'
                            : 'bg-dark-bg/50 border-dark-border hover:border-gray-600'
                          }
                        `}
                      >
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                          ${isSelected ? 'border-neon-green bg-neon-green' : 'border-gray-500'}
                        `}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-dark-bg" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white text-sm">{strategy.name}</h4>
                            {strategy.requiresTier !== 'free' && (
                              <span className={`
                                text-[10px] px-1.5 py-0.5 rounded uppercase font-bold
                                ${strategy.requiresTier === 'pro' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}
                              `}>
                                {strategy.requiresTier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{strategy.description}</p>
                        </div>
                        <span className={`text-xs font-medium ${getRiskColor(strategy.risk)}`}>
                          {strategy.risk}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedStrategies.length > 0 && (
                  <div className="mt-4 p-3 bg-dark-bg/50 rounded-lg">
                    <p className="text-sm text-gray-400">
                      <span className="text-neon-green font-medium">{selectedStrategies.length}</span> strategies selected for live trading
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Zap className="w-10 h-10 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to Go Live?</h3>
                <p className="text-gray-400 mb-6">
                  You&apos;re about to enable live trading with {selectedStrategies.length} strategies.
                </p>

                <div className="bg-dark-bg/50 rounded-lg p-4 text-left mb-6">
                  <p className="text-sm text-gray-500 mb-2">Enabled strategies:</p>
                  <ul className="text-sm text-white space-y-1">
                    {selectedStrategies.map(id => {
                      const strategy = ALL_STRATEGIES.find(s => s.id === id);
                      return strategy ? (
                        <li key={id} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-neon-green" />
                          {strategy.name}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>

                <p className="text-xs text-gray-500">
                  You can disable strategies at any time in Settings → Strategies
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {step === 'warning' && (
              <button
                onClick={() => setStep('strategies')}
                disabled={!agreedToRisks || !hasApiKeys}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all
                  ${agreedToRisks && hasApiKeys
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Choose Strategies
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'strategies' && (
              <>
                <button
                  onClick={() => setStep('warning')}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={selectedStrategies.length === 0}
                  className={`
                    flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all
                    ${selectedStrategies.length > 0
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  Review
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {step === 'confirm' && (
              <>
                <button
                  onClick={() => setStep('strategies')}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  {isLoading ? 'Enabling...' : 'Enable Live Trading'}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
