'use client';

import { SimulatedTrade } from '@/lib/supabase';
import { formatCurrency, formatPercent, timeAgo, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Clock, CheckCircle2, Eye } from 'lucide-react';

interface TradesListProps {
  trades: SimulatedTrade[];
  onTradeClick?: (trade: SimulatedTrade) => void;
  tradingMode?: 'live' | 'paper';  // Display context-appropriate message
}

export function TradesList({ trades, onTradeClick, tradingMode = 'paper' }: TradesListProps) {
  if (trades.length === 0) {
    const isLive = tradingMode === 'live';
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No {isLive ? 'live' : 'paper'} trades yet</p>
        <p className="text-sm">Trades will appear here when opportunities are detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {trades.map((trade) => (
        <TradeRow 
          key={trade.id} 
          trade={trade} 
          onClick={onTradeClick ? () => onTradeClick(trade) : undefined}
        />
      ))}
    </div>
  );
}

function TradeRow({ trade, onClick }: { trade: SimulatedTrade; onClick?: () => void }) {
  const isProfit = (trade.expected_profit_usd || 0) > 0;
  
  return (
    <div 
      className={cn(
        "p-4 rounded-lg bg-dark-border/30 hover:bg-dark-border/50 transition-colors",
        onClick && "cursor-pointer group"
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium",
              trade.outcome === 'won' ? "bg-neon-green/20 text-neon-green" :
              trade.outcome === 'lost' ? "bg-red-500/20 text-red-400" :
              "bg-neon-yellow/20 text-neon-yellow"
            )}>
              {trade.outcome?.toUpperCase() || 'PENDING'}
            </span>
            <span className="text-xs text-gray-500">{trade.position_id}</span>
            {onClick && (
              <Eye className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          
          <p className="text-sm text-gray-300 mt-2 truncate">
            {trade.polymarket_market_title || trade.kalshi_market_title || 'Unknown Market'}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>Size: {formatCurrency(trade.position_size_usd)}</span>
            <span>•</span>
            <span>{timeAgo(trade.created_at)}</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className={cn(
            "text-lg font-bold flex items-center gap-1",
            isProfit ? "text-neon-green" : "text-red-400"
          )}>
            {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatCurrency(trade.expected_profit_usd)}
          </div>
          <div className={cn(
            "text-sm",
            isProfit ? "text-neon-green/70" : "text-red-400/70"
          )}>
            {formatPercent(trade.expected_profit_pct)}
          </div>
        </div>
      </div>
    </div>
  );
}
