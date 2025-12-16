
import { useMissedMoney } from '@/lib/hooks';
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card bg-gradient-to-br from-dark-card to-dark-bg border border-dark-border p-6 mb-8 relative overflow-hidden"
    >
        {/* Background subtle glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/5 blur-[120px] rounded-full pointer-events-none" />
        {stats.missed_money > 0 && (
            <div className="absolute top-0 left-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none" />
        )}

        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
            {/* Missed Money - The Hero Metric */}
            <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Missed Money</h3>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className={cn(
                        "text-5xl font-black tracking-tight",
                        stats.missed_money > 0 ? "text-red-500 drop-shadow-lg" : "text-gray-600"
                    )}>
                        {stats.missed_money > 0 ? "-" : ""}{formatCurrency(stats.missed_money)}
                    </span>
                    {stats.missed_money > 0 && (
                        <span className="text-sm text-red-400/80 font-medium animate-pulse">
                            Left on table
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-2 pl-1 max-w-[200px]">
                    Potential profit from {stats.opportunities_count - stats.executed_count} unexecuted opportunities in the last {timeframeHours}h.
                </p>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px h-24 bg-dark-border/50" />

            {/* Opportunities Funnel */}
            <div className="flex-2 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            "bg-dark-elem/40 border border-dark-border rounded-xl p-4 transition-all duration-300 hover:bg-dark-elem/60 group",
        )}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", colors[color].split(" ")[0])} />
                <span className={cn("text-[10px] font-bold", colors[color].split(" ")[0])}>{label}</span>
            </div>
            <div className="text-2xl font-bold text-white group-hover:scale-105 transition-transform origin-left">
                {value}
            </div>
            <div className="text-[10px] text-gray-500 uppercase mt-1 tracking-wide">{subtext}</div>
        </div>
    );
}
