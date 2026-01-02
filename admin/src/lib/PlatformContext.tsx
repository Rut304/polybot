'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { supabase } from './supabase';

// ============================================================================
// PLATFORM CONTEXT
// ============================================================================
// This context provides a single source of truth for user's connected platforms
// and whether they're in simulation vs live mode.
//
// KEY PRINCIPLE:
// - SIMULATION MODE: Show ALL market data from ALL platforms (exploration/learning)
// - LIVE MODE: Only show data from platforms user has connected (actionable only)
//
// When adding a new platform, just add it to PLATFORM_METADATA below.
// ============================================================================

export type PlatformType = 'prediction_market' | 'crypto_exchange' | 'stock_broker' | 'options_broker';

export interface Platform {
  id: string;
  name: string;
  type: PlatformType;
  connected: boolean;
  supports: string[];
  icon?: string;
}

// Master list of all supported platforms
// When adding a new platform, just add it here
export const PLATFORM_METADATA: Record<string, Omit<Platform, 'connected'>> = {
  polymarket: {
    id: 'polymarket',
    name: 'Polymarket',
    type: 'prediction_market',
    supports: ['prediction_markets'],
    icon: '🔮',
  },
  kalshi: {
    id: 'kalshi',
    name: 'Kalshi',
    type: 'prediction_market',
    supports: ['prediction_markets'],
    icon: '📊',
  },
  binance: {
    id: 'binance',
    name: 'Binance',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
    icon: '🟡',
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures', 'options'],
    icon: '🔶',
  },
  okx: {
    id: 'okx',
    name: 'OKX',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures', 'options'],
    icon: '⬡',
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
    icon: '🐙',
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    type: 'crypto_exchange',
    supports: ['crypto'],
    icon: '🔵',
  },
  kucoin: {
    id: 'kucoin',
    name: 'KuCoin',
    type: 'crypto_exchange',
    supports: ['crypto', 'futures'],
    icon: '🟢',
  },
  alpaca: {
    id: 'alpaca',
    name: 'Alpaca',
    type: 'stock_broker',
    supports: ['stocks', 'crypto'],
    icon: '🦙',
  },
  ibkr: {
    id: 'ibkr',
    name: 'Interactive Brokers',
    type: 'options_broker',
    supports: ['stocks', 'options', 'futures', 'forex'],
    icon: '🏛️',
  },
  webull: {
    id: 'webull',
    name: 'Webull',
    type: 'stock_broker',
    supports: ['stocks', 'crypto', 'options'],
    icon: '🐂',
  },
  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    type: 'crypto_exchange',
    supports: ['crypto', 'perpetuals'],
    icon: '💧',
  },
};

export interface PlatformContextValue {
  // All platforms with connection status
  platforms: Platform[];
  // Just the IDs of connected platforms
  connectedIds: string[];
  // All platform IDs (for simulation mode - no filtering)
  allPlatformIds: string[];
  // Current mode
  isSimulationMode: boolean;
  // Convenience booleans (based on connected platforms)
  hasCrypto: boolean;
  hasStocks: boolean;
  hasPredictionMarkets: boolean;
  hasOptions: boolean;
  // Loading/error states
  isLoading: boolean;
  error: Error | null;
  // Helper functions
  isConnected: (platformId: string) => boolean;
  getPlatform: (platformId: string) => Platform | undefined;
  
  // ============================================================
  // KEY FILTER FUNCTION - respects simulation vs live mode
  // ============================================================
  // In SIMULATION mode: returns all data (no filtering)
  // In LIVE mode: filters to only connected platforms
  // @param platformField - Optional field name to extract platform from
  filterByPlatform: <T extends Record<string, any>>(data: T[], platformField?: string) => T[];
  
  // Get effective platform IDs for current mode
  // Simulation = all platforms, Live = only connected
  getEffectivePlatformIds: () => string[];
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Fetch user's connected exchanges AND their trading mode
  const { data, isLoading, error } = useQuery({
    queryKey: ['userPlatforms', user?.id],
    queryFn: async () => {
      if (!user) return { connected_exchange_ids: [], is_simulation: true };
      
      // Get auth token for the API call
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/user-exchanges', {
        credentials: 'include',
        headers: session?.access_token ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {},
      });
      
      if (!response.ok) {
        // Don't throw on 401 - just return defaults
        if (response.status === 401) {
          return { connected_exchange_ids: [], is_simulation: true };
        }
        throw new Error('Failed to fetch user platforms');
      }
      
      const json = await response.json();
      // API returns { success, data: { connected_exchange_ids, is_simulation, ... } }
      return json.data || json;
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const connectedIds: string[] = data?.connected_exchange_ids || [];
  const allPlatformIds = Object.keys(PLATFORM_METADATA);
  
  // Default to simulation mode if not set (safer)
  const isSimulationMode = data?.is_simulation ?? true;

  // Build full platform list with connection status
  const platforms = useMemo(() => {
    return Object.values(PLATFORM_METADATA).map(meta => ({
      ...meta,
      connected: connectedIds.includes(meta.id),
    }));
  }, [connectedIds]);

  // Convenience booleans (always based on what user HAS connected, regardless of mode)
  const hasCrypto = useMemo(() => 
    platforms.some(p => p.connected && p.type === 'crypto_exchange'),
    [platforms]
  );
  
  const hasStocks = useMemo(() => 
    platforms.some(p => p.connected && (p.type === 'stock_broker' || p.supports.includes('stocks'))),
    [platforms]
  );
  
  const hasPredictionMarkets = useMemo(() => 
    platforms.some(p => p.connected && p.type === 'prediction_market'),
    [platforms]
  );
  
  const hasOptions = useMemo(() => 
    platforms.some(p => p.connected && p.supports.includes('options')),
    [platforms]
  );

  // Helper functions
  const isConnected = (platformId: string) => connectedIds.includes(platformId);
  
  const getPlatform = (platformId: string) => 
    platforms.find(p => p.id === platformId);

  // Get platform IDs that should be used for data queries
  const getEffectivePlatformIds = (): string[] => {
    if (isSimulationMode) {
      return allPlatformIds; // All platforms in simulation
    }
    return connectedIds; // Only connected in live mode
  };

  // ============================================================
  // CORE FILTER FUNCTION
  // ============================================================
  // SIMULATION MODE: Return ALL data (user exploring/learning)
  // LIVE MODE: Filter to only data from connected platforms
  // 
  // @param data - Array of items to filter
  // @param platformField - Optional field name to extract platform from (default: auto-detect)
  const filterByPlatform = <T extends Record<string, any>>(data: T[], platformField?: string): T[] => {
    // In simulation mode, show everything
    if (isSimulationMode) {
      return data;
    }
    
    // In live mode, filter to connected platforms only
    if (connectedIds.length === 0) {
      return []; // No platforms connected in live mode = no data
    }
    
    return data.filter(item => {
      // Use specified field or check various platform field names
      const itemPlatform = platformField 
        ? item[platformField] 
        : (item.platform || item.exchange || item.buy_platform);
      if (!itemPlatform) return true; // Keep items without platform field (generic data)
      return connectedIds.includes(String(itemPlatform).toLowerCase());
    });
  };

  const value: PlatformContextValue = {
    platforms,
    connectedIds,
    allPlatformIds,
    isSimulationMode,
    hasCrypto,
    hasStocks,
    hasPredictionMarkets,
    hasOptions,
    isLoading,
    error: error as Error | null,
    isConnected,
    getPlatform,
    filterByPlatform,
    getEffectivePlatformIds,
  };

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

// Hook to access platform context
export function usePlatforms() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatforms must be used within a PlatformProvider');
  }
  return context;
}

// Convenience hook - returns IDs to use for data queries (respects sim/live mode)
export function useEffectivePlatformIds(): string[] {
  const { getEffectivePlatformIds } = usePlatforms();
  return getEffectivePlatformIds();
}

// Convenience hook - filter any data array by platform (respects sim/live mode)
export function usePlatformFilter() {
  const { filterByPlatform } = usePlatforms();
  return filterByPlatform;
}
