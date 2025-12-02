'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, SimulatedTrade, SimulationStats, BotStatus, Opportunity } from './supabase';

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
      
      if (error) {
        console.error('Error fetching bot status:', error);
        return null;
      }
      return data;
    },
    refetchInterval: 2000, // Refresh every 2 seconds
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

