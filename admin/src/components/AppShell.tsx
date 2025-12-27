'use client';

import { Navigation } from '@/components/Navigation';
import { useBotStatus } from '@/lib/hooks';
import { isRecent } from '@/lib/utils';
import { AlertTriangle, DollarSign } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: botStatus } = useBotStatus();
  const isOnline = !!(botStatus?.is_running &&
    botStatus?.updated_at &&
    isRecent(botStatus.updated_at, 30000));

  // Check if we're in live trading mode
  const isLiveTrading = botStatus?.dry_run_mode === false;

  return (
    <div className="min-h-screen bg-dark-bg flex">
      <Navigation />
      <main className="flex-1 ml-56 mt-14 transition-all duration-300">
        {/* Live Trading Warning Banner */}
        {isLiveTrading && (
          <div className="sticky top-0 z-40 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span className="font-semibold">
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
