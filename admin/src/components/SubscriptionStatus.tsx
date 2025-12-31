import { useState, useEffect } from 'react';
import { Settings, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SubscriptionStatus() {
    const { user, isLoading: authLoading } = useAuth();
    const [status, setStatus] = useState<string>('loading');
    const [tier, setTier] = useState<string>('Free');
    const [loading, setLoading] = useState(false);

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
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-x-1.5 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    <svg className="h-1.5 w-1.5 fill-green-500" viewBox="0 0 6 6" aria-hidden="true">
                        <circle cx={3} cy={3} r={3} />
                    </svg>
                    {tier || 'Pro'} Active
                </span>
                <button 
                    onClick={handleManage} 
                    disabled={loading}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
                >
                    {loading ? 'Loading...' : 'Manage'}
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-x-1.5 rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                <svg className="h-1.5 w-1.5 fill-yellow-500" viewBox="0 0 6 6" aria-hidden="true">
                    <circle cx={3} cy={3} r={3} />
                </svg>
                Free / Inactive
            </span>
            <a href="/pricing" className="text-xs text-indigo-600 hover:text-indigo-900 font-semibold underline">
                Upgrade
            </a>
        </div>
    );
}
