'use client';

import { Navigation } from '@/components/Navigation';
import { MobileNavigation } from '@/components/MobileNavigation';
import { useTier } from '@/lib/useTier';
import { AlertTriangle, DollarSign } from 'lucide-react';

/**
 * AppShell - Main layout wrapper
 * 
 * SOURCE OF TRUTH for trading mode: useTier().isSimulation from polybot_profiles.is_simulation
 * DO NOT use botStatus.dry_run_mode - that's for the bot process, not the user's mode
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isSimulation, isLoading } = useTier();

  // Check if we're in live trading mode (NOT simulation)
  const isLiveTrading = !isSimulation && !isLoading;

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <Navigation />
      </div>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Main Content */}
      <main className="flex-1 md:ml-56 mt-14 pb-20 md:pb-0 transition-all duration-300">
        {/* Live Trading Warning Banner */}
        {isLiveTrading && (
          <div className="sticky top-14 md:top-0 z-40 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span className="font-semibold text-sm md:text-base">
              🔴 LIVE TRADING MODE - Real money at risk
            </span>
            <DollarSign className="w-5 h-5" />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
