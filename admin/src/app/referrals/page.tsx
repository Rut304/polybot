'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Gift,
  Copy,
  Check,
  Users,
  DollarSign,
  TrendingUp,
  Share2,
  Twitter,
  Mail,
  Link as LinkIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ReferralData {
  referral_code: string;
  total_referrals: number;
  total_conversions: number;
  total_earnings: number;
  referral_link: string;
  recent_referrals: {
    id: string;
    status: string;
    created_at: string;
    converted_at: string | null;
    reward_amount: number;
  }[];
}

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: referralData, isLoading } = useQuery<ReferralData>({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/referrals', {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch referral data');
      return res.json();
    },
    enabled: !!user?.id,
  });

  const copyToClipboard = async () => {
    if (referralData?.referral_link) {
      await navigator.clipboard.writeText(referralData.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnTwitter = () => {
    const text = `I'm using PolyParlay to automate my prediction market trading! Join me and get started free: ${referralData?.referral_link}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'Try PolyParlay - AI-Powered Prediction Market Trading';
    const body = `Hey!\n\nI've been using PolyParlay to trade on prediction markets and it's been great. They have unlimited free paper trading so you can practice without risking any money.\n\nUse my link to sign up: ${referralData?.referral_link}\n\nLet me know what you think!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neon-green/10 border border-neon-green/20 rounded-full text-neon-green text-sm font-medium mb-4"
          >
            <Gift className="w-4 h-4" />
            Referral Program
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Earn While You Share
          </h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Invite friends to PolyParlay and earn $5 for every user who upgrades to Pro or Elite.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-card border border-dark-border rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Referrals</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {referralData?.total_referrals || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-dark-card border border-dark-border rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-gray-400 text-sm">Conversions</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {referralData?.total_conversions || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-card border border-dark-border rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Earnings</span>
            </div>
            <p className="text-3xl font-bold text-neon-green">
              ${referralData?.total_earnings?.toFixed(2) || '0.00'}
            </p>
          </motion.div>
        </div>

        {/* Referral Link Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-dark-card to-dark-card/50 border border-dark-border rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-neon-green" />
            Your Referral Link
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 font-mono text-sm text-gray-300 truncate">
              {referralData?.referral_link || 'Loading...'}
            </div>
            <button
              onClick={copyToClipboard}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
                copied
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-neon-green text-black hover:bg-neon-green/90"
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* Share buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={shareOnTwitter}
              className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 text-[#1DA1F2] rounded-lg hover:bg-[#1DA1F2]/20 transition-colors"
            >
              <Twitter className="w-4 h-4" />
              Share on X
            </button>
            <button
              onClick={shareViaEmail}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500/10 border border-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/20 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-dark-card border border-dark-border rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neon-green" />
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Share Your Link',
                description: 'Copy your unique referral link and share it with friends, on social media, or in communities.',
              },
              {
                step: '2',
                title: 'Friends Sign Up',
                description: 'When someone signs up using your link, they get free unlimited paper trading.',
              },
              {
                step: '3',
                title: 'Earn Rewards',
                description: 'When they upgrade to Pro or Elite, you earn $5. No limit on earnings!',
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green font-bold">
                    {item.step}
                  </div>
                  {i < 2 && (
                    <ChevronRight className="absolute right-0 top-3 w-5 h-5 text-gray-600 hidden md:block" />
                  )}
                </div>
                <h3 className="text-white font-medium mb-1">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Referrals */}
        {referralData?.recent_referrals && referralData.recent_referrals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-dark-card border border-dark-border rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {referralData.recent_referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between py-3 border-b border-dark-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        ref.status === 'converted' && "bg-emerald-400",
                        ref.status === 'signed_up' && "bg-blue-400",
                        ref.status === 'clicked' && "bg-gray-400"
                      )}
                    />
                    <span className="text-gray-300 capitalize">{ref.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {ref.reward_amount > 0 && (
                      <span className="text-neon-green font-medium">+${ref.reward_amount.toFixed(2)}</span>
                    )}
                    <span className="text-gray-500 text-sm">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
