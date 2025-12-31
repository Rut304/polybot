'use client';

import { useState, useMemo } from 'react';
import { 
  Users, 
  Shield, 
  Search,
  RefreshCw,
  Mail,
  Calendar,
  Crown,
  Sparkles,
  User,
  DollarSign,
  Activity,
  Ban,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Clock,
  MoreVertical,
  MessageSquare,
  Gift,
  Trash2,
  Rocket,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

interface CustomerProfile {
  id: string;
  email: string;
  full_name?: string;
  subscription_tier: 'free' | 'pro' | 'elite';
  subscription_status: 'active' | 'inactive' | 'trialing' | 'canceled';
  stripe_customer_id?: string;
  monthly_trades_used: number;
  monthly_trades_limit: number;
  trial_ends_at?: string;
  is_simulation: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  // Computed from joins
  total_trades?: number;
  total_pnl?: number;
  last_activity?: string;
}

const TIER_BADGES = {
  free: { icon: User, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Free' },
  pro: { icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Pro' },
  elite: { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Elite' },
};

const STATUS_BADGES = {
  active: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  inactive: { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Inactive' },
  trialing: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Trial' },
  canceled: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Canceled' },
};

export default function AdminDashboardPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<CustomerProfile | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [redeployMessage, setRedeployMessage] = useState<string | null>(null);

  // Redeploy dashboard handler
  const handleRedeploy = async () => {
    if (!confirm('Are you sure you want to redeploy the admin dashboard? This will take 1-2 minutes.')) {
      return;
    }
    
    setIsRedeploying(true);
    setRedeployMessage(null);
    
    try {
      const response = await fetch('/api/admin/redeploy', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger deployment');
      }
      
      setRedeployMessage('✓ Deployment triggered! Site will update in 1-2 minutes.');
      setTimeout(() => setRedeployMessage(null), 10000);
    } catch (err: any) {
      setRedeployMessage(`✗ ${err.message}`);
      setTimeout(() => setRedeployMessage(null), 10000);
    } finally {
      setIsRedeploying(false);
    }
  };

  // Fetch all customers
  const { data: customers = [], isLoading, refetch } = useQuery<CustomerProfile[]>({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.customers || [];
    },
    enabled: isAdmin,
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<CustomerProfile> }) => {
      const response = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates }),
      });
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setShowUserModal(false);
    },
  });

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = !searchQuery || 
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = tierFilter === 'all' || c.subscription_tier === tierFilter;
      const matchesStatus = statusFilter === 'all' || c.subscription_status === statusFilter;
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [customers, searchQuery, tierFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: customers.length,
    free: customers.filter(c => c.subscription_tier === 'free').length,
    pro: customers.filter(c => c.subscription_tier === 'pro').length,
    elite: customers.filter(c => c.subscription_tier === 'elite').length,
    active: customers.filter(c => c.subscription_status === 'active').length,
    trialing: customers.filter(c => c.subscription_status === 'trialing').length,
    mrr: customers.reduce((sum, c) => {
      if (c.subscription_status !== 'active') return sum;
      if (c.subscription_tier === 'pro') return sum + 9.99;
      if (c.subscription_tier === 'elite') return sum + 99.99;
      return sum;
    }, 0),
  }), [customers]);

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
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            Admin Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Manage customers, subscriptions, and support</p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/admin/features"
            className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Feature Control
          </Link>
          <Link 
            href="/admin/subscriptions"
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Subscriptions
          </Link>
          <Link 
            href="/admin/support"
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Support Chat
          </Link>
          <button
            onClick={handleRedeploy}
            disabled={isRedeploying}
            title="Redeploy Admin Dashboard"
            className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Rocket className={cn("w-4 h-4", isRedeploying && "animate-pulse")} />
            {isRedeploying ? 'Deploying...' : 'Redeploy'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh customer data"
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Redeploy Message */}
      {redeployMessage && (
        <div className={cn(
          "px-4 py-3 rounded-lg",
          redeployMessage.startsWith('✓') ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          {redeployMessage}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Free</p>
          <p className="text-2xl font-bold text-gray-400">{stats.free}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Pro</p>
          <p className="text-2xl font-bold text-blue-400">{stats.pro}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Elite</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.elite}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-500 mb-1">Trials</p>
          <p className="text-2xl font-bold text-purple-400">{stats.trialing}</p>
        </div>
        <div className="card py-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
          <p className="text-xs text-gray-500 mb-1">MRR</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.mrr)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          title="Filter by subscription tier"
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none"
        >
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="Filter by subscription status"
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="inactive">Inactive</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-border/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Trades</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Mode</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Joined</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const tierBadge = TIER_BADGES[customer.subscription_tier];
                  const statusBadge = STATUS_BADGES[customer.subscription_status];
                  const TierIcon = tierBadge.icon;
                  
                  return (
                    <tr key={customer.id} className="hover:bg-dark-border/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                            tierBadge.bg, tierBadge.color
                          )}>
                            {customer.full_name?.[0]?.toUpperCase() || customer.email?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{customer.full_name || 'No name'}</p>
                            <p className="text-sm text-gray-500">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", tierBadge.bg, tierBadge.color)}>
                          <TierIcon className="w-3 h-3" />
                          {tierBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusBadge.bg, statusBadge.color)}>
                          {statusBadge.label}
                        </span>
                        {customer.subscription_status === 'trialing' && customer.trial_ends_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Ends {new Date(customer.trial_ends_at).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {customer.monthly_trades_used} / {customer.monthly_trades_limit === -1 ? '∞' : customer.monthly_trades_limit}
                        </p>
                        <p className="text-xs text-gray-500">this month</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          customer.is_simulation 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-green-500/20 text-green-400'
                        )}>
                          {customer.is_simulation ? 'Paper' : 'Live'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedUser(customer); setShowUserModal(true); }}
                          title="View user details"
                          className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-dark-border">
                <h2 className="text-xl font-bold">Customer Details</h2>
                <p className="text-gray-400">{selectedUser.email}</p>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Quick Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Name</label>
                    <p className="font-medium">{selectedUser.full_name || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Stripe ID</label>
                    <p className="font-mono text-sm">{selectedUser.stripe_customer_id || 'None'}</p>
                  </div>
                </div>

                {/* Subscription Controls */}
                <div className="space-y-3 pt-4 border-t border-dark-border">
                  <h3 className="font-semibold">Subscription Management</h3>
                  
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Tier</label>
                    <select
                      value={selectedUser.subscription_tier}
                      onChange={(e) => setSelectedUser({ ...selectedUser, subscription_tier: e.target.value as any })}
                      title="Select subscription tier"
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro ($9.99/mo)</option>
                      <option value="elite">Elite ($99.99/mo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Status</label>
                    <select
                      value={selectedUser.subscription_status}
                      onChange={(e) => setSelectedUser({ ...selectedUser, subscription_status: e.target.value as any })}
                      title="Select subscription status"
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg"
                    >
                      <option value="active">Active</option>
                      <option value="trialing">Trialing</option>
                      <option value="inactive">Inactive</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Trade Limit</label>
                    <input
                      type="number"
                      value={selectedUser.monthly_trades_limit}
                      onChange={(e) => setSelectedUser({ ...selectedUser, monthly_trades_limit: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg"
                      placeholder="-1 for unlimited"
                    />
                    <p className="text-xs text-gray-500 mt-1">-1 = unlimited, 0 = no live trades</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 pt-4 border-t border-dark-border">
                  <h3 className="font-semibold mb-3">Quick Actions</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateCustomer.mutate({
                        userId: selectedUser.id,
                        updates: { monthly_trades_used: 0 }
                      })}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset Trade Count
                    </button>
                    
                    <button
                      onClick={() => updateCustomer.mutate({
                        userId: selectedUser.id,
                        updates: { 
                          subscription_tier: 'pro',
                          subscription_status: 'trialing',
                          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                        }
                      })}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      <Gift className="w-4 h-4" />
                      Give 7-Day Trial
                    </button>
                    
                    <button
                      onClick={() => updateCustomer.mutate({
                        userId: selectedUser.id,
                        updates: { is_simulation: !selectedUser.is_simulation }
                      })}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                      Toggle Mode
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm('Force cancel this subscription?')) {
                          updateCustomer.mutate({
                            userId: selectedUser.id,
                            updates: { 
                              subscription_tier: 'free',
                              subscription_status: 'canceled',
                              is_simulation: true
                            }
                          });
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Ban className="w-4 h-4" />
                      Cancel Sub
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-dark-border flex justify-end gap-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-dark-border rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => updateCustomer.mutate({
                    userId: selectedUser.id,
                    updates: {
                      subscription_tier: selectedUser.subscription_tier,
                      subscription_status: selectedUser.subscription_status,
                      monthly_trades_limit: selectedUser.monthly_trades_limit,
                    }
                  })}
                  disabled={updateCustomer.isPending}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {updateCustomer.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
