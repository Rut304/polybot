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
    const role = await getUserRole(userId);
    setUser({ id: userId, email, role });
  }, []);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserRole(session.user.id, session.user.email || '');
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await loadUserRole(session.user.id, session.user.email || '');
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
