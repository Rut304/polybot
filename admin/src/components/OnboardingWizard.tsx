'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Key,
  Zap,
  Target,
  Shield,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Copy,
  AlertTriangle,
  Sparkles,
  Activity,
  HelpCircle,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useTier } from '@/lib/useTier';
import { supabase } from '@/lib/supabase';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface StepStatus {
  wallet: 'pending' | 'complete' | 'skipped';
  platforms: 'pending' | 'complete' | 'skipped';
  strategies: 'pending' | 'complete' | 'skipped';
  simulation: 'pending' | 'complete' | 'skipped';
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PolyParlay! 🎉',
    description: 'Let\'s get you set up to start trading prediction markets.',
    icon: Sparkles,
  },
  {
    id: 'wallet',
    title: 'Your Trading Wallet',
    description: 'We\'ve created a secure, non-custodial wallet for you on Polygon.',
    icon: Wallet,
  },
  {
    id: 'platforms',
    title: 'Connect Your Platforms',
    description: 'Link your Polymarket, Kalshi, or Alpaca accounts to start trading.',
    icon: Key,
  },
  {
    id: 'strategies',
    title: 'Choose Your Strategies',
    description: 'Select up to 3 automated trading strategies (Free tier).',
    icon: Target,
  },
  {
    id: 'simulation',
    title: 'Start in Simulation Mode',
    description: 'Practice with paper money before risking real funds.',
    icon: Shield,
  },
];

const PLATFORM_LINKS = [
  {
    name: 'Polymarket',
    url: 'https://polymarket.com',
    description: '0% fees, USDC on Polygon',
    color: 'from-purple-500 to-blue-500',
    icon: '🎯',
  },
  {
    name: 'Kalshi',
    url: 'https://kalshi.com',
    description: 'US-regulated, USD deposits',
    color: 'from-green-500 to-emerald-500',
    icon: '📊',
  },
  {
    name: 'Alpaca',
    url: 'https://alpaca.markets',
    description: 'Commission-free stocks',
    color: 'from-yellow-500 to-orange-500',
    icon: '📈',
  },
];

const FREE_STRATEGIES = [
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    description: 'Find YES+NO mispricing on same market',
    expectedReturn: '5-15% APY',
    risk: 'Low',
  },
  {
    id: '15min_crypto_scalping',
    name: '15-Min Crypto Scalping',
    description: 'RSI-based crypto momentum trades',
    expectedReturn: '10-25% APY',
    risk: 'Medium',
  },
  {
    id: 'market_making',
    name: 'Market Making',
    description: 'Capture bid-ask spreads',
    expectedReturn: '10-20% APY',
    risk: 'Low',
  },
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    description: 'Trade price discrepancies after news',
    expectedReturn: '5-30% per event',
    risk: 'Medium',
  },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const { profile, refreshProfile } = useTier();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    'single_platform_arb',
    '15min_crypto_scalping',
    'market_making',
  ]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Save selected strategies and mark onboarding complete
      if (profile?.id) {
        await supabase
          .from('polybot_user_config')
          .upsert({
            user_id: profile.id,
            enabled_strategies: selectedStrategies,
            is_simulation: true, // Always start in simulation
            updated_at: new Date().toISOString(),
          });

        await supabase
          .from('polybot_profiles')
          .update({
            onboarding_completed: true,
            is_simulation: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        await refreshProfile();
      }
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        return prev.filter(id => id !== strategyId);
      }
      // Free tier: max 3 strategies
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, strategyId];
    });
  };

  const copyWalletAddress = () => {
    if (profile?.walletAddress) {
      navigator.clipboard.writeText(profile.walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const renderStepContent = () => {
    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-neon-green/20 to-neon-blue/20 rounded-full flex items-center justify-center"
            >
              <Sparkles className="w-12 h-12 text-neon-green" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to PolyParlay!</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Your automated trading companion for prediction markets. Let&apos;s get you set up in just a few steps.
            </p>
            <div className="flex flex-col gap-3 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                <span>Non-custodial - You control your funds</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                <span>Start with simulation - No real money risk</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                <span>10+ automated strategies to choose from</span>
              </div>
            </div>
          </div>
        );

      case 'wallet':
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 rounded-full flex items-center justify-center"
            >
              <Wallet className="w-10 h-10 text-neon-purple" />
            </motion.div>
            <h3 className="text-xl font-semibold text-white mb-2">Your Embedded Wallet</h3>
            <p className="text-gray-400 mb-6">
              We&apos;ve created a secure wallet on Polygon. Your keys, your crypto.
            </p>

            {profile?.walletAddress ? (
              <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-2">Your Wallet Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-neon-green font-mono truncate">
                    {profile.walletAddress}
                  </code>
                  <button
                    onClick={copyWalletAddress}
                    className="p-2 hover:bg-dark-border rounded transition-colors"
                  >
                    {copiedAddress ? (
                      <CheckCircle className="w-4 h-4 text-neon-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">
                  Wallet will be created when you first sign in with Privy
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-400 bg-neon-blue/10 border border-neon-blue/20 rounded-lg p-3">
              <HelpCircle className="w-5 h-5 text-neon-blue flex-shrink-0 mt-0.5" />
              <p className="text-left">
                Fund your wallet with USDC on Polygon for Polymarket trades. 
                You can use a bridge like{' '}
                <a href="https://jumper.exchange" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">
                  Jumper
                </a>
                {' '}to transfer funds.
              </p>
            </div>
          </div>
        );

      case 'platforms':
        return (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 text-center">Connect Your Platforms</h3>
            <p className="text-gray-400 mb-6 text-center">
              Create accounts on these platforms, then add your API keys in Settings → Secrets.
            </p>

            <div className="grid gap-4">
              {PLATFORM_LINKS.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-dark-bg/50 rounded-lg border border-dark-border hover:border-neon-green/30 transition-colors group"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-2xl`}>
                    {platform.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white group-hover:text-neon-green transition-colors">
                      {platform.name}
                    </h4>
                    <p className="text-sm text-gray-400">{platform.description}</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-neon-green transition-colors" />
                </a>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
              <HelpCircle className="w-4 h-4" />
              <span>You can skip this and add API keys later in</span>
              <Link href="/secrets" className="text-neon-green hover:underline">Settings → Secrets</Link>
            </div>
          </div>
        );

      case 'strategies':
        return (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 text-center">Choose Your Strategies</h3>
            <p className="text-gray-400 mb-2 text-center">
              Select up to 3 strategies for your Free account.
            </p>
            <p className="text-xs text-neon-green mb-6 text-center">
              {selectedStrategies.length}/3 selected • Upgrade to Pro for all 15+ strategies
            </p>

            <div className="grid gap-3">
              {FREE_STRATEGIES.map((strategy) => {
                const isSelected = selectedStrategies.includes(strategy.id);
                const isDisabled = !isSelected && selectedStrategies.length >= 3;

                return (
                  <button
                    key={strategy.id}
                    onClick={() => toggleStrategy(strategy.id)}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-4 p-4 rounded-lg border text-left transition-all
                      ${isSelected
                        ? 'bg-neon-green/10 border-neon-green/50'
                        : isDisabled
                          ? 'bg-dark-bg/30 border-dark-border opacity-50 cursor-not-allowed'
                          : 'bg-dark-bg/50 border-dark-border hover:border-gray-600'
                      }
                    `}
                  >
                    <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'border-neon-green bg-neon-green' : 'border-gray-500'}
                    `}>
                      {isSelected && <CheckCircle className="w-4 h-4 text-dark-bg" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{strategy.name}</h4>
                      <p className="text-sm text-gray-400 truncate">{strategy.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-neon-green">{strategy.expectedReturn}</p>
                      <p className="text-xs text-gray-500">Risk: {strategy.risk}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'simulation':
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-neon-green/20 to-emerald-500/20 rounded-full flex items-center justify-center"
            >
              <Activity className="w-10 h-10 text-neon-green" />
            </motion.div>
            <h3 className="text-xl font-semibold text-white mb-2">You&apos;re Starting in Simulation Mode</h3>
            <p className="text-gray-400 mb-6">
              Practice trading with $30,000 in paper money. No real funds at risk!
            </p>

            <div className="bg-dark-bg/50 rounded-lg p-6 mb-6 text-left">
              <h4 className="font-medium text-white mb-4">What to do next:</h4>
              <ol className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <span>Watch your Dashboard for opportunities and simulated trades</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <span>Review your Strategy Performance in Analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <span>Add API keys in Settings → Secrets when ready for live trading</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                  <span>Upgrade to Pro to enable live trading with real funds</span>
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-left">
                When you switch to live trading, ALL strategies are disabled by default. 
                You must explicitly enable each strategy you want to use with real money.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dark-card border border-dark-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header with progress */}
        <div className="px-6 py-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-neon-green to-neon-blue rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white">PolyParlay Setup</span>
            </div>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-gray-400 hover:text-white transition-colors"
                title="Skip onboarding"
                aria-label="Skip onboarding"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Progress steps */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, index) => (
              <div
                key={s.id}
                className={`
                  flex-1 h-1 rounded-full transition-colors
                  ${index <= currentStep ? 'bg-neon-green' : 'bg-dark-border'}
                `}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Step {currentStep + 1} of {STEPS.length}: {step.title}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-border flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${isFirstStep
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-white hover:bg-dark-border'
              }
            `}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {onSkip && !isLastStep && (
              <button
                onClick={onSkip}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isCompleting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-neon-green to-neon-blue text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isCompleting ? (
                'Setting up...'
              ) : isLastStep ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Start Trading
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
