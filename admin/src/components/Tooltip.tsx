'use client';

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-dark-card border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-dark-card border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-dark-card border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-dark-card border-y-transparent border-l-transparent',
  };

  return (
    <div 
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 px-3 py-2 text-sm text-gray-200 bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-xs whitespace-normal",
              positionClasses[position]
            )}
          >
            {content}
            <div 
              className={cn(
                "absolute w-0 h-0 border-[6px]",
                arrowClasses[position]
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Label with built-in tooltip icon
interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function LabelWithTooltip({ label, tooltip, className, position = 'top' }: LabelWithTooltipProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span>{label}</span>
      <Tooltip content={tooltip} position={position}>
        <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
      </Tooltip>
    </div>
  );
}

// Metric tooltips - centralized definitions
export const METRIC_TOOLTIPS = {
  // Dashboard metrics
  simulatedBalance: "Your virtual trading balance. Starts at $1,000 and changes based on simulated trade outcomes. This shows what your balance would be if these were real trades.",
  totalPnL: "Profit and Loss - The total amount gained or lost from all trades. Green means profit, red means loss. This is calculated from all completed trades.",
  winRate: "The percentage of trades that made a profit. Higher is better. A win rate above 50% with good risk management typically leads to profitability.",
  opportunities: "Arbitrage opportunities detected by the bot. These are price discrepancies between Polymarket and Kalshi where the same event has different prices.",
  roiPct: "Return on Investment - Your total profit as a percentage of your starting balance. Shows overall performance of the strategy.",
  
  // Trade metrics
  winningTrades: "Number of trades that resulted in a profit after all fees and costs.",
  losingTrades: "Number of trades that resulted in a loss. Some losses are expected even with valid arbitrage due to market movements.",
  executionRate: "Percentage of attempted trades that successfully executed. Lower rates mean opportunities are disappearing before execution.",
  totalFees: "Cumulative fees paid across all trades. Includes platform fees from Polymarket (~2%) and Kalshi (~7%).",
  
  // Market metrics  
  yesPrice: "The price to buy a 'Yes' contract. If the event happens, this pays $1. So 65¢ means the market thinks there's a ~65% chance.",
  noPrice: "The price to buy a 'No' contract. If the event doesn't happen, this pays $1. Should roughly equal 100¢ minus the Yes price.",
  volume: "Total trading volume in USD. Higher volume means more liquidity and easier trade execution.",
  liquidity: "Available funds in the market's order book. Higher liquidity means less slippage on trades.",
  spread: "The difference in prices between platforms. Larger spreads indicate potential arbitrage opportunities.",
  
  // Settings - Basic
  polymarketEnabled: "Enable or disable scanning Polymarket for opportunities. Polymarket has lower fees (~2%) but requires crypto.",
  kalshiEnabled: "Enable or disable scanning Kalshi for opportunities. Kalshi is US-regulated but has higher fees (~7%).",
  minProfitPercent: "Minimum profit percentage required to consider a trade. Higher values = fewer but safer trades.",
  maxTradeSize: "Maximum USD amount for any single trade. Limits risk exposure per position.",
  maxDailyLoss: "Stop trading for the day if losses exceed this amount. Essential risk management.",
  scanInterval: "How often (in seconds) to scan for new opportunities. Lower = more responsive but more API calls.",
  
  // Settings - Advanced Spread
  maxRealisticSpreadPct: "Maximum spread to consider valid. Spreads above this are likely false positives from mismatched markets or stale data.",
  minProfitThresholdPct: "Minimum expected profit after all costs. Below this, the trade isn't worth the execution risk.",
  
  // Settings - Execution Simulation
  slippageMinPct: "Minimum price slippage to simulate. Real trades rarely execute at exact quoted prices.",
  slippageMaxPct: "Maximum price slippage to simulate. Larger orders and volatile markets have more slippage.",
  spreadCostPct: "Simulated bid-ask spread cost. You buy at ask and sell at bid, losing this spread.",
  executionFailureRate: "Probability that an opportunity disappears before you can execute. Markets move fast!",
  partialFillChance: "Probability of only getting part of your order filled due to limited liquidity.",
  partialFillMinPct: "When partial fill occurs, minimum percentage of order that gets filled.",
  
  // Settings - Resolution Risk
  resolutionLossRate: "Probability that a trade loses money even after successful execution. Happens when markets diverge.",
  lossSeverityMin: "Minimum loss percentage when a losing trade occurs. Arbitrage losses are typically partial.",
  lossSeverityMax: "Maximum loss percentage when a losing trade occurs. Capped because true arbitrage limits downside.",
  
  // Settings - Position Sizing
  maxPositionPct: "Maximum position size as percentage of balance. Prevents over-concentration in one trade.",
  maxPositionUsd: "Maximum position size in USD. Hard cap regardless of balance.",
  minPositionUsd: "Minimum position size in USD. Trades below this aren't worth the fees.",
  
  // Bot status
  botRunning: "Whether the bot is actively scanning for opportunities and executing simulated trades.",
  dryRunMode: "When enabled, the bot simulates trades without real money. Always keep this ON until you're confident.",
  lastHeartbeat: "Last time the bot reported it was alive. If stale, the bot may have crashed.",
  
  // Analytics - Risk & Performance Metrics
  sharpeRatio: "Risk-adjusted return metric. Measures excess return per unit of risk. >1 is good, >2 is excellent, <0 means returns don't justify the risk taken.",
  maxDrawdown: "The largest peak-to-trough decline in portfolio value. Shows worst-case scenario and helps assess risk tolerance.",
  profitFactor: "Gross profits divided by gross losses. >1 means profitable overall. >1.5 is good, >2 is excellent.",
  expectancy: "Average expected profit per trade. Positive means you should make money over time. Calculated as (Win% × AvgWin) - (Loss% × AvgLoss).",
  currentStreak: "Consecutive wins or losses in a row. Long losing streaks may indicate strategy issues or bad luck.",
  dailyVolatility: "Standard deviation of daily returns. Higher volatility means more unpredictable swings in your balance.",
  
  // Analytics - Win/Loss Analysis
  avgWin: "Average profit when a trade wins. Compare to avgLoss to understand your risk/reward profile.",
  avgLoss: "Average loss when a trade loses. Should be smaller than avgWin for a sustainable strategy.",
  payoffRatio: "Average win divided by average loss. >1 means your wins are bigger than your losses on average.",
  tradingDays: "Total number of days with at least one trade. More data = more reliable statistics.",
  tradesPerDay: "Average number of trades executed per active trading day.",
  
  // Analytics - Charts
  pnlTrend: "Shows your cumulative profit/loss and balance over time. Upward slope = making money. Look for consistency.",
  tradeOutcomes: "Pie chart showing won, lost, and pending trades. Aim for more green (wins) than red (losses).",
  platformDistribution: "Breakdown of trades by platform - Polymarket only, Kalshi only, or cross-platform arbitrage.",
  spreadDistribution: "Histogram of opportunity spreads. Shows how profitable the detected opportunities are.",
  hourlyActivity: "Heatmap showing when most trades occur. Helps identify your most active trading hours.",
  winRateBySize: "Win rate broken down by trade size. Helps identify if larger or smaller trades perform better.",
  
  // Analytics - Best/Worst Trades
  bestTrades: "Your most profitable trades. Study these to understand what worked well.",
  worstTrades: "Your biggest losses. Analyze these to avoid similar mistakes.",
  
  // Time Range
  timeRange: "Filter data by time period. Shorter periods show recent performance, longer periods show overall trends.",
};
