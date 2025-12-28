'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface IBKRConnectionStatus {
  connected: boolean;
  accountId?: string;
  accountType?: 'live' | 'paper';
  lastAuthenticated?: string;
  error?: string;
}

interface IBKRConnectProps {
  onConnect?: (accountId: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

/**
 * IBKR OAuth Connection Component
 *
 * Allows users to connect their Interactive Brokers account via:
 * 1. OAuth flow (Web API) - Recommended for production
 * 2. Manual credentials (TWS API) - For users running IB Gateway locally
 *
 * Multi-tenant: Each user's IBKR credentials are stored separately
 * in the user_exchange_credentials table.
 */
export function IBKRConnect({ onConnect, onDisconnect, className }: IBKRConnectProps) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<IBKRConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);

  // Manual setup fields
  const [accountId, setAccountId] = useState('');
  const [username, setUsername] = useState('');
  const [usePaper, setUsePaper] = useState(true);

  // Check existing connection status
  useEffect(() => {
    checkConnectionStatus();
  }, [user?.id]);

  const checkConnectionStatus = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_exchange_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'ibkr')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine
        console.error('Error checking IBKR status:', error);
      }

      if (data) {
        setStatus({
          connected: true,
          accountId: data.account_id,
          accountType: data.is_paper ? 'paper' : 'live',
          lastAuthenticated: data.last_authenticated,
        });
      } else {
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Error checking IBKR connection:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start OAuth flow (for Web API)
  const startOAuthFlow = async () => {
    setConnecting(true);

    try {
      // Call our API to get the OAuth authorization URL
      const response = await fetch('/api/ibkr/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setStatus(prev => ({ ...prev, error: data.error }));
        return;
      }

      if (data.authUrl) {
        // Redirect to IBKR OAuth page
        window.location.href = data.authUrl;
      } else if (data.message) {
        // OAuth not available, show manual setup
        setShowManualSetup(true);
        setStatus(prev => ({
          ...prev,
          error: data.message,
        }));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start OAuth';
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setConnecting(false);
    }
  };

  // Manual connection (for TWS API / local gateway users)
  const connectManually = async () => {
    if (!accountId.trim()) {
      setStatus(prev => ({
        ...prev,
        error: 'Please enter your IBKR account ID',
      }));
      return;
    }

    setConnecting(true);

    try {
      // Store manual credentials
      const { error } = await supabase
        .from('user_exchange_credentials')
        .upsert({
          user_id: user?.id,
          exchange: 'ibkr',
          account_id: accountId.trim().toUpperCase(),
          is_paper: usePaper,
          // No OAuth tokens for manual setup
          access_token: null,
          refresh_token: null,
          last_authenticated: new Date().toISOString(),
        }, {
          onConflict: 'user_id,exchange',
        });

      if (error) throw error;

      setStatus({
        connected: true,
        accountId: accountId.trim().toUpperCase(),
        accountType: usePaper ? 'paper' : 'live',
        lastAuthenticated: new Date().toISOString(),
      });

      setShowManualSetup(false);
      onConnect?.(accountId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect IBKR account
  const disconnect = async () => {
    setDisconnecting(true);

    try {
      const { error } = await supabase
        .from('user_exchange_credentials')
        .delete()
        .eq('user_id', user?.id)
        .eq('exchange', 'ibkr');

      if (error) throw error;

      setStatus({ connected: false });
      setAccountId('');
      setUsername('');
      onDisconnect?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-6', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-dark-border bg-dark-card p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20">
            <Building2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Interactive Brokers</h3>
            <p className="text-sm text-gray-400">
              {status.connected ? 'Connected' : 'Stock & Options Trading'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={cn(
          'px-3 py-1 rounded-full text-sm font-medium',
          status.connected
            ? 'bg-green-500/20 text-green-400'
            : 'bg-gray-500/20 text-gray-400'
        )}>
          {status.connected ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {status.accountType === 'paper' ? 'Paper' : 'Live'}
            </span>
          ) : (
            'Not Connected'
          )}
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {status.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
              <p className="text-sm text-red-400">{status.error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected State */}
      {status.connected && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-dark-lighter border border-dark-border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Account ID</p>
                <p className="font-mono text-white">{status.accountId}</p>
              </div>
              <div>
                <p className="text-gray-400">Trading Mode</p>
                <p className={cn(
                  'font-medium',
                  status.accountType === 'paper'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                )}>
                  {status.accountType === 'paper' ? '📝 Paper Trading' : '💰 Live Trading'}
                </p>
              </div>
              {status.lastAuthenticated && (
                <div className="col-span-2">
                  <p className="text-gray-400">Last Authenticated</p>
                  <p className="text-gray-300">
                    {new Date(status.lastAuthenticated).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={checkConnectionStatus}
              className="flex-1 px-4 py-2 rounded-lg bg-dark-lighter
                       hover:bg-dark-border transition-colors
                       flex items-center justify-center gap-2 text-gray-300"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 text-red-400
                       hover:bg-red-500/20 transition-colors
                       flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Not Connected State */}
      {!status.connected && !showManualSetup && (
        <div className="space-y-4">
          {/* Info Box */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Supported Account Types</p>
                <ul className="list-disc list-inside text-blue-400/80 space-y-1">
                  <li>IBKR Lite - Commission-free US stocks</li>
                  <li>IBKR Pro - Full trading access</li>
                  <li>Paper Trading - Practice mode</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Connect Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={startOAuthFlow}
              disabled={connecting}
              className="w-full px-4 py-3 rounded-lg bg-red-500 text-white
                       hover:bg-red-600 transition-colors
                       flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       font-medium"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Link2 className="w-5 h-5" />
              )}
              Connect with IBKR
            </button>

            <button
              onClick={() => setShowManualSetup(true)}
              className="w-full px-4 py-2 rounded-lg border border-dark-border
                       text-gray-400 hover:text-white hover:border-gray-600
                       transition-colors text-sm"
            >
              Manual Setup (TWS API users)
            </button>
          </div>

          {/* External Links */}
          <div className="flex flex-wrap gap-2 text-sm">
            <a
              href="https://www.interactivebrokers.com/en/accounts/individual.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              Open IBKR Account
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-gray-600">•</span>
            <a
              href="https://www.interactivebrokers.com/en/trading/ib-api.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              API Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Manual Setup Form */}
      <AnimatePresence>
        {!status.connected && showManualSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <p className="font-medium mb-1">Manual Setup Instructions</p>
                  <ol className="list-decimal list-inside text-yellow-400/80 space-y-1">
                    <li>Download and install IB Gateway or TWS</li>
                    <li>Enable API access in settings</li>
                    <li>Allow connections from localhost</li>
                    <li>Enter your account ID below</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  IBKR Account ID
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g., U1234567"
                  className="w-full px-3 py-2 rounded-lg bg-dark-lighter
                           border border-dark-border text-white
                           focus:border-red-500 focus:outline-none
                           placeholder:text-gray-600"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePaper}
                    onChange={(e) => setUsePaper(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-dark-lighter
                             text-red-500 focus:ring-red-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300">Paper Trading Mode</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowManualSetup(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-dark-border
                         text-gray-400 hover:text-white hover:border-gray-600
                         transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={connectManually}
                disabled={connecting || !accountId.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white
                         hover:bg-red-600 transition-colors
                         flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Save Connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IBKRConnect;
