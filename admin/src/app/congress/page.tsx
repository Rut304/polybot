'use client';

import { useState, useMemo } from 'react';
import { 
  Users,
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
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Copy,
  Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

interface CongressStats {
  purchases: number;
  sales: number;
  totalVolume: number;
  topPoliticians: { name: string; count: number }[];
  topTickers: { ticker: string; count: number }[];
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

  const trades: CongressionalTrade[] = tradesData?.data || [];
  const stats: CongressStats = tradesData?.stats || {
    purchases: 0,
    sales: 0,
    totalVolume: 0,
    topPoliticians: [],
    topTickers: [],
  };

  // Filter and sort trades
  const displayedTrades = useMemo(() => {
    let filtered = [...trades];

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

                          {/* Right Side - Amount & Date */}
                          <div className="text-right">
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
