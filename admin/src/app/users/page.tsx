'use client';

import { useState } from 'react';
import { 
  Users, 
  Shield, 
  Eye, 
  RefreshCw, 
  Trash2,
  Search,
  UserPlus,
  Calendar,
  Mail,
  Crown,
  Zap,
  Settings,
  Key,
  Edit3,
  User,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { UserTierEditor } from '@/components/UserTierEditor';
import { SubscriptionTier } from '@/lib/privy';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
  display_name?: string;
  created_at: string;
  last_sign_in_at?: string;
  notifications_enabled?: boolean;
  subscription_tier?: SubscriptionTier;
  subscription_status?: string;
  custom_price?: number;
  discount_percent?: number;
  notes?: string;
}

const TIER_BADGES = {
  free: { icon: User, color: 'bg-gray-500/20 text-gray-400', label: 'Free' },
  pro: { icon: Zap, color: 'bg-neon-blue/20 text-neon-blue', label: 'Pro' },
  elite: { icon: Crown, color: 'bg-neon-purple/20 text-neon-purple', label: 'Elite' },
};

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Read Only', icon: Eye, description: 'Can view dashboards but cannot trade' },
  { value: 'admin', label: 'Admin', icon: Shield, description: 'Full access to all features and settings' },
];

const TIER_OPTIONS = [
  { value: 'free', label: 'Free', icon: User, description: 'Limited features, simulation only' },
  { value: 'pro', label: 'Pro', icon: Zap, description: 'Advanced features, live trading enabled' },
  { value: 'elite', label: 'Elite', icon: Crown, description: 'All features, priority support, unlimited trades' },
];

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [createForm, setCreateForm] = useState({ email: '', password: '', displayName: '', role: 'viewer', tier: 'free' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch users via API (uses service key to bypass RLS)
  const { data: users = [], refetch, isLoading, error, isFetching } = useQuery<User[]>({
    queryKey: ['users-page'],
    queryFn: async () => {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.users || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Filter users by search
  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showNotification = (message: string, isError = false) => {
    if (isError) {
      setActionError(message);
      setTimeout(() => setActionError(null), 5000);
    } else {
      setActionSuccess(message);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates: { role: newRole } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role');
      }
      showNotification('Role updated successfully');
      refetch();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates: { subscription_tier: newTier } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update tier');
      }
      showNotification('Subscription tier updated successfully');
      refetch();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleEmailUpdate = async (userId: string) => {
    if (!newEmail || !newEmail.includes('@')) {
      showNotification('Please enter a valid email', true);
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates: { email: newEmail } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update email');
      }
      showNotification('Email updated successfully');
      setEditingEmail(null);
      setNewEmail('');
      refetch();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      showNotification('Email and password are required', true);
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          displayName: createForm.displayName,
          role: createForm.role,
          subscription_tier: createForm.tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      showNotification('User created successfully');
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', displayName: '', role: 'viewer', tier: 'free' });
      refetch();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleResetMFA = async (userId: string) => {
    if (!confirm('Reset MFA for this user? They will need to set up MFA again on next login.')) return;
    try {
      const res = await fetch('/api/users/reset-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset MFA');
      }
      showNotification('MFA reset successfully');
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const handleTierUpdate = async (updates: {
    subscription_tier: SubscriptionTier;
    subscription_status: string;
    custom_price?: number;
    discount_percent?: number;
    admin_notes?: string;
  }) => {
    if (!editingUser) return;
    
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: editingUser.id, 
          updates: {
            subscription_tier: updates.subscription_tier,
            subscription_status: updates.subscription_status,
            custom_price: updates.custom_price,
            discount_percent: updates.discount_percent,
            admin_notes: updates.admin_notes,
          }
        }),
      });
      if (!res.ok) throw new Error('Failed to update tier');
      showNotification('User settings updated successfully');
      refetch();
    } catch (err) {
      console.error('Failed to update user tier:', err);
      throw err;
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Delete user ${user.display_name || user.email}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users?userId=${user.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      showNotification('User deleted successfully');
      refetch();
    } catch (err) {
      showNotification('Failed to delete user', true);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400">You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {actionError}
          </motion.div>
        )}
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            {actionSuccess}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-neon-blue/20 rounded-lg">
              <Users className="w-6 h-6 text-neon-blue" />
            </div>
            User Management
          </h1>
          <p className="text-gray-400 mt-1">
            Manage user access and permissions ({users.length} users)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon-purple hover:bg-neon-purple/80 text-white rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", (isLoading || isFetching) && "animate-spin")} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-lg focus:outline-none focus:border-neon-purple"
        />
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-neon-purple animate-spin" />
          <span className="ml-3 text-gray-400">Loading users...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-6"
        >
          <p className="text-red-400">
            Failed to load users: {(error as Error).message}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredUsers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-dark-card border border-dark-border rounded-lg"
        >
          <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">
            {searchQuery ? 'No users match your search' : 'No users found'}
          </p>
          <p className="text-gray-500 mt-1 text-sm">
            Users will appear here once they sign up
          </p>
        </motion.div>
      )}

      {/* Users Grid */}
      {!isLoading && !error && filteredUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "bg-dark-card border rounded-lg p-4 transition-all hover:border-neon-purple/50",
                user.role === 'admin' ? 'border-neon-purple/30' : 'border-dark-border'
              )}
            >
              {/* User Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                    user.role === 'admin' 
                      ? 'bg-neon-purple/20 text-neon-purple' 
                      : 'bg-gray-500/20 text-gray-400'
                  )}>
                    {user.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-medium truncate max-w-[150px]">
                      {user.display_name || 'No name'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Role Badge */}
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                        user.role === 'admin' 
                          ? 'bg-neon-purple/20 text-neon-purple' 
                          : 'bg-gray-500/20 text-gray-400'
                      )}>
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {user.role === 'admin' ? 'Admin' : 'Viewer'}
                      </div>
                      {/* Tier Badge */}
                      {(() => {
                        const tier = user.subscription_tier || 'free';
                        const badge = TIER_BADGES[tier];
                        const TierIcon = badge.icon;
                        return (
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            badge.color
                          )}>
                            <TierIcon className="w-3 h-3" />
                            {badge.label}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {user.id === currentUser?.id && (
                    <span className="text-xs bg-neon-green/20 text-neon-green px-2 py-1 rounded">
                      You
                    </span>
                  )}
                  <button
                    onClick={() => setEditingUser(user)}
                    className="p-1.5 text-gray-400 hover:text-neon-purple hover:bg-neon-purple/10 rounded-lg transition-colors"
                    title="Edit user tier and pricing"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* User Details */}
              <div className="space-y-2 text-sm text-gray-400 mb-4">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                {user.last_sign_in_at && (
                  <div className="text-xs text-gray-500">
                    Last login: {new Date(user.last_sign_in_at).toLocaleString()}
                  </div>
                )}
              </div>

              {/* User Actions */}
              <div className="flex flex-col gap-2 pt-3 border-t border-dark-border">
                {/* Role dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-12">Role:</label>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.id === currentUser?.id}
                    title="Change user role"
                    className="flex-1 bg-dark-border border border-dark-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-purple disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="viewer">Viewer (Read Only)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {/* Tier dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-12">Tier:</label>
                  <select
                    value={user.subscription_tier || 'free'}
                    onChange={(e) => handleTierChange(user.id, e.target.value)}
                    title="Change subscription tier"
                    className="flex-1 bg-dark-border border border-dark-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-blue"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="elite">Elite</option>
                  </select>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1 mt-1">
                  {editingEmail === user.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="New email"
                        className="flex-1 bg-dark-border border border-dark-border rounded px-2 py-1 text-sm focus:outline-none focus:border-neon-purple"
                      />
                      <button
                        onClick={() => handleEmailUpdate(user.id)}
                        className="p-1.5 text-green-400 hover:bg-green-500/10 rounded"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingEmail(null); setNewEmail(''); }}
                        className="p-1.5 text-gray-400 hover:bg-gray-500/10 rounded"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingEmail(user.id); setNewEmail(user.email); }}
                        className="p-1.5 text-gray-400 hover:text-neon-blue hover:bg-neon-blue/10 rounded-lg transition-colors"
                        title="Edit email"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetMFA(user.id)}
                        className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                        title="Reset MFA"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-1.5 text-gray-400 hover:text-neon-purple hover:bg-neon-purple/10 rounded-lg transition-colors"
                        title="Advanced settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Stats Footer */}
      {!isLoading && users.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-8 py-4 text-sm text-gray-500"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neon-purple" />
            <span>{users.filter(u => u.role === 'admin').length} Admins</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-400" />
            <span>{users.filter(u => u.role === 'viewer').length} Viewers</span>
          </div>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-neon-purple" />
            <span>{users.filter(u => u.subscription_tier === 'elite').length} Elite</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-blue" />
            <span>{users.filter(u => u.subscription_tier === 'pro').length} Pro</span>
          </div>
        </motion.div>
      )}

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-neon-purple" />
                Create New User
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password *</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Role</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                      title="Select user role"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-purple"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Tier</label>
                    <select
                      value={createForm.tier}
                      onChange={(e) => setCreateForm({ ...createForm, tier: e.target.value })}
                      title="Select subscription tier"
                      className="w-full bg-dark-border border border-dark-border rounded-lg px-3 py-2 focus:outline-none focus:border-neon-blue"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="elite">Elite</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  className="px-4 py-2 bg-neon-purple hover:bg-neon-purple/80 text-white rounded-lg transition-colors"
                >
                  Create User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Tier Editor Modal */}
      {editingUser && (
        <UserTierEditor
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleTierUpdate}
        />
      )}
    </div>
  );
}
