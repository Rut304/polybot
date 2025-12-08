'use client';

import { useState } from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  ArrowDown,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  BarChart3,
  LineChart,
  Grid3X3,
  Repeat,
  Newspaper,
  Users,
  Wallet,
  Shield,
  Clock,
  DollarSign,
  Activity,
  Target,
  BookOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Strategy {
  id: string;
  name: string;
  confidence: number;
  expectedApy: string;
  description: string;
  keyPoints: string[];
  platforms: string[];
  riskLevel: 'low' | 'medium' | 'high';
  category: 'prediction' | 'crypto' | 'stock';
  icon: JSX.Element;
  color: string;
  requirements: string[];
  workflow: string[];
}

const STRATEGIES: Strategy[] = [
  // PREDICTION MARKET STRATEGIES
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    confidence: 95,
    expectedApy: '50-200%',
    description: 'Exploit mispricings within a single prediction market by buying YES + NO when combined price < $1.00. Guaranteed profit on resolution.',
    keyPoints: [
      'Zero directional risk - you profit regardless of outcome',
      'Works when YES + NO < 100% (rare but happens)',
      'Polymarket has 0% fees - pure profit',
      'Kalshi has 7% fees - need larger spreads',
      'Academic research shows $40M extracted in 1 year',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Target className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    requirements: [
      'Polymarket wallet address & private key',
      'Kalshi API key & private key (optional)',
      'USDC balance on Polygon network',
    ],
    workflow: [
      'Scan all active markets every 60 seconds',
      'Calculate YES + NO total for each market',
      'If total < threshold (e.g., 99.5%), flag opportunity',
      'Execute buy orders for both outcomes',
      'Wait for market resolution',
      'Collect guaranteed profit',
    ],
  },
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    confidence: 90,
    expectedApy: '30-100%',
    description: 'Exploit price differences between Polymarket and Kalshi for the same event. Buy low on one platform, sell high on another.',
    keyPoints: [
      'Same event can have different prices on different platforms',
      'Buy YES on cheaper platform, buy NO (or opposite YES) on expensive platform',
      'Asymmetric thresholds: Buy Poly needs lower spread (0% fees)',
      'Requires matching events across platforms',
      'Settlement timing must align',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'low',
    category: 'prediction',
    icon: <Repeat className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
    requirements: [
      'Polymarket wallet + private key',
      'Kalshi API credentials',
      'Capital on both platforms',
    ],
    workflow: [
      'Fetch markets from both platforms',
      'Match similar events using fuzzy matching',
      'Compare YES prices: Poly vs Kalshi',
      'Calculate spread after fees (7% Kalshi)',
      'If spread > threshold, execute cross-trade',
      'Monitor both positions until resolution',
    ],
  },
  {
    id: 'market_making',
    name: 'Market Making',
    confidence: 75,
    expectedApy: '10-20%',
    description: 'Provide liquidity by placing limit orders on both sides of the market. Earn the bid-ask spread on each fill.',
    keyPoints: [
      'Capital-efficient: Same capital backs both sides',
      'Requires active order management',
      'Inventory risk: Can get stuck with one-sided position',
      'Best on high-volume, volatile markets',
      'Quote refresh every 30 seconds',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    requirements: [
      'Polymarket API access',
      'Significant capital ($1000+)',
      'Understanding of order book dynamics',
    ],
    workflow: [
      'Select high-volume markets (>$5k 24h)',
      'Calculate fair value from order book',
      'Place bid below fair value',
      'Place ask above fair value',
      'Adjust quotes based on inventory',
      'Cancel & replace stale orders',
    ],
  },
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    confidence: 60,
    expectedApy: '5-30% per event',
    description: 'React to breaking news faster than the market. Buy/sell positions before prices adjust to new information.',
    keyPoints: [
      'Requires fast news feed access',
      'High risk: News interpretation can be wrong',
      'Best for binary events with clear outcomes',
      'Keyword matching to relevant markets',
      'Time-sensitive: Minutes matter',
    ],
    platforms: ['Polymarket', 'Kalshi'],
    riskLevel: 'high',
    category: 'prediction',
    icon: <Newspaper className="w-6 h-6" />,
    color: 'from-orange-500 to-red-500',
    requirements: [
      'NewsAPI key or Twitter API',
      'Trading credentials',
      'Low-latency execution',
    ],
    workflow: [
      'Monitor news feeds for keywords',
      'Match news to relevant markets',
      'Analyze sentiment and impact',
      'Execute trades within minutes',
      'Set stop-loss for risk management',
    ],
  },
  {
    id: 'copy_trading',
    name: 'Copy Trading',
    confidence: 70,
    expectedApy: '20-50%',
    description: 'Automatically copy trades from successful "whale" traders. Leverage their research and conviction.',
    keyPoints: [
      'Track top performers by address',
      'Configurable copy multiplier',
      'Delay between detection and execution',
      'Works best with transparent on-chain data',
      'Can filter by minimum trade size',
    ],
    platforms: ['Polymarket'],
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-6 h-6" />,
    color: 'from-indigo-500 to-violet-500',
    requirements: [
      'Polymarket wallet + private key',
      'List of whale addresses to track',
      'Capital for position sizing',
    ],
    workflow: [
      'Monitor whale wallet activity',
      'Detect new position entries',
      'Calculate scaled position size',
      'Execute copy trade',
      'Track performance vs original',
    ],
  },

  // CRYPTO STRATEGIES
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    confidence: 85,
    expectedApy: '15-50%',
    description: 'Collect perpetual futures funding payments by holding delta-neutral positions. Long spot + short perp when funding is positive.',
    keyPoints: [
      'Delta-neutral: No directional exposure',
      'Funding paid every 8 hours on most exchanges',
      'BTC funding averages 0.01%/8h = 10.95% APY base',
      'Higher funding during bull markets',
      'Requires both spot and futures access',
    ],
    platforms: ['Binance', 'Bybit', 'OKX'],
    riskLevel: 'low',
    category: 'crypto',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'from-yellow-500 to-amber-500',
    requirements: [
      'Exchange API keys (Binance/Bybit/OKX)',
      'Futures trading enabled',
      'Capital for spot + collateral',
    ],
    workflow: [
      'Scan funding rates across exchanges',
      'Filter for rates > 0.03% (30% APY)',
      'Calculate optimal position size',
      'Buy spot on one exchange',
      'Short perpetual futures (1x leverage)',
      'Collect funding every 8 hours',
      'Exit when funding turns negative',
    ],
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    confidence: 75,
    expectedApy: '20-60%',
    description: 'Profit from sideways price movement by placing a grid of buy and sell orders. Each oscillation generates profit.',
    keyPoints: [
      'Works best in ranging/sideways markets',
      'Automated buy-low, sell-high execution',
      'Configurable grid levels and range',
      'Can lose money in strong trends',
      'Round-trip = one buy + one sell',
    ],
    platforms: ['Binance', 'Bybit', 'OKX', 'KuCoin'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <Grid3X3 className="w-6 h-6" />,
    color: 'from-teal-500 to-cyan-500',
    requirements: [
      'Exchange API with order placement',
      'Capital for grid investment',
      'Understanding of grid mechanics',
    ],
    workflow: [
      'Select sideways-trending asset',
      'Define price range (e.g., ±10%)',
      'Place buy orders below current price',
      'Place sell orders above current price',
      'When buy fills, place new sell above it',
      'When sell fills, place new buy below it',
      'Track round-trip profits',
    ],
  },
  {
    id: 'pairs_trading',
    name: 'Pairs Trading / Statistical Arbitrage',
    confidence: 65,
    expectedApy: '10-25%',
    description: 'Trade the spread between two correlated assets. Long the underperformer, short the outperformer when spread widens.',
    keyPoints: [
      'Based on mean reversion of correlated pairs',
      'BTC/ETH historically ~0.85 correlation',
      'Enter when z-score > 2 (spread too wide)',
      'Exit when z-score < 0.5 (mean reversion)',
      'Requires statistical analysis',
    ],
    platforms: ['Binance', 'Bybit', 'OKX'],
    riskLevel: 'medium',
    category: 'crypto',
    icon: <LineChart className="w-6 h-6" />,
    color: 'from-rose-500 to-pink-500',
    requirements: [
      'Exchange API for both assets',
      'Margin/futures for shorting',
      'Historical price data',
    ],
    workflow: [
      'Calculate rolling correlation (30 days)',
      'Compute spread: Price_A - Beta × Price_B',
      'Calculate z-score of current spread',
      'If |z| > 2: Enter position',
      '  - Long the underperformer',
      '  - Short the outperformer',
      'If |z| < 0.5: Exit position',
      'Stop-loss if |z| > 4',
    ],
  },

  // STOCK STRATEGIES
  {
    id: 'stock_mean_reversion',
    name: 'Stock Mean Reversion',
    confidence: 70,
    expectedApy: '10-25%',
    description: 'Trade stocks that have deviated significantly from their historical average price, expecting them to revert back to the mean.',
    keyPoints: [
      'Buy when z-score < -2 (oversold)',
      'Sell/short when z-score > +2 (overbought)',
      'Exit when z-score returns to ±0.5',
      'Works best on range-bound stocks',
      'Avoid trending stocks',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-emerald-500 to-green-500',
    requirements: [
      'Alpaca API key (paper or live)',
      'Historical price data',
      'Stock screener criteria',
    ],
    workflow: [
      'Screen for liquid, large-cap stocks',
      'Calculate 20-day moving average',
      'Compute z-score for each stock',
      'If z < -2: Buy (oversold)',
      'If z > +2: Short/avoid (overbought)',
      'Exit when |z| < 0.5',
      'Use stop-loss for trend protection',
    ],
  },
  {
    id: 'stock_momentum',
    name: 'Stock Momentum',
    confidence: 65,
    expectedApy: '15-40%',
    description: 'Follow the trend - buy stocks that have been going up, short stocks that have been going down. Academic evidence supports momentum.',
    keyPoints: [
      'Momentum premium documented since 1993',
      'Winners tend to keep winning',
      'Monthly rebalancing recommended',
      'Crash risk during reversals',
      'Best combined with value/quality factors',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-blue-500 to-indigo-500',
    requirements: [
      'Alpaca API key',
      '12-month historical prices',
      'Stock ranking system',
    ],
    workflow: [
      'Calculate 12-month returns for universe',
      'Rank stocks by momentum',
      'Buy top 10% performers',
      'Optionally short bottom 10%',
      'Rebalance monthly',
      'Use stop-losses for protection',
    ],
  },
  {
    id: 'sector_rotation',
    name: 'Sector Rotation',
    confidence: 60,
    expectedApy: '8-20%',
    description: 'Rotate capital between sectors based on economic cycle. Different sectors outperform during different phases of the business cycle.',
    keyPoints: [
      'Early cycle: Consumer Discretionary, Financials',
      'Mid cycle: Technology, Industrials',
      'Late cycle: Energy, Materials',
      'Recession: Utilities, Staples, Healthcare',
      'Use sector ETFs for diversification',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'medium',
    category: 'stock',
    icon: <Repeat className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    requirements: [
      'Alpaca API key',
      'Economic indicators data',
      'Sector ETF access (XLF, XLK, etc.)',
    ],
    workflow: [
      'Monitor economic indicators (PMI, yield curve)',
      'Identify current business cycle phase',
      'Map phase to outperforming sectors',
      'Rotate to target sectors monthly',
      'Maintain defensive allocation',
      'Rebalance as cycle shifts',
    ],
  },
  {
    id: 'dividend_growth',
    name: 'Dividend Growth',
    confidence: 75,
    expectedApy: '6-12%',
    description: 'Build a portfolio of companies with consistent dividend growth. Focus on Dividend Aristocrats - 10+ years of consecutive increases.',
    keyPoints: [
      '2-5% yield sweet spot (avoid traps)',
      'Payout ratio < 60% for sustainability',
      'Compounding power over time',
      'Lower volatility than growth stocks',
      'Tax-advantaged qualified dividends',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'low',
    category: 'stock',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'from-green-500 to-teal-500',
    requirements: [
      'Alpaca API key',
      'Dividend data (history, yield)',
      'Financial screening criteria',
    ],
    workflow: [
      'Screen for 10+ year dividend growth',
      'Filter by yield (2-5%)',
      'Check payout ratio < 60%',
      'Verify earnings support dividend',
      'Build diversified portfolio',
      'Enable dividend reinvestment (DRIP)',
    ],
  },
  {
    id: 'earnings_momentum',
    name: 'Earnings Momentum',
    confidence: 65,
    expectedApy: '15-35%',
    description: 'Trade around earnings announcements. Stocks that beat estimates tend to continue outperforming (Post-Earnings Announcement Drift).',
    keyPoints: [
      'PEAD documented academically since 1968',
      'Drift continues for ~60 days',
      'High volatility around announcements',
      'Options can define risk',
      'Track analyst revisions',
    ],
    platforms: ['Alpaca'],
    riskLevel: 'high',
    category: 'stock',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-yellow-500 to-orange-500',
    requirements: [
      'Alpaca API key',
      'Earnings calendar data',
      'Analyst estimates data',
    ],
    workflow: [
      'Track upcoming earnings dates',
      'Compare estimates vs whisper numbers',
      'Position before earnings (optional)',
      'Buy stocks that beat estimates',
      'Sell/short stocks that miss',
      'Hold for ~30 days for PEAD capture',
    ],
  },
];

const categoryColors = {
  prediction: 'border-purple-500/30 bg-purple-500/5',
  crypto: 'border-orange-500/30 bg-orange-500/5',
  stock: 'border-green-500/30 bg-green-500/5',
};

const categoryTitles = {
  prediction: { title: 'Prediction Markets', icon: '🎯', subtitle: 'Polymarket & Kalshi' },
  crypto: { title: 'Crypto Strategies', icon: '₿', subtitle: 'CCXT Exchanges' },
  stock: { title: 'Stock Trading', icon: '📈', subtitle: 'Alpaca & IBKR' },
};

const riskColors = {
  low: 'text-green-400 bg-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/20',
  high: 'text-red-400 bg-red-500/20',
};

export default function WorkflowsPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredStrategies = filterCategory 
    ? STRATEGIES.filter(s => s.category === filterCategory)
    : STRATEGIES;

  const predictionStrategies = STRATEGIES.filter(s => s.category === 'prediction');
  const cryptoStrategies = STRATEGIES.filter(s => s.category === 'crypto');
  const stockStrategies = STRATEGIES.filter(s => s.category === 'stock');

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitBranch className="text-purple-400" />
            Trading Workflows
          </h1>
          <p className="text-gray-400 mt-1">
            Visual overview of all trading strategies and their execution flows
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-lg transition-all ${
              !filterCategory ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterCategory('prediction')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'prediction' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🎯 Prediction
          </button>
          <button
            onClick={() => setFilterCategory('crypto')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'crypto' ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ₿ Crypto
          </button>
          <button
            onClick={() => setFilterCategory('stock')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'stock' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            📈 Stocks
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link 
          href="/secrets" 
          className="card p-4 flex items-center gap-3 hover:border-purple-500/50 transition-all group"
        >
          <Shield className="text-purple-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Configure API Keys</div>
            <div className="text-xs text-gray-400">Set up credentials for each platform</div>
          </div>
        </Link>
        <Link 
          href="/settings" 
          className="card p-4 flex items-center gap-3 hover:border-blue-500/50 transition-all group"
        >
          <Activity className="text-blue-400 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-medium">Strategy Settings</div>
            <div className="text-xs text-gray-400">Enable/disable and tune parameters</div>
          </div>
        </Link>
      </div>

      {/* Main Flowchart Section */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Activity className="text-blue-400" />
          System Architecture Overview
        </h2>
        
        {/* Visual Flow Diagram */}
        <div className="relative bg-gray-900/50 rounded-xl p-8 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Data Sources Layer */}
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 w-32">
                  <div className="text-2xl mb-1">🎯</div>
                  <div className="text-sm font-medium">Polymarket</div>
                  <div className="text-xs text-gray-400">0% fees</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 w-32">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium">Kalshi</div>
                  <div className="text-xs text-gray-400">7% fees</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 w-32">
                  <div className="text-2xl mb-1">₿</div>
                  <div className="text-sm font-medium">CCXT</div>
                  <div className="text-xs text-gray-400">106+ exchanges</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 w-32">
                  <div className="text-2xl mb-1">📈</div>
                  <div className="text-sm font-medium">Alpaca</div>
                  <div className="text-xs text-gray-400">US Stocks</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-xl p-4 w-32">
                  <div className="text-2xl mb-1">📰</div>
                  <div className="text-sm font-medium">News Feed</div>
                  <div className="text-xs text-gray-400">NewsAPI</div>
                </div>
              </div>
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center gap-8 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-32 flex justify-center">
                  <ArrowDown className="text-gray-500" />
                </div>
              ))}
            </div>
            
            {/* Bot Core */}
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-500/30 to-blue-500/30 border border-purple-500/50 rounded-2xl p-6 w-[500px]">
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">🤖</div>
                  <div className="text-lg font-bold">PolyBot Core</div>
                  <div className="text-sm text-gray-400">Async Strategy Orchestrator</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="font-medium text-purple-400">Config Manager</div>
                    <div className="text-xs text-gray-400">Supabase polybot_config</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="font-medium text-blue-400">Risk Manager</div>
                    <div className="text-xs text-gray-400">Position limits & stops</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="font-medium text-green-400">Paper Trader</div>
                    <div className="text-xs text-gray-400">Simulation mode</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="font-medium text-orange-400">Analytics</div>
                    <div className="text-xs text-gray-400">Performance tracking</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center mb-4">
              <ArrowDown className="text-gray-500" />
            </div>
            
            {/* Strategy Layer */}
            <div className="flex justify-center gap-4 flex-wrap">
              {STRATEGIES.map((strategy) => (
                <motion.div
                  key={strategy.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className={`cursor-pointer rounded-xl p-3 w-40 border ${
                    strategy.category === 'prediction' 
                      ? 'bg-purple-500/10 border-purple-500/30' 
                      : 'bg-orange-500/10 border-orange-500/30'
                  }`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg bg-gradient-to-r ${strategy.color}`}>
                      {strategy.icon}
                    </div>
                  </div>
                  <div className="text-sm font-medium leading-tight">{strategy.name}</div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[strategy.riskLevel]}`}>
                      {strategy.confidence}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Arrows Down */}
            <div className="flex justify-center mt-4 mb-4">
              <ArrowDown className="text-gray-500" />
            </div>
            
            {/* Output Layer */}
            <div className="flex justify-center gap-8">
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 w-32 text-center">
                <Wallet className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <div className="text-sm font-medium">Trades</div>
                <div className="text-xs text-gray-400">Execute orders</div>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 w-32 text-center">
                <BarChart3 className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <div className="text-sm font-medium">Analytics</div>
                <div className="text-xs text-gray-400">Track P&L</div>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 w-32 text-center">
                <Shield className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <div className="text-sm font-medium">Alerts</div>
                <div className="text-xs text-gray-400">Discord/Telegram</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedStrategy(null)}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${selectedStrategy.color}`}>
                  {selectedStrategy.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedStrategy.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-400">
                      {selectedStrategy.category === 'prediction' ? '🎯 Prediction Markets' : '₿ Crypto'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[selectedStrategy.riskLevel]}`}>
                      {selectedStrategy.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStrategy(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{selectedStrategy.confidence}%</div>
                <div className="text-sm text-gray-400">Confidence</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{selectedStrategy.expectedApy}</div>
                <div className="text-sm text-gray-400">Expected APY</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{selectedStrategy.platforms.length}</div>
                <div className="text-sm text-gray-400">Platforms</div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Description
              </h3>
              <p className="text-gray-300 leading-relaxed">{selectedStrategy.description}</p>
            </div>

            {/* Key Points */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Key Points
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Platforms */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Platforms Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedStrategy.platforms.map((platform) => (
                  <span key={platform} className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                Requirements
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            {/* Workflow */}
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-cyan-400" />
                Execution Workflow
              </h3>
              <div className="relative">
                <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-purple-500/50" />
                <div className="space-y-3">
                  {selectedStrategy.workflow.map((step, i) => (
                    <div key={i} className="flex items-start gap-4 pl-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                        i === 0 ? 'bg-cyan-500' :
                        i === selectedStrategy.workflow.length - 1 ? 'bg-purple-500' :
                        'bg-blue-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="text-gray-300 text-sm leading-relaxed">{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-700">
              <Link 
                href="/secrets"
                className="flex-1 bg-purple-600 hover:bg-purple-700 transition-colors py-3 rounded-xl text-center font-medium"
              >
                Configure API Keys
              </Link>
              <Link 
                href="/settings"
                className="flex-1 bg-blue-600 hover:bg-blue-700 transition-colors py-3 rounded-xl text-center font-medium"
              >
                Enable Strategy
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Strategy Cards Grid */}
      <div className="space-y-8">
        {/* Prediction Market Strategies */}
        {(!filterCategory || filterCategory === 'prediction') && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Prediction Market Strategies
              <span className="text-sm font-normal text-gray-400 ml-2">Polymarket & Kalshi</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictionStrategies.map((strategy) => (
                <motion.div
                  key={strategy.id}
                  whileHover={{ scale: 1.02 }}
                  className={`card p-5 cursor-pointer ${categoryColors.prediction} hover:border-purple-500/50 transition-all`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${strategy.color}`}>
                      {strategy.icon}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${riskColors[strategy.riskLevel]}`}>
                      {strategy.riskLevel}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{strategy.name}</h3>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{strategy.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-500">Confidence:</span>
                      <span className="ml-1 text-green-400 font-bold">{strategy.confidence}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">APY:</span>
                      <span className="ml-1 text-blue-400 font-bold">{strategy.expectedApy}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {strategy.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-xs bg-gray-700/50 px-2 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Crypto Strategies */}
        {(!filterCategory || filterCategory === 'crypto') && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">₿</span>
              Crypto Strategies
              <span className="text-sm font-normal text-gray-400 ml-2">CCXT Exchanges</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cryptoStrategies.map((strategy) => (
                <motion.div
                  key={strategy.id}
                  whileHover={{ scale: 1.02 }}
                  className={`card p-5 cursor-pointer ${categoryColors.crypto} hover:border-orange-500/50 transition-all`}
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${strategy.color}`}>
                      {strategy.icon}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${riskColors[strategy.riskLevel]}`}>
                      {strategy.riskLevel}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{strategy.name}</h3>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{strategy.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-500">Confidence:</span>
                      <span className="ml-1 text-green-400 font-bold">{strategy.confidence}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">APY:</span>
                      <span className="ml-1 text-blue-400 font-bold">{strategy.expectedApy}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {strategy.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-xs bg-gray-700/50 px-2 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Setup Checklist */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-green-400" />
          Quick Setup Checklist
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-purple-400 mb-3">🎯 Prediction Markets</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Polymarket wallet address configured</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Polymarket private key added</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>USDC funded on Polygon</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Kalshi API credentials (optional)</span>
              </label>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-orange-400 mb-3">₿ Crypto Exchanges</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Binance API key & secret</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Futures trading enabled on exchange</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>IP whitelist configured (if required)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input type="checkbox" className="form-checkbox rounded" />
                <span>Capital deposited on exchange</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
