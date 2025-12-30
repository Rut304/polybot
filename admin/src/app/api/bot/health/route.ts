import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create supabase client lazily to avoid build-time errors
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ 
        healthy: false, 
        error: 'Database not configured' 
      }, { status: 500 });
    }

    // 1. Check polybot_status for running status and heartbeat
    const { data: statusData, error: statusError } = await supabase
      .from('polybot_status')
      .select('is_running, last_started_at, started_by, last_heartbeat_at, version')
      .limit(1)
      .single();

    if (statusError) {
      console.error('Error fetching bot status:', statusError);
    }

    // 2. Check for recent trades (last 24 hours) to verify bot activity
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count: recentTradeCount, error: tradeError } = await supabase
      .from('polybot_simulated_trades')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    if (tradeError) {
      console.error('Error fetching recent trades:', tradeError);
    }

    // 3. Check last trade timestamp
    const { data: lastTrade, error: lastTradeError } = await supabase
      .from('polybot_simulated_trades')
      .select('created_at, platform, strategy')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastTradeError && lastTradeError.code !== 'PGRST116') {
      console.error('Error fetching last trade:', lastTradeError);
    }

    // 4. Check for recent log entries
    const { data: recentLogs, error: logError } = await supabase
      .from('polybot_logs')
      .select('timestamp, level, message')
      .order('timestamp', { ascending: false })
      .limit(5);

    // 5. Check bot heartbeat from polybot_status.last_heartbeat_at
    // This is updated every 30 seconds by the bot
    const lastHeartbeatFromStatus = statusData?.last_heartbeat_at;
    const botVersion = statusData?.version;

    // Calculate health status
    const isRunning = statusData?.is_running || false;
    const lastStarted = statusData?.last_started_at;
    const lastTradeAt = lastTrade?.created_at;
    const lastHeartbeat = lastHeartbeatFromStatus;
    
    // Bot is considered healthy if:
    // 1. Status shows running
    // 2. Had a trade in last 24 hours OR has a heartbeat in last 2 minutes
    const hasRecentActivity = recentTradeCount && recentTradeCount > 0;
    const hasRecentHeartbeat = lastHeartbeat && 
      new Date(lastHeartbeat).getTime() > Date.now() - 2 * 60 * 1000;
    
    let healthStatus: 'healthy' | 'warning' | 'critical' | 'offline' = 'offline';
    let healthMessage = 'Bot is offline';
    
    if (isRunning) {
      if (hasRecentActivity || hasRecentHeartbeat) {
        healthStatus = 'healthy';
        healthMessage = 'Bot is running normally';
      } else if (lastTradeAt) {
        const hoursSinceLastTrade = (Date.now() - new Date(lastTradeAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastTrade < 6) {
          healthStatus = 'healthy';
          healthMessage = 'Bot is running with recent activity';
        } else if (hoursSinceLastTrade < 24) {
          healthStatus = 'warning';
          healthMessage = `No trades in ${Math.round(hoursSinceLastTrade)} hours`;
        } else {
          healthStatus = 'critical';
          healthMessage = `No trades in ${Math.round(hoursSinceLastTrade / 24)} days`;
        }
      } else {
        healthStatus = 'warning';
        healthMessage = 'Bot running but no trade history';
      }
    }

    // 6. Try to reach the bot's health endpoint directly (if on same network)
    let botEndpointStatus: 'reachable' | 'unreachable' | 'unknown' = 'unknown';
    const botHealthUrl = process.env.BOT_HEALTH_URL || null;
    
    if (botHealthUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${botHealthUrl}/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          botEndpointStatus = 'reachable';
          const botStatus = await response.json();
          // Override health status if we can reach the bot directly
          healthStatus = 'healthy';
          healthMessage = `Bot v${botStatus.version} (Build #${botStatus.build}) running`;
        }
      } catch (e) {
        botEndpointStatus = 'unreachable';
      }
    }

    return NextResponse.json({
      health: {
        status: healthStatus,
        message: healthMessage,
      },
      bot: {
        isRunning,
        lastStarted,
        startedBy: statusData?.started_by,
        endpoint: botEndpointStatus,
        version: botVersion,
      },
      activity: {
        tradesLast24h: recentTradeCount || 0,
        lastTradeAt,
        lastTradeStrategy: lastTrade?.strategy,
        lastTradePlatform: lastTrade?.platform,
      },
      heartbeat: lastHeartbeat ? {
        timestamp: lastHeartbeat,
        version: botVersion,
      } : null,
      recentLogs: recentLogs?.slice(0, 3) || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Bot health check failed:', error);
    return NextResponse.json({
      health: {
        status: 'critical',
        message: 'Health check failed',
      },
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
