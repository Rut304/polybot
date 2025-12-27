'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Star,
  TrendingUp,
  Users,
  Zap,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Search,
  Filter,
  Crown,
  Sparkles,
  Target,
  BarChart3,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  Activity,
  Eye,
  Copy,
} from 'lucide-react';
import { cn, formatPercent, formatCurrency } from '@/lib/utils';
import { useTier } from '@/lib/useTier';
import { useBotConfig, useUpdateBotConfig } from '@/lib/hooks';

// Strategy marketplace data - curated community strategies
interface MarketplaceStrategy {
  id: string;
  name: string;
  description: string;
  category: 'arbitrage' | 'momentum' | 'value' | 'event' | 'ai';
  author: {
    name: string;
    verified: boolean;
    avatar?: string;
  };
  stats: {
    backtestedReturn: number; // Annual %
    winRate: number;
    avgTradeProfit: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
  };
  risk: 'low' | 'medium' | 'high';
  timeframe: string;
  markets: string[];
  minTier: 'free' | 'pro' | 'elite';
  isNew: boolean;
  isFeatured: boolean;
  usersActive: number;
  rating: number;
  reviewCount: number;
  configKey: string; // Maps to bot config field
}

const MARKETPLACE_STRATEGIES: MarketplaceStrategy[] = [
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    description: 'Exploits YES+NO mispricing on the same market. When combined prices drop below 100¢, buy both sides for guaranteed profit at resolution.',
    category: 'arbitrage',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 12.5,
      winRate: 94.2,
      avgTradeProfit: 2.50,
      maxDrawdown: 3.1,
      sharpeRatio: 2.8,
      totalTrades: 847,
    },
    risk: 'low',
    timeframe: 'Minutes to Hours',
    markets: ['Polymarket', 'Kalshi'],
    minTier: 'free',
    isNew: false,
    isFeatured: true,
    usersActive: 234,
    rating: 4.8,
    reviewCount: 127,
    configKey: 'single_platform_arb_enabled',
  },
  {
    id: 'crypto_15min_scalping',
    name: '15-Min Crypto Scalping',
    description: 'RSI-based momentum strategy for crypto prediction markets. Buys oversold conditions and sells at resistance, with tight stop-losses.',
    category: 'momentum',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 28.3,
      winRate: 68.5,
      avgTradeProfit: 4.20,
      maxDrawdown: 12.4,
      sharpeRatio: 1.9,
      totalTrades: 1243,
    },
    risk: 'medium',
    timeframe: '15-minute intervals',
    markets: ['Polymarket'],
    minTier: 'free',
    isNew: false,
    isFeatured: true,
    usersActive: 189,
    rating: 4.5,
    reviewCount: 89,
    configKey: 'crypto_15min_scalping_enabled',
  },
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    description: 'Monitors breaking news and trades price discrepancies before markets fully react. Uses NLP to identify market-moving events.',
    category: 'event',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 35.7,
      winRate: 72.1,
      avgTradeProfit: 8.50,
      maxDrawdown: 15.2,
      sharpeRatio: 2.1,
      totalTrades: 156,
    },
    risk: 'medium',
    timeframe: 'Event-driven',
    markets: ['Polymarket', 'Kalshi'],
    minTier: 'free',
    isNew: false,
    isFeatured: false,
    usersActive: 145,
    rating: 4.3,
    reviewCount: 56,
    configKey: 'news_arbitrage_enabled',
  },
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    description: 'Finds price differences between Polymarket and Kalshi on the same events. Buys low on one platform, sells high on another.',
    category: 'arbitrage',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 18.9,
      winRate: 87.3,
      avgTradeProfit: 5.30,
      maxDrawdown: 5.8,
      sharpeRatio: 2.5,
      totalTrades: 312,
    },
    risk: 'low',
    timeframe: 'Hours to Days',
    markets: ['Polymarket', 'Kalshi'],
    minTier: 'pro',
    isNew: false,
    isFeatured: true,
    usersActive: 98,
    rating: 4.7,
    reviewCount: 43,
    configKey: 'cross_platform_arb_enabled',
  },
  {
    id: 'ai_superforecasting',
    name: 'AI Superforecasting',
    description: 'Uses GPT-4 to analyze market sentiment, historical accuracy, and external data sources. Identifies mispriced markets with high conviction.',
    category: 'ai',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 42.1,
      winRate: 65.8,
      avgTradeProfit: 12.40,
      maxDrawdown: 18.5,
      sharpeRatio: 1.8,
      totalTrades: 89,
    },
    risk: 'high',
    timeframe: 'Days to Weeks',
    markets: ['Polymarket', 'Kalshi'],
    minTier: 'pro',
    isNew: true,
    isFeatured: true,
    usersActive: 67,
    rating: 4.6,
    reviewCount: 28,
    configKey: 'enable_ai_superforecasting',
  },
  {
    id: 'congressional_tracker',
    name: 'Congressional Trading',
    description: 'Follows disclosed trades by US Congress members. Politicians consistently outperform the market - now you can too.',
    category: 'value',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 24.6,
      winRate: 58.2,
      avgTradeProfit: 45.00,
      maxDrawdown: 22.1,
      sharpeRatio: 1.4,
      totalTrades: 47,
    },
    risk: 'medium',
    timeframe: 'Days to Weeks',
    markets: ['Alpaca'],
    minTier: 'pro',
    isNew: false,
    isFeatured: false,
    usersActive: 156,
    rating: 4.4,
    reviewCount: 67,
    configKey: 'congressional_trading_enabled',
  },
  {
    id: 'market_making',
    name: 'Market Making',
    description: 'Provides liquidity by placing both buy and sell orders. Captures the bid-ask spread on lower-volume markets.',
    category: 'arbitrage',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 15.2,
      winRate: 78.9,
      avgTradeProfit: 1.80,
      maxDrawdown: 8.3,
      sharpeRatio: 2.2,
      totalTrades: 2156,
    },
    risk: 'low',
    timeframe: 'Continuous',
    markets: ['Polymarket'],
    minTier: 'free',
    isNew: false,
    isFeatured: false,
    usersActive: 89,
    rating: 4.2,
    reviewCount: 34,
    configKey: 'market_making_enabled',
  },
  {
    id: 'btc_bracket_arb',
    name: 'BTC Bracket Arbitrage',
    description: 'Trades Bitcoin price bracket markets on Kalshi. Identifies when bracket combinations are mispriced relative to current BTC price.',
    category: 'arbitrage',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 31.4,
      winRate: 82.1,
      avgTradeProfit: 6.70,
      maxDrawdown: 9.8,
      sharpeRatio: 2.4,
      totalTrades: 234,
    },
    risk: 'medium',
    timeframe: 'Daily',
    markets: ['Kalshi'],
    minTier: 'elite',
    isNew: false,
    isFeatured: true,
    usersActive: 34,
    rating: 4.9,
    reviewCount: 12,
    configKey: 'btc_bracket_arb_enabled',
  },
  {
    id: 'whale_copy',
    name: 'Whale Copy Trading',
    description: 'Automatically mirrors trades from top-performing wallets on Polymarket. Follows the smart money with configurable position sizing.',
    category: 'value',
    author: { name: 'PolyBot Team', verified: true },
    stats: {
      backtestedReturn: 38.9,
      winRate: 61.3,
      avgTradeProfit: 18.50,
      maxDrawdown: 25.4,
      sharpeRatio: 1.5,
      totalTrades: 78,
    },
    risk: 'high',
    timeframe: 'Real-time',
    markets: ['Polymarket'],
    minTier: 'elite',
    isNew: true,
    isFeatured: true,
    usersActive: 23,
    rating: 4.7,
    reviewCount: 8,
    configKey: 'whale_copy_enabled',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Strategies', icon: Store },
  { id: 'arbitrage', label: 'Arbitrage', icon: Zap },
  { id: 'momentum', label: 'Momentum', icon: TrendingUp },
  { id: 'value', label: 'Value', icon: Target },
  { id: 'event', label: 'Event-Driven', icon: Activity },
  { id: 'ai', label: 'AI-Powered', icon: Sparkles },
];

const RISK_COLORS = {
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const TIER_BADGES = {
  free: { label: 'Free', color: 'bg-gray-500/20 text-gray-400' },
  pro: { label: 'Pro', color: 'bg-neon-blue/20 text-neon-blue' },
  elite: { label: 'Elite', color: 'bg-neon-purple/20 text-neon-purple' },
};

function StrategyCard({ strategy, canEnable, isEnabled, onToggle }: {
  strategy: MarketplaceStrategy;
  canEnable: boolean;
  isEnabled: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-dark-card border rounded-xl overflow-hidden transition-all",
        strategy.isFeatured ? "border-neon-blue/30" : "border-dark-border",
        expanded && "ring-2 ring-neon-blue/20"
      )}
    >
      {/* Featured Badge */}
      {strategy.isFeatured && (
        <div className="bg-gradient-to-r from-neon-blue to-neon-purple px-4 py-1 text-xs font-bold text-white flex items-center gap-2">
          <Star className="w-3 h-3 fill-current" />
          FEATURED STRATEGY
        </div>
      )}
      
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">{strategy.name}</h3>
              {strategy.isNew && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                  NEW
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>by {strategy.author.name}</span>
              {strategy.author.verified && (
                <CheckCircle2 className="w-4 h-4 text-neon-blue" />
              )}
            </div>
          </div>
          
          {/* Tier Badge */}
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1",
            TIER_BADGES[strategy.minTier].color
          )}>
            {strategy.minTier === 'elite' && <Crown className="w-3 h-3" />}
            {TIER_BADGES[strategy.minTier].label}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {strategy.description}
        </p>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-neon-green">
              {formatPercent(strategy.stats.backtestedReturn / 100)}
            </div>
            <div className="text-xs text-gray-500">Annual Return</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">
              {formatPercent(strategy.stats.winRate / 100)}
            </div>
            <div className="text-xs text-gray-500">Win Rate</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "text-lg font-bold",
              strategy.risk === 'low' && "text-green-400",
              strategy.risk === 'medium' && "text-yellow-400",
              strategy.risk === 'high' && "text-red-400",
            )}>
              {strategy.risk.charAt(0).toUpperCase() + strategy.risk.slice(1)}
            </div>
            <div className="text-xs text-gray-500">Risk</div>
          </div>
        </div>

        {/* Rating & Users */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-dark-border">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-4 h-4",
                  star <= Math.round(strategy.rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-600"
                )}
              />
            ))}
            <span className="text-sm text-gray-400 ml-1">
              ({strategy.reviewCount})
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Users className="w-4 h-4" />
            {strategy.usersActive} active
          </div>
        </div>

        {/* Expandable Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 mb-4">
                {/* Detailed Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Avg Trade Profit</div>
                    <div className="font-mono text-neon-green">
                      {formatCurrency(strategy.stats.avgTradeProfit)}
                    </div>
                  </div>
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Max Drawdown</div>
                    <div className="font-mono text-red-400">
                      -{formatPercent(strategy.stats.maxDrawdown / 100)}
                    </div>
                  </div>
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Sharpe Ratio</div>
                    <div className="font-mono text-white">
                      {strategy.stats.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-dark-bg rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Backtested Trades</div>
                    <div className="font-mono text-white">
                      {strategy.stats.totalTrades.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Markets & Timeframe */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-dark-bg text-gray-400 text-xs rounded">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {strategy.timeframe}
                  </span>
                  {strategy.markets.map((market) => (
                    <span key={market} className="px-2 py-1 bg-dark-bg text-gray-400 text-xs rounded">
                      {market}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Eye className="w-4 h-4" />
            {expanded ? 'Less' : 'Details'}
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              expanded && "rotate-180"
            )} />
          </button>
          
          <div className="flex-1" />
          
          {canEnable ? (
            <button
              onClick={onToggle}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                isEnabled
                  ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                  : "bg-neon-blue text-black hover:bg-neon-blue/90"
              )}
            >
              {isEnabled ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Enabled
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Enable
                </>
              )}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-700/50 text-gray-300 flex items-center gap-2 hover:bg-gray-700 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Upgrade to {strategy.minTier === 'elite' ? 'Elite' : 'Pro'}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function MarketplacePage() {
  const { tier, isPro, isElite } = useTier();
  const { data: config, isLoading: configLoading } = useBotConfig();
  const updateConfig = useUpdateBotConfig();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'featured' | 'rating' | 'return' | 'users'>('featured');

  // Filter and sort strategies
  const filteredStrategies = useMemo(() => {
    let strategies = [...MARKETPLACE_STRATEGIES];
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      strategies = strategies.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.category.includes(query)
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      strategies = strategies.filter(s => s.category === selectedCategory);
    }
    
    // Sort
    switch (sortBy) {
      case 'featured':
        strategies.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
      case 'rating':
        strategies.sort((a, b) => b.rating - a.rating);
        break;
      case 'return':
        strategies.sort((a, b) => b.stats.backtestedReturn - a.stats.backtestedReturn);
        break;
      case 'users':
        strategies.sort((a, b) => b.usersActive - a.usersActive);
        break;
    }
    
    return strategies;
  }, [searchQuery, selectedCategory, sortBy]);

  // Check if user can enable strategy
  const canEnable = (strategy: MarketplaceStrategy) => {
    if (strategy.minTier === 'free') return true;
    if (strategy.minTier === 'pro' && (isPro || isElite)) return true;
    if (strategy.minTier === 'elite' && isElite) return true;
    return false;
  };

  // Check if strategy is enabled
  const isEnabled = (strategy: MarketplaceStrategy) => {
    if (!config) return false;
    return config[strategy.configKey] === true;
  };

  // Toggle strategy
  const toggleStrategy = (strategy: MarketplaceStrategy) => {
    if (!config) return;
    updateConfig.mutate({
      [strategy.configKey]: !config[strategy.configKey]
    });
  };

  // Stats summary
  const stats = useMemo(() => ({
    total: MARKETPLACE_STRATEGIES.length,
    free: MARKETPLACE_STRATEGIES.filter(s => s.minTier === 'free').length,
    enabled: MARKETPLACE_STRATEGIES.filter(s => isEnabled(s)).length,
  }), [config]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-dark-card to-dark-bg border border-dark-border rounded-2xl p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-neon-blue to-neon-purple rounded-xl">
              <Store className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Strategy Marketplace</h1>
              <p className="text-gray-400">Browse and enable proven trading strategies</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-6 mt-6">
            <div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Strategies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-neon-green">{stats.free}</div>
              <div className="text-sm text-gray-400">Free to Use</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-neon-blue">{stats.enabled}</div>
              <div className="text-sm text-gray-400">Enabled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search strategies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue/50"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-blue/50"
        >
          <option value="featured">Featured First</option>
          <option value="rating">Highest Rated</option>
          <option value="return">Best Returns</option>
          <option value="users">Most Popular</option>
        </select>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                selectedCategory === cat.id
                  ? "bg-neon-blue text-black"
                  : "bg-dark-card border border-dark-border text-gray-400 hover:text-white hover:border-gray-600"
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredStrategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            canEnable={canEnable(strategy)}
            isEnabled={isEnabled(strategy)}
            onToggle={() => toggleStrategy(strategy)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredStrategies.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No strategies found</h3>
          <p className="text-gray-400">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Upgrade CTA */}
      {tier === 'free' && (
        <div className="bg-gradient-to-r from-neon-blue/10 to-neon-purple/10 border border-neon-blue/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                Unlock More Strategies
              </h3>
              <p className="text-gray-400">
                Upgrade to Pro or Elite to access advanced AI and arbitrage strategies
              </p>
            </div>
            <Link
              href="/pricing"
              className="px-6 py-3 bg-neon-blue text-black font-bold rounded-lg hover:bg-neon-blue/90 transition-colors flex items-center gap-2"
            >
              View Plans
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
