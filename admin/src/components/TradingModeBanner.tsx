'use client';

import { useState } from 'react';
import { usePlatforms } from '@/lib/PlatformContext';
import { BookOpen, Zap, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

/**
 * TradingModeBanner - Shows current trading mode with explanation
 * 
 * SIMULATION MODE:
 * - Show ALL market data from ALL platforms
 * - Users can explore and learn without restrictions
 * - Paper trades can be placed on any platform
 * 
 * LIVE MODE:
 * - Only show data from connected platforms
 * - Real money trades only on connected platforms
 * - Filters applied automatically
 */
export function TradingModeBanner() {
  const { isSimulationMode, connectedIds, platforms, isLoading } = usePlatforms();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || isLoading) return null;

  const connectedPlatforms = platforms.filter(p => p.connected);
  const allPlatformsCount = platforms.length;

  if (isSimulationMode) {
    return (
      <div className="mb-6 bg-gradient-to-r from-neon-green/10 via-neon-green/5 to-transparent border border-neon-green/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-green/20 rounded-lg">
              <BookOpen className="w-5 h-5 text-neon-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neon-green">Simulation Mode</span>
                <span className="text-xs px-2 py-0.5 bg-neon-green/20 text-neon-green rounded-full">
                  Exploring {allPlatformsCount} platforms
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Viewing ALL market data to explore opportunities • No real money at risk
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-neon-green/10 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-neon-green/20 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">What you see:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Market data from all {allPlatformsCount} supported platforms</li>
                  <li>• Arbitrage opportunities across all exchanges</li>
                  <li>• Historical trades and performance (paper)</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Ready for live trading?</h4>
                <p className="text-sm text-gray-400 mb-2">
                  Connect your exchange APIs, then switch to Live Mode to trade with real money.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/secrets"
                    className="text-xs px-3 py-1.5 bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30 transition-colors inline-flex items-center gap-1"
                  >
                    Connect Exchanges <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Link
                    href="/settings"
                    className="text-xs px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIVE MODE
  return (
    <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-400">Live Trading Mode</span>
              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                {connectedIds.length} platform{connectedIds.length !== 1 ? 's' : ''} connected
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Showing data only from your connected platforms • Real money trades enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-amber-500/10 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-amber-500/20 pt-3">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Your connected platforms:</h4>
          <div className="flex flex-wrap gap-2">
            {connectedPlatforms.length > 0 ? (
              connectedPlatforms.map(p => (
                <span
                  key={p.id}
                  className="text-xs px-2 py-1 bg-amber-500/10 text-amber-300 rounded-lg border border-amber-500/20"
                >
                  {p.icon} {p.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No platforms connected</span>
            )}
          </div>
          {connectedIds.length < allPlatformsCount && (
            <p className="text-xs text-gray-500 mt-2">
              Connect more platforms to see more opportunities.{' '}
              <Link href="/secrets" className="text-amber-400 hover:underline">
                Add credentials →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact mode badge for headers/nav
 */
export function TradingModeIndicator() {
  const { isSimulationMode, connectedIds, isLoading } = usePlatforms();

  if (isLoading) {
    return (
      <div className="px-3 py-1.5 bg-dark-card rounded-lg animate-pulse">
        <div className="w-20 h-4 bg-dark-border rounded" />
      </div>
    );
  }

  if (isSimulationMode) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-green/10 border border-neon-green/30 rounded-lg">
        <BookOpen className="w-4 h-4 text-neon-green" />
        <span className="text-sm font-medium text-neon-green">Simulation</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <Zap className="w-4 h-4 text-amber-400" />
      <span className="text-sm font-medium text-amber-400">
        Live ({connectedIds.length})
      </span>
    </div>
  );
}
