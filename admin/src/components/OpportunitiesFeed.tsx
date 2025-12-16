'use client';

import { Opportunity } from '@/lib/supabase';
import { formatCurrency, formatPercent, timeAgo, cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, Zap, Activity, Eye } from 'lucide-react';

interface OpportunitiesFeedProps {
  opportunities: Opportunity[];
  onOpportunityClick?: (opportunity: Opportunity) => void;
}

export function OpportunitiesFeed({ opportunities, onOpportunityClick }: OpportunitiesFeedProps) {
  // Filter to only show real arbitrage opportunities with actual profit potential
  // Exclude "High activity" entries which are just market signals, not opportunities
  const realOpportunities = opportunities.filter(opp => {
    // Must have either a profit percent > 0 OR valid buy/sell prices
    const hasProfit = opp.profit_percent > 0;
    const hasPrices = opp.buy_price > 0 && opp.sell_price > 0;
    const isNotActivitySignal = !opp.buy_market_name?.startsWith('High activity:');
    
    return (hasProfit || hasPrices) && isNotActivitySignal;
  });

  if (realOpportunities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No arbitrage opportunities detected</p>
        <p className="text-sm">Scanning markets for price discrepancies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {realOpportunities.map((opp) => (
        <OpportunityRow 
          key={opp.id} 
          opportunity={opp} 
          onClick={onOpportunityClick ? () => onOpportunityClick(opp) : undefined}
        />
      ))}
    </div>
  );
}

function OpportunityRow({ opportunity, onClick }: { opportunity: Opportunity; onClick?: () => void }) {
  // Determine if this is a cross-platform or single-platform opportunity
  const isCrossPlatform = opportunity.buy_platform !== opportunity.sell_platform;
  const isOverlappingArb = opportunity.strategy?.includes('overlapping');
  
  const profitColor = opportunity.profit_percent >= 3 
    ? 'text-neon-green' 
    : opportunity.profit_percent >= 1.5 
      ? 'text-neon-yellow' 
      : opportunity.profit_percent > 0
        ? 'text-blue-400'
        : 'text-gray-400';

  // For overlapping arb, the profit is in deviation %, show differently
  const displayProfit = opportunity.profit_percent > 0 
    ? formatPercent(opportunity.profit_percent)
    : 'Analyzing...';

  return (
    <div 
      className={cn(
        "p-3 rounded-lg bg-dark-border/30 hover:bg-dark-border/50 transition-colors border-l-2",
        isCrossPlatform ? "border-neon-purple/50" : "border-neon-green/50",
        onClick && "cursor-pointer group"
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-neon-blue/20 text-neon-blue text-xs font-medium">
            {opportunity.buy_platform?.toUpperCase() || 'POLYMARKET'}
          </span>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            isCrossPlatform 
              ? "bg-neon-purple/20 text-neon-purple" 
              : "bg-neon-blue/20 text-neon-blue"
          )}>
            {opportunity.sell_platform?.toUpperCase() || 'POLYMARKET'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {onClick && (
            <Eye className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <div className={cn("font-bold", profitColor)}>
            {displayProfit}
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-400 mt-2 truncate" title={opportunity.buy_market_name || ''}>
        {opportunity.buy_market_name || opportunity.sell_market_name || 'Unknown Market'}
      </p>
      
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        {opportunity.buy_price > 0 && opportunity.sell_price > 0 ? (
          <span>
            Buy @ {(opportunity.buy_price * 100).toFixed(1)}¢ → Sell @ {(opportunity.sell_price * 100).toFixed(1)}¢
          </span>
        ) : isOverlappingArb ? (
          <span className="text-yellow-500/70">Overlapping market deviation</span>
        ) : (
          <span className="text-gray-600">Price analysis pending</span>
        )}
        <span>{timeAgo(opportunity.detected_at)}</span>
      </div>
      
      {/* Show Skip Reason if present */}
      {(opportunity.status === 'skipped' || opportunity.skip_reason) && (
        <div className="mt-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-medium flex items-center gap-1.5 w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            SKIPPED: {opportunity.skip_reason || 'Filtered by strategy settings'}
        </div>
      )}
    </div>
  );
}
