'use client';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

// Simple interface for P&L data points
interface PnLDataPoint {
  snapshot_at: string;
  total_pnl: number;
  simulated_balance: number;
  total_trades: number;
}

interface PnLChartProps {
  data: PnLDataPoint[];
}

export function PnLChart({ data }: PnLChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        <p>No data available yet. Run the bot to start collecting stats.</p>
      </div>
    );
  }

  // Check if there's only the starting point with no trades
  const hasNoTrades = data.length === 1 && data[0].total_trades === 0;
  if (hasNoTrades) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        <p>Waiting for trades to display P&L history...</p>
      </div>
    );
  }

  const chartData = data.map((stat) => ({
    time: new Date(stat.snapshot_at).getTime(),
    pnl: stat.total_pnl || 0,
    balance: stat.simulated_balance || 5000,
    trades: stat.total_trades || 0,
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#1f1f2e" 
            vertical={false}
          />
          <XAxis 
            dataKey="time"
            tickFormatter={(time) => format(new Date(time), 'HH:mm')}
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
            axisLine={{ stroke: '#1f1f2e' }}
          />
          <YAxis 
            tickFormatter={(value) => `$${value}`}
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
            axisLine={{ stroke: '#1f1f2e' }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ stroke: '#00ff88', strokeWidth: 1, strokeDasharray: '5 5' }}
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#00ff88"
            strokeWidth={2}
            fill="url(#pnlGradient)"
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-3 shadow-xl">
        <p className="text-sm text-gray-400 mb-2">
          {format(new Date(data.time), 'MMM d, HH:mm')}
        </p>
        <div className="space-y-1">
          <p className="text-sm">
            <span className="text-gray-400">P&L: </span>
            <span className={data.pnl >= 0 ? 'text-neon-green' : 'text-red-400'}>
              {formatCurrency(data.pnl)}
            </span>
          </p>
          <p className="text-sm">
            <span className="text-gray-400">Balance: </span>
            <span className="text-white">{formatCurrency(data.balance)}</span>
          </p>
          <p className="text-sm">
            <span className="text-gray-400">Trades: </span>
            <span className="text-white">{data.trades}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
}
