'use client';

import { Navigation } from '@/components/Navigation';
import { useBotStatus } from '@/lib/hooks';
import { isRecent } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: botStatus } = useBotStatus();
  const isOnline = !!(botStatus?.is_running && 
    botStatus?.last_heartbeat_at && 
    isRecent(botStatus.last_heartbeat_at, 30000));

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navigation />
      <main className="pl-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
