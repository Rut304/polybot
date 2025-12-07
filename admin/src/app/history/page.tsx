'use client';

import { useState, useMemo } from 'react';
import { 
  History,
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Zap,
  ChevronDown,
  Play,
  Pause,
  Archive,
  Brain,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  Eye,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface SimulationSession {
  id: number;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed' | 'archived';
  starting_balance: number;
  ending_balance: number | null;
  total_pnl: number | null;
  roi_pct: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  failed_trades: number;
  win_rate: number | null;
  strategies_used: Record<string, number>;
  strategy_performance: Record<string, { pnl: number; trades: number; win_rate: number }>;
  config_snapshot: Record<string, unknown>;
  ai_analysis: string | null;
  ai_recommendations: Array<{
    id: string;
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    implementation: string;
    implemented: boolean;
  }>;
  analysis_generated_at: string | null;
  notes: string | null;
}

interface SessionTrade {
  id: number;
  session_id: string;
  original_trade_id: number;
  position_id: string;
  created_at: string;
  platform: string;
  market_id: string;
  market_title: string;
  trade_type: string;
  arbitrage_type: string;
  side: string;
  position_size_usd: number;
  yes_price: number;
  no_price: number;
  expected_profit_pct: number;
  expected_profit_usd: number;
  actual_profit_usd: number;
  outcome: string;
  resolution_notes: string;
  resolved_at: string;
}

// Fetch simulation sessions
async function fetchSessions(): Promise<SimulationSession[]> {
  const { data, error } = await supabase
    .from('polybot_simulation_sessions')
    .select('*')
    .order('started_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Fetch trades for a session
async function fetchSessionTrades(sessionId: string): Promise<SessionTrade[]> {
  const { data, error } = await supabase
    .from('polybot_session_trades')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Save current simulation as a new session
async function saveCurrentSession(notes?: string) {
  const response = await fetch('/api/simulation/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  
  if (!response.ok) throw new Error('Failed to save session');
  return response.json();
}

// Generate AI analysis for a session
async function generateAnalysis(sessionId: string) {
  const response = await fetch('/api/simulation/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  
  if (!response.ok) throw new Error('Failed to generate analysis');
  return response.json();
}

// Implement all recommendations
async function implementRecommendations(sessionId: string) {
  const response = await fetch('/api/simulation/analyze', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, action: 'implement_all' }),
  });
  
  if (!response.ok) throw new Error('Failed to implement recommendations');
  return response.json();
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium border',
      colors[status as keyof typeof colors] || colors.archived
    )}>
      {status}
    </span>
  );
}

function ROIBadge({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-gray-500">-</span>;
  
  const isPositive = roi >= 0;
  return (
    <span className={cn(
      'flex items-center gap-1 font-mono font-semibold',
      isPositive ? 'text-neon-green' : 'text-red-400'
    )}>
      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {formatPercent(roi)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-medium border',
      colors[priority as keyof typeof colors] || colors.low
    )}>
      {priority}
    </span>
  );
}

function SessionCard({ 
  session, 
  isSelected, 
  onSelect, 
  onAnalyze 
}: { 
  session: SimulationSession;
  isSelected: boolean;
  onSelect: () => void;
  onAnalyze: () => void;
}) {
  const duration = session.ended_at 
    ? formatDistanceToNow(new Date(session.started_at), { addSuffix: false })
    : 'In Progress';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-dark-card/50 backdrop-blur-xl border rounded-xl p-4 cursor-pointer transition-all hover:border-neon-green/50',
        isSelected ? 'border-neon-green ring-2 ring-neon-green/20' : 'border-dark-border'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={session.status} />
            <span className="text-xs text-gray-500">
              {format(new Date(session.started_at), 'MMM dd, yyyy HH:mm')}
            </span>
          </div>
          <p className="text-sm text-gray-400">Duration: {duration}</p>
        </div>
        <ROIBadge roi={session.roi_pct} />
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">P&L</p>
          <p className={cn(
            'font-mono font-semibold',
            (session.total_pnl || 0) >= 0 ? 'text-neon-green' : 'text-red-400'
          )}>
            {formatCurrency(session.total_pnl || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Trades</p>
          <p className="font-mono text-white">{session.total_trades}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Win Rate</p>
          <p className="font-mono text-white">{session.win_rate?.toFixed(1) || 0}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Balance</p>
          <p className="font-mono text-white">{formatCurrency(session.ending_balance || session.starting_balance)}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-dark-border">
        <div className="flex items-center gap-2">
          {session.ai_analysis ? (
            <span className="flex items-center gap-1 text-xs text-purple-400">
              <Brain className="w-3 h-3" />
              AI Analyzed
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-400 transition-colors"
            >
              <Brain className="w-3 h-3" />
              Generate Analysis
            </button>
          )}
        </div>
        
        {session.notes && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <FileText className="w-3 h-3" />
            Notes
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SessionDetail({ 
  session, 
  trades, 
  isLoadingTrades,
  onAnalyze,
  onImplementAll,
  isAnalyzing,
  isImplementing,
}: { 
  session: SimulationSession;
  trades: SessionTrade[];
  isLoadingTrades: boolean;
  onAnalyze: () => void;
  onImplementAll: () => void;
  isAnalyzing: boolean;
  isImplementing: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'analysis'>('overview');
  
  const strategyStats = useMemo(() => {
    return Object.entries(session.strategy_performance || {}).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [session.strategy_performance]);
  
  // CSV Export function
  const exportToCSV = () => {
    if (trades.length === 0) return;
    
    const headers = [
      'Trade ID', 'Date', 'Platform', 'Market', 'Strategy', 'Side', 
      'Position Size', 'Entry Price', 'Expected Profit %', 'Actual Profit', 'Outcome'
    ];
    
    const rows = trades.map(t => [
      t.position_id,
      format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
      t.platform,
      t.market_title || t.market_id,
      t.arbitrage_type,
      t.side,
      t.position_size_usd.toFixed(2),
      t.yes_price?.toFixed(2) || '',
      t.expected_profit_pct?.toFixed(2) || '',
      t.actual_profit_usd?.toFixed(2) || '',
      t.outcome
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.session_id.slice(0,8)}-trades.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export session summary
  const exportSessionSummary = () => {
    const summary = {
      session_id: session.session_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      status: session.status,
      starting_balance: session.starting_balance,
      ending_balance: session.ending_balance,
      total_pnl: session.total_pnl,
      roi_pct: session.roi_pct,
      total_trades: session.total_trades,
      winning_trades: session.winning_trades,
      losing_trades: session.losing_trades,
      win_rate: session.win_rate,
      strategy_performance: session.strategy_performance,
      ai_analysis: session.ai_analysis,
      ai_recommendations: session.ai_recommendations,
      notes: session.notes,
    };
    
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.session_id.slice(0,8)}-summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="bg-dark-card/50 backdrop-blur-xl border border-dark-border rounded-xl overflow-hidden">
      {/* Header with Export Buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-bg/30">
        <span className="text-sm text-gray-400">
          Session: {session.session_id.slice(0,8)}...
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={trades.length === 0}
            className="px-3 py-1.5 text-xs bg-dark-border hover:bg-dark-border/80 text-gray-300 rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Export trades to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={exportSessionSummary}
            className="px-3 py-1.5 text-xs bg-dark-border hover:bg-dark-border/80 text-gray-300 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Export session summary to JSON"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        {['overview', 'trades', 'analysis'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors capitalize',
              activeTab === tab 
                ? 'text-white bg-dark-border/50 border-b-2 border-neon-green' 
                : 'text-gray-400 hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-dark-bg/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Starting Balance</p>
                  <p className="text-xl font-mono text-white">{formatCurrency(session.starting_balance)}</p>
                </div>
                <div className="bg-dark-bg/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Ending Balance</p>
                  <p className={cn(
                    'text-xl font-mono',
                    (session.ending_balance || 0) >= session.starting_balance ? 'text-neon-green' : 'text-red-400'
                  )}>
                    {formatCurrency(session.ending_balance || session.starting_balance)}
                  </p>
                </div>
                <div className="bg-dark-bg/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Total P&L</p>
                  <p className={cn(
                    'text-xl font-mono',
                    (session.total_pnl || 0) >= 0 ? 'text-neon-green' : 'text-red-400'
                  )}>
                    {formatCurrency(session.total_pnl || 0)}
                  </p>
                </div>
                <div className="bg-dark-bg/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">ROI</p>
                  <ROIBadge roi={session.roi_pct} />
                </div>
              </div>
              
              {/* Trade Stats */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Trade Statistics</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-mono text-white">{session.total_trades}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-mono text-neon-green">{session.winning_trades}</p>
                    <p className="text-xs text-gray-500">Won</p>
                  </div>
                  <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-mono text-red-400">{session.losing_trades}</p>
                    <p className="text-xs text-gray-500">Lost</p>
                  </div>
                  <div className="bg-dark-bg/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-mono text-yellow-400">{session.failed_trades}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                </div>
              </div>
              
              {/* Strategy Performance */}
              {strategyStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Strategy Performance</h3>
                  <div className="space-y-2">
                    {strategyStats.map((strat) => (
                      <div key={strat.name} className="bg-dark-bg/50 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-sm text-white">{strat.name}</span>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className={cn(
                              'font-mono text-sm',
                              strat.pnl >= 0 ? 'text-neon-green' : 'text-red-400'
                            )}>
                              {formatCurrency(strat.pnl)}
                            </p>
                            <p className="text-xs text-gray-500">P&L</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-white">{strat.trades}</p>
                            <p className="text-xs text-gray-500">Trades</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-white">{strat.win_rate?.toFixed(1) || 0}%</p>
                            <p className="text-xs text-gray-500">Win Rate</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Notes */}
              {session.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Notes</h3>
                  <p className="text-sm text-gray-400 bg-dark-bg/50 rounded-lg p-3">{session.notes}</p>
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'trades' && (
            <motion.div
              key="trades"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {isLoadingTrades ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : trades.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No trades archived for this session</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {trades.map((trade) => (
                    <div key={trade.id} className="bg-dark-bg/50 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{trade.market_title || trade.market_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{trade.platform}</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">{trade.arbitrage_type}</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">{format(new Date(trade.created_at), 'MMM dd HH:mm')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <p className="font-mono text-sm text-white">{formatCurrency(trade.position_size_usd)}</p>
                          <p className="text-xs text-gray-500">Size</p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            'font-mono text-sm',
                            trade.outcome === 'won' ? 'text-neon-green' : 
                            trade.outcome === 'lost' ? 'text-red-400' : 'text-yellow-400'
                          )}>
                            {trade.actual_profit_usd ? formatCurrency(trade.actual_profit_usd) : '-'}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{trade.outcome}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {!session.ai_analysis ? (
                <div className="text-center py-12">
                  <Brain className="w-16 h-16 text-purple-500/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">AI Analysis Not Generated</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Generate an AI-powered analysis of this simulation session to get insights and recommendations.
                  </p>
                  <button
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        Generate AI Analysis
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {/* Analysis Text */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      AI Analysis
                    </h3>
                    <div className="bg-dark-bg/50 rounded-lg p-4">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{session.ai_analysis}</p>
                      {session.analysis_generated_at && (
                        <p className="text-xs text-gray-500 mt-3">
                          Generated {formatDistanceToNow(new Date(session.analysis_generated_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Recommendations */}
                  {session.ai_recommendations && session.ai_recommendations.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          Recommendations ({session.ai_recommendations.length})
                        </h3>
                        <button
                          onClick={onImplementAll}
                          disabled={isImplementing}
                          className="px-4 py-2 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg text-sm font-medium hover:bg-neon-green/30 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isImplementing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Implementing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Implement All
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {session.ai_recommendations.map((rec, index) => (
                          <div key={rec.id || index} className={cn(
                            'bg-dark-bg/50 rounded-lg p-4 border-l-4',
                            rec.priority === 'high' ? 'border-red-500' :
                            rec.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                          )}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <PriorityBadge priority={rec.priority} />
                                <span className="text-xs text-gray-500 capitalize">{rec.type}</span>
                                {rec.implemented && (
                                  <span className="flex items-center gap-1 text-xs text-neon-green">
                                    <CheckCircle className="w-3 h-3" />
                                    Implemented
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-sm font-medium text-white mb-1">{rec.title}</h4>
                            <p className="text-sm text-gray-400 mb-2">{rec.description}</p>
                            <details className="text-xs">
                              <summary className="text-purple-400 cursor-pointer hover:text-purple-300">
                                Implementation details
                              </summary>
                              <pre className="mt-2 p-2 bg-dark-bg rounded text-gray-400 overflow-x-auto">
                                {rec.implementation}
                              </pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Regenerate Button */}
                  <button
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                    className="w-full py-3 border border-dark-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Regenerate Analysis
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [saveNotes, setSaveNotes] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  // Fetch sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['simulation-sessions'],
    queryFn: fetchSessions,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Find selected session
  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);
  
  // Fetch trades for selected session
  const { data: sessionTrades = [], isLoading: isLoadingTrades } = useQuery({
    queryKey: ['session-trades', selectedSessionId],
    queryFn: () => selectedSessionId ? fetchSessionTrades(selectedSessionId) : Promise.resolve([]),
    enabled: !!selectedSessionId,
  });
  
  // Save session mutation
  const saveMutation = useMutation({
    mutationFn: () => saveCurrentSession(saveNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulation-sessions'] });
      setShowSaveModal(false);
      setSaveNotes('');
    },
  });
  
  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: (sessionId: string) => generateAnalysis(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulation-sessions'] });
    },
  });
  
  // Implement all mutation
  const implementMutation = useMutation({
    mutationFn: (sessionId: string) => implementRecommendations(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulation-sessions'] });
    },
  });
  
  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <History className="w-7 h-7 text-neon-green" />
              Simulation History
            </h1>
            <p className="text-gray-400 mt-1">Review past simulations and get AI-powered insights</p>
          </div>
          
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg font-medium hover:bg-neon-green/30 transition-colors flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            Save Current Session
          </button>
        </div>
        
        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Past Sessions ({sessions.length})
            </h2>
            
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-dark-card/50 border border-dark-border rounded-xl p-8 text-center">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No saved sessions yet</p>
                <p className="text-sm text-gray-500">Save your current simulation to start tracking history</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto pr-2">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.session_id}
                    session={session}
                    isSelected={selectedSessionId === session.session_id}
                    onSelect={() => setSelectedSessionId(session.session_id)}
                    onAnalyze={() => analyzeMutation.mutate(session.session_id)}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Session Detail */}
          <div className="lg:col-span-2">
            {selectedSession ? (
              <SessionDetail
                session={selectedSession}
                trades={sessionTrades}
                isLoadingTrades={isLoadingTrades}
                onAnalyze={() => analyzeMutation.mutate(selectedSession.session_id)}
                onImplementAll={() => implementMutation.mutate(selectedSession.session_id)}
                isAnalyzing={analyzeMutation.isPending}
                isImplementing={implementMutation.isPending}
              />
            ) : (
              <div className="bg-dark-card/50 border border-dark-border rounded-xl p-12 text-center">
                <Eye className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Select a Session</h3>
                <p className="text-gray-400">
                  Click on a session from the list to view details and AI analysis
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Save Modal */}
        <AnimatePresence>
          {showSaveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
              onClick={() => setShowSaveModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-neon-green" />
                  Save Current Simulation
                </h3>
                
                <p className="text-sm text-gray-400 mb-4">
                  This will archive the current simulation session including all trades and metrics.
                </p>
                
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Add notes about this session (optional)..."
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:border-neon-green focus:outline-none resize-none h-24"
                />
                
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-2 border border-dark-border rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex-1 py-2 bg-neon-green text-dark-bg rounded-lg font-medium hover:bg-neon-green/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Save Session
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
