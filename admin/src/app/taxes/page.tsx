'use client';

import { useState, useMemo } from 'react';
import { 
  Receipt, 
  Download, 
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  AlertTriangle,
  Calculator,
  Building2,
  Clock,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  PlayCircle,
  Banknote,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface TaxTransaction {
  id: string;
  created_at: string;
  platform: string;
  market_title: string;
  position_size_usd: number;
  actual_profit_usd: number;
  fees_paid: number; // Estimated: 7% for Kalshi, 0% for Polymarket
  trade_type: string;
  strategy_type: string;
  outcome: string;
  holding_period_hours: number;
}

interface TaxSummary {
  totalGains: number;
  totalLosses: number;
  netPnL: number;
  totalFees: number;
  totalTransactions: number;
  shortTermGains: number;
  shortTermLosses: number;
  estimatedTax: number;
}

interface StrategyTaxBreakdown {
  strategy: string;
  trades: number;
  gains: number;
  losses: number;
  netPnL: number;
  winRate: number;
}

const TAX_BRACKETS_2025 = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

function calculateEstimatedTax(netGain: number): number {
  if (netGain <= 0) return 0;
  
  let tax = 0;
  let remainingIncome = netGain;
  
  for (const bracket of TAX_BRACKETS_2025) {
    if (remainingIncome <= 0) break;
    const taxableInBracket = Math.min(
      remainingIncome, 
      bracket.max - bracket.min
    );
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }
  
  return tax;
}

export default function TaxesPage() {
  const [dateRange, setDateRange] = useState<'ytd' | '2024' | '2023' | 'custom'>('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');
  const [dataMode, setDataMode] = useState<'simulated' | 'real'>('simulated');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (dateRange) {
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case '2024':
        start = new Date(2024, 0, 1);
        end = new Date(2024, 11, 31);
        break;
      case '2023':
        start = new Date(2023, 0, 1);
        end = new Date(2023, 11, 31);
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
        end = customEnd ? new Date(customEnd) : now;
        break;
      default:
        start = new Date(now.getFullYear(), 0, 1);
    }

    return { startDate: start, endDate: end };
  }, [dateRange, customStart, customEnd]);

  // Fetch transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['taxTransactions', startDate.toISOString(), endDate.toISOString(), dataMode],
    queryFn: async (): Promise<TaxTransaction[]> => {
      const tableName = dataMode === 'simulated' ? 'polybot_simulated_trades' : 'polybot_trades';
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }

      return (data || []).map((t: any) => {
        // Determine platform from trade data
        const platform = t.kalshi_ticker ? 'kalshi' : (t.polymarket_token_id ? 'polymarket' : 'unknown');
        // Estimate fees: Kalshi charges ~7% on profits, Polymarket is 0%
        const profit = parseFloat(t.actual_profit_usd) || 0;
        const estimatedFees = platform === 'kalshi' && profit > 0 ? profit * 0.07 : 0;
        
        return {
          id: t.id,
          created_at: t.created_at,
          platform,
          market_title: t.kalshi_market_title || t.polymarket_market_title || 'Unknown Market',
          position_size_usd: parseFloat(t.position_size_usd) || 0,
          actual_profit_usd: profit,
          fees_paid: estimatedFees, // Estimated based on platform
          trade_type: t.trade_type || 'arbitrage',
          strategy_type: t.strategy_type || t.trade_type || 'unknown',
          outcome: t.outcome || 'pending',
          holding_period_hours: 0, // Prediction markets resolve quickly
        };
      });
    },
  });

  // Filter by platform
  const filteredTransactions = useMemo(() => {
    if (platformFilter === 'all') return transactions;
    return transactions.filter(t => t.platform === platformFilter);
  }, [transactions, platformFilter]);

  // Calculate tax summary
  const taxSummary: TaxSummary = useMemo(() => {
    const gains = filteredTransactions
      .filter(t => t.actual_profit_usd > 0)
      .reduce((sum, t) => sum + t.actual_profit_usd, 0);
    
    const losses = filteredTransactions
      .filter(t => t.actual_profit_usd < 0)
      .reduce((sum, t) => sum + Math.abs(t.actual_profit_usd), 0);
    
    const fees = filteredTransactions
      .reduce((sum, t) => sum + (t.fees_paid || 0), 0);
    
    const netPnL = gains - losses - fees;
    
    // All prediction market trades are short-term (< 1 year holding)
    return {
      totalGains: gains,
      totalLosses: losses,
      netPnL,
      totalFees: fees,
      totalTransactions: filteredTransactions.length,
      shortTermGains: gains,
      shortTermLosses: losses,
      estimatedTax: calculateEstimatedTax(netPnL),
    };
  }, [filteredTransactions]);

  // Calculate strategy breakdown for tax purposes
  const strategyBreakdown: StrategyTaxBreakdown[] = useMemo(() => {
    const strategyMap = new Map<string, { trades: TaxTransaction[] }>();
    
    filteredTransactions.forEach(t => {
      const strategy = t.strategy_type || 'unknown';
      if (!strategyMap.has(strategy)) {
        strategyMap.set(strategy, { trades: [] });
      }
      strategyMap.get(strategy)!.trades.push(t);
    });
    
    return Array.from(strategyMap.entries())
      .map(([strategy, data]) => {
        const gains = data.trades
          .filter(t => t.actual_profit_usd > 0)
          .reduce((sum, t) => sum + t.actual_profit_usd, 0);
        const losses = data.trades
          .filter(t => t.actual_profit_usd < 0)
          .reduce((sum, t) => sum + Math.abs(t.actual_profit_usd), 0);
        const wins = data.trades.filter(t => t.outcome === 'won').length;
        const completed = data.trades.filter(t => t.outcome === 'won' || t.outcome === 'lost').length;
        
        return {
          strategy,
          trades: data.trades.length,
          gains,
          losses,
          netPnL: gains - losses,
          winRate: completed > 0 ? (wins / completed * 100) : 0,
        };
      })
      .sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTransactions]);

  // Get unique platforms for filter
  const platforms = useMemo(() => {
    const unique = new Set(transactions.map(t => t.platform));
    return ['all', ...Array.from(unique)];
  }, [transactions]);

  // Export to CSV
  const exportToCsv = () => {
    const headers = [
      'Date',
      'Platform',
      'Market',
      'Position Size (USD)',
      'Profit/Loss (USD)',
      'Fees (USD)',
      'Net (USD)',
      'Trade Type',
      'Outcome',
    ];

    const rows = filteredTransactions.map(t => [
      new Date(t.created_at).toISOString(),
      t.platform,
      `"${t.market_title.replace(/"/g, '""')}"`,
      t.position_size_usd.toFixed(2),
      t.actual_profit_usd.toFixed(2),
      (t.fees_paid || 0).toFixed(2),
      (t.actual_profit_usd - (t.fees_paid || 0)).toFixed(2),
      t.trade_type,
      t.outcome,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutroh-llc-tax-report-${dataMode}-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Form 8949 format
  const exportForm8949 = () => {
    const headers = [
      'Description of Property',
      'Date Acquired',
      'Date Sold/Disposed',
      'Proceeds',
      'Cost Basis',
      'Gain or Loss',
      'Short/Long Term',
    ];

    const rows = filteredTransactions
      .filter(t => t.outcome === 'won' || t.outcome === 'lost')
      .map(t => {
        const dateAcquired = new Date(t.created_at);
        const dateSold = new Date(t.created_at); // Same day for prediction markets
        dateSold.setHours(dateSold.getHours() + 1); // Assume 1 hour resolution
        
        const proceeds = t.position_size_usd + t.actual_profit_usd;
        const costBasis = t.position_size_usd + (t.fees_paid || 0);
        
        return [
          `"${t.platform} - ${t.market_title.substring(0, 50).replace(/"/g, '""')}"`,
          dateAcquired.toLocaleDateString('en-US'),
          dateSold.toLocaleDateString('en-US'),
          proceeds.toFixed(2),
          costBasis.toFixed(2),
          t.actual_profit_usd.toFixed(2),
          'Short-term',
        ];
      });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutroh-llc-form-8949-${dataMode}-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Receipt className="text-green-400" />
            Tax Center
            {dataMode === 'simulated' && (
              <span className="text-sm font-normal bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">
                📊 Simulated Data
              </span>
            )}
            {dataMode === 'real' && (
              <span className="text-sm font-normal bg-green-500/20 text-green-400 px-2 py-1 rounded-md">
                💵 Real Money
              </span>
            )}
          </h1>
          <p className="text-gray-400 mt-1">
            RutRoh LLC • Tax year tracking and reporting
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={exportForm8949}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Form 8949
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-yellow-200">
          <strong>Tax Disclaimer:</strong> This is an estimate only. Prediction market taxation 
          is complex and may be treated as gambling income, capital gains, or Section 1256 contracts 
          depending on circumstances. Consult a qualified tax professional for accurate filing.
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Data Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setDataMode('simulated')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === 'simulated'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Simulated
            </button>
            <button
              onClick={() => setDataMode('real')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === 'real'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Real Money
            </button>
          </div>

          <div className="h-6 w-px bg-gray-700" />

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              title="Select date range"
            >
              <option value="ytd">Year to Date (2025)</option>
              <option value="2024">Tax Year 2024</option>
              <option value="2023">Tax Year 2023</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                title="Start date"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                title="End date"
              />
            </>
          )}

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              title="Filter by platform"
            >
              {platforms.map(p => (
                <option key={p} value={p}>
                  {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card p-5 ${taxSummary.netPnL >= 0 
            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Net P&L</p>
              <p className={`text-3xl font-bold mt-1 ${taxSummary.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${taxSummary.netPnL >= 0 ? '+' : ''}{taxSummary.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {taxSummary.netPnL >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-500/50" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500/50" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{filteredTransactions.length} transactions</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Gains</p>
              <p className="text-2xl font-bold mt-1 text-green-400">
                +${taxSummary.totalGains.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Short-term capital gains</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Losses</p>
              <p className="text-2xl font-bold mt-1 text-red-400">
                -${taxSummary.totalLosses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Deductible against gains</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/30"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Est. Tax Liability</p>
              <p className="text-2xl font-bold mt-1 text-purple-400">
                ${taxSummary.estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-purple-500/50" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {taxSummary.netPnL > 0 
              ? `~${((taxSummary.estimatedTax / taxSummary.netPnL) * 100).toFixed(1)}% effective rate`
              : 'No tax on losses'}
          </p>
        </motion.div>
      </div>

      {/* Detailed Breakdown */}
      <div className="card">
        <button
          onClick={() => setExpandedSection(expandedSection === 'breakdown' ? null : 'breakdown')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="text-green-400" />
            Tax Breakdown
          </h2>
          {expandedSection === 'breakdown' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSection === 'breakdown' && (
          <div className="p-4 pt-0 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 text-gray-300">Short-Term Capital Gains</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gross Gains</span>
                    <span className="text-green-400">+${taxSummary.shortTermGains.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses (Deduction)</span>
                    <span className="text-red-400">-${taxSummary.shortTermLosses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform Fees</span>
                    <span className="text-red-400">-${taxSummary.totalFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700 font-semibold">
                    <span>Net Taxable Gain</span>
                    <span className={taxSummary.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${taxSummary.netPnL.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-3 text-gray-300">Tax Estimation (2025 Rates)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tax Bracket</span>
                    <span>
                      {taxSummary.netPnL <= 11925 ? '10%' :
                       taxSummary.netPnL <= 48475 ? '12%' :
                       taxSummary.netPnL <= 103350 ? '22%' :
                       taxSummary.netPnL <= 197300 ? '24%' :
                       taxSummary.netPnL <= 250525 ? '32%' :
                       taxSummary.netPnL <= 626350 ? '35%' : '37%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Treatment</span>
                    <span>Short-term (Ordinary Income)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700 font-semibold">
                    <span>Estimated Tax</span>
                    <span className="text-purple-400">${taxSummary.estimatedTax.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Assumes single filer, no other income. Actual tax depends on total income.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Strategy Tax Breakdown */}
      <div className="card">
        <button
          onClick={() => setExpandedSection(expandedSection === 'strategy' ? null : 'strategy')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="text-purple-400" />
            P&L by Strategy
            <span className="text-sm font-normal text-gray-400">
              ({strategyBreakdown.length} strategies)
            </span>
          </h2>
          {expandedSection === 'strategy' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSection === 'strategy' && (
          <div className="p-4 pt-0 border-t border-gray-700">
            {strategyBreakdown.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No strategy data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-2">Strategy</th>
                      <th className="text-right py-2 px-2">Trades</th>
                      <th className="text-right py-2 px-2">Gains</th>
                      <th className="text-right py-2 px-2">Losses</th>
                      <th className="text-right py-2 px-2">Net P&L</th>
                      <th className="text-right py-2 px-2">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategyBreakdown.map((s) => (
                      <tr key={s.strategy} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                        <td className="py-2 px-2 font-medium">
                          {s.strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </td>
                        <td className="text-right py-2 px-2 text-gray-400">{s.trades}</td>
                        <td className="text-right py-2 px-2 text-green-400">
                          +${s.gains.toFixed(2)}
                        </td>
                        <td className="text-right py-2 px-2 text-red-400">
                          -${s.losses.toFixed(2)}
                        </td>
                        <td className={`text-right py-2 px-2 font-medium ${s.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.netPnL >= 0 ? '+' : ''}${s.netPnL.toFixed(2)}
                        </td>
                        <td className="text-right py-2 px-2 text-blue-400">
                          {s.winRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-600 font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="text-right py-2 px-2">{taxSummary.totalTransactions}</td>
                      <td className="text-right py-2 px-2 text-green-400">
                        +${taxSummary.totalGains.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-400">
                        -${taxSummary.totalLosses.toFixed(2)}
                      </td>
                      <td className={`text-right py-2 px-2 ${taxSummary.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {taxSummary.netPnL >= 0 ? '+' : ''}${taxSummary.netPnL.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="card">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="text-blue-400" />
            Transaction History
            <span className="text-sm font-normal text-gray-400">
              ({filteredTransactions.length} transactions)
            </span>
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Market</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Position</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">P&L</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Fees</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No transactions found for this period
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 100).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString()}{' '}
                      <span className="text-gray-500">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.platform === 'kalshi' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {t.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={t.market_title}>
                      {t.market_title.substring(0, 50)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      ${t.position_size_usd.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      t.actual_profit_usd >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.actual_profit_usd >= 0 ? '+' : ''}${t.actual_profit_usd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">
                      ${(t.fees_paid || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.outcome === 'won' ? 'bg-green-500/20 text-green-400' :
                        t.outcome === 'lost' ? 'bg-red-500/20 text-red-400' :
                        t.outcome === 'failed' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {t.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredTransactions.length > 100 && (
            <div className="p-4 text-center text-sm text-gray-400 border-t border-gray-700">
              Showing first 100 of {filteredTransactions.length} transactions. 
              Export to CSV for complete list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
