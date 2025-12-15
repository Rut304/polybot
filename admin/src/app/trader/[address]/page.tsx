'use client';

import { useState, useMemo } from 'react';
import { 
  User,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Percent,
  Crown,
  Award,
  Medal,
  Activity,
  ExternalLink,
  RefreshCw,
  Calendar,
  Clock,
  Target,
  PieChart,
  BadgeCheck,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  Eye,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface TraderPosition {
  id: string;
  market: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  percentGain: number;
  category: string;
}

interface TraderBet {
  id: string;
  market: string;
  outcome: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  timestamp: string;
  pnl?: number;
  resolved: boolean;
}

interface TraderStats {
  totalBets: number;
  winRate: number;
  avgBetSize: number;
  biggestWin: number;
  biggestLoss: number;
  streak: number;
  avgHoldTime: string;
  topCategories: { category: string; count: number; pnl: number }[];
}

interface TraderDetails {
  address: string;
  username: string;
  xUsername?: string;
  verified: boolean;
  volume: number;
  pnl: number;
  roi: number;
  tier: 'elite' | 'pro' | 'skilled' | 'active' | 'volume';
  rank: number;
  positions: TraderPosition[];
  recentBets: TraderBet[];
  stats: TraderStats;
  profileImage?: string;
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
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

function calculateTier(roi: number): TraderDetails['tier'] {
  if (roi >= 50) return 'elite';
  if (roi >= 25) return 'pro';
  if (roi >= 10) return 'skilled';
  if (roi >= 5) return 'active';
  return 'volume';
}

// Fetch trader details from Polymarket API
async function fetchTraderDetails(address: string): Promise<TraderDetails | null> {
  try {
    // Fetch from Polymarket CLOB API
    const profileRes = await fetch(`https://clob.polymarket.com/profile/${address}`);
    
    if (!profileRes.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    const profile = await profileRes.json();
    
    // Fetch positions
    const positionsRes = await fetch(`https://clob.polymarket.com/positions?user=${address}`);
    let positions: TraderPosition[] = [];
    
    if (positionsRes.ok) {
      const posData = await positionsRes.json();
      positions = (posData || []).slice(0, 20).map((p: any, i: number) => ({
        id: `pos-${i}`,
        market: p.title || p.market_slug || 'Unknown Market',
        outcome: p.outcome || 'Yes',
        shares: parseFloat(p.size || '0'),
        avgPrice: parseFloat(p.avgPrice || p.avg_price || '0.5'),
        currentPrice: parseFloat(p.curPrice || p.current_price || '0.5'),
        unrealizedPnl: parseFloat(p.unrealizedPnl || '0'),
        percentGain: 0,
        category: p.category || 'Other',
      }));
    }
    
    // Fetch recent trades/history
    const tradesRes = await fetch(`https://clob.polymarket.com/trades?user=${address}&limit=50`);
    let recentBets: TraderBet[] = [];
    
    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      recentBets = (tradesData || []).slice(0, 30).map((t: any, i: number) => ({
        id: `bet-${i}`,
        market: t.title || t.market || 'Unknown Market',
        outcome: t.outcome || t.asset_id || 'Yes',
        side: t.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
        shares: parseFloat(t.size || t.amount || '0'),
        price: parseFloat(t.price || '0.5'),
        timestamp: t.timestamp || t.created_at || new Date().toISOString(),
        pnl: t.pnl ? parseFloat(t.pnl) : undefined,
        resolved: t.resolved || false,
      }));
    }
    
    const volume = parseFloat(profile.volume || '0');
    const pnl = parseFloat(profile.pnl || profile.profit || '0');
    const roi = volume > 0 ? (pnl / volume * 100) : 0;
    
    // Calculate stats
    const stats: TraderStats = {
      totalBets: recentBets.length,
      winRate: 0,
      avgBetSize: recentBets.length > 0 
        ? recentBets.reduce((s, b) => s + b.shares * b.price, 0) / recentBets.length 
        : 0,
      biggestWin: Math.max(...recentBets.filter(b => b.pnl && b.pnl > 0).map(b => b.pnl || 0), 0),
      biggestLoss: Math.min(...recentBets.filter(b => b.pnl && b.pnl < 0).map(b => b.pnl || 0), 0),
      streak: 0,
      avgHoldTime: 'N/A',
      topCategories: [],
    };
    
    // Calculate win rate from resolved bets
    const resolvedBets = recentBets.filter(b => b.resolved && b.pnl !== undefined);
    if (resolvedBets.length > 0) {
      const wins = resolvedBets.filter(b => b.pnl && b.pnl > 0).length;
      stats.winRate = (wins / resolvedBets.length) * 100;
    }
    
    return {
      address,
      username: profile.name || profile.username || `${address.slice(0, 6)}...${address.slice(-4)}`,
      xUsername: profile.twitterHandle || profile.twitter || undefined,
      verified: profile.verified || false,
      volume,
      pnl,
      roi,
      tier: calculateTier(roi),
      rank: profile.rank || 0,
      positions,
      recentBets,
      stats,
      profileImage: profile.profileImage || profile.avatar || undefined,
    };
  } catch (error) {
    console.error('Error fetching trader details:', error);
    return null;
  }
}

export default function TraderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const address = params.address as string;
  
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'bets' | 'stats'>('positions');
  
  // Fetch trader details
  const { data: trader, isLoading, error, refetch } = useQuery({
    queryKey: ['trader', address],
    queryFn: () => fetchTraderDetails(address),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
  
  // Check if trader is being tracked
  const { data: trackedData } = useQuery({
    queryKey: ['trackedWhale', address],
    queryFn: async () => {
      const { data } = await supabase
        .from('polybot_tracked_whales')
        .select('*')
        .eq('address', address)
        .single();
      return data;
    },
  });
  
  const isTracked = !!trackedData;
  
  // Toggle tracking mutation
  const toggleTrackingMutation = useMutation({
    mutationFn: async () => {
      if (isTracked) {
        const { error } = await supabase
          .from('polybot_tracked_whales')
          .delete()
          .eq('address', address);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('polybot_tracked_whales')
          .upsert({
            address,
            name: trader?.username || address,
            tier: trader?.tier || 'volume',
            roi_pct: trader?.roi || 0,
            volume_usd: trader?.volume || 0,
            copy_enabled: false,
            track_enabled: true,
          }, { onConflict: 'address' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedWhale', address] });
      queryClient.invalidateQueries({ queryKey: ['trackedWhales'] });
    },
  });
  
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          <p className="text-gray-400 mt-3">Loading trader profile...</p>
        </div>
      </div>
    );
  }
  
  if (error || !trader) {
    return (
      <div className="space-y-6">
        <Link 
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaderboard
        </Link>
        
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <User className="w-12 h-12 text-gray-500 mx-auto" />
          <h2 className="text-xl font-bold mt-4">Trader Not Found</h2>
          <p className="text-gray-400 mt-2">
            Could not load profile for address: {address.slice(0, 10)}...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            The trader may not have any public activity on Polymarket.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <a
              href={`https://polymarket.com/profile/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2"
            >
              View on Polymarket <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  const tierInfo = TIER_INFO[trader.tier];
  const TierIcon = tierInfo.icon;
  
  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/leaderboard"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>
      
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Profile Image / Avatar */}
          <div className="flex-shrink-0">
            {trader.profileImage ? (
              <img 
                src={trader.profileImage} 
                alt={trader.username}
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className={`w-20 h-20 rounded-full ${tierInfo.bg} flex items-center justify-center`}>
                <User className={`w-10 h-10 ${tierInfo.color}`} />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{trader.username}</h1>
              {trader.verified && (
                <BadgeCheck className="w-6 h-6 text-blue-400" />
              )}
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${tierInfo.bg}`}>
                <TierIcon className={`w-4 h-4 ${tierInfo.color}`} />
                <span className={`text-sm ${tierInfo.color}`}>{tierInfo.label.split(' ')[0]}</span>
              </div>
              {trader.rank > 0 && (
                <span className="text-sm text-gray-400">
                  Rank #{trader.rank}
                </span>
              )}
            </div>
            
            {/* Address and X */}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <code className="bg-gray-700 px-2 py-1 rounded font-mono text-xs">
                  {address.slice(0, 8)}...{address.slice(-6)}
                </code>
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              
              {trader.xUsername && (
                <a
                  href={`https://x.com/${trader.xUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  @{trader.xUsername}
                </a>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => toggleTrackingMutation.mutate()}
                disabled={toggleTrackingMutation.isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isTracked 
                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {toggleTrackingMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : isTracked ? (
                  <>
                    <Eye className="w-4 h-4" />
                    Tracking
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Track Trader
                  </>
                )}
              </button>
              
              <a
                href={`https://polymarket.com/profile/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on Polymarket
              </a>
              
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <DollarSign className="w-4 h-4" />
            Total PnL
          </div>
          <div className={`text-2xl font-bold mt-1 ${trader.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trader.pnl >= 0 ? '+' : ''}{formatCurrency(trader.pnl)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <BarChart3 className="w-4 h-4" />
            Volume
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatCurrency(trader.volume)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Percent className="w-4 h-4" />
            ROI
          </div>
          <div className={`text-2xl font-bold mt-1 ${trader.roi >= 20 ? 'text-green-400' : trader.roi >= 10 ? 'text-blue-400' : 'text-gray-300'}`}>
            {formatPercent(trader.roi)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Target className="w-4 h-4" />
            Win Rate
          </div>
          <div className={`text-2xl font-bold mt-1 ${trader.stats.winRate >= 55 ? 'text-green-400' : 'text-gray-300'}`}>
            {formatPercent(trader.stats.winRate)}
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { id: 'positions', label: 'Active Positions', icon: PieChart },
          { id: 'bets', label: 'Recent Bets', icon: Activity },
          { id: 'stats', label: 'Statistics', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {activeTab === 'positions' && (
          <div>
            {trader.positions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <PieChart className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                <p>No active positions found</p>
                <p className="text-sm mt-1">This trader may have closed all positions</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Market</th>
                    <th className="px-4 py-3 text-left">Outcome</th>
                    <th className="px-4 py-3 text-right">Shares</th>
                    <th className="px-4 py-3 text-right">Avg Price</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {trader.positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="font-medium truncate max-w-[300px] block">
                          {pos.market}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{pos.outcome}</td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {pos.shares.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {pos.avgPrice.toFixed(2)}¢
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(pos.currentPrice * 100).toFixed(1)}¢
                      </td>
                      <td className={`px-4 py-3 text-right ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        
        {activeTab === 'bets' && (
          <div>
            {trader.recentBets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Activity className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                <p>No recent bets found</p>
                <p className="text-sm mt-1">Activity data may be limited</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Market</th>
                    <th className="px-4 py-3 text-left">Side</th>
                    <th className="px-4 py-3 text-right">Shares</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">P/L</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {trader.recentBets.map((bet) => (
                    <tr key={bet.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="font-medium truncate max-w-[300px] block">
                          {bet.market}
                        </span>
                        <span className="text-xs text-gray-500">{bet.outcome}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          bet.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {bet.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {bet.shares.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {(bet.price * 100).toFixed(1)}¢
                      </td>
                      <td className={`px-4 py-3 text-right ${
                        bet.pnl === undefined ? 'text-gray-500' :
                        bet.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {bet.pnl !== undefined 
                          ? `${bet.pnl >= 0 ? '+' : ''}${formatCurrency(bet.pnl)}`
                          : bet.resolved ? 'Resolved' : 'Open'
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-sm">
                        {new Date(bet.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        
        {activeTab === 'stats' && (
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Performance Stats */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Performance
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Total Bets</dt>
                    <dd className="font-medium">{trader.stats.totalBets}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Win Rate</dt>
                    <dd className={`font-medium ${trader.stats.winRate >= 55 ? 'text-green-400' : ''}`}>
                      {formatPercent(trader.stats.winRate)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Avg Bet Size</dt>
                    <dd className="font-medium">{formatCurrency(trader.stats.avgBetSize)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Biggest Win</dt>
                    <dd className="font-medium text-green-400">
                      +{formatCurrency(trader.stats.biggestWin)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Biggest Loss</dt>
                    <dd className="font-medium text-red-400">
                      {formatCurrency(trader.stats.biggestLoss)}
                    </dd>
                  </div>
                </dl>
              </div>
              
              {/* Trading Style */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Trading Style Analysis
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Aggression</span>
                      <span>{trader.volume > 1000000 ? 'High' : trader.volume > 100000 ? 'Medium' : 'Low'}</span>
                    </div>
                    <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${Math.min(trader.volume / 10000000 * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Efficiency (ROI)</span>
                      <span>{trader.roi >= 25 ? 'Excellent' : trader.roi >= 10 ? 'Good' : 'Average'}</span>
                    </div>
                    <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(trader.roi, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Activity</span>
                      <span>{trader.stats.totalBets > 50 ? 'Very Active' : trader.stats.totalBets > 20 ? 'Active' : 'Casual'}</span>
                    </div>
                    <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(trader.stats.totalBets / 100 * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Strategy Recommendation */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/30">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                Strategy Insight
              </h3>
              <p className="text-gray-300">
                {trader.tier === 'elite' 
                  ? `This elite trader achieves exceptional ${formatPercent(trader.roi)} ROI. Consider tracking their activity for high-conviction trade signals.`
                  : trader.tier === 'pro'
                  ? `Strong performer with ${formatPercent(trader.roi)} ROI. Their trading patterns may offer valuable insights.`
                  : trader.tier === 'skilled'
                  ? `Solid trader with consistent returns. Good candidate for long-term tracking.`
                  : trader.tier === 'active'
                  ? `Active market participant. May trade frequently with smaller edges.`
                  : `High-volume trader with lower ROI. Likely focuses on market-making or arbitrage strategies.`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
