'use client';

import { useState } from 'react';
import { ChevronDown, Check, Filter, Globe, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePlatforms } from '@/lib/PlatformContext';

// Platform icons and colors
const PLATFORM_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  polymarket: { color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: '🔮' },
  kalshi: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: '📊' },
  alpaca: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: '🦙' },
  robinhood: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: '🪶' },
  webull: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: '📈' },
  ibkr: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: '🏦' },
  binance: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: '₿' },
  coinbase: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: '🪙' },
  kraken: { color: 'text-violet-400', bgColor: 'bg-violet-500/20', icon: '🐙' },
  kucoin: { color: 'text-teal-400', bgColor: 'bg-teal-500/20', icon: '💎' },
  bybit: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: '⚡' },
  default: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: '🔄' },
};

// Time range options
export const TIME_RANGES = [
  { value: 24, label: '24h', hours: 24 },
  { value: 168, label: '7D', hours: 168 },
  { value: 720, label: '30D', hours: 720 },
  { value: 2160, label: '90D', hours: 2160 },
  { value: 8760, label: '1Y', hours: 8760 },
  { value: 0, label: 'ALL', hours: 0 },
] as const;

// View mode options
export const VIEW_MODES = [
  { value: 'all', label: 'All Data', icon: Globe, description: 'Show all platforms' },
  { value: 'connected', label: 'Connected Only', icon: Link2, description: 'Only connected platforms' },
] as const;

interface PlatformFilterProps {
  selectedPlatforms: string[];
  onPlatformChange: (platforms: string[]) => void;
  className?: string;
  showAllOption?: boolean;
  multiSelect?: boolean;
}

export function PlatformFilter({
  selectedPlatforms,
  onPlatformChange,
  className,
  showAllOption = true,
  multiSelect = true,
}: PlatformFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { platforms, connectedIds, isSimulationMode } = usePlatforms();

  // Get platforms to show based on mode
  const availablePlatforms = isSimulationMode 
    ? platforms // Show all in simulation
    : platforms.filter(p => connectedIds.includes(p.id)); // Only connected in live

  const handlePlatformToggle = (platformId: string) => {
    if (!multiSelect) {
      onPlatformChange([platformId]);
      setIsOpen(false);
      return;
    }

    if (platformId === 'all') {
      onPlatformChange([]);
      return;
    }

    const newSelection = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(p => p !== platformId)
      : [...selectedPlatforms, platformId];
    
    onPlatformChange(newSelection);
  };

  const getDisplayText = () => {
    if (selectedPlatforms.length === 0) return 'All Platforms';
    if (selectedPlatforms.length === 1) {
      const platform = platforms.find(p => p.id === selectedPlatforms[0]);
      return platform?.name || selectedPlatforms[0];
    }
    return `${selectedPlatforms.length} Platforms`;
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
          'bg-dark-card border-dark-border hover:border-neon-green/50',
          'text-sm text-white'
        )}
      >
        <Filter className="w-4 h-4 text-dark-muted" />
        <span>{getDisplayText()}</span>
        <ChevronDown className={cn(
          'w-4 h-4 text-dark-muted transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute z-50 mt-2 w-64 rounded-lg border',
                'bg-dark-card border-dark-border shadow-xl'
              )}
            >
              <div className="p-2 space-y-1">
                {/* Mode indicator */}
                <div className="px-3 py-2 text-xs text-dark-muted border-b border-dark-border mb-2">
                  {isSimulationMode 
                    ? '🧪 Simulation Mode - All platforms shown'
                    : '⚡ Live Mode - Connected platforms only'}
                </div>

                {/* All option */}
                {showAllOption && (
                  <button
                    onClick={() => handlePlatformToggle('all')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                      selectedPlatforms.length === 0
                        ? 'bg-neon-green/10 text-neon-green'
                        : 'hover:bg-dark-border text-gray-300'
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="flex-1">All Platforms</span>
                    {selectedPlatforms.length === 0 && (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                )}

                {/* Platform list */}
                {availablePlatforms.map(platform => {
                  const config = PLATFORM_CONFIG[platform.id] || PLATFORM_CONFIG.default;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  const isConnected = connectedIds.includes(platform.id);

                  return (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformToggle(platform.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                        isSelected
                          ? 'bg-neon-green/10 text-neon-green'
                          : 'hover:bg-dark-border text-gray-300'
                      )}
                    >
                      <span className={cn('w-6 h-6 flex items-center justify-center rounded', config.bgColor)}>
                        {config.icon}
                      </span>
                      <span className="flex-1">{platform.name}</span>
                      {isConnected && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                          Connected
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TimeRangeFilterProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function TimeRangeFilter({ value, onChange, className }: TimeRangeFilterProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-dark-card rounded-lg border border-dark-border', className)}>
      {TIME_RANGES.map(range => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            value === range.value
              ? 'bg-neon-green text-black'
              : 'text-dark-muted hover:text-white hover:bg-dark-border'
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

interface ViewModeToggleProps {
  value: 'all' | 'connected';
  onChange: (value: 'all' | 'connected') => void;
  className?: string;
}

export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-dark-card rounded-lg border border-dark-border', className)}>
      {VIEW_MODES.map(mode => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.value}
            onClick={() => onChange(mode.value)}
            title={mode.description}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              value === mode.value
                ? 'bg-neon-green text-black'
                : 'text-dark-muted hover:text-white hover:bg-dark-border'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

// Export platform config for use in charts
export { PLATFORM_CONFIG };
