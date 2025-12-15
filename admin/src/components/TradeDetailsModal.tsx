'use client';

import { useState, useMemo } from 'react';
import { 
  X,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  Fish,
  Landmark,
  Zap,
  Brain,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Trade/Opportunity type
export interface TradeDetails {
  id: string;
  type: 'arbitrage' | 'whale_copy' | 'congress_copy' | 'political_event' | 'high_conviction' | 'fear_premium' | 'macro';
  status: 'pending' | 'executed' | 'partial' | 'failed' | 'cancelled';
  
  // Market info
  marketTitle: string;
  marketId?: string;
  platform: 'polymarket' | 'kalshi' | 'alpaca' | 'cross_platform';
  
  // Trade details
  side: 'YES' | 'NO' | 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  
  // Position sizing
  size: number;
  sizeUsd: number;
  
  // P&L
  unrealizedPnl?: number;
  realizedPnl?: number;
  pnlPercent?: number;
  
  // Timing
  detectedAt: string;
  executedAt?: string;
  exitedAt?: string;
  
  // Strategy-specific data
  strategySignals?: StrategySignal[];
  whaleInfo?: WhaleInfo;
  congressInfo?: CongressInfo;
  arbitrageInfo?: ArbitrageInfo;
  convictionScore?: number;
  
  // Links
  marketUrl?: string;
  txHash?: string;
}

interface StrategySignal {
  source: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reason: string;
}

interface WhaleInfo {
  address: string;
  alias?: string;
  winRate: number;
  totalPnl: number;
  copiedTrades: number;
}

interface CongressInfo {
  politician: string;
  chamber: 'House' | 'Senate';
  party: 'D' | 'R' | 'I';
  originalAmount: number;
  disclosureDate: string;
}

interface ArbitrageInfo {
  type: 'single_platform' | 'cross_platform' | 'bracket';
  yesPrice: number;
  noPrice: number;
  spread: number;
  netProfit: number;
  fee?: number;
  platform2?: string;
  platform2YesPrice?: number;
  platform2NoPrice?: number;
}

interface TradeDetailsModalProps {
  trade: TradeDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

// Format currency
const formatCurrency = (amount: number | undefined, decimals = 2) => {
  if (amount === undefined) return '-';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

// Format percent
const formatPercent = (value: number | undefined, decimals = 1) => {
  if (value === undefined) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

// Get strategy icon
const getStrategyIcon = (type: TradeDetails['type']) => {
  switch (type) {
    case 'whale_copy': return Fish;
    case 'congress_copy': return Landmark;
    case 'political_event': return Landmark;
    case 'high_conviction': return Target;
    case 'fear_premium': return TrendingUp;
    case 'macro': return BarChart3;
    case 'arbitrage': return Zap;
    default: return Brain;
  }
};

// Get strategy color
const getStrategyColor = (type: TradeDetails['type']) => {
  switch (type) {
    case 'whale_copy': return 'text-blue-400 bg-blue-500/20';
    case 'congress_copy': return 'text-green-400 bg-green-500/20';
    case 'political_event': return 'text-purple-400 bg-purple-500/20';
    case 'high_conviction': return 'text-yellow-400 bg-yellow-500/20';
    case 'fear_premium': return 'text-red-400 bg-red-500/20';
    case 'macro': return 'text-indigo-400 bg-indigo-500/20';
    case 'arbitrage': return 'text-orange-400 bg-orange-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
};

// Get status badge
const StatusBadge = ({ status }: { status: TradeDetails['status'] }) => {
  const config = {
    pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock, label: 'Pending' },
    executed: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Executed' },
    partial: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Activity, label: 'Partial Fill' },
    failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, label: 'Failed' },
    cancelled: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: X, label: 'Cancelled' },
  };
  
  const { color, icon: Icon, label } = config[status];
  
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border', color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// Info row component
const InfoRow = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={cn("flex items-center justify-between py-2 border-b border-dark-border/50 last:border-0", className)}>
    <span className="text-sm text-dark-muted">{label}</span>
    <span className="text-sm text-white font-medium">{value}</span>
  </div>
);

export function TradeDetailsModal({ trade, isOpen, onClose }: TradeDetailsModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  
  if (!trade) return null;
  
  const StrategyIcon = getStrategyIcon(trade.type);
  const strategyColor = getStrategyColor(trade.type);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };
  
  const pnl = trade.realizedPnl ?? trade.unrealizedPnl ?? 0;
  const isProfitable = pnl >= 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] max-h-[80vh] overflow-y-auto bg-dark-card border border-dark-border rounded-2xl shadow-2xl z-50"
          >
            {/* Header */}
            <div className="sticky top-0 bg-dark-card border-b border-dark-border p-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', strategyColor)}>
                  <StrategyIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-lg leading-tight">Trade Details</h2>
                  <p className="text-xs text-dark-muted mt-0.5 capitalize">{trade.type.replace('_', ' ')} Strategy</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-dark-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-dark-muted" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Market Info */}
              <div className="bg-dark-bg/50 rounded-xl p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-dark-muted" />
                  Market
                </h3>
                <p className="text-sm text-white font-medium mb-2">{trade.marketTitle}</p>
                <div className="flex items-center gap-4 text-xs text-dark-muted">
                  <span className="capitalize">{trade.platform.replace('_', ' ')}</span>
                  <StatusBadge status={trade.status} />
                  {trade.marketUrl && (
                    <a 
                      href={trade.marketUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neon-blue hover:underline"
                    >
                      View Market <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              
              {/* Trade Summary */}
              <div className="grid grid-cols-2 gap-4">
                {/* Entry */}
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h4 className="text-xs text-dark-muted mb-2">Entry</h4>
                  <div className={cn(
                    "flex items-center gap-2 text-lg font-bold",
                    trade.side === 'YES' || trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'
                  )}>
                    {trade.side === 'YES' || trade.side === 'BUY' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                    {trade.side} @ {(trade.entryPrice * 100).toFixed(1)}¢
                  </div>
                  <p className="text-sm text-dark-muted mt-1">
                    {formatCurrency(trade.sizeUsd)} ({trade.size.toLocaleString()} shares)
                  </p>
                </div>
                
                {/* P&L */}
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h4 className="text-xs text-dark-muted mb-2">
                    {trade.realizedPnl !== undefined ? 'Realized P&L' : 'Unrealized P&L'}
                  </h4>
                  <div className={cn(
                    "text-lg font-bold",
                    isProfitable ? 'text-green-400' : 'text-red-400'
                  )}>
                    {formatCurrency(pnl)}
                  </div>
                  {trade.pnlPercent !== undefined && (
                    <p className={cn(
                      "text-sm mt-1",
                      isProfitable ? 'text-green-400' : 'text-red-400'
                    )}>
                      {formatPercent(trade.pnlPercent)}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Price Details */}
              <div className="bg-dark-bg/50 rounded-xl p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-dark-muted" />
                  Price Details
                </h3>
                <InfoRow label="Entry Price" value={`${(trade.entryPrice * 100).toFixed(2)}¢`} />
                {trade.currentPrice !== undefined && (
                  <InfoRow label="Current Price" value={`${(trade.currentPrice * 100).toFixed(2)}¢`} />
                )}
                {trade.exitPrice !== undefined && (
                  <InfoRow label="Exit Price" value={`${(trade.exitPrice * 100).toFixed(2)}¢`} />
                )}
              </div>
              
              {/* Arbitrage Details */}
              {trade.arbitrageInfo && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    Arbitrage Details
                  </h3>
                  <InfoRow label="Type" value={trade.arbitrageInfo.type.replace('_', ' ').toUpperCase()} />
                  <InfoRow label="YES Price" value={`${(trade.arbitrageInfo.yesPrice * 100).toFixed(2)}¢`} />
                  <InfoRow label="NO Price" value={`${(trade.arbitrageInfo.noPrice * 100).toFixed(2)}¢`} />
                  <InfoRow label="Spread" value={`${(trade.arbitrageInfo.spread * 100).toFixed(2)}%`} />
                  {trade.arbitrageInfo.fee && (
                    <InfoRow label="Fees" value={formatCurrency(trade.arbitrageInfo.fee)} />
                  )}
                  <InfoRow 
                    label="Net Profit" 
                    value={<span className="text-green-400">{formatCurrency(trade.arbitrageInfo.netProfit)}</span>} 
                  />
                  {trade.arbitrageInfo.platform2 && (
                    <>
                      <div className="border-t border-dark-border my-3" />
                      <InfoRow label="Platform 2" value={trade.arbitrageInfo.platform2} />
                      {trade.arbitrageInfo.platform2YesPrice && (
                        <InfoRow label="P2 YES Price" value={`${(trade.arbitrageInfo.platform2YesPrice * 100).toFixed(2)}¢`} />
                      )}
                      {trade.arbitrageInfo.platform2NoPrice && (
                        <InfoRow label="P2 NO Price" value={`${(trade.arbitrageInfo.platform2NoPrice * 100).toFixed(2)}¢`} />
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Whale Info */}
              {trade.whaleInfo && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Fish className="w-4 h-4 text-blue-400" />
                    Whale Info
                  </h3>
                  <InfoRow 
                    label="Address" 
                    value={
                      <button 
                        onClick={() => copyToClipboard(trade.whaleInfo!.address)}
                        className="flex items-center gap-1 font-mono text-xs hover:text-neon-green transition-colors"
                      >
                        {trade.whaleInfo.address.slice(0, 8)}...{trade.whaleInfo.address.slice(-6)}
                        {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    } 
                  />
                  {trade.whaleInfo.alias && (
                    <InfoRow label="Alias" value={trade.whaleInfo.alias} />
                  )}
                  <InfoRow label="Win Rate" value={`${trade.whaleInfo.winRate.toFixed(1)}%`} />
                  <InfoRow label="Total P&L" value={formatCurrency(trade.whaleInfo.totalPnl)} />
                  <InfoRow label="Copied Trades" value={trade.whaleInfo.copiedTrades} />
                </div>
              )}
              
              {/* Congress Info */}
              {trade.congressInfo && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-green-400" />
                    Congress Info
                  </h3>
                  <InfoRow label="Politician" value={trade.congressInfo.politician} />
                  <InfoRow label="Chamber" value={trade.congressInfo.chamber} />
                  <InfoRow 
                    label="Party" 
                    value={
                      <span className={cn(
                        trade.congressInfo.party === 'D' ? 'text-blue-400' : 
                        trade.congressInfo.party === 'R' ? 'text-red-400' : 'text-gray-400'
                      )}>
                        {trade.congressInfo.party === 'D' ? 'Democrat' : 
                         trade.congressInfo.party === 'R' ? 'Republican' : 'Independent'}
                      </span>
                    } 
                  />
                  <InfoRow label="Original Trade" value={formatCurrency(trade.congressInfo.originalAmount, 0)} />
                  <InfoRow label="Disclosed" value={new Date(trade.congressInfo.disclosureDate).toLocaleDateString()} />
                </div>
              )}
              
              {/* Conviction Score */}
              {trade.convictionScore !== undefined && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    Conviction Analysis
                  </h3>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-3xl font-bold text-white">
                      {(trade.convictionScore * 100).toFixed(0)}%
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${trade.convictionScore * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className={cn(
                            "h-full rounded-full",
                            trade.convictionScore >= 0.8 ? 'bg-green-500' :
                            trade.convictionScore >= 0.6 ? 'bg-yellow-500' : 'bg-orange-500'
                          )}
                        />
                      </div>
                      <p className="text-xs text-dark-muted mt-1">
                        {trade.convictionScore >= 0.8 ? 'High Conviction' :
                         trade.convictionScore >= 0.6 ? 'Medium Conviction' : 'Low Conviction'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Strategy Signals */}
              {trade.strategySignals && trade.strategySignals.length > 0 && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Signal Breakdown
                  </h3>
                  <div className="space-y-2">
                    {trade.strategySignals.map((signal, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 bg-dark-card rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            signal.signal === 'bullish' ? 'bg-green-500' :
                            signal.signal === 'bearish' ? 'bg-red-500' : 'bg-gray-500'
                          )} />
                          <span className="text-sm text-white">{signal.source}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-dark-muted">{signal.reason}</span>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            signal.signal === 'bullish' ? 'bg-green-500/20 text-green-400' :
                            signal.signal === 'bearish' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                          )}>
                            {(signal.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Timing */}
              <div className="bg-dark-bg/50 rounded-xl p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-dark-muted" />
                  Timing
                </h3>
                <InfoRow label="Detected" value={new Date(trade.detectedAt).toLocaleString()} />
                {trade.executedAt && (
                  <InfoRow label="Executed" value={new Date(trade.executedAt).toLocaleString()} />
                )}
                {trade.exitedAt && (
                  <InfoRow label="Exited" value={new Date(trade.exitedAt).toLocaleString()} />
                )}
              </div>
              
              {/* Transaction Hash */}
              {trade.txHash && (
                <div className="bg-dark-bg/50 rounded-xl p-4">
                  <h3 className="font-medium text-white mb-3">Transaction</h3>
                  <button 
                    onClick={() => copyToClipboard(trade.txHash!)}
                    className="flex items-center gap-2 font-mono text-xs text-dark-muted hover:text-white transition-colors"
                  >
                    {trade.txHash}
                    {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-dark-card border-t border-dark-border p-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-dark-border text-white rounded-lg hover:bg-dark-border/80 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Export the interface for use in other components
export type { TradeDetails as TradeDetailsType };
