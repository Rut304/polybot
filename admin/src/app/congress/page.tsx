'use client';

import { useState, useMemo } from 'react';
import { 
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  Filter,
  Building2,
  Calendar,
  ExternalLink,
  Star,
  StarOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Copy,
  Check,
  Zap,
  Lightbulb,
  Target,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  id: number;
  politician_name: string;
  chamber: string;
  party: string;
  state: string;
  copy_enabled: boolean;
  copy_scale_pct: number;
  min_trade_amount_usd: number;
  max_position_usd: number;
  delay_hours: number;
  total_trades_tracked: number;
  total_volume_usd: number;
  copy_trades: number;
  copy_pnl: number;
  avg_trade_performance_pct: number;
}

interface CongressStats {
  purchases: number;
  sales: number;
  totalVolume: number;
  topPoliticians: { name: string; count: number }[];
  topTickers: { ticker: string; count: number }[];
}

interface CongressInsight {
  id: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  type: 'pattern' | 'opportunity' | 'warning';
  confidence: 'high' | 'medium' | 'low';
  tickers?: string[];
  politicians?: string[];
}

type ChamberFilter = 'both' | 'house' | 'senate';
type PartyFilter = 'all' | 'D' | 'R' | 'I';
type SortField = 'date' | 'amount' | 'politician';

const partyColors: Record<string, string> = {
  D: 'text-blue-400 bg-blue-500/20',
  R: 'text-red-400 bg-red-500/20',
  I: 'text-purple-400 bg-purple-500/20',
  Democrat: 'text-blue-400 bg-blue-500/20',
  Republican: 'text-red-400 bg-red-500/20',
  Independent: 'text-purple-400 bg-purple-500/20',
};

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 999;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

export default function CongressPage() {
  const queryClient = useQueryClient();
  const [chamberFilter, setChamberFilter] = useState<ChamberFilter>('both');
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPolitician, setSelectedPolitician] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);
  const [showInsights, setShowInsights] = useState(true);

  // Fetch congressional trades
  const { data: tradesData, isLoading, refetch } = useQuery({
    queryKey: ['congressTrades', chamberFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        chamber: chamberFilter,
        limit: '500',
      });
      
      if (partyFilter !== 'all') {
        params.set('party', partyFilter);
      }
      
      const response = await fetch(`/api/congress?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trades');
      return response.json();
    },
  });

  // Fetch tracked politicians
  const { data: trackedPoliticians = [] } = useQuery({
    queryKey: ['trackedPoliticians'],
    queryFn: async (): Promise<TrackedPolitician[]> => {
      const { data, error } = await supabase
        .from('polybot_tracked_politicians')
        .select('*')
        .order('copy_pnl', { ascending: false });
      
      if (error) {
        console.error('Error fetching tracked politicians:', error);
        return [];
      }
      return data || [];
    },
  });

  // Toggle politician tracking
  const toggleTrackingMutation = useMutation({
    mutationFn: async ({ politician, enabled, chamber, party, state }: { 
      politician: string; 
      enabled: boolean;
      chamber?: string;
      party?: string;
      state?: string;
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from('polybot_tracked_politicians')
          .upsert({
            politician_name: politician,
            chamber: chamber || 'unknown',
            party: party || 'unknown',
            state: state || '',
            copy_enabled: false,
          }, { onConflict: 'politician_name' });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('polybot_tracked_politicians')
          .delete()
          .eq('politician_name', politician);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedPoliticians'] });
    },
  });

  // Toggle copy trading for a politician
  const toggleCopyMutation = useMutation({
    mutationFn: async ({ politician, enabled }: { politician: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('polybot_tracked_politicians')
        .update({ copy_enabled: enabled })
        .eq('politician_name', politician);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedPoliticians'] });
    },
  });

  const trades: CongressionalTrade[] = tradesData?.data || [];
  const stats: CongressStats = tradesData?.stats || {
    purchases: 0,
    sales: 0,
    totalVolume: 0,
    topPoliticians: [],
    topTickers: [],
  };

  // Helper functions
  const isTracked = (politician: string) => trackedPoliticians.some(p => p.politician_name === politician);
  const getTrackedPolitician = (politician: string) => trackedPoliticians.find(p => p.politician_name === politician);

  // Generate insights from congressional data
  const insights: CongressInsight[] = useMemo(() => {
    if (trades.length === 0) return [];
    
    const insightsList: CongressInsight[] = [];
    
    // Analyze recent purchases by sector
    const recentTrades = trades.filter(t => daysSince(t.transactionDate) <= 30);
    const tickerCounts = new Map<string, { buys: number; sells: number; volume: number; politicians: Set<string> }>();
    
    trades.forEach(t => {
      if (!tickerCounts.has(t.ticker)) {
        tickerCounts.set(t.ticker, { buys: 0, sells: 0, volume: 0, politicians: new Set() });
      }
      const data = tickerCounts.get(t.ticker)!;
      if (t.transactionType === 'purchase') {
        data.buys++;
      } else {
        data.sells++;
      }
      data.volume += t.amountEstimated;
      data.politicians.add(t.politician);
    });
    
    // Find heavily bought stocks
    const heavyBuys = Array.from(tickerCounts.entries())
      .filter(([_, data]) => data.buys >= 3 && data.buys > data.sells * 2)
      .sort((a, b) => b[1].buys - a[1].buys)
      .slice(0, 5);
    
    if (heavyBuys.length > 0) {
      insightsList.push({
        id: 'heavy-buys',
        title: 'Congress Heavily Buying These Stocks',
        description: `${heavyBuys.length} stocks have 3+ congressional purchases with minimal selling.`,
        evidence: heavyBuys.map(([ticker, data]) => 
          `${ticker}: ${data.buys} buys by ${data.politicians.size} politicians`
        ).join(', '),
        recommendation: 'Consider these for potential positions - multiple politicians often indicates committee knowledge.',
        type: 'opportunity',
        confidence: 'high',
        tickers: heavyBuys.map(([t]) => t),
      });
    }
    
    // Find bipartisan trades (both parties buying same stock)
    const bipartisanTrades = trades.reduce((acc, t) => {
      if (!acc[t.ticker]) acc[t.ticker] = { D: 0, R: 0 };
      if (t.party.startsWith('D')) acc[t.ticker].D++;
      if (t.party.startsWith('R')) acc[t.ticker].R++;
      return acc;
    }, {} as Record<string, { D: number; R: number }>);
    
    const bipartisan = Object.entries(bipartisanTrades)
      .filter(([_, counts]) => counts.D >= 2 && counts.R >= 2)
      .map(([ticker]) => ticker);
    
    if (bipartisan.length > 0) {
      insightsList.push({
        id: 'bipartisan',
        title: 'Bipartisan Trading Activity',
        description: `${bipartisan.length} stocks being bought by BOTH parties.`,
        evidence: `Stocks: ${bipartisan.slice(0, 5).join(', ')}`,
        recommendation: 'Bipartisan buying often indicates sector-wide legislation or committee consensus.',
        type: 'pattern',
        confidence: 'high',
        tickers: bipartisan,
      });
    }
    
    // Find top traders
    const politicianStats = new Map<string, { trades: number; volume: number; party: string }>();
    trades.forEach(t => {
      if (!politicianStats.has(t.politician)) {
        politicianStats.set(t.politician, { trades: 0, volume: 0, party: t.party });
      }
      const data = politicianStats.get(t.politician)!;
      data.trades++;
      data.volume += t.amountEstimated;
    });
    
    const topTraders = Array.from(politicianStats.entries())
      .sort((a, b) => b[1].trades - a[1].trades)
      .slice(0, 5);
    
    if (topTraders.length > 0) {
      insightsList.push({
        id: 'top-traders',
        title: 'Most Active Congressional Traders',
        description: `${topTraders[0][0]} leads with ${topTraders[0][1].trades} trades (${formatCurrency(topTraders[0][1].volume)}).`,
        evidence: topTraders.map(([name, data]) => `${name}: ${data.trades} trades`).join(', '),
        recommendation: 'Track their portfolios - high activity often correlates with informed trading.',
        type: 'pattern',
        confidence: 'medium',
        politicians: topTraders.map(([name]) => name),
      });
    }
    
    // Recent large purchases warning
    const largePurchases = recentTrades
      .filter(t => t.transactionType === 'purchase' && t.amountEstimated >= 100000)
      .slice(0, 5);
    
    if (largePurchases.length > 0) {
      insightsList.push({
        id: 'large-purchases',
        title: 'Large Recent Purchases (Last 30 Days)',
        description: `${largePurchases.length} purchases over $100K detected recently.`,
        evidence: largePurchases.map(t => 
          `${t.politician} bought ${t.ticker} (${formatCurrency(t.amountEstimated)})`
        ).join(', '),
        recommendation: 'Large purchases often precede positive news - consider following within 24-48 hours.',
        type: 'opportunity',
        confidence: 'medium',
        tickers: largePurchases.map(t => t.ticker),
        politicians: largePurchases.map(t => t.politician),
      });
    }
    
    return insightsList;
  }, [trades]);

  // Filter and sort trades
  const displayedTrades = useMemo(() => {
    let filtered = [...trades];

    // Apply tracked only filter
    if (showTrackedOnly) {
      const trackedNames = new Set(trackedPoliticians.map(p => p.politician_name));
      filtered = filtered.filter(t => trackedNames.has(t.politician));
    }

    // Apply party filter
    if (partyFilter !== 'all') {
      filtered = filtered.filter(t => t.party.startsWith(partyFilter));
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.politician.toLowerCase().includes(query) ||
        t.ticker.toLowerCase().includes(query) ||
        t.assetName.toLowerCase().includes(query) ||
        t.state.toLowerCase().includes(query)
      );
    }

    // Apply politician filter
    if (selectedPolitician) {
      filtered = filtered.filter(t => t.politician === selectedPolitician);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      
      switch (sortField) {
        case 'date':
          aVal = new Date(a.disclosureDate || a.transactionDate || 0).getTime();
          bVal = new Date(b.disclosureDate || b.transactionDate || 0).getTime();
          break;
        case 'amount':
          aVal = a.amountEstimated;
          bVal = b.amountEstimated;
          break;
        case 'politician':
          aVal = a.politician;
          bVal = b.politician;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      
      if (typeof aVal === 'string') {
        return sortAsc 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [trades, partyFilter, searchQuery, selectedPolitician, sortField, sortAsc]);

  const copyTicker = (ticker: string) => {
    navigator.clipboard.writeText(ticker);
    setCopiedId(ticker);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="text-blue-400" />
              Congressional Tracker
            </h1>
            <p className="text-gray-400 mt-1">
              Track stock trades by members of Congress (disclosed under STOCK Act)
            </p>
          </div>
          
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Purchases</p>
                <p className="text-2xl font-bold text-green-400">{stats.purchases}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Sales</p>
                <p className="text-2xl font-bold text-red-400">{stats.sales}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Est. Volume</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalVolume)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Trades</p>
                <p className="text-2xl font-bold">{trades.length}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Currently Following Panel */}
        {trackedPoliticians.filter(p => p.copy_enabled).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 border-2 border-green-500/30 bg-green-500/5 mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Currently Copy Trading</span>
                <span className="text-sm text-gray-400">({trackedPoliticians.filter(p => p.copy_enabled).length} politicians)</span>
              </h3>
              <button
                onClick={() => setShowTrackedOnly(true)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View All →
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {trackedPoliticians.filter(p => p.copy_enabled).map(pol => (
                <div
                  key={pol.politician_name}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-green-500/50 transition-colors"
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className={`px-1.5 py-0.5 rounded text-xs ${partyColors[pol.party] || 'bg-gray-500/20 text-gray-400'}`}>
                    {pol.party?.charAt(0) || '?'}
                  </span>
                  <span className="font-medium">{pol.politician_name}</span>
                  <span className={`text-sm ${pol.copy_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${pol.copy_pnl >= 0 ? '+' : ''}{pol.copy_pnl.toFixed(2)}
                  </span>
                  <button
                    onClick={() => toggleCopyMutation.mutate({ politician: pol.politician_name, enabled: false })}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                    title="Stop copying"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Strategy Insights */}
        {insights.length > 0 && (
          <div className="card p-4 mb-8">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-semibold flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <span>Congressional Trading Insights</span>
                <span className="text-sm text-gray-400">({insights.length} patterns detected)</span>
              </h3>
              {showInsights ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            <AnimatePresence>
              {showInsights && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 space-y-4 overflow-hidden"
                >
                  {insights.map((insight) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 rounded-lg border ${
                        insight.type === 'pattern' ? 'border-blue-500/50 bg-blue-500/10' :
                        insight.type === 'warning' ? 'border-orange-500/50 bg-orange-500/10' :
                        'border-green-500/50 bg-green-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          insight.type === 'pattern' ? 'bg-blue-500/20' :
                          insight.type === 'warning' ? 'bg-orange-500/20' :
                          'bg-green-500/20'
                        }`}>
                          {insight.type === 'pattern' ? <BarChart3 className="w-5 h-5 text-blue-400" /> :
                           insight.type === 'warning' ? <AlertCircle className="w-5 h-5 text-orange-400" /> :
                           <Target className="w-5 h-5 text-green-400" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{insight.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              insight.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                              insight.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {insight.confidence} confidence
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">{insight.description}</p>
                          <p className="text-gray-500 text-sm mt-1 italic">&quot;{insight.evidence}&quot;</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">💡</span>
                            <span className="text-sm">{insight.recommendation}</span>
                          </div>
                          {insight.tickers && insight.tickers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {insight.tickers.slice(0, 8).map(ticker => (
                                <button
                                  key={ticker}
                                  onClick={() => copyTicker(ticker)}
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-mono"
                                >
                                  {ticker}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Top Politicians & Tickers */}
          <div className="lg:col-span-1 space-y-4">
            {/* Top Politicians */}
            <div className="card p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Top Politicians
              </h3>
              <div className="space-y-2">
                {stats.topPoliticians.slice(0, 8).map((pol, i) => (
                  <button
                    key={pol.name}
                    onClick={() => setSelectedPolitician(
                      selectedPolitician === pol.name ? null : pol.name
                    )}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                      selectedPolitician === pol.name
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <span className="truncate">{pol.name}</span>
                    <span className="text-gray-400">{pol.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Top Tickers */}
            <div className="card p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-400" />
                Top Tickers
              </h3>
              <div className="space-y-2">
                {stats.topTickers.slice(0, 10).map((ticker) => (
                  <div
                    key={ticker.ticker}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800"
                  >
                    <span className="font-mono text-green-400">{ticker.ticker}</span>
                    <span className="text-gray-400">{ticker.count} trades</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Trades List */}
          <div className="lg:col-span-3">
            {/* Filters */}
            <div className="card p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search politician, ticker, state..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    title="Search trades"
                  />
                </div>

                {/* Chamber Filter */}
                <select
                  value={chamberFilter}
                  onChange={(e) => setChamberFilter(e.target.value as ChamberFilter)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  title="Filter by chamber"
                >
                  <option value="both">Both Chambers</option>
                  <option value="house">House</option>
                  <option value="senate">Senate</option>
                </select>

                {/* Party Filter */}
                <select
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value as PartyFilter)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  title="Filter by party"
                >
                  <option value="all">All Parties</option>
                  <option value="D">Democrats</option>
                  <option value="R">Republicans</option>
                  <option value="I">Independents</option>
                </select>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    title="Sort by field"
                  >
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="politician">Politician</option>
                  </select>
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                    title="Toggle sort order"
                  >
                    {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {selectedPolitician && (
                  <button
                    onClick={() => setSelectedPolitician(null)}
                    className="px-3 py-2 bg-blue-600 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    {selectedPolitician}
                    <span className="text-xs">×</span>
                  </button>
                )}
              </div>
            </div>

            {/* Trades Table */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="text-blue-400" />
                  Recent Trades
                  <span className="text-sm font-normal text-gray-400">
                    ({displayedTrades.length} trades)
                  </span>
                </h2>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading congressional trades...
                </div>
              ) : displayedTrades.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No trades found</p>
                  <p className="text-sm mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {displayedTrades.slice(0, 100).map((trade, index) => {
                    const partyClass = partyColors[trade.party] || partyColors[trade.party[0]] || 'text-gray-400 bg-gray-500/20';
                    const isBuy = trade.transactionType === 'purchase';
                    const days = daysSince(trade.disclosureDate || trade.transactionDate);
                    
                    return (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="p-4 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {/* Transaction Type */}
                              <div className={`p-2 rounded-lg ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                {isBuy ? (
                                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                                )}
                              </div>

                              {/* Politician Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{trade.politician}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${partyClass}`}>
                                    {trade.party}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {trade.chamber.toUpperCase()} • {trade.state}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Trade Details */}
                            <div className="flex items-center gap-4 ml-11">
                              {/* Ticker */}
                              <button
                                onClick={() => copyTicker(trade.ticker)}
                                className="flex items-center gap-1 font-mono font-bold text-lg text-blue-400 hover:text-blue-300"
                                title="Copy ticker"
                              >
                                {trade.ticker}
                                {copiedId === trade.ticker ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-50" />
                                )}
                              </button>

                              {/* Asset Name (truncated) */}
                              <span className="text-sm text-gray-400 truncate max-w-[200px]">
                                {trade.assetName}
                              </span>
                            </div>
                          </div>

                          {/* Right Side - Amount, Date & Track Button */}
                          <div className="text-right flex items-start gap-4">
                            <div>
                              <p className={`text-lg font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(trade.amountEstimated)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(trade.amountLow)} - {formatCurrency(trade.amountHigh)}
                              </p>
                              <div className="flex items-center gap-2 justify-end mt-1">
                                <Calendar className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-400">
                                  {formatDate(trade.disclosureDate || trade.transactionDate)}
                                </span>
                                {days <= 7 && (
                                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                                    New
                                  </span>
                                )}
                              </div>
                              {trade.disclosureUrl && (
                                <a
                                  href={trade.disclosureUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
                                >
                                  View Filing <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            
                            {/* Track Politician Button */}
                            <button
                              onClick={() => {
                                const isTracked = trackedPoliticians.some(p => p.politician_name === trade.politician);
                                if (!isTracked) {
                                  toggleTrackingMutation.mutate({
                                    politician: trade.politician,
                                    enabled: true,
                                    party: trade.party,
                                    chamber: trade.chamber,
                                    state: trade.state
                                  });
                                }
                              }}
                              disabled={trackedPoliticians.some(p => p.politician_name === trade.politician)}
                              className={`p-2 rounded-lg transition-colors ${
                                trackedPoliticians.some(p => p.politician_name === trade.politician)
                                  ? 'bg-green-500/20 text-green-400 cursor-default'
                                  : 'bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white'
                              }`}
                              title={trackedPoliticians.some(p => p.politician_name === trade.politician) ? 'Already tracking' : 'Track this politician'}
                            >
                              {trackedPoliticians.some(p => p.politician_name === trade.politician) ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <UserPlus className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
