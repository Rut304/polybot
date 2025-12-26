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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
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
  free: { icon: Eye, color: 'bg-gray-500/20 text-gray-400', label: 'Free' },
  pro: { icon: Zap, color: 'bg-neon-blue/20 text-neon-blue', label: 'Pro' },
  elite: { icon: Crown, color: 'bg-neon-purple/20 text-neon-purple', label: 'Elite' },
};

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Fetch users via API (uses service key to bypass RLS)
  const { data: users = [], refetch, isLoading, error } = useQuery<User[]>({
    queryKey: ['users-page'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.users || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Filter users by search
  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, updates: { role: newRole } }),
      });
      if (!res.ok) throw new Error('Failed to update');
      refetch();
    } catch (err) {
      console.error('Failed to update user role:', err);
      alert('Failed to update user role');
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
      refetch();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user');
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
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </button>
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
              <div className="flex items-center gap-2 pt-3 border-t border-dark-border">
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  disabled={user.id === currentUser?.id}
                  title="Change user role"
                  className="flex-1 bg-dark-border border border-dark-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-purple disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Read Only</option>
                </select>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
