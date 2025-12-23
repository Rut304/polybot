'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VersionInfo {
  uiVersion: string;
  botVersion: string | null;
  botStatus: 'online' | 'offline' | 'unknown';
  isLatest: boolean;
}

// Current UI version - update this when deploying
export const UI_VERSION = 'v1.3.1';

export function VersionBadge() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    uiVersion: UI_VERSION,
    botVersion: null,
    botStatus: 'unknown',
    isLatest: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBotVersion = async () => {
      try {
        const response = await fetch('/api/bot/status');
        if (response.ok) {
          const data = await response.json();
          const botVersion = data.version || data.status?.version || null;
          // Bot returns status: "running" not is_running: true
          const isOnline = data.status === 'running' || data.is_running || data.status?.is_running || false;

          setVersionInfo({
            uiVersion: UI_VERSION,
            botVersion,
            botStatus: isOnline ? 'online' : 'offline',
            isLatest: true, // We'll assume latest for now
          });
        }
      } catch (error) {
        console.error('Failed to fetch bot version:', error);
        setVersionInfo(prev => ({ ...prev, botStatus: 'unknown' }));
      } finally {
        setLoading(false);
      }
    };

    fetchBotVersion();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBotVersion, 30000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeColor = (isLatest: boolean, status: string) => {
    if (status === 'offline') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (!isLatest) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-neon-green/20 text-neon-green border-neon-green/30';
  };

  return (
    <div className="flex items-center gap-2">
      {/* UI Version */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
          getBadgeColor(versionInfo.isLatest, 'online')
        )}
        title="Admin UI Version"
      >
        <span className="opacity-70">UI</span>
        <span>v{versionInfo.uiVersion}</span>
        {versionInfo.isLatest ? (
          <Check className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
      </div>

      {/* Bot Version */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
          loading
            ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            : getBadgeColor(true, versionInfo.botStatus)
        )}
        title={`Bot Status: ${versionInfo.botStatus}`}
      >
        <span className="opacity-70">Bot</span>
        {loading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : versionInfo.botVersion ? (
          <>
            <span>v{versionInfo.botVersion}</span>
            {versionInfo.botStatus === 'online' ? (
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>
    </div>
  );
}
