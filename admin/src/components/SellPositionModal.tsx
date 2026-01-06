'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowDownRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PositionToSell {
  id: string;
  ticker: string;
  marketTitle: string;
  platform: string;
  side: 'YES' | 'NO' | 'yes' | 'no';
  contracts: number;
  entryPrice: number;  // in cents (0-100)
  entryAmount: number; // total USD spent
}

interface MarketPrices {
  yes: { bid: number; ask: number; bidDollars: number; askDollars: number };
  no: { bid: number; ask: number; bidDollars: number; askDollars: number };
  sellPrices: { yes: number; no: number };
}

interface SellPositionModalProps {
  position: PositionToSell | null;
  isOpen: boolean;
  onClose: () => void;
  onSellComplete?: () => void;
}

const formatCurrency = (amount: number, decimals = 2) => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export function SellPositionModal({ position, isOpen, onClose, onSellComplete }: SellPositionModalProps) {
  const [prices, setPrices] = useState<MarketPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellResult, setSellResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customPrice, setCustomPrice] = useState<number | null>(null);

  const normalizedSide = position?.side?.toUpperCase() as 'YES' | 'NO' | undefined;

  // Fetch current market prices
  const fetchPrices = useCallback(async () => {
    if (!position?.ticker) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/positions/sell?ticker=${encodeURIComponent(position.ticker)}&platform=${position.platform}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPrices(data.prices);
          // Set initial custom price to the bid
          if (normalizedSide === 'YES') {
            setCustomPrice(data.prices.yes.bid);
          } else {
            setCustomPrice(data.prices.no.bid);
          }
        } else {
          setError(data.error || 'Failed to fetch prices');
        }
      } else {
        setError('Failed to fetch market prices');
      }
    } catch (err) {
      setError('Network error fetching prices');
    } finally {
      setLoading(false);
    }
  }, [position?.ticker, position?.platform, normalizedSide]);

  // Fetch prices when modal opens
  useEffect(() => {
    if (isOpen && position) {
      fetchPrices();
      setSellResult(null);
    }
  }, [isOpen, position, fetchPrices]);

  // Calculate P&L
  const calculatePnL = () => {
    if (!position || !prices) return { pnl: 0, pnlPercent: 0, exitValue: 0 };
    
    const sellPrice = customPrice || (normalizedSide === 'YES' ? prices.yes.bid : prices.no.bid);
    const exitValue = (sellPrice / 100) * position.contracts;
    const pnl = exitValue - position.entryAmount;
    const pnlPercent = position.entryAmount > 0 ? (pnl / position.entryAmount) * 100 : 0;
    
    return { pnl, pnlPercent, exitValue, sellPrice };
  };

  // Execute sell
  const executeSell = async () => {
    if (!position) return;
    
    setSelling(true);
    setError(null);
    
    try {
      const { sellPrice } = calculatePnL();
      
      const response = await fetch('/api/positions/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: position.id,
          ticker: position.ticker,
          side: normalizedSide?.toLowerCase(),
          contracts: position.contracts,
          priceCents: sellPrice || customPrice,
          platform: position.platform,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSellResult({ success: true, message: 'Sell order placed successfully!' });
        onSellComplete?.();
      } else {
        setSellResult({ success: false, message: data.error || 'Failed to place sell order' });
      }
    } catch (err) {
      setSellResult({ success: false, message: 'Network error placing sell order' });
    } finally {
      setSelling(false);
    }
  };

  if (!position) return null;

  const { pnl, pnlPercent, exitValue, sellPrice } = calculatePnL();
  const isProfitable = pnl >= 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] max-h-[70vh] overflow-y-auto bg-dark-card border border-dark-border rounded-2xl shadow-2xl z-50"
          >
            {/* Header */}
            <div className="sticky top-0 bg-dark-card border-b border-dark-border p-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-lg">Sell Position</h2>
                  <p className="text-xs text-dark-muted mt-0.5">Close out your position</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close sell modal"
                className="p-2 hover:bg-dark-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-dark-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Market Info */}
              <div className="bg-dark-bg/50 rounded-xl p-4">
                <p className="text-sm text-white font-medium mb-2">{position.marketTitle}</p>
                <div className="flex items-center gap-4 text-xs text-dark-muted">
                  <span className="capitalize">{position.platform}</span>
                  <span className="px-2 py-0.5 bg-dark-border rounded">
                    {position.ticker}
                  </span>
                </div>
              </div>

              {/* Position Details */}
              <div className="bg-dark-bg/50 rounded-xl p-4">
                <h4 className="text-sm text-dark-muted mb-3">Your Position</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-dark-muted">Side</p>
                    <p className={cn(
                      "font-bold",
                      normalizedSide === 'YES' ? 'text-green-400' : 'text-red-400'
                    )}>
                      {normalizedSide}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-muted">Contracts</p>
                    <p className="font-bold text-white">{position.contracts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-muted">Entry Price</p>
                    <p className="font-bold text-white">{position.entryPrice.toFixed(1)}¢</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-muted">Entry Cost</p>
                    <p className="font-bold text-white">{formatCurrency(position.entryAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Live Prices */}
              {loading ? (
                <div className="bg-dark-bg/50 rounded-xl p-6 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-neon-blue animate-spin" />
                  <span className="ml-2 text-dark-muted">Fetching live prices...</span>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                  <button
                    onClick={fetchPrices}
                    className="mt-2 text-xs text-neon-blue hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : prices && (
                <>
                  {/* Current Market */}
                  <div className="bg-dark-bg/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm text-dark-muted flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Current Market Prices
                      </h4>
                      <button
                        onClick={fetchPrices}
                        className="text-xs text-neon-blue hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn(
                        "p-3 rounded-lg",
                        normalizedSide === 'YES' ? 'bg-green-500/10 border border-green-500/30' : 'bg-dark-border'
                      )}>
                        <p className="text-xs text-dark-muted mb-1">YES</p>
                        <p className="text-sm">
                          <span className="text-green-400">Bid: {prices.yes.bid}¢</span>
                          <span className="text-dark-muted mx-1">/</span>
                          <span className="text-red-400">Ask: {prices.yes.ask}¢</span>
                        </p>
                      </div>
                      <div className={cn(
                        "p-3 rounded-lg",
                        normalizedSide === 'NO' ? 'bg-red-500/10 border border-red-500/30' : 'bg-dark-border'
                      )}>
                        <p className="text-xs text-dark-muted mb-1">NO</p>
                        <p className="text-sm">
                          <span className="text-green-400">Bid: {prices.no.bid}¢</span>
                          <span className="text-dark-muted mx-1">/</span>
                          <span className="text-red-400">Ask: {prices.no.ask}¢</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sell Price Input */}
                  <div className="bg-dark-bg/50 rounded-xl p-4">
                    <label className="text-sm text-dark-muted mb-2 block">
                      Sell Price (¢)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={customPrice || ''}
                      onChange={(e) => setCustomPrice(parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 bg-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-blue"
                      placeholder={`Best bid: ${normalizedSide === 'YES' ? prices.yes.bid : prices.no.bid}¢`}
                    />
                    <p className="text-xs text-dark-muted mt-2">
                      💡 Sell at the bid for instant execution, or set higher for better price (may not fill)
                    </p>
                  </div>

                  {/* P&L Preview */}
                  <div className={cn(
                    "rounded-xl p-4 border",
                    isProfitable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  )}>
                    <h4 className="text-sm text-dark-muted mb-3 flex items-center gap-2">
                      {isProfitable ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      If Sold @ {sellPrice}¢
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-dark-muted">Proceeds</p>
                        <p className="font-bold text-white">{formatCurrency(exitValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-muted">P&L</p>
                        <p className={cn(
                          "font-bold",
                          isProfitable ? 'text-green-400' : 'text-red-400'
                        )}>
                          {isProfitable ? '+' : ''}{formatCurrency(pnl)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-muted">Return</p>
                        <p className={cn(
                          "font-bold",
                          isProfitable ? 'text-green-400' : 'text-red-400'
                        )}>
                          {isProfitable ? '+' : ''}{pnlPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Sell Result */}
              {sellResult && (
                <div className={cn(
                  "rounded-xl p-4 border flex items-center gap-3",
                  sellResult.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                )}>
                  {sellResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <p className={cn(
                    "text-sm",
                    sellResult.success ? 'text-green-400' : 'text-red-400'
                  )}>
                    {sellResult.message}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-dark-card border-t border-dark-border p-4 flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-dark-border text-white rounded-lg hover:bg-dark-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSell}
                disabled={selling || !prices || !!sellResult?.success}
                className={cn(
                  "px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2",
                  selling || !prices || sellResult?.success
                    ? 'bg-red-500/30 text-red-300 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                )}
              >
                {selling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Selling...
                  </>
                ) : sellResult?.success ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Sold
                  </>
                ) : (
                  'Sell Position'
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
