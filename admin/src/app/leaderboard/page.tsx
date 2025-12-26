'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  Filter,
  BarChart3,
  Target,
  Percent,
  Users,
  Crown,
  Award,
  Medal,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Zap,
  AlertCircle,
  BadgeCheck,
  Activity,
  Play,
  Check,
  UserPlus,
  Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ProFeature } from '@/components/FeatureGate';

interface LeaderboardTrader {
  rank: number;
  address: string;
  username: string;
  xUsername?: string;
  verified: boolean;
  volume: number;
  pnl: number;
  roi: number;
  tier: 'elite' | 'pro' | 'skilled' | 'active' | 'volume';
  profileImage?: string;
}

interface LeaderboardStats {
  totalPnl: number;
  totalVolume: number;
  avgRoi: number;
  top10Pnl: number;
  tradersWithXHandle: number;
  verifiedCount: number;
  roiDistribution: {
    elite: number;     // 50%+
    pro: number;       // 25-50%
    skilled: number;   // 10-25%
    active: number;    // 5-10%
    volume: number;    // <5%
  };
}

interface StrategyInsight {
  id: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  type: 'pattern' | 'warning' | 'opportunity';
  confidence: 'high' | 'medium' | 'low';
  implementable?: boolean;
  implementAction?: 'add_elite_traders' | 'enable_high_conviction' | 'enable_politics_focus' | 'go_to_settings';
  implementLabel?: string;
}

const TIER_INFO = {
  elite: { label: 'Elite (50%+ ROI)', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Crown },
  pro: { label: 'Pro (25-50% ROI)', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Award },
  skilled: { label: 'Skilled (10-25% ROI)', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Medal },
  active: { label: 'Active (5-10% ROI)', color: 'text-green-400', bg: 'bg-green-500/20', icon: Activity },
  volume: { label: 'Volume (<5% ROI)', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: BarChart3 },
};

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

function calculateTier(roi: number): LeaderboardTrader['tier'] {
  if (roi >= 50) return 'elite';
  if (roi >= 25) return 'pro';
  if (roi >= 10) return 'skilled';
  if (roi >= 5) return 'active';
  return 'volume';
}

// Fetch leaderboard from our API
async function fetchLeaderboard(limit: number = 200): Promise<LeaderboardTrader[]> {
  const allTraders: LeaderboardTrader[] = [];
  const perPage = 50;

  // Fetch in batches due to API limit
  for (let offset = 0; offset < limit; offset += perPage) {
    const response = await fetch(`/api/whales/leaderboard?limit=${perPage}&offset=${offset}&minVolume=0&minPnl=0&timePeriod=ALL&orderBy=PNL`);
    if (!response.ok) break;

    const data = await response.json();
    if (!data.data || data.data.length === 0) break;

    const traders = data.data.map((t: any) => ({
      rank: t.rank || (offset + allTraders.length + 1),
      address: t.address,
      username: t.username || `${t.address.slice(0, 6)}...${t.address.slice(-4)}`,
      xUsername: t.xUsername || undefined,
      verified: t.verified || false,
      volume: t.volume || 0,
      pnl: t.pnl || 0,
      roi: t.volume > 0 ? (t.pnl / t.volume * 100) : 0,
      tier: calculateTier(t.volume > 0 ? (t.pnl / t.volume * 100) : 0),
      profileImage: t.profileImage || undefined,
    }));

    allTraders.push(...traders);
  }

  return allTraders;
}

// Generate strategy insights from leaderboard data
function generateInsights(traders: LeaderboardTrader[]): StrategyInsight[] {
  const insights: StrategyInsight[] = [];

  // Calculate stats
  const eliteTraders = traders.filter(t => t.tier === 'elite');
  const avgEliteVolume = eliteTraders.length > 0
    ? eliteTraders.reduce((sum, t) => sum + t.volume, 0) / eliteTraders.length
    : 0;

  const volumeTraders = traders.filter(t => t.tier === 'volume');
  const avgVolumeTraderVol = volumeTraders.length > 0
    ? volumeTraders.reduce((sum, t) => sum + t.volume, 0) / volumeTraders.length
    : 0;

  // Insight 1: Elite traders pattern
  if (eliteTraders.length > 0) {
    insights.push({
      id: 'elite-pattern',
      title: 'Elite Traders Focus on Quality Over Quantity',
      description: `${eliteTraders.length} traders achieve 50%+ ROI with avg volume of ${formatCurrency(avgEliteVolume)}.`,
      evidence: `Top ROI traders like ${eliteTraders[0]?.username || 'Unknown'} (${formatPercent(eliteTraders[0]?.roi || 0)} ROI) demonstrate selective, high-conviction betting.`,
      recommendation: 'Focus on fewer, higher-confidence predictions rather than spreading capital across many markets.',
      type: 'pattern',
      confidence: 'high',
      implementable: true,
      implementAction: 'add_elite_traders',
      implementLabel: 'Track Elite Traders',
    });
  }

  // Insight 2: Volume vs ROI tradeoff
  if (volumeTraders.length > 0 && avgVolumeTraderVol > avgEliteVolume) {
    insights.push({
      id: 'volume-warning',
      title: 'High Volume ≠ High Returns',
      description: `${volumeTraders.length} high-volume traders (avg ${formatCurrency(avgVolumeTraderVol)}) have <5% ROI.`,
      evidence: 'Market makers and arbitrageurs trade high volume but capture small spreads.',
      recommendation: 'Avoid chasing volume. Track ROI as primary metric, not total profit.',
      type: 'warning',
      confidence: 'high',
      implementable: true,
      implementAction: 'enable_high_conviction',
      implementLabel: 'Enable High Conviction Mode',
    });
  }

  // Insight 3: Optimal position sizing
  const proTraders = traders.filter(t => t.tier === 'pro' || t.tier === 'skilled');
  const avgProVolume = proTraders.length > 0
    ? proTraders.reduce((sum, t) => sum + t.volume, 0) / proTraders.length
    : 0;

  if (proTraders.length > 0) {
    insights.push({
      id: 'position-sizing',
      title: 'Sweet Spot: $1-15M Total Volume Range',
      description: `Pro traders (25-50% ROI) average ${formatCurrency(avgProVolume)} total volume.`,
      evidence: 'Traders in this range balance liquidity access with market impact minimization.',
      recommendation: 'Target markets with sufficient liquidity. For $1K bets, focus on markets with >$100K volume.',
      type: 'opportunity',
      confidence: 'medium',
      implementable: true,
      implementAction: 'go_to_settings',
      implementLabel: 'Adjust Position Sizing',
    });
  }

  // Insight 4: Username patterns
  const politicsNames = traders.filter(t =>
    t.username.toLowerCase().includes('trump') ||
    t.username.toLowerCase().includes('biden') ||
    t.username.toLowerCase().includes('rep') ||
    t.username.toLowerCase().includes('dem')
  );

  if (politicsNames.length >= 3) {
    insights.push({
      id: 'politics-focus',
      title: 'Politics Specialists Dominate Leaderboard',
      description: `${politicsNames.length} top traders have politics-related usernames.`,
      evidence: `Traders like ${politicsNames[0]?.username || 'Unknown'} (${formatCurrency(politicsNames[0]?.pnl || 0)} PnL) focus on political markets.`,
      recommendation: 'Political events offer high-conviction opportunities. Build expertise in political forecasting.',
      type: 'pattern',
      confidence: 'medium',
      implementable: true,
      implementAction: 'enable_politics_focus',
      implementLabel: 'Enable Political Strategy',
    });
  }

  // Insight 5: Consistency pattern
  const top50 = traders.slice(0, 50);
  const top50AvgRoi = top50.reduce((sum, t) => sum + t.roi, 0) / top50.length;

  insights.push({
    id: 'consistency',
    title: 'Top 50 Average ROI Pattern',
    description: `Top 50 traders average ${formatPercent(top50AvgRoi)} ROI across ${formatCurrency(top50.reduce((s, t) => s + t.volume, 0))} total volume.`,
    evidence: 'Consistent profitable trading at scale indicates systematic approach.',
    recommendation: 'Develop systematic rules for entry/exit. Paper trade strategies before deploying capital.',
    type: 'opportunity',
    confidence: 'high',
    implementable: true,
    implementAction: 'go_to_settings',
    implementLabel: 'Configure Strategy Rules',
  });

  // Insight 6: Verified traders
  const verifiedTraders = traders.filter(t => t.verified);
  if (verifiedTraders.length > 0) {
    insights.push({
      id: 'verified-signal',
      title: 'Watch Verified Traders for Market Signals',
      description: `${verifiedTraders.length} verified traders often have insider market knowledge.`,
      evidence: 'Verified status often correlates with market expertise or public figure status.',
      recommendation: 'Monitor verified traders\' positions for potential market-moving information.',
      type: 'opportunity',
      confidence: 'medium',
      implementable: true,
      implementAction: 'add_elite_traders',
      implementLabel: 'Track Verified Traders',
    });
  }

  return insights;
}

type SortField = 'rank' | 'pnl' | 'volume' | 'roi';
type TierFilter = 'all' | 'elite' | 'pro' | 'skilled' | 'active' | 'volume';

function LeaderboardPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [showInsights, setShowInsights] = useState(true);
  const [implementingInsight, setImplementingInsight] = useState<string | null>(null);
  const [implementResult, setImplementResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const { data: traders = [], isLoading, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboard(200),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate stats
  const stats: LeaderboardStats = useMemo(() => {
    if (traders.length === 0) {
      return {
        totalPnl: 0,
        totalVolume: 0,
        avgRoi: 0,
        top10Pnl: 0,
        tradersWithXHandle: 0,
        verifiedCount: 0,
        roiDistribution: { elite: 0, pro: 0, skilled: 0, active: 0, volume: 0 },
      };
    }

    const totalPnl = traders.reduce((sum, t) => sum + t.pnl, 0);
    const totalVolume = traders.reduce((sum, t) => sum + t.volume, 0);
    const avgRoi = totalVolume > 0 ? (totalPnl / totalVolume * 100) : 0;
    const top10Pnl = traders.slice(0, 10).reduce((sum, t) => sum + t.pnl, 0);

    return {
      totalPnl,
      totalVolume,
      avgRoi,
      top10Pnl,
      tradersWithXHandle: traders.filter(t => t.xUsername).length,
      verifiedCount: traders.filter(t => t.verified).length,
      roiDistribution: {
        elite: traders.filter(t => t.tier === 'elite').length,
        pro: traders.filter(t => t.tier === 'pro').length,
        skilled: traders.filter(t => t.tier === 'skilled').length,
        active: traders.filter(t => t.tier === 'active').length,
        volume: traders.filter(t => t.tier === 'volume').length,
      },
    };
  }, [traders]);

  // Generate insights
  const insights = useMemo(() => generateInsights(traders), [traders]);

  // Handle implementing an insight
  const handleImplementInsight = useCallback(async (insight: StrategyInsight) => {
    if (!insight.implementAction) return;

    setImplementingInsight(insight.id);
    setImplementResult(null);

    try {
      switch (insight.implementAction) {
        case 'add_elite_traders': {
          // Add top 5 elite or verified traders to whale tracking
          const eliteTraders = insight.id === 'verified-signal'
            ? traders.filter(t => t.verified).slice(0, 5)
            : traders.filter(t => t.tier === 'elite').slice(0, 5);

          for (const trader of eliteTraders) {
            await supabase.from('polybot_tracked_whales').upsert({
              address: trader.address,
              name: trader.username,
              tier: trader.tier,
              roi_pct: trader.roi,
              volume_usd: trader.volume,
              copy_enabled: false,
              track_enabled: true,
            }, { onConflict: 'address' });
          }

          queryClient.invalidateQueries({ queryKey: ['trackedWhales'] });
          setImplementResult({
            id: insight.id,
            success: true,
            message: `Added ${eliteTraders.length} traders to whale tracking`,
          });
          break;
        }

        case 'enable_high_conviction': {
          // Update config to enable high conviction mode
          const { error } = await supabase
            .from('polybot_config')
            .update({
              min_confidence_threshold: 0.75,
              max_concurrent_positions: 3,
            })
            .eq('id', 1);

          if (error) throw error;

          setImplementResult({
            id: insight.id,
            success: true,
            message: 'Enabled high conviction mode (75% threshold, max 3 positions)',
          });
          break;
        }

        case 'enable_politics_focus': {
          // Update config to focus on political markets
          const { error } = await supabase
            .from('polybot_config')
            .update({
              market_focus: 'politics',
              enable_event_trading: true,
            })
            .eq('id', 1);

          if (error) throw error;

          setImplementResult({
            id: insight.id,
            success: true,
            message: 'Enabled political market focus',
          });
          break;
        }

        case 'go_to_settings':
          router.push('/settings');
          return;
      }
    } catch (error) {
      setImplementResult({
        id: insight.id,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to implement',
      });
    } finally {
      setImplementingInsight(null);
    }
  }, [traders, router, queryClient]);

  // Filter and sort traders
  const displayedTraders = useMemo(() => {
    let result = [...traders];

    // Filter by tier
    if (tierFilter !== 'all') {
      result = result.filter(t => t.tier === tierFilter);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.username.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query) ||
        (t.xUsername && t.xUsername.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'pnl':
          comparison = b.pnl - a.pnl;
          break;
        case 'volume':
          comparison = b.volume - a.volume;
          break;
        case 'roi':
          comparison = b.roi - a.roi;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [traders, tierFilter, searchQuery, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'rank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-400" />
            Leaderboard Analysis
          </h1>
          <p className="text-gray-400 mt-1">
            Research top Polymarket traders and discover winning strategies
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <DollarSign className="w-4 h-4" />
            Total PnL (Top 200)
          </div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {formatCurrency(stats.totalPnl)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <BarChart3 className="w-4 h-4" />
            Total Volume
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatCurrency(stats.totalVolume)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Percent className="w-4 h-4" />
            Average ROI
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {formatPercent(stats.avgRoi)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Crown className="w-4 h-4" />
            Top 10 PnL
          </div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {formatCurrency(stats.top10Pnl)}
          </div>
        </div>
      </div>

      {/* ROI Distribution */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          ROI Distribution
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TIER_INFO).map(([tier, info]) => {
            const count = stats.roiDistribution[tier as keyof typeof stats.roiDistribution];
            const TierIcon = info.icon;
            const isSelected = tierFilter === tier;
            return (
              <button
                key={tier}
                onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier as TierFilter)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''
                  } ${info.bg} hover:opacity-80`}
              >
                <TierIcon className={`w-4 h-4 ${info.color}`} />
                <span className={info.color}>{info.label}</span>
                <span className="text-gray-400 ml-1">({count})</span>
              </button>
            );
          })}
          {tierFilter !== 'all' && (
            <button
              onClick={() => setTierFilter('all')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Strategy Insights */}
      <div className="bg-gray-800 rounded-lg p-4">
        <button
          onClick={() => setShowInsights(!showInsights)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-medium flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            Strategy Insights & Recommendations
            <span className="text-xs text-gray-500">• 1-click implement</span>
          </h3>
          {showInsights ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showInsights && (
          <div className="mt-4 space-y-4">
            {insights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg border ${insight.type === 'pattern' ? 'border-blue-500/50 bg-blue-500/10' :
                    insight.type === 'warning' ? 'border-orange-500/50 bg-orange-500/10' :
                      'border-green-500/50 bg-green-500/10'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${insight.type === 'pattern' ? 'bg-blue-500/20' :
                      insight.type === 'warning' ? 'bg-orange-500/20' :
                        'bg-green-500/20'
                    }`}>
                    {insight.type === 'pattern' ? <BarChart3 className="w-5 h-5 text-blue-400" /> :
                      insight.type === 'warning' ? <AlertCircle className="w-5 h-5 text-orange-400" /> :
                        <Zap className="w-5 h-5 text-green-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{insight.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${insight.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                            insight.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                          }`}>
                          {insight.confidence} confidence
                        </span>
                      </div>

                      {/* 1-Click Implement Button */}
                      {insight.implementable && (
                        <button
                          onClick={() => handleImplementInsight(insight)}
                          disabled={implementingInsight === insight.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${implementResult?.id === insight.id && implementResult.success
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                        >
                          {implementingInsight === insight.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : implementResult?.id === insight.id && implementResult.success ? (
                            <Check className="w-4 h-4" />
                          ) : insight.implementAction === 'go_to_settings' ? (
                            <Settings className="w-4 h-4" />
                          ) : insight.implementAction === 'add_elite_traders' ? (
                            <UserPlus className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          {implementResult?.id === insight.id && implementResult.success
                            ? 'Done!'
                            : insight.implementLabel || 'Implement'}
                        </button>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{insight.description}</p>
                    <p className="text-gray-500 text-sm mt-1 italic">&quot;{insight.evidence}&quot;</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">💡 Recommendation:</span>
                        <span className="text-sm">{insight.recommendation}</span>
                      </div>

                      {/* Show result message */}
                      {implementResult?.id === insight.id && (
                        <span className={`text-xs ${implementResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {implementResult.message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, address, or X handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-600 transition-colors"
                  onClick={() => handleSort('rank')}
                >
                  <div className="flex items-center gap-1">
                    Rank
                    {sortField === 'rank' && (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-left">Trader</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-600 transition-colors"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    PnL
                    {sortField === 'pnl' && (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-600 transition-colors"
                  onClick={() => handleSort('volume')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Volume
                    {sortField === 'volume' && (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-600 transition-colors"
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center justify-end gap-1">
                    ROI
                    {sortField === 'roi' && (sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="px-4 py-3 text-center">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                    <p className="text-gray-400 mt-2">Loading leaderboard...</p>
                  </td>
                </tr>
              ) : displayedTraders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No traders found matching your criteria
                  </td>
                </tr>
              ) : (
                displayedTraders.slice(0, 100).map((trader, index) => {
                  const tierInfo = TIER_INFO[trader.tier];
                  const TierIcon = tierInfo.icon;

                  return (
                    <motion.tr
                      key={trader.address}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.01 }}
                      className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/trader/${trader.address}`)}
                    >
                      <td className="px-4 py-3">
                        {trader.rank <= 3 ? (
                          <span className={`text-lg ${trader.rank === 1 ? 'text-yellow-400' :
                              trader.rank === 2 ? 'text-gray-300' :
                                'text-orange-400'
                            }`}>
                            {trader.rank === 1 ? '🥇' : trader.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono">#{trader.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium hover:text-blue-400 transition-colors">{trader.username}</span>
                          {trader.verified && (
                            <span title="Verified">
                              <BadgeCheck className="w-4 h-4 text-blue-400" />
                            </span>
                          )}
                          {trader.xUsername && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://x.com/${trader.xUsername}`, '_blank');
                              }}
                              className="text-xs text-gray-400 hover:text-blue-400 cursor-pointer"
                            >
                              @{trader.xUsername}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={trader.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {trader.pnl >= 0 ? '+' : ''}{formatCurrency(trader.pnl)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatCurrency(trader.volume)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={trader.roi >= 20 ? 'text-green-400' : trader.roi >= 10 ? 'text-blue-400' : 'text-gray-400'}>
                          {formatPercent(trader.roi)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${tierInfo.bg}`}>
                          <TierIcon className={`w-3 h-3 ${tierInfo.color}`} />
                          <span className={`text-xs ${tierInfo.color}`}>
                            {trader.tier === 'elite' ? 'Elite' :
                              trader.tier === 'pro' ? 'Pro' :
                                trader.tier === 'skilled' ? 'Skilled' :
                                  trader.tier === 'active' ? 'Active' : 'Volume'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://polymarket.com/profile/${trader.address}`, '_blank');
                          }}
                          className="p-1 hover:bg-gray-600 rounded inline-flex cursor-pointer"
                          title="View on Polymarket"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {displayedTraders.length > 100 && (
          <div className="p-4 text-center text-gray-400 border-t border-gray-700">
            Showing 100 of {displayedTraders.length} traders. Use filters to narrow results.
          </div>
        )}
      </div>

      {/* Key Takeaways */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-green-400" />
          Key Strategy Takeaways
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-green-400">✅ What Works</h4>
            <ul className="mt-2 space-y-2 text-sm text-gray-300">
              <li>• Focus on high-conviction bets with 50%+ expected edge</li>
              <li>• Political markets offer the best opportunities</li>
              <li>• Quality over quantity - fewer, larger positions</li>
              <li>• Systematic approach with clear entry/exit rules</li>
              <li>• Monitor verified/public traders for signals</li>
            </ul>
          </div>
          <div className="p-4 bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-red-400">❌ What Doesn&apos;t Work</h4>
            <ul className="mt-2 space-y-2 text-sm text-gray-300">
              <li>• Chasing volume without ROI discipline</li>
              <li>• Over-diversification across low-edge markets</li>
              <li>• FOMO trading without proper research</li>
              <li>• Ignoring market liquidity and slippage</li>
              <li>• No risk management or position limits</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <ProFeature>
      <LeaderboardPageContent />
    </ProFeature>
  );
}
