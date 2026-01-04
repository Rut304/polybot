'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface BotHealth {
  health: {
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    message: string;
  };
  bot: {
    isRunning: boolean;
    lastStarted: string | null;
    startedBy: string | null;
    endpoint: 'reachable' | 'unreachable' | 'unknown';
  };
  activity: {
    tradesLast24h: number;
    lastTradeAt: string | null;
    lastTradeStrategy: string | null;
    lastTradePlatform: string | null;
  };
  heartbeat: {
    timestamp: string;
    scanCount: number;
    activeStrategies: string[];
  } | null;
  recentLogs: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
  timestamp: string;
}

interface BotHealthIndicatorProps {
  className?: string;
  compact?: boolean;
  showDetails?: boolean;
  tradingMode?: 'paper' | 'live';
}

export function BotHealthIndicator({ 
  className, 
  compact = false,
  showDetails = true,
  tradingMode,
}: BotHealthIndicatorProps) {
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      
      // Get auth session for Bearer token
      const { data: { session } } = await supabase.auth.getSession();
      
      const url = tradingMode 
        ? `/api/bot/health?tradingMode=${tradingMode}`
        : '/api/bot/health';
      const response = await fetch(url, {
        credentials: 'include', // Include auth cookies
        headers: session?.access_token 
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {},
      });
      if (!response.ok) throw new Error('Failed to fetch bot health');
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [tradingMode]); // Re-fetch when tradingMode changes

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      case 'offline': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20';
      case 'warning': return 'bg-yellow-500/20';
      case 'critical': return 'bg-red-500/20';
      case 'offline': return 'bg-gray-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'offline': return <XCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading && !health) {
    return (
      <div className={cn("flex items-center gap-2 text-gray-500", className)}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking bot...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className={cn("flex items-center gap-2 text-red-500", className)}>
        <XCircle className="w-4 h-4" />
        <span className="text-sm">Health check failed</span>
      </div>
    );
  }

  const status = health.health.status;

  // Compact mode - just show status badge
  if (compact) {
    return (
      <button
        onClick={fetchHealth}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
          getStatusBgColor(status),
          getStatusColor(status),
          "hover:opacity-80",
          className
        )}
        title={health.health.message}
      >
        {getStatusIcon(status)}
        <span className="text-sm font-medium capitalize">{status}</span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
      </button>
    );
  }

  // Full mode with details
  return (
    <div className={cn(
      "rounded-lg border border-dark-border p-4",
      getStatusBgColor(status),
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className={cn("w-5 h-5", getStatusColor(status))} />
          <h3 className="font-semibold text-white">Bot Health</h3>
        </div>
        <button
          onClick={fetchHealth}
          className="p-1 hover:bg-dark-border rounded transition-colors"
          disabled={loading}
          title="Refresh health status"
          aria-label="Refresh health status"
        >
          <RefreshCw className={cn("w-4 h-4 text-gray-400", loading && "animate-spin")} />
        </button>
      </div>

      {/* Status Badge */}
      <div className={cn(
        "flex items-center gap-2 mb-4 px-3 py-2 rounded-md",
        status === 'healthy' && "bg-green-500/10 border border-green-500/30",
        status === 'warning' && "bg-yellow-500/10 border border-yellow-500/30",
        status === 'critical' && "bg-red-500/10 border border-red-500/30",
        status === 'offline' && "bg-gray-500/10 border border-gray-500/30"
      )}>
        {getStatusIcon(status)}
        <span className={cn("font-medium", getStatusColor(status))}>
          {health.health.message}
        </span>
      </div>

      {/* Stats Grid */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-3">
          {/* Trades 24h */}
          <div className="bg-dark-card/50 rounded-md p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Trades (24h)
            </div>
            <div className="text-xl font-bold text-white">
              {health.activity.tradesLast24h}
            </div>
          </div>

          {/* Last Trade */}
          <div className="bg-dark-card/50 rounded-md p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Last Trade
            </div>
            <div className="text-sm font-medium text-white">
              {formatTimeAgo(health.activity.lastTradeAt)}
            </div>
            {health.activity.lastTradeStrategy && (
              <div className="text-xs text-gray-500 truncate">
                {health.activity.lastTradeStrategy}
              </div>
            )}
          </div>

          {/* Running Since */}
          <div className="bg-dark-card/50 rounded-md p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity className="w-3 h-3" />
              Running Since
            </div>
            <div className="text-sm font-medium text-white">
              {formatTimeAgo(health.bot.lastStarted)}
            </div>
          </div>

          {/* Endpoint Status */}
          <div className="bg-dark-card/50 rounded-md p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <CheckCircle2 className="w-3 h-3" />
              Connection
            </div>
            <div className={cn(
              "text-sm font-medium",
              health.bot.endpoint === 'reachable' && "text-green-500",
              health.bot.endpoint === 'unreachable' && "text-red-500",
              health.bot.endpoint === 'unknown' && "text-gray-500"
            )}>
              {health.bot.endpoint === 'reachable' ? 'Connected' : 
               health.bot.endpoint === 'unreachable' ? 'Disconnected' : 'Unknown'}
            </div>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      {showDetails && health.recentLogs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <h4 className="text-xs text-gray-400 mb-2">Recent Activity</h4>
          <div className="space-y-1">
            {health.recentLogs.map((log, i) => (
              <div key={i} className="text-xs text-gray-500 truncate">
                <span className={cn(
                  "font-mono mr-2",
                  log.level === 'ERROR' && "text-red-500",
                  log.level === 'WARNING' && "text-yellow-500",
                  log.level === 'INFO' && "text-blue-500"
                )}>
                  [{log.level}]
                </span>
                {log.message?.substring(0, 50)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-3 text-xs text-gray-500 text-right">
        Updated {formatTimeAgo(health.timestamp)}
      </div>
    </div>
  );
}

// Mini version for header/navbar
export function BotHealthBadge() {
  const [health, setHealth] = useState<BotHealth | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/bot/health', {
          credentials: 'include', // Include auth cookies
        });
        if (response.ok) {
          setHealth(await response.json());
        }
      } catch {
        // Silently fail
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  const status = health.health.status;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        status === 'healthy' && "bg-green-500/20 text-green-500",
        status === 'warning' && "bg-yellow-500/20 text-yellow-500",
        status === 'critical' && "bg-red-500/20 text-red-500",
        status === 'offline' && "bg-gray-500/20 text-gray-500"
      )}
      title={health.health.message}
    >
      <span className={cn(
        "w-2 h-2 rounded-full",
        status === 'healthy' && "bg-green-500 animate-pulse",
        status === 'warning' && "bg-yellow-500",
        status === 'critical' && "bg-red-500 animate-pulse",
        status === 'offline' && "bg-gray-500"
      )} />
      Bot {status === 'healthy' ? 'Active' : status}
    </div>
  );
}
