'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Crown, 
  Sparkles, 
  Zap,
  ExternalLink,
  Copy,
  Check,
  Bell,
  Key,
  CreditCard,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth';
import { useTier } from '@/lib/useTier';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AccountPage() {
  const { user, isAdmin } = useAuth();
  const { tier, profile, isPro, isElite, isFree, refreshProfile } = useTier();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle copy user ID
  const copyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle manage billing
  const handleManageBilling = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          returnUrl: window.location.href,
        }),
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        // User hasn't subscribed yet - redirect to pricing
        window.location.href = '/pricing';
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tier badge config
  const getTierBadge = () => {
    if (isElite) {
      return { 
        label: 'Elite', 
        icon: Crown, 
        color: 'text-yellow-400', 
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30'
      };
    }
    if (isPro) {
      return { 
        label: 'Pro', 
        icon: Sparkles, 
        color: 'text-blue-400', 
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30'
      };
    }
    return { 
      label: 'Free', 
      icon: Zap, 
      color: 'text-gray-400', 
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30'
    };
  };

  const badge = getTierBadge();
  const BadgeIcon = badge.icon;

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <User className="w-7 h-7 text-neon-green" />
            Account Settings
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your profile, subscription, and account preferences
          </p>
        </div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center",
                badge.bgColor
              )}>
                <BadgeIcon className={cn("w-8 h-8", badge.color)} />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">
                    {user?.email?.split('@')[0] || 'User'}
                  </h2>
                  {isAdmin && (
                    <span className="px-2 py-0.5 bg-neon-green/20 text-neon-green text-xs font-bold rounded">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {user?.email || profile?.email || 'No email'}
                </p>
              </div>
            </div>

            {/* Subscription Badge */}
            <div className={cn(
              "px-6 py-3 rounded-xl border",
              badge.bgColor,
              badge.borderColor
            )}>
              <div className="flex items-center gap-2">
                <BadgeIcon className={cn("w-5 h-5", badge.color)} />
                <span className={cn("font-bold text-lg", badge.color)}>
                  {badge.label} Plan
                </span>
              </div>
              {profile?.subscriptionStatus === 'active' && (
                <span className="text-xs text-green-400 mt-1 block">
                  ✓ Active Subscription
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Account Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Account Details
          </h3>
          
          <div className="space-y-4">
            {/* User ID */}
            <div className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
              <div>
                <span className="text-sm text-gray-400">User ID</span>
                <p className="font-mono text-sm">{profile?.id?.slice(0, 8)}...{profile?.id?.slice(-4)}</p>
              </div>
              <button 
                onClick={copyUserId}
                className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                title="Copy full ID"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
              <div>
                <span className="text-sm text-gray-400">Email</span>
                <p>{user?.email || profile?.email || 'Not set'}</p>
              </div>
              <Mail className="w-4 h-4 text-gray-500" />
            </div>

            {/* Member Since */}
            <div className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
              <div>
                <span className="text-sm text-gray-400">Member Since</span>
                <p>{formatDate(profile?.createdAt)}</p>
              </div>
              <Calendar className="w-4 h-4 text-gray-500" />
            </div>

            {/* Account Type */}
            <div className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
              <div>
                <span className="text-sm text-gray-400">Account Type</span>
                <p className="flex items-center gap-2">
                  {isAdmin ? (
                    <>
                      <Shield className="w-4 h-4 text-neon-green" />
                      Administrator
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-blue-400" />
                      Standard User
                    </>
                  )}
                </p>
              </div>
              <Shield className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Billing */}
          {!isFree && (
            <button
              onClick={handleManageBilling}
              disabled={loading}
              className="card hover:border-neon-green/30 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold group-hover:text-neon-green transition-colors">
                    {loading ? 'Loading...' : 'Manage Billing'}
                  </h4>
                  <p className="text-sm text-gray-400">View invoices, update payment</p>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto text-gray-500 group-hover:text-neon-green" />
              </div>
            </button>
          )}

          {/* Upgrade */}
          {!isElite && (
            <Link href="/pricing" className="card hover:border-neon-blue/30 transition-colors group">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isFree ? "bg-blue-500/20" : "bg-yellow-500/20"
                )}>
                  {isFree ? (
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Crown className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold group-hover:text-neon-blue transition-colors">
                    {isFree ? 'Upgrade to Pro' : 'Upgrade to Elite'}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {isFree ? 'Unlock live trading' : 'Unlimited trades & features'}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto text-gray-500 group-hover:text-neon-blue" />
              </div>
            </Link>
          )}

          {/* API Keys */}
          <Link href="/secrets" className="card hover:border-purple-500/30 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold group-hover:text-purple-400 transition-colors">
                  API Keys & Secrets
                </h4>
                <p className="text-sm text-gray-400">Manage exchange credentials</p>
              </div>
              <ExternalLink className="w-4 h-4 ml-auto text-gray-500 group-hover:text-purple-400" />
            </div>
          </Link>

          {/* Notifications */}
          <Link href="/notifications" className="card hover:border-orange-500/30 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-semibold group-hover:text-orange-400 transition-colors">
                  Notifications
                </h4>
                <p className="text-sm text-gray-400">Alert preferences & history</p>
              </div>
              <ExternalLink className="w-4 h-4 ml-auto text-gray-500 group-hover:text-orange-400" />
            </div>
          </Link>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card border-red-500/30"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h3>
          
          <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <div>
              <h4 className="font-semibold text-red-400">Delete Account</h4>
              <p className="text-sm text-gray-400">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold text-sm transition-colors"
              onClick={() => alert('Please contact support to delete your account')}
            >
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
