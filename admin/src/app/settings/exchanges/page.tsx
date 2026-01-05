'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /settings/exchanges → /secrets
 * The API Keys page is the central place to configure exchange connections
 */
export default function ExchangesRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the API Keys page which handles all exchange configurations
    router.replace('/secrets');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to API Keys...</p>
      </div>
    </div>
  );
}
