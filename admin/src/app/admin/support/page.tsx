'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare,
  Send,
  Bot,
  User,
  RefreshCw,
  Copy,
  CheckCircle,
  Shield,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Search,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Knowledge base for the AI
const KNOWLEDGE_BASE = {
  subscription: {
    tiers: {
      free: {
        price: '$0/month',
        features: ['Unlimited simulation trading', 'Top 3 strategies', 'Basic dashboard', 'Community Discord'],
        limitations: 'No live trading - simulation only',
      },
      pro: {
        price: '$9.99/month',
        features: ['Everything in Free', '1,000 live trades/month', 'All 10+ strategies', 'RSI trading', 'Missed Money Analysis', 'AI insights', 'Email support'],
        limitations: '1,000 live trade limit per month',
      },
      elite: {
        price: '$99.99/month',
        features: ['Everything in Pro', 'Unlimited live trades', 'Whale tracker', 'Congress tracker', 'Tax analysis', 'Custom strategy builder', 'API access', 'Priority support'],
        limitations: 'None - unlimited access',
      },
    },
    billing: 'Monthly billing via Stripe. Cancel anytime. Prorated refunds available.',
    paperTrading: 'Free paper trading available to everyone with unlimited practice. Upgrade anytime to go live.',
  },
  features: {
    simulation: 'Paper trading mode lets you test strategies with fake money. All tiers have unlimited simulation.',
    liveTrading: 'Live trading uses real money on connected exchanges. Requires Pro or Elite tier.',
    strategies: {
      arbitrage: 'Finds price differences between Polymarket and Kalshi for risk-free profits.',
      rsi: 'Uses RSI indicator to find overbought/oversold markets.',
      whale: 'Elite only - copies trades from top performing wallets.',
      congress: 'Elite only - tracks and copies congressional trading patterns.',
    },
    platforms: ['Polymarket', 'Kalshi', 'Binance', 'Interactive Brokers'],
  },
  support: {
    contact: 'support@polyparlay.io',
    response: 'Email support responds within 24 hours. Elite users get priority.',
    refunds: 'Prorated refunds available for subscription cancellations.',
  },
  troubleshooting: {
    'cant login': 'Clear browser cache, try incognito mode, or reset password at login page.',
    'trades not executing': 'Check: 1) API keys connected, 2) Sufficient balance, 3) Not in simulation mode, 4) Within trade limits',
    'subscription not working': 'Refresh page, check Stripe payment status, contact support with Stripe receipt.',
    'data not loading': 'Check internet connection, try refreshing, clear cache if needed.',
  },
};

// Simple AI response generator (would be replaced with actual AI API)
function generateResponse(question: string): string {
  const q = question.toLowerCase();
  
  // Subscription questions
  if (q.includes('price') || q.includes('cost') || q.includes('how much')) {
    return `**Pricing Overview:**\n\n` +
      `• **Free**: $0/month - Unlimited simulation trading, top 3 strategies\n` +
      `• **Pro**: $9.99/month - 1,000 live trades, all strategies, AI insights\n` +
      `• **Elite**: $99.99/month - Unlimited everything, whale/congress tracking, API access\n\n` +
      `All plans include unlimited paper trading. You can upgrade/downgrade anytime.`;
  }
  
  if (q.includes('cancel') || q.includes('refund')) {
    return `**Cancellation & Refunds:**\n\n` +
      `• Cancel anytime from Settings → Subscription\n` +
      `• Prorated refund available for unused time\n` +
      `• Access continues until end of billing period\n\n` +
      `To process a refund, go to Admin → Customers → Find user → Cancel Sub`;
  }
  
  if (q.includes('trial') || q.includes('free') || q.includes('paper')) {
    return `**Free Paper Trading:**\n\n` +
      `• Free paper trading available to all users\n` +
      `• No credit card required\n` +
      `• Unlimited practice trades\n` +
      `• Test any strategy risk-free\n\n` +
      `To upgrade a user: Admin → Customers → User → Change Tier`;
  }
  
  if (q.includes('upgrade') || q.includes('tier') || q.includes('plan')) {
    return `**Upgrading/Changing Plans:**\n\n` +
      `Users can upgrade from Settings → Subscription → Upgrade Plan.\n\n` +
      `As admin, you can change tiers manually:\n` +
      `1. Go to Admin Dashboard\n` +
      `2. Find the customer\n` +
      `3. Click the actions menu\n` +
      `4. Change tier and save\n\n` +
      `Changes take effect immediately.`;
  }
  
  // Feature questions
  if (q.includes('simulation') || q.includes('paper') || q.includes('demo')) {
    return `**Simulation/Paper Trading:**\n\n` +
      `• Available to ALL tiers (Free included)\n` +
      `• Uses fake money - no risk\n` +
      `• Real market data & pricing\n` +
      `• Great for testing strategies\n` +
      `• Toggle in Settings → Trading Mode\n\n` +
      `Users start in simulation by default.`;
  }
  
  if (q.includes('live') || q.includes('real money') || q.includes('actual trading')) {
    return `**Live Trading:**\n\n` +
      `• Requires Pro ($9.99) or Elite ($99.99)\n` +
      `• Pro: 1,000 trades/month limit\n` +
      `• Elite: Unlimited trades\n` +
      `• Must connect exchange API keys\n` +
      `• Toggle on in Settings → Trading Mode\n\n` +
      `Free users see "Upgrade to Pro for live trading" message.`;
  }
  
  if (q.includes('whale') || q.includes('copy trad')) {
    return `**Whale Tracking (Elite Only):**\n\n` +
      `• Tracks top-performing wallets on Polymarket\n` +
      `• Shows their positions and trades\n` +
      `• Can enable auto-copy trading\n` +
      `• Found in Whales section\n\n` +
      `This is an Elite-exclusive feature.`;
  }
  
  if (q.includes('congress')) {
    return `**Congress Tracker (Elite Only):**\n\n` +
      `• Tracks disclosed congressional trades\n` +
      `• Shows positions by politician\n` +
      `• Historical performance data\n` +
      `• Found in Congress section\n\n` +
      `This is an Elite-exclusive feature.`;
  }
  
  // Troubleshooting
  if (q.includes('not working') || q.includes('error') || q.includes('problem') || q.includes('issue')) {
    return `**Troubleshooting Steps:**\n\n` +
      `1. **Refresh the page** - Ctrl+R or Cmd+R\n` +
      `2. **Clear browser cache** - Settings → Clear browsing data\n` +
      `3. **Try incognito mode** - Rules out extension issues\n` +
      `4. **Check API keys** - Secrets page, verify all connected\n` +
      `5. **Check trade limits** - May have hit monthly limit\n\n` +
      `If issue persists, collect: User email, error message, steps to reproduce.`;
  }
  
  if (q.includes('api') || q.includes('connect') || q.includes('exchange')) {
    return `**Connecting Exchanges:**\n\n` +
      `1. Go to Secrets page\n` +
      `2. Click platform to connect\n` +
      `3. Enter API key and secret\n` +
      `4. Save credentials\n\n` +
      `**Supported platforms:**\n` +
      `• Polymarket (wallet connection)\n` +
      `• Kalshi (API key)\n` +
      `• Binance (API key)\n` +
      `• Interactive Brokers (API)\n\n` +
      `Keys are encrypted and stored securely.`;
  }
  
  // Admin actions
  if (q.includes('reset') && q.includes('trade')) {
    return `**Reset Trade Count:**\n\n` +
      `To reset a user's monthly trade count:\n` +
      `1. Go to Admin Dashboard\n` +
      `2. Find the customer\n` +
      `3. Click actions menu (⋮)\n` +
      `4. Click "Reset Trade Count"\n\n` +
      `This resets their monthly_trades_used to 0.`;
  }
  
  if (q.includes('give') && (q.includes('elite') || q.includes('pro'))) {
    return `**Manually Upgrade User:**\n\n` +
      `1. Admin Dashboard → Find customer\n` +
      `2. Click actions menu\n` +
      `3. Change Tier dropdown to desired tier\n` +
      `4. Set Status to "active"\n` +
      `5. Save Changes\n\n` +
      `For free upgrades, skip Stripe. For paid, have them go through checkout.`;
  }
  
  // Default response
  return `I can help you with:\n\n` +
    `**Subscriptions:** pricing, upgrades, cancellations, refunds\n` +
    `**Features:** simulation, live trading, strategies, platforms\n` +
    `**Admin Actions:** reset trades, change tiers, upgrade users\n` +
    `**Troubleshooting:** login issues, trades not working, connection problems\n\n` +
    `What would you like to know more about?`;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: 'Pricing Overview', query: 'What are the pricing tiers?' },
  { label: 'Reset Trade Count', query: 'How do I reset a user\'s trade count?' },
  { label: 'Free Paper Trading', query: 'How does free paper trading work?' },
  { label: 'Cancel Subscription', query: 'How do I handle cancellation and refunds?' },
  { label: 'Simulation vs Live', query: 'Explain simulation vs live trading' },
  { label: 'Troubleshooting', query: 'User has an error, what should I check?' },
];

export default function AdminSupportPage() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hi! I'm your PolyParlay support assistant.\n\nI can help you answer customer questions about:\n• Subscriptions & billing\n• Features & functionality\n• Troubleshooting issues\n• Admin actions\n\nWhat do you need help with?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const response = generateResponse(messageText);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Support Assistant</h1>
            <p className="text-sm text-gray-400">Get answers to help customers</p>
          </div>
        </div>
        <Link 
          href="/admin"
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
        >
          ← Back to Admin
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-dark-border bg-dark-card/50">
        <p className="text-sm text-gray-400 mb-2">Quick Questions:</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => handleSend(action.query)}
              className="px-3 py-1.5 bg-dark-border hover:bg-dark-border/80 rounded-full text-sm transition-colors flex items-center gap-1"
            >
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'assistant' ? "bg-blue-500/20" : "bg-purple-500/20"
              )}>
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-blue-400" />
                ) : (
                  <User className="w-4 h-4 text-purple-400" />
                )}
              </div>
              
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                message.role === 'assistant' 
                  ? "bg-dark-card border border-dark-border" 
                  : "bg-purple-500/20"
              )}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                
                {message.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    {copiedId === message.id ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy response
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="bg-dark-card border border-dark-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-border">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about subscriptions, features, troubleshooting..."
            className="flex-1 px-4 py-3 bg-dark-card border border-dark-border rounded-xl focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
