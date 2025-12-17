
import { useMissedMoney } from '@/lib/hooks';
import Link from 'next/link';
import { formatCurrency, cn } from '@/lib/utils';
import { Wallet, AlertTriangle, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function MoneyStatsWidget({ timeframeHours = 24 }: { timeframeHours?: number }) {
    const { data: stats, isLoading } = useMissedMoney(timeframeHours);

    if (isLoading || !stats) {
        return (
            <div className="w-full h-48 bg-dark-card/50 rounded-xl animate-pulse mb-8 border border-dark-border" />
        );
    }

    // Calculate efficiency score (0-100)
    const efficiency = stats.opportunities_count > 0
        ? Math.round((stats.executed_count / stats.opportunities_count) * 100)
        : 100;

    return (
        <Link href="/missed-opportunities" className="block w-full group/widget relative z-50 cursor-pointer hover:bg-dark-card/50 rounded-xl transition-all">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card bg-gradient-to-br from-dark-card to-dark-bg border border-dark-border p-6 mb-8 relative overflow-hidden transition-all duration-300 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10 cursor-pointer"
            >
                {/* Background subtle glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/5 blur-[120px] rounded-full pointer-events-none transition-opacity group-hover/widget:opacity-50" />
                {stats.missed_money > 0 && (
                    <div className="absolute top-0 left-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none group-hover/widget:bg-red-500/10 transition-colors" />
                )}

                <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center relative z-10">
                    {/* Missed Money - The Hero Metric */}
                    <div className="flex-1 min-w-[280px] z-30 relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg group-hover/widget:bg-red-500/20 transition-colors">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest group-hover/widget:text-gray-300 transition-colors">Missed Money</h3>
                            <div className="ml-auto flex items-center gap-1 text-xs text-neon-blue opacity-0 group-hover/widget:opacity-100 transition-opacity translate-x-2 group-hover/widget:translate-x-0">
                                View Analysis <TrendingUp className="w-3 h-3" />
                            </div>
                        </div>

                        <div className="flex flex-col items-start w-full">
                            {/* Main Amount - Responsive Text Sizing */}
                            <span className={cn(
                                "font-black tracking-tight leading-none transition-all duration-300",
                                // Dynamic sizing based on magnitude - slightly reduced to prevent overlap
                                stats.missed_money > 1000000 ? "text-3xl lg:text-4xl" :
                                    stats.missed_money > 100000 ? "text-4xl lg:text-5xl" : "text-5xl"
                                ,
                                stats.missed_money > 0 ? "text-red-500 drop-shadow-md" : "text-gray-600"
                            )}>
                                {stats.missed_money > 0 ? "-" : ""}{formatCurrency(stats.missed_money)}
                            </span>

                            {/* Badge - Forced to new line and prevented from overlapping */}
                            {stats.missed_money > 0 && (
                                <div className="mt-3 inline-flex relative z-10">
                                    <span className="inline-flex items-center text-[10px] lg:text-xs font-bold px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] whitespace-nowrap">
                                        LEFT ON TABLE
                                    </span>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 mt-4 max-w-sm leading-relaxed relative z-30">
                            Potential profit from <strong className="text-gray-300">{stats.opportunities_count - stats.executed_count}</strong> unexecuted opportunities in the last {timeframeHours}h.
                        </p>
                    </div>

                    {/* Vertical Divider - Shifted right */}
                    <div className="hidden lg:block w-px h-24 bg-dark-border/50 mx-4" />

                    {/* Opportunities Funnel - Compressed and Right Aligned */}
                    <div className="flex-1 max-w-[600px] w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <MetricBox
                            icon={Target}
                            label="OPPORTUNITIES"
                            value={stats.opportunities_count.toString()}
                            subtext="Detected"
                            color="blue"
                        />

                        <MetricBox
                            icon={Wallet}
                            label="EXECUTED"
                            value={stats.executed_count.toString()}
                            subtext="Trades Taken"
                            color="green"
                        />

                        <MetricBox
                            icon={TrendingUp}
                            label="CONVERSION"
                            value={`${efficiency}%`}
                            subtext="Efficiency Rate"
                            color={efficiency > 80 ? "green" : efficiency > 50 ? "yellow" : "red"}
                        />
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

function MetricBox({
    icon: Icon,
    label,
    value,
    subtext,
    color
}: {
    icon: any,
    label: string,
    value: string,
    subtext: string,
    color: "blue" | "green" | "yellow" | "red" | "purple"
}) {
    const colors = {
        blue: "text-neon-blue bg-neon-blue/10 border-neon-blue/20",
        green: "text-neon-green bg-neon-green/10 border-neon-green/20",
        yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
        red: "text-red-500 bg-red-500/10 border-red-500/20",
        purple: "text-neon-purple bg-neon-purple/10 border-neon-purple/20",
    };

    return (
        <div className={cn(
            "bg-dark-elem/40 border border-dark-border rounded-xl p-3 transition-all duration-300 hover:bg-dark-elem/60 group h-full flex flex-col justify-center",
        )}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("w-3.5 h-3.5", colors[color].split(" ")[0])} />
                <span className={cn("text-[9px] font-bold tracking-wider", colors[color].split(" ")[0])}>{label}</span>
            </div>
            <div className="text-xl font-bold text-white group-hover:scale-105 transition-transform origin-left my-0.5">
                {value}
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wide">{subtext}</div>
        </div>
    );
}
