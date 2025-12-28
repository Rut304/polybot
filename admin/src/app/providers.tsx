'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuardWithProfile } from '@/components/AuthGuard';
import { OnboardingCheck } from '@/components/OnboardingCheck';
import { CrispChat } from '@/components/CrispChat';

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
        <AuthGuardWithProfile>
          <OnboardingCheck>
            {children}
            <CrispChat />
          </OnboardingCheck>
        </AuthGuardWithProfile>
      </AuthProvider>
    </QueryClientProvider>
  );
}
