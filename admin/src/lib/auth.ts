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
  
  // Then check database (polybot_user_profiles table)
  const { data, error } = await supabase
    .from('polybot_user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user role:', error);
  }
  
  // Return role from DB, default to viewer
  const dbRole = data?.role;
  if (dbRole === 'admin') return 'admin';
  return 'viewer';
}
