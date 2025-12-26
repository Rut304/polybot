'use client';

import { useState, useMemo } from 'react';
import { 
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Sparkles,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  BarChart3,
  PieChart,
  Shield,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

interface SubscriptionMetrics {
  mrr: number;
  arr: number;
  totalCustomers: number;
  payingCustomers: number;
  freeUsers: number;
  proUsers: number;
  eliteUsers: number;
  trialingUsers: number;
  canceledUsers: number;
  conversionRate: number;
  churnRate: number;
  avgRevenuePerUser: number;
  newThisMonth: number;
  canceledThisMonth: number;
  upgradedThisMonth: number;
  downgradedThisMonth: number;
}

interface RecentActivity {
  id: string;
  type: 'subscription' | 'cancellation' | 'upgrade' | 'downgrade' | 'trial_start' | 'trial_end';
  email: string;
  from_tier?: string;
  to_tier?: string;
  amount?: number;
  timestamp: string;
}

const TIER_PRICES = {
  free: 0,
  pro: 9.99,
  elite: 99.99,
};

export default function AdminSubscriptionsPage() {
  const { isAdmin } = useAuth();

  // Fetch subscription data
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/customers');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.customers || [];
    },
    enabled: isAdmin,
  });

  // Calculate metrics
  const metrics: SubscriptionMetrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const free = customers.filter((c: any) => c.subscription_tier === 'free').length;
    const pro = customers.filter((c: any) => c.subscription_tier === 'pro' && c.subscription_status === 'active').length;
    const elite = customers.filter((c: any) => c.subscription_tier === 'elite' && c.subscription_status === 'active').length;
    const trialing = customers.filter((c: any) => c.subscription_status === 'trialing').length;
    const canceled = customers.filter((c: any) => c.subscription_status === 'canceled').length;
    
    const mrr = (pro * TIER_PRICES.pro) + (elite * TIER_PRICES.elite);
    const paying = pro + elite;
    
    // This month's activity (simplified - would need actual subscription history)
    const newThisMonth = customers.filter((c: any) => 
      new Date(c.created_at) >= monthStart
    ).length;
    
    return {
      mrr,
      arr: mrr * 12,
      totalCustomers: customers.length,
      payingCustomers: paying,
      freeUsers: free,
      proUsers: pro,
      eliteUsers: elite,
      trialingUsers: trialing,
      canceledUsers: canceled,
      conversionRate: customers.length > 0 ? (paying / customers.length) * 100 : 0,
      churnRate: 2.5, // Placeholder - would calculate from actual data
      avgRevenuePerUser: paying > 0 ? mrr / paying : 0,
      newThisMonth,
      canceledThisMonth: 0, // Would need subscription history
      upgradedThisMonth: 0,
      downgradedThisMonth: 0,
    };
  }, [customers]);

  // Recent activity (mock - would come from actual subscription events)
  const recentActivity: RecentActivity[] = useMemo(() => {
    return customers
      .filter((c: any) => c.subscription_status === 'active' || c.subscription_status === 'trialing')
      .slice(0, 10)
      .map((c: any) => ({
        id: c.id,
        type: c.subscription_status === 'trialing' ? 'trial_start' : 'subscription',
        email: c.email,
        to_tier: c.subscription_tier,
        amount: TIER_PRICES[c.subscription_tier as keyof typeof TIER_PRICES],
        timestamp: c.updated_at || c.created_at,
      }));
  }, [customers]);

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
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-green-400" />
            </div>
            Subscription Analytics
          </h1>
          <p className="text-gray-400 mt-1">Revenue, growth, and subscription metrics</p>
        </div>
        <Link 
          href="/admin"
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
        >
          ← Back to Admin
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{formatCurrency(metrics.mrr)}</p>
              <p className="text-xs text-gray-500 mt-1">ARR: {formatCurrency(metrics.arr)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Paying Customers</p>
              <p className="text-3xl font-bold mt-1">{metrics.payingCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">of {metrics.totalCustomers} total</p>
            </div>
            <Users className="w-8 h-8 text-blue-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Conversion Rate</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{formatPercent(metrics.conversionRate)}</p>
              <p className="text-xs text-gray-500 mt-1">Free → Paid</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500/50" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">ARPU</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{formatCurrency(metrics.avgRevenuePerUser)}</p>
              <p className="text-xs text-gray-500 mt-1">Avg per paying user</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500/50" />
          </div>
        </motion.div>
      </div>

      {/* Tier Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-gray-400" />
            Tier Distribution
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium">Free</p>
                  <p className="text-xs text-gray-500">{formatCurrency(0)}/mo</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">{metrics.freeUsers}</p>
                <p className="text-xs text-gray-500">
                  {metrics.totalCustomers > 0 ? formatPercent((metrics.freeUsers / metrics.totalCustomers) * 100) : '0%'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Pro</p>
                  <p className="text-xs text-gray-500">{formatCurrency(9.99)}/mo</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-400">{metrics.proUsers}</p>
                <p className="text-xs text-gray-500">{formatCurrency(metrics.proUsers * 9.99)}/mo</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium">Elite</p>
                  <p className="text-xs text-gray-500">{formatCurrency(99.99)}/mo</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-yellow-400">{metrics.eliteUsers}</p>
                <p className="text-xs text-gray-500">{formatCurrency(metrics.eliteUsers * 99.99)}/mo</p>
              </div>
            </div>

            <div className="pt-4 border-t border-dark-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium">Trialing</p>
                    <p className="text-xs text-gray-500">Potential conversions</p>
                  </div>
                </div>
                <p className="font-bold text-purple-400">{metrics.trialingUsers}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-400" />
            This Month
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-green-400" />
                <span>New Signups</span>
              </div>
              <span className="font-bold text-green-400">+{metrics.newThisMonth}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span>Upgrades</span>
              </div>
              <span className="font-bold text-blue-400">+{metrics.upgradedThisMonth}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-yellow-400" />
                <span>Downgrades</span>
              </div>
              <span className="font-bold text-yellow-400">{metrics.downgradedThisMonth}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span>Cancellations</span>
              </div>
              <span className="font-bold text-red-400">{metrics.canceledThisMonth}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Recent Subscription Activity</h3>
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-dark-border/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    activity.type === 'subscription' && "bg-green-500/20",
                    activity.type === 'trial_start' && "bg-purple-500/20",
                    activity.type === 'cancellation' && "bg-red-500/20",
                  )}>
                    {activity.type === 'subscription' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {activity.type === 'trial_start' && <Clock className="w-4 h-4 text-purple-400" />}
                    {activity.type === 'cancellation' && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.email}</p>
                    <p className="text-xs text-gray-500">
                      {activity.type === 'subscription' && `Subscribed to ${activity.to_tier}`}
                      {activity.type === 'trial_start' && `Started trial for ${activity.to_tier}`}
                      {activity.type === 'cancellation' && 'Canceled subscription'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {activity.amount !== undefined && activity.amount > 0 && (
                    <p className="font-medium text-green-400">+{formatCurrency(activity.amount)}/mo</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
