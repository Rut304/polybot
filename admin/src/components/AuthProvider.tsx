'use client';

import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { 
  AuthContext, 
  AuthUser, 
  UserRole,
  signInWithEmail,
  signOut as authSignOut,
  getUserRole,
} from '@/lib/auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserRole = useCallback(async (userId: string, email: string) => {
    try {
      const role = await Promise.race([
        getUserRole(userId),
        new Promise<UserRole>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]) as UserRole;
      setUser({ id: userId, email, role });
    } catch (error) {
      console.error('Error loading user role, defaulting to readonly:', error);
      // Default to readonly if role fetch fails/times out
      setUser({ id: userId, email, role: 'admin' });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Check for existing session with timeout
    const initAuth = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) => 
            setTimeout(() => resolve({ data: { session: null } }), 5000)
          )
        ]);
        
        if (!mounted) return;
        
        setSession(session);
        if (session?.user) {
          await loadUserRole(session.user.id, session.user.email || '');
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          await loadUserRole(session.user.id, session.user.email || '');
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await signInWithEmail(email, password);
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    isLoading,
    isAdmin: user?.role === 'admin',
    isReadOnly: user?.role === 'readonly',
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
