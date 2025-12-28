'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  User,
  TrendingUp,
  DollarSign,
  ExternalLink,
  Star,
  StarOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface CongressionalTrade {
  id: string;
  politician: string;
  chamber: 'house' | 'senate';
  party: string;
  state: string;
  ticker: string;
  assetName: string;
  transactionType: 'purchase' | 'sale' | 'exchange';
  transactionDate: string;
  disclosureDate: string;
  amountLow: number;
  amountHigh: number;
  amountEstimated: number;
  source: string;
  disclosureUrl?: string;
}

interface TrackedPolitician {
  id: string;
  name: string;
  chamber: string;
  party: string;
  state: string;
  copy_enabled: boolean;
  copy_scale_pct: number;
  max_copy_size_usd: number;
  total_trades: number;
  winning_trades: number;
  total_pnl_usd: number;
}

export default function CongressPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<CongressionalTrade[]>([]);
  const [trackedPoliticians, setTrackedPoliticians] = useState<TrackedPolitician[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [chamberFilter, setChamberFilter] = useState<'all' | 'house' | 'senate'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'Democrat' | 'Republican'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sale'>('all');
  
  // Stats
  const [stats, setStats] = useState({
    totalTrades: 0,
    purchases: 0,
    sales: 0,
    totalVolume: 0,
    topPoliticians: [] as { name: string; trades: number; volume: number }[]
  });

  const fetchTrades = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/congress');
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      setTrades(data.trades || []);
      
      // Calculate stats
      const purchases = data.trades.filter((t: CongressionalTrade) => t.transactionType === 'purchase');
      const sales = data.trades.filter((t: CongressionalTrade) => t.transactionType === 'sale');
      const totalVolume = data.trades.reduce((sum: number, t: CongressionalTrade) => sum + t.amountEstimated, 0);
      
      // Group by politician
      const politicianVolumes = data.trades.reduce((acc: Record<string, { trades: number; volume: number }>, t: CongressionalTrade) => {
        if (!acc[t.politician]) acc[t.politician] = { trades: 0, volume: 0 };
        acc[t.politician].trades++;
        acc[t.politician].volume += t.amountEstimated;
        return acc;
      }, {});
      
      const topPoliticians = Object.entries(politicianVolumes)
        .map(([name, data]) => ({ name, ...(data as { trades: number; volume: number }) }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);
      
      setStats({
        totalTrades: data.trades.length,
        purchases: purchases.length,
        sales: sales.length,
        totalVolume,
        topPoliticians
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTrackedPoliticians = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('polybot_tracked_politicians')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      setTrackedPoliticians(data || []);
    } catch (err) {
      console.error('Failed to fetch tracked politicians:', err);
    }
  };

  const toggleTrackPolitician = async (politician: string, chamber: string, party: string, state: string) => {
    if (!user) return;
    
    const existing = trackedPoliticians.find(p => p.name === politician);
    
    try {
      if (existing) {
        // Toggle copy_enabled
        const { error } = await supabase
          .from('polybot_tracked_politicians')
          .update({ copy_enabled: !existing.copy_enabled })
          .eq('id', existing.id);
        
        if (error) throw error;
        
        setTrackedPoliticians(prev => 
          prev.map(p => p.id === existing.id ? { ...p, copy_enabled: !p.copy_enabled } : p)
        );
      } else {
        // Insert new tracked politician
        const { data, error } = await supabase
          .from('polybot_tracked_politicians')
          .insert({
            user_id: user.id,
            name: politician,
            chamber,
            party,
            state,
            copy_enabled: true,
            copy_scale_pct: 10,
            max_copy_size_usd: 1000,
          })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setTrackedPoliticians(prev => [...prev, data]);
      }
    } catch (err) {
      console.error('Failed to track politician:', err);
    }
  };

  useEffect(() => {
    fetchTrades();
    fetchTrackedPoliticians();
  }, [user]);

  // Filter trades
  const filteredTrades = trades.filter(trade => {
    if (searchQuery && !trade.politician.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !trade.ticker.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (chamberFilter !== 'all' && trade.chamber !== chamberFilter) return false;
    if (partyFilter !== 'all' && trade.party !== partyFilter) return false;
    if (typeFilter !== 'all' && trade.transactionType !== typeFilter) return false;
    return true;
  });

  const isTracked = (politician: string) => {
    const tracked = trackedPoliticians.find(p => p.name === politician);
    return tracked?.copy_enabled || false;
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const partyColor = (party: string) => {
    if (party.toLowerCase().includes('democrat')) return 'text-blue-400';
    if (party.toLowerCase().includes('republican')) return 'text-red-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="text-blue-400" />
              Congressional Tracker
            </h1>
            <p className="text-gray-400 mt-1">
              Track and copy stock trades by members of Congress
            </p>
          </div>
          <button
            onClick={fetchTrades}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-dark-card rounded-xl p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Purchases</div>
            <div className="text-2xl font-bold text-green-400">{stats.purchases}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Sales</div>
            <div className="text-2xl font-bold text-red-400">{stats.sales}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Volume</div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalVolume)}</div>
          </div>
        </div>

        {/* Top Traders */}
        <div className="bg-dark-card rounded-xl p-6 border border-white/10 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Top Traders by Volume
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.topPoliticians.map((pol, i) => (
              <div key={pol.name} className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  i === 1 ? 'bg-gray-400/20 text-gray-300' :
                  i === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-gray-600/20 text-gray-400'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{pol.name}</div>
                  <div className="text-xs text-gray-400">
                    {pol.trades} trades · {formatCurrency(pol.volume)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search politician or ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <select
            value={chamberFilter}
            onChange={(e) => setChamberFilter(e.target.value as 'all' | 'house' | 'senate')}
            className="px-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
            aria-label="Filter by chamber"
          >
            <option value="all">All Chambers</option>
            <option value="house">House</option>
            <option value="senate">Senate</option>
          </select>
          
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value as 'all' | 'Democrat' | 'Republican')}
            className="px-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
            aria-label="Filter by party"
          >
            <option value="all">All Parties</option>
            <option value="Democrat">Democrat</option>
            <option value="Republican">Republican</option>
          </select>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'purchase' | 'sale')}
            className="px-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
            aria-label="Filter by transaction type"
          >
            <option value="all">All Types</option>
            <option value="purchase">Purchases</option>
            <option value="sale">Sales</option>
          </select>
        </div>

        {/* Trades Table */}
        <div className="bg-dark-card rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-dark-bg">
                  <th className="text-left p-4 text-gray-400 font-medium">Track</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Politician</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Ticker</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Type</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Amount</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Trade Date</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Disclosed</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTrades.map((trade, i) => (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <button
                          onClick={() => toggleTrackPolitician(trade.politician, trade.chamber, trade.party, trade.state)}
                          className={`p-2 rounded-lg transition-colors ${
                            isTracked(trade.politician)
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-700/50 text-gray-400 hover:text-yellow-400'
                          }`}
                        >
                          {isTracked(trade.politician) ? (
                            <Star className="w-4 h-4 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            trade.chamber === 'senate' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {trade.chamber === 'senate' ? 'S' : 'H'}
                          </div>
                          <div>
                            <div className="font-medium">{trade.politician}</div>
                            <div className="text-xs text-gray-400">
                              <span className={partyColor(trade.party)}>{trade.party.charAt(0)}</span>
                              {' · '}{trade.state}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold text-lg">{trade.ticker}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[150px]">{trade.assetName}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          trade.transactionType === 'purchase' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.transactionType === 'purchase' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {trade.transactionType === 'purchase' ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{formatCurrency(trade.amountEstimated)}</div>
                        <div className="text-xs text-gray-400">
                          {formatCurrency(trade.amountLow)} - {formatCurrency(trade.amountHigh)}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        {formatDate(trade.transactionDate)}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {formatDate(trade.disclosureDate)}
                        {trade.disclosureUrl && (
                          <a 
                            href={trade.disclosureUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-400 hover:text-blue-300"
                            title="View disclosure document"
                          >
                            <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          {filteredTrades.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No trades found matching your filters
            </div>
          )}
        </div>

        {/* Tracked Politicians */}
        {trackedPoliticians.length > 0 && (
          <div className="mt-8 bg-dark-card rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Your Tracked Politicians ({trackedPoliticians.filter(p => p.copy_enabled).length} active)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trackedPoliticians.map(pol => (
                <div 
                  key={pol.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    pol.copy_enabled 
                      ? 'bg-yellow-500/10 border-yellow-500/30' 
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{pol.name}</div>
                    <button
                      onClick={() => toggleTrackPolitician(pol.name, pol.chamber, pol.party, pol.state)}
                      className={`p-1 rounded ${pol.copy_enabled ? 'text-yellow-400' : 'text-gray-500'}`}
                    >
                      {pol.copy_enabled ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    {pol.chamber.toUpperCase()} · {pol.party} · {pol.state}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">
                      Copy: {pol.copy_scale_pct}%
                    </span>
                    <span className="text-gray-400">
                      Max: {formatCurrency(pol.max_copy_size_usd)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Source Info */}
        <div className="mt-8 text-center text-xs text-gray-500">
          Data sourced from STOCK Act disclosures via House Stock Watcher, Senate Stock Watcher, and Capitol Trades.
          <br />
          Congress members must disclose trades within 45 days. Information may be delayed.
        </div>
      </div>
    </div>
  );
}
