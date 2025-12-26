'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { ProfileProvider } from '@/lib/useTier';
import { OnboardingCheck } from '@/components/OnboardingCheck';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>
          <ProfileProvider>
            <OnboardingCheck>
              {children}
            </OnboardingCheck>
          </ProfileProvider>
        </AuthGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
