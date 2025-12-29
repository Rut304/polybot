'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi,
  LineStyle,
  CrosshairMode,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  SeriesType,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';

// Strategy colors - vibrant and distinguishable
const STRATEGY_COLORS: Record<string, string> = {
  'cross_platform_arb': '#22c55e',        // Green
  'polymarket_single_platform': '#8b5cf6', // Purple
  'kalshi_single_platform': '#3b82f6',    // Blue
  'rsi_strategy': '#f59e0b',              // Amber
  'mean_reversion': '#ec4899',            // Pink
  'momentum': '#06b6d4',                  // Cyan
  'dividend_growth': '#84cc16',           // Lime
  'whale_copy_trading': '#f97316',        // Orange
  'congressional_tracker': '#14b8a6',     // Teal
  'stock_mean_reversion': '#a855f7',      // Violet
  'manual_stock_trade': '#ef4444',        // Red
  'default': '#6b7280',                   // Gray
};

interface ChartDataPoint {
  time: string; // YYYY-MM-DD format
  value: number;
}

interface StrategyChartData {
  strategy: string;
  data: ChartDataPoint[];
  color?: string;
}

interface TradingViewChartProps {
  title?: string;
  data: StrategyChartData[];
  height?: number;
  showLegend?: boolean;
  chartType?: 'line' | 'area' | 'baseline';
  className?: string;
}

export function TradingViewChart({
  title,
  data,
  height = 400,
  showLegend = true,
  chartType = 'line',
  className,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const [hoveredStrategy, setHoveredStrategy] = useState<string | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create the chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(55, 65, 81, 0.5)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(55, 65, 81, 0.5)', style: LineStyle.Dotted },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          width: 1,
          color: 'rgba(139, 92, 246, 0.5)',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#8b5cf6',
        },
        horzLine: {
          width: 1,
          color: 'rgba(139, 92, 246, 0.5)',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#8b5cf6',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Add series for each strategy using v5 API
    data.forEach(({ strategy, data: seriesData, color }) => {
      const seriesColor = color || STRATEGY_COLORS[strategy] || STRATEGY_COLORS.default;
      
      let series: ISeriesApi<SeriesType>;
      
      if (chartType === 'area') {
        series = chart.addSeries(AreaSeries, {
          lineColor: seriesColor,
          topColor: `${seriesColor}40`,
          bottomColor: `${seriesColor}05`,
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });
      } else if (chartType === 'baseline') {
        series = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 0 },
          topLineColor: '#22c55e',
          topFillColor1: 'rgba(34, 197, 94, 0.3)',
          topFillColor2: 'rgba(34, 197, 94, 0.05)',
          bottomLineColor: '#ef4444',
          bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.3)',
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });
      } else {
        series = chart.addSeries(LineSeries, {
          color: seriesColor,
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: seriesColor,
          crosshairMarkerBackgroundColor: '#1f2937',
        });
      }
      
      // Convert data to chart format
      const chartData = seriesData
        .filter(d => d.time && !isNaN(d.value))
        .map(d => ({
          time: d.time as `${number}-${number}-${number}`,
          value: d.value,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));
      
      if (chartData.length > 0) {
        series.setData(chartData);
      }
      
      seriesRefs.current.set(strategy, series);
    });

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRefs.current.clear();
    };
  }, [data, height, chartType]);

  // Handle legend hover
  const handleLegendHover = (strategy: string | null) => {
    setHoveredStrategy(strategy);
    
    seriesRefs.current.forEach((series, key) => {
      if (strategy === null) {
        // Reset all to full opacity
        series.applyOptions({ 
          lineWidth: 2,
        });
      } else if (key === strategy) {
        // Highlight hovered
        series.applyOptions({ 
          lineWidth: 3,
        });
      } else {
        // Dim others
        series.applyOptions({ 
          lineWidth: 1,
        });
      }
    });
  };

  return (
    <div className={cn("relative", className)}>
      {title && (
        <h3 className="text-lg font-bold mb-4 text-white">{title}</h3>
      )}
      
      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" />
      
      {/* Legend */}
      {showLegend && data.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {data.map(({ strategy, color }) => {
            const seriesColor = color || STRATEGY_COLORS[strategy] || STRATEGY_COLORS.default;
            return (
              <button
                key={strategy}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm",
                  hoveredStrategy === strategy 
                    ? "bg-dark-border" 
                    : "hover:bg-dark-border/50",
                  hoveredStrategy && hoveredStrategy !== strategy && "opacity-50"
                )}
                onMouseEnter={() => handleLegendHover(strategy)}
                onMouseLeave={() => handleLegendHover(null)}
              >
                <span 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: seriesColor }}
                />
                <span className="text-gray-300">
                  {formatStrategyName(strategy)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Format strategy name for display
function formatStrategyName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace('Polymarket', 'PM')
    .replace('Kalshi', 'K')
    .replace('Single Platform', 'Single')
    .replace('Cross Platform', 'Cross');
}

// ============================================================================
// CUMULATIVE P&L CHART - Shows running total over time
// ============================================================================

interface CumulativePnLChartProps {
  trades: Array<{
    created_at: string;
    actual_profit_usd?: number;
    strategy?: string;
  }>;
  height?: number;
  showByStrategy?: boolean;
  className?: string;
}

export function CumulativePnLChart({
  trades,
  height = 400,
  showByStrategy = true,
  className,
}: CumulativePnLChartProps) {
  // Process trades into cumulative P&L data
  const chartData = processTradesIntoCumulativePnL(trades, showByStrategy);
  
  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <p className="text-gray-500">No trade data available</p>
      </div>
    );
  }

  return (
    <TradingViewChart
      title="📈 Cumulative P&L Over Time"
      data={chartData}
      height={height}
      chartType={showByStrategy ? 'line' : 'baseline'}
      showLegend={showByStrategy}
      className={className}
    />
  );
}

function processTradesIntoCumulativePnL(
  trades: Array<{
    created_at: string;
    actual_profit_usd?: number;
    strategy?: string;
  }>,
  byStrategy: boolean
): StrategyChartData[] {
  if (trades.length === 0) return [];

  // Sort trades by date
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (!byStrategy) {
    // Single cumulative line
    let cumulative = 0;
    const dataPoints: ChartDataPoint[] = [];
    const dailyPnl: Record<string, number> = {};

    sortedTrades.forEach(trade => {
      const date = new Date(trade.created_at).toISOString().split('T')[0];
      const pnl = trade.actual_profit_usd || 0;
      dailyPnl[date] = (dailyPnl[date] || 0) + pnl;
    });

    Object.entries(dailyPnl)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, pnl]) => {
        cumulative += pnl;
        dataPoints.push({ time: date, value: cumulative });
      });

    return [{ strategy: 'total', data: dataPoints }];
  }

  // Group by strategy
  const strategies = [...new Set(sortedTrades.map(t => t.strategy || 'unknown'))];
  const runningTotals: Record<string, number> = {};
  const dailyDataByStrategy: Record<string, Record<string, number>> = {};

  // Initialize
  strategies.forEach(s => {
    runningTotals[s] = 0;
    dailyDataByStrategy[s] = {};
  });

  // Process each trade
  sortedTrades.forEach(trade => {
    const strategy = trade.strategy || 'unknown';
    const date = new Date(trade.created_at).toISOString().split('T')[0];
    const pnl = trade.actual_profit_usd || 0;

    runningTotals[strategy] += pnl;
    dailyDataByStrategy[strategy][date] = runningTotals[strategy];
  });

  // Forward-fill missing dates for each strategy
  const allDates = [...new Set(sortedTrades.map(t => 
    new Date(t.created_at).toISOString().split('T')[0]
  ))].sort();

  return strategies.map(strategy => {
    let lastValue = 0;
    const data: ChartDataPoint[] = allDates.map(date => {
      if (dailyDataByStrategy[strategy][date] !== undefined) {
        lastValue = dailyDataByStrategy[strategy][date];
      }
      return { time: date, value: lastValue };
    });

    return {
      strategy,
      data,
      color: STRATEGY_COLORS[strategy] || STRATEGY_COLORS.default,
    };
  }).filter(s => s.data.some(d => d.value !== 0)); // Only include strategies with activity
}

// ============================================================================
// DAILY P&L CHART - Shows daily gains/losses
// ============================================================================

interface DailyPnLChartProps {
  trades: Array<{
    created_at: string;
    actual_profit_usd?: number;
  }>;
  height?: number;
  className?: string;
}

export function DailyPnLChart({
  trades,
  height = 300,
  className,
}: DailyPnLChartProps) {
  // Process trades into daily P&L data
  const dailyPnl: Record<string, number> = {};

  trades.forEach(trade => {
    const date = new Date(trade.created_at).toISOString().split('T')[0];
    dailyPnl[date] = (dailyPnl[date] || 0) + (trade.actual_profit_usd || 0);
  });

  const data: ChartDataPoint[] = Object.entries(dailyPnl)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ time: date, value: pnl }));

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <p className="text-gray-500">No trade data available</p>
      </div>
    );
  }

  return (
    <TradingViewChart
      title="📊 Daily P&L"
      data={[{ strategy: 'daily', data }]}
      height={height}
      chartType="baseline"
      showLegend={false}
      className={className}
    />
  );
}

export { STRATEGY_COLORS };
