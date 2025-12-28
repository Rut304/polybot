'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Bot } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The Supabase client will automatically handle the auth callback
    // and set the session. We just need to redirect after a short delay.
    const timer = setTimeout(() => {
      router.push('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-neon-blue to-neon-green rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Bot className="w-10 h-10 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">Verifying...</h2>
        <p className="text-gray-400 mb-6">Setting up your account</p>
        
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto" />
      </div>
    </div>
  );
}
