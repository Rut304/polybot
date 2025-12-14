'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Fish,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Trophy,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Star,
  StarOff,
  BarChart3,
  Calendar,
  Zap,
  Crown,
  Award,
  Medal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Whale tier definitions
const WHALE_TIERS = {
  mega_whale: { label: 'Mega Whale', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Crown, minVolume: 100000, minWinRate: 80 },
  whale: { label: 'Whale', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Award, minVolume: 50000, minWinRate: 75 },
  smart_money: { label: 'Smart Money', color: 'text-green-400', bg: 'bg-green-500/20', icon: Medal, minVolume: 10000, minWinRate: 70 },
  retail: { label: 'Retail', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Users, minVolume: 0, minWinRate: 0 },
};

interface TrackedWhale {
  id: number;
  address: string;
  alias: string | null;
  total_volume_usd: number;
  win_rate: number;
  total_predictions: number;
  winning_predictions: number;
  tier: string;
  last_trade_at: string | null;
  active_positions: number;
  copy_enabled: boolean;
  copy_multiplier: number;
  max_copy_size_usd: number;
  copy_trades: number;
  copy_wins: number;
  copy_pnl: number;
  discovered_at: string;
  discovery_source: string;
}

interface LeaderboardWhale {
  address: string;
  username?: string;
  volume: number;
  win_rate: number;
  predictions: number;
  pnl?: number;
  rank?: number;
}

interface WhaleTrade {
  id: string;
  whale_address: string;
  detected_at: string;
  market_title: string;
  direction: string;
  side: string;
  price: number;
  size_usd: number;
  copied: boolean;
}

type TimeFilter = 'week' | 'month' | 'year' | 'all';
type SortField = 'win_rate' | 'volume' | 'predictions' | 'copy_pnl';

export default function WhalesPage() {
  const queryClient = useQueryClient();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [sortField, setSortField] = useState<SortField>('win_rate');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);
  const [selectedWhale, setSelectedWhale] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Fetch tracked whales from our database
  const { data: trackedWhales = [], isLoading: loadingTracked, refetch: refetchTracked } = useQuery({
    queryKey: ['trackedWhales'],
    queryFn: async (): Promise<TrackedWhale[]> => {
      const { data, error } = await supabase
        .from('polybot_tracked_whales')
        .select('*')
        .order('win_rate', { ascending: false });

      if (error) {
        console.error('Error fetching tracked whales:', error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch whale trades for selected whale
  const { data: whaleTrades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['whaleTrades', selectedWhale],
    queryFn: async (): Promise<WhaleTrade[]> => {
      if (!selectedWhale) return [];
      
      const { data, error } = await supabase
        .from('polybot_whale_trades')
        .select('*')
        .eq('whale_address', selectedWhale)
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching whale trades:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedWhale,
  });

  // Fetch leaderboard from Polymarket via our API
  const { data: leaderboardWhales = [], isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['polymarketLeaderboard', timeFilter],
    queryFn: async (): Promise<LeaderboardWhale[]> => {
      try {
        // Call our Next.js API route that fetches from Polymarket
        const response = await fetch('/api/whales/leaderboard?limit=100&minWinRate=65&minVolume=5000');
        
        if (!response.ok) {
          throw new Error(`Leaderboard API returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          return result.data;
        }
        
        // Fallback: use tracked whales if API fails
        const tracked = trackedWhales.map(w => ({
          address: w.address,
          username: w.alias || undefined,
          volume: w.total_volume_usd,
          win_rate: w.win_rate,
          predictions: w.total_predictions,
          pnl: w.copy_pnl,
        }));
        
        return tracked.length > 0 ? tracked : [];
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        
        // Fallback to tracked whales
        const tracked = trackedWhales.map(w => ({
          address: w.address,
          username: w.alias || undefined,
          volume: w.total_volume_usd,
          win_rate: w.win_rate,
          predictions: w.total_predictions,
          pnl: w.copy_pnl,
        }));
        
        return tracked;
      }
    },
  });

  // Toggle whale tracking
  const toggleTrackingMutation = useMutation({
    mutationFn: async ({ address, enabled }: { address: string; enabled: boolean }) => {
      if (enabled) {
        // Add to tracked whales
        const whale = leaderboardWhales.find(w => w.address === address);
        const { error } = await supabase
          .from('polybot_tracked_whales')
          .upsert({
            address,
            alias: whale?.username || null,
            total_volume_usd: whale?.volume || 0,
            win_rate: whale?.win_rate || 0,
            total_predictions: whale?.predictions || 0,
            copy_enabled: false,
            discovery_source: 'manual',
          }, { onConflict: 'address' });
        
        if (error) throw error;
      } else {
        // Remove from tracked whales
        const { error } = await supabase
          .from('polybot_tracked_whales')
          .delete()
          .eq('address', address);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedWhales'] });
    },
  });

  // Toggle copy trading for a whale
  const toggleCopyMutation = useMutation({
    mutationFn: async ({ address, enabled }: { address: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('polybot_tracked_whales')
        .update({ copy_enabled: enabled })
        .eq('address', address);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedWhales'] });
    },
  });

  // Update copy settings
  const updateCopySettingsMutation = useMutation({
    mutationFn: async ({ address, multiplier, maxSize }: { address: string; multiplier: number; maxSize: number }) => {
      const { error } = await supabase
        .from('polybot_tracked_whales')
        .update({ 
          copy_multiplier: multiplier,
          max_copy_size_usd: maxSize,
        })
        .eq('address', address);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedWhales'] });
    },
  });

  // Discover new whales from leaderboard
  const discoverWhales = async () => {
    setIsDiscovering(true);
    try {
      // In production, this would trigger the bot to fetch the leaderboard
      // and auto-discover whales meeting criteria
      await refetchLeaderboard();
      await refetchTracked();
    } finally {
      setIsDiscovering(false);
    }
  };

  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Get whale tier
  const getWhaleTier = (volume: number, winRate: number) => {
    if (volume >= 100000 && winRate >= 80) return 'mega_whale';
    if (volume >= 50000 && winRate >= 75) return 'whale';
    if (volume >= 10000 && winRate >= 70) return 'smart_money';
    return 'retail';
  };

  // Check if whale is tracked
  const isTracked = (address: string) => {
    return trackedWhales.some(w => w.address === address);
  };

  // Get tracked whale data
  const getTrackedWhale = (address: string) => {
    return trackedWhales.find(w => w.address === address);
  };

  // Filter and sort whales
  const displayedWhales = useMemo(() => {
    let whales: (TrackedWhale | LeaderboardWhale)[] = showTrackedOnly 
      ? [...trackedWhales] 
      : [...leaderboardWhales];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      whales = whales.filter(w => 
        w.address.toLowerCase().includes(query) ||
        (('username' in w ? w.username : ('alias' in w ? w.alias : '')) || '').toLowerCase().includes(query)
      );
    }

    // Apply tier filter
    if (tierFilter !== 'all') {
      whales = whales.filter(w => {
        const volume = 'total_volume_usd' in w ? w.total_volume_usd : ('volume' in w ? w.volume : 0);
        const winRate = w.win_rate;
        return getWhaleTier(volume, winRate) === tierFilter;
      });
    }

    // Sort
    whales = [...whales].sort((a, b) => {
      let aVal: number, bVal: number;
      
      switch (sortField) {
        case 'win_rate':
          aVal = 'win_rate' in a ? a.win_rate : 0;
          bVal = 'win_rate' in b ? b.win_rate : 0;
          break;
        case 'volume':
          aVal = 'total_volume_usd' in a ? a.total_volume_usd : ('volume' in a ? a.volume : 0);
          bVal = 'total_volume_usd' in b ? b.total_volume_usd : ('volume' in b ? b.volume : 0);
          break;
        case 'predictions':
          aVal = 'total_predictions' in a ? a.total_predictions : ('predictions' in a ? a.predictions : 0);
          bVal = 'total_predictions' in b ? b.total_predictions : ('predictions' in b ? b.predictions : 0);
          break;
        case 'copy_pnl':
          aVal = 'copy_pnl' in a ? a.copy_pnl : 0;
          bVal = 'copy_pnl' in b ? b.copy_pnl : 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return whales;
  }, [leaderboardWhales, trackedWhales, showTrackedOnly, searchQuery, tierFilter, sortField, sortAsc]);

  // Stats summary
  const stats = useMemo(() => {
    const tracked = trackedWhales.filter(w => w.copy_enabled);
    return {
      totalTracked: trackedWhales.length,
      copyEnabled: tracked.length,
      totalCopyPnL: trackedWhales.reduce((sum, w) => sum + (w.copy_pnl || 0), 0),
      totalCopyTrades: trackedWhales.reduce((sum, w) => sum + (w.copy_trades || 0), 0),
      avgWinRate: tracked.length > 0 
        ? tracked.reduce((sum, w) => sum + w.win_rate, 0) / tracked.length 
        : 0,
    };
  }, [trackedWhales]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Fish className="text-blue-400" />
            Whale Tracker
          </h1>
          <p className="text-gray-400 mt-1">
            Track and copy high win-rate Polymarket traders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={discoverWhales}
            disabled={isDiscovering}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
            {isDiscovering ? 'Discovering...' : 'Discover Whales'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Tracked Whales</p>
              <p className="text-2xl font-bold">{stats.totalTracked}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Copy Enabled</p>
              <p className="text-2xl font-bold text-green-400">{stats.copyEnabled}</p>
            </div>
            <Target className="w-8 h-8 text-green-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Copy P&L</p>
              <p className={`text-2xl font-bold ${stats.totalCopyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${stats.totalCopyPnL >= 0 ? '+' : ''}{stats.totalCopyPnL.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Copy Trades</p>
              <p className="text-2xl font-bold">{stats.totalCopyTrades}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Win Rate</p>
              <p className="text-2xl font-bold text-blue-400">{stats.avgWinRate.toFixed(1)}%</p>
            </div>
            <Trophy className="w-8 h-8 text-yellow-500/50" />
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="h-6 w-px bg-gray-700" />

          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Tiers</option>
              <option value="mega_whale">🐋 Mega Whale</option>
              <option value="whale">🐳 Whale</option>
              <option value="smart_money">💰 Smart Money</option>
              <option value="retail">👤 Retail</option>
            </select>
          </div>

          {/* Show Tracked Only */}
          <button
            onClick={() => setShowTrackedOnly(!showTrackedOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showTrackedOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {showTrackedOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showTrackedOnly ? 'Tracked Only' : 'Show All'}
          </button>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="win_rate">Win Rate</option>
              <option value="volume">Volume</option>
              <option value="predictions">Predictions</option>
              <option value="copy_pnl">Copy P&L</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Whale List */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Fish className="text-blue-400" />
            {showTrackedOnly ? 'Tracked Whales' : 'Leaderboard'} 
            <span className="text-sm font-normal text-gray-400">
              ({displayedWhales.length} {displayedWhales.length === 1 ? 'whale' : 'whales'})
            </span>
          </h2>
        </div>

        {loadingLeaderboard || loadingTracked ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading whales...
          </div>
        ) : displayedWhales.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Fish className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No whales found</p>
            <p className="text-sm mt-1">Try adjusting your filters or discover new whales</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {displayedWhales.map((whale, index) => {
              const address = whale.address;
              const volume = 'total_volume_usd' in whale ? whale.total_volume_usd : ('volume' in whale ? whale.volume : 0);
              const winRate = whale.win_rate;
              const predictions = 'total_predictions' in whale ? whale.total_predictions : ('predictions' in whale ? whale.predictions : 0);
              const name = 'alias' in whale ? whale.alias : ('username' in whale ? whale.username : null);
              const tier = getWhaleTier(volume, winRate);
              const tierInfo = WHALE_TIERS[tier as keyof typeof WHALE_TIERS];
              const TierIcon = tierInfo.icon;
              const tracked = getTrackedWhale(address);
              const isCopyEnabled = tracked?.copy_enabled || false;

              return (
                <motion.div
                  key={address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 hover:bg-gray-800/50 transition-colors ${
                    selectedWhale === address ? 'bg-blue-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {index < 3 ? (
                          <span className={`text-xl ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                            'text-orange-400'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono">#{index + 1}</span>
                        )}
                      </div>

                      {/* Tier Badge */}
                      <div className={`p-2 rounded-lg ${tierInfo.bg}`}>
                        <TierIcon className={`w-5 h-5 ${tierInfo.color}`} />
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {name || `${address.slice(0, 6)}...${address.slice(-4)}`}
                          </span>
                          <button
                            onClick={() => copyAddress(address)}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Copy address"
                          >
                            {copiedAddress === address ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                          <a
                            href={`https://polymarket.com/profile/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-700 rounded"
                            title="View on Polymarket"
                          >
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                          <span className={tierInfo.color}>{tierInfo.label}</span>
                          <span>•</span>
                          <span>{predictions} predictions</span>
                          {tracked && (
                            <>
                              <span>•</span>
                              <span className="text-blue-400">
                                {tracked.copy_trades} copies (${tracked.copy_pnl.toFixed(2)} P&L)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Win Rate</p>
                        <p className={`text-lg font-bold ${
                          winRate >= 80 ? 'text-green-400' :
                          winRate >= 70 ? 'text-blue-400' :
                          winRate >= 60 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {winRate.toFixed(1)}%
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-400">Volume</p>
                        <p className="text-lg font-bold">
                          ${(volume / 1000).toFixed(0)}K
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Track/Untrack */}
                        <button
                          onClick={() => toggleTrackingMutation.mutate({ 
                            address, 
                            enabled: !isTracked(address) 
                          })}
                          className={`p-2 rounded-lg transition-colors ${
                            isTracked(address)
                              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                          title={isTracked(address) ? 'Stop tracking' : 'Start tracking'}
                        >
                          {isTracked(address) ? (
                            <Star className="w-5 h-5 fill-current" />
                          ) : (
                            <StarOff className="w-5 h-5" />
                          )}
                        </button>

                        {/* Copy Trading Toggle (only if tracked) */}
                        {tracked && (
                          <button
                            onClick={() => toggleCopyMutation.mutate({ 
                              address, 
                              enabled: !isCopyEnabled 
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              isCopyEnabled
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                            title={isCopyEnabled ? 'Disable copy trading' : 'Enable copy trading'}
                          >
                            <Zap className={`w-5 h-5 ${isCopyEnabled ? 'fill-current' : ''}`} />
                          </button>
                        )}

                        {/* View Details */}
                        <button
                          onClick={() => setSelectedWhale(selectedWhale === address ? null : address)}
                          className={`p-2 rounded-lg transition-colors ${
                            selectedWhale === address
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                          title="View trades"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {selectedWhale === address && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          {/* Copy Settings (if tracked) */}
                          {tracked && (
                            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
                              <h4 className="font-medium mb-3">Copy Settings</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm text-gray-400 block mb-1">
                                    Copy Multiplier
                                  </label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    max="2"
                                    step="0.1"
                                    value={tracked.copy_multiplier}
                                    onChange={(e) => updateCopySettingsMutation.mutate({
                                      address,
                                      multiplier: parseFloat(e.target.value),
                                      maxSize: tracked.max_copy_size_usd,
                                    })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    {(tracked.copy_multiplier * 100).toFixed(0)}% of whale&apos;s position
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm text-gray-400 block mb-1">
                                    Max Copy Size ($)
                                  </label>
                                  <input
                                    type="number"
                                    min="10"
                                    max="1000"
                                    step="10"
                                    value={tracked.max_copy_size_usd}
                                    onChange={(e) => updateCopySettingsMutation.mutate({
                                      address,
                                      multiplier: tracked.copy_multiplier,
                                      maxSize: parseFloat(e.target.value),
                                    })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recent Trades */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              Recent Trades
                            </h4>
                            {loadingTrades ? (
                              <p className="text-gray-400 text-sm">Loading trades...</p>
                            ) : whaleTrades.length === 0 ? (
                              <p className="text-gray-400 text-sm">No trades recorded yet</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {whaleTrades.slice(0, 10).map((trade) => (
                                  <div
                                    key={trade.id}
                                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg text-sm"
                                  >
                                    <div>
                                      <p className="font-medium">{trade.market_title?.slice(0, 50)}...</p>
                                      <p className="text-gray-400 text-xs">
                                        {new Date(trade.detected_at).toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={trade.side === 'YES' ? 'text-green-400' : 'text-red-400'}>
                                        {trade.direction?.toUpperCase()} {trade.side}
                                      </p>
                                      <p className="text-gray-400">
                                        ${trade.size_usd?.toFixed(0)} @ {(trade.price * 100).toFixed(0)}¢
                                      </p>
                                    </div>
                                    {trade.copied && (
                                      <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                        COPIED
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="card p-4 bg-blue-500/10 border-blue-500/30">
        <div className="flex items-start gap-3">
          <Fish className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <strong>How Whale Copy Trading Works:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside text-blue-300">
              <li>Track whales with 65%+ win rates from the Polymarket leaderboard</li>
              <li>Enable copy trading to automatically mirror their positions</li>
              <li>Set your copy multiplier (e.g., 0.5 = 50% of their position size)</li>
              <li>Trades are executed with a 15-second delay to confirm the whale&apos;s move</li>
              <li>Performance is tracked separately for each whale you follow</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
