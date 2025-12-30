'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bug,
  Clock,
  Filter,
  Search,
  Download,
  Loader2,
  ChevronDown,
  Terminal,
  Database,
  Shield,
  Zap,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface LogEntry {
  id: string;
  created_at: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  logger: string;
  message: string;
  context?: Record<string, unknown>;
  user_id?: string;
  session_id?: string;
}

interface SupabaseLogEntry {
  id: string;
  timestamp: string;
  event_message: string;
  metadata?: {
    request?: { method?: string; path?: string };
    response?: { status_code?: number };
  };
}

type TabType = 'bot' | 'supabase' | 'security';

export default function LogsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('bot');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [supabaseLogs, setSupabaseLogs] = useState<SupabaseLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'debug' | 'info' | 'warning' | 'error' | 'critical'>('all');
  const [limit, setLimit] = useState(100);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchBotLogs = useCallback(async () => {
    if (!user) return;
    
    try {
      setRefreshing(true);
      
      // Try polybot_bot_logs first, fall back to polybot_logs, then audit_logs
      let { data, error: logsError } = await supabase
        .from('polybot_bot_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (logsError) {
        // Fallback to polybot_logs
        const { data: altData, error: altError } = await supabase
          .from('polybot_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (!altError) {
          data = altData;
        } else {
          // Final fallback to audit_logs
          const { data: auditData, error: auditError } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          
          if (auditError) throw auditError;
          data = auditData;
        }
      }
      
      setLogs(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bot logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, limit]);

  // Note: Supabase logs require the Management API which uses your project's service role
  // In production, you'd proxy this through a backend API endpoint
  const fetchSupabaseLogs = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // For now, we'll show a placeholder since Supabase logs require Management API
      // In production, create an API route that uses SUPABASE_SERVICE_ROLE_KEY
      // to fetch from: https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all
      
      // Simulate some log entries for UI demonstration
      setSupabaseLogs([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Supabase logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (activeTab === 'bot') {
      await fetchBotLogs();
    } else if (activeTab === 'supabase') {
      await fetchSupabaseLogs();
    } else {
      await fetchBotLogs(); // Security tab also uses bot logs filtered
    }
  }, [activeTab, fetchBotLogs, fetchSupabaseLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Filter logs based on active tab
  const filteredLogs = (activeTab === 'security' 
    ? logs.filter(l => l.level === 'error' || l.level === 'critical' || l.logger?.includes('auth') || l.logger?.includes('security'))
    : logs
  ).filter(log => {
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.logger?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <Bug className="w-4 h-4 text-gray-400" />;
      case 'info': return <Info className="w-4 h-4 text-blue-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-600 animate-pulse" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'debug': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      case 'info': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'warning': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'error': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'critical': return 'bg-red-600/20 text-red-500 border-red-500/50';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const downloadLogs = () => {
    const content = filteredLogs.map(log => 
      `[${log.created_at}] [${log.level?.toUpperCase()}] [${log.logger}] ${log.message}${log.context ? '\n' + JSON.stringify(log.context, null, 2) : ''}`
    ).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polybot-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const stats = {
    total: logs.length,
    errors: logs.filter(l => l.level === 'error' || l.level === 'critical').length,
    warnings: logs.filter(l => l.level === 'warning').length,
    info: logs.filter(l => l.level === 'info').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Terminal className="text-green-400" />
              System Logs
            </h1>
            <p className="text-gray-400 mt-1">
              Monitor bot activity, database, and security events
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                autoRefresh 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Clock className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Auto-refresh'}
            </button>
            <button
              onClick={downloadLogs}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={fetchLogs}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'bot'
                ? 'bg-green-600 text-white'
                : 'bg-dark-card hover:bg-white/10 text-gray-400'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Bot Logs
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'supabase'
                ? 'bg-emerald-600 text-white'
                : 'bg-dark-card hover:bg-white/10 text-gray-400'
            }`}
          >
            <Database className="w-4 h-4" />
            Supabase Logs
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'security'
                ? 'bg-red-600 text-white'
                : 'bg-dark-card hover:bg-white/10 text-gray-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            Security Events
            {stats.errors > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {stats.errors}
              </span>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-dark-card rounded-xl p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Logs</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-red-500/30">
            <div className="text-gray-400 text-sm mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-400">{stats.errors}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-yellow-500/30">
            <div className="text-gray-400 text-sm mb-1">Warnings</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.warnings}</div>
          </div>
          <div className="bg-dark-card rounded-xl p-4 border border-blue-500/30">
            <div className="text-gray-400 text-sm mb-1">Info</div>
            <div className="text-2xl font-bold text-blue-400">{stats.info}</div>
          </div>
        </div>

        {/* Supabase Tab Content */}
        {activeTab === 'supabase' && (
          <div className="bg-dark-card rounded-xl border border-white/10 p-8 mb-8">
            <div className="text-center">
              <Database className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Supabase Dashboard Logs</h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                For detailed database logs, API requests, and auth events, access the Supabase Dashboard directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://supabase.com/dashboard/project/_/logs/explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  <Activity className="w-5 h-5" />
                  Open Logs Explorer
                </a>
                <a
                  href="https://supabase.com/dashboard/project/_/database/security-advisors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Shield className="w-5 h-5" />
                  Security Advisor
                </a>
              </div>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-dark-bg p-4 rounded-lg">
                  <h4 className="font-medium text-emerald-400 mb-2">📊 API Logs</h4>
                  <p className="text-sm text-gray-400">View all API requests, response times, and errors from your frontend and bot.</p>
                </div>
                <div className="bg-dark-bg p-4 rounded-lg">
                  <h4 className="font-medium text-blue-400 mb-2">🔐 Auth Logs</h4>
                  <p className="text-sm text-gray-400">Track sign-ins, sign-ups, password resets, and authentication failures.</p>
                </div>
                <div className="bg-dark-bg p-4 rounded-lg">
                  <h4 className="font-medium text-purple-400 mb-2">🗄️ Database Logs</h4>
                  <p className="text-sm text-gray-400">Monitor slow queries, connection issues, and database performance.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab Extra Info */}
        {activeTab === 'security' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400">Security Event Monitor</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Showing authentication events, errors, and critical system alerts. 
                  Review these regularly to detect unauthorized access attempts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters - show for bot and security tabs */}
        {activeTab !== 'supabase' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
                className="px-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                aria-label="Filter by log level"
              >
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
              
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="px-4 py-2 bg-dark-card border border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                aria-label="Number of logs to show"
              >
                <option value="50">Last 50</option>
                <option value="100">Last 100</option>
                <option value="250">Last 250</option>
                <option value="500">Last 500</option>
              </select>
            </div>

            {/* Logs List */}
            <div className="bg-dark-card rounded-xl border border-white/10 overflow-hidden">
              {error && (
                <div className="p-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              <div className="divide-y divide-white/5">
                <AnimatePresence>
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No logs found</p>
                      <p className="text-sm mt-1">Logs will appear here when the bot runs</p>
                    </div>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className={`p-4 hover:bg-white/5 transition-colors ${
                          log.level === 'error' || log.level === 'critical' ? 'bg-red-500/5' : ''
                        }`}
                      >
                        <div 
                          className="flex items-start gap-4 cursor-pointer"
                          onClick={() => toggleExpand(log.id)}
                        >
                          {/* Level indicator */}
                          <div className={`p-2 rounded-lg ${getLevelClass(log.level)}`}>
                            {getLevelIcon(log.level)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-medium ${getLevelClass(log.level)}`}>
                                {log.level}
                              </span>
                              {log.logger && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {log.logger}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {formatTime(log.created_at)}
                              </span>
                            </div>
                            <p className={`text-sm ${log.level === 'error' || log.level === 'critical' ? 'text-red-300' : 'text-gray-300'}`}>
                              {log.message}
                            </p>
                          </div>
                          
                          {/* Expand indicator */}
                          {log.context && (
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${
                              expandedLogs.has(log.id) ? 'rotate-180' : ''
                            }`} />
                          )}
                        </div>
                        
                        {/* Expanded context */}
                        {expandedLogs.has(log.id) && log.context && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mt-3 ml-14"
                          >
                            <pre className="text-xs bg-dark-bg p-3 rounded-lg overflow-x-auto text-gray-400 font-mono">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Helpful info */}
            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-blue-400 mb-1">Troubleshooting Tips</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Check <strong>Error</strong> logs first for issues</li>
                    <li>Look for patterns in <strong>Warning</strong> logs before errors occur</li>
                    <li>Use search to filter by strategy name or market</li>
                    <li>Enable <strong>Auto-refresh</strong> to monitor live bot activity</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
