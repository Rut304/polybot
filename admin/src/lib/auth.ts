'use client';

import { createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Database uses 'admin' | 'viewer', we display 'viewer' as 'Read Only'
export type UserRole = 'admin' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to check if user can perform write operations
export function useCanWrite() {
  const { isAdmin } = useAuth();
  return isAdmin;
}

// Auth helper functions
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Get user role from user metadata or database
export async function getUserRole(userId: string): Promise<UserRole> {
  // First check user metadata
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.role) {
    // Normalize: readonly -> viewer
    const metaRole = user.user_metadata.role;
    if (metaRole === 'admin') return 'admin';
    return 'viewer';
  }
  
  // Try fetching from API (bypasses RLS with service key)
  if (user?.email) {
    try {
      const response = await fetch(`/api/users/me?email=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.role === 'admin') return 'admin';
        if (data.role) return 'viewer';
      }
    } catch (e) {
      console.error('Error fetching role from API:', e);
    }
  }
  
  // Fallback: check database (polybot_profiles table - unified table)
  // Note: polybot_user_profiles is deprecated, use polybot_profiles instead
  const { data, error } = await supabase
    .from('polybot_profiles')
    .select('role, subscription_tier')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user role from profiles:', error);
  }
  
  // Return role from DB, default to viewer
  // All authenticated users should be able to edit their own settings
  const dbRole = data?.role;
  if (dbRole === 'admin') return 'admin';
  return 'viewer';
}
