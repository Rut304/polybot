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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bets', label: 'My Bets', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/insights', label: 'AI Insights', icon: Brain },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

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

      {/* Platform Logos at bottom */}
      {!collapsed && (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="flex items-center justify-center gap-4 py-3 px-4 bg-dark-border/50 rounded-lg">
            {/* Polymarket Logo */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-polymarket flex items-center justify-center">
                <span className="text-xs font-bold text-white">P</span>
              </div>
              <span className="text-xs text-gray-400">Polymarket</span>
            </div>
            {/* Kalshi Logo */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-kalshi flex items-center justify-center">
                <span className="text-xs font-bold text-white">K</span>
              </div>
              <span className="text-xs text-gray-400">Kalshi</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
