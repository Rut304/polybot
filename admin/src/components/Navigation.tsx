'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  Wallet,
  Brain,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Eye,
  Shield,
  Store,
  Star,
  Key,
  GitBranch,
  BookOpen,
  Coins,
  BarChart3,
  Bell,
  FileText,
  Newspaper,
  History,
  Users,
  Receipt,
  Building2,
  Fish,
  Landmark,
  Briefcase,
  Trophy,
  Target,
  Activity,
  AlertTriangle,
  Lock,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useTier } from '@/lib/useTier';

import { SubscriptionTier } from '@/lib/privy';

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  requiredTier?: SubscriptionTier; // 'free' | 'pro' | 'elite'
  isNew?: boolean;
}

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Trading',
    items: [
      { href: '/markets', label: 'Markets', icon: Store },
      { href: '/positions', label: 'My Trades', icon: BarChart3 },
      { href: '/watchlist', label: 'Watchlist', icon: Star },
      { href: '/backtesting', label: 'Backtesting', icon: History, isNew: true },
    ],
  },
  {
    title: 'Research',
    items: [
      { href: '/news', label: 'News Feed', icon: Newspaper },
      { href: '/insights', label: 'AI Insights', icon: Brain, requiredTier: 'pro' },
      { href: '/whales', label: 'Whale Tracker', icon: Fish, requiredTier: 'elite' },
      { href: '/congress', label: 'Congress Tracker', icon: Landmark, requiredTier: 'elite' },
    ],
  },
  {
    title: 'Portfolio',
    items: [
      { href: '/balances', label: 'Balances', icon: Coins },
      { href: '/history', label: 'Trade History', icon: History },
      { href: '/business', label: 'P&L Dashboard', icon: Briefcase, requiredTier: 'pro' },
      { href: '/taxes', label: 'Tax Center', icon: Receipt, requiredTier: 'elite' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { href: '/strategies', label: 'Strategies', icon: Target },
      { href: '/marketplace', label: 'Marketplace', icon: Store, isNew: true },
      { href: '/workflows', label: 'Workflows', icon: GitBranch },
      { href: '/strategy-history', label: 'Strategy History', icon: History, requiredTier: 'pro' },
      { href: '/strategy-builder', label: 'Strategy Builder', icon: Target, requiredTier: 'elite' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/secrets', label: 'API Keys', icon: Key },
      { href: '/team', label: 'Team', icon: Users },
      { href: '/referrals', label: 'Referrals', icon: Users, isNew: true },
      { href: '/pricing', label: 'Pricing', icon: Store },
      { href: '/help', label: 'Help Center', icon: BookOpen },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin', label: 'Admin Dashboard', icon: Shield, adminOnly: true },
      { href: '/admin/features', label: 'Feature Control', icon: Zap, adminOnly: true },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: Coins, adminOnly: true },
      { href: '/admin/support', label: 'AI Support', icon: Brain, adminOnly: true },
      { href: '/users', label: 'User Management', icon: Users, adminOnly: true },
      { href: '/leaderboard', label: 'Top Traders', icon: Trophy, adminOnly: true },
      { href: '/diagnostics', label: 'Diagnostics', icon: Activity, adminOnly: true },
      { href: '/missed-opportunities', label: 'Failed Trades', icon: AlertTriangle, adminOnly: true },
      { href: '/docs', label: 'API Docs', icon: BookOpen, adminOnly: true },
      { href: '/admin/guide', label: 'Admin Guide', icon: BookOpen, adminOnly: true },
    ],
  },
];


export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const { tier, isPro, isElite } = useTier();

  // Helper to check if user has access to a tier
  const hasTierAccess = (requiredTier?: SubscriptionTier) => {
    if (!requiredTier || requiredTier === 'free') return true;
    if (requiredTier === 'pro') return isPro || isElite;
    if (requiredTier === 'elite') return isElite;
    return false;
  };

  // Get tier badge icon
  const getTierIcon = (requiredTier?: SubscriptionTier) => {
    if (!requiredTier || requiredTier === 'free') return null;
    if (requiredTier === 'pro') return Sparkles;
    return Crown;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-dark-card/80 backdrop-blur-xl border-r border-dark-border z-40 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-dark-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center">
              <Zap className="w-4 h-4 text-dark-bg" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-green rounded-full animate-pulse" />
          </div>
          {!collapsed && (
            <span className="text-base font-bold bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple bg-clip-text text-transparent">
              PolyBot
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-dark-border rounded-md transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User Badge - Compact */}
      {!collapsed && user && (
        <div className="px-3 py-2 border-b border-dark-border flex-shrink-0 space-y-2">
          <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
            isAdmin ? "bg-neon-green/10 text-neon-green" : "bg-neon-blue/10 text-neon-blue"
          )}>
            {isAdmin ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="font-medium truncate">{isAdmin ? 'Admin' : 'Read Only'}</span>
          </div>
          {/* Subscription Tier Badge */}
          <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
            tier === 'elite' && "bg-yellow-500/10 text-yellow-400",
            tier === 'pro' && "bg-neon-blue/10 text-neon-blue",
            tier === 'free' && "bg-gray-700/50 text-gray-400"
          )}>
            {tier === 'elite' && <Crown className="w-3 h-3" />}
            {tier === 'pro' && <Sparkles className="w-3 h-3" />}
            {tier === 'free' && <Zap className="w-3 h-3" />}
            <span className="font-medium capitalize">{tier} Plan</span>
          </div>
        </div>
      )}

      {/* Scrollable Nav Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          // Add visual separator before Admin section
          const isAdminSection = section.title === 'Admin';

          return (
            <div key={section.title} className={cn(sectionIndex > 0 && "mt-3")}>
              {/* Admin section separator */}
              {isAdminSection && isAdmin && !collapsed && (
                <div className="mx-2 mb-3 border-t border-dashed border-gray-700" />
              )}
              {!collapsed && (
                <div className={cn(
                  "px-2 py-1 text-[10px] uppercase tracking-wider font-semibold",
                  isAdminSection ? "text-yellow-500" : "text-gray-500"
                )}>
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const hasAccess = hasTierAccess(item.requiredTier);
                  const TierIcon = getTierIcon(item.requiredTier);

                  return (
                    <Link
                      key={item.href}
                      href={hasAccess ? item.href : '/pricing'}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-sm group",
                        isActive
                          ? "bg-neon-green/15 text-neon-green"
                          : hasAccess 
                            ? "hover:bg-dark-border text-gray-400 hover:text-white"
                            : "text-gray-600 hover:bg-dark-border/50 cursor-not-allowed"
                      )}
                      title={collapsed ? item.label : (!hasAccess ? `Upgrade to ${item.requiredTier} for ${item.label}` : undefined)}
                    >
                      <Icon className={cn(
                        "w-4 h-4 flex-shrink-0", 
                        isActive && "text-neon-green",
                        !hasAccess && "opacity-50"
                      )} />
                      {!collapsed && (
                        <>
                          <span className={cn(!hasAccess && "opacity-50")}>{item.label}</span>
                          {item.isNew && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded ml-auto">
                              NEW
                            </span>
                          )}
                          {!hasAccess && TierIcon && !item.isNew && (
                            <TierIcon className={cn(
                              "w-3 h-3 ml-auto",
                              item.requiredTier === 'pro' ? "text-neon-blue" : "text-yellow-400"
                            )} />
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer - Sign Out & Platform Logos */}
      <div className="flex-shrink-0 p-2 border-t border-dark-border bg-dark-card/50">
        <button
          onClick={() => signOut()}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* Platform Logos - Compact */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-3 mt-2 py-1.5 px-2 bg-dark-border/30 rounded-md">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-polymarket flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">P</span>
              </div>
              <span className="text-[10px] text-gray-500">Poly</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-kalshi flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">K</span>
              </div>
              <span className="text-[10px] text-gray-500">Kalshi</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
