'use client';

import { Opportunity } from '@/lib/supabase';
import { formatCurrency, formatPercent, timeAgo, cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, Zap } from 'lucide-react';

interface OpportunitiesFeedProps {
  opportunities: Opportunity[];
}

export function OpportunitiesFeed({ opportunities }: OpportunitiesFeedProps) {
  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No opportunities detected yet</p>
        <p className="text-sm">Waiting for arbitrage opportunities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {opportunities.map((opp) => (
        <OpportunityRow key={opp.id} opportunity={opp} />
      ))}
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: Opportunity }) {
  const profitColor = opportunity.profit_percent >= 2 
    ? 'text-neon-green' 
    : opportunity.profit_percent >= 1 
      ? 'text-neon-yellow' 
      : 'text-gray-400';

  return (
    <div className="p-3 rounded-lg bg-dark-border/30 hover:bg-dark-border/50 transition-colors border-l-2 border-neon-green/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-neon-blue/20 text-neon-blue text-xs font-medium">
            {opportunity.buy_platform?.toUpperCase() || 'POLY'}
          </span>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <span className="px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple text-xs font-medium">
            {opportunity.sell_platform?.toUpperCase() || 'KALSHI'}
          </span>
        </div>
        
        <div className={cn("font-bold", profitColor)}>
          {formatPercent(opportunity.profit_percent)}
        </div>
      </div>
      
      <p className="text-sm text-gray-400 mt-2 truncate">
        {opportunity.buy_market_name || opportunity.sell_market_name || 'Unknown Market'}
      </p>
      
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          Buy @ {(opportunity.buy_price * 100).toFixed(1)}¢ → Sell @ {(opportunity.sell_price * 100).toFixed(1)}¢
        </span>
        <span>{timeAgo(opportunity.detected_at)}</span>
      </div>
    </div>
  );
}
