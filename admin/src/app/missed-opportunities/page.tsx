'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  Info,
  ChevronRight,
  CheckCircle,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface FailedTrade {
  id: string;
  market_id: string;
  market_title: string;
  platform: string;
  trade_type: 'buy' | 'sell';
  side: 'yes' | 'no';
  amount: number;
  target_price: number;
  error_message: string;
  error_code: string;
  timestamp: string;
  can_retry: boolean;
  risk_level: 'low' | 'medium' | 'high';
  retry_count: number;
  last_retry?: string;
}

interface RiskImpact {
  level: 'low' | 'medium' | 'high';
  color: string;
  bgColor: string;
  description: string;
  recommendation: string;
}

const riskImpacts: Record<string, RiskImpact> = {
  low: {
    level: 'low',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Minimal portfolio impact',
    recommendation: 'Safe to retry - aligns with conservative risk profile',
  },
  medium: {
    level: 'medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Moderate portfolio exposure',
    recommendation: 'Review position size - may increase overall risk exposure by 5-15%',
  },
  high: {
    level: 'high',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Significant portfolio impact',
    recommendation: 'Caution advised - could increase risk exposure by 20%+ if retried',
  },
};

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const impact = riskImpacts[level];
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${impact.bgColor} ${impact.color}`}>
      <AlertCircle className="w-3 h-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </div>
  );
}

function FailedTradeCard({ trade, onRetry, isRetrying }: { 
  trade: FailedTrade; 
  onRetry: (id: string) => void;
  isRetrying: boolean;
}) {
  const [showRiskInfo, setShowRiskInfo] = useState(false);
  const impact = riskImpacts[trade.risk_level];

  return (
    <div className="bg-white border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
              {trade.platform}
            </span>
            <RiskBadge level={trade.risk_level} />
          </div>
          <h3 className="font-medium text-gray-900 line-clamp-2">{trade.market_title}</h3>
        </div>
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Type:</span>{' '}
          <span className="font-medium capitalize">{trade.trade_type} {trade.side?.toUpperCase()}</span>
        </div>
        <div>
          <span className="text-gray-500">Amount:</span>{' '}
          <span className="font-medium">${trade.amount.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Target:</span>{' '}
          <span className="font-medium">${trade.target_price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Retries:</span>{' '}
          <span className="font-medium">{trade.retry_count}</span>
        </div>
      </div>

      <div className="bg-red-50 rounded p-2 mb-3">
        <p className="text-sm text-red-700">
          <span className="font-medium">Error:</span> {trade.error_message}
        </p>
        {trade.error_code && (
          <p className="text-xs text-red-500 mt-1">Code: {trade.error_code}</p>
        )}
      </div>

      {/* Risk Impact Section */}
      <button 
        onClick={() => setShowRiskInfo(!showRiskInfo)}
        className="w-full text-left mb-3"
      >
        <div className={`flex items-center justify-between p-2 rounded ${impact.bgColor} ${impact.color}`}>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            <span className="text-sm font-medium">Risk Impact if Retried</span>
          </div>
          <ChevronRight className={`w-4 h-4 transition-transform ${showRiskInfo ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {showRiskInfo && (
        <div className={`p-3 rounded mb-3 ${impact.bgColor} border ${impact.color.replace('text-', 'border-')}`}>
          <p className="text-sm font-medium mb-1">{impact.description}</p>
          <p className="text-sm">{impact.recommendation}</p>
          {trade.risk_level === 'high' && (
            <div className="mt-2 p-2 bg-white rounded">
              <p className="text-xs text-gray-600">
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                Consider adjusting position size or waiting for better market conditions
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          <Clock className="inline w-3 h-3 mr-1" />
          {new Date(trade.timestamp).toLocaleString()}
        </span>
        {trade.can_retry && (
          <button
            onClick={() => onRetry(trade.id)}
            disabled={isRetrying}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${trade.risk_level === 'high' 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'}
              ${isRetrying ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : (trade.risk_level === 'high' ? 'Retry (Caution)' : 'Retry Trade')}
          </button>
        )}
      </div>
    </div>
  );
}

function FailedTradesContent() {
  const [trades, setTrades] = useState<FailedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  useEffect(() => {
    fetchFailedTrades();
  }, []);

  const fetchFailedTrades = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trades/failed');
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
      } else {
        // Generate sample data for demo
        setTrades(generateSampleFailedTrades());
      }
    } catch (error) {
      console.error('Failed to fetch failed trades:', error);
      setTrades(generateSampleFailedTrades());
    } finally {
      setLoading(false);
    }
  };

  const generateSampleFailedTrades = (): FailedTrade[] => {
    const now = new Date();
    return [
      {
        id: '1',
        market_id: 'poly-1',
        market_title: 'Will Bitcoin reach $100k by end of 2024?',
        platform: 'Polymarket',
        trade_type: 'buy',
        side: 'yes',
        amount: 50,
        target_price: 0.45,
        error_message: 'Insufficient liquidity at target price',
        error_code: 'INSUFFICIENT_LIQUIDITY',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        can_retry: true,
        risk_level: 'medium',
        retry_count: 1,
      },
      {
        id: '2',
        market_id: 'kalshi-1',
        market_title: 'Will Fed cut rates in December?',
        platform: 'Kalshi',
        trade_type: 'buy',
        side: 'yes',
        amount: 100,
        target_price: 0.72,
        error_message: 'Order rejected - market moved beyond slippage tolerance',
        error_code: 'SLIPPAGE_EXCEEDED',
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        can_retry: true,
        risk_level: 'low',
        retry_count: 0,
      },
      {
        id: '3',
        market_id: 'poly-2',
        market_title: 'Will Trump win the 2024 election?',
        platform: 'Polymarket',
        trade_type: 'sell',
        side: 'no',
        amount: 200,
        target_price: 0.38,
        error_message: 'Position size exceeds risk limits',
        error_code: 'RISK_LIMIT_EXCEEDED',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        can_retry: false,
        risk_level: 'high',
        retry_count: 2,
      },
      {
        id: '4',
        market_id: 'kalshi-2',
        market_title: 'Will CPI come in under 3% for November?',
        platform: 'Kalshi',
        trade_type: 'buy',
        side: 'yes',
        amount: 75,
        target_price: 0.55,
        error_message: 'API timeout - connection reset',
        error_code: 'TIMEOUT',
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        can_retry: true,
        risk_level: 'low',
        retry_count: 0,
      },
    ];
  };

  const handleRetry = async (tradeId: string) => {
    setRetryingId(tradeId);
    try {
      const res = await fetch(`/api/trades/retry/${tradeId}`, { method: 'POST' });
      if (res.ok) {
        // Remove from list on success
        setTrades(prev => prev.filter(t => t.id !== tradeId));
      } else {
        // Increment retry count on failure
        setTrades(prev => prev.map(t => 
          t.id === tradeId ? { ...t, retry_count: t.retry_count + 1, last_retry: new Date().toISOString() } : t
        ));
      }
    } catch (error) {
      console.error('Failed to retry trade:', error);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.market_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || trade.platform.toLowerCase() === filterPlatform;
    const matchesRisk = filterRisk === 'all' || trade.risk_level === filterRisk;
    return matchesSearch && matchesPlatform && matchesRisk;
  });

  const platforms = [...new Set(trades.map(t => t.platform))];

  const stats = {
    total: trades.length,
    retryable: trades.filter(t => t.can_retry).length,
    totalValue: trades.reduce((sum, t) => sum + t.amount, 0),
    highRisk: trades.filter(t => t.risk_level === 'high').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Failed Trades</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Retryable</span>
          </div>
          <p className="text-2xl font-bold">{stats.retryable}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Total Value</span>
          </div>
          <p className="text-2xl font-bold">${stats.totalValue.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">High Risk</span>
          </div>
          <p className="text-2xl font-bold">{stats.highRisk}</p>
        </div>
      </div>

      {/* AI Insights Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Want to optimize your trading strategy?</h3>
              <p className="text-sm text-gray-600">
                Visit AI Insights for personalized tuning recommendations based on your trading patterns
              </p>
            </div>
          </div>
          <Link 
            href="/insights"
            className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Go to AI Insights
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Platforms</option>
              {platforms.map(p => (
                <option key={p} value={p.toLowerCase()}>{p}</option>
              ))}
            </select>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Risk Explanation Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-900 mb-2">Understanding Risk Impact</h3>
            <p className="text-sm text-amber-800 mb-3">
              Each failed trade shows its risk impact if retried. This helps you make informed decisions based on your current risk profile.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-amber-800"><strong>Low:</strong> Safe to retry, minimal exposure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-amber-800"><strong>Medium:</strong> Review before retrying</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-amber-800"><strong>High:</strong> Consider adjusting position</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900 mb-1">No Failed Trades</h3>
          <p className="text-sm text-gray-500">
            {searchTerm || filterPlatform !== 'all' || filterRisk !== 'all'
              ? 'No trades match your filters. Try adjusting your search criteria.'
              : 'All your recent trades have been executed successfully!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTrades.map(trade => (
            <FailedTradeCard
              key={trade.id}
              trade={trade}
              onRetry={handleRetry}
              isRetrying={retryingId === trade.id}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {stats.retryable > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Bulk Actions</h3>
              <p className="text-sm text-gray-500">
                {stats.retryable} trade{stats.retryable !== 1 ? 's' : ''} can be retried
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Only retry low risk trades
                  const lowRiskTrades = trades.filter(t => t.can_retry && t.risk_level === 'low');
                  lowRiskTrades.forEach(t => handleRetry(t.id));
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Retry Low Risk Only ({trades.filter(t => t.can_retry && t.risk_level === 'low').length})
              </button>
              <button
                onClick={fetchFailedTrades}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FailedTradesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-gray-700">Dashboard</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Failed Trades</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Failed Trades</h1>
          <p className="text-gray-600 mt-2">
            Review and retry trades that didn&apos;t execute successfully. Each trade shows its risk impact to help you make informed decisions.
          </p>
        </div>

        {/* Main Content */}
        <FailedTradesContent />
      </div>
    </div>
  );
}
