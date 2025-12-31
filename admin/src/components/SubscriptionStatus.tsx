import { useState, useEffect } from 'react';
import { Settings, CreditCard, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SubscriptionStatus() {
    const { user, isLoading: authLoading } = useAuth();
    const [status, setStatus] = useState<string>('loading');
    const [tier, setTier] = useState<string>('Free');
    const [loading, setLoading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        if (!user) {
            setStatus('inactive');
            return;
        }
        
        const fetchStatus = async () => {
            const { data: profile } = await supabase
                .from('polybot_profiles')
                .select('subscription_status, subscription_tier')
                .eq('id', user.id)
                .single();
            
            if (profile) {
                setStatus(profile.subscription_status || 'inactive');
                setTier(profile.subscription_tier || 'Free');
            } else {
                setStatus('inactive');
            }
        };

        fetchStatus();
    }, [user]);

    const handleManage = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    returnUrl: window.location.href,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else if (data.error) {
                // User hasn't subscribed yet - redirect to pricing
                if (data.error.includes('No billing account')) {
                    window.location.href = '/pricing';
                } else {
                    console.error('Portal error:', data.error);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || status === 'loading') {
        return <div className="animate-pulse h-6 w-24 bg-gray-200 rounded"></div>;
    }

    if (status === 'active' || status === 'trialing') {
        return (
            <div className="flex items-center gap-1 relative">
                <span className="inline-flex items-center gap-x-1.5 rounded-full bg-neon-green/20 px-2.5 py-1 text-xs font-medium text-neon-green">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                    {tier || 'elite'} Active
                </span>
                <button 
                    onClick={handleManage} 
                    disabled={loading}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-border rounded-lg transition-colors"
                    title="Manage billing"
                >
                    {loading ? (
                        <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                    )}
                </button>
                {showTooltip && (
                    <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs text-gray-300 whitespace-nowrap z-50">
                        Manage billing
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-x-1.5 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-medium text-yellow-400">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Free
            </span>
            <Link 
                href="/pricing" 
                className="px-2.5 py-1 text-xs font-medium bg-neon-green/20 text-neon-green hover:bg-neon-green/30 rounded-full transition-colors"
            >
                Upgrade
            </Link>
        </div>
    );
}
