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
  LogOut,
  Eye,
  Shield,
  Store,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bets', label: 'My Bets', icon: Wallet },
  { href: '/markets', label: 'Markets', icon: Store },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/insights', label: 'AI Insights', icon: Brain },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, isReadOnly, signOut } = useAuth();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full bg-dark-card/80 backdrop-blur-xl border-r border-dark-border z-40 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-dark-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center">
              <Zap className="w-5 h-5 text-dark-bg" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-neon-green rounded-full animate-pulse" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple bg-clip-text text-transparent">
              PolyBot
            </span>
          )}
        </Link>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 hover:bg-dark-border rounded-lg transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User Badge */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-dark-border">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            isAdmin ? "bg-neon-green/10 border border-neon-green/30" : "bg-neon-blue/10 border border-neon-blue/30"
          )}>
            {isAdmin ? (
              <Shield className="w-4 h-4 text-neon-green" />
            ) : (
              <Eye className="w-4 h-4 text-neon-blue" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium", isAdmin ? "text-neon-green" : "text-neon-blue")}>
                {isAdmin ? 'Admin' : 'Read Only'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                isActive 
                  ? "bg-gradient-to-r from-neon-green/20 to-neon-blue/10 text-neon-green border border-neon-green/30" 
                  : "hover:bg-dark-border text-gray-400 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-neon-green")} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout & Platform Logos */}
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3 border-t border-dark-border bg-dark-card/50">
        {/* Logout Button */}
        <button
          onClick={() => signOut()}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>

        {/* Platform Logos */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-4 py-2 px-4 bg-dark-border/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-polymarket flex items-center justify-center">
                <span className="text-xs font-bold text-white">P</span>
              </div>
              <span className="text-xs text-gray-500">Poly</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-kalshi flex items-center justify-center">
                <span className="text-xs font-bold text-white">K</span>
              </div>
              <span className="text-xs text-gray-500">Kalshi</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
