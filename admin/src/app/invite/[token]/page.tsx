'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  Bot,
  Users,
  Loader2,
  Check,
  AlertCircle,
  LogIn,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface InvitationDetails {
  id: string;
  team_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  team?: {
    name: string;
  };
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Fetch invitation details
    const { data: inviteData, error: inviteError } = await supabase
      .from('polybot_team_invitations')
      .select(`
        *,
        team:polybot_teams(name)
      `)
      .eq('token', token)
      .single();

    if (inviteError || !inviteData) {
      setError('Invitation not found or invalid');
      setLoading(false);
      return;
    }

    // Check if expired
    if (new Date(inviteData.expires_at) < new Date()) {
      setError('This invitation has expired');
      setLoading(false);
      return;
    }

    // Check if already used
    if (inviteData.status !== 'pending') {
      setError(`This invitation has already been ${inviteData.status}`);
      setLoading(false);
      return;
    }

    setInvitation(inviteData);
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!user || !invitation) return;

    // Check email matches
    if (user.email !== invitation.email) {
      setError(`This invitation was sent to ${invitation.email}. Please sign in with that email address.`);
      return;
    }

    setAccepting(true);
    setError('');

    try {
      // Call the accept function
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        invitation_token: token
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error);
      }

      setAccepted(true);
      
      // Redirect to team page after 2 seconds
      setTimeout(() => {
        router.push('/team');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-neon-green rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
              PolyBot
            </span>
          </Link>
        </div>

        <div className="bg-dark-card border border-white/10 rounded-xl p-8">
          {/* Error state */}
          {error && !invitation && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Invalid Invitation</h1>
              <p className="text-gray-400 mb-6">{error}</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 text-neon-blue hover:underline"
              >
                Go to homepage
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Accepted state */}
          {accepted && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Check className="w-8 h-8 text-green-400" />
              </motion.div>
              <h1 className="text-xl font-bold text-white mb-2">Welcome to the team!</h1>
              <p className="text-gray-400 mb-4">
                You&apos;ve joined {invitation?.team?.name} as a {invitation?.role}.
              </p>
              <p className="text-sm text-gray-500">Redirecting to team page...</p>
            </div>
          )}

          {/* Invitation details */}
          {invitation && !accepted && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-neon-blue" />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Team Invitation</h1>
                <p className="text-gray-400">
                  You&apos;ve been invited to join
                </p>
                <p className="text-xl font-semibold text-white mt-1">
                  {invitation.team?.name}
                </p>
              </div>

              <div className="bg-dark-bg rounded-lg p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Role</span>
                  <span className="text-white capitalize font-medium">{invitation.role}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Invited as</span>
                  <span className="text-white">{invitation.email}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Not logged in */}
              {!user && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 text-center mb-4">
                    Sign in or create an account to accept this invitation
                  </p>
                  <Link
                    href={`/login?redirect=/invite/${token}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </Link>
                  <Link
                    href={`/signup?email=${encodeURIComponent(invitation.email)}&redirect=/invite/${token}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/5 transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                    Create Account
                  </Link>
                </div>
              )}

              {/* Logged in */}
              {user && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 text-center mb-4">
                    Signed in as <span className="text-white">{user.email}</span>
                  </p>
                  
                  {user.email === invitation.email ? (
                    <button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all disabled:opacity-50"
                    >
                      {accepting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Accept Invitation
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-center">
                      <p className="text-amber-400 text-sm mb-4">
                        This invitation was sent to {invitation.email}
                      </p>
                      <Link
                        href={`/login?redirect=/invite/${token}`}
                        className="text-neon-blue hover:underline text-sm"
                      >
                        Sign in with a different account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
