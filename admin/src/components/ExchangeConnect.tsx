'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Key,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// Exchange configurations
const EXCHANGE_CONFIG: Record<string, {
  name: string;
  icon: string;
  color: string;
  signupUrl: string;
  docsUrl: string;
  requiresPassword: boolean;
  description: string;
}> = {
  alpaca: {
    name: 'Alpaca',
    icon: '🦙',
    color: 'bg-yellow-500',
    signupUrl: 'https://app.alpaca.markets/signup',
    docsUrl: 'https://docs.alpaca.markets/docs/getting-started',
    requiresPassword: false,
    description: 'Commission-free stock & crypto trading',
  },
  binance: {
    name: 'Binance',
    icon: '🟡',
    color: 'bg-yellow-400',
    signupUrl: 'https://www.binance.us/register',
    docsUrl: 'https://www.binance.us/en/support/faq',
    requiresPassword: false,
    description: 'Leading crypto exchange',
  },
  coinbase: {
    name: 'Coinbase',
    icon: '🔵',
    color: 'bg-blue-500',
    signupUrl: 'https://www.coinbase.com/signup',
    docsUrl: 'https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/sign-in-with-coinbase-getting-started',
    requiresPassword: false,
    description: 'Popular crypto exchange',
  },
  kraken: {
    name: 'Kraken',
    icon: '🐙',
    color: 'bg-purple-500',
    signupUrl: 'https://www.kraken.com/sign-up',
    docsUrl: 'https://docs.kraken.com/api/',
    requiresPassword: false,
    description: 'Secure crypto trading',
  },
  kucoin: {
    name: 'KuCoin',
    icon: '🟢',
    color: 'bg-green-500',
    signupUrl: 'https://www.kucoin.com/ucenter/signup',
    docsUrl: 'https://docs.kucoin.com/',
    requiresPassword: true,
    description: 'Global crypto exchange (needs passphrase)',
  },
  okx: {
    name: 'OKX',
    icon: '⚪',
    color: 'bg-gray-700',
    signupUrl: 'https://www.okx.com/account/register',
    docsUrl: 'https://www.okx.com/docs-v5/en/',
    requiresPassword: true,
    description: 'Advanced crypto trading (needs passphrase)',
  },
  bybit: {
    name: 'Bybit',
    icon: '🟠',
    color: 'bg-orange-500',
    signupUrl: 'https://www.bybit.com/register',
    docsUrl: 'https://bybit-exchange.github.io/docs/',
    requiresPassword: false,
    description: 'Derivatives & spot trading',
  },
  webull: {
    name: 'Webull',
    icon: '🐂',
    color: 'bg-blue-600',
    signupUrl: 'https://www.webull.com/activity?invite_code=',
    docsUrl: 'https://www.webull.com/help',
    requiresPassword: true, // Needs trading PIN
    description: 'Commission-free trading with extended hours',
  },
  hyperliquid: {
    name: 'Hyperliquid',
    icon: '💧',
    color: 'bg-cyan-500',
    signupUrl: 'https://app.hyperliquid.xyz',
    docsUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/',
    requiresPassword: false,
    description: 'Decentralized perpetuals exchange on Arbitrum',
  },
};

interface ExchangeCredential {
  exchange: string;
  account_id: string | null;
  is_paper: boolean;
  connected: boolean;
  last_authenticated: string | null;
}

interface ExchangeConnectProps {
  exchange: string;
  onStatusChange?: (connected: boolean) => void;
  className?: string;
}

export function ExchangeConnect({ exchange, onStatusChange, className }: ExchangeConnectProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ExchangeCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Form fields
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [password, setPassword] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  const config = EXCHANGE_CONFIG[exchange] || {
    name: exchange,
    icon: '🔗',
    color: 'bg-gray-500',
    signupUrl: '#',
    docsUrl: '#',
    requiresPassword: false,
    description: 'Exchange',
  };

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const res = await fetch('/api/user-credentials');
      if (!res.ok) throw new Error('Failed to fetch credentials');
      
      const data = await res.json();
      const cred = data.credentials?.find((c: ExchangeCredential) => c.exchange === exchange);
      setStatus(cred || { exchange, connected: false, is_paper: true, account_id: null, last_authenticated: null });
    } catch (err) {
      console.error('Error fetching credentials:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, exchange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Save credentials
  const handleSave = async () => {
    if (!apiKey) {
      setError('API Key is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/user-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          api_key: apiKey,
          api_secret: apiSecret,
          password: config.requiresPassword ? password : undefined,
          is_paper: isPaper,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      // Success - update status
      setStatus({
        exchange,
        connected: true,
        is_paper: isPaper,
        account_id: data.credential?.account_id,
        last_authenticated: new Date().toISOString(),
      });
      
      setShowForm(false);
      setApiKey('');
      setApiSecret('');
      setPassword('');
      onStatusChange?.(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${config.name}? You'll need to re-enter your API keys to reconnect.`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/user-credentials?exchange=${exchange}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to disconnect');

      setStatus({
        exchange,
        connected: false,
        is_paper: true,
        account_id: null,
        last_authenticated: null,
      });
      onStatusChange?.(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-4 rounded-lg border border-gray-700 bg-gray-800/50', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-400">Loading {config.name}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', config.color)}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-medium text-white">{config.name}</h3>
            <p className="text-sm text-gray-400">{config.description}</p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              Connected
              {status.is_paper && (
                <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                  Paper
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <XCircle className="w-4 h-4" />
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        {status?.connected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Disconnect
            </button>
            {status.last_authenticated && (
              <span className="text-xs text-gray-500">
                Last connected: {new Date(status.last_authenticated).toLocaleDateString()}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!showForm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Connect with API Keys
                </button>
                <a
                  href={config.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign up <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* API Secret */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      API Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="Enter your API secret"
                        className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password/Passphrase (for OKX, KuCoin) */}
                  {config.requiresPassword && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Passphrase
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your API passphrase"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Paper trading toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPaper}
                        onChange={(e) => setIsPaper(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Paper Trading Mode</span>
                    </label>
                    {!isPaper && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <AlertTriangle className="w-3 h-3" />
                        Real money!
                      </span>
                    )}
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  {/* Security note */}
                  <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-700/50 px-3 py-2 rounded-lg">
                    <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Your API keys are stored securely and only used for trading. 
                      We recommend using read-only or trading-only permissions (no withdrawals).
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || !apiKey}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Save & Connect
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setError(null);
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      API Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Export list of supported exchanges for other components
export function ExchangeConnectionList({ className }: { className?: string }) {
  const exchanges = Object.keys(EXCHANGE_CONFIG);
  
  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="text-lg font-semibold text-white mb-4">Connect Your Exchanges</h2>
      <p className="text-sm text-gray-400 mb-4">
        Connect your own exchange accounts to trade with your own API keys. 
        Each user's credentials are stored separately and securely.
      </p>
      <div className="grid gap-4">
        {exchanges.map((exchange) => (
          <ExchangeConnect key={exchange} exchange={exchange} />
        ))}
      </div>
    </div>
  );
}

export default ExchangeConnect;
