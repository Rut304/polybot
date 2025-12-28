'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  Bot,
  ArrowLeft,
  User as UserIcon,
  Mail,
  Key,
  Bell,
  Shield,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  LogOut,
  Smartphone,
  Copy,
  X,
  ShieldCheck,
  ShieldOff
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUser(user);
      setDisplayName(user.user_metadata?.display_name || '');
      setEmail(user.email || '');
      
      // Load MFA factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp) {
        setMfaFactors(factors.totp);
      }
      
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    return { valid: errors.length === 0, errors };
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updates: { email?: string; data?: { display_name: string } } = {
        data: { display_name: displayName }
      };

      // Only update email if it changed
      if (email !== user?.email) {
        updates.email = email;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      setProfileSuccess(
        email !== user?.email 
          ? 'Profile updated! Check your new email for a confirmation link.'
          : 'Profile updated successfully!'
      );
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess('');

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setPasswordError(`Password requirements: ${validation.errors.join(', ')}`);
      setPasswordSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setPasswordSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // MFA handlers
  const handleEnrollMFA = async () => {
    setMfaEnrolling(true);
    setMfaError('');
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });
      
      if (error) throw error;
      
      if (data) {
        setMfaQrCode(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setMfaFactorId(data.id);
      }
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Failed to start MFA enrollment');
      setMfaEnrolling(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaFactorId || mfaVerifyCode.length !== 6) return;
    
    setMfaVerifying(true);
    setMfaError('');
    
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId
      });
      
      if (challengeError) throw challengeError;
      
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode
      });
      
      if (verifyError) throw verifyError;
      
      // Refresh factors list
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp) {
        setMfaFactors(factors.totp);
      }
      
      // Reset enrollment state
      setMfaEnrolling(false);
      setMfaQrCode(null);
      setMfaSecret(null);
      setMfaFactorId(null);
      setMfaVerifyCode('');
      setMfaSuccess('Two-factor authentication enabled successfully!');
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleUnenrollMFA = async (factorId: string) => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }
    
    setMfaUnenrolling(true);
    setMfaError('');
    
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) throw error;
      
      // Refresh factors list
      const { data: factors } = await supabase.auth.mfa.listFactors();
      setMfaFactors(factors?.totp || []);
      setMfaSuccess('Two-factor authentication disabled.');
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setMfaUnenrolling(false);
    }
  };

  const cancelMFAEnrollment = () => {
    setMfaEnrolling(false);
    setMfaQrCode(null);
    setMfaSecret(null);
    setMfaFactorId(null);
    setMfaVerifyCode('');
    setMfaError('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: UserIcon },
    { id: 'security' as const, label: 'Security', icon: Shield },
    // { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

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
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">Account Settings</span>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* User info header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-neon-green rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {displayName || 'User'}
              </h1>
              <p className="text-gray-400">{user?.email}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-neon-blue'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="bg-dark-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>
                
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-dark-bg border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white placeholder:text-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-colors"
                        placeholder="Your display name"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-dark-bg border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white placeholder:text-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                    {email !== user?.email && (
                      <p className="text-sm text-amber-400 mt-2">
                        Changing your email will require verification
                      </p>
                    )}
                  </div>

                  {/* Error message */}
                  {profileError && (
                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{profileError}</p>
                    </div>
                  )}

                  {/* Success message */}
                  {profileSuccess && (
                    <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <p className="text-green-400 text-sm">{profileSuccess}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all disabled:opacity-50"
                  >
                    {profileSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="bg-dark-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Change Password</h2>
                
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-dark-bg border border-white/20 rounded-lg pl-12 pr-12 py-3 text-white placeholder:text-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-colors"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {/* Password requirements */}
                    {newPassword && (
                      <div className="mt-3 space-y-1">
                        {[
                          { check: newPassword.length >= 8, text: 'At least 8 characters' },
                          { check: /[A-Z]/.test(newPassword), text: 'One uppercase letter' },
                          { check: /[a-z]/.test(newPassword), text: 'One lowercase letter' },
                          { check: /[0-9]/.test(newPassword), text: 'One number' },
                        ].map((req, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {req.check ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-500" />
                            )}
                            <span className={req.check ? 'text-green-400' : 'text-gray-400'}>
                              {req.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-dark-bg border rounded-lg pl-12 pr-12 py-3 text-white placeholder:text-gray-500 focus:ring-1 outline-none transition-colors ${
                          confirmPassword && newPassword !== confirmPassword
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-white/20 focus:border-neon-blue focus:ring-neon-blue'
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-sm text-red-400 mt-2">Passwords do not match</p>
                    )}
                  </div>

                  {/* Error message */}
                  {passwordError && (
                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{passwordError}</p>
                    </div>
                  )}

                  {/* Success message */}
                  {passwordSuccess && (
                    <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <p className="text-green-400 text-sm">{passwordSuccess}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordSaving || !newPassword || !confirmPassword}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all disabled:opacity-50"
                  >
                    {passwordSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Key className="w-5 h-5" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Two-Factor Authentication */}
              <div className="bg-dark-card border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-neon-blue" />
                    <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
                  </div>
                  {mfaFactors.length > 0 && (
                    <span className="flex items-center gap-1 text-sm text-green-400">
                      <ShieldCheck className="w-4 h-4" />
                      Enabled
                    </span>
                  )}
                </div>

                {/* MFA Status Messages */}
                {mfaError && (
                  <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{mfaError}</p>
                  </div>
                )}
                {mfaSuccess && (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-green-400 text-sm">{mfaSuccess}</p>
                  </div>
                )}

                {/* MFA not enrolled - show enroll button */}
                {mfaFactors.length === 0 && !mfaEnrolling && (
                  <div className="space-y-4">
                    <p className="text-gray-400 text-sm">
                      Add an extra layer of security to your account by enabling two-factor authentication 
                      with an authenticator app like Google Authenticator, Authy, or 1Password.
                    </p>
                    <button
                      onClick={handleEnrollMFA}
                      className="flex items-center gap-2 px-4 py-2 bg-neon-blue/20 text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/30 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Enable Two-Factor Auth
                    </button>
                  </div>
                )}

                {/* MFA enrollment in progress - show QR code */}
                {mfaEnrolling && mfaQrCode && (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-medium mb-2">Scan QR Code</h3>
                        <p className="text-gray-400 text-sm">
                          Scan this QR code with your authenticator app
                        </p>
                      </div>
                      <button
                        onClick={cancelMFAEnrollment}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      {/* QR Code */}
                      <div className="bg-white p-4 rounded-lg">
                        <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48" />
                      </div>

                      <div className="flex-1 space-y-4">
                        {/* Manual entry secret */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Or enter this code manually:
                          </label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-dark-bg px-3 py-2 rounded text-sm text-neon-green font-mono break-all">
                              {mfaSecret}
                            </code>
                            <button
                              onClick={() => mfaSecret && copyToClipboard(mfaSecret)}
                              className="p-2 text-gray-400 hover:text-white transition-colors"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Verification code input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Enter verification code:
                          </label>
                          <input
                            type="text"
                            value={mfaVerifyCode}
                            onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full bg-dark-bg border border-white/20 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-mono placeholder:text-gray-500 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-colors"
                            maxLength={6}
                          />
                        </div>

                        <button
                          onClick={handleVerifyMFA}
                          disabled={mfaVerifying || mfaVerifyCode.length !== 6}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-neon-blue to-neon-green text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-neon-blue/25 transition-all disabled:opacity-50"
                        >
                          {mfaVerifying ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-5 h-5" />
                              Verify & Enable
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* MFA enrolled - show status and option to disable */}
                {mfaFactors.length > 0 && !mfaEnrolling && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <ShieldCheck className="w-6 h-6 text-green-400" />
                      <div>
                        <p className="text-green-400 font-medium">Two-factor authentication is enabled</p>
                        <p className="text-gray-400 text-sm">Your account is protected with an authenticator app</p>
                      </div>
                    </div>

                    {mfaFactors.map((factor) => (
                      <div key={factor.id} className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-white text-sm">{factor.friendly_name || 'Authenticator App'}</p>
                            <p className="text-gray-500 text-xs">
                              Added {new Date(factor.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnenrollMFA(factor.id)}
                          disabled={mfaUnenrolling}
                          className="flex items-center gap-1 px-3 py-1 text-red-400 hover:bg-red-500/10 rounded transition-colors text-sm"
                        >
                          {mfaUnenrolling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ShieldOff className="w-4 h-4" />
                              Remove
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account info */}
              <div className="bg-dark-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account ID</span>
                    <span className="text-white font-mono text-xs">{user?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created</span>
                    <span className="text-white">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Sign In</span>
                    <span className="text-white">
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email Verified</span>
                    <span className={user?.email_confirmed_at ? 'text-green-400' : 'text-amber-400'}>
                      {user?.email_confirmed_at ? 'Yes' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
