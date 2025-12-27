'use client';

import { useAuth } from '@/lib/auth';
import { LoginPage } from './LoginPage';
import { AppShell } from './AppShell';
import { Header } from './Header';
import { CircuitBreakerStatus } from './CircuitBreakerStatus';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();

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
