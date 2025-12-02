'use client';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Opportunity } from '@/lib/supabase';
import { useMemo } from 'react';

interface OpportunityChartProps {
  data: Opportunity[];
}

export function OpportunityChart({ data }: OpportunityChartProps) {
  // Group opportunities by profit range
  const chartData = useMemo(() => {
    const ranges = [
      { name: '0-0.5%', min: 0, max: 0.5, count: 0, color: '#666' },
      { name: '0.5-1%', min: 0.5, max: 1, count: 0, color: '#fbbf24' },
      { name: '1-2%', min: 1, max: 2, count: 0, color: '#00d4ff' },
      { name: '2-3%', min: 2, max: 3, count: 0, color: '#8b5cf6' },
      { name: '3-5%', min: 3, max: 5, count: 0, color: '#00ff88' },
      { name: '5%+', min: 5, max: 100, count: 0, color: '#ff0080' },
    ];

    data.forEach((opp) => {
      const profit = opp.profit_percent || 0;
      const range = ranges.find((r) => profit >= r.min && profit < r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        <p>No opportunities data yet</p>
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#1f1f2e" 
            vertical={false}
          />
          <XAxis 
            dataKey="name"
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
            axisLine={{ stroke: '#1f1f2e' }}
          />
          <YAxis 
            stroke="#666"
            tick={{ fill: '#666', fontSize: 12 }}
            axisLine={{ stroke: '#1f1f2e' }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar 
            dataKey="count" 
            radius={[4, 4, 0, 0]}
            animationDuration={500}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-white mb-1">{data.name} Profit Range</p>
        <p className="text-sm">
          <span className="text-gray-400">Count: </span>
          <span className="text-white">{data.count} opportunities</span>
        </p>
      </div>
    );
  }
  return null;
}
