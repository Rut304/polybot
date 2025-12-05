'use client';

import { useState } from 'react';
import { 
  BookOpen, 
  Target,
  Repeat,
  BarChart3,
  Newspaper,
  Users,
  DollarSign,
  Grid3X3,
  LineChart,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface StrategyDoc {
  id: string;
  name: string;
  confidence: number;
  expectedApy: string;
  riskLevel: 'low' | 'medium' | 'high';
  category: 'prediction' | 'crypto';
  icon: JSX.Element;
  color: string;
  description: string;
  howItWorks: string[];
  keyPoints: string[];
  configParams: { name: string; default: string; description: string }[];
  requiredCredentials: string[];
  academicRefs?: string[];
}

const STRATEGY_DOCS: StrategyDoc[] = [
  {
    id: 'single_platform_arb',
    name: 'Single-Platform Arbitrage',
    confidence: 95,
    expectedApy: '50-200%',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Target className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-500',
    description: 'Exploit mispricings within a single prediction market by buying both YES and NO outcomes when their combined price is less than $1.00. This guarantees a profit regardless of the market outcome.',
    howItWorks: [
      'Scan all active markets on Polymarket/Kalshi every 60 seconds',
      'Calculate YES price + NO price for each market',
      'If combined price < threshold (e.g., 99.5%), an arbitrage opportunity exists',
      'Execute simultaneous buy orders for both YES and NO',
      'Wait for market resolution - one side wins, you collect $1.00',
      'Profit = $1.00 - (YES cost + NO cost)',
    ],
    keyPoints: [
      'Zero directional risk - You profit regardless of the outcome',
      'Rare opportunities - Mispricings are quickly corrected',
      'Polymarket advantage - 0% fees means smaller spreads are profitable',
      'Kalshi constraint - 7% fee on profits requires larger spreads (>7%)',
      'Academic validation - Research shows $40M+ extracted via this strategy in 1 year',
    ],
    configParams: [
      { name: 'poly_single_min_profit_pct', default: '0.5', description: 'Min profit threshold for Polymarket' },
      { name: 'poly_single_max_spread_pct', default: '5.0', description: 'Max bid-ask spread to consider' },
      { name: 'poly_single_max_position_usd', default: '500', description: 'Max position per opportunity' },
      { name: 'kalshi_single_min_profit_pct', default: '8.0', description: 'Min profit for Kalshi (>7% fees)' },
    ],
    requiredCredentials: [
      'WALLET_ADDRESS - Polymarket wallet address',
      'PRIVATE_KEY - Polymarket signing key',
      'KALSHI_API_KEY - Kalshi API key (optional)',
      'KALSHI_PRIVATE_KEY - Kalshi private key (optional)',
    ],
  },
  {
    id: 'cross_platform_arb',
    name: 'Cross-Platform Arbitrage',
    confidence: 90,
    expectedApy: '30-100%',
    riskLevel: 'low',
    category: 'prediction',
    icon: <Repeat className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-500',
    description: 'Exploit price differences between Polymarket and Kalshi for the same event. When YES on Polymarket is cheaper than NO on Kalshi (or vice versa), execute trades on both platforms for a guaranteed profit.',
    howItWorks: [
      'Fetch active markets from both Polymarket and Kalshi',
      'Match similar events using fuzzy string matching',
      'Compare YES prices across platforms',
      'Calculate spread after accounting for Kalshi\'s 7% fee',
      'If spread > threshold, execute cross-platform trade',
      'Wait for resolution - you hold opposite positions that cancel out',
    ],
    keyPoints: [
      'Asymmetric fees - Buy on Polymarket (0%) preferred over Kalshi (7%)',
      'Event matching - Must find identical events across platforms',
      'Settlement risk - Both platforms must resolve the same way',
      'Capital efficiency - Requires funds on both platforms',
    ],
    configParams: [
      { name: 'cross_plat_min_profit_buy_poly_pct', default: '3.0', description: 'Min profit when buying on Poly' },
      { name: 'cross_plat_min_profit_buy_kalshi_pct', default: '10.0', description: 'Min profit when buying on Kalshi' },
      { name: 'cross_plat_max_position_usd', default: '1000', description: 'Max position per opportunity' },
    ],
    requiredCredentials: [
      'All Polymarket credentials',
      'All Kalshi credentials',
      'Capital funded on both platforms',
    ],
  },
  {
    id: 'funding_rate_arb',
    name: 'Funding Rate Arbitrage',
    confidence: 85,
    expectedApy: '15-50%',
    riskLevel: 'low',
    category: 'crypto',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'from-yellow-500 to-amber-500',
    description: 'Collect perpetual futures funding payments by holding delta-neutral positions. When funding is positive (longs pay shorts), go long spot and short perpetual to earn funding without directional risk.',
    howItWorks: [
      'Scan funding rates across all supported exchanges',
      'Filter for rates > 0.03% per 8 hours (~30% APY)',
      'Calculate optimal position size based on limits',
      'Buy spot asset (or long with 1x leverage)',
      'Short an equivalent amount on perpetual futures',
      'Collect funding every 8 hours',
      'Exit when funding turns negative or spread narrows',
    ],
    keyPoints: [
      'Delta neutral - No exposure to price direction',
      'Structural alpha - Retail longs create persistent positive funding',
      'Math-based - Earning a fee, not predicting direction',
      'Historical data - BTC funding averages 0.01%/8h = 10.95% APY base',
      'Leverage management - Keep futures leverage low (2-3x max)',
    ],
    configParams: [
      { name: 'funding_min_rate_pct', default: '0.03', description: 'Min 0.03% per 8h' },
      { name: 'funding_min_apy', default: '30.0', description: 'Min 30% annualized' },
      { name: 'funding_max_position_usd', default: '1000', description: 'Max per position' },
      { name: 'funding_max_positions', default: '3', description: 'Max concurrent positions' },
      { name: 'funding_max_leverage', default: '3', description: 'Futures leverage limit' },
    ],
    requiredCredentials: [
      'BINANCE_API_KEY + BINANCE_API_SECRET',
      'BYBIT_API_KEY + BYBIT_API_SECRET',
      'OKX_API_KEY + OKX_API_SECRET + OKX_PASSPHRASE',
    ],
    academicRefs: [
      'Statistical Arbitrage in Cryptocurrency Markets - Journal of Finance',
      'Binance historical funding data analysis',
    ],
  },
  {
    id: 'grid_trading',
    name: 'Grid Trading',
    confidence: 75,
    expectedApy: '20-60%',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <Grid3X3 className="w-5 h-5" />,
    color: 'from-teal-500 to-cyan-500',
    description: 'Profit from sideways price oscillation by placing a grid of buy orders below current price and sell orders above. Each time price oscillates through the grid, you capture profit.',
    howItWorks: [
      'Select an asset with sideways/ranging price action',
      'Define price range (e.g., ±10% from current)',
      'Divide range into levels (e.g., 20 levels)',
      'Place buy limit orders at each level below current price',
      'Place sell limit orders at each level above current price',
      'When a buy fills, immediately place a sell at the next level up',
      'When a sell fills, immediately place a buy at the next level down',
    ],
    keyPoints: [
      'Range-bound profit - Works best when price oscillates',
      'Trend risk - Can lose money in strong up/down trends',
      'Automation required - Orders must be placed immediately on fills',
      'Level optimization - More levels = more trades but smaller profits each',
      'Stop-loss important - Exit if price breaks out of range',
    ],
    configParams: [
      { name: 'grid_default_range_pct', default: '10.0', description: '±10% range' },
      { name: 'grid_default_levels', default: '20', description: 'Number of grid levels' },
      { name: 'grid_default_investment_usd', default: '500', description: 'Capital per grid' },
      { name: 'grid_max_grids', default: '3', description: 'Max concurrent grids' },
      { name: 'grid_stop_loss_pct', default: '15.0', description: 'Exit if price breaks out' },
    ],
    requiredCredentials: [
      'Any CCXT-supported exchange API keys',
      'Sufficient capital deposited',
    ],
  },
  {
    id: 'pairs_trading',
    name: 'Pairs Trading / Statistical Arbitrage',
    confidence: 65,
    expectedApy: '10-25%',
    riskLevel: 'medium',
    category: 'crypto',
    icon: <LineChart className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-500',
    description: 'Trade the spread between two correlated assets. When the spread widens beyond normal (z-score > 2), long the underperformer and short the outperformer, expecting mean reversion.',
    howItWorks: [
      'Calculate rolling 30-day correlation between pair (e.g., BTC/ETH)',
      'Compute spread: Price_A - (Beta × Price_B)',
      'Calculate mean and standard deviation of spread',
      'Compute z-score: (current_spread - mean) / std_dev',
      'If z-score > +2: Short A, Long B (A outperformed)',
      'If z-score < -2: Long A, Short B (B outperformed)',
      'Exit when z-score returns to <0.5',
    ],
    keyPoints: [
      'Mean reversion - Spreads tend to return to normal',
      'Correlation risk - Correlation can break down (regime change)',
      'Market neutral - Long + short cancel directional risk',
      'Statistical basis - Backed by academic research',
      'Best pairs: BTC/ETH, SOL/AVAX, LINK/UNI',
    ],
    configParams: [
      { name: 'pairs_entry_zscore', default: '2.0', description: 'Enter when |z| > 2' },
      { name: 'pairs_exit_zscore', default: '0.5', description: 'Exit when |z| < 0.5' },
      { name: 'pairs_position_size_usd', default: '500', description: 'Size per leg' },
      { name: 'pairs_max_positions', default: '2', description: 'Max concurrent pairs' },
      { name: 'pairs_max_hold_hours', default: '72', description: 'Max 3 days holding' },
    ],
    requiredCredentials: [
      'Exchange API with margin/futures access',
      'Ability to short on the exchange',
    ],
    academicRefs: [
      'Algorithmic Trading of Co-Integrated Assets - SSRN',
      'QuantConnect: Optimal Pairs Trading strategy library',
    ],
  },
  {
    id: 'market_making',
    name: 'Market Making',
    confidence: 75,
    expectedApy: '10-20%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Provide liquidity to prediction markets by placing limit orders on both the bid and ask sides. Earn the spread each time both orders get filled.',
    howItWorks: [
      'Select high-volume markets (>$5,000 24h volume)',
      'Calculate fair value from current order book',
      'Place bid order below fair value',
      'Place ask order above fair value',
      'When bid fills, place a new ask at higher price',
      'When ask fills, place a new bid at lower price',
      'Adjust quote sizes based on inventory position',
    ],
    keyPoints: [
      'Spread capture - Earn 1-5% on each round trip',
      'Inventory risk - Can get stuck with one-sided position',
      'Active management - Requires constant quote refreshing',
      'Market selection - Best on high-volume, volatile markets',
      'Capital intensive - Same capital backs both sides',
    ],
    configParams: [
      { name: 'mm_target_spread_bps', default: '300', description: 'Target 3% spread' },
      { name: 'mm_order_size_usd', default: '50', description: 'Size per quote' },
      { name: 'mm_max_inventory_usd', default: '500', description: 'Max one-sided inventory' },
      { name: 'mm_quote_refresh_sec', default: '30', description: 'Refresh frequency' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
    ],
  },
  {
    id: 'news_arbitrage',
    name: 'News Arbitrage',
    confidence: 60,
    expectedApy: '5-30% per event',
    riskLevel: 'high',
    category: 'prediction',
    icon: <Newspaper className="w-5 h-5" />,
    color: 'from-orange-500 to-red-500',
    description: 'React to breaking news faster than the market. When news breaks that affects a prediction market outcome, trade before prices fully adjust.',
    howItWorks: [
      'Monitor news feeds (NewsAPI, Twitter, RSS)',
      'Match news keywords to active prediction markets',
      'Analyze sentiment and likely market impact',
      'Execute trades within minutes of news breaking',
      'Set stop-losses to manage risk',
    ],
    keyPoints: [
      'Speed critical - Minutes matter, not hours',
      'Interpretation risk - News impact can be misread',
      'High reward - Can capture 10-50% moves',
      'Keyword matching - Link news to relevant markets',
      'Short holding period - Exit when market adjusts',
    ],
    configParams: [
      { name: 'news_min_spread_pct', default: '5.0', description: 'Min price move to trade' },
      { name: 'news_max_lag_minutes', default: '30', description: 'Max time since news' },
      { name: 'news_position_size_usd', default: '100', description: 'Conservative sizing' },
    ],
    requiredCredentials: [
      'NEWS_API_KEY - NewsAPI.org',
      'TWITTER_BEARER_TOKEN - Twitter API (optional)',
      'Trading platform credentials',
    ],
  },
  {
    id: 'copy_trading',
    name: 'Copy Trading',
    confidence: 70,
    expectedApy: '20-50%',
    riskLevel: 'medium',
    category: 'prediction',
    icon: <Users className="w-5 h-5" />,
    color: 'from-indigo-500 to-violet-500',
    description: 'Automatically copy trades from successful "whale" traders. Leverage their research and conviction by mirroring their positions at a configurable scale.',
    howItWorks: [
      'Monitor specified wallet addresses for new positions',
      'Detect when a tracked trader opens a position',
      'Calculate your position size (e.g., 10% of their size)',
      'Execute the same trade with slight delay',
      'Track performance vs original trader',
    ],
    keyPoints: [
      'Whale following - Copy traders with proven track records',
      'Transparent data - Polymarket trades are on-chain',
      'Configurable scale - Set your copy multiplier',
      'Delay inherent - You trade after them',
      'Address curation - Finding good traders is key',
    ],
    configParams: [
      { name: 'max_copy_size', default: '100', description: 'Max position size to copy' },
      { name: 'min_copy_size', default: '5', description: 'Min position to trigger copy' },
      { name: 'copy_multiplier', default: '0.1', description: '10% of whale size' },
    ],
    requiredCredentials: [
      'Polymarket wallet + private key',
      'List of whale addresses to track',
    ],
  },
];

const riskColors = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function DocsPage() {
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredDocs = filterCategory 
    ? STRATEGY_DOCS.filter(s => s.category === filterCategory)
    : STRATEGY_DOCS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            Strategy Documentation
          </h1>
          <p className="text-gray-400 mt-1">
            Complete reference for all trading strategies, parameters, and requirements
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-lg transition-all ${
              !filterCategory ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            All ({STRATEGY_DOCS.length})
          </button>
          <button
            onClick={() => setFilterCategory('prediction')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'prediction' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🎯 Prediction ({STRATEGY_DOCS.filter(s => s.category === 'prediction').length})
          </button>
          <button
            onClick={() => setFilterCategory('crypto')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterCategory === 'crypto' ? 'bg-orange-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ₿ Crypto ({STRATEGY_DOCS.filter(s => s.category === 'crypto').length})
          </button>
        </div>
      </div>

      {/* Summary Table */}
      <div className="card p-4 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4">Strategy Comparison</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="pb-3 pr-4">Strategy</th>
              <th className="pb-3 pr-4">Confidence</th>
              <th className="pb-3 pr-4">Expected APY</th>
              <th className="pb-3 pr-4">Risk</th>
              <th className="pb-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGY_DOCS.map((strategy) => (
              <tr 
                key={strategy.id} 
                className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setExpandedStrategy(expandedStrategy === strategy.id ? null : strategy.id)}
              >
                <td className="py-3 pr-4 font-medium">{strategy.name}</td>
                <td className="py-3 pr-4">
                  <span className="text-green-400 font-bold">{strategy.confidence}%</span>
                </td>
                <td className="py-3 pr-4 text-blue-400">{strategy.expectedApy}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${riskColors[strategy.riskLevel].bg} ${riskColors[strategy.riskLevel].text}`}>
                    {strategy.riskLevel}
                  </span>
                </td>
                <td className="py-3">
                  {strategy.category === 'prediction' ? '🎯' : '₿'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Strategy Details */}
      <div className="space-y-4">
        {filteredDocs.map((strategy) => (
          <motion.div
            key={strategy.id}
            initial={false}
            className="card overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedStrategy(expandedStrategy === strategy.id ? null : strategy.id)}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-r ${strategy.color}`}>
                  {strategy.icon}
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{strategy.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="text-green-400">{strategy.confidence}% confidence</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-blue-400">{strategy.expectedApy} APY</span>
                    <span className="text-gray-500">•</span>
                    <span className={`px-2 py-0.5 rounded-full ${riskColors[strategy.riskLevel].bg} ${riskColors[strategy.riskLevel].text}`}>
                      {strategy.riskLevel} risk
                    </span>
                  </div>
                </div>
              </div>
              {expandedStrategy === strategy.id ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
              {expandedStrategy === strategy.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-gray-700"
                >
                  <div className="p-5 space-y-6">
                    {/* Description */}
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Description
                      </h4>
                      <p className="text-gray-300 leading-relaxed">{strategy.description}</p>
                    </div>

                    {/* How It Works */}
                    <div>
                      <h4 className="font-bold text-purple-400 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        How It Works
                      </h4>
                      <ol className="space-y-2">
                        {strategy.howItWorks.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 bg-purple-500/30 text-purple-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-gray-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Key Points */}
                    <div>
                      <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Key Points
                      </h4>
                      <ul className="space-y-2">
                        {strategy.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300">
                            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Configuration Parameters */}
                      <div>
                        <h4 className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Configuration Parameters
                        </h4>
                        <div className="bg-gray-900/50 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <tbody>
                              {strategy.configParams.map((param, i) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-gray-800/30' : ''}>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{param.name}</td>
                                  <td className="px-3 py-2 text-right font-mono text-yellow-400">{param.default}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Required Credentials */}
                      <div>
                        <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Required Credentials
                        </h4>
                        <ul className="space-y-2">
                          {strategy.requiredCredentials.map((cred, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              {cred}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Academic References */}
                    {strategy.academicRefs && (
                      <div>
                        <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Academic References
                        </h4>
                        <ul className="space-y-1">
                          {strategy.academicRefs.map((ref, i) => (
                            <li key={i} className="text-gray-400 text-sm italic">
                              • {ref}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-gray-700">
                      <Link
                        href="/secrets"
                        className="flex-1 bg-purple-600 hover:bg-purple-700 py-2.5 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Configure API Keys
                      </Link>
                      <Link
                        href="/settings"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Enable Strategy
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Additional Resources */}
      <div className="card p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <ExternalLink className="text-blue-400" />
          Additional Resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/workflows"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Workflow Diagrams</div>
            <div className="text-sm text-gray-400">Visual flowcharts of all strategies</div>
          </Link>
          <a 
            href="https://github.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Source Code</div>
            <div className="text-sm text-gray-400">View strategy implementations</div>
          </a>
          <Link 
            href="/analytics"
            className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="font-medium mb-1">Performance Analytics</div>
            <div className="text-sm text-gray-400">Track strategy performance</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
