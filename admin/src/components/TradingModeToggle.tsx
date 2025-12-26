'use client';

import { useState } from 'react';
import { useTier } from '@/lib/useTier';
import { AlertTriangle, Activity, Zap } from 'lucide-react';

interface TradingModeToggleProps {
  compact?: boolean;
}

export function TradingModeToggle({ compact = false }: TradingModeToggleProps) {
  const { isSimulation, setTradingMode, isFree, isPro, tradesRemaining } = useTier();
  const [isChanging, setIsChanging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    if (isSimulation) {
      // Switching to live - show confirmation
      if (isFree) {
        // Free users can't go live
        return;
      }
      setShowConfirm(true);
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

  const confirmLiveMode = async () => {
    setIsChanging(true);
    setShowConfirm(false);
    try {
      await setTradingMode(false);
    } catch (err) {
      console.error('Failed to switch to live:', err);
    } finally {
      setIsChanging(false);
    }
  };

  if (compact) {
    return (
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
        title={isSimulation && isFree ? 'Upgrade to Pro for live trading' : ''}
      >
        {isSimulation ? (
          <>
            <Activity className="w-3 h-3" />
            <span>Simulation</span>
          </>
        ) : (
          <>
            <Zap className="w-3 h-3" />
            <span>LIVE</span>
          </>
        )}
      </button>
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
          {/* Simulation */}
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
            Simulation
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
            {isFree && <span className="text-[10px] opacity-70">(Pro)</span>}
          </button>
        </div>

        {!isSimulation && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Live trading uses real funds
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Switch to Live Trading?</h3>
                <p className="text-sm text-gray-400">This will use real funds</p>
              </div>
            </div>

            <div className="bg-dark-bg/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300 mb-3">
                By switching to live mode:
              </p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  All trades will execute with real money
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  Your connected exchange accounts will be used
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  Losses are real and cannot be undone
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-dark-border text-gray-300 rounded-lg hover:bg-dark-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLiveMode}
                disabled={isChanging}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                {isChanging ? 'Switching...' : 'Enable Live Trading'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
