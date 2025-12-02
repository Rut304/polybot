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

