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
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, cn, timeAgo } from '@/lib/utils';
import { ManualTradeModal } from '@/components/ManualTradeModal';
import { StockTradeModal } from '@/components/StockTradeModal';
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from '@/lib/hooks';
import { Tooltip, METRIC_TOOLTIPS } from '@/components/Tooltip';

// Asset types
type AssetType = 'all' | 'prediction' | 'stock' | 'crypto';
type Platform = 'all' | 'polymarket' | 'kalshi' | 'alpaca' | 'ccxt';

interface Market {
  id: string;
  question: string;
  symbol?: string;
  description?: string;
  category?: string;
  yes_price: number;
  no_price: number;
  price?: number;
  change_24h?: number;
  change_pct?: number;  // 24h price change percentage
  volume?: number;
  liquidity?: number;
  market_cap?: number;  // For crypto
  market_cap_tier?: string;  // Mega, Large, Mid, Small
  image?: string;  // Crypto coin image URL
  end_date?: string;
  platform: 'polymarket' | 'kalshi' | 'alpaca' | 'binance' | 'bybit' | 'okx';
  asset_type: 'prediction' | 'stock' | 'crypto';
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
  'Tech',
  'Other',
];

// Platform display info
const PLATFORM_INFO: Record<string, { name: string; color: string; borderColor: string; bgColor: string; textColor: string; icon: string }> = {
  polymarket: { name: 'Polymarket', color: 'bg-blue-500', borderColor: 'border-blue-500', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', icon: '🔵' },
  kalshi: { name: 'Kalshi', color: 'bg-green-500', borderColor: 'border-green-500', bgColor: 'bg-green-500/20', textColor: 'text-green-400', icon: '🟢' },
  alpaca: { name: 'Alpaca', color: 'bg-yellow-500', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-400', icon: '📈' },
  binance: { name: 'Binance', color: 'bg-orange-500', borderColor: 'border-orange-500', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400', icon: '₿' },
  bybit: { name: 'Bybit', color: 'bg-purple-500', borderColor: 'border-purple-500', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400', icon: '₿' },
  okx: { name: 'OKX', color: 'bg-cyan-500', borderColor: 'border-cyan-500', bgColor: 'bg-cyan-500/20', textColor: 'text-cyan-400', icon: '₿' },
};

// Helper to get platform info with fallback
const getPlatformInfo = (platform: string) => {
  return PLATFORM_INFO[platform] || { 
    name: platform, 
    color: 'bg-gray-500', 
    borderColor: 'border-gray-500', 
    bgColor: 'bg-gray-500/20', 
    textColor: 'text-gray-400', 
    icon: '📊' 
  };
};

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<Platform>('all');
  const [assetType, setAssetType] = useState<AssetType>('all');
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
        platform: market.platform as 'polymarket' | 'kalshi',
        market_title: market.question || market.symbol || '',
        category: market.category,
      });
    }
  };

  // Filter and sort markets
  const filteredMarkets = markets
    .filter(m => {
      // Asset type filter
      if (assetType !== 'all' && m.asset_type !== assetType) return false;
      
      // Platform filter
      if (platform !== 'all') {
        if (platform === 'ccxt') {
          // CCXT includes all crypto exchanges
          if (!['binance', 'bybit', 'okx'].includes(m.platform)) return false;
        } else if (m.platform !== platform) {
          return false;
        }
      }
      
      // Category filter
      if (category !== 'All' && m.category?.toLowerCase() !== category.toLowerCase()) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return (m.question?.toLowerCase().includes(searchLower) ||
               m.symbol?.toLowerCase().includes(searchLower) ||
               m.description?.toLowerCase().includes(searchLower));
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
  }, [search, platform, category, sortBy, assetType]);

  // Reset platform filter when asset type changes to prevent conflicts
  // (e.g., selecting Crypto asset type + Alpaca platform = 0 results)
  useEffect(() => {
    if (assetType === 'crypto') {
      // Auto-select crypto platform filter when crypto asset type is selected
      if (platform !== 'all' && platform !== 'ccxt') {
        setPlatform('ccxt');
      }
    } else if (assetType === 'stock') {
      // Auto-select alpaca platform filter when stock asset type is selected
      if (platform !== 'all' && platform !== 'alpaca') {
        setPlatform('alpaca');
      }
    } else if (assetType === 'prediction') {
      // Reset to all for prediction markets (has polymarket + kalshi)
      if (platform === 'alpaca' || platform === 'ccxt') {
        setPlatform('all');
      }
    }
  }, [assetType, platform]);

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
            Browse {totalMarkets.toLocaleString()}+ markets from Polymarket, Kalshi, Alpaca, and crypto exchanges
          </p>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <label htmlFor="market-search" className="sr-only">Search markets</label>
              <input
                id="market-search"
                type="text"
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-neon-purple"
              />
            </div>

            {/* Asset Type filter */}
            <div className="flex bg-dark-bg rounded-lg border border-dark-border p-1">
              {([
                { value: 'all', label: 'All', icon: '📊' },
                { value: 'prediction', label: 'Prediction', icon: '🎯' },
                { value: 'stock', label: 'Stocks', icon: '📈' },
                { value: 'crypto', label: 'Crypto', icon: '₿' },
              ] as const).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAssetType(t.value)}
                  title={`Filter by ${t.label}`}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    assetType === t.value 
                      ? 'bg-neon-purple text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Platform filter */}
            <div className="flex bg-dark-bg rounded-lg border border-dark-border p-1">
              {([
                { value: 'all', label: 'All', color: 'bg-dark-border' },
                { value: 'polymarket', label: '🔵 Polymarket', color: 'bg-polymarket' },
                { value: 'kalshi', label: '🟢 Kalshi', color: 'bg-kalshi' },
                { value: 'alpaca', label: '📈 Alpaca', color: 'bg-yellow-500' },
                { value: 'ccxt', label: '₿ Crypto', color: 'bg-orange-500' },
              ] as const).map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  title={`Filter by ${p.label}`}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    platform === p.value 
                      ? `${p.color} text-white`
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <label htmlFor="sort-select" className="sr-only">Sort by</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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
                title={`Filter by ${cat} category`}
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
                title="Previous page"
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
                title="Next page"
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
              {paginatedMarkets.map((market) => {
                const platformInfo = getPlatformInfo(market.platform);
                return (
                <motion.div
                  key={`${market.platform}-${market.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "bg-dark-card rounded-xl border-2 overflow-hidden hover:border-opacity-100 transition-all",
                    `${platformInfo.borderColor}/50 hover:${platformInfo.borderColor}`
                  )}
                >
                  {/* Platform indicator */}
                  <div className={cn("h-1", platformInfo.color)} />
                  
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        platformInfo.bgColor, platformInfo.textColor
                      )}>
                        {platformInfo.icon} {platformInfo.name}
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

                    {/* Title - Different display for prediction vs crypto/stock */}
                    {/* Robust check: prediction markets are ONLY polymarket/kalshi with prediction asset_type */}
                    {(market.platform === 'polymarket' || market.platform === 'kalshi') ? (
                      /* Prediction Market - Show question */
                      <h3 className="font-semibold mb-3 line-clamp-2 min-h-[48px]">
                        {market.question}
                      </h3>
                    ) : (
                      /* Crypto/Stock - Show symbol with image */
                      <div className="flex items-center gap-3 mb-3 min-h-[48px]">
                        {market.image && (
                          <img 
                            src={market.image} 
                            alt={market.symbol || ''} 
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">
                            {market.symbol || market.question}
                          </h3>
                          <p className="text-sm text-gray-400 truncate">
                            {market.description || market.question}
                          </p>
                        </div>
                        {market.market_cap_tier && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded shrink-0",
                            market.market_cap_tier === 'Mega' ? "bg-purple-500/20 text-purple-400" :
                            market.market_cap_tier === 'Large' ? "bg-blue-500/20 text-blue-400" :
                            market.market_cap_tier === 'Mid' ? "bg-green-500/20 text-green-400" :
                            "bg-gray-500/20 text-gray-400"
                          )}>
                            {market.market_cap_tier}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Prices - Different display for prediction vs crypto/stock */}
                    {/* Prediction markets = polymarket or kalshi ONLY */}
                    {(market.platform === 'polymarket' || market.platform === 'kalshi') ? (
                      /* Prediction Market - Yes/No prices */
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <Tooltip content={METRIC_TOOLTIPS.yesPrice} position="bottom">
                          <div className="bg-green-500/10 rounded-lg p-3 text-center w-full cursor-help">
                            <p className="text-xs text-gray-400 mb-1">Yes</p>
                            <p className="text-xl font-bold text-green-400">
                              {(market.yes_price * 100).toFixed(0)}¢
                            </p>
                          </div>
                        </Tooltip>
                        <Tooltip content={METRIC_TOOLTIPS.noPrice} position="bottom">
                          <div className="bg-red-500/10 rounded-lg p-3 text-center w-full cursor-help">
                            <p className="text-xs text-gray-400 mb-1">No</p>
                            <p className="text-xl font-bold text-red-400">
                              {(market.no_price * 100).toFixed(0)}¢
                            </p>
                          </div>
                        </Tooltip>
                      </div>
                    ) : (
                      /* Crypto/Stock - Single price with change */
                      <div className="mb-4">
                        <div className="bg-dark-border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-400">Price</p>
                            {market.change_pct !== undefined && (
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                market.change_pct >= 0 
                                  ? "bg-green-500/20 text-green-400" 
                                  : "bg-red-500/20 text-red-400"
                              )}>
                                {market.change_pct >= 0 ? '+' : ''}{(market.change_pct || 0).toFixed(2)}%
                              </span>
                            )}
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {market.yes_price >= 1000 
                              ? `$${market.yes_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : market.yes_price >= 1 
                                ? `$${market.yes_price.toFixed(2)}`
                                : market.yes_price >= 0.01
                                  ? `$${market.yes_price.toFixed(4)}`
                                  : `$${market.yes_price.toFixed(6)}`
                            }
                          </p>
                          {market.market_cap && (
                            <p className="text-xs text-gray-500 mt-1">
                              Market Cap: ${(market.market_cap / 1e9).toFixed(2)}B
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats - Different for prediction vs crypto/stock */}
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                      {(market.platform === 'polymarket' || market.platform === 'kalshi') ? (
                        /* Prediction market stats */
                        <>
                          {market.volume !== undefined && (
                            <Tooltip content={METRIC_TOOLTIPS.volume} position="top">
                              <span className="flex items-center gap-1 cursor-help">
                                <DollarSign className="w-3 h-3" />
                                {market.volume >= 1000000 
                                  ? `${(market.volume / 1000000).toFixed(1)}M` 
                                  : market.volume >= 1000
                                    ? `${(market.volume / 1000).toFixed(0)}K`
                                    : market.volume.toFixed(0)
                                } vol
                              </span>
                            </Tooltip>
                          )}
                          {market.end_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(market.end_date) > new Date() 
                                ? `Ends ${timeAgo(market.end_date)}` 
                                : 'Ended'}
                            </span>
                          )}
                        </>
                      ) : (
                        /* Crypto/Stock stats */
                        <>
                          {market.volume !== undefined && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              24h Vol: {market.volume >= 1000000000 
                                ? `$${(market.volume / 1000000000).toFixed(1)}B`
                                : market.volume >= 1000000 
                                  ? `$${(market.volume / 1000000).toFixed(1)}M` 
                                  : market.volume >= 1000
                                    ? `$${(market.volume / 1000).toFixed(0)}K`
                                    : `$${market.volume.toFixed(0)}`
                              }
                            </span>
                          )}
                          {market.category && market.category !== 'Crypto' && (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {market.category}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openTrade(market)}
                        className={cn(
                          "flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors",
                          `${platformInfo.color} hover:opacity-80 text-white`
                        )}
                      >
                        <Plus className="w-4 h-4" />
                        {(market.platform === 'polymarket' || market.platform === 'kalshi') ? 'Trade' : 'Buy/Sell'}
                      </button>
                      <a
                        href={market.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-dark-border rounded-lg hover:bg-dark-border/80 transition-colors"
                        title={`View on ${platformInfo.name}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
              })}
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
              title="Previous page"
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
              title="Next page"
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

      {/* Trade Modal - Only for prediction markets (Polymarket/Kalshi) */}
      {selectedMarket && showTradeModal && (selectedMarket.platform === 'polymarket' || selectedMarket.platform === 'kalshi') && (
        <ManualTradeModal
          isOpen={showTradeModal}
          onClose={() => {
            setShowTradeModal(false);
            setSelectedMarket(null);
          }}
          prefillMarket={{
            platform: selectedMarket.platform as 'polymarket' | 'kalshi',
            market_id: selectedMarket.id,
            market_title: selectedMarket.question || '',
            yes_price: selectedMarket.yes_price,
            no_price: selectedMarket.no_price,
          }}
        />
      )}

      {/* Stock Trade Modal with Real-Time IBKR/Alpaca Quotes */}
      {selectedMarket && showTradeModal && selectedMarket.asset_type === 'stock' && selectedMarket.platform !== 'polymarket' && selectedMarket.platform !== 'kalshi' && (
        <StockTradeModal
          isOpen={showTradeModal}
          onClose={() => {
            setShowTradeModal(false);
            setSelectedMarket(null);
          }}
          symbol={selectedMarket.symbol || ''}
          name={selectedMarket.description || selectedMarket.question}
          initialPrice={selectedMarket.yes_price}
          initialChange={selectedMarket.change_pct}
        />
      )}

      {/* Crypto Trade Modal - For crypto markets (keeps existing behavior with external links) */}
      {selectedMarket && showTradeModal && selectedMarket.asset_type === 'crypto' && selectedMarket.platform !== 'polymarket' && selectedMarket.platform !== 'kalshi' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                🪙 Trade Crypto
              </h2>
              <button
                onClick={() => {
                  setShowTradeModal(false);
                  setSelectedMarket(null);
                }}
                className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Asset Info */}
              <div className="p-4 bg-dark-bg rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  {selectedMarket.image && (
                    <img 
                      src={selectedMarket.image} 
                      alt={selectedMarket.symbol || ''} 
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-xl font-bold">{selectedMarket.symbol || selectedMarket.question}</div>
                    <div className="text-sm text-gray-400">{selectedMarket.description || selectedMarket.question}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Price</p>
                    <div className="text-3xl font-bold text-white">
                      {selectedMarket.yes_price >= 1000 
                        ? `$${selectedMarket.yes_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : selectedMarket.yes_price >= 1 
                          ? `$${selectedMarket.yes_price.toFixed(2)}`
                          : selectedMarket.yes_price >= 0.01
                            ? `$${selectedMarket.yes_price.toFixed(4)}`
                            : `$${selectedMarket.yes_price.toFixed(8)}`
                      }
                    </div>
                  </div>
                  {selectedMarket.change_pct !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">24h Change</p>
                      <span className={cn(
                        "text-lg font-bold",
                        selectedMarket.change_pct >= 0 
                          ? "text-green-400" 
                          : "text-red-400"
                      )}>
                        {selectedMarket.change_pct >= 0 ? '+' : ''}{selectedMarket.change_pct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Market Stats */}
              <div className="grid grid-cols-2 gap-3">
                {selectedMarket.volume !== undefined && (
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">24h Volume</p>
                    <p className="font-semibold">
                      {selectedMarket.volume >= 1000000000 
                        ? `$${(selectedMarket.volume / 1000000000).toFixed(2)}B`
                        : selectedMarket.volume >= 1000000 
                          ? `$${(selectedMarket.volume / 1000000).toFixed(2)}M`
                          : `$${selectedMarket.volume.toLocaleString()}`
                      }
                    </p>
                  </div>
                )}
                {selectedMarket.market_cap && (
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Market Cap</p>
                    <p className="font-semibold">
                      {selectedMarket.market_cap >= 1000000000000 
                        ? `$${(selectedMarket.market_cap / 1000000000000).toFixed(2)}T`
                        : selectedMarket.market_cap >= 1000000000 
                          ? `$${(selectedMarket.market_cap / 1000000000).toFixed(2)}B`
                          : `$${(selectedMarket.market_cap / 1000000).toFixed(2)}M`
                      }
                    </p>
                  </div>
                )}
              </div>
              
              {/* Trading Actions */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={selectedMarket.asset_type === 'crypto' 
                    ? `https://www.binance.us/trade/pro/${selectedMarket.symbol?.replace('/USD', '_USD').replace('/', '_')}`
                    : `https://app.alpaca.markets/trade/${selectedMarket.symbol?.replace('/USD', '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 bg-green-500 text-white text-center rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Buy
                </a>
                <a
                  href={selectedMarket.asset_type === 'crypto' 
                    ? `https://www.binance.us/trade/pro/${selectedMarket.symbol?.replace('/USD', '_USD').replace('/', '_')}`
                    : `https://app.alpaca.markets/trade/${selectedMarket.symbol?.replace('/USD', '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 bg-red-500 text-white text-center rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4 rotate-180" />
                  Sell
                </a>
              </div>
              
              {/* Bot Trading Info */}
              <div className="p-3 bg-neon-purple/10 border border-neon-purple/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  💡 <strong>Automated Trading:</strong> The bot executes trades automatically based on strategy signals.
                  Check <a href="/strategies" className="text-neon-purple hover:underline">Strategies</a> for active positions.
                </p>
              </div>
              
              {/* View on Exchange */}
              <a
                href={selectedMarket.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-dark-border text-center rounded-lg font-medium hover:bg-dark-border/80 transition-opacity flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on {selectedMarket.asset_type === 'crypto' ? 'CoinGecko' : 'Yahoo Finance'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
