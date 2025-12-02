'use client';

import { cn, timeAgo, isRecent } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface StatusIndicatorProps {
  isOnline?: boolean;
  lastHeartbeat?: string;
  dryRun?: boolean;
}

export function StatusIndicator({ isOnline, lastHeartbeat, dryRun }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Connection Status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
        isOnline 
          ? "bg-neon-green/10 text-neon-green" 
          : "bg-red-500/10 text-red-400"
      )}>
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Mode Badge */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
        dryRun 
          ? "bg-neon-yellow/10 text-neon-yellow" 
          : "bg-neon-pink/10 text-neon-pink"
      )}>
        {dryRun ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Paper Trading</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>Live Trading</span>
          </>
        )}
      </div>

      {/* Last Heartbeat */}
      {lastHeartbeat && (
        <div className="text-xs text-gray-500">
          Last update: {timeAgo(lastHeartbeat)}
        </div>
      )}
    </div>
  );
}
