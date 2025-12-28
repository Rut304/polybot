'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import { LoginPage } from './LoginPage';
import { AppShell } from './AppShell';
import { Header } from './Header';
import { CircuitBreakerStatus } from './CircuitBreakerStatus';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/landing',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/terms',
  '/privacy',
];

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  
  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));
  
  // Public routes bypass auth completely - no loading, no redirect
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-neon-blue animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // User is authenticated - show full app with navigation
  return (
    <AppShell>
      <Header />
      {children}
      <CircuitBreakerStatus />
    </AppShell>
  );
}
