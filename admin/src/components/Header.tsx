'use client';

import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { VersionBadge } from './VersionBadge';
import SubscriptionStatus from './SubscriptionStatus';
import { BotHealthBadge } from './BotHealthIndicator';

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-56 h-14 bg-dark-card/80 backdrop-blur-xl border-b border-dark-border z-30 flex items-center justify-end px-6 gap-4">
      <Link 
        href="/help" 
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-neon-green transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
        <span>Help Center</span>
      </Link>
      <div className="h-6 w-px bg-dark-border" />
      <BotHealthBadge />
      <div className="h-6 w-px bg-dark-border" />
      <SubscriptionStatus />
      <div className="h-6 w-px bg-dark-border" />
      <VersionBadge />
    </header>
  );
}
