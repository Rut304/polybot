'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SimulatedTrade, SimulationStats, BotStatus, Opportunity } from './supabase';
import { useAuth } from './auth';

// ==================== QUERIES ====================

// Fetch bot status from database
// Fetch bot status from database
export function useBotStatus() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['botStatus', user?.id],
    queryFn: async (): Promise<BotStatus | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('polybot_status')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bot status:', error);
        return null;
      }
      return data || {
        user_id: user.id,
        is_running: false,
        mode: 'simulation',
        polymarket_connected: false,
        kalshi_connected: false,
      };
    },
    enabled: !!user,
    refetchInterval: 2000,
  });
}

// Fetch bot version from the running bot
interface BotVersionInfo {
  status: string;
  version: string;
  build?: number;
  fullVersion?: string;
  error?: string;
}

export function useBotVersion() {
  return useQuery({
    queryKey: ['botVersion'],
    queryFn: async (): Promise<BotVersionInfo> => {
      const response = await fetch('/api/bot/status');
      if (!response.ok) {
        throw new Error('Failed to fetch bot version');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
}

// Fetch latest simulation stats
export function useSimulationStats() {
  return useQuery({
    queryKey: ['simulationStats'],
    queryFn: async (): Promise<SimulationStats | null> => {
      const { data, error } = await supabase
        .from('polybot_simulation_stats')
        .select('*')
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error fetching simulation stats:', error);
        return null;
      }
      return data;
    },
    refetchInterval: 5000,
  });
}

// Fetch simulation stats history for charts
export function useSimulationHistory(hours: number = 24) {
  return useQuery({
    queryKey: ['simulationHistory', hours],
    queryFn: async (): Promise<SimulationStats[]> => {
      const since = new Date();
      since.setHours(since.getHours() - hours);
      
      const { data, error } = await supabase
        .from('polybot_simulation_stats')
        .select('*')
        .gte('snapshot_at', since.toISOString())
        .order('snapshot_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching simulation history:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// Fetch simulated trades with optional trading mode filter
// Multi-tenant: Filters by user_id via RLS (Supabase automatically filters based on auth.uid())
export function useSimulatedTrades(limit: number = 50, tradingMode?: 'paper' | 'live') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['simulatedTrades', limit, tradingMode, user?.id],
    queryFn: async (): Promise<SimulatedTrade[]> => {
      if (!user) return [];
      
      let query = supabase
        .from('polybot_simulated_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // Filter by trading mode if specified
      if (tradingMode) {
        query = query.eq('trading_mode', tradingMode);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching simulated trades:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Fetch opportunities (with optional timeframe filter)
// Multi-tenant: Filters by user_id
export function useOpportunities(limit: number = 100, timeframeHours?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['opportunities', limit, timeframeHours, user?.id],
    queryFn: async (): Promise<Opportunity[]> => {
      if (!user) return [];
      
      let query = supabase
        .from('polybot_opportunities')
        .select('*')
        .eq('user_id', user.id);
      
      // Apply timeframe filter if specified (0 = all time)
      if (timeframeHours && timeframeHours > 0) {
        const since = new Date();
        since.setHours(since.getHours() - timeframeHours);
        query = query.gte('detected_at', since.toISOString());
      }
      
      const { data, error } = await query
        .order('detected_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching opportunities:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 3000,
  });
}

export interface StrategyStats {
  strategy: string;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_volume: number;
  avg_trade_pnl?: number;
  best_trade?: number;
  worst_trade?: number;
  win_rate_pct?: number;
}

// Fetch server-side computed strategy performance (100% accurate across full history)
// Multi-tenant: Uses user-filtered view
export function useStrategyPerformance(tradingMode?: 'paper' | 'live') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['strategyPerformance', tradingMode, user?.id],
    queryFn: async (): Promise<StrategyStats[]> => {
      if (!user) return [];
      
      // Use the multi-tenant view which filters by user_id
      let query = supabase
        .from('polybot_strategy_performance_user')
        .select('*')
        .eq('user_id', user.id);
      
      // Filter by trading mode if specified
      if (tradingMode) {
        query = query.eq('trading_mode', tradingMode);
      }
      
      const { data, error } = await query;
      
      // Fallback to old view if new one doesn't exist
      if (error && error.code === '42P01') {
        // Table doesn't exist, use old view
        let oldQuery = supabase
          .from('polybot_strategy_performance')
          .select('*');
        
        if (tradingMode) {
          oldQuery = oldQuery.eq('trading_mode', tradingMode);
        }
        
        const { data: oldData, error: oldError } = await oldQuery;
        if (oldError) {
          console.error('Error fetching strategy stats:', oldError);
          return [];
        }
        return oldData || [];
      }
      
      if (error) {
        console.error('Error fetching strategy stats:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Compute P&L history from actual trades (accurate, not stale stats table)
export function usePnLHistory(hours: number = 24, tradingMode?: 'paper' | 'live') {
  const { data: trades = [] } = useSimulatedTrades(500, tradingMode);
  const { data: config } = useBotConfig();
  
  return useQuery({
    queryKey: ['pnlHistory', trades.length, hours, tradingMode, config?.polymarket_starting_balance],
    queryFn: () => {
      // Calculate TOTAL starting balance across all 6 platforms
      const polyStarting = config?.polymarket_starting_balance || 5000;
      const kalshiStarting = config?.kalshi_starting_balance || 5000;
      const binanceStarting = config?.binance_starting_balance || 5000;
      const coinbaseStarting = config?.coinbase_starting_balance || 5000;
      const alpacaStarting = config?.alpaca_starting_balance || 5000;
      const ibkrStarting = config?.ibkr_starting_balance || 5000;
      const startingBalance = polyStarting + kalshiStarting + binanceStarting + coinbaseStarting + alpacaStarting + ibkrStarting;
      
      // Filter trades within the time window
      const since = new Date();
      since.setHours(since.getHours() - hours);
      
      // Sort trades by time ascending
      const sortedTrades = [...trades]
        .filter(t => t.outcome !== 'failed_execution')
        .filter(t => new Date(t.created_at) >= since)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Build cumulative P&L data points
      let cumulativePnl = 0;
      const dataPoints = sortedTrades.map(trade => {
        cumulativePnl += (trade.actual_profit_usd || 0);
        return {
          snapshot_at: trade.created_at,
          total_pnl: cumulativePnl,
          simulated_balance: startingBalance + cumulativePnl,
          total_trades: sortedTrades.indexOf(trade) + 1,
        };
      });
      
      // If no trades, return starting point
      if (dataPoints.length === 0) {
        return [{
          snapshot_at: new Date().toISOString(),
          total_pnl: 0,
          simulated_balance: startingBalance,
          total_trades: 0,
        }];
      }
      
      return dataPoints;
    },
    enabled: trades.length >= 0,
    refetchInterval: 5000,
  });
}

// Default starting balance - fallback if not set in config
// Default is $30K total ($5K per platform x 6 platforms)
const DEFAULT_STARTING_BALANCE = 30000;

// Compute real-time stats from database aggregates (100% accurate)
// Uses polybot_strategy_performance view for totals, recent trades for details
// Multi-tenant: All queries filter by user_id
export function useRealTimeStats(timeframeHours?: number, tradingMode?: 'paper' | 'live') {
  const { user } = useAuth();
  const { data: recentTrades = [] } = useSimulatedTrades(100, tradingMode); // Just for recent activity display
  const { data: opportunities = [] } = useOpportunities(1000, timeframeHours);
  const { data: config } = useBotConfig(); // Get starting balance from config
  
  return useQuery({
    queryKey: ['realTimeStats', timeframeHours, tradingMode, user?.id, config?.polymarket_starting_balance, config?.kalshi_starting_balance, config?.binance_starting_balance, config?.coinbase_starting_balance, config?.alpaca_starting_balance, config?.ibkr_starting_balance],
    queryFn: async () => {
      if (!user) return null;
      
      // Calculate TOTAL starting balance across all platforms (including IBKR)
      const polyStarting = config?.polymarket_starting_balance || 5000;
      const kalshiStarting = config?.kalshi_starting_balance || 5000;
      const binanceStarting = config?.binance_starting_balance || 5000;
      const coinbaseStarting = config?.coinbase_starting_balance || 5000;
      const alpacaStarting = config?.alpaca_starting_balance || 5000;
      const ibkrStarting = config?.ibkr_starting_balance || 5000;
      
      const startingBalance = polyStarting + kalshiStarting + binanceStarting + coinbaseStarting + alpacaStarting + ibkrStarting;
      
      // Fetch accurate totals from database aggregate view (filtered by user_id and trading mode)
      let strategyQuery = supabase
        .from('polybot_strategy_performance_user')
        .select('*')
        .eq('user_id', user.id);
      
      // Filter by trading mode if specified
      if (tradingMode) {
        strategyQuery = strategyQuery.eq('trading_mode', tradingMode);
      }
      
      let strategyPerf: any[] | null = null;
      const { data: strategyData, error: perfError } = await strategyQuery;
      
      // Fallback to old view if new one doesn't exist
      if (perfError && perfError.code === '42P01') {
        let oldQuery = supabase
          .from('polybot_strategy_performance')
          .select('*');
        if (tradingMode) {
          oldQuery = oldQuery.eq('trading_mode', tradingMode);
        }
        const { data: oldData } = await oldQuery;
        strategyPerf = oldData;
      } else if (perfError) {
        console.error('Error fetching strategy performance:', perfError);
      } else {
        strategyPerf = strategyData;
      }
      
      // Fetch ACTUAL opportunities count from database (not limited array)
      // Multi-tenant: Filter by user_id
      let opportunitiesCount = opportunities.length;
      if (timeframeHours && timeframeHours > 0) {
        const since = new Date();
        since.setHours(since.getHours() - timeframeHours);
        const { count, error: countError } = await supabase
          .from('polybot_opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('detected_at', since.toISOString());
        if (!countError && count !== null) {
          opportunitiesCount = count;
        }
      } else {
        // All-time count
        const { count, error: countError } = await supabase
          .from('polybot_opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (!countError && count !== null) {
          opportunitiesCount = count;
        }
      }
      
      // Aggregate all strategies for overall totals
      const totalPnl = strategyPerf?.reduce((sum, s) => sum + (s.total_pnl || 0), 0) || 0;
      const totalTrades = strategyPerf?.reduce((sum, s) => sum + (s.total_trades || 0), 0) || 0;
      const winningTrades = strategyPerf?.reduce((sum, s) => sum + (s.winning_trades || 0), 0) || 0;
      const losingTrades = strategyPerf?.reduce((sum, s) => sum + (s.losing_trades || 0), 0) || 0;
      const bestTradeProfit = strategyPerf?.reduce((best, s) => Math.max(best, s.best_trade || 0), 0) || 0;
      const worstTradeLoss = strategyPerf?.reduce((worst, s) => Math.min(worst, s.worst_trade || 0), 0) || 0;
      
      // If timeframe filter is set, also fetch filtered data
      let filteredPnl = totalPnl;
      let filteredTrades = totalTrades;
      let filteredWinning = winningTrades;
      let filteredLosing = losingTrades;
      
      if (timeframeHours && timeframeHours > 0) {
        const since = new Date();
        since.setHours(since.getHours() - timeframeHours);
        
        // Fetch trades within timeframe for filtered stats (multi-tenant)
        let tradesQuery = supabase
          .from('polybot_simulated_trades')
          .select('actual_profit_usd, outcome, trading_mode')
          .eq('user_id', user.id)
          .gte('created_at', since.toISOString());
        
        // Filter by trading mode if specified
        if (tradingMode) {
          tradesQuery = tradesQuery.eq('trading_mode', tradingMode);
        }
        
        const { data: filteredTradesData, error: tradesError } = await tradesQuery;
        
        if (!tradesError && filteredTradesData) {
          const validTrades = filteredTradesData.filter(t => t.outcome !== 'failed_execution');
          filteredPnl = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
          filteredTrades = validTrades.length;
          filteredWinning = validTrades.filter(t => t.outcome === 'won').length;
          filteredLosing = validTrades.filter(t => t.outcome === 'lost').length;
        }
      }
      
      // Calculate derived metrics
      const currentBalance = startingBalance + totalPnl;
      const roiPct = (totalPnl / startingBalance) * 100;
      const resolvedTrades = winningTrades + losingTrades;
      const winRate = resolvedTrades > 0 ? (winningTrades / resolvedTrades) * 100 : 0;
      
      // Pending trades from recent trades
      const pendingTrades = recentTrades.filter(t => t.outcome === 'pending').length;
      const failedExecutions = recentTrades.filter(t => t.outcome === 'failed_execution').length;
      
      return {
        // Core metrics - from database aggregates (100% accurate)
        simulated_balance: currentBalance,
        total_pnl: timeframeHours && timeframeHours > 0 ? filteredPnl : totalPnl,
        total_trades: timeframeHours && timeframeHours > 0 ? filteredTrades : totalTrades,
        win_rate: winRate,
        
        // Detailed counts
        winning_trades: timeframeHours && timeframeHours > 0 ? filteredWinning : winningTrades,
        losing_trades: timeframeHours && timeframeHours > 0 ? filteredLosing : losingTrades,
        pending_trades: pendingTrades,
        failed_executions: failedExecutions,
        
        // Derived metrics
        roi_pct: roiPct,
        total_opportunities_seen: opportunitiesCount,
        best_trade_profit: bestTradeProfit,
        worst_trade_loss: worstTradeLoss,
        
        // All-time totals (always accurate regardless of filter)
        all_time_pnl: totalPnl,
        all_time_trades: totalTrades,
        all_time_balance: currentBalance,
        
        // Starting balance for reference
        starting_balance: startingBalance,
        
        // Stats JSON for backwards compatibility
        stats_json: {
          simulated_starting_balance: String(startingBalance),
          simulated_current_balance: String(currentBalance),
        },
      };
    },
    refetchInterval: 5000,
  });
}

// Fetch opportunity stats for charts
// Multi-tenant: Filters by user_id
export function useOpportunityStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['opportunityStats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('polybot_opportunities')
        .select('profit_percent, buy_platform, sell_platform, detected_at')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('Error fetching opportunity stats:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });
}

// Fallback: Compute strategy performance from raw trades table
async function computeStrategyPerformanceFromTrades(tradingMode?: 'paper' | 'live') {
  let query = supabase
    .from('polybot_simulated_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (tradingMode) {
    query = query.eq('trading_mode', tradingMode);
  }
  
  const { data: trades, error } = await query;
  
  if (error || !trades) {
    console.error('Error computing strategy performance:', error);
    return [];
  }
  
  // Group by strategy
  const strategyMap = new Map<string, {
    trading_mode: string;
    strategy: string;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    total_pnl: number;
    profits: number[];
    first_trade_at: string;
    last_trade_at: string;
  }>();
  
  trades.forEach(trade => {
    const strategy = trade.strategy_type || trade.arbitrage_type || trade.trade_type || 'unknown';
    const mode = trade.trading_mode || 'paper';
    const key = `${mode}:${strategy}`;
    
    if (!strategyMap.has(key)) {
      strategyMap.set(key, {
        trading_mode: mode,
        strategy,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_pnl: 0,
        profits: [],
        first_trade_at: trade.created_at,
        last_trade_at: trade.created_at,
      });
    }
    
    const stats = strategyMap.get(key)!;
    stats.total_trades++;
    
    if (trade.outcome === 'won') stats.winning_trades++;
    if (trade.outcome === 'lost') stats.losing_trades++;
    
    const profit = trade.actual_profit_usd || 0;
    stats.total_pnl += profit;
    stats.profits.push(profit);
    
    if (new Date(trade.created_at) > new Date(stats.last_trade_at)) {
      stats.last_trade_at = trade.created_at;
    }
    if (new Date(trade.created_at) < new Date(stats.first_trade_at)) {
      stats.first_trade_at = trade.created_at;
    }
  });
  
  // Convert to array format
  return Array.from(strategyMap.values()).map(s => ({
    trading_mode: s.trading_mode,
    strategy: s.strategy,
    total_trades: s.total_trades,
    winning_trades: s.winning_trades,
    losing_trades: s.losing_trades,
    win_rate_pct: s.winning_trades + s.losing_trades > 0 
      ? (s.winning_trades / (s.winning_trades + s.losing_trades)) * 100 
      : 0,
    total_pnl: s.total_pnl,
    avg_trade_pnl: s.profits.length > 0 ? s.total_pnl / s.profits.length : 0,
    best_trade: Math.max(...s.profits, 0),
    worst_trade: Math.min(...s.profits, 0),
    first_trade_at: s.first_trade_at,
    last_trade_at: s.last_trade_at,
  }));
}

// Aggregate stats
// Multi-tenant: Filters by user_id
export function useAggregateStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['aggregateStats', user?.id],
    queryFn: async () => {
      if (!user) return { totalTrades: 0, totalOpportunities: 0, avgTopProfit: 0 };
      
      // Get counts (filtered by user_id)
      const [tradesResult, oppsResult] = await Promise.all([
        supabase.from('polybot_simulated_trades').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('polybot_opportunities').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      
      // Get recent high-profit opportunities (filtered by user_id)
      const { data: topOpps } = await supabase
        .from('polybot_opportunities')
        .select('profit_percent')
        .eq('user_id', user.id)
        .order('profit_percent', { ascending: false })
        .limit(10);
      
      const avgProfit = topOpps?.length 
        ? topOpps.reduce((a, b) => a + (b.profit_percent || 0), 0) / topOpps.length
        : 0;
      
      return {
        totalTrades: tradesResult.count || 0,
        totalOpportunities: oppsResult.count || 0,
        avgTopProfit: avgProfit,
      };
    },
    enabled: !!user,
    refetchInterval: 10000,
  });
}

// Fetch missed money stats (RPC)
// Fetch missed money stats (RPC)
export interface MissedMoneyStats {
  missed_money: number;
  opportunities_count: number;
  executed_count: number;
  conversion_rate: number;
  actual_pnl: number;
}

export function useMissedMoney(hours: number = 24) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['missedMoney', hours, user?.id],
    queryFn: async (): Promise<MissedMoneyStats | null> => {
      if (!user?.id) return null;
      
      try {
        // Calculate missed money directly from opportunities table (multi-tenant)
        const since = new Date();
        since.setHours(since.getHours() - hours);
        
        const { data: opps, error } = await supabase
          .from('polybot_opportunities')
          .select('status, profit_percent')
          .eq('user_id', user.id)
          .gte('created_at', since.toISOString());

        if (error) {
          console.error('Error fetching opportunities for missed money:', error);
          return null;
        }
        
        const opportunities = opps || [];
        const totalOpps = opportunities.length;
        const executedCount = opportunities.filter(o => o.status === 'executed').length;
        const missedProfitPct = opportunities
          .filter(o => o.status !== 'executed')
          .reduce((sum, o) => sum + (o.profit_percent || 0), 0);
        const actualPnlPct = opportunities
          .filter(o => o.status === 'executed')
          .reduce((sum, o) => sum + (o.profit_percent || 0), 0);
        
        return {
          missed_money: missedProfitPct * 100, // Convert to dollar-like amount
          opportunities_count: totalOpps,
          executed_count: executedCount,
          conversion_rate: totalOpps > 0 ? Math.round(executedCount / totalOpps * 1000) / 10 : 0,
          actual_pnl: actualPnlPct * 100,
        };
      } catch (err) {
        console.warn('Missed money calculation failed', err);
        return null;
      }
    },
    refetchInterval: 10000,
    enabled: !!user?.id
  });
}

// Fetch bot configuration
// Fetch bot configuration
export function useBotConfig() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['botConfig', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bot config:', error);
        return null;
      }
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });
}

// Fetch user positions (active bets from simulated trades)
// Multi-tenant: Filters by user_id
export function usePositions(tradingMode?: 'paper' | 'live') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['positions', tradingMode, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Query pending (open) trades from simulated_trades (filtered by user_id)
      let query = supabase
        .from('polybot_simulated_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('outcome', 'pending');
      
      // Filter by trading mode if specified
      if (tradingMode) {
        query = query.eq('trading_mode', tradingMode);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching positions:', error);
        return [];
      }
      
      // Map to position format
      return (data || []).map((trade: any) => {
        let platform = 'Kalshi';
        if (trade.arbitrage_type?.includes('poly')) {
          platform = 'Polymarket';
        } else if (trade.arbitrage_type?.includes('binance') || trade.trade_type?.includes('funding')) {
          platform = 'Binance';
        }
        
        const entryPrice = parseFloat(trade.polymarket_yes_price) || parseFloat(trade.kalshi_yes_price) || 0;
        const size = parseFloat(trade.position_size_usd) || 0;
        
        return {
          id: trade.id?.toString(),
          position_id: trade.position_id,
          platform,
          market: trade.polymarket_market_title || trade.kalshi_market_title || 'Unknown',
          market_id: trade.polymarket_token_id || trade.kalshi_ticker,
          side: trade.polymarket_yes_price > 0 ? 'yes' : 'no',
          cost_basis: size,
          current_value: size,
          avg_price: entryPrice,
          current_price: entryPrice,
          unrealized_pnl: parseFloat(trade.actual_profit_usd) || 0,
          strategy: trade.arbitrage_type || trade.trade_type || 'unknown',
          is_automated: true,
          created_at: trade.created_at,
        };
      });
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Fetch disabled markets
// Multi-tenant: Filters by user_id
export function useDisabledMarkets() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['disabledMarkets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('polybot_disabled_markets')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching disabled markets:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

// Fetch market cache for manual trading
// NOTE: Market cache is shared across all users (not multi-tenant)
export function useMarketCache(platform?: string) {
  return useQuery({
    queryKey: ['marketCache', platform],
    queryFn: async () => {
      let query = supabase
        .from('polybot_markets_cache')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(200);
      
      if (platform) {
        query = query.eq('platform', platform);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching market cache:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// Fetch manual trades
// Multi-tenant: Filters by user_id
export function useManualTrades(limit: number = 50) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['manualTrades', limit, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('polybot_manual_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching manual trades:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// ==================== MUTATIONS ====================

// Update bot config
export function useUpdateBotConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (config: {
      polymarket_enabled?: boolean;
      kalshi_enabled?: boolean;
      min_profit_percent?: number;
      max_trade_size?: number;
      max_daily_loss?: number;
      scan_interval?: number;
      [key: string]: any; // Allow other config keys
    }) => {
      if (!user) throw new Error('User not authenticated');

      // Sanitize config - remove system fields that shouldn't be manually upserted
      const { id, created_at, updated_at, user_id: _, ...cleanConfig } = config;

      console.log('useUpdateBotConfig: Sending upsert to Supabase:', { cleanConfig });

      const { error } = await supabase
        .from('polybot_config')
        .upsert({ 
          user_id: user.id, 
          ...cleanConfig, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
    },
  });
}

// Update bot status (start/stop)
export function useUpdateBotStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (status: {
      is_running?: boolean;
      mode?: string;
      dry_run_mode?: boolean;
      require_approval?: boolean;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('polybot_status')
        .upsert({ 
          user_id: user.id, 
          ...status, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botStatus'] });
    },
  });
}

// Place manual trade
// Multi-tenant: Includes user_id in trade records
export function usePlaceManualTrade() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (trade: {
      platform: 'polymarket' | 'kalshi';
      market_id: string;
      market_title: string;
      side: 'yes' | 'no';
      action: 'buy' | 'sell';
      quantity: number;
      price: number;
      notes?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      const total_cost = trade.quantity * trade.price;
      
      const { data, error } = await supabase
        .from('polybot_manual_trades')
        .insert({
          ...trade,
          user_id: user.id,
          total_cost,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Also create a position record for tracking (with user_id)
      await supabase
        .from('polybot_positions')
        .upsert({
          user_id: user.id,
          position_id: `MANUAL-${Date.now()}`,
          platform: trade.platform,
          market_id: trade.market_id,
          market_title: trade.market_title,
          side: trade.side,
          quantity: trade.action === 'buy' ? trade.quantity : -trade.quantity,
          avg_price: trade.price,
          current_price: trade.price,
          cost_basis: total_cost,
          current_value: total_cost,
          unrealized_pnl: 0,
          is_automated: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      // Simulate trade being filled immediately (for paper trading)
      await supabase
        .from('polybot_manual_trades')
        .update({
          status: 'filled',
          filled_at: new Date().toISOString(),
          filled_price: trade.price,
          filled_quantity: trade.quantity,
        })
        .eq('id', data.id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manualTrades'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['simulatedTrades'] });
    },
  });
}

// Toggle market disabled status
export function useToggleMarketDisabled() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ marketId, disable, platform, reason }: { 
      marketId: string; 
      disable: boolean;
      platform?: string;
      reason?: string;
    }) => {
      if (disable) {
        const { error } = await supabase
          .from('polybot_disabled_markets')
          .insert({ 
            market_id: marketId, 
            platform,
            reason,
            disabled_at: new Date().toISOString() 
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('polybot_disabled_markets')
          .delete()
          .eq('market_id', marketId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabledMarkets'] });
    },
  });
}

// Reset simulation - clears all trades and resets balance to $5,000
// Uses server-side API for proper audit logging and validation
export function useResetSimulation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const response = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset simulation');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulationStats'] });
      queryClient.invalidateQueries({ queryKey: ['simulationHistory'] });
      queryClient.invalidateQueries({ queryKey: ['simulatedTrades'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['aggregateStats'] });
      queryClient.invalidateQueries({ queryKey: ['botStatus'] });
      queryClient.invalidateQueries({ queryKey: ['realTimeStats'] });
    },
  });
}

// ==================== WATCHLIST ====================

// Fetch watchlist items
export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_watchlist')
        .select('*')
        .order('added_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching watchlist:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// Add to watchlist
export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: {
      market_id: string;
      platform: 'polymarket' | 'kalshi';
      market_title: string;
      category?: string;
      notes?: string;
      alert_above?: number;
      alert_below?: number;
    }) => {
      const { error } = await supabase
        .from('polybot_watchlist')
        .insert({
          ...item,
          added_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

// Remove from watchlist
export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (marketId: string) => {
      const { error } = await supabase
        .from('polybot_watchlist')
        .delete()
        .eq('market_id', marketId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

// Update watchlist item (notes, alerts)
export function useUpdateWatchlistItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ marketId, updates }: {
      marketId: string;
      updates: {
        notes?: string;
        alert_above?: number;
        alert_below?: number;
      };
    }) => {
      const { error } = await supabase
        .from('polybot_watchlist')
        .update(updates)
        .eq('market_id', marketId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

// ==================== PER-MARKET ANALYTICS ====================

// Get performance stats grouped by market
export function useMarketPerformance() {
  return useQuery({
    queryKey: ['marketPerformance'],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from('polybot_simulated_trades')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching trades for performance:', error);
        return [];
      }
      
      // Group trades by market
      const marketMap = new Map<string, {
        market_id: string;
        market_title: string;
        platform: string;
        trades: typeof trades;
      }>();
      
      trades?.forEach(trade => {
        const marketId = trade.polymarket_token_id || trade.kalshi_ticker || 'unknown';
        const marketTitle = trade.polymarket_market_title || trade.kalshi_market_title || 'Unknown Market';
        const platform = trade.polymarket_token_id ? 'polymarket' : 'kalshi';
        
        if (!marketMap.has(marketId)) {
          marketMap.set(marketId, {
            market_id: marketId,
            market_title: marketTitle,
            platform,
            trades: [],
          });
        }
        marketMap.get(marketId)!.trades.push(trade);
      });
      
      // Calculate stats for each market
      const performance = Array.from(marketMap.values()).map(({ market_id, market_title, platform, trades }) => {
        const completedTrades = trades.filter(t => t.outcome !== 'pending');
        const wins = completedTrades.filter(t => t.outcome === 'won').length;
        const losses = completedTrades.filter(t => t.outcome === 'lost').length;
        const totalPnl = completedTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
        const avgSize = trades.length > 0 
          ? trades.reduce((sum, t) => sum + (t.position_size_usd || 0), 0) / trades.length 
          : 0;
        
        return {
          market_id,
          market_title,
          platform,
          total_trades: trades.length,
          winning_trades: wins,
          losing_trades: losses,
          pending_trades: trades.filter(t => t.outcome === 'pending').length,
          total_pnl: totalPnl,
          win_rate: completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0,
          avg_trade_size: avgSize,
          first_trade_at: trades[trades.length - 1]?.created_at,
          last_trade_at: trades[0]?.created_at,
        };
      });
      
      // Sort by total trades descending
      return performance.sort((a, b) => b.total_trades - a.total_trades);
    },
    refetchInterval: 30000,
  });
}

// Get trades for a specific market
export function useMarketTrades(marketId: string) {
  return useQuery({
    queryKey: ['marketTrades', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_simulated_trades')
        .select('*')
        .or(`polymarket_token_id.eq.${marketId},kalshi_ticker.eq.${marketId}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching market trades:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!marketId,
    refetchInterval: 10000,
  });
}

// ==================== ADVANCED PORTFOLIO ANALYTICS ====================

interface AdvancedMetrics {
  // Risk metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  
  // Performance metrics
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  avgDailyReturn: number;
  volatility: number;
  
  // Trade metrics
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  payoffRatio: number;
  
  // Streak analysis
  currentStreak: number;
  currentStreakType: 'win' | 'loss' | 'none';
  longestWinStreak: number;
  longestLoseStreak: number;
  
  // Time-based
  tradingDays: number;
  avgTradesPerDay: number;
  bestDay: { date: string; pnl: number };
  worstDay: { date: string; pnl: number };
  
  // Drawdown history for charting
  drawdownHistory: Array<{ date: string; drawdown: number; drawdownPct: number }>;
}

export function useAdvancedAnalytics(startingBalance: number = 1000) {
  const { data: trades = [] } = useSimulatedTrades(1000);
  const { data: history = [] } = useSimulationHistory(2160); // 90 days
  
  return useQuery({
    queryKey: ['advancedAnalytics', trades.length, history.length],
    queryFn: (): AdvancedMetrics => {
      // Sort trades by date
      const sortedTrades = [...trades]
        .filter(t => t.outcome !== 'pending')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (sortedTrades.length === 0) {
        return getEmptyMetrics();
      }
      
      // Calculate daily returns
      const dailyReturns: Map<string, number> = new Map();
      sortedTrades.forEach(trade => {
        const day = trade.created_at.slice(0, 10);
        const pnl = trade.actual_profit_usd || 0;
        dailyReturns.set(day, (dailyReturns.get(day) || 0) + pnl);
      });
      
      const returnsArray = Array.from(dailyReturns.values());
      const datesArray = Array.from(dailyReturns.keys());
      
      // Calculate equity curve
      let peak = startingBalance;
      let maxDrawdown = 0;
      let maxDrawdownPct = 0;
      let currentBalance = startingBalance;
      const drawdownHistory: Array<{ date: string; drawdown: number; drawdownPct: number }> = [];
      
      datesArray.forEach((date, i) => {
        currentBalance += returnsArray[i];
        
        // Update peak
        if (currentBalance > peak) {
          peak = currentBalance;
        }
        
        // Calculate drawdown
        const drawdown = peak - currentBalance;
        const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
        
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPct = drawdownPct;
        }
        
        drawdownHistory.push({ date, drawdown, drawdownPct });
      });
      
      // Current drawdown
      const currentDrawdown = peak - currentBalance;
      const currentDrawdownPct = peak > 0 ? (currentDrawdown / peak) * 100 : 0;
      
      // Total return
      const totalReturn = currentBalance - startingBalance;
      const totalReturnPct = (totalReturn / startingBalance) * 100;
      
      // Trading days
      const tradingDays = dailyReturns.size;
      const avgDailyReturn = returnsArray.length > 0 
        ? returnsArray.reduce((a, b) => a + b, 0) / returnsArray.length 
        : 0;
      
      // Volatility (standard deviation of daily returns)
      const variance = returnsArray.length > 1
        ? returnsArray.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / (returnsArray.length - 1)
        : 0;
      const volatility = Math.sqrt(variance);
      
      // Downside volatility (for Sortino)
      const negativeReturns = returnsArray.filter(r => r < 0);
      const downsideVariance = negativeReturns.length > 1
        ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
        : 0;
      const downsideVolatility = Math.sqrt(downsideVariance);
      
      // Annualized metrics (assuming 365 trading days)
      const annualizedReturn = avgDailyReturn * 365;
      const annualizedVolatility = volatility * Math.sqrt(365);
      
      // Risk-free rate approximation (4% annual)
      const dailyRiskFree = 0.04 / 365;
      
      // Sharpe Ratio (annualized)
      const sharpeRatio = annualizedVolatility > 0
        ? ((avgDailyReturn - dailyRiskFree) * 365) / annualizedVolatility
        : 0;
      
      // Sortino Ratio (annualized)
      const sortinoRatio = downsideVolatility > 0
        ? ((avgDailyReturn - dailyRiskFree) * 365) / (downsideVolatility * Math.sqrt(365))
        : 0;
      
      // Win/Loss analysis
      const wins = sortedTrades.filter(t => t.outcome === 'won');
      const losses = sortedTrades.filter(t => t.outcome === 'lost');
      
      const totalWins = wins.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
      const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0));
      
      const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
      const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
      
      // Profit Factor
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
      
      // Payoff Ratio (avg win / avg loss)
      const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
      
      // Expectancy (expected $ per trade)
      const winRate = sortedTrades.length > 0 ? wins.length / sortedTrades.length : 0;
      const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
      
      // Streak analysis
      let currentStreak = 0;
      let currentStreakType: 'win' | 'loss' | 'none' = 'none';
      let longestWinStreak = 0;
      let longestLoseStreak = 0;
      let tempWinStreak = 0;
      let tempLoseStreak = 0;
      
      sortedTrades.forEach(trade => {
        if (trade.outcome === 'won') {
          tempWinStreak++;
          tempLoseStreak = 0;
          if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
        } else if (trade.outcome === 'lost') {
          tempLoseStreak++;
          tempWinStreak = 0;
          if (tempLoseStreak > longestLoseStreak) longestLoseStreak = tempLoseStreak;
        }
      });
      
      // Current streak from most recent trades
      for (let i = sortedTrades.length - 1; i >= 0; i--) {
        const outcome = sortedTrades[i].outcome;
        if (currentStreakType === 'none') {
          currentStreakType = outcome as 'win' | 'loss';
          currentStreak = 1;
        } else if (outcome === currentStreakType.replace('win', 'won').replace('loss', 'lost')) {
          currentStreak++;
        } else {
          break;
        }
      }
      
      // Best/worst day
      let bestDay = { date: '', pnl: -Infinity };
      let worstDay = { date: '', pnl: Infinity };
      
      dailyReturns.forEach((pnl, date) => {
        if (pnl > bestDay.pnl) bestDay = { date, pnl };
        if (pnl < worstDay.pnl) worstDay = { date, pnl };
      });
      
      if (bestDay.pnl === -Infinity) bestDay = { date: '', pnl: 0 };
      if (worstDay.pnl === Infinity) worstDay = { date: '', pnl: 0 };
      
      return {
        sharpeRatio,
        sortinoRatio,
        maxDrawdown,
        maxDrawdownPct,
        currentDrawdown,
        currentDrawdownPct,
        totalReturn,
        totalReturnPct,
        annualizedReturn,
        avgDailyReturn,
        volatility,
        avgWin,
        avgLoss,
        profitFactor,
        expectancy,
        payoffRatio,
        currentStreak,
        currentStreakType,
        longestWinStreak,
        longestLoseStreak,
        tradingDays,
        avgTradesPerDay: tradingDays > 0 ? sortedTrades.length / tradingDays : 0,
        bestDay,
        worstDay,
        drawdownHistory,
      };
    },
    enabled: trades.length > 0,
  });
}

function getEmptyMetrics(): AdvancedMetrics {
  return {
    sharpeRatio: 0,
    sortinoRatio: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    currentDrawdown: 0,
    currentDrawdownPct: 0,
    totalReturn: 0,
    totalReturnPct: 0,
    annualizedReturn: 0,
    avgDailyReturn: 0,
    volatility: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    expectancy: 0,
    payoffRatio: 0,
    currentStreak: 0,
    currentStreakType: 'none',
    longestWinStreak: 0,
    longestLoseStreak: 0,
    tradingDays: 0,
    avgTradesPerDay: 0,
    bestDay: { date: '', pnl: 0 },
    worstDay: { date: '', pnl: 0 },
    drawdownHistory: [],
  };
}

// ==================== SECRETS & CONNECTED PLATFORMS ====================

export interface SecretStatus {
  key_name: string;
  category: string;
  description: string;
  is_configured: boolean;
  last_updated: string | null;
}

export interface ConnectedPlatform {
  name: string;
  type: 'prediction_market' | 'crypto_exchange' | 'stock_broker';
  connected: boolean;
  icon: string;
  keys_configured: string[];
  keys_missing: string[];
}

// Platform definitions with required keys
const PLATFORM_DEFINITIONS: Record<string, { 
  type: ConnectedPlatform['type']; 
  icon: string; 
  requiredKeys: string[];
  alternateKeys?: string[];  // Alternative keys that also satisfy the requirement
}> = {
  polymarket: {
    type: 'prediction_market',
    icon: '🎯',
    requiredKeys: ['POLYMARKET_API_KEY', 'POLYMARKET_SECRET'],
  },
  kalshi: {
    type: 'prediction_market', 
    icon: '📊',
    requiredKeys: ['KALSHI_API_KEY', 'KALSHI_PRIVATE_KEY'],
  },
  binance: {
    type: 'crypto_exchange',
    icon: '🟡',
    requiredKeys: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'],
  },
  bybit: {
    type: 'crypto_exchange',
    icon: '🔶',
    requiredKeys: ['BYBIT_API_KEY', 'BYBIT_API_SECRET'],
  },
  okx: {
    type: 'crypto_exchange',
    icon: '⚫',
    requiredKeys: ['OKX_API_KEY', 'OKX_API_SECRET', 'OKX_PASSPHRASE'],
  },
  kraken: {
    type: 'crypto_exchange',
    icon: '🐙',
    requiredKeys: ['KRAKEN_API_KEY', 'KRAKEN_API_SECRET'],
  },
  coinbase: {
    type: 'crypto_exchange',
    icon: '🔵',
    requiredKeys: ['COINBASE_API_KEY', 'COINBASE_API_SECRET'],
  },
  kucoin: {
    type: 'crypto_exchange',
    icon: '🟢',
    requiredKeys: ['KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_PASSPHRASE'],
  },
  alpaca: {
    type: 'stock_broker',
    icon: '🦙',
    // Check for either PAPER or LIVE keys (simulation mode uses PAPER)
    requiredKeys: ['ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_SECRET'],
    alternateKeys: ['ALPACA_LIVE_API_KEY', 'ALPACA_LIVE_API_SECRET'],
  },
  ibkr: {
    type: 'stock_broker',
    icon: '🏛️',
    requiredKeys: ['IBKR_HOST', 'IBKR_PORT'],
  },
};

// Fetch all secrets status (without values - just configured status)
// Uses API route to bypass RLS (service key needed for polybot_secrets)
export function useSecretsStatus() {
  return useQuery({
    queryKey: ['secretsStatus'],
    queryFn: async (): Promise<SecretStatus[]> => {
      try {
        const response = await fetch('/api/secrets');
        if (!response.ok) {
          console.error('Error fetching secrets status:', response.statusText);
          return [];
        }
        const result = await response.json();
        // Map API response to SecretStatus format
        return (result.secrets || []).map((s: any) => ({
          key_name: s.key_name,
          category: s.category,
          description: s.description,
          is_configured: s.is_configured,
          last_updated: s.last_updated,
        }));
      } catch (error) {
        console.error('Error fetching secrets status:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// Compute connected platforms from secrets status
export function useConnectedPlatforms() {
  const { data: secrets = [], isLoading, isError } = useSecretsStatus();
  
  return useQuery({
    queryKey: ['connectedPlatforms', secrets.length, secrets.map(s => `${s.key_name}:${s.is_configured}`).join(',')],
    queryFn: (): ConnectedPlatform[] => {
      // Build a map of key_name -> is_configured
      const secretsMap = new Map(secrets.map(s => [s.key_name, s.is_configured]));
      
      // Debug logging
      console.log('Secrets map size:', secretsMap.size);
      
      return Object.entries(PLATFORM_DEFINITIONS).map(([name, def]) => {
        // Check primary required keys
        const primaryConfigured = def.requiredKeys.filter(k => secretsMap.get(k) === true);
        const primaryMissing = def.requiredKeys.filter(k => secretsMap.get(k) !== true);
        
        // Check alternate keys if primary are not all configured
        let connected = primaryMissing.length === 0;
        let keysConfigured = primaryConfigured;
        let keysMissing = primaryMissing;
        
        // If primary keys are missing but alternate keys exist and are all configured
        if (!connected && def.alternateKeys) {
          const altConfigured = def.alternateKeys.filter(k => secretsMap.get(k) === true);
          const altMissing = def.alternateKeys.filter(k => secretsMap.get(k) !== true);
          
          if (altMissing.length === 0) {
            connected = true;
            keysConfigured = altConfigured;
            keysMissing = [];
          }
        }
        
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: def.type,
          icon: def.icon,
          connected,
          keys_configured: keysConfigured,
          keys_missing: keysMissing,
        };
      });
    },
    // Only enable if we have actual secrets data, not loading, and no error
    enabled: !isLoading && !isError && secrets.length > 0,
  });
}

// Summary of connected platforms by type
export function useConnectionSummary() {
  const { data: platforms = [] } = useConnectedPlatforms();
  
  return {
    predictionMarkets: platforms.filter(p => p.type === 'prediction_market'),
    cryptoExchanges: platforms.filter(p => p.type === 'crypto_exchange'),
    stockBrokers: platforms.filter(p => p.type === 'stock_broker'),
    totalConnected: platforms.filter(p => p.connected).length,
    totalPlatforms: platforms.length,
  };
}

