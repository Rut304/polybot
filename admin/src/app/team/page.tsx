'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  Bot,
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Shield,
  Loader2,
  Check,
  AlertCircle,
  Crown,
  Eye,
  Edit,
  Trash2,
  Copy,
  X,
  Clock,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Team {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user?: {
    email: string;
    user_metadata?: {
      display_name?: string;
    };
  };
}

interface Invitation {
  id: string;
  team_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;
  expires_at: string;
  created_at: string;
}

const roleColors = {
  owner: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  admin: 'text-neon-blue bg-neon-blue/10 border-neon-blue/30',
  member: 'text-neon-green bg-neon-green/10 border-neon-green/30',
  viewer: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: Edit,
  viewer: Eye,
};

const roleDescriptions = {
  owner: 'Full access, can delete team',
  admin: 'Manage members & settings',
  member: 'Can trade & view data',
  viewer: 'Read-only access',
};

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Actions
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUser(user);

    // Get user's team membership
    const { data: membershipData } = await supabase
      .from('polybot_team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membershipData) {
      // User has no team - shouldn't happen with trigger
      setLoading(false);
      return;
    }

    setUserRole(membershipData.role);

    // Get team details
    const { data: teamData } = await supabase
      .from('polybot_teams')
      .select('*')
      .eq('id', membershipData.team_id)
      .single();

    if (teamData) {
      setTeam(teamData);
    }

    // Get team members with user details
    const { data: membersData } = await supabase
      .from('polybot_team_members')
      .select('*')
      .eq('team_id', membershipData.team_id)
      .order('role');

    if (membersData) {
      // Fetch user details for each member
      const membersWithUsers = await Promise.all(
        membersData.map(async (member) => {
          const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
          return {
            ...member,
            user: userData?.user ? {
              email: userData.user.email,
              user_metadata: userData.user.user_metadata,
            } : undefined,
          };
        })
      );
      setMembers(membersWithUsers as TeamMember[]);
    }

    // Get pending invitations (only for admins/owners)
    if (['owner', 'admin'].includes(membershipData.role)) {
      const { data: invitesData } = await supabase
        .from('polybot_team_invitations')
        .select('*')
        .eq('team_id', membershipData.team_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitesData) {
        setInvitations(invitesData);
      }
    }

    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;

    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    // Validate email
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      setInviting(false);
      return;
    }

    // Check if already a member
    const existingMember = members.find(m => m.user?.email === inviteEmail);
    if (existingMember) {
      setInviteError('This user is already a team member');
      setInviting(false);
      return;
    }

    // Check if already invited
    const existingInvite = invitations.find(i => i.email === inviteEmail && i.status === 'pending');
    if (existingInvite) {
      setInviteError('An invitation has already been sent to this email');
      setInviting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('polybot_team_invitations')
        .insert({
          team_id: team.id,
          invited_by: user?.id,
          email: inviteEmail,
          role: inviteRole,
        });

      if (error) throw error;

      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      
      // Reload invitations
      const { data: invitesData } = await supabase
        .from('polybot_team_invitations')
        .select('*')
        .eq('team_id', team.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitesData) {
        setInvitations(invitesData);
      }

      // TODO: Send email notification via API route
      // await fetch('/api/team/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail, teamName: team.name }) });

    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === 'owner') return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    setRemovingMember(memberId);

    try {
      const { error } = await supabase
        .from('polybot_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setRemovingMember(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInvite(inviteId);

    try {
      const { error } = await supabase
        .from('polybot_team_invitations')
        .update({ status: 'revoked' })
        .eq('id', inviteId);

      if (error) throw error;

      setInvitations(invitations.filter(i => i.id !== inviteId));
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    } finally {
      setRevokingInvite(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
  };

  const canManageTeam = userRole === 'owner' || userRole === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  // No team found - show setup message
  if (!team) {
    return (
      <div className="min-h-screen bg-dark-bg">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl" />
        </div>
        
        <header className="sticky top-0 z-40 border-b border-white/10 bg-dark-bg/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <Link href="/" className="p-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3 ml-4">
              <div className="w-8 h-8 bg-gradient-to-br from-neon-blue to-neon-green rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">Team Settings</span>
            </div>
          </div>
        </header>
        
        <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-dark-card border border-amber-500/30 rounded-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Team Not Set Up</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Your account doesn&apos;t have a team configured yet. This usually happens if you signed up before the team feature was added.
            </p>
            <div className="bg-dark-bg rounded-lg p-4 text-left mb-6">
              <p className="text-sm text-gray-300 mb-2">
                <strong className="text-neon-blue">Admin Action Required:</strong>
              </p>
              <p className="text-sm text-gray-400">
                Run the <code className="bg-dark-border px-2 py-0.5 rounded text-neon-green">backfill_multitenancy.sql</code> script in Supabase SQL Editor to set up teams for all existing users.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-border text-white rounded-lg hover:bg-dark-border/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-dark-bg/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-neon-blue to-neon-green rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">Team Settings</span>
            </div>
          </div>
          
          {canManageTeam && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-neon-blue to-neon-green text-white font-medium rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite Member</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Team info */}
          <div className="bg-dark-card border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{team?.name}</h2>
              <span className="text-sm text-gray-400">
                {members.length} / {team?.max_members} members
              </span>
            </div>
            
            {/* Role permissions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['owner', 'admin', 'member', 'viewer'] as const).map((role) => {
                const Icon = roleIcons[role];
                return (
                  <div
                    key={role}
                    className={`p-3 rounded-lg border ${roleColors[role]}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">{role}</span>
                    </div>
                    <p className="text-xs opacity-70">{roleDescriptions[role]}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team members */}
          <div className="bg-dark-card border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Team Members</h2>
            
            <div className="space-y-3">
              {members.map((member) => {
                const Icon = roleIcons[member.role];
                const isCurrentUser = member.user_id === user?.id;
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-dark-bg rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-neon-green rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {(member.user?.user_metadata?.display_name || member.user?.email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">
                            {member.user?.user_metadata?.display_name || member.user?.email?.split('@')[0] || 'Unknown'}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-gray-500">(you)</span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm">{member.user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${roleColors[member.role]}`}>
                        <Icon className="w-3 h-3" />
                        {member.role}
                      </span>
                      
                      {canManageTeam && member.role !== 'owner' && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.role)}
                          disabled={removingMember === member.id}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          {removingMember === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending invitations */}
          {canManageTeam && invitations.length > 0 && (
            <div className="bg-dark-card border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Pending Invitations</h2>
              
              <div className="space-y-3">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 bg-dark-bg rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white">{invite.email}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${roleColors[invite.role]}`}>
                        {invite.role}
                      </span>
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        disabled={revokingInvite === invite.id}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Revoke invitation"
                      >
                        {revokingInvite === invite.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-dark-card border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                {/* Email input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-dark-bg border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white placeholder:text-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-colors"
                      placeholder="colleague@company.com"
                      required
                    />
                  </div>
                </div>

                {/* Role selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['admin', 'member', 'viewer'] as const).map((role) => {
                      const Icon = roleIcons[role];
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setInviteRole(role)}
                          className={`p-3 rounded-lg border text-center transition-all ${
                            inviteRole === role
                              ? roleColors[role]
                              : 'border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <Icon className="w-4 h-4 mx-auto mb-1" />
                          <span className="text-xs font-medium capitalize">{role}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {roleDescriptions[inviteRole]}
                  </p>
                </div>

                {/* Error message */}
                {inviteError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{inviteError}</p>
                  </div>
                )}

                {/* Success message */}
                {inviteSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <p className="text-green-400 text-sm">{inviteSuccess}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all disabled:opacity-50"
                >
                  {inviting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Invitation
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
