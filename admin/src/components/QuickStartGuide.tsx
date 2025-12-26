'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Key,
  Target,
  Activity,
  TrendingUp,
  CheckCircle,
  ChevronRight,
  X,
  Zap,
  DollarSign,
  Shield,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useTier } from '@/lib/useTier';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isComplete?: boolean;
  priority: number;
}

// Floating action button that shows next steps
export function QuickStartFAB() {
  const { profile, isFree, isSimulation } = useTier();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if user has completed key steps
  const hasCompletedOnboarding = profile?.onboardingCompleted || false;

  const actions: QuickAction[] = [
    {
      id: 'secrets',
      title: 'Add API Keys',
      description: 'Connect Polymarket, Kalshi, or Alpaca',
      href: '/secrets',
      icon: Key,
      color: 'from-purple-500 to-blue-500',
      priority: 1,
    },
    {
      id: 'strategies',
      title: 'Configure Strategies',
      description: 'Choose which strategies to run',
      href: '/strategies',
      icon: Target,
      color: 'from-neon-green to-emerald-500',
      priority: 2,
    },
    {
      id: 'settings',
      title: 'Adjust Settings',
      description: 'Fine-tune position sizes and risk',
      href: '/settings',
      icon: Activity,
      color: 'from-yellow-500 to-orange-500',
      priority: 3,
    },
    {
      id: 'analytics',
      title: 'View Analytics',
      description: 'Track your performance',
      href: '/analytics',
      icon: TrendingUp,
      color: 'from-cyan-500 to-blue-500',
      priority: 4,
    },
  ];

  // Add upgrade CTA for free users
  if (isFree) {
    actions.unshift({
      id: 'upgrade',
      title: 'Upgrade to Pro',
      description: 'Unlock live trading & all strategies',
      href: '/pricing',
      icon: Sparkles,
      color: 'from-neon-purple to-pink-500',
      priority: 0,
    });
  }

  if (dismissed || hasCompletedOnboarding) return null;

  return (
    <>
      {/* FAB Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-neon-green to-neon-blue rounded-full shadow-lg shadow-neon-green/25 flex items-center justify-center"
      >
        <Zap className="w-6 h-6 text-white" />
      </motion.button>

      {/* Quick Actions Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-80 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Quick Start</h3>
                  <p className="text-xs text-gray-500">Get set up in minutes</p>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setDismissed(true);
                  }}
                  className="p-1 hover:bg-dark-border rounded transition-colors"
                  title="Close quick start"
                  aria-label="Close quick start"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="p-2">
                {actions.slice(0, 4).map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-border/50 transition-colors group"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm group-hover:text-neon-green transition-colors">
                        {action.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{action.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-neon-green transition-colors" />
                  </Link>
                ))}
              </div>

              {isSimulation && !isFree && (
                <div className="px-4 py-3 border-t border-dark-border bg-neon-green/5">
                  <p className="text-xs text-gray-400 mb-2">Ready for real trades?</p>
                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 text-sm text-neon-green font-medium hover:underline"
                  >
                    <Zap className="w-4 h-4" />
                    Switch to Live Trading
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Welcome banner for dashboard
export function WelcomeBanner() {
  const { profile, isFree, tier } = useTier();
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage for dismissal
  useEffect(() => {
    const isDismissed = localStorage.getItem('polybot_welcome_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('polybot_welcome_dismissed', 'true');
  };

  if (dismissed || profile?.onboardingCompleted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-gradient-to-r from-neon-green/10 via-neon-blue/10 to-neon-purple/10 border border-neon-green/20 rounded-xl p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Welcome to PolyParlay! 🎉
            </h2>
            <p className="text-sm text-gray-400 mb-3">
              You&apos;re in paper trading mode with $30,000 virtual balance. 
              Watch the bot find opportunities and execute paper trades.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/secrets"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-sm text-white hover:border-neon-green/50 transition-colors"
              >
                <Key className="w-4 h-4" />
                Add API Keys
              </Link>
              <Link
                href="/strategies"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-sm text-white hover:border-neon-green/50 transition-colors"
              >
                <Target className="w-4 h-4" />
                View Strategies
              </Link>
              {isFree && (
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-neon-purple to-pink-500 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-dark-card rounded transition-colors flex-shrink-0"
          title="Dismiss welcome banner"
          aria-label="Dismiss welcome banner"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </motion.div>
  );
}

// Step-by-step setup checklist
export function SetupChecklist() {
  const { profile, isFree, isSimulation } = useTier();
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [strategiesConfigured, setStrategiesConfigured] = useState(true); // Default enabled

  const steps = [
    {
      id: 'account',
      title: 'Create Account',
      description: 'Sign up with email',
      isComplete: true,
      href: null,
    },
    {
      id: 'wallet',
      title: 'Wallet Created',
      description: 'Non-custodial on Polygon',
      isComplete: !!profile?.walletAddress,
      href: null,
    },
    {
      id: 'api-keys',
      title: 'Add API Keys',
      description: 'Connect trading platforms',
      isComplete: apiKeysConfigured,
      href: '/secrets',
    },
    {
      id: 'strategies',
      title: 'Configure Strategies',
      description: 'Choose your approach',
      isComplete: strategiesConfigured,
      href: '/strategies',
    },
    {
      id: 'simulation',
      title: 'Run Paper Trading',
      description: 'Test with virtual money',
      isComplete: !isSimulation, // Complete once they've at least tried
      href: '/',
    },
  ];

  const completedSteps = steps.filter(s => s.isComplete).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Setup Progress</h3>
        <span className="text-sm text-neon-green">{completedSteps}/{steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-dark-border rounded-full mb-4 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-neon-green to-neon-blue rounded-full"
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`
              flex items-center gap-3 p-2 rounded-lg transition-colors
              ${step.isComplete ? 'opacity-60' : 'hover:bg-dark-border/50'}
            `}
          >
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
              ${step.isComplete 
                ? 'bg-neon-green/20 text-neon-green' 
                : 'bg-dark-border text-gray-500'
              }
            `}>
              {step.isComplete ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-xs font-bold">{index + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.isComplete ? 'text-gray-400 line-through' : 'text-white'}`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
            {step.href && !step.isComplete && (
              <Link
                href={step.href}
                className="text-xs text-neon-green hover:underline flex items-center gap-1"
              >
                Start
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Contextual CTA banners for different pages
interface PageCTAProps {
  page: 'dashboard' | 'analytics' | 'strategies' | 'history' | 'markets';
}

export function PageCTA({ page }: PageCTAProps) {
  const { isFree, isSimulation } = useTier();

  const ctas: Record<string, { show: boolean; content: JSX.Element }> = {
    dashboard: {
      show: isFree && isSimulation,
      content: (
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-neon-purple/10 to-pink-500/10 border border-neon-purple/20 rounded-lg">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-neon-purple" />
            <p className="text-sm text-gray-300">
              Ready to trade with real money? <span className="text-white font-medium">Upgrade to Pro</span> for live trading.
            </p>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-1.5 bg-gradient-to-r from-neon-purple to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
          >
            Upgrade
          </Link>
        </div>
      ),
    },
    analytics: {
      show: isSimulation,
      content: (
        <div className="flex items-center justify-between p-3 bg-neon-blue/10 border border-neon-blue/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-neon-blue" />
            <p className="text-sm text-gray-300">
              Viewing <span className="text-neon-green font-medium">paper trading</span> results. 
              {isFree ? ' Upgrade to Pro to see live analytics.' : ' Switch to live mode to see real performance.'}
            </p>
          </div>
          {isFree ? (
            <Link
              href="/pricing"
              className="px-4 py-1.5 bg-neon-blue text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
            >
              Upgrade
            </Link>
          ) : (
            <Link
              href="/settings"
              className="px-4 py-1.5 bg-dark-border text-white text-sm font-medium rounded-lg hover:bg-dark-border/80 transition-colors flex-shrink-0"
            >
              Go Live
            </Link>
          )}
        </div>
      ),
    },
    strategies: {
      show: isFree,
      content: (
        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-gray-300">
              Free tier includes <span className="text-white font-medium">3 strategies</span>. 
              Unlock all 15+ strategies with Pro.
            </p>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-1.5 bg-amber-500 text-dark-bg text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors flex-shrink-0"
          >
            See All
          </Link>
        </div>
      ),
    },
    history: {
      show: isSimulation,
      content: (
        <div className="flex items-center justify-between p-3 bg-neon-green/10 border border-neon-green/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-neon-green" />
            <p className="text-sm text-gray-300">
              These are <span className="text-neon-green font-medium">paper trades</span> - no real money involved.
            </p>
          </div>
        </div>
      ),
    },
    markets: {
      show: true,
      content: (
        <div className="flex items-center justify-between p-3 bg-dark-card border border-dark-border rounded-lg">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-neon-green" />
            <p className="text-sm text-gray-300">
              Click on any market to add to your <span className="text-white font-medium">watchlist</span> or place a manual trade.
            </p>
          </div>
          <Link
            href="/watchlist"
            className="px-4 py-1.5 bg-dark-border text-white text-sm font-medium rounded-lg hover:bg-dark-border/80 transition-colors flex-shrink-0"
          >
            Watchlist
          </Link>
        </div>
      ),
    },
  };

  const cta = ctas[page];
  if (!cta || !cta.show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      {cta.content}
    </motion.div>
  );
}
