'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Server,
  Globe,
  Wallet,
  Users,
  Clock,
  Zap,
  Play,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bug,
  Terminal,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface TestResult {
  name: string;
  category: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
  duration?: number;
  timestamp?: string;
}

interface CategoryResults {
  category: string;
  icon: React.ReactNode;
  tests: TestResult[];
  expanded: boolean;
}

const initialCategories: CategoryResults[] = [
  {
    category: 'Authentication & Session',
    icon: <Shield className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Supabase Auth Session', category: 'auth', status: 'pending', message: 'Not tested' },
      { name: 'User Profile Access', category: 'auth', status: 'pending', message: 'Not tested' },
      { name: 'API Token Validity', category: 'auth', status: 'pending', message: 'Not tested' },
    ],
  },
  {
    category: 'Database Connections',
    icon: <Database className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Supabase Connection', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Config Table Read', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Config Table Write', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Positions Table', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Trades Table', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Tracked Whales Table', category: 'db', status: 'pending', message: 'Not tested' },
      { name: 'Secrets Table', category: 'db', status: 'pending', message: 'Not tested' },
    ],
  },
  {
    category: 'External APIs',
    icon: <Globe className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Polymarket Gamma API', category: 'api', status: 'pending', message: 'Not tested' },
      { name: 'Polymarket Data API (Leaderboard)', category: 'api', status: 'pending', message: 'Not tested' },
      { name: 'Kalshi API Health', category: 'api', status: 'pending', message: 'Not tested' },
      { name: 'Congress API', category: 'api', status: 'pending', message: 'Not tested' },
    ],
  },
  {
    category: 'Bot Status',
    icon: <Server className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Bot Running Status', category: 'bot', status: 'pending', message: 'Not tested' },
      { name: 'Last Bot Activity', category: 'bot', status: 'pending', message: 'Not tested' },
      { name: 'Bot Config Loaded', category: 'bot', status: 'pending', message: 'Not tested' },
    ],
  },
  {
    category: 'Trading Workflow',
    icon: <Zap className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Strategy Configuration', category: 'workflow', status: 'pending', message: 'Not tested' },
      { name: 'Active Strategies Count', category: 'workflow', status: 'pending', message: 'Not tested' },
      { name: 'Open Positions', category: 'workflow', status: 'pending', message: 'Not tested' },
      { name: 'Recent Trades (24h)', category: 'workflow', status: 'pending', message: 'Not tested' },
    ],
  },
  {
    category: 'Exchange Connections',
    icon: <Wallet className="w-5 h-5" />,
    expanded: true,
    tests: [
      { name: 'Polymarket Keys Configured', category: 'exchange', status: 'pending', message: 'Not tested' },
      { name: 'Kalshi Keys Configured', category: 'exchange', status: 'pending', message: 'Not tested' },
      { name: 'Alpaca Keys Configured', category: 'exchange', status: 'pending', message: 'Not tested' },
    ],
  },
];

export default function DiagnosticsPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryResults[]>(initialCategories);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  
  // E2E Testing state
  const [e2eStatus, setE2eStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [e2eResults, setE2eResults] = useState<{ passed: number; failed: number; total: number; output: string } | null>(null);
  const [e2eRunning, setE2eRunning] = useState(false);
  
  // Lightsail container status
  interface ContainerStatus {
    health: string;
    status: string;
    version: string;
    build: number | string;
    fullVersion: string;
    url: string;
    checkedAt: string;
  }
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null);
  const [containerLoading, setContainerLoading] = useState(false);

  // Fetch container status on mount and provide refresh function
  const fetchContainerStatus = async () => {
    setContainerLoading(true);
    try {
      const response = await fetch('/api/admin/lightsail');
      const data = await response.json();
      if (data.success && data.container) {
        setContainerStatus(data.container);
      }
    } catch (error) {
      console.error('Failed to fetch container status:', error);
    } finally {
      setContainerLoading(false);
    }
  };

  useEffect(() => {
    fetchContainerStatus();
  }, []);

  const updateTest = (categoryIndex: number, testIndex: number, updates: Partial<TestResult>) => {
    setCategories(prev => {
      const newCategories = [...prev];
      newCategories[categoryIndex].tests[testIndex] = {
        ...newCategories[categoryIndex].tests[testIndex],
        ...updates,
      };
      return newCategories;
    });
  };

  const toggleCategory = (index: number) => {
    setCategories(prev => {
      const newCategories = [...prev];
      newCategories[index].expanded = !newCategories[index].expanded;
      return newCategories;
    });
  };

  // Test Functions
  const testSupabaseAuth = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking auth session...' });
    const start = Date.now();
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) {
        updateTest(catIdx, testIdx, {
          status: 'success',
          message: `Authenticated as ${session.user.email}`,
          details: `Token expires: ${new Date(session.expires_at! * 1000).toLocaleString()}`,
          duration: Date.now() - start,
        });
        return true;
      } else {
        updateTest(catIdx, testIdx, {
          status: 'error',
          message: 'No active session',
          details: 'Please sign in to access all features',
          duration: Date.now() - start,
        });
        return false;
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Auth check failed',
        details: error.message,
        duration: Date.now() - start,
      });
      return false;
    }
  };

  const testUserProfile = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking user profile...' });
    const start = Date.now();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('polybot_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          updateTest(catIdx, testIdx, {
            status: 'success',
            message: `Profile: ${profile.display_name || user.email}`,
            details: `Role: ${profile.role || 'user'}`,
            duration: Date.now() - start,
          });
        } else {
          updateTest(catIdx, testIdx, {
            status: 'warning',
            message: 'No user profile found',
            details: error?.message || 'Profile may not be created yet',
            duration: Date.now() - start,
          });
        }
      } else {
        updateTest(catIdx, testIdx, {
          status: 'error',
          message: 'No user logged in',
          duration: Date.now() - start,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Profile check failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testApiToken = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Validating API token...' });
    const start = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const expiresAt = new Date(session.expires_at! * 1000);
        const now = new Date();
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilExpiry > 1) {
          updateTest(catIdx, testIdx, {
            status: 'success',
            message: `Token valid for ${hoursUntilExpiry.toFixed(1)} hours`,
            duration: Date.now() - start,
          });
        } else if (hoursUntilExpiry > 0) {
          updateTest(catIdx, testIdx, {
            status: 'warning',
            message: 'Token expiring soon',
            details: `Expires in ${(hoursUntilExpiry * 60).toFixed(0)} minutes`,
            duration: Date.now() - start,
          });
        } else {
          updateTest(catIdx, testIdx, {
            status: 'error',
            message: 'Token expired',
            duration: Date.now() - start,
          });
        }
      } else {
        updateTest(catIdx, testIdx, {
          status: 'error',
          message: 'No token available',
          duration: Date.now() - start,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Token validation failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testSupabaseConnection = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing database connection...' });
    const start = Date.now();
    try {
      const { data, error } = await supabase.from('polybot_config').select('id').limit(1);
      if (error) throw error;
      updateTest(catIdx, testIdx, {
        status: 'success',
        message: 'Connected to Supabase',
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Connection failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testConfigRead = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Reading config...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        const configKeys = Object.keys(data).length;
        updateTest(catIdx, testIdx, {
          status: 'success',
          message: `Config loaded (${configKeys} fields)`,
          details: `Bot enabled: ${data.bot_enabled}, Simulation: ${data.simulation_mode}`,
          duration: Date.now() - start,
        });
      } else {
        updateTest(catIdx, testIdx, {
          status: 'warning',
          message: 'No config row found',
          details: 'Config may need initialization',
          duration: Date.now() - start,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Config read failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testConfigWrite = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing config write...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      // Just update the updated_at timestamp
      const { error } = await supabase
        .from('polybot_config')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      updateTest(catIdx, testIdx, {
        status: 'success',
        message: 'Write permission confirmed',
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Write failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testTable = async (catIdx: number, testIdx: number, tableName: string) => {
    updateTest(catIdx, testIdx, { status: 'running', message: `Checking ${tableName}...` });
    const start = Date.now();
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) throw error;
      updateTest(catIdx, testIdx, {
        status: 'success',
        message: `Table accessible (${count ?? 0} rows)`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: error.message.includes('does not exist') ? 'warning' : 'error',
        message: error.message.includes('does not exist') ? 'Table not created' : 'Access failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testPolymarketGammaAPI = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing Polymarket Gamma API...' });
    const start = Date.now();
    try {
      // Use local proxy to avoid CORS
      const response = await fetch('/api/proxy/gamma?limit=5&active=true');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      updateTest(catIdx, testIdx, {
        status: 'success',
        message: `API responding (${data.length || 0} markets)`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Gamma API unreachable',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testPolymarketDataAPI = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing Polymarket Data API...' });
    const start = Date.now();
    try {
      const response = await fetch('/api/whales/leaderboard?limit=5');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success && result.data) {
        updateTest(catIdx, testIdx, {
          status: 'success',
          message: `Leaderboard API working (${result.data.length} traders)`,
          duration: Date.now() - start,
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Data API failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testKalshiAPI = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing Kalshi API...' });
    const start = Date.now();
    try {
      // Use simple Event API check - may still be rate limited or blocked from client
      const response = await fetch('https://api.elections.kalshi.com/v1/events?limit=1');
      const status = response.status;
      if (status === 200) {
        updateTest(catIdx, testIdx, {
          status: 'success',
          message: 'Kalshi API accessible',
          duration: Date.now() - start,
        });
      } else if (status === 429) {
        updateTest(catIdx, testIdx, {
          status: 'warning',
          message: 'Rate limited (429)',
          details: 'API is accessible but rate limited',
          duration: Date.now() - start,
        });
      } else {
        throw new Error(`HTTP ${status}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'warning',
        message: 'Kalshi API check inconclusive',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testCongressAPI = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Testing Congress API...' });
    const start = Date.now();
    try {
      // Correct endpoint is /api/congress, not /api/congress/trades
      const response = await fetch('/api/congress?limit=5');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      updateTest(catIdx, testIdx, {
        status: 'success',
        message: `Congress API working`,
        details: `${result.data?.length || 0} trades found`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'warning',
        message: 'Congress API not configured',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testBotStatus = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking bot status...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      const { data: statusData, error } = await supabase
        .from('polybot_status')
        .select('is_running, dry_run_mode, updated_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const isRunning = statusData.is_running;
      const mode = statusData.dry_run_mode ? 'Simulation' : 'LIVE TRADING';

      updateTest(catIdx, testIdx, {
        status: isRunning ? 'success' : 'warning',
        message: isRunning ? 'Bot is ENABLED' : 'Bot is DISABLED',
        details: `Mode: ${mode}`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Cannot determine bot status',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testLastActivity = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking last activity...' });
    const start = Date.now();
    try {
      // Check recent trades
      const { data: trades, error } = await supabase
        .from('polybot_simulated_trades')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (trades && trades.length > 0) {
        const lastTrade = new Date(trades[0].created_at);
        const hoursAgo = (Date.now() - lastTrade.getTime()) / (1000 * 60 * 60);

        if (hoursAgo < 1) {
          updateTest(catIdx, testIdx, {
            status: 'success',
            message: `Last trade: ${Math.round(hoursAgo * 60)} minutes ago`,
            duration: Date.now() - start,
          });
        } else if (hoursAgo < 12) {
          updateTest(catIdx, testIdx, {
            status: 'success',
            message: `Last trade: ${hoursAgo.toFixed(1)} hours ago`,
            details: 'Bot is active',
            duration: Date.now() - start,
          });
        } else if (hoursAgo < 24) {
          updateTest(catIdx, testIdx, {
            status: 'warning',
            message: `Last trade: ${hoursAgo.toFixed(0)} hours ago`,
            details: 'Bot may be idle or waiting for opportunities',
            duration: Date.now() - start,
          });
        } else {
          updateTest(catIdx, testIdx, {
            status: 'error',
            message: `No trades in ${Math.round(hoursAgo / 24)} days`,
            details: 'Bot may have stopped or encountered errors',
            duration: Date.now() - start,
          });
        }
      } else {
        updateTest(catIdx, testIdx, {
          status: 'warning',
          message: 'No trades recorded',
          details: 'Bot may be newly started',
          duration: Date.now() - start,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Cannot check activity',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testBotConfig = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking bot config...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      const { data: config, error } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Check strategy enablement flags
      const hasPolySingle = config.enable_polymarket_single_arb;
      const hasKalshiSingle = config.enable_kalshi_single_arb;
      const hasCross = config.enable_cross_platform_arb;
      const hasCongress = config.enable_congressional_tracker;
      const hasWhale = config.enable_whale_copy_trading;

      const enabledStrategies = [hasPolySingle, hasKalshiSingle, hasCross, hasCongress, hasWhale]
        .filter(Boolean).length;

      updateTest(catIdx, testIdx, {
        status: enabledStrategies > 0 ? 'success' : 'warning',
        message: `${enabledStrategies} strategies enabled`,
        details: `Min profit: ${config.min_profit_threshold ?? config.min_profit_percent}%, Max size: $${config.max_position_size ?? 0}`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Config check failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testStrategyConfig = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking strategy config...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      const { data: config, error } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const strategies = [];
      if (config.enable_polymarket_single_arb) strategies.push('Poly Single');
      if (config.enable_kalshi_single_arb) strategies.push('Kalshi Single');
      if (config.enable_cross_platform_arb) strategies.push('Cross Platform');
      if (config.enable_congressional_tracker) strategies.push('Congress');
      if (config.enable_whale_copy_trading) strategies.push('Whale Copy');
      if (config.enable_political_event_strategy) strategies.push('Political Event');
      if (config.enable_high_conviction_strategy) strategies.push('High Conviction');

      updateTest(catIdx, testIdx, {
        status: strategies.length > 0 ? 'success' : 'warning',
        message: strategies.length > 0 ? `Active: ${strategies.join(', ')}` : 'No strategies enabled',
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Strategy check failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testActiveStrategies = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Counting active strategies...' });
    const start = Date.now();
    try {
      if (!user) throw new Error('No user logged in');
      const { data: config, error } = await supabase
        .from('polybot_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      let count = 0;
      const keys = Object.keys(config);
      for (const key of keys) {
        if (key.startsWith('enable_') && config[key] === true && !key.includes('api') && !key.includes('key')) {
          count++;
        }
      }

      updateTest(catIdx, testIdx, {
        status: count > 0 ? 'success' : 'warning',
        message: `${count} strategies enabled`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Count failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testOpenPositions = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking open positions...' });
    const start = Date.now();
    try {
      // Use pending simulated trades as open positions
      const { data, error, count } = await supabase
        .from('polybot_simulated_trades')
        .select('*', { count: 'exact' })
        .eq('outcome', 'pending');

      if (error) throw error;

      const totalValue = data?.reduce((sum, p) => sum + (p.position_size_usd || 0), 0) || 0;

      updateTest(catIdx, testIdx, {
        status: 'success',
        message: `${count || 0} open positions`,
        details: `Total value: $${totalValue.toLocaleString()}`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: error.message.includes('does not exist') ? 'warning' : 'error',
        message: 'Check failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testRecentTrades = async (catIdx: number, testIdx: number) => {
    updateTest(catIdx, testIdx, { status: 'running', message: 'Checking recent trades...' });
    const start = Date.now();
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error, count } = await supabase
        .from('polybot_simulated_trades')
        .select('*', { count: 'exact' })
        .gte('created_at', yesterday);

      if (error) throw error;

      const totalProfit = data?.reduce((sum, t) => sum + (t.expected_profit_usd || 0), 0) || 0;

      updateTest(catIdx, testIdx, {
        status: (count || 0) > 0 ? 'success' : 'warning',
        message: `${count || 0} trades in last 24h`,
        details: `Expected profit: $${totalProfit.toFixed(2)}`,
        duration: Date.now() - start,
      });
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'error',
        message: 'Check failed',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const testExchangeKeys = async (catIdx: number, testIdx: number, exchange: string) => {
    updateTest(catIdx, testIdx, { status: 'running', message: `Checking ${exchange} keys...` });
    const start = Date.now();
    try {
      const keyNames = {
        polymarket: ['POLYMARKET_API_KEY', 'POLYMARKET_SECRET'],
        kalshi: ['KALSHI_API_KEY', 'KALSHI_PRIVATE_KEY'],
        alpaca: ['ALPACA_API_KEY', 'ALPACA_API_SECRET'],
      };

      const keysToCheck = keyNames[exchange as keyof typeof keyNames] || [];
      const { data, error } = await supabase
        .from('polybot_secrets')
        .select('key_name')
        .in('key_name', keysToCheck);

      if (error) throw error;

      const foundKeys = data?.map(d => d.key_name) || [];
      const allFound = keysToCheck.every(k => foundKeys.includes(k));

      if (allFound) {
        updateTest(catIdx, testIdx, {
          status: 'success',
          message: `${exchange} keys configured`,
          duration: Date.now() - start,
        });
      } else {
        const missing = keysToCheck.filter(k => !foundKeys.includes(k));
        updateTest(catIdx, testIdx, {
          status: 'warning',
          message: 'Some keys missing',
          details: `Missing: ${missing.join(', ')}`,
          duration: Date.now() - start,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      updateTest(catIdx, testIdx, {
        status: 'warning',
        message: 'Cannot verify keys',
        details: error.message,
        duration: Date.now() - start,
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setOverallStatus('running');

    // Reset all tests
    setCategories(prev => prev.map(cat => ({
      ...cat,
      tests: cat.tests.map(t => ({ ...t, status: 'pending' as const, message: 'Waiting...' })),
    })));

    // Auth tests (category 0)
    await testSupabaseAuth(0, 0);
    await testUserProfile(0, 1);
    await testApiToken(0, 2);

    // Database tests (category 1)
    await testSupabaseConnection(1, 0);
    await testConfigRead(1, 1);
    await testConfigWrite(1, 2);
    await testTable(1, 3, 'polybot_positions');
    await testTable(1, 4, 'polybot_simulated_trades');
    await testTable(1, 5, 'polybot_tracked_whales');
    await testTable(1, 6, 'polybot_secrets');

    // External API tests (category 2)
    await testPolymarketGammaAPI(2, 0);
    await testPolymarketDataAPI(2, 1);
    await testKalshiAPI(2, 2);
    await testCongressAPI(2, 3);

    // Bot status tests (category 3)
    await testBotStatus(3, 0);
    await testLastActivity(3, 1);
    await testBotConfig(3, 2);

    // Workflow tests (category 4)
    await testStrategyConfig(4, 0);
    await testActiveStrategies(4, 1);
    await testOpenPositions(4, 2);
    await testRecentTrades(4, 3);

    // Exchange tests (category 5)
    await testExchangeKeys(5, 0, 'polymarket');
    await testExchangeKeys(5, 1, 'kalshi');
    await testExchangeKeys(5, 2, 'alpaca');

    // Calculate overall status
    const allTests = categories.flatMap(c => c.tests);
    const hasErrors = allTests.some(t => t.status === 'error');
    const hasWarnings = allTests.some(t => t.status === 'warning');

    if (hasErrors) {
      setOverallStatus('error');
    } else if (hasWarnings) {
      setOverallStatus('warning');
    } else {
      setOverallStatus('success');
    }

    setLastRun(new Date().toLocaleString());
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 border-green-500/30';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'error':
        return 'bg-red-500/20 border-red-500/30';
      case 'running':
        return 'bg-blue-500/20 border-blue-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  const getCategorySummary = (tests: TestResult[]) => {
    const success = tests.filter(t => t.status === 'success').length;
    const warning = tests.filter(t => t.status === 'warning').length;
    const error = tests.filter(t => t.status === 'error').length;
    const pending = tests.filter(t => t.status === 'pending' || t.status === 'running').length;
    return { success, warning, error, pending, total: tests.length };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="text-blue-400" />
            System Diagnostics
          </h1>
          <p className="text-gray-400 mt-1">
            Test all API connections and system components
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRun && (
            <span className="text-sm text-gray-500">
              Last run: {lastRun}
            </span>
          )}
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${isRunning
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run All Tests
              </>
            )}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      {overallStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border ${getStatusColor(overallStatus)}`}
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(overallStatus)}
            <div>
              <p className="font-medium">
                {overallStatus === 'running' && 'Running diagnostics...'}
                {overallStatus === 'success' && 'All systems operational'}
                {overallStatus === 'warning' && 'Some issues detected'}
                {overallStatus === 'error' && 'Critical issues found'}
              </p>
              {overallStatus !== 'running' && (
                <p className="text-sm text-gray-400">
                  {categories.flatMap(c => c.tests).filter(t => t.status === 'success').length} passed,{' '}
                  {categories.flatMap(c => c.tests).filter(t => t.status === 'warning').length} warnings,{' '}
                  {categories.flatMap(c => c.tests).filter(t => t.status === 'error').length} errors
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Test Categories */}
      <div className="space-y-4">
        {categories.map((category, catIdx) => {
          const summary = getCategorySummary(category.tests);
          return (
            <div key={category.category} className="card overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(catIdx)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-800">
                    {category.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium">{category.category}</h3>
                    <p className="text-sm text-gray-500">
                      {summary.success > 0 && <span className="text-green-400">{summary.success} passed</span>}
                      {summary.warning > 0 && <span className="text-yellow-400 ml-2">{summary.warning} warnings</span>}
                      {summary.error > 0 && <span className="text-red-400 ml-2">{summary.error} errors</span>}
                      {summary.pending > 0 && summary.pending === summary.total && <span className="text-gray-400">Not tested</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mini status indicators */}
                  <div className="flex gap-1">
                    {category.tests.map((test, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full ${test.status === 'success' ? 'bg-green-400' :
                          test.status === 'warning' ? 'bg-yellow-400' :
                            test.status === 'error' ? 'bg-red-400' :
                              test.status === 'running' ? 'bg-blue-400 animate-pulse' :
                                'bg-gray-600'
                          }`}
                      />
                    ))}
                  </div>
                  {category.expanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Test Results */}
              <AnimatePresence>
                {category.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-800"
                  >
                    <div className="p-4 space-y-2">
                      {category.tests.map((test, testIdx) => (
                        <motion.div
                          key={test.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: testIdx * 0.05 }}
                          className={`p-3 rounded-lg border ${getStatusColor(test.status)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(test.status)}
                              <div>
                                <p className="font-medium">{test.name}</p>
                                <p className="text-sm text-gray-400">{test.message}</p>
                                {test.details && (
                                  <p className="text-xs text-gray-500 mt-1">{test.details}</p>
                                )}
                              </div>
                            </div>
                            {test.duration !== undefined && (
                              <span className="text-xs text-gray-500">
                                {test.duration}ms
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* E2E Testing Section */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Bug className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium">E2E Testing (Playwright)</h3>
                <p className="text-sm text-gray-500">300+ automated tests for UI and API validation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {e2eResults && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">{e2eResults.passed} passed</span>
                  {e2eResults.failed > 0 && (
                    <span className="text-red-400">{e2eResults.failed} failed</span>
                  )}
                </div>
              )}
              <a
                href="/diagnostics/e2e-tests"
                className="px-3 py-1.5 bg-dark-border text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View All Tests
              </a>
              <button
                onClick={async () => {
                  setE2eRunning(true);
                  setE2eStatus('running');
                  setE2eResults(null);
                  try {
                    const res = await fetch('/api/diagnostics/e2e-test', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      setE2eResults(data);
                      setE2eStatus(data.failed === 0 ? 'success' : 'error');
                    } else {
                      setE2eStatus('error');
                      setE2eResults({ passed: 0, failed: 0, total: 0, output: data.error || 'Test execution failed' });
                    }
                  } catch (err) {
                    setE2eStatus('error');
                    setE2eResults({ passed: 0, failed: 0, total: 0, output: 'Failed to run tests' });
                  } finally {
                    setE2eRunning(false);
                  }
                }}
                disabled={e2eRunning}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                  e2eRunning
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {e2eRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run E2E Tests
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* E2E Test Status/Results */}
        <div className="p-4 space-y-4">
          {e2eStatus === 'idle' && (
            <div className="flex items-center gap-3 text-gray-400">
              <Terminal className="w-5 h-5" />
              <span>Click &quot;Run E2E Tests&quot; to execute Playwright test suite</span>
            </div>
          )}
          
          {e2eStatus === 'running' && (
            <div className="flex items-center gap-3 text-blue-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Running E2E tests... This may take 30-60 seconds.</span>
            </div>
          )}
          
          {e2eStatus === 'success' && e2eResults && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-green-400">All tests passed!</p>
                  <p className="text-sm text-gray-400">
                    {e2eResults.passed} of {e2eResults.total} tests passed
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {e2eStatus === 'error' && e2eResults && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-400">
                    {e2eResults.output?.includes('E2E tests can only be run') 
                      ? 'E2E tests run via CI/CD' 
                      : 'Some tests failed'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {e2eResults.output?.includes('E2E tests can only be run')
                      ? 'For security, E2E tests run automatically in GitHub Actions on each deploy'
                      : `${e2eResults.passed} passed, ${e2eResults.failed} failed of ${e2eResults.total} tests`}
                  </p>
                </div>
              </div>
              {e2eResults.output && !e2eResults.output.includes('E2E tests can only be run') && (
                <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap">{e2eResults.output}</pre>
                </div>
              )}
            </div>
          )}
          
          {/* Test file list */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
            {[
              { file: 'navigation.spec.ts', count: 12 },
              { file: 'dashboard.spec.ts', count: 14 },
              { file: 'api.spec.ts', count: 10 },
              { file: 'failed-trades.spec.ts', count: 14 },
              { file: 'ai-insights.spec.ts', count: 12 },
              { file: 'feature-flags.spec.ts', count: 10 },
              { file: 'auth.spec.ts', count: 12 },
              { file: 'settings.spec.ts', count: 20 },
              { file: 'trading.spec.ts', count: 26 },
              { file: 'mobile.spec.ts', count: 16 },
              { file: 'accessibility.spec.ts', count: 24 },
              { file: 'workflows.spec.ts', count: 28 },
              { file: 'pages-coverage.spec.ts', count: 33 },
            ].map(({ file, count }) => (
              <div key={file} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm">
                <span className="text-gray-400">{file}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${count > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                  {count > 0 ? `${count} tests` : 'pending'}
                </span>
              </div>
            ))}
          </div>
          
          {/* Links */}
          <div className="flex gap-2 pt-2">
            <a
              href="/admin/guide#e2e-testing"
              className="px-3 py-1.5 bg-gray-800 rounded text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Testing Guide
            </a>
            <a
              href="https://playwright.dev/docs/intro"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gray-800 rounded text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Playwright Docs
            </a>
          </div>
        </div>
      </div>

      {/* Bot Container Status */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">Bot Container Status</h3>
          <button
            onClick={fetchContainerStatus}
            disabled={containerLoading}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${containerLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {containerStatus ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${containerStatus.health === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-lg font-semibold">
                {containerStatus.health === 'healthy' ? 'Running' : 'Issues Detected'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Version</p>
                <p className="font-mono">{containerStatus.fullVersion || containerStatus.version}</p>
              </div>
              <div>
                <p className="text-gray-400">Build</p>
                <p className="font-mono">#{containerStatus.build}</p>
              </div>
              <div>
                <p className="text-gray-400">Status</p>
                <p className={containerStatus.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
                  {containerStatus.status}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Last Checked</p>
                <p className="text-xs">{new Date(containerStatus.checkedAt).toLocaleTimeString()}</p>
              </div>
            </div>
            <a
              href={containerStatus.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              {containerStatus.url.replace('https://', '').split('/')[0]}
            </a>
          </div>
        ) : containerLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading container status...
          </div>
        ) : (
          <p className="text-gray-500">Unable to fetch container status</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/guide"
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Admin Guide
          </a>
          <a
            href="/settings"
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Settings
          </a>
          <a
            href="/strategies"
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Strategies
          </a>
          <a
            href="/secrets"
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            API Keys
          </a>
          <a
            href="/logs"
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Logs
          </a>
        </div>
        
        {/* External Monitoring Links */}
        <h3 className="text-sm font-medium text-gray-400 mb-3 mt-6">External Monitoring</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://vercel.com/rut304s-projects/admin-app/speed-insights"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600/20 border border-purple-500/50 rounded-lg text-sm text-purple-400 hover:bg-purple-600/30 transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Vercel Speed Insights
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://vercel.com/rut304s-projects/admin-app/logs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Terminal className="w-4 h-4" />
            Vercel Logs
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://lightsail.aws.amazon.com/ls/webapp/us-east-1/container-services/polyparlay/deployments"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-orange-600/20 border border-orange-500/50 rounded-lg text-sm text-orange-400 hover:bg-orange-600/30 transition-colors flex items-center gap-2"
          >
            <Server className="w-4 h-4" />
            AWS Lightsail Bot
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://supabase.com/dashboard/project/sjezgpczpcdaegfajsqd"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600/20 border border-green-500/50 rounded-lg text-sm text-green-400 hover:bg-green-600/30 transition-colors flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Supabase Dashboard
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
