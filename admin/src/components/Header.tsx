'use client';

import { VersionBadge } from './VersionBadge';
import SubscriptionStatus from './SubscriptionStatus';

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-56 h-14 bg-dark-card/80 backdrop-blur-xl border-b border-dark-border z-30 flex items-center justify-end px-6 gap-4">
      <SubscriptionStatus />
      <div className="h-6 w-px bg-dark-border" />
      <VersionBadge />
    </header>
  );
}
