'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Calculator,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Target,
  Zap,
  DollarSign,
  Check,
  X,
  Search,
  Loader2,
  Info,
  Sparkles,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  endDate?: string;
  platform: 'polymarket' | 'kalshi';
}

interface ParlayLeg {
  id: string;
  market: Market;
  outcome: 'yes' | 'no';
  probability: number;
}

interface ParlayResult {
  combinedProbability: number;
  impliedOdds: number;
  potentialPayout: number;
  expectedValue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
}

// =============================================================================
// MOCK DATA (Fallback for when API is unavailable)
// =============================================================================

const FALLBACK_MARKETS: Market[] = [
  {
    id: 'fallback-1',
    question: '[Demo] Will Bitcoin exceed $100,000 by March 2025?',
    yesPrice: 0.45,
    noPrice: 0.55,
    volume: 2500000,
    endDate: '2025-03-31',
    platform: 'polymarket',
  },
  {
    id: 'fallback-2',
    question: '[Demo] Will the Fed cut rates in January 2025?',
    yesPrice: 0.22,
    noPrice: 0.78,
    volume: 1800000,
    endDate: '2025-01-31',
    platform: 'kalshi',
  },
  {
    id: 'fallback-3',
    question: '[Demo] Will S&P 500 close above 6000 by Feb 2025?',
    yesPrice: 0.68,
    noPrice: 0.32,
    volume: 950000,
    endDate: '2025-02-28',
    platform: 'polymarket',
  },
  {
    id: 'fallback-4',
    question: '[Demo] Will Ethereum exceed $5,000 by Q1 2025?',
    yesPrice: 0.35,
    noPrice: 0.65,
    volume: 1200000,
    endDate: '2025-03-31',
    platform: 'polymarket',
  },
  {
    id: 'fallback-5',
    question: '[Demo] Will unemployment stay below 4.5% in January?',
    yesPrice: 0.82,
    noPrice: 0.18,
    volume: 750000,
    endDate: '2025-02-07',
    platform: 'kalshi',
  },
  {
    id: 'fallback-6',
    question: '[Demo] Will AI company IPO in Q1 2025?',
    yesPrice: 0.55,
    noPrice: 0.45,
    volume: 450000,
    endDate: '2025-03-31',
    platform: 'polymarket',
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function calculateParlay(legs: ParlayLeg[], stake: number): ParlayResult {
  if (legs.length === 0) {
    return {
      combinedProbability: 0,
      impliedOdds: 0,
      potentialPayout: 0,
      expectedValue: 0,
      riskLevel: 'low',
      recommendation: 'hold',
    };
  }

  // Combined probability = product of all leg probabilities
  const combinedProbability = legs.reduce((acc, leg) => acc * leg.probability, 1);
  
  // Implied odds (decimal) = 1 / combined probability
  const impliedOdds = 1 / combinedProbability;
  
  // Potential payout = stake * implied odds
  const potentialPayout = stake * impliedOdds;
  
  // Expected value = (probability * payout) - stake
  const expectedValue = (combinedProbability * potentialPayout) - stake;
  
  // Risk assessment
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  if (combinedProbability >= 0.4) riskLevel = 'low';
  else if (combinedProbability >= 0.2) riskLevel = 'medium';
  else if (combinedProbability >= 0.05) riskLevel = 'high';
  else riskLevel = 'extreme';
  
  // Recommendation based on EV and probability
  let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  const evRatio = expectedValue / stake;
  if (evRatio > 0.2 && combinedProbability > 0.15) recommendation = 'strong_buy';
  else if (evRatio > 0.05 && combinedProbability > 0.1) recommendation = 'buy';
  else if (evRatio > -0.1) recommendation = 'hold';
  else recommendation = 'avoid';
  
  return {
    combinedProbability,
    impliedOdds,
    potentialPayout,
    expectedValue,
    riskLevel,
    recommendation,
  };
}

// =============================================================================
// COMPONENTS
// =============================================================================

function MarketCard({
  market,
  onAddLeg,
  isAdded,
}: {
  market: Market;
  onAddLeg: (market: Market, outcome: 'yes' | 'no') => void;
  isAdded: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border transition-all",
        isAdded
          ? "bg-neon-green/10 border-neon-green/30"
          : "bg-dark-card border-dark-border hover:border-dark-border/80"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium text-white line-clamp-2">
          {market.question}
        </h4>
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-medium uppercase shrink-0",
          market.platform === 'polymarket' 
            ? "bg-purple-500/20 text-purple-400"
            : "bg-blue-500/20 text-blue-400"
        )}>
          {market.platform}
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 text-center">
          <div className="text-xs text-gray-400 mb-1">YES</div>
          <div className="text-lg font-bold text-green-400">
            {(market.yesPrice * 100).toFixed(0)}¢
          </div>
        </div>
        <div className="w-px h-8 bg-dark-border" />
        <div className="flex-1 text-center">
          <div className="text-xs text-gray-400 mb-1">NO</div>
          <div className="text-lg font-bold text-red-400">
            {(market.noPrice * 100).toFixed(0)}¢
          </div>
        </div>
      </div>
      
      {!isAdded && (
        <div className="flex gap-2">
          <button
            onClick={() => onAddLeg(market, 'yes')}
            className="flex-1 py-2 px-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> YES
          </button>
          <button
            onClick={() => onAddLeg(market, 'no')}
            className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> NO
          </button>
        </div>
      )}
      
      {isAdded && (
        <div className="flex items-center justify-center gap-2 py-2 text-neon-green text-sm">
          <Check className="w-4 h-4" /> Added to parlay
        </div>
      )}
    </motion.div>
  );
}

function ParlayLegCard({
  leg,
  onRemove,
}: {
  leg: ParlayLeg;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-3 bg-dark-card/50 rounded-lg border border-dark-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white line-clamp-1 mb-1">
            {leg.market.question}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-bold",
              leg.outcome === 'yes'
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            )}>
              {leg.outcome.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">
              @ {(leg.probability * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <button
          onClick={onRemove}
          title="Remove leg from parlay"
          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function ResultsPanel({
  result,
  stake,
  legCount,
}: {
  result: ParlayResult;
  stake: number;
  legCount: number;
}) {
  const riskColors = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    extreme: 'text-red-400',
  };
  
  const recommendationConfig = {
    strong_buy: { text: 'Strong Buy', color: 'text-green-400', bg: 'bg-green-500/20' },
    buy: { text: 'Buy', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    hold: { text: 'Hold', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    avoid: { text: 'Avoid', color: 'text-red-400', bg: 'bg-red-500/20' },
  };
  
  const rec = recommendationConfig[result.recommendation];

  return (
    <div className="p-4 bg-dark-card rounded-xl border border-dark-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-neon-green" />
          Parlay Calculator
        </h3>
        <span className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          rec.bg, rec.color
        )}>
          {rec.text}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Combined Probability</div>
          <div className="text-lg font-bold text-white">
            {(result.combinedProbability * 100).toFixed(2)}%
          </div>
        </div>
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Implied Odds</div>
          <div className="text-lg font-bold text-white">
            {result.impliedOdds.toFixed(2)}x
          </div>
        </div>
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Potential Payout</div>
          <div className="text-lg font-bold text-neon-green">
            ${result.potentialPayout.toFixed(2)}
          </div>
        </div>
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Expected Value</div>
          <div className={cn(
            "text-lg font-bold",
            result.expectedValue >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {result.expectedValue >= 0 ? '+' : ''}${result.expectedValue.toFixed(2)}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
        <span className="text-sm text-gray-400">Risk Level</span>
        <span className={cn("text-sm font-medium uppercase", riskColors[result.riskLevel])}>
          {result.riskLevel}
        </span>
      </div>
      
      {legCount > 0 && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">
              {legCount}-leg parlay: All {legCount} predictions must be correct to win.
              {result.combinedProbability < 0.1 && (
                <span className="block mt-1 text-yellow-300">
                  ⚠️ Low probability parlays are high risk but high reward.
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ParlayBuilderPage() {
  const { user } = useAuth();
  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Fetch real markets from API on mount
  useEffect(() => {
    async function fetchMarkets() {
      setIsLoading(true);
      setFetchError(null);
      
      try {
        const response = await fetch('/api/markets?types=prediction');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform API data to our Market format
        // API returns: { id, question/title, platform, yesPrice/askPrice, noPrice/bidPrice, volume, endDate }
        const transformedMarkets: Market[] = data.markets
          ?.filter((m: any) => m.platform === 'polymarket' || m.platform === 'kalshi')
          ?.slice(0, 50) // Limit to 50 markets for performance
          ?.map((m: any) => ({
            id: m.id || m.conditionId,
            question: m.question || m.title || 'Unknown Market',
            yesPrice: m.yesPrice ?? m.askPrice ?? 0.5,
            noPrice: m.noPrice ?? m.bidPrice ?? 0.5,
            volume: m.volume ?? 0,
            endDate: m.endDate || m.expirationTime,
            platform: m.platform as 'polymarket' | 'kalshi',
          })) ?? [];
        
        if (transformedMarkets.length > 0) {
          setMarkets(transformedMarkets);
          setIsUsingFallback(false);
        } else {
          // No markets returned - use fallback
          setMarkets(FALLBACK_MARKETS);
          setIsUsingFallback(true);
        }
      } catch (error) {
        console.error('Error fetching markets:', error);
        setFetchError(error instanceof Error ? error.message : 'Failed to fetch markets');
        setMarkets(FALLBACK_MARKETS);
        setIsUsingFallback(true);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchMarkets();
  }, []);
  
  const addedMarketIds = new Set(legs.map(leg => leg.market.id));
  
  const addLeg = useCallback((market: Market, outcome: 'yes' | 'no') => {
    if (legs.length >= 10) {
      alert('Maximum 10 legs per parlay');
      return;
    }
    
    const probability = outcome === 'yes' ? market.yesPrice : market.noPrice;
    const newLeg: ParlayLeg = {
      id: `${market.id}-${outcome}-${Date.now()}`,
      market,
      outcome,
      probability,
    };
    
    setLegs(prev => [...prev, newLeg]);
  }, [legs.length]);
  
  const removeLeg = useCallback((legId: string) => {
    setLegs(prev => prev.filter(leg => leg.id !== legId));
  }, []);
  
  const clearAll = useCallback(() => {
    setLegs([]);
  }, []);
  
  const result = calculateParlay(legs, stake);

  // Place parlay - creates orders for all legs
  const [isPlacing, setIsPlacing] = useState(false);
  const placeParlay = useCallback(async () => {
    if (legs.length < 2) {
      alert('Add at least 2 legs to place a parlay');
      return;
    }
    
    setIsPlacing(true);
    try {
      // Calculate result inline to avoid dependency issues
      const currentResult = calculateParlay(legs, stake);
      
      // TODO: Implement actual parlay placement via API
      // For now, we'll show a success message and clear the parlay
      // In production, this would call /api/parlays to create the orders
      
      const parlayData = {
        legs: legs.map(leg => ({
          marketId: leg.market.id,
          platform: leg.market.platform,
          outcome: leg.outcome,
          probability: leg.probability,
          question: leg.market.question,
        })),
        stake,
        combinedProbability: currentResult.combinedProbability,
        potentialPayout: currentResult.potentialPayout,
        expectedValue: currentResult.expectedValue,
      };
      
      console.log('Placing parlay:', parlayData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Show success and clear
      alert(`✅ Parlay placed successfully!\n\n` +
            `Legs: ${legs.length}\n` +
            `Stake: $${stake}\n` +
            `Potential Payout: $${currentResult.potentialPayout.toFixed(2)}\n\n` +
            `Note: This is a simulation. Live trading coming soon!`);
      
      setLegs([]);
    } catch (error) {
      console.error('Error placing parlay:', error);
      alert('Failed to place parlay. Please try again.');
    } finally {
      setIsPlacing(false);
    }
  }, [legs, stake]);
  
  const filteredMarkets = markets.filter(market =>
    market.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Demo Mode Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/20 border-b border-amber-500/30">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300">
              <strong>Demo Mode:</strong> Showing sample markets. {fetchError ? `API error: ${fetchError}` : 'Connect your API keys in Settings to see live markets.'}
            </span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-dark-card border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Parlay Builder</h1>
              <p className="text-sm text-gray-400">
                Combine multiple predictions for multiplied payouts
              </p>
            </div>
            {!isUsingFallback && markets.length > 0 && (
              <div className="ml-auto px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                <span className="text-xs text-green-400 font-medium">
                  🟢 Live Data ({markets.length} markets)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Markets Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-card border border-dark-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-neon-green/50"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMarkets.map(market => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onAddLeg={addLeg}
                    isAdded={addedMarketIds.has(market.id)}
                  />
                ))}
              </div>
            )}
            
            {filteredMarkets.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-400">
                No markets found matching "{searchQuery}"
              </div>
            )}
          </div>
          
          {/* Parlay Panel */}
          <div className="space-y-4">
            <div className="p-4 bg-dark-card rounded-xl border border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-neon-green" />
                  Your Parlay ({legs.length}/10)
                </h3>
                {legs.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {legs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add predictions to build your parlay</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {legs.map((leg, index) => (
                      <div key={leg.id} className="flex items-center gap-2">
                        {index > 0 && (
                          <div className="flex items-center text-xs text-gray-500">
                            <span className="px-1.5 py-0.5 bg-dark-border rounded">AND</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <ParlayLegCard
                            leg={leg}
                            onRemove={() => removeLeg(leg.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
            {/* Stake Input */}
            <div className="p-4 bg-dark-card rounded-xl border border-dark-border">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Stake Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={stake}
                  onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                  placeholder="Enter stake amount"
                  title="Stake Amount"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-neon-green/50"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[10, 25, 50, 100, 250].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setStake(amount)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors",
                      stake === amount
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                        : "bg-dark-border text-gray-400 hover:text-white"
                    )}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Results */}
            <ResultsPanel
              result={result}
              stake={stake}
              legCount={legs.length}
            />
            
            {/* Place Bet Button */}
            {legs.length > 0 && (
              <button
                onClick={placeParlay}
                disabled={legs.length < 2 || isPlacing}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  legs.length >= 2 && !isPlacing
                    ? "bg-gradient-to-r from-neon-green to-emerald-500 text-dark-bg hover:shadow-lg hover:shadow-neon-green/20"
                    : "bg-dark-border text-gray-500 cursor-not-allowed"
                )}
              >
                {isPlacing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Placing Parlay...
                  </>
                ) : legs.length < 2 ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Add at least 2 legs
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Place ${stake} Parlay
                  </>
                )}
              </button>
            )}
            
            {/* Info */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                How Parlays Work
              </h4>
              <ul className="text-xs text-purple-200/80 space-y-1.5">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                  Combine 2-10 predictions into one bet
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                  All predictions must be correct to win
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                  Odds multiply together for higher payouts
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                  Higher risk, but higher potential reward
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
