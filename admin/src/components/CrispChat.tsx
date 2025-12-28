'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

// Crisp website ID - set this in your environment variables
const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

export function CrispChat() {
  const { user } = useAuth();

  useEffect(() => {
    // Don't load if no website ID configured
    if (!CRISP_WEBSITE_ID) {
      console.log('Crisp: No website ID configured, skipping initialization');
      return;
    }

    // Initialize Crisp
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    // Load Crisp script
    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Update user info when auth changes
  useEffect(() => {
    if (!CRISP_WEBSITE_ID || !window.$crisp) return;

    if (user) {
      // Set user email and name
      window.$crisp.push(['set', 'user:email', user.email]);
      const metadata = (user as any).user_metadata;
      if (metadata?.full_name) {
        window.$crisp.push(['set', 'user:nickname', metadata.full_name]);
      }
      // Set user ID for tracking
      window.$crisp.push(['set', 'session:data', [[
        ['user_id', user.id],
        ['plan', 'free'], // You could fetch this from subscription data
      ]]]);
    } else {
      // Reset session for anonymous users
      window.$crisp.push(['do', 'session:reset']);
    }
  }, [user]);

  // This component doesn't render anything - Crisp handles its own UI
  return null;
}

// Helper function to open chat programmatically
export function openCrispChat() {
  if (typeof window !== 'undefined' && window.$crisp) {
    window.$crisp.push(['do', 'chat:open']);
  }
}

// Helper function to send a message
export function sendCrispMessage(message: string) {
  if (typeof window !== 'undefined' && window.$crisp) {
    window.$crisp.push(['do', 'message:send', ['text', message]]);
  }
}

// Helper to hide the chat button
export function hideCrispButton() {
  if (typeof window !== 'undefined' && window.$crisp) {
    window.$crisp.push(['do', 'chat:hide']);
  }
}

// Helper to show the chat button
export function showCrispButton() {
  if (typeof window !== 'undefined' && window.$crisp) {
    window.$crisp.push(['do', 'chat:show']);
  }
}
