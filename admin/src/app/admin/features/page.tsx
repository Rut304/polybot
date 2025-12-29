'use client';

import { useState, useMemo } from 'react';
import { 
  Shield, 
  Settings, 
  ToggleLeft, 
  Users, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Percent,
  Zap,
  Lock,
  Unlock,
  Server,
  Eye,
  EyeOff,
  Beaker,
  Activity,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface FeatureFlag {
  id: number;
  flag_key: string;
  flag_name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  category: string;
  created_at: string;
  updated_at: string;
}

interface AdminSetting {
  id: number;
  setting_key: string;
  setting_value: Record<string, any>;
  description: string;
  updated_at: string;
}

interface UserOverride {
  id: number;
  user_id: string;
  flag_key: string;
  enabled: boolean;
  reason: string;
  granted_by: string;
  expires_at: string | null;
  created_at: string;
  polybot_profiles?: {
    email: string;
    full_name: string;
  };
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  general: { icon: Settings, color: 'text-gray-400', label: 'General' },
  trading: { icon: TrendingUp, color: 'text-green-400', label: 'Trading' },
  ui: { icon: Eye, color: 'text-blue-400', label: 'UI Features' },
  beta: { icon: Beaker, color: 'text-purple-400', label: 'Beta Features' },
  maintenance: { icon: AlertTriangle, color: 'text-orange-400', label: 'Maintenance' },
};

export default function FeatureControlPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['maintenance', 'trading', 'beta']));
  const [editingFlag, setEditingFlag] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<FeatureFlag>>({});
  const [showNewFlagForm, setShowNewFlagForm] = useState(false);
  const [newFlag, setNewFlag] = useState<Partial<FeatureFlag>>({
    flag_key: '',
    flag_name: '',
    description: '',
    enabled: false,
    category: 'general',
    rollout_percentage: 100,
  });

  // Fetch feature flags
  const { data, isLoading, refetch } = useQuery<{
    flags: FeatureFlag[];
    settings: AdminSetting[];
    stats: { totalFlags: number; enabledFlags: number; betaTesters: number; userOverrides: number };
  }>({
    queryKey: ['admin-features'],
    queryFn: async () => {
      const response = await fetch('/api/admin/features');
      if (!response.ok) throw new Error('Failed to fetch features');
      return response.json();
    },
    enabled: isAdmin,
  });

  // Fetch user overrides
  const { data: overridesData } = useQuery<{ overrides: UserOverride[] }>({
    queryKey: ['admin-overrides'],
    queryFn: async () => {
      const response = await fetch('/api/admin/features/overrides');
      if (!response.ok) throw new Error('Failed to fetch overrides');
      return response.json();
    },
    enabled: isAdmin,
  });

  // Update flag mutation
  const updateFlag = useMutation({
    mutationFn: async ({ flagKey, updates }: { flagKey: string; updates: Partial<FeatureFlag> }) => {
      const response = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, updates }),
      });
      if (!response.ok) throw new Error('Failed to update feature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-features'] });
      setEditingFlag(null);
    },
  });

  // Create flag mutation
  const createFlag = useMutation({
    mutationFn: async (flag: Partial<FeatureFlag>) => {
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flag),
      });
      if (!response.ok) throw new Error('Failed to create feature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-features'] });
      setShowNewFlagForm(false);
      setNewFlag({
        flag_key: '',
        flag_name: '',
        description: '',
        enabled: false,
        category: 'general',
        rollout_percentage: 100,
      });
    },
  });

  // Delete flag mutation
  const deleteFlag = useMutation({
    mutationFn: async (flagKey: string) => {
      const response = await fetch(`/api/admin/features?flagKey=${flagKey}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete feature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-features'] });
    },
  });

  // Toggle flag quick action
  const toggleFlag = (flagKey: string, currentEnabled: boolean) => {
    updateFlag.mutate({ flagKey, updates: { enabled: !currentEnabled } });
  };

  // Group flags by category
  const flagsByCategory = useMemo(() => {
    if (!data?.flags) return {};
    
    const filtered = data.flags.filter(flag => {
      const matchesSearch = !searchQuery || 
        flag.flag_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.flag_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || flag.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered.reduce((acc, flag) => {
      const cat = flag.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(flag);
      return acc;
    }, {} as Record<string, FeatureFlag[]>);
  }, [data?.flags, searchQuery, categoryFilter]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ToggleLeft className="w-6 h-6 text-purple-400" />
            </div>
            Feature Control Panel
          </h1>
          <p className="text-gray-400 mt-1">Manage global feature flags and per-user overrides</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewFlagForm(true)}
            className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Flag
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-500">Total Flags</p>
          </div>
          <p className="text-2xl font-bold">{data?.stats?.totalFlags || 0}</p>
        </div>
        <div className="card py-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-500">Enabled</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{data?.stats?.enabledFlags || 0}</p>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-2 mb-2">
            <Beaker className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-gray-500">Beta Testers</p>
          </div>
          <p className="text-2xl font-bold text-purple-400">{data?.stats?.betaTesters || 0}</p>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-gray-500">User Overrides</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{data?.stats?.userOverrides || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* New Flag Form */}
      <AnimatePresence>
        {showNewFlagForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6 border-purple-500/50"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              Create New Feature Flag
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Flag Key (snake_case)</label>
                <input
                  type="text"
                  value={newFlag.flag_key}
                  onChange={(e) => setNewFlag(prev => ({ ...prev, flag_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="my_new_feature"
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newFlag.flag_name}
                  onChange={(e) => setNewFlag(prev => ({ ...prev, flag_name: e.target.value }))}
                  placeholder="My New Feature"
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newFlag.description}
                  onChange={(e) => setNewFlag(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this feature do?"
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={newFlag.category}
                  onChange={(e) => setNewFlag(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rollout %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newFlag.rollout_percentage}
                  onChange={(e) => setNewFlag(prev => ({ ...prev, rollout_percentage: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewFlagForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createFlag.mutate(newFlag)}
                disabled={!newFlag.flag_key || !newFlag.flag_name || createFlag.isPending}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createFlag.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Flag
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature Flags by Category */}
      <div className="space-y-4">
        {Object.entries(flagsByCategory).map(([category, flags]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
          const Icon = config.icon;
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="card overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-dark-border/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5", config.color)} />
                  <span className="font-semibold">{config.label}</span>
                  <span className="text-xs text-gray-500 bg-dark-border px-2 py-0.5 rounded-full">
                    {flags.length} flags
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-dark-border">
                      {flags.map((flag) => (
                        <div
                          key={flag.flag_key}
                          className="flex items-center justify-between p-4 border-b border-dark-border/50 last:border-b-0 hover:bg-dark-border/30 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{flag.flag_name}</span>
                              <code className="text-xs text-gray-500 bg-dark-border px-2 py-0.5 rounded">
                                {flag.flag_key}
                              </code>
                              {flag.rollout_percentage < 100 && (
                                <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Percent className="w-3 h-3" />
                                  {flag.rollout_percentage}%
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{flag.description}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Toggle Button */}
                            <button
                              onClick={() => toggleFlag(flag.flag_key, flag.enabled)}
                              disabled={updateFlag.isPending}
                              className={cn(
                                "relative w-14 h-7 rounded-full transition-colors",
                                flag.enabled 
                                  ? "bg-green-500" 
                                  : "bg-gray-600"
                              )}
                            >
                              <motion.div
                                layout
                                className={cn(
                                  "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md",
                                  flag.enabled ? "right-1" : "left-1"
                                )}
                              />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingFlag(flag.flag_key);
                                setEditValues({
                                  flag_name: flag.flag_name,
                                  description: flag.description,
                                  rollout_percentage: flag.rollout_percentage,
                                });
                              }}
                              className="p-2 text-gray-400 hover:text-white hover:bg-dark-border rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => {
                                if (confirm(`Delete flag "${flag.flag_name}"? This cannot be undone.`)) {
                                  deleteFlag.mutate(flag.flag_key);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {Object.keys(flagsByCategory).length === 0 && !isLoading && (
          <div className="card p-12 text-center">
            <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No feature flags found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Create your first feature flag to get started'}
            </p>
          </div>
        )}
      </div>

      {/* User Overrides Section */}
      {overridesData?.overrides && overridesData.overrides.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-dark-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Active User Overrides
            </h3>
          </div>
          <div className="divide-y divide-dark-border/50">
            {overridesData.overrides.slice(0, 10).map((override) => (
              <div key={override.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {override.polybot_profiles?.email || override.user_id.slice(0, 8) + '...'}
                    </span>
                    <span className="text-xs text-gray-500">→</span>
                    <code className="text-xs bg-dark-border px-2 py-0.5 rounded">{override.flag_key}</code>
                  </div>
                  {override.reason && (
                    <p className="text-sm text-gray-500 mt-1">{override.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded",
                    override.enabled 
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  )}>
                    {override.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {override.expires_at && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires {new Date(override.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Flag Modal */}
      <AnimatePresence>
        {editingFlag && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setEditingFlag(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Edit Feature Flag</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editValues.flag_name || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, flag_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={editValues.description || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rollout Percentage</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editValues.rollout_percentage ?? 100}
                    onChange={(e) => setEditValues(prev => ({ ...prev, rollout_percentage: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setEditingFlag(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateFlag.mutate({ flagKey: editingFlag, updates: editValues })}
                  disabled={updateFlag.isPending}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {updateFlag.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
