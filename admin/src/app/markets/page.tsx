'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  TrendingUp, 
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  BarChart3,
  Clock,
  Star,
  StarOff,
  Plus,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn, timeAgo } from '@/lib/utils';
import { ManualTradeModal } from '@/components/ManualTradeModal';
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from '@/lib/hooks';

interface Market {
  id: string;
  question: string;
  description?: string;
  category?: string;
  yes_price: number;
  no_price: number;
  volume?: number;
  liquidity?: number;
  end_date?: string;
  platform: 'polymarket' | 'kalshi';
  url?: string;
}

const ITEMS_PER_PAGE = 24;

// Categories for filtering
const CATEGORIES = [
  'All',
  'Politics',
  'Sports',
  'Crypto',
  'Finance',
  'Entertainment',
  'Science',
  'Other',
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<'all' | 'polymarket' | 'kalshi'>('all');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'volume' | 'price' | 'recent'>('volume');
  const [page, setPage] = useState(1);
  const [totalMarkets, setTotalMarkets] = useState(0);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  
  // Watchlist hooks
  const { data: watchlist = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  
  const watchlistIds = new Set(watchlist.map(w => w.market_id));

  // Load markets from our API route (bypasses CORS)
  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/markets');
        if (!response.ok) throw new Error('Failed to fetch markets');
        
        const data = await response.json();
        setMarkets(data.markets || []);
        setTotalMarkets(data.total || 0);
      } catch (e) {
        console.error('Failed to load markets:', e);
        setError('Failed to load markets. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadMarkets();
  }, []);

  // Toggle watchlist
  const toggleWatchlist = (market: Market) => {
    const isWatched = watchlistIds.has(market.id);
    if (isWatched) {
      removeFromWatchlist.mutate(market.id);
    } else {
      addToWatchlist.mutate({
        market_id: market.id,
        platform: market.platform,
        market_title: market.question,
        category: market.category,
      });
    }
  };

  // Filter and sort markets
  const filteredMarkets = markets
    .filter(m => {
      // Platform filter
      if (platform !== 'all' && m.platform !== platform) return false;
      
      // Category filter
      if (category !== 'All' && m.category?.toLowerCase() !== category.toLowerCase()) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return m.question.toLowerCase().includes(searchLower) ||
               m.description?.toLowerCase().includes(searchLower);
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume || 0) - (a.volume || 0);
        case 'price':
          return Math.abs(0.5 - a.yes_price) - Math.abs(0.5 - b.yes_price);
        case 'recent':
          return new Date(b.end_date || 0).getTime() - new Date(a.end_date || 0).getTime();
        default:
          return 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredMarkets.length / ITEMS_PER_PAGE);
  const paginatedMarkets = filteredMarkets.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, platform, category, sortBy]);

  const openTrade = (market: Market) => {
    setSelectedMarket(market);
    setShowTradeModal(true);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-neon-purple" />
            Markets Browser
          </h1>
          <p className="text-gray-400 mt-2">
            Browse {totalMarkets.toLocaleString()}+ markets from Polymarket and Kalshi
          </p>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-neon-purple"
              />
            </div>

            {/* Platform filter */}
            <div className="flex bg-dark-bg rounded-lg border border-dark-border p-1">
              {(['all', 'polymarket', 'kalshi'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    platform === p 
                      ? p === 'polymarket' ? 'bg-polymarket text-white'
                        : p === 'kalshi' ? 'bg-kalshi text-white'
                        : 'bg-dark-border text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {p === 'all' ? 'All' : p === 'polymarket' ? '🔵 Polymarket' : '🟢 Kalshi'}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-neon-purple"
            >
              <option value="volume">Sort by Volume</option>
              <option value="price">Sort by Edge (50%)</option>
              <option value="recent">Sort by End Date</option>
            </select>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  category === cat
                    ? "bg-neon-purple text-white"
                    : "bg-dark-bg text-gray-400 hover:text-white border border-dark-border"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-400">
            Showing {paginatedMarkets.length} of {filteredMarkets.length.toLocaleString()} markets
          </p>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
            <span className="ml-3 text-gray-400">Loading markets...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-dark-border rounded-lg hover:bg-dark-border/80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Markets grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedMarkets.map((market) => (
                <motion.div
                  key={`${market.platform}-${market.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "bg-dark-card rounded-xl border-2 overflow-hidden hover:border-opacity-100 transition-all",
                    market.platform === 'polymarket' 
                      ? "border-polymarket/50 hover:border-polymarket" 
                      : "border-kalshi/50 hover:border-kalshi"
                  )}
                >
                  {/* Platform indicator */}
                  <div className={cn(
                    "h-1",
                    market.platform === 'polymarket' ? "bg-polymarket" : "bg-kalshi"
                  )} />
                  
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        market.platform === 'polymarket' 
                          ? "bg-polymarket/20 text-polymarket" 
                          : "bg-kalshi/20 text-kalshi"
                      )}>
                        {market.platform === 'polymarket' ? '🔵 Polymarket' : '🟢 Kalshi'}
                      </div>
                      
                      <button
                        onClick={() => toggleWatchlist(market)}
                        className={cn(
                          "p-1.5 rounded transition-colors",
                          watchlistIds.has(market.id) 
                            ? "bg-yellow-500/20 hover:bg-yellow-500/30"
                            : "hover:bg-dark-border"
                        )}
                        title={watchlistIds.has(market.id) ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        {watchlistIds.has(market.id) 
                          ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          : <StarOff className="w-4 h-4 text-gray-500" />
                        }
                      </button>
                    </div>

                    {/* Question */}
                    <h3 className="font-semibold mb-3 line-clamp-2 min-h-[48px]">
                      {market.question}
                    </h3>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-green-500/10 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Yes</p>
                        <p className="text-xl font-bold text-green-400">
                          {(market.yes_price * 100).toFixed(0)}¢
                        </p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">No</p>
                        <p className="text-xl font-bold text-red-400">
                          {(market.no_price * 100).toFixed(0)}¢
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                      {market.volume !== undefined && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {market.volume >= 1000000 
                            ? `${(market.volume / 1000000).toFixed(1)}M` 
                            : market.volume >= 1000
                              ? `${(market.volume / 1000).toFixed(0)}K`
                              : market.volume.toFixed(0)
                          } vol
                        </span>
                      )}
                      {market.end_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(market.end_date) > new Date() 
                            ? `Ends ${timeAgo(market.end_date)}` 
                            : 'Ended'}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openTrade(market)}
                        className={cn(
                          "flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors",
                          market.platform === 'polymarket'
                            ? "bg-polymarket hover:bg-polymarket/80 text-white"
                            : "bg-kalshi hover:bg-kalshi/80 text-white"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                        Trade
                      </button>
                      <a
                        href={market.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-dark-border rounded-lg hover:bg-dark-border/80 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* No results */}
        {!loading && !error && paginatedMarkets.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No markets found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors text-sm"
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = page <= 3 ? i + 1 : page - 2 + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-10 h-10 rounded-lg transition-colors text-sm font-medium",
                    page === pageNum
                      ? "bg-neon-purple text-white"
                      : "bg-dark-card hover:bg-dark-border"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-2 bg-dark-card rounded-lg disabled:opacity-50 hover:bg-dark-border transition-colors text-sm"
            >
              Last
            </button>
          </div>
        )}
      </div>

      {/* Trade Modal */}
      {selectedMarket && (
        <ManualTradeModal
          isOpen={showTradeModal}
          onClose={() => {
            setShowTradeModal(false);
            setSelectedMarket(null);
          }}
          prefillMarket={{
            platform: selectedMarket.platform,
            market_id: selectedMarket.id,
            market_title: selectedMarket.question,
            yes_price: selectedMarket.yes_price,
            no_price: selectedMarket.no_price,
          }}
        />
      )}
    </div>
  );
}
