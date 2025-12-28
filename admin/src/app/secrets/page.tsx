'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Lock,
  Cloud,
  Github,
  ShieldCheck,
  KeyRound,
  Upload,
  Download,
  Rocket,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { IBKRConnect } from '@/components/IBKRConnect';
import { ExchangeConnectionList } from '@/components/ExchangeConnect';

// Platform to category mapping for test connections
const TESTABLE_PLATFORMS: Record<string, string[]> = {
  prediction_markets: ['polymarket', 'kalshi'],
  crypto_exchanges: ['binance', 'coinbase'],
  stock_brokers: ['alpaca'],
};

interface ConnectionStatus {
  connected: boolean;
  balance?: number;
  error?: string;
  details?: string;
  lastChecked?: Date;
}

interface Secret {
  key_name: string;
  key_value: string | null;
  masked_value: string;
  description: string;
  category: string;
  is_configured: boolean;
  last_updated: string | null;
  synced_aws?: boolean;
  synced_github?: boolean;
}

interface CategoryInfo {
  title: string;
  icon: JSX.Element;
  color: string;
  description: string;
  signupLinks?: { name: string; url: string }[];
}

// Re-auth session timeout (5 minutes)
const REAUTH_TIMEOUT = 5 * 60 * 1000;

const CATEGORY_INFO: Record<string, CategoryInfo> = {
  prediction_markets: {
    title: 'Prediction Markets',
    icon: <span className="text-2xl">🎯</span>,
    color: 'from-purple-500/20 to-blue-500/20',
    description: 'Polymarket (0% fees) and Kalshi (7% fees on profits)',
    signupLinks: [
      { name: 'Polymarket', url: 'https://polymarket.com' },
      { name: 'Kalshi', url: 'https://kalshi.com' },
    ],
  },
  crypto_exchanges: {
    title: 'Crypto Exchanges',
    icon: <span className="text-2xl">₿</span>,
    color: 'from-orange-500/20 to-yellow-500/20',
    description: 'Connected via CCXT - You need separate accounts for each exchange',
    signupLinks: [
      { name: 'Binance', url: 'https://www.binance.com/en/register' },
      { name: 'Bybit', url: 'https://www.bybit.com/register' },
      { name: 'OKX', url: 'https://www.okx.com/account/register' },
      { name: 'Kraken', url: 'https://www.kraken.com/sign-up' },
      { name: 'Coinbase', url: 'https://www.coinbase.com/signup' },
      { name: 'KuCoin', url: 'https://www.kucoin.com/ucenter/signup' },
    ],
  },
  stock_brokers: {
    title: 'Stock Brokers',
    icon: <span className="text-2xl">📈</span>,
    color: 'from-green-500/20 to-emerald-500/20',
    description: 'Alpaca (commission-free) and Interactive Brokers',
    signupLinks: [
      { name: 'Alpaca', url: 'https://app.alpaca.markets/signup' },
      { name: 'IBKR', url: 'https://www.interactivebrokers.com/en/index.php?f=46346' },
    ],
  },
  infrastructure: {
    title: 'Infrastructure',
    icon: <span className="text-2xl">🔧</span>,
    color: 'from-gray-500/20 to-slate-500/20',
    description: 'Database and backend services',
    signupLinks: [
      { name: 'Supabase', url: 'https://supabase.com/dashboard' },
    ],
  },
  notifications: {
    title: 'Notifications',
    icon: <span className="text-2xl">🔔</span>,
    color: 'from-blue-500/20 to-cyan-500/20',
    description: 'Discord and Telegram alerts for trades',
    signupLinks: [
      { name: 'Discord Webhooks', url: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks' },
      { name: 'Telegram BotFather', url: 'https://t.me/botfather' },
    ],
  },
  data_feeds: {
    title: 'Data Feeds',
    icon: <span className="text-2xl">📰</span>,
    color: 'from-pink-500/20 to-rose-500/20',
    description: 'News and social sentiment data',
    signupLinks: [
      { name: 'Finnhub (Recommended)', url: 'https://finnhub.io/register' },
      { name: 'NewsAPI', url: 'https://newsapi.org/register' },
      { name: 'Twitter Developer', url: 'https://developer.twitter.com/en/portal/dashboard' },
    ],
  },
  news_sentiment: {
    title: 'News & Sentiment',
    icon: <span className="text-2xl">📊</span>,
    color: 'from-indigo-500/20 to-violet-500/20',
    description: 'Market news APIs and social sentiment analysis',
    signupLinks: [
      { name: 'Finnhub (Best Free)', url: 'https://finnhub.io/register' },
      { name: 'NewsAPI', url: 'https://newsapi.org/register' },
      { name: 'Twitter/X API', url: 'https://developer.twitter.com/en/portal/dashboard' },
    ],
  },
};

export default function SecretsPage() {
  const { user, isAdmin, signIn } = useAuth();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'aws' | 'github' | 'redeploy' | 'supabase' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    prediction_markets: true,
    crypto_exchanges: true,
    stock_brokers: true,
    news_sentiment: true,
    infrastructure: false,
    notifications: false,
    data_feeds: false,
  });
  
  // Tab state: 'my-connections' for users, 'admin-secrets' for admins
  const [activeTab, setActiveTab] = useState<'my-connections' | 'admin-secrets'>('my-connections');

  // Re-authentication state for sensitive operations
  const [isReauthenticated, setIsReauthenticated] = useState(false);
  const [reauthTime, setReauthTime] = useState<number | null>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);

  // Connection testing state
  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Check if reauth session is still valid
  const checkReauthValid = useCallback(() => {
    if (!reauthTime) return false;
    const elapsed = Date.now() - reauthTime;
    return elapsed < REAUTH_TIMEOUT;
  }, [reauthTime]);

  // Handle re-authentication
  const handleReauth = async () => {
    if (!user?.email) return;

    setReauthLoading(true);
    setReauthError(null);

    try {
      const result = await signIn(user.email, reauthPassword);
      if (result.error) {
        setReauthError('Invalid password. Please try again.');
      } else {
        setIsReauthenticated(true);
        setReauthTime(Date.now());
        setShowReauthModal(false);
        setReauthPassword('');
      }
    } catch {
      setReauthError('Authentication failed. Please try again.');
    } finally {
      setReauthLoading(false);
    }
  };

  // Require reauth before sensitive operations
  const requireReauth = (callback: () => void) => {
    if (checkReauthValid()) {
      callback();
    } else {
      setShowReauthModal(true);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  // Auto-expire reauth session
  useEffect(() => {
    if (reauthTime) {
      const timer = setTimeout(() => {
        setIsReauthenticated(false);
        setReauthTime(null);
      }, REAUTH_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [reauthTime]);

  const fetchSecrets = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch secrets with masked values
      const { data, error: fetchError } = await supabase
        .from('polybot_secrets')
        .select('*')
        .order('category')
        .order('key_name');

      if (fetchError) throw fetchError;

      // Transform data with masked values
      const secretsWithMasks = (data || []).map((s: any) => ({
        ...s,
        masked_value: s.key_value
          ? (s.key_value.length <= 8
            ? '********'
            : s.key_value.substring(0, 4) + '...' + s.key_value.substring(s.key_value.length - 4))
          : '',
      }));

      setSecrets(secretsWithMasks);
    } catch (err: any) {
      console.error('Error fetching secrets:', err);
      setError(err.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  };

  // Refresh secrets from Supabase (re-fetch)
  const refreshFromSupabase = async () => {
    setSyncing('supabase');
    setError(null);

    try {
      await fetchSecrets();
      const count = secrets.filter(s => s.is_configured).length;
      setSuccess(`✓ Refreshed ${count} secrets from Supabase`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh from Supabase');
    } finally {
      setSyncing(null);
    }
  };

  // Pull secrets from AWS Secrets Manager
  const pullFromAWS = async () => {
    requireReauth(async () => {
      setSyncing('aws');
      setError(null);

      try {
        const response = await fetch('/api/secrets/pull-aws', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to pull from AWS');
        }

        setSuccess(`✓ Imported ${result.imported} secrets from AWS`);
        fetchSecrets(); // Refresh the list
        setTimeout(() => setSuccess(null), 5000);
      } catch (err: any) {
        setError(err.message || 'Failed to pull from AWS');
      } finally {
        setSyncing(null);
      }
    });
  };

  // Sync secrets to AWS Secrets Manager
  const syncToAWS = async () => {
    requireReauth(async () => {
      setSyncing('aws');
      setError(null);

      try {
        const response = await fetch('/api/secrets/sync-aws', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to sync to AWS');
        }

        setSuccess(`✓ Synced ${result.synced} secrets to AWS Secrets Manager`);
        setTimeout(() => setSuccess(null), 5000);
      } catch (err: any) {
        setError(err.message || 'Failed to sync to AWS');
      } finally {
        setSyncing(null);
      }
    });
  };

  // Sync secrets to GitHub Secrets
  const syncToGitHub = async () => {
    requireReauth(async () => {
      setSyncing('github');
      setError(null);

      try {
        const response = await fetch('/api/secrets/sync-github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to sync to GitHub');
        }

        setSuccess(`✓ Synced ${result.synced} secrets to GitHub repository`);
        setTimeout(() => setSuccess(null), 5000);
      } catch (err: any) {
        setError(err.message || 'Failed to sync to GitHub');
      } finally {
        setSyncing(null);
      }
    });
  };

  // Restart bot (using new Lightsail-compatible endpoint)
  const restartBot = async (action: 'restart' | 'stop' | 'start' = 'restart') => {
    requireReauth(async () => {
      setSyncing('redeploy');
      setError(null);

      try {
        const response = await fetch('/api/bot/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Failed to ${action} bot`);
        }

        if (result.method === 'manual') {
          // Show instructions for manual restart
          setSuccess(`✓ ${result.message}\n\nManual steps:\n${result.instructions.join('\n')}`);
        } else {
          setSuccess(`✓ Bot ${action} command sent successfully!`);
        }
        setTimeout(() => setSuccess(null), 15000);
      } catch (err: any) {
        setError(err.message || `Failed to ${action} bot`);
      } finally {
        setSyncing(null);
      }
    });
  };

  // Legacy redeploy function (for backwards compatibility)
  const redeployBot = () => restartBot('restart');

  // Test connection to a platform
  const testConnection = async (platform: string) => {
    setTestingConnection(platform);
    setError(null);
    
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      
      const result = await response.json();
      
      setConnectionStatus(prev => ({
        ...prev,
        [platform]: {
          connected: result.connected,
          balance: result.balance,
          error: result.error,
          details: result.details,
          lastChecked: new Date(),
        },
      }));
      
      if (result.connected) {
        setSuccess(`✓ ${platform} connection verified${result.details ? `: ${result.details}` : ''}`);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(`${platform}: ${result.error || 'Connection failed'}`);
      }
    } catch (err: any) {
      setConnectionStatus(prev => ({
        ...prev,
        [platform]: {
          connected: false,
          error: err.message || 'Connection test failed',
          lastChecked: new Date(),
        },
      }));
      setError(`${platform}: ${err.message || 'Connection test failed'}`);
    } finally {
      setTestingConnection(null);
    }
  };

  // Test all connections in a category
  const testAllConnections = async (category: string) => {
    const platforms = TESTABLE_PLATFORMS[category];
    if (!platforms) return;
    
    for (const platform of platforms) {
      await testConnection(platform);
    }
  };

  const handleEdit = (secret: Secret) => {
    // Require re-authentication for editing secrets
    requireReauth(() => {
      setEditingKey(secret.key_name);
      setEditValue(secret.key_value || '');
    });
  };

  const handleSave = async (keyName: string) => {
    setSaving(keyName);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('polybot_secrets')
        .update({
          key_value: editValue || null,
          is_configured: editValue ? true : false,
          last_updated: new Date().toISOString(),
        })
        .eq('key_name', keyName);

      if (updateError) throw updateError;

      setSuccess(`${keyName} updated successfully`);
      setEditingKey(null);
      setEditValue('');
      fetchSecrets();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving secret:', err);
      setError(err.message || 'Failed to save secret');
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const toggleShowValue = (keyName: string) => {
    setShowValues(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const copyToClipboard = async (text: string, keyName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${keyName} copied to clipboard`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Group secrets by category
  const secretsByCategory = secrets.reduce((acc, secret) => {
    if (!acc[secret.category]) {
      acc[secret.category] = [];
    }
    acc[secret.category].push(secret);
    return acc;
  }, {} as Record<string, Secret[]>);

  // Calculate stats
  const totalSecrets = secrets.length;
  const configuredSecrets = secrets.filter(s => s.is_configured).length;
  const requiredCategories = ['prediction_markets', 'crypto_exchanges'];
  const criticalMissing = secrets.filter(
    s => requiredCategories.includes(s.category) && !s.is_configured
  ).length;

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="card bg-red-500/10 border border-red-500/30 p-6 text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-500">Access Denied</h2>
          <p className="text-gray-400 mt-2">You need admin privileges to manage API keys and secrets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Re-authentication Modal */}
      <AnimatePresence>
        {showReauthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowReauthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card max-w-md w-full p-6 bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-full bg-yellow-500/20">
                  <ShieldCheck className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Security Verification</h3>
                  <p className="text-sm text-gray-400">Re-enter your password to continue</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                For security, we require password confirmation before accessing or modifying secrets.
              </p>

              <div className="mb-4">
                <label htmlFor="reauth-password" className="sr-only">Password</label>
                <input
                  id="reauth-password"
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-neon-green"
                  onKeyDown={(e) => e.key === 'Enter' && handleReauth()}
                  autoFocus
                />
              </div>

              {reauthError && (
                <p className="text-red-500 text-sm mb-4">{reauthError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReauthModal(false);
                    setReauthPassword('');
                    setReauthError(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReauth}
                  disabled={reauthLoading || !reauthPassword}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {reauthLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Session expires after 5 minutes of inactivity
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Key className="w-8 h-8 text-neon-green" />
              API Keys & Secrets
            </h1>
            <p className="text-gray-400 mt-2">
              Manage all API credentials for trading platforms, exchanges, and services
            </p>
          </div>

          {/* Sync Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={refreshFromSupabase}
              disabled={syncing === 'supabase'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
              title="Refresh secrets from Supabase database"
            >
              {syncing === 'supabase' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Supabase
            </button>
            <button
              onClick={pullFromAWS}
              disabled={syncing === 'aws'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
              title="Import secrets from AWS Secrets Manager"
            >
              {syncing === 'aws' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Pull from AWS
            </button>
            <button
              onClick={syncToAWS}
              disabled={syncing === 'aws'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 transition-colors disabled:opacity-50"
            >
              {syncing === 'aws' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              Sync to AWS
            </button>
            <button
              onClick={syncToGitHub}
              disabled={syncing === 'github'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors disabled:opacity-50"
            >
              {syncing === 'github' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Github className="w-4 h-4" />
              )}
              Sync to GitHub
            </button>
            <button
              onClick={redeployBot}
              disabled={syncing === 'redeploy'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-green/20 hover:bg-neon-green/30 text-neon-green transition-colors disabled:opacity-50"
            >
              {syncing === 'redeploy' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              Restart Bot
            </button>
          </div>
        </div>

        {/* Session Status */}
        {isReauthenticated && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified session active</span>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="mt-6 flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('my-connections')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'my-connections'
                ? 'text-neon-green border-b-2 border-neon-green'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔗 My Exchange Connections
          </button>
          <button
            onClick={() => setActiveTab('admin-secrets')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'admin-secrets'
                ? 'text-neon-green border-b-2 border-neon-green'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔐 Admin Secrets
          </button>
        </div>
      </motion.div>

      {/* My Exchange Connections Tab */}
      {activeTab === 'my-connections' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <ExchangeConnectionList />
        </motion.div>
      )}

      {/* Admin Secrets Tab */}
      {activeTab === 'admin-secrets' && (
        <>
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-gradient-to-br from-neon-green/10 to-transparent"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Configured</p>
              <p className="text-2xl font-bold text-neon-green">
                {configuredSecrets}/{totalSecrets}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-neon-green/50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`card bg-gradient-to-br ${criticalMissing > 0 ? 'from-yellow-500/10' : 'from-green-500/10'} to-transparent`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Critical Missing</p>
              <p className={`text-2xl font-bold ${criticalMissing > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                {criticalMissing}
              </p>
            </div>
            {criticalMissing > 0 ? (
              <AlertTriangle className="w-10 h-10 text-yellow-500/50" />
            ) : (
              <Shield className="w-10 h-10 text-green-500/50" />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <button
            onClick={fetchSecrets}
            disabled={loading}
            className="w-full h-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.div>
      </div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-neon-green/10 border border-neon-green/30 rounded-xl flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-neon-green" />
            <span className="text-neon-green">{success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2"
          >
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-500">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Important Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
      >
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-blue-400 font-medium">Security Note</p>
            <p className="text-sm text-gray-400 mt-1">
              Secrets are stored in Supabase with Row Level Security. Never share your API keys.
              Each exchange/platform requires its own account and API credentials.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && secrets.length === 0 && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading secrets...</p>
        </div>
      )}

      {/* Secrets by Category */}
      {Object.entries(CATEGORY_INFO).map(([category, info], index) => {
        const categorySecrets = secretsByCategory[category] || [];
        const configuredCount = categorySecrets.filter(s => s.is_configured).length;
        const isExpanded = expandedCategories[category];

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="card mb-4"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-2 -m-2"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center`}>
                  {info.icon}
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {info.title}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${configuredCount === categorySecrets.length
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                      {configuredCount}/{categorySecrets.length}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500">{info.description}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Signup Links & Connection Test */}
            {isExpanded && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {/* Signup Links */}
                {info.signupLinks?.map(link => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-dark-border rounded-lg text-gray-400 hover:text-white hover:bg-dark-border/80 transition-colors flex items-center gap-1"
                  >
                    {link.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
                
                {/* Connection Status Indicators */}
                {TESTABLE_PLATFORMS[category]?.map(platform => {
                  const status = connectionStatus[platform];
                  return (
                    <div key={platform} className="flex items-center gap-1">
                      {status && (
                        <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                          status.connected 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {status.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {platform}
                        </span>
                      )}
                    </div>
                  );
                })}
                
                {/* Test Connection Button */}
                {TESTABLE_PLATFORMS[category] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testAllConnections(category);
                    }}
                    disabled={testingConnection !== null}
                    className="text-xs px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {testingConnection && TESTABLE_PLATFORMS[category]?.includes(testingConnection) ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        Test Connections
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* IBKR OAuth Connect - Only for stock_brokers category */}
            {isExpanded && category === 'stock_brokers' && (
              <div className="mt-4">
                <IBKRConnect 
                  onConnect={(accountId) => {
                    setSuccess(`✓ IBKR account ${accountId} connected`);
                    setTimeout(() => setSuccess(null), 5000);
                  }}
                  onDisconnect={() => {
                    setSuccess('IBKR account disconnected');
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                />
              </div>
            )}

            {/* Secrets List */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    {categorySecrets.map(secret => (
                      <div
                        key={secret.key_name}
                        className="p-4 bg-dark-border/30 rounded-xl"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono text-neon-green">
                                {secret.key_name}
                              </code>
                              {secret.is_configured ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{secret.description}</p>

                            {/* Edit Mode */}
                            {editingKey === secret.key_name ? (
                              <div className="mt-3 space-y-2">
                                <div className="relative">
                                  <input
                                    type={showValues[secret.key_name] ? 'text' : 'password'}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    placeholder="Enter value..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 pr-10 text-sm font-mono focus:outline-none focus:border-neon-green"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleShowValue(secret.key_name)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                  >
                                    {showValues[secret.key_name] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSave(secret.key_name)}
                                    disabled={saving === secret.key_name}
                                    className="px-4 py-1.5 bg-neon-green text-dark-bg rounded-lg text-sm font-medium hover:bg-neon-green/90 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {saving === secret.key_name ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancel}
                                    className="px-4 py-1.5 bg-dark-border text-gray-400 rounded-lg text-sm hover:bg-dark-border/80"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Display Mode */
                              <div className="mt-2 flex items-center gap-2">
                                {secret.is_configured ? (
                                  <>
                                    <code className="text-sm font-mono text-gray-400 bg-dark-bg px-3 py-1 rounded">
                                      {showValues[secret.key_name] ? secret.key_value : secret.masked_value}
                                    </code>
                                    <button
                                      onClick={() => toggleShowValue(secret.key_name)}
                                      className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-border/50"
                                      title={showValues[secret.key_name] ? 'Hide' : 'Show'}
                                    >
                                      {showValues[secret.key_name] ? (
                                        <EyeOff className="w-4 h-4" />
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </button>
                                    {showValues[secret.key_name] && secret.key_value && (
                                      <button
                                        onClick={() => copyToClipboard(secret.key_value!, secret.key_name)}
                                        className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-border/50"
                                        title="Copy"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-500 italic">Not configured</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Edit Button */}
                          {editingKey !== secret.key_name && (
                            <button
                              onClick={() => handleEdit(secret)}
                              className="px-3 py-1.5 bg-dark-border text-gray-400 rounded-lg text-sm hover:bg-dark-border/80 hover:text-white transition-colors"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {/* Last Updated */}
                        {secret.last_updated && secret.is_configured && (
                          <p className="text-xs text-gray-600 mt-2">
                            Updated: {new Date(secret.last_updated).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Help Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 card bg-dark-bg/50"
      >
        <h3 className="text-lg font-semibold mb-4">📚 Getting API Keys</h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>
            <strong className="text-white">Polymarket:</strong> Get API keys from{' '}
            <a href="https://docs.polymarket.com" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
              docs.polymarket.com
            </a>. You&apos;ll also need a wallet private key for trading.
          </p>
          <p>
            <strong className="text-white">Kalshi:</strong> Generate API keys from your{' '}
            <a href="https://kalshi.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
              Kalshi dashboard
            </a>. Uses RSA private key authentication.
          </p>
          <p>
            <strong className="text-white">Crypto Exchanges:</strong> CCXT is a library, not a service.
            You need to create accounts and generate API keys on each exchange individually
            (Binance, Bybit, OKX, etc.). Each will give you an API Key and Secret.
          </p>
          <p>
            <strong className="text-white">Alpaca:</strong> Sign up at{' '}
            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">
              alpaca.markets
            </a>. Use paper trading URL for testing.
          </p>
        </div>
      </motion.div>
        </>
      )}
    </div>
  );
}
