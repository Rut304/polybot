'use client';

import { useEffect, useState } from 'react';
import { useBotStatus, useBotConfig, useRealTimeStats } from '@/lib/hooks';
import { AlertTriangle, ShieldAlert, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CircuitBreakerStatus({ mode = 'floating' }: { mode?: 'floating' | 'banner' }) {
  const { data: status } = useBotStatus();
  const { data: config } = useBotConfig();
  const { data: stats } = useRealTimeStats();
  
  const [breakerState, setBreakerState] = useState<'normal' | 'warning' | 'halted'>('normal');
  const [reason, setReason] = useState('');
  
  // Calculate circuit breaker state locally based on rules
  // (Since Python bot logic matches this)
  useEffect(() => {
    if (!config || !stats) return;
    
    const dailyPnlPct = (stats.total_pnl / (config.polymarket_starting_balance || 1)) * 100;
    const maxDailyLoss = config.max_daily_loss || 5; // Default 5%
    
    // Check Daily Loss Circuit Breaker
    if (dailyPnlPct <= -maxDailyLoss) {
      setBreakerState('halted');
      setReason(`Daily Loss Limit Hit (${dailyPnlPct.toFixed(1)}% < -${maxDailyLoss}%)`);
      return;
    }
    
    // Check Warning Threshold (75% of max loss)
    if (dailyPnlPct <= -(maxDailyLoss * 0.75)) {
      setBreakerState('warning');
      setReason(`Approaching Loss Limit (${dailyPnlPct.toFixed(1)}%)`);
      return;
    }
    
    setBreakerState('normal');
    setReason('All Systems Normal');
  }, [config, stats]);

  if (breakerState === 'normal') return null;

  if (mode === 'banner') {
    return (
      <div className={`w-full p-4 mb-6 rounded-lg border flex items-center gap-3 ${
        breakerState === 'halted' 
          ? 'bg-red-500/20 border-red-500 text-red-200' 
          : 'bg-yellow-500/20 border-yellow-500 text-yellow-200'
      }`}>
        {breakerState === 'halted' ? <ShieldAlert className="w-8 h-8 shrink-0 animate-pulse" /> : <AlertTriangle className="w-8 h-8 shrink-0" />}
        <div className="flex-1">
          <h3 className="text-lg font-bold uppercase tracking-wider">
            CIRCUIT BREAKER: {breakerState === 'halted' ? 'TRADING HALTED' : 'WARNING'}
          </h3>
          <p className="font-mono text-sm opacity-90">{reason}</p>
        </div>
        {breakerState === 'halted' && (
          <div className="px-3 py-1 bg-red-500/30 rounded font-mono text-xs border border-red-500/50">
            AUTO-KILLSWITCH ACTIVE
          </div>
        )}
      </div>
    );
  }

  // Floating Mode (Bottom Right)
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-center gap-4 max-w-sm ${
          breakerState === 'halted'
            ? 'bg-red-950/90 border-red-500 text-red-100 shadow-red-900/20'
            : 'bg-yellow-950/90 border-yellow-500 text-yellow-100 shadow-yellow-900/20'
        }`}
      >
        <div className={`p-2 rounded-lg ${breakerState === 'halted' ? 'bg-red-500/20 animate-pulse' : 'bg-yellow-500/20'}`}>
          {breakerState === 'halted' ? <Zap className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Circuit Breaker</p>
          <p className="font-bold">{breakerState === 'halted' ? 'TRADING HALTED' : 'Risk Warning'}</p>
          <p className="text-xs font-mono opacity-80 mt-1">{reason}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
