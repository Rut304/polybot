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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navSections: NavSection[] = [
  {
    title: 'Trading',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/bets', label: 'My Bets', icon: Wallet },
      { href: '/markets', label: 'Markets', icon: Store },
      { href: '/watchlist', label: 'Watchlist', icon: Star },
    ],
  },
  {
    title: 'Portfolio',
    items: [
      { href: '/balances', label: 'Balances', icon: Coins },
      { href: '/positions', label: 'Positions', icon: BarChart3 },
      { href: '/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/history', label: 'History', icon: History },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: '/business', label: 'P&L Dashboard', icon: Building2, adminOnly: true },
      { href: '/taxes', label: 'Tax Center', icon: Receipt, adminOnly: true },
      { href: '/strategy-history', label: 'Strategy History', icon: History, adminOnly: true },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/news', label: 'News Feed', icon: Newspaper },
      { href: '/whales', label: 'Whale Tracker', icon: Fish, adminOnly: true },
      { href: '/insights', label: 'AI Insights', icon: Brain },
      { href: '/workflows', label: 'Workflows', icon: GitBranch },
      { href: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/docs', label: 'Documentation', icon: BookOpen },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/secrets', label: 'API Keys', icon: Key, adminOnly: true },
      { href: '/logs', label: 'Audit Logs', icon: FileText, adminOnly: true },
      { href: '/users', label: 'Users', icon: Users, adminOnly: true },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, signOut } = useAuth();

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
        <div className="px-3 py-2 border-b border-dark-border flex-shrink-0">
          <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
            isAdmin ? "bg-neon-green/10 text-neon-green" : "bg-neon-blue/10 text-neon-blue"
          )}>
            {isAdmin ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="font-medium truncate">{isAdmin ? 'Admin' : 'Read Only'}</span>
          </div>
        </div>
      )}

      {/* Scrollable Nav Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className={cn(sectionIndex > 0 && "mt-3")}>
              {!collapsed && (
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-sm",
                        isActive 
                          ? "bg-neon-green/15 text-neon-green" 
                          : "hover:bg-dark-border text-gray-400 hover:text-white"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-neon-green")} />
                      {!collapsed && <span>{item.label}</span>}
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
