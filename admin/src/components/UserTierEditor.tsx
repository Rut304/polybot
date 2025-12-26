'use client';

import { useState } from 'react';
import { X, Crown, Zap, User, DollarSign, Save, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SubscriptionTier, TIER_LIMITS } from '@/lib/privy';

interface UserTierEditorProps {
  user: {
    id: string;
    email: string;
    display_name?: string;
    subscription_tier?: SubscriptionTier;
    subscription_status?: string;
    custom_price?: number;
    discount_percent?: number;
    notes?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: TierUpdates) => Promise<void>;
}

interface TierUpdates {
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  custom_price?: number;
  discount_percent?: number;
  admin_notes?: string;
}

const TIER_ICONS = {
  free: User,
  pro: Zap,
  elite: Crown,
};

const TIER_COLORS = {
  free: 'text-gray-400 bg-gray-500/20',
  pro: 'text-neon-blue bg-neon-blue/20',
  elite: 'text-neon-purple bg-neon-purple/20',
};

export function UserTierEditor({ user, isOpen, onClose, onSave }: UserTierEditorProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(user.subscription_tier || 'free');
  const [status, setStatus] = useState(user.subscription_status || 'active');
  const [customPrice, setCustomPrice] = useState<string>(user.custom_price?.toString() || '');
  const [discountPercent, setDiscountPercent] = useState<string>(user.discount_percent?.toString() || '');
  const [adminNotes, setAdminNotes] = useState(user.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        subscription_tier: selectedTier,
        subscription_status: status,
        custom_price: customPrice ? parseFloat(customPrice) : undefined,
        discount_percent: discountPercent ? parseInt(discountPercent) : undefined,
        admin_notes: adminNotes || undefined,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save tier:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateFinalPrice = () => {
    if (customPrice) return parseFloat(customPrice);
    const basePrice = TIER_LIMITS[selectedTier].price;
    if (discountPercent) {
      const discount = basePrice * (parseInt(discountPercent) / 100);
      return basePrice - discount;
    }
    return basePrice;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-dark-card border border-dark-border rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Edit User Tier</h2>
              <p className="text-gray-400 text-sm mt-1">
                {user.display_name || user.email}
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close dialog"
              className="p-2 hover:bg-dark-border rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Overlay */}
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-dark-card/95 rounded-xl flex flex-col items-center justify-center z-10"
            >
              <div className="p-4 bg-neon-green/20 rounded-full mb-4">
                <Check className="w-12 h-12 text-neon-green" />
              </div>
              <p className="text-xl font-semibold text-neon-green">Changes Saved!</p>
            </motion.div>
          )}

          {/* Tier Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Subscription Tier
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['free', 'pro', 'elite'] as SubscriptionTier[]).map((tier) => {
                const Icon = TIER_ICONS[tier];
                const isSelected = selectedTier === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    title={`Select ${tier} tier`}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-center",
                      isSelected 
                        ? 'border-neon-purple bg-neon-purple/10' 
                        : 'border-dark-border hover:border-gray-600'
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2",
                      TIER_COLORS[tier]
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="font-semibold capitalize">{tier}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      ${TIER_LIMITS[tier].price}/mo
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Subscription Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              title="Select subscription status"
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-purple"
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="inactive">Inactive</option>
              <option value="canceled">Canceled</option>
              <option value="comped">Comped (Free Access)</option>
            </select>
          </div>

          {/* Custom Pricing */}
          <div className="mb-6 p-4 bg-dark-border/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-neon-green" />
              <h3 className="font-semibold">Custom Pricing</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Custom Price ($/mo)
                </label>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={TIER_LIMITS[selectedTier].price.toString()}
                  min="0"
                  step="0.01"
                  className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-400">Final Price:</span>
              <span className="text-neon-green font-bold text-lg">
                ${calculateFinalPrice().toFixed(2)}/mo
              </span>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Admin Notes (internal only)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any notes about this user's account..."
              rows={3}
              className="w-full bg-dark-border border border-dark-border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-purple resize-none"
            />
          </div>

          {/* Warning for downgrades */}
          {selectedTier === 'free' && user.subscription_tier !== 'free' && (
            <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-yellow-200 font-medium">Downgrading to Free</p>
                <p className="text-yellow-200/70 mt-1">
                  This will remove access to premium features. User will be limited to 3 strategies 
                  and paper trading mode only.
                </p>
              </div>
            </div>
          )}

          {/* Tier Features Preview */}
          <div className="mb-6 p-4 bg-dark-border/50 rounded-lg">
            <h3 className="font-semibold mb-3 capitalize">{selectedTier} Tier Features</h3>
            <ul className="space-y-2">
              {TIER_LIMITS[selectedTier].features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-green flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-dark-border hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
                isSaving 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-neon-purple hover:bg-neon-purple/80'
              )}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
