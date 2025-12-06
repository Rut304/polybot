'use client';

import { cn, timeAgo, isRecent } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff, DollarSign, FileText, AlertTriangle } from 'lucide-react';

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

      {/* Mode Badge - Paper Trading */}
      {dryRun ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
          <FileText className="w-4 h-4" />
          <span className="font-medium">Paper Trading</span>
        </div>
      ) : (
        /* Mode Badge - Live Trading - More prominent */
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-bold">LIVE TRADING</span>
          <DollarSign className="w-4 h-4" />
        </div>
      )}

      {/* Last Heartbeat */}
      {lastHeartbeat && (
        <div className="text-xs text-gray-500">
          Last update: {timeAgo(lastHeartbeat)}
        </div>
      )}
    </div>
  );
}
