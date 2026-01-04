'use client';

import { useState } from 'react';
import { Play, Rocket, AlertTriangle, CreditCard, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTier } from '@/lib/useTier';
import { useBotStatus } from '@/lib/hooks';
import { isRecent, cn } from '@/lib/utils';
import Link from 'next/link';

interface BotStartCTAProps {
  className?: string;
  onStart?: () => void;
}

export function BotStartCTA({ className, onStart }: BotStartCTAProps) {
  const { tier, isSimulation, canDoTrade, isPro, isElite, isFree, profile, isLoading: tierLoading } = useTier();
  const { data: botStatus, isLoading: statusLoading } = useBotStatus();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determine if bot is currently running
  // Be more lenient - if is_running is true, trust it even if heartbeat is a bit stale
  // Use 2 minute window instead of 30 seconds to reduce flashing
  const isOnline = !!(botStatus?.is_running &&
    botStatus?.updated_at &&
    isRecent(botStatus.updated_at, 120000)); // 2 minutes
  
  // SOURCE OF TRUTH for mode: useTier().isSimulation from polybot_profiles
  // NOT botStatus.dry_run_mode (that's for bot process, not user mode)
  const isLiveMode = !isSimulation && !tierLoading;

  // Check if user can start the bot
  const tradeCheck = canDoTrade(isLiveMode);

  const handleStartBot = async () => {
    setError(null);
    setSuccess(false);
    
    // Subscription check - free users can only use paper trading
    if (isFree && isLiveMode) {
      setError('Free tier users can only use paper trading. Upgrade to Pro to enable live trading.');
      return;
    }
    
    // Check if trading is allowed
    if (!tradeCheck.allowed) {
      setError(tradeCheck.reason || 'Trading not allowed');
      return;
    }

    setIsStarting(true);
    
    try {
      const response = await fetch('/api/bot/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start bot');
      }
      
      setSuccess(true);
      onStart?.();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to start bot');
    } finally {
      setIsStarting(false);
    }
  };

  // Don't show CTA if bot is already running OR if still loading
  // This prevents flashing during initial load
  if (statusLoading || tierLoading) {
    return null;
  }

  if (isOnline) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "bg-gradient-to-r from-neon-green/10 to-neon-blue/10 border border-neon-green/30 rounded-2xl p-6",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-neon-green/20">
            <CheckCircle2 className="w-6 h-6 text-neon-green" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Bot is Running</h3>
            <p className="text-sm text-gray-400">
              {isLiveMode ? 'Live trading mode' : 'Paper trading mode'} • Scanning for opportunities
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Show start CTA when bot is offline
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-neon-purple/20 via-dark-card to-neon-blue/20 border border-neon-purple/30 rounded-2xl p-8",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/30 border border-neon-purple/40">
              <Rocket className="w-8 h-8 text-neon-purple" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Start Your Trading Bot</h2>
              <p className="text-gray-400 max-w-md">
                {isFree 
                  ? 'Free tier includes paper trading. Upgrade to Pro for live trading.' 
                  : `Launch your bot in ${isSimulation ? 'paper' : 'live'} trading mode`}
              </p>
              
              {/* Subscription status badge */}
              <div className="flex items-center gap-2 mt-3">
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  isFree ? "bg-gray-500/20 text-gray-400" : 
                  isPro ? "bg-neon-blue/20 text-neon-blue" : 
                  "bg-neon-purple/20 text-neon-purple"
                )}>
                  {tier.toUpperCase()} TIER
                </span>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  isSimulation ? "bg-neon-green/20 text-neon-green" : "bg-red-500/20 text-red-400"
                )}>
                  {isSimulation ? 'PAPER MODE' : 'LIVE MODE'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto">
            {/* Start Bot Button */}
            <motion.button
              onClick={handleStartBot}
              disabled={isStarting}
              whileHover={{ scale: isStarting ? 1 : 1.02 }}
              whileTap={{ scale: isStarting ? 1 : 0.98 }}
              className={cn(
                "flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition-all",
                "bg-gradient-to-r from-neon-green to-neon-blue hover:shadow-lg hover:shadow-neon-green/30",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
                "text-white"
              )}
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Bot
                </>
              )}
            </motion.button>

            {/* Upgrade CTA for free users */}
            {isFree && (
              <Link
                href="/account?tab=subscription"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 transition-colors text-sm font-medium"
              >
                <CreditCard className="w-4 h-4" />
                Upgrade for Live Trading
              </Link>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Cannot Start Bot</p>
                <p className="text-red-400/80 text-sm">{error}</p>
              </div>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-neon-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-neon-green font-medium">Bot Starting</p>
                <p className="text-neon-green/80 text-sm">
                  Your trading bot is being deployed. It may take a minute to come online.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
