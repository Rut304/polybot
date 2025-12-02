'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SimulatedTrade, SimulationStats, BotStatus, Opportunity } from './supabase';

// ==================== QUERIES ====================

// Fetch bot status
export function useBotStatus() {
  return useQuery({
    queryKey: ['botStatus'],
    queryFn: async (): Promise<BotStatus | null> => {
      const { data, error } = await supabase
        .from('polybot_status')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bot status:', error);
        return null;
      }
      return data || {
        id: 1,
        is_running: false,
        mode: 'simulation',
        polymarket_connected: false,
        kalshi_connected: false,
      };
    },
    refetchInterval: 2000,
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

// Fetch simulated trades
export function useSimulatedTrades(limit: number = 50) {
  return useQuery({
    queryKey: ['simulatedTrades', limit],
    queryFn: async (): Promise<SimulatedTrade[]> => {
      const { data, error } = await supabase
        .from('polybot_simulated_trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching simulated trades:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 5000,
  });
}

// Fetch opportunities
export function useOpportunities(limit: number = 100) {
  return useQuery({
    queryKey: ['opportunities', limit],
    queryFn: async (): Promise<Opportunity[]> => {
      const { data, error } = await supabase
        .from('polybot_opportunities')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching opportunities:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 3000,
  });
}

// Compute real-time stats directly from trades (more accurate than stats table)
export function useRealTimeStats() {
  const { data: trades = [] } = useSimulatedTrades(500);
  const { data: opportunities = [] } = useOpportunities(1000);
  const { data: simStats } = useSimulationStats();
  
  return useQuery({
    queryKey: ['realTimeStats', trades.length, opportunities.length],
    queryFn: () => {
      // Filter out failed executions for main stats
      const validTrades = trades.filter(t => t.outcome !== 'failed_execution');
      const wonTrades = validTrades.filter(t => t.outcome === 'won');
      const lostTrades = validTrades.filter(t => t.outcome === 'lost');
      const pendingTrades = validTrades.filter(t => t.outcome === 'pending');
      
      // Calculate P&L from actual trade data
      const totalPnl = validTrades.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
      
      // Starting balance from stats or default
      const startingBalance = simStats?.stats_json?.simulated_starting_balance 
        ? parseFloat(simStats.stats_json.simulated_starting_balance) 
        : 1000;
      
      const currentBalance = startingBalance + totalPnl;
      const roiPct = (totalPnl / startingBalance) * 100;
      
      // Win rate based on resolved trades only
      const resolvedTrades = wonTrades.length + lostTrades.length;
      const winRate = resolvedTrades > 0 ? (wonTrades.length / resolvedTrades) * 100 : 0;
      
      // Best/worst trades
      const bestTrade = validTrades.reduce((best, t) => 
        (t.actual_profit_usd || 0) > (best?.actual_profit_usd || 0) ? t : best, 
        validTrades[0]
      );
      const worstTrade = validTrades.reduce((worst, t) => 
        (t.actual_profit_usd || 0) < (worst?.actual_profit_usd || 0) ? t : worst,
        validTrades[0]
      );
      
      return {
        // Core metrics - computed from actual trades
        simulated_balance: currentBalance,
        total_pnl: totalPnl,
        total_trades: validTrades.length,
        win_rate: winRate,
        
        // Detailed counts
        winning_trades: wonTrades.length,
        losing_trades: lostTrades.length,
        pending_trades: pendingTrades.length,
        failed_executions: trades.filter(t => t.outcome === 'failed_execution').length,
        
        // Derived metrics
        roi_pct: roiPct,
        total_opportunities_seen: opportunities.length,
        best_trade_profit: bestTrade?.actual_profit_usd || 0,
        worst_trade_loss: worstTrade?.actual_profit_usd || 0,
        
        // Keep original stats for anything not computed
        stats_json: simStats?.stats_json,
      };
    },
    enabled: trades.length >= 0, // Always run
    refetchInterval: 5000,
  });
}

// Fetch opportunity stats for charts
export function useOpportunityStats() {
  return useQuery({
    queryKey: ['opportunityStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_opportunities')
        .select('profit_percent, buy_platform, sell_platform, detected_at')
        .order('detected_at', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('Error fetching opportunity stats:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
  });
}

// Aggregate stats
export function useAggregateStats() {
  return useQuery({
    queryKey: ['aggregateStats'],
    queryFn: async () => {
      // Get counts
      const [tradesResult, oppsResult] = await Promise.all([
        supabase.from('polybot_simulated_trades').select('*', { count: 'exact', head: true }),
        supabase.from('polybot_opportunities').select('*', { count: 'exact', head: true }),
      ]);
      
      // Get recent high-profit opportunities
      const { data: topOpps } = await supabase
        .from('polybot_opportunities')
        .select('profit_percent')
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
    refetchInterval: 10000,
  });
}

// Fetch bot configuration
export function useBotConfig() {
  return useQuery({
    queryKey: ['botConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_config')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bot config:', error);
        return null;
      }
      return data;
    },
    refetchInterval: 10000,
  });
}

// Fetch user positions (active bets)
export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_positions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching positions:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 5000,
  });
}

// Fetch disabled markets
export function useDisabledMarkets() {
  return useQuery({
    queryKey: ['disabledMarkets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_disabled_markets')
        .select('*');
      
      if (error) {
        console.error('Error fetching disabled markets:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });
}

// Fetch market cache for manual trading
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
export function useManualTrades(limit: number = 50) {
  return useQuery({
    queryKey: ['manualTrades', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polybot_manual_trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching manual trades:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 5000,
  });
}

// ==================== MUTATIONS ====================

// Update bot config
export function useUpdateBotConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: {
      polymarket_enabled?: boolean;
      kalshi_enabled?: boolean;
      min_profit_percent?: number;
      max_trade_size?: number;
      max_daily_loss?: number;
      scan_interval?: number;
    }) => {
      const { error } = await supabase
        .from('polybot_config')
        .upsert({ id: 1, ...config, updated_at: new Date().toISOString() });
      
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
  
  return useMutation({
    mutationFn: async (status: {
      is_running?: boolean;
      mode?: string;
    }) => {
      const { error } = await supabase
        .from('polybot_status')
        .upsert({ id: 1, ...status, updated_at: new Date().toISOString() });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botStatus'] });
    },
  });
}

// Place manual trade
export function usePlaceManualTrade() {
  const queryClient = useQueryClient();
  
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
      const total_cost = trade.quantity * trade.price;
      
      const { data, error } = await supabase
        .from('polybot_manual_trades')
        .insert({
          ...trade,
          total_cost,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Also create a position record for tracking
      await supabase
        .from('polybot_positions')
        .upsert({
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

// Reset simulation - clears all trades and resets balance to $1,000
export function useResetSimulation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Delete all simulated trades
      const { error: tradesError } = await supabase
        .from('polybot_simulated_trades')
        .delete()
        .neq('id', 0); // Delete all
      
      if (tradesError) throw tradesError;
      
      // Delete all simulation history
      const { error: historyError } = await supabase
        .from('polybot_simulation_stats')
        .delete()
        .neq('id', 0); // Delete all
      
      if (historyError) throw historyError;
      
      // Delete all opportunities
      const { error: oppsError } = await supabase
        .from('polybot_opportunities')
        .delete()
        .neq('id', 0); // Delete all
      
      if (oppsError) throw oppsError;
      
      // Insert fresh starting stats
      const { error: statsError } = await supabase
        .from('polybot_simulation_stats')
        .insert({
          snapshot_at: new Date().toISOString(),
          simulated_balance: 1000,
          total_pnl: 0,
          total_trades: 0,
          win_rate: 0,
          stats_json: {
            total_opportunities_seen: 0,
            total_simulated_trades: 0,
            simulated_starting_balance: '1000.00',
            simulated_current_balance: '1000.00',
            total_pnl: '0.00',
            winning_trades: 0,
            losing_trades: 0,
            pending_trades: 0,
            win_rate_pct: 0,
            roi_pct: 0,
            best_trade_profit: '0.00',
            worst_trade_loss: '0.00',
            largest_opportunity_seen_pct: '0.00',
            first_opportunity_at: null,
            last_opportunity_at: null,
            execution_success_rate_pct: 100,
            total_fees_paid: '0.00',
            total_losses: '0.00',
            failed_executions: 0,
            avg_trade_pnl: '0.00',
          },
        });
      
      if (statsError) throw statsError;
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulationStats'] });
      queryClient.invalidateQueries({ queryKey: ['simulationHistory'] });
      queryClient.invalidateQueries({ queryKey: ['simulatedTrades'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['aggregateStats'] });
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
