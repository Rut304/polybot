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
    skippable: false,
  },
  {
    id: 'wallet',
    title: 'Polymarket Wallet (Privy)',
    description: 'For trading on Polymarket - uses the same wallet system as Polymarket.com',
    icon: Wallet,
    skippable: true,
    skipText: 'Skip - I\'ll set this up later',
  },
  {
    id: 'platforms',
    title: 'Connect Trading Platforms',
    description: 'Link your accounts to enable automated trading on each platform.',
    icon: Key,
    skippable: true,
    skipText: 'Skip - I\'ll add API keys later',
  },
  {
    id: 'strategies',
    title: 'Choose Your Strategies',
    description: 'Select which automated strategies to run (you can change these anytime).',
    icon: Target,
    skippable: true,
    skipText: 'Skip - Use defaults',
  },
  {
    id: 'simulation',
    title: 'Start with Paper Trading',
    description: 'Practice with virtual money before risking real funds.',
    icon: Shield,
    skippable: false,
  },
];

const PLATFORM_LINKS = [
  // Prediction Markets
  {
    name: 'Polymarket',
    url: 'https://polymarket.com',
    description: '0% fees, USDC on Polygon',
    color: 'from-purple-500 to-blue-500',
    icon: '🎯',
    apiKeyName: 'POLYMARKET_API_KEY',
    secretKeyName: 'POLYMARKET_SECRET',
    apiKeyLabel: 'API Key',
    secretKeyLabel: 'Secret',
    helpUrl: 'https://docs.polymarket.com/#api',
    category: 'prediction',
  },
  {
    name: 'Kalshi',
    url: 'https://kalshi.com',
    description: 'US-regulated, USD deposits',
    color: 'from-green-500 to-emerald-500',
    icon: '📊',
    apiKeyName: 'KALSHI_API_KEY',
    secretKeyName: 'KALSHI_PRIVATE_KEY',
    apiKeyLabel: 'API Key',
    secretKeyLabel: 'Private Key (RSA)',
    helpUrl: 'https://trading-api.readme.io/reference/authentication',
    category: 'prediction',
  },
  // Crypto Exchanges
  {
    name: 'Hyperliquid',
    url: 'https://hyperliquid.xyz',
    description: 'Zero-fee perp DEX, fastest fills',
    color: 'from-cyan-400 to-blue-500',
    icon: '⚡',
    apiKeyName: 'HYPERLIQUID_WALLET_ADDRESS',
    secretKeyName: 'HYPERLIQUID_PRIVATE_KEY',
    apiKeyLabel: 'Wallet Address',
    secretKeyLabel: 'Private Key',
    helpUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api',
    category: 'crypto',
  },
  {
    name: 'Binance',
    url: 'https://binance.com',
    description: 'Largest crypto exchange',
    color: 'from-yellow-400 to-yellow-600',
    icon: '🟡',
    apiKeyName: 'BINANCE_API_KEY',
    secretKeyName: 'BINANCE_API_SECRET',
    apiKeyLabel: 'API Key',
    secretKeyLabel: 'API Secret',
    helpUrl: 'https://binance.com/en/support/faq/api',
    category: 'crypto',
  },
  // Stock Brokers
  {
    name: 'Alpaca',
    url: 'https://alpaca.markets',
    description: 'Commission-free stocks',
    color: 'from-yellow-500 to-orange-500',
    icon: '🦙',
    apiKeyName: 'ALPACA_API_KEY',
    secretKeyName: 'ALPACA_API_SECRET',
    apiKeyLabel: 'API Key',
    secretKeyLabel: 'API Secret',
    helpUrl: 'https://docs.alpaca.markets/docs/api-keys',
    category: 'stocks',
  },
  {
    name: 'IBKR',
    url: 'https://interactivebrokers.com',
    description: 'Professional trading platform',
    color: 'from-red-500 to-red-700',
    icon: '🏛️',
    apiKeyName: 'IBKR_USERNAME',
    secretKeyName: 'IBKR_PASSWORD',
    apiKeyLabel: 'Username',
    secretKeyLabel: 'Password',
    helpUrl: 'https://www.interactivebrokers.com/en/trading/web-api.php',
    category: 'stocks',
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
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    description: 'Exploit price differences across exchanges',
    expectedReturn: '8-20% APY',
    risk: 'Low',
  },
  {
    id: 'whale_copy_trading',
    name: 'Whale Copy Trading',
    description: 'Follow top traders automatically',
    expectedReturn: '15-40% APY',
    risk: 'Medium',
  },
  {
    id: 'congressional_tracker',
    name: 'Congressional Tracker',
    description: 'Trade based on politician disclosures',
    expectedReturn: '10-30% APY',
    risk: 'Medium',
  },
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    description: 'Capture funding payments on perps',
    expectedReturn: '15-25% APY',
    risk: 'Low',
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    description: 'Automated buy/sell grid orders',
    expectedReturn: '10-20% APY',
    risk: 'Medium',
  },
];

// Platform card component for cleaner code
interface PlatformCardProps {
  platform: typeof PLATFORM_LINKS[0];
  isExpanded: boolean;
  isSaved: boolean;
  keys: { apiKey: string; secretKey: string };
  savingKeys: string | null;
  setExpandedPlatform: (name: string | null) => void;
  setPlatformKeys: React.Dispatch<React.SetStateAction<Record<string, { apiKey: string; secretKey: string }>>>;
  savePlatformKeys: (platform: typeof PLATFORM_LINKS[0]) => void;
}

function PlatformCard({
  platform,
  isExpanded,
  isSaved,
  keys,
  savingKeys,
  setExpandedPlatform,
  setPlatformKeys,
  savePlatformKeys,
}: PlatformCardProps) {
  return (
    <div
      className={`bg-dark-bg/50 rounded-lg border transition-colors ${
        isSaved ? 'border-neon-green/50' : 'border-dark-border'
      }`}
    >
      {/* Platform Header */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-xl`}>
          {platform.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm flex items-center gap-2">
            {platform.name}
            {isSaved && <CheckCircle className="w-4 h-4 text-neon-green" />}
          </h4>
          <p className="text-xs text-gray-400 truncate">{platform.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Sign up"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          {!isSaved && (
            <button
              onClick={() => setExpandedPlatform(isExpanded ? null : platform.name)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                isExpanded 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30'
              }`}
            >
              {isExpanded ? 'Cancel' : 'Add Keys'}
            </button>
          )}
        </div>
      </div>
      
      {/* Expanded API Key Entry */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-dark-border pt-3">
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{platform.apiKeyLabel}</label>
              <input
                type="text"
                placeholder={`Enter ${platform.apiKeyLabel.toLowerCase()}`}
                value={keys.apiKey}
                onChange={(e) => setPlatformKeys(prev => ({
                  ...prev,
                  [platform.name]: { ...keys, apiKey: e.target.value }
                }))}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm text-white placeholder-gray-500 focus:border-neon-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{platform.secretKeyLabel}</label>
              <input
                type="password"
                placeholder={`Enter ${platform.secretKeyLabel.toLowerCase()}`}
                value={keys.secretKey}
                onChange={(e) => setPlatformKeys(prev => ({
                  ...prev,
                  [platform.name]: { ...keys, secretKey: e.target.value }
                }))}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm text-white placeholder-gray-500 focus:border-neon-green focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <a
                href={platform.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neon-blue hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                How to get API keys
              </a>
              <button
                onClick={() => savePlatformKeys(platform)}
                disabled={!keys.apiKey || !keys.secretKey || savingKeys === platform.name}
                className="px-3 py-1.5 bg-neon-green text-dark-bg font-medium rounded text-xs hover:bg-neon-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingKeys === platform.name ? 'Saving...' : 'Save Keys'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const { profile, refreshProfile } = useTier();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    'single_platform_arb',
    'cross_platform_arb',
    'whale_copy_trading',
  ]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  // Platform API key state
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [platformKeys, setPlatformKeys] = useState<Record<string, { apiKey: string; secretKey: string }>>({});
  const [savingKeys, setSavingKeys] = useState<string | null>(null);
  const [keysSaved, setKeysSaved] = useState<Record<string, boolean>>({});

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  // Save platform API keys to Supabase
  const savePlatformKeys = async (platform: typeof PLATFORM_LINKS[0]) => {
    const keys = platformKeys[platform.name];
    if (!keys?.apiKey || !keys?.secretKey) return;
    
    setSavingKeys(platform.name);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };
      
      // Save API key
      await fetch('/api/secrets', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ key_name: platform.apiKeyName, key_value: keys.apiKey }),
      });
      
      // Save secret key
      await fetch('/api/secrets', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ key_name: platform.secretKeyName, key_value: keys.secretKey }),
      });
      
      setKeysSaved(prev => ({ ...prev, [platform.name]: true }));
      setExpandedPlatform(null);
    } catch (err) {
      console.error('Failed to save keys:', err);
    } finally {
      setSavingKeys(null);
    }
  };

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
                <span>Start with paper trading - No real money risk</span>
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
            <h3 className="text-xl font-semibold text-white mb-2">Polymarket Trading Wallet</h3>
            <p className="text-gray-400 mb-4">
              For trading on <strong className="text-white">Polymarket</strong>, you need a crypto wallet on the Polygon network.
            </p>

            {/* Key info box */}
            <div className="bg-neon-purple/10 border border-neon-purple/30 rounded-lg p-4 mb-6 text-left">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-neon-purple" />
                Important: This is YOUR wallet
              </h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                  <span><strong className="text-white">Powered by Privy</strong> - The same wallet system used by Polymarket.com</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                  <span><strong className="text-white">Non-custodial</strong> - PolyParlay never holds your funds. You own your keys.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                  <span><strong className="text-white">Already have Polymarket?</strong> If you&apos;ve used Polymarket before with the same email, you&apos;ll see your existing wallet!</span>
                </li>
              </ul>
            </div>

            {profile?.walletAddress ? (
              <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-2">Your Polygon Wallet Address</p>
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
                  Your Privy wallet will appear here once connected.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-400 bg-neon-blue/10 border border-neon-blue/20 rounded-lg p-3">
              <HelpCircle className="w-5 h-5 text-neon-blue flex-shrink-0 mt-0.5" />
              <p className="text-left">
                <strong className="text-white">To fund your wallet:</strong> Send USDC on the Polygon network to your wallet address above. 
                You can use a bridge like{' '}
                <a href="https://jumper.exchange" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">
                  Jumper
                </a>
                {' '}to move funds from other chains.
              </p>
            </div>

            <div className="mt-4 text-xs text-gray-500 text-center">
              <strong>Don&apos;t need Polymarket?</strong> If you only want to trade on Kalshi or stocks, you can skip this step.
            </div>
          </div>
        );

      case 'platforms':
        return (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 text-center">Connect Your Trading Platforms</h3>
            <p className="text-gray-400 mb-2 text-center">
              Add API keys for the platforms you want to trade on. Each platform requires its own account.
            </p>
            
            {/* Explanation box */}
            <div className="bg-dark-bg/50 border border-dark-border rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-400 mb-2">
                <strong className="text-white">How this works:</strong> You create an account on each platform, 
                then generate API keys there and paste them here. PolyParlay uses these keys to execute trades on your behalf.
              </p>
              <p className="text-gray-500 text-xs">
                🔒 Your keys are encrypted and stored securely. We never have access to withdraw your funds.
              </p>
            </div>

            {/* Prediction Markets Section */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                🎯 Prediction Markets
                <span className="text-xs font-normal text-gray-500">- Trade on event outcomes</span>
              </h4>
              <div className="grid gap-3">
                {PLATFORM_LINKS.filter(p => p.category === 'prediction').map((platform) => {
                  const isExpanded = expandedPlatform === platform.name;
                  const isSaved = keysSaved[platform.name];
                  const keys = platformKeys[platform.name] || { apiKey: '', secretKey: '' };
                  
                  return (
                    <PlatformCard
                      key={platform.name}
                      platform={platform}
                      isExpanded={isExpanded}
                      isSaved={isSaved}
                      keys={keys}
                      savingKeys={savingKeys}
                      setExpandedPlatform={setExpandedPlatform}
                      setPlatformKeys={setPlatformKeys}
                      savePlatformKeys={savePlatformKeys}
                    />
                  );
                })}
              </div>
            </div>

            {/* Crypto Exchanges Section */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                ⚡ Crypto Exchanges
                <span className="text-xs font-normal text-gray-500">- Trade crypto & perpetuals</span>
              </h4>
              <div className="grid gap-3">
                {PLATFORM_LINKS.filter(p => p.category === 'crypto').map((platform) => {
                  const isExpanded = expandedPlatform === platform.name;
                  const isSaved = keysSaved[platform.name];
                  const keys = platformKeys[platform.name] || { apiKey: '', secretKey: '' };
                  
                  return (
                    <PlatformCard
                      key={platform.name}
                      platform={platform}
                      isExpanded={isExpanded}
                      isSaved={isSaved}
                      keys={keys}
                      savingKeys={savingKeys}
                      setExpandedPlatform={setExpandedPlatform}
                      setPlatformKeys={setPlatformKeys}
                      savePlatformKeys={savePlatformKeys}
                    />
                  );
                })}
              </div>
            </div>

            {/* Stock Brokers Section */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                📈 Stock Brokers
                <span className="text-xs font-normal text-gray-500">- Trade stocks & ETFs</span>
              </h4>
              <div className="grid gap-3">
                {PLATFORM_LINKS.filter(p => p.category === 'stocks').map((platform) => {
                  const isExpanded = expandedPlatform === platform.name;
                  const isSaved = keysSaved[platform.name];
                  const keys = platformKeys[platform.name] || { apiKey: '', secretKey: '' };
                  
                  return (
                    <PlatformCard
                      key={platform.name}
                      platform={platform}
                      isExpanded={isExpanded}
                      isSaved={isSaved}
                      keys={keys}
                      savingKeys={savingKeys}
                      setExpandedPlatform={setExpandedPlatform}
                      setPlatformKeys={setPlatformKeys}
                      savePlatformKeys={savePlatformKeys}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
              <HelpCircle className="w-4 h-4" />
              <span>You can skip this and add keys later in</span>
              <Link href="/secrets" className="text-neon-green hover:underline">Settings → Secrets</Link>
            </div>
          </div>
        );

      case 'strategies':
        return (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 text-center">Choose Your Trading Strategies</h3>
            <p className="text-gray-400 mb-2 text-center">
              Select which automated strategies PolyParlay should run for you.
            </p>
            
            {/* Explanation box */}
            <div className="bg-dark-bg/50 border border-dark-border rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-400">
                <strong className="text-white">How strategies work:</strong> When you enable a strategy, PolyParlay&apos;s 
                bot will automatically scan for opportunities and execute trades based on that strategy&apos;s rules.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                💡 In simulation mode, strategies trade with virtual money. You can change these anytime in Settings.
              </p>
            </div>

            <p className="text-xs text-neon-green mb-4 text-center">
              {selectedStrategies.length} selected
            </p>

            <div className="grid gap-3 max-h-[350px] overflow-y-auto">
              {FREE_STRATEGIES.map((strategy) => {
                const isSelected = selectedStrategies.includes(strategy.id);

                return (
                  <button
                    key={strategy.id}
                    onClick={() => toggleStrategy(strategy.id)}
                    className={`
                      flex items-center gap-4 p-4 rounded-lg border text-left transition-all
                      ${isSelected
                        ? 'bg-neon-green/10 border-neon-green/50'
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
            <h3 className="text-xl font-semibold text-white mb-2">You&apos;re Ready to Go! 🎉</h3>
            <p className="text-gray-400 mb-2">
              You&apos;ll start in <strong className="text-neon-green">Paper Trading Mode</strong> with $30,000 in virtual money.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              No real funds at risk - practice until you&apos;re confident!
            </p>

            <div className="bg-dark-bg/50 rounded-lg p-6 mb-6 text-left">
              <h4 className="font-medium text-white mb-4 text-center">What happens next:</h4>
              <ol className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <span><strong className="text-white">Dashboard</strong> - Watch opportunities appear and see paper trades execute in real-time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <span><strong className="text-white">Analytics</strong> - Track your strategy performance and P&L over time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <span><strong className="text-white">Settings → Secrets</strong> - Add API keys when you&apos;re ready for real trading</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                  <span><strong className="text-white">Go Live</strong> - Upgrade to Pro and switch to live trading with real funds</span>
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-left">
                <strong>Safety First:</strong> When you switch to live trading, ALL strategies start disabled. 
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
            {/* Skip this specific step */}
            {step.skippable && !isLastStep && (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                {step.skipText || 'Skip this step'}
              </button>
            )}
            {/* Skip entire wizard */}
            {onSkip && isFirstStep && (
              <button
                onClick={onSkip}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Skip setup entirely
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
