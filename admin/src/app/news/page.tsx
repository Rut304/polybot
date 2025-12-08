'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Newspaper, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Minus,
  ExternalLink,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Hash,
  Zap,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalyticsData {
  trending_topics: Array<{ topic: string; count: number; sentiment: string }>;
  sentiment_distribution: Record<string, number>;
  source_breakdown: Array<{ source: string; count: number; avg_sentiment: number }>;
  market_mentions: Array<{ asset: string; count: number; sentiment: string }>;
  time_series: Array<{ hour: string; count: number }>;
  total_analyzed: number;
  period_hours: number;
}

interface NewsItem {
  id: string;
  source: string;
  title: string;
  content: string | null;
  url: string | null;
  author: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  keywords: string[] | null;
  published_at: string | null;
  fetched_at: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 20;
const MAX_ITEMS = 60;

const sentimentConfig: Record<string, { color: string; icon: any; label: string }> = {
  very_bullish: { color: 'text-green-400', icon: TrendingUp, label: 'Very Bullish' },
  bullish: { color: 'text-green-300', icon: TrendingUp, label: 'Bullish' },
  neutral: { color: 'text-gray-400', icon: Minus, label: 'Neutral' },
  bearish: { color: 'text-red-300', icon: TrendingDown, label: 'Bearish' },
  very_bearish: { color: 'text-red-400', icon: TrendingDown, label: 'Very Bearish' },
};

const sourceColors: Record<string, string> = {
  finnhub: 'bg-blue-500/20 text-blue-400',
  news_api: 'bg-purple-500/20 text-purple-400',
  twitter: 'bg-sky-500/20 text-sky-400',
  reddit: 'bg-orange-500/20 text-orange-400',
  polymarket: 'bg-green-500/20 text-green-400',
  google_news: 'bg-red-500/20 text-red-400',
  alphavantage: 'bg-yellow-500/20 text-yellow-400',
};

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Fetch AI analytics
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch('/api/news/analytics?hours=24');
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Refresh news from all sources
  const refreshFromSources = async () => {
    setRefreshing(true);
    setRefreshStatus('Fetching from all sources...');
    
    try {
      const response = await fetch('/api/news/refresh', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        setRefreshStatus(`✓ Fetched ${result.total} items from ${result.sources?.filter((s: any) => s.count > 0).length || 0} sources`);
        // Refetch the displayed news and analytics
        await fetchNews();
        await fetchAnalytics();
      } else {
        setRefreshStatus(`✗ ${result.error || 'Failed to refresh'}`);
      }
    } catch (err: any) {
      setRefreshStatus(`✗ ${err.message || 'Network error'}`);
    } finally {
      setRefreshing(false);
      // Clear status after 5 seconds
      setTimeout(() => setRefreshStatus(null), 5000);
    }
  };

  const fetchNews = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Use API route which has service role access (bypasses RLS)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        ...(sourceFilter !== 'all' && { source: sourceFilter }),
        ...(sentimentFilter !== 'all' && { sentiment: sentimentFilter }),
      });

      const response = await fetch(`/api/news?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch news');
      }

      setNews(result.news || []);
      setTotalCount(Math.min(result.total || 0, MAX_ITEMS));
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setError(err.message || 'Failed to fetch news');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, sourceFilter, sentimentFilter]);

  useEffect(() => {
    fetchNews();
    fetchAnalytics();
  }, [fetchNews, fetchAnalytics]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNews(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSentimentIcon = (sentiment: string | null) => {
    const config = sentimentConfig[sentiment || 'neutral'] || sentimentConfig.neutral;
    const Icon = config.icon;
    return <Icon className={`w-4 h-4 ${config.color}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-neon-blue" />
            News Feed
          </h1>
          <p className="text-gray-400 mt-1">
            Market news and sentiment analysis • Auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshStatus && (
            <span className={`text-sm ${refreshStatus.startsWith('✓') ? 'text-green-400' : refreshStatus.startsWith('✗') ? 'text-red-400' : 'text-gray-400'}`}>
              {refreshStatus}
            </span>
          )}
          <button
            onClick={refreshFromSources}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue transition-colors disabled:opacity-50"
            title="Fetch fresh news from all configured sources"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card flex flex-wrap gap-4 items-center"
      >
        <Filter className="w-5 h-5 text-gray-400" />
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="bg-dark-card border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-blue"
          >
            <option value="all">All Sources</option>
            <option value="finnhub">Finnhub</option>
            <option value="news_api">NewsAPI</option>
            <option value="twitter">Twitter/X</option>
            <option value="reddit">Reddit</option>
            <option value="polymarket">Polymarket</option>
            <option value="alphavantage">Alpha Vantage</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Sentiment:</label>
          <select
            value={sentimentFilter}
            onChange={(e) => { setSentimentFilter(e.target.value); setPage(1); }}
            className="bg-dark-card border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-blue"
          >
            <option value="all">All Sentiment</option>
            <option value="very_bullish">Very Bullish</option>
            <option value="bullish">Bullish</option>
            <option value="neutral">Neutral</option>
            <option value="bearish">Bearish</option>
            <option value="very_bearish">Very Bearish</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm transition-colors ${
              showAnalytics ? 'bg-neon-purple/20 text-neon-purple' : 'bg-gray-700/50 text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            AI Analytics
          </button>
          <span className="text-sm text-gray-500">{totalCount} items</span>
        </div>
      </motion.div>

      {/* AI Analytics Panel */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {analyticsLoading ? (
              <div className="card flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-neon-purple animate-spin" />
                <span className="ml-2 text-gray-400">Analyzing news trends...</span>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Trending Topics */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="w-4 h-4 text-neon-purple" />
                    <h3 className="font-medium text-sm">Trending Topics</h3>
                  </div>
                  <div className="space-y-2">
                    {analytics.trending_topics.slice(0, 5).map((topic, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 truncate">{topic.topic}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{topic.count}</span>
                          {topic.sentiment === 'bullish' && <TrendingUp className="w-3 h-3 text-green-400" />}
                          {topic.sentiment === 'bearish' && <TrendingDown className="w-3 h-3 text-red-400" />}
                          {topic.sentiment === 'neutral' && <Minus className="w-3 h-3 text-gray-400" />}
                        </div>
                      </div>
                    ))}
                    {analytics.trending_topics.length === 0 && (
                      <p className="text-gray-500 text-sm">No trends detected</p>
                    )}
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-neon-blue" />
                    <h3 className="font-medium text-sm">Sentiment Distribution</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(analytics.sentiment_distribution).map(([sentiment, count]) => {
                      const total = Object.values(analytics.sentiment_distribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      const color = sentiment.includes('bullish') ? 'bg-green-500' : sentiment.includes('bearish') ? 'bg-red-500' : 'bg-gray-500';
                      return (
                        <div key={sentiment} className="text-sm">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-400 capitalize">{sentiment.replace('_', ' ')}</span>
                            <span className="text-gray-500">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Source Activity */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <h3 className="font-medium text-sm">Source Activity</h3>
                  </div>
                  <div className="space-y-2">
                    {analytics.source_breakdown.slice(0, 5).map((source, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${sourceColors[source.source] || 'bg-gray-500/20 text-gray-400'}`}>
                          {source.source}
                        </span>
                        <span className="text-gray-400">{source.count} articles</span>
                      </div>
                    ))}
                    {analytics.source_breakdown.length === 0 && (
                      <p className="text-gray-500 text-sm">No source data</p>
                    )}
                  </div>
                </div>

                {/* Market Mentions */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <h3 className="font-medium text-sm">Hot Assets</h3>
                  </div>
                  <div className="space-y-2">
                    {analytics.market_mentions.slice(0, 5).map((asset, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 font-mono">{asset.asset}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{asset.count}</span>
                          {asset.sentiment === 'bullish' && <TrendingUp className="w-3 h-3 text-green-400" />}
                          {asset.sentiment === 'bearish' && <TrendingDown className="w-3 h-3 text-red-400" />}
                          {asset.sentiment === 'neutral' && <Minus className="w-3 h-3 text-gray-400" />}
                        </div>
                      </div>
                    ))}
                    {analytics.market_mentions.length === 0 && (
                      <p className="text-gray-500 text-sm">No market mentions</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-6">
                <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Analytics will appear after news is fetched</p>
                <button
                  onClick={fetchAnalytics}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-neon-purple/20 text-neon-purple text-sm hover:bg-neon-purple/30 transition-colors"
                >
                  Load Analytics
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card bg-red-500/10 border-red-500/30 text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && !refreshing && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-neon-blue animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && news.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card text-center py-12"
        >
          <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No News Yet</h3>
          <p className="text-gray-500 mt-2">
            News items will appear here once the bot starts fetching from configured sources.
          </p>
          <p className="text-gray-600 text-sm mt-4">
            Configure news API keys in Settings → API Keys → News & Sentiment
          </p>
        </motion.div>
      )}

      {/* News List */}
      {!loading && news.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {news.map((item, index) => {
              const sentiment = sentimentConfig[item.sentiment || 'neutral'] || sentimentConfig.neutral;
              const SentimentIcon = sentiment.icon;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.03 }}
                  className="card hover:border-gray-600 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Sentiment Indicator */}
                    <div className={`flex-shrink-0 w-1 rounded-full ${
                      item.sentiment === 'very_bullish' || item.sentiment === 'bullish' 
                        ? 'bg-green-500' 
                        : item.sentiment === 'very_bearish' || item.sentiment === 'bearish'
                        ? 'bg-red-500'
                        : 'bg-gray-600'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-medium text-white leading-snug">
                          {item.title}
                        </h3>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                      </div>

                      {/* Content Preview */}
                      {item.content && (
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {item.content}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* Source */}
                        <span className={`px-2 py-0.5 rounded-full ${sourceColors[item.source] || 'bg-gray-500/20 text-gray-400'}`}>
                          {item.source}
                        </span>

                        {/* Sentiment */}
                        <span className={`flex items-center gap-1 ${sentiment.color}`}>
                          <SentimentIcon className="w-3 h-3" />
                          {sentiment.label}
                          {item.sentiment_score !== null && (
                            <span className="text-gray-500">
                              ({(item.sentiment_score * 100).toFixed(0)}%)
                            </span>
                          )}
                        </span>

                        {/* Time */}
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.published_at || item.created_at)}
                        </span>

                        {/* Author */}
                        {item.author && (
                          <span className="text-gray-500">
                            by {item.author}
                          </span>
                        )}
                      </div>

                      {/* Keywords */}
                      {item.keywords && item.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {item.keywords.slice(0, 5).map((keyword, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 text-xs rounded bg-gray-700/50 text-gray-400"
                            >
                              {keyword}
                            </span>
                          ))}
                          {item.keywords.length > 5 && (
                            <span className="px-2 py-0.5 text-xs text-gray-500">
                              +{item.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 pt-4"
        >
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-dark-card hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === pageNum
                    ? 'bg-neon-blue text-white'
                    : 'bg-dark-card hover:bg-gray-700/50 text-gray-400'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg bg-dark-card hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
