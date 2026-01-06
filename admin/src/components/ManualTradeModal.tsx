'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { usePlaceManualTrade, useMarketCache } from '@/lib/hooks';
import { useTier } from '@/lib/useTier';
import { formatCurrency, cn } from '@/lib/utils';

interface ManualTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillMarket?: {
    platform: 'polymarket' | 'kalshi';
    market_id: string;
    market_title: string;
    yes_price?: number;
    no_price?: number;
  };
}

export function ManualTradeModal({ isOpen, onClose, prefillMarket }: ManualTradeModalProps) {
  const placeTrade = usePlaceManualTrade();
  const { isSimulation } = useTier();
  const { data: markets = [] } = useMarketCache();
  
  const [platform, setPlatform] = useState<'polymarket' | 'kalshi'>(prefillMarket?.platform || 'polymarket');
  const [marketId, setMarketId] = useState(prefillMarket?.market_id || '');
  const [marketTitle, setMarketTitle] = useState(prefillMarket?.market_title || '');
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('10');
  const [price, setPrice] = useState(prefillMarket?.yes_price?.toString() || '0.50');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const totalCost = parseFloat(quantity) * parseFloat(price);
  const potentialProfit = parseFloat(quantity) * (1 - parseFloat(price));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await placeTrade.mutateAsync({
        platform,
        market_id: marketId,
        market_title: marketTitle,
        side,
        action,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        notes: notes || undefined,
      });
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Reset form
        setMarketId('');
        setMarketTitle('');
        setQuantity('10');
        setPrice('0.50');
        setNotes('');
      }, 1500);
    } catch (error) {
      console.error('Failed to place trade:', error);
    }
  };

  const filteredMarkets = markets.filter(m => m.platform === platform);

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
              Manual Trade
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
              <h3 className="text-xl font-semibold text-neon-green">Trade Placed!</h3>
              <p className="text-gray-400 mt-2">Your order has been submitted</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatform('polymarket')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium",
                      platform === 'polymarket'
                        ? "border-polymarket bg-polymarket/20 text-white"
                        : "border-dark-border text-gray-400 hover:border-polymarket/50"
                    )}
                  >
                    <span className="w-6 h-6 rounded-lg bg-polymarket flex items-center justify-center text-sm font-bold">P</span>
                    Polymarket
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('kalshi')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium",
                      platform === 'kalshi'
                        ? "border-kalshi bg-kalshi/20 text-white"
                        : "border-dark-border text-gray-400 hover:border-kalshi/50"
                    )}
                  >
                    <span className="w-6 h-6 rounded-lg bg-kalshi flex items-center justify-center text-sm font-bold">K</span>
                    Kalshi
                  </button>
                </div>
              </div>

              {/* Market Selection */}
              <div>
                <label htmlFor="market-select" className="block text-sm font-medium text-gray-400 mb-2">Market</label>
                {filteredMarkets.length > 0 ? (
                  <select
                    id="market-select"
                    value={marketId}
                    onChange={(e) => {
                      const market = filteredMarkets.find(m => m.market_id === e.target.value);
                      setMarketId(e.target.value);
                      setMarketTitle(market?.title || '');
                      if (market) {
                        setPrice(side === 'yes' ? market.yes_price.toString() : market.no_price.toString());
                      }
                    }}
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue"
                  >
                    <option value="">Select a market...</option>
                    {filteredMarkets.map((market) => (
                      <option key={market.market_id} value={market.market_id}>
                        {market.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="market-select"
                    type="text"
                    value={marketTitle}
                    onChange={(e) => {
                      setMarketTitle(e.target.value);
                      setMarketId(e.target.value.slice(0, 20).replace(/\s/g, '-').toLowerCase());
                    }}
                    placeholder="Enter market title or question..."
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue"
                  />
                )}
              </div>

              {/* Side Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Side</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSide('yes');
                      const market = filteredMarkets.find(m => m.market_id === marketId);
                      if (market) setPrice(market.yes_price.toString());
                    }}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium",
                      side === 'yes'
                        ? "border-neon-green bg-neon-green/20 text-neon-green"
                        : "border-dark-border text-gray-400 hover:border-neon-green/50"
                    )}
                  >
                    <TrendingUp className="w-4 h-4 inline mr-2" />
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSide('no');
                      const market = filteredMarkets.find(m => m.market_id === marketId);
                      if (market) setPrice(market.no_price.toString());
                    }}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium",
                      side === 'no'
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-dark-border text-gray-400 hover:border-red-500/50"
                    )}
                  >
                    <TrendingDown className="w-4 h-4 inline mr-2" />
                    NO
                  </button>
                </div>
              </div>

              {/* Action Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('buy')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium",
                      action === 'buy'
                        ? "border-neon-blue bg-neon-blue/20 text-neon-blue"
                        : "border-dark-border text-gray-400 hover:border-neon-blue/50"
                    )}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('sell')}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 transition-all font-medium",
                      action === 'sell'
                        ? "border-orange-500 bg-orange-500/20 text-orange-400"
                        : "border-dark-border text-gray-400 hover:border-orange-500/50"
                    )}
                  >
                    SELL
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
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-400 mb-2">Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="price"
                      type="number"
                      min="0.01"
                      max="0.99"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.50"
                      className="w-full bg-dark-bg border border-dark-border rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note about this trade..."
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 focus:outline-none focus:border-neon-blue"
                />
              </div>

              {/* Order Summary */}
              <div className="bg-dark-bg rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Cost</span>
                  <span className="font-semibold">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Potential Profit (if {side.toUpperCase()})</span>
                  <span className="font-semibold text-neon-green">+{formatCurrency(potentialProfit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Potential Loss (if {side === 'yes' ? 'NO' : 'YES'})</span>
                  <span className="font-semibold text-red-400">-{formatCurrency(totalCost)}</span>
                </div>
              </div>

              {/* Warning */}
              <div className={cn(
                "flex items-start gap-3 p-4 border rounded-xl",
                isSimulation 
                  ? "bg-yellow-500/10 border-yellow-500/30" 
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <AlertCircle className={cn(
                  "w-5 h-5 flex-shrink-0 mt-0.5",
                  isSimulation ? "text-yellow-500" : "text-red-500"
                )} />
                <div className="text-sm">
                  {isSimulation ? (
                    <>
                      <p className="font-medium text-yellow-400">Paper Trading Mode</p>
                      <p className="text-gray-400">This is a paper trade. No real money will be used.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-red-400">⚠️ LIVE Trading Mode</p>
                      <p className="text-gray-400">This trade will use REAL money on {platform}!</p>
                    </>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!marketTitle || placeTrade.isPending}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                  !marketTitle || placeTrade.isPending
                    ? "bg-dark-border text-gray-500 cursor-not-allowed"
                    : action === 'buy'
                      ? "bg-gradient-to-r from-neon-blue to-neon-green text-white hover:opacity-90"
                      : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
                )}
              >
                {placeTrade.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {action === 'buy' ? 'Buy' : 'Sell'} {parseFloat(quantity)} {side.toUpperCase()} @ ${parseFloat(price).toFixed(2)}
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
