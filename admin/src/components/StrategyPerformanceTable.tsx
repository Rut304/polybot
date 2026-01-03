'use client';

import { useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Target,
    Activity,
    Zap,
    BarChart3,
    Newspaper,
    Users,
    Globe,
    Bitcoin,
    ArrowLeftRight,
    Repeat,
    Landmark,
    Brain,
    Clock,
    Crown,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useStrategyPerformance } from '@/lib/hooks';
import { formatCurrency, cn } from '@/lib/utils';

// Icon mapping (reused from StrategyBreakdown)
const STRATEGY_ICONS: Record<string, any> = {
    'kalshi_single': Target,
    'poly_single': Activity,
    'polymarket_single': Activity,
    'cross_platform': Zap,
    'whale_copy': Activity,
    'whale_copy_trading': Activity,
    'congressional': Activity,
    'congressional_tracker': Activity,
    'btc_bracket': Target,
    'btc_bracket_arb': Target,
    'bracket_compression': BarChart3,
    'kalshi_mention': Zap,
    'kalshi_mention_snipe': Zap,
    'macro_board': BarChart3,
    'fear_premium': Activity,
    'fear_premium_contrarian': Activity,
    'funding_rate': Target,
    'funding_rate_arb': Target,
    'grid_trading': BarChart3,
    'pairs_trading': Activity,
    'market_making': BarChart3,
    'news_arbitrage': Zap,
    'overlapping_arb': Target,
    'spike_hunter': Zap,
    'crypto_15min_scalping': Zap,
    'ai_superforecasting': Brain,
    'selective_whale_copy': Crown,
    'political_event': Landmark,
    'high_conviction': Brain,
    'time_decay': Clock,
    'manual': BarChart3,
};

function getStrategyIcon(strategy: string) {
    const norm = strategy.toLowerCase().replace(/-/g, '_');
    return STRATEGY_ICONS[norm] || BarChart3;
}

function getStrategyName(strategy: string) {
    const norm = strategy.replace(/_/g, ' ').replace(/-/g, ' ');
    return norm.replace(/\b\w/g, l => l.toUpperCase());
}

interface StrategyPerformanceTableProps {
    tradingMode?: 'paper' | 'live';
    limit?: number;
}

export function StrategyPerformanceTable({ tradingMode, limit }: StrategyPerformanceTableProps) {
    // Pass tradingMode to the hook so it filters data by mode
    const { data: strategies = [], isLoading } = useStrategyPerformance(tradingMode);
    const [sortField, setSortField] = useState<'total_pnl' | 'win_rate' | 'total_trades' | 'avg_trade' | 'best_trade'>('total_pnl');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedStrategies = [...strategies].sort((a, b) => {
        let valA = 0;
        let valB = 0;

        switch (sortField) {
            case 'total_pnl':
                valA = a.total_pnl;
                valB = b.total_pnl;
                break;
            case 'win_rate':
                // Use resolved trades (wins + losses) not total_trades (which includes pending)
                const resolvedA = a.winning_trades + a.losing_trades;
                const resolvedB = b.winning_trades + b.losing_trades;
                valA = resolvedA > 0 ? (a.winning_trades / resolvedA) : 0;
                valB = resolvedB > 0 ? (b.winning_trades / resolvedB) : 0;
                break;
            case 'total_trades':
                valA = a.total_trades;
                valB = b.total_trades;
                break;
            case 'avg_trade':
                valA = a.avg_trade_pnl || 0;
                valB = b.avg_trade_pnl || 0;
                break;
            case 'best_trade':
                valA = a.best_trade || 0;
                valB = b.best_trade || 0;
                break;
        }

        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    const displayStrategies = limit ? sortedStrategies.slice(0, limit) : sortedStrategies;

    if (isLoading) {
        return <div className="text-center p-8 text-gray-500 animate-pulse">Loading Strategy Performance...</div>;
    }

    if (strategies.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500 border border-dark-border rounded-xl border-dashed">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No strategy data available</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-dark-bg/50 border-b border-dark-border">
                    <tr>
                        <th className="px-6 py-4 font-bold tracking-wider">Strategy</th>
                        <th className="px-6 py-4 text-right font-bold tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('total_trades')}>
                            Trades
                        </th>
                        <th className="px-6 py-4 text-center font-bold tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('win_rate')}>
                            Win Rate
                        </th>
                        <th className="px-6 py-4 text-right font-bold tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('total_pnl')}>
                            Net P&L
                        </th>
                        <th className="px-6 py-4 text-right font-bold tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('avg_trade')}>
                            Avg Trade
                        </th>
                        <th className="px-6 py-4 text-right font-bold tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('best_trade')}>
                            Best Trade
                        </th>
                        <th className="px-6 py-4 text-right font-bold tracking-wider">
                            Worst Trade
                        </th>
                        <th className="px-6 py-4 text-center font-bold tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/50">
                    {displayStrategies.map((s, i) => {
                        // Use resolved trades (wins + losses), not total_trades (which includes pending)
                        const resolvedTrades = s.winning_trades + s.losing_trades;
                        const winRate = resolvedTrades > 0 ? (s.winning_trades / resolvedTrades) * 100 : 0;
                        const isProfitable = s.total_pnl >= 0;
                        const Icon = getStrategyIcon(s.strategy);

                        return (
                            <tr key={s.strategy} className="group hover:bg-dark-bg/30 transition-colors">
                                {/* Strategy Name & Icon */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-dark-border/50 text-gray-400">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span className="font-semibold text-white group-hover:text-neon-blue transition-colors">
                                            {getStrategyName(s.strategy)}
                                        </span>
                                    </div>
                                </td>

                                <td className="px-6 py-4 text-right text-gray-300 font-medium">{s.total_trades}</td>

                                {/* Win Rate Bar */}
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="w-24 h-1.5 bg-dark-bg rounded-full overflow-hidden border border-dark-border">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${winRate}%` }}
                                                className={cn("h-full rounded-full", winRate > 50 ? "bg-green-500" : "bg-orange-500")}
                                            />
                                        </div>
                                        <span className={cn("text-xs font-bold", winRate > 50 ? "text-green-400" : "text-orange-400")}>
                                            {winRate.toFixed(1)}%
                                        </span>
                                    </div>
                                </td>

                                {/* Net P&L */}
                                <td className="px-6 py-4 text-right">
                                    <div className={cn(
                                        "font-mono font-bold text-base",
                                        isProfitable ? "text-green-400" : "text-red-400"
                                    )}>
                                        {formatCurrency(s.total_pnl)}
                                    </div>
                                </td>

                                {/* Avg Trade */}
                                <td className="px-6 py-4 text-right font-mono text-gray-300 text-xs">
                                    {formatCurrency(s.avg_trade_pnl || 0)}
                                </td>

                                {/* Best Trade */}
                                <td className="px-6 py-4 text-right font-mono text-green-400 text-xs">
                                    +{formatCurrency(s.best_trade || 0)}
                                </td>

                                {/* Worst Trade */}
                                <td className="px-6 py-4 text-right font-mono text-red-400 text-xs">
                                    {formatCurrency(s.worst_trade || 0)}
                                </td>

                                {/* Status Chips */}
                                <td className="px-6 py-4 text-center">
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                                        isProfitable
                                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                                            : "bg-red-500/10 text-red-400 border-red-500/20"
                                    )}>
                                        {isProfitable ? '✔ Profitable' : '✘ Loss'}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
