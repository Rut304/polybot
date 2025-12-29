'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatCurrency, cn } from '@/lib/utils';

interface StockQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
  source: 'ibkr' | 'alpaca';
}

interface StockTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name?: string;
  initialPrice?: number;
  initialChange?: number;
}

export function StockTradeModal({ 
  isOpen, 
  onClose, 
  symbol, 
  name,
  initialPrice = 0,
  initialChange = 0,
}: StockTradeModalProps) {
  const { user } = useAuth();
  
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState('10');
  const [limitPrice, setLimitPrice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time quote state
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [ibkrQuote, setIbkrQuote] = useState<StockQuote | null>(null);
  const [alpacaQuote, setAlpacaQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // Fetch real-time quote on open
  useEffect(() => {
    if (isOpen && symbol) {
      fetchQuote();
      // Refresh quote every 5 seconds while modal is open
      const interval = setInterval(fetchQuote, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, symbol, user?.id]);
  
  const fetchQuote = async () => {
    if (!symbol) return;
    
    setQuoteLoading(true);
    setQuoteError(null);
    
    try {
      const params = new URLSearchParams({
        symbol,
        preferIBKR: 'true',
      });
      if (user?.id) {
        params.set('userId', user.id);
      }
      
      const response = await fetch(`/api/ibkr/quote?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch quote');
      }
      
      // Set primary quote
      setQuote(data.primary);
      setIbkrQuote(data.ibkr || null);
      setAlpacaQuote(data.alpaca || null);
      
      // Auto-fill limit price if not set
      if (!limitPrice && data.primary?.last) {
        setLimitPrice(data.primary.last.toFixed(2));
      }
    } catch (e) {
      console.error('Error fetching quote:', e);
      setQuoteError(e instanceof Error ? e.message : 'Failed to fetch quote');
      
      // Use initial price as fallback
      if (initialPrice > 0) {
        setQuote({
          symbol,
          bid: initialPrice * 0.999,
          ask: initialPrice * 1.001,
          last: initialPrice,
          change: initialChange,
          changePct: initialPrice > 0 ? (initialChange / initialPrice) * 100 : 0,
          volume: 0,
          timestamp: new Date().toISOString(),
          source: 'alpaca',
        });
      }
    } finally {
      setQuoteLoading(false);
    }
  };
  
  // Calculate order values
  const currentPrice = quote?.last || initialPrice;
  const bidPrice = quote?.bid || currentPrice * 0.999;
  const askPrice = quote?.ask || currentPrice * 1.001;
  const spread = askPrice - bidPrice;
  const spreadPct = bidPrice > 0 ? (spread / bidPrice) * 100 : 0;
  
  const executionPrice = orderType === 'market' 
    ? (action === 'buy' ? askPrice : bidPrice)
    : parseFloat(limitPrice) || currentPrice;
  const totalCost = parseFloat(quantity) * executionPrice;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please log in to trade');
      return;
    }
    
    setIsPlacing(true);
    setError(null);
    
    try {
      // For now, this creates a paper trade
      // In production, this would call the IBKR/Alpaca trading API
      const response = await fetch('/api/trades/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          symbol,
          action,
          order_type: orderType,
          quantity: parseFloat(quantity),
          price: executionPrice,
          source: quote?.source || 'alpaca',
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to place trade');
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Reset form
        setQuantity('10');
        setLimitPrice('');
        setOrderType('market');
        setAction('buy');
      }, 1500);
    } catch (e) {
      console.error('Trade error:', e);
      setError(e instanceof Error ? e.message : 'Failed to place trade');
    } finally {
      setIsPlacing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-border sticky top-0 bg-dark-card z-10">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-neon-green" />
              Trade {symbol}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-border rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {showSuccess ? (
            <div className="p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Check className="w-10 h-10 text-neon-green" />
              </motion.div>
              <h3 className="text-xl font-semibold text-neon-green">Order Placed!</h3>
              <p className="text-gray-400 mt-2">Your order has been submitted</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Quote Display */}
              <div className="bg-dark-bg rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-2xl font-bold text-white">{symbol}</div>
                    {name && <div className="text-sm text-gray-400">{name}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={fetchQuote}
                    disabled={quoteLoading}
                    className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                    title="Refresh quote"
                  >
                    <RefreshCw className={cn("w-4 h-4 text-gray-400", quoteLoading && "animate-spin")} />
                  </button>
                </div>
                
                {quoteError ? (
                  <div className="text-sm text-yellow-400 mb-2">
                    ⚠️ Using cached price - {quoteError}
                  </div>
                ) : null}
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Bid</p>
                    <p className="text-lg font-semibold text-red-400">${bidPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Last</p>
                    <p className="text-lg font-bold text-white">${currentPrice.toFixed(2)}</p>
                    {quote && (
                      <p className={cn(
                        "text-xs",
                        quote.changePct >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Ask</p>
                    <p className="text-lg font-semibold text-green-400">${askPrice.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-dark-border flex justify-between text-xs">
                  <span className="text-gray-500">
                    Spread: ${spread.toFixed(2)} ({spreadPct.toFixed(3)}%)
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full",
                    quote?.source === 'ibkr' 
                      ? "bg-red-500/20 text-red-400" 
                      : "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {quote?.source === 'ibkr' ? 'IBKR' : 'Alpaca'}
                  </span>
                </div>
                
                {/* Show both quotes if available */}
                {ibkrQuote && alpacaQuote && (
                  <div className="mt-3 pt-3 border-t border-dark-border">
                    <p className="text-xs text-gray-500 mb-2">Compare Sources:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <span className="text-red-400 font-medium">IBKR:</span>
                        <span className="text-white ml-1">${ibkrQuote.last.toFixed(2)}</span>
                        <span className="text-gray-400 ml-1">
                          ({ibkrQuote.bid.toFixed(2)} / {ibkrQuote.ask.toFixed(2)})
                        </span>
                      </div>
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <span className="text-yellow-400 font-medium">Alpaca:</span>
                        <span className="text-white ml-1">${alpacaQuote.last.toFixed(2)}</span>
                        <span className="text-gray-400 ml-1">
                          ({alpacaQuote.bid.toFixed(2)} / {alpacaQuote.ask.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('buy')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium flex items-center justify-center gap-2",
                      action === 'buy'
                        ? "border-green-500 bg-green-500/20 text-green-400"
                        : "border-dark-border text-gray-400 hover:border-green-500/50"
                    )}
                  >
                    <TrendingUp className="w-4 h-4" />
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('sell')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium flex items-center justify-center gap-2",
                      action === 'sell'
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-dark-border text-gray-400 hover:border-red-500/50"
                    )}
                  >
                    <TrendingDown className="w-4 h-4" />
                    SELL
                  </button>
                </div>
              </div>

              {/* Order Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('market')}
                    className={cn(
                      "py-2 px-4 rounded-xl border-2 transition-all text-sm",
                      orderType === 'market'
                        ? "border-neon-blue bg-neon-blue/20 text-neon-blue"
                        : "border-dark-border text-gray-400 hover:border-neon-blue/50"
                    )}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('limit')}
                    className={cn(
                      "py-2 px-4 rounded-xl border-2 transition-all text-sm",
                      orderType === 'limit'
                        ? "border-neon-purple bg-neon-purple/20 text-neon-purple"
                        : "border-dark-border text-gray-400 hover:border-neon-purple/50"
                    )}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Quantity & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-400 mb-2">Shares</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="10"
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue"
                  />
                </div>
                {orderType === 'limit' && (
                  <div>
                    <label htmlFor="limitPrice" className="block text-sm font-medium text-gray-400 mb-2">Limit Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="limitPrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={currentPrice.toFixed(2)}
                        className="w-full bg-dark-bg border border-dark-border rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                  </div>
                )}
                {orderType === 'market' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Est. Price</label>
                    <div className="bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-gray-300">
                      ${executionPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-dark-bg rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Estimated Total</span>
                  <span className="font-semibold">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Commission</span>
                  <span className="font-semibold text-green-400">$0.00</span>
                </div>
                {orderType === 'limit' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Limit vs Market</span>
                    <span className={cn(
                      "font-semibold",
                      action === 'buy' 
                        ? (parseFloat(limitPrice) < askPrice ? "text-green-400" : "text-yellow-400")
                        : (parseFloat(limitPrice) > bidPrice ? "text-green-400" : "text-yellow-400")
                    )}>
                      {action === 'buy' 
                        ? (parseFloat(limitPrice) < askPrice ? 'Below Ask ✓' : 'Above Ask')
                        : (parseFloat(limitPrice) > bidPrice ? 'Above Bid ✓' : 'Below Bid')
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-400">Error</p>
                    <p className="text-gray-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-400">Paper Trading Mode</p>
                  <p className="text-gray-400">This is a simulated trade. No real money will be used.</p>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!quantity || isPlacing || quoteLoading}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                  !quantity || isPlacing || quoteLoading
                    ? "bg-dark-border text-gray-500 cursor-not-allowed"
                    : action === 'buy'
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90"
                      : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:opacity-90"
                )}
              >
                {isPlacing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {action === 'buy' ? 'Buy' : 'Sell'} {parseFloat(quantity) || 0} {symbol} @ ${executionPrice.toFixed(2)}
                  </>
                )}
              </button>

              {/* External Link */}
              <a
                href={`https://finance.yahoo.com/quote/${symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4 inline mr-1" />
                View on Yahoo Finance
              </a>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
