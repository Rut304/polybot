'use client';

import { useState } from 'react';
import { useTier } from '@/lib/useTier';
import { AlertTriangle, Activity, Zap, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { LiveTradingGate } from './LiveTradingGate';
import { supabase } from '@/lib/supabase';

interface TradingModeToggleProps {
  compact?: boolean;
}

export function TradingModeToggle({ compact = false }: TradingModeToggleProps) {
  const { isSimulation, setTradingMode, isFree, isPro, tradesRemaining, profile } = useTier();
  const [isChanging, setIsChanging] = useState(false);
  const [showLiveGate, setShowLiveGate] = useState(false);

  const handleToggle = async () => {
    if (isSimulation) {
      // Switching to live - show the live trading gate modal
      if (isFree) {
        // Free users can't go live - do nothing, UI shows upgrade prompt
        return;
      }
      setShowLiveGate(true);
    } else {
      // Switching to simulation - no confirmation needed
      setIsChanging(true);
      try {
        await setTradingMode(true);
      } catch (err) {
        console.error('Failed to switch mode:', err);
      } finally {
        setIsChanging(false);
      }
    }
  };

  const handleLiveConfirm = async (enabledStrategies: string[]) => {
    setIsChanging(true);
    try {
      // First, disable ALL strategies (set to empty or all false)
      // Then enable only the selected ones
      if (profile?.id) {
        await supabase
          .from('polybot_user_config')
          .upsert({
            user_id: profile.id,
            // Store enabled strategies for live mode
            live_enabled_strategies: enabledStrategies,
            is_simulation: false,
            updated_at: new Date().toISOString(),
          });
      }
      
      await setTradingMode(false);
    } catch (err) {
      console.error('Failed to switch to live:', err);
    } finally {
      setIsChanging(false);
    }
  };

  if (compact) {
    return (
      <>
        <button
          onClick={handleToggle}
          disabled={isChanging || (isSimulation && isFree)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
            ${isSimulation 
              ? 'bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
            }
            ${isChanging ? 'opacity-50 cursor-wait' : ''}
            ${isSimulation && isFree ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={isSimulation && isFree ? 'Upgrade to Pro for live trading' : isSimulation ? 'Click to enable live trading' : 'Click to switch to paper trading'}
        >
          {isSimulation ? (
            <>
              <Activity className="w-3 h-3" />
              <span>Paper</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              <span>LIVE</span>
            </>
          )}
        </button>
        
        <LiveTradingGate
          isOpen={showLiveGate}
          onClose={() => setShowLiveGate(false)}
          onConfirm={handleLiveConfirm}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Trading Mode</span>
          {!isSimulation && (
            <span className="text-xs text-gray-500">
              {tradesRemaining === Infinity ? '∞' : tradesRemaining} trades left
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Paper Trading */}
          <button
            onClick={() => !isSimulation && handleToggle()}
            disabled={isChanging || isSimulation}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${isSimulation 
                ? 'bg-neon-green text-dark-bg' 
                : 'bg-dark-border text-gray-400 hover:bg-dark-border/80'
              }
            `}
          >
            <Activity className="w-4 h-4" />
            Paper Trading
          </button>

          {/* Live */}
          <button
            onClick={() => isSimulation && handleToggle()}
            disabled={isChanging || !isSimulation || isFree}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${!isSimulation 
                ? 'bg-red-500 text-white' 
                : isFree
                  ? 'bg-dark-border text-gray-500 cursor-not-allowed'
                  : 'bg-dark-border text-gray-400 hover:bg-dark-border/80'
              }
            `}
            title={isFree ? 'Upgrade to Pro for live trading' : ''}
          >
            <Zap className="w-4 h-4" />
            Live
            {isFree && <Lock className="w-3 h-3 ml-1" />}
          </button>
        </div>

        {/* Status messages */}
        {isSimulation && isFree && (
          <Link 
            href="/pricing"
            className="text-xs text-neon-purple flex items-center gap-1 hover:underline"
          >
            <Sparkles className="w-3 h-3" />
            Upgrade to Pro for live trading
          </Link>
        )}
        
        {!isSimulation && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Live trading uses real funds
          </p>
        )}
        
        {isSimulation && !isFree && (
          <p className="text-xs text-gray-500">
            Paper trading with $30,000 virtual balance
          </p>
        )}
      </div>

      <LiveTradingGate
        isOpen={showLiveGate}
        onClose={() => setShowLiveGate(false)}
        onConfirm={handleLiveConfirm}
      />
    </>
  );
}
