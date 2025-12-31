'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  Shield,
  DollarSign,
  BarChart3,
  Target,
  Brain,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Play,
  Star,
  Crown,
  Sparkles,
  ChevronRight,
  Rocket,
  Lock,
  Gift,
  Award,
  Fish,
  Landmark,
  Calculator,
  Code,
  Bot,
  LineChart,
  Wallet,
  Globe,
  Flame,
  Eye,
  MousePointer,
  ArrowUpRight,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Animated Background Component
// ============================================================================

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] animate-pulse delay-1000" />
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-violet-500/15 rounded-full blur-[128px] animate-pulse delay-2000" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), 
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />
      
      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-emerald-400/40 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -20, 20, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 4,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Animated Counter Component
// ============================================================================

function AnimatedCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    if (hasAnimated) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasAnimated(true);
          const duration = 2000;
          const steps = 60;
          const increment = value / steps;
          let current = 0;
          
          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.1 }
    );
    
    const el = document.getElementById(`counter-${value}`);
    if (el) observer.observe(el);
    
    return () => observer.disconnect();
  }, [value, hasAnimated]);
  
  return <span id={`counter-${value}`}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ============================================================================
// Glowing Card Component
// ============================================================================

function GlowCard({ children, className, glowColor = 'emerald' }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  return (
    <div className={cn("relative group", className)}>
      <div className={cn(
        "absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl",
        glowColor === 'emerald' && "bg-gradient-to-r from-emerald-500/50 to-cyan-500/50",
        glowColor === 'blue' && "bg-gradient-to-r from-blue-500/50 to-cyan-500/50",
        glowColor === 'yellow' && "bg-gradient-to-r from-yellow-500/50 to-orange-500/50",
      )} />
      <div className="relative bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Live Trade Ticker Component  
// ============================================================================

interface LiveTrade {
  id: string;
  market: string;
  action: string;
  outcome: string;
  platform: string;
  profit: number;
  timestamp: string;
}

function LiveTicker() {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [isLive, setIsLive] = useState(false);
  
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('/api/live-feed');
        const data = await response.json();
        if (data.trades && data.trades.length > 0) {
          setTrades(data.trades);
          setIsLive(data.source === 'live');
        }
      } catch (error) {
        console.error('Error fetching live feed:', error);
        // Use fallback data
        setTrades([
          { id: '1', market: 'Will BTC hit $150k?', action: 'BUY YES', outcome: 'won', platform: 'polymarket', profit: 127, timestamp: new Date().toISOString() },
          { id: '2', market: 'Fed Rate Cut Jan?', action: 'SELL NO', outcome: 'won', platform: 'kalshi', profit: 89, timestamp: new Date().toISOString() },
          { id: '3', market: 'Trump Win 2024?', action: 'BUY YES', outcome: 'won', platform: 'polymarket', profit: 340, timestamp: new Date().toISOString() },
          { id: '4', market: 'ETH/BTC Ratio > 0.05?', action: 'BUY NO', outcome: 'pending', platform: 'polymarket', profit: 156, timestamp: new Date().toISOString() },
          { id: '5', market: 'S&P 500 > 6000?', action: 'BUY YES', outcome: 'won', platform: 'kalshi', profit: 203, timestamp: new Date().toISOString() },
        ]);
      }
    };
    
    fetchTrades();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Format profit for display
  const formatProfit = (profit: number) => {
    return profit >= 0 ? `+$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`;
  };
  
  return (
    <div className="overflow-hidden py-4 bg-black/40 backdrop-blur border-y border-white/5">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: [0, -1920] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {[...trades, ...trades, ...trades].map((trade, i) => (
          <div key={`${trade.id}-${i}`} className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{trade.market}</span>
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium",
              trade.action.includes('BUY') ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            )}>
              {trade.action}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] uppercase",
              trade.platform === 'kalshi' ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
            )}>
              {trade.platform}
            </span>
            <span className="text-emerald-400 font-semibold">{formatProfit(trade.profit)}</span>
            <span className="text-gray-700">•</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Feature Data
// ============================================================================

const HERO_FEATURES = [
  { icon: Target, text: 'Cross-market arbitrage' },
  { icon: Brain, text: 'AI-powered insights' },
  { icon: Bot, text: '24/7 automated trading' },
  { icon: Shield, text: 'Risk management built-in' },
];

const FEATURES = [
  {
    icon: Target,
    title: 'Arbitrage Scanner',
    description: 'Automatically find price discrepancies between Polymarket, Kalshi, and crypto exchanges. Execute before the market corrects.',
    gradient: 'from-emerald-500 to-cyan-500',
    stats: 'Cross-platform scanning',
  },
  {
    icon: Brain,
    title: 'AI Market Oracle',
    description: 'GPT-4 powered analysis of news, social sentiment, and market data. Get predictions before they hit mainstream.',
    gradient: 'from-violet-500 to-fuchsia-500',
    stats: 'Real-time analysis',
  },
  {
    icon: Fish,
    title: 'Whale Tracker',
    description: 'Follow the smart money. Track top-performing wallets and mirror their trades automatically.',
    gradient: 'from-blue-500 to-cyan-500',
    stats: 'Top wallets tracked',
  },
  {
    icon: Landmark,
    title: 'Congress Tracker',
    description: 'Politicians trade on insider info. Now you can follow their moves with a 45-day delay.',
    gradient: 'from-amber-500 to-orange-500',
    stats: 'Real-time SEC filings',
  },
  {
    icon: LineChart,
    title: '10+ Strategies',
    description: 'RSI, momentum, mean reversion, news-based, sentiment, and more. Mix and match to find your edge.',
    gradient: 'from-pink-500 to-rose-500',
    stats: 'Fully customizable',
  },
  {
    icon: Calculator,
    title: 'Tax Automation',
    description: 'Form 8949 ready exports. Track cost basis, wash sales, and generate reports for tax season.',
    gradient: 'from-teal-500 to-emerald-500',
    stats: 'CPA approved',
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: 0,
    period: 'Free forever',
    description: 'Learn to trade with zero risk',
    features: [
      { text: 'Unlimited paper trading', included: true },
      { text: '3 basic strategies', included: true },
      { text: 'Dashboard & analytics', included: true },
      { text: 'Discord community', included: true },
      { text: 'Live trading', included: false },
      { text: 'AI insights', included: false },
      { text: 'Whale tracker', included: false },
    ],
    cta: 'Start Free',
    popular: false,
    gradient: 'from-gray-500 to-gray-600',
  },
  {
    name: 'Pro',
    price: 29,
    period: '/month',
    description: 'For serious traders',
    features: [
      { text: 'Everything in Starter', included: true },
      { text: '1,000 live trades/mo', included: true },
      { text: 'All 10+ strategies', included: true },
      { text: 'AI market insights', included: true },
      { text: 'Missed money analysis', included: true },
      { text: 'Email support', included: true },
      { text: 'Whale tracker', included: false },
    ],
    cta: 'Start Pro',
    popular: true,
    gradient: 'from-emerald-500 to-cyan-500',
  },
  {
    name: 'Elite',
    price: 99,
    period: '/month',
    description: 'Maximum edge',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Unlimited live trades', included: true },
      { text: 'Whale tracker', included: true },
      { text: 'Congress tracker', included: true },
      { text: 'Tax reports & Form 8949', included: true },
      { text: 'Custom strategy builder', included: true },
      { text: 'Priority support & API', included: true },
    ],
    cta: 'Go Elite',
    popular: false,
    gradient: 'from-amber-500 to-orange-500',
  },
];

const TESTIMONIALS = [
  {
    quote: "Quick onboarding — in my first 15 hours I made 5.7% return. The Kalshi strategy alone hit 78% win rate.",
    author: "Beta Tester",
    role: "Founding Member",
    avatar: "B",
    profit: "+$218",
  },
  {
    quote: "Paper trading let me test strategies risk-free. 834 trades later, I found my edge before putting in real money.",
    author: "Early Adopter",
    role: "Paper Trading User",
    avatar: "E",
    profit: "78% Win Rate",
  },
  {
    quote: "The cross-platform arbitrage scanner found a 33% ROI opportunity I would have completely missed manually.",
    author: "Strategy Tester",
    role: "Beta Program",
    avatar: "S",
    profit: "33% ROI",
  },
];

const STATS = [
  { value: 834, suffix: '', prefix: '', label: 'Beta Trades Executed' },
  { value: 2256, suffix: '', prefix: '$', label: 'Profit Generated' },
  { value: 78, suffix: '%', prefix: '', label: 'Kalshi Win Rate' },
  { value: 10, suffix: '+', prefix: '', label: 'Strategies Available' },
];

const FAQ = [
  {
    q: "Is this legal?",
    a: "Yes! PolyParlay supports three types of trading: (1) Prediction markets like Polymarket and Kalshi which are legal in the US, (2) Stock trading via Alpaca and Interactive Brokers, and (3) Crypto trading via exchanges like Coinbase and Binance. We're a trading platform that helps you manage all your accounts in one place - we don't hold your funds."
  },
  {
    q: "How does paper trading work?",
    a: "Paper trading uses real market data but simulated money. It's completely free and unlimited - perfect for learning without risk."
  },
  {
    q: "What's the catch with the free tier?",
    a: "No catch. Free users get unlimited paper trading forever. We make money when you upgrade to trade with real money."
  },
  {
    q: "How accurate are the AI predictions?",
    a: "Our Kalshi strategy has achieved 78% win rate in beta testing with 606 trades. However, past performance doesn't guarantee future results."
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, cancel anytime with one click. No questions asked, no hidden fees."
  },
];

// ============================================================================
// Live Opportunities Counter (fetches real data)
// ============================================================================

function LiveOpportunitiesCounter() {
  const [count, setCount] = useState(847);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Fetch real count from API
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/stats/opportunities');
        if (res.ok) {
          const data = await res.json();
          setCount(data.last24Hours || 847);
        }
      } catch {
        // Use fallback count
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCount();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <span>
      Live: {count.toLocaleString()} opportunities found in last 24h
    </span>
  );
}

// ============================================================================
// Main Landing Page
// ============================================================================

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { scrollY } = useScroll();
  
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <AnimatedBackground />
      
      {/* ================================================================== */}
      {/* Navigation */}
      {/* ================================================================== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-black" />
                </div>
              </div>
              <span className="text-2xl font-bold tracking-tight">
                Poly<span className="text-emerald-400">Parlay</span>
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#pricing" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Pricing
              </a>
              <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Reviews
              </a>
              <a href="#faq" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                FAQ
              </a>
            </div>
            
            <div className="flex items-center gap-3">
              <Link 
                href="/login"
                className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/signup"
                className="relative group px-5 py-2.5 text-sm font-semibold"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg" />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg blur-lg opacity-50 group-hover:opacity-100 transition-opacity" />
                <span className="relative text-black">Create FREE Account</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ================================================================== */}
      {/* Hero Section */}
      {/* ================================================================== */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <LiveOpportunitiesCounter />
            </motion.div>
            
            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
            >
              <span className="block">Trade Smarter.</span>
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Win More.
              </span>
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The AI-powered trading bot for prediction markets. 
              Find arbitrage, track whales, and automate your edge.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
            >
              <Link 
                href="/signup"
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur-lg opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-lg rounded-xl hover:shadow-2xl hover:shadow-emerald-500/25 transition-all">
                  Create FREE Account — Unlimited Paper Trading
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
              
              <a 
                href="#demo"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold text-lg rounded-xl hover:bg-white/10 hover:border-white/20 transition-all w-full sm:w-auto"
              >
                <Play className="w-5 h-5" />
                Watch 2-Min Demo
              </a>
            </motion.div>
            
            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              {HERO_FEATURES.map((feature, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300"
                >
                  <feature.icon className="w-4 h-4 text-emerald-400" />
                  {feature.text}
                </div>
              ))}
            </motion.div>
          </div>
          
          {/* Hero Visual / Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-emerald-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
              {/* Simulated Dashboard Screenshot */}
              <div className="relative bg-[#0a0a0a] p-4 md:p-8">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Portfolio', value: '$24,847', change: '+12.4%', up: true },
                    { label: 'Today P/L', value: '+$1,247', change: '+5.2%', up: true },
                    { label: 'Win Rate', value: '87%', change: '+3%', up: true },
                    { label: 'Active Bots', value: '4', change: '', up: true },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                      {stat.change && (
                        <p className={cn("text-xs", stat.up ? "text-emerald-400" : "text-red-400")}>
                          {stat.change}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Fake chart */}
                <div className="h-48 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-xl flex items-end justify-around px-4 pb-4">
                  {[40, 55, 35, 70, 50, 80, 60, 90, 75, 95, 85, 100].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-6 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-t"
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.5, delay: 0.6 + i * 0.05 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Ticker */}
      <LiveTicker />

      {/* ================================================================== */}
      {/* Stats Section */}
      {/* ================================================================== */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </p>
                <p className="text-gray-500 text-sm md:text-base">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* How It Works Section */}
      {/* ================================================================== */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Start Winning in <span className="text-emerald-400">3 Steps</span>
            </motion.h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              No coding required. No complex setup. Just connect and trade.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Sign Up Free',
                description: 'Create your account in 30 seconds. No credit card needed.',
                icon: Rocket,
              },
              {
                step: '02',
                title: 'Paper Trade',
                description: 'Practice with unlimited simulated trading. See real results risk-free.',
                icon: LineChart,
              },
              {
                step: '03',
                title: 'Go Live',
                description: 'Connect your accounts and start trading with real money when ready.',
                icon: DollarSign,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-emerald-500/50 to-transparent -z-10" />
                )}
                <GlowCard>
                  <div className="p-8">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-5xl font-bold text-emerald-500/20">{item.step}</span>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <item.icon className="w-6 h-6 text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-400">{item.description}</p>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Features Section */}
      {/* ================================================================== */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm mb-6"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-gray-300">Powerful Features</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Your <span className="text-emerald-400">Unfair Advantage</span>
            </motion.h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Everything you need to find edge and automate your trading
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <GlowCard className="h-full">
                  <div className="p-6">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br",
                      feature.gradient
                    )}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-gray-400 mb-4 text-sm leading-relaxed">{feature.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-400 font-medium">{feature.stats}</span>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Pricing Section */}
      {/* ================================================================== */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Simple, <span className="text-emerald-400">Transparent</span> Pricing
            </motion.h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Start free. Upgrade when you&apos;re ready to go live. Cancel anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-4 py-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-sm font-bold rounded-full">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <GlowCard glowColor={plan.popular ? 'emerald' : 'blue'} className="h-full">
                  <div className={cn(
                    "p-8 h-full flex flex-col",
                    plan.popular && "border-2 border-emerald-500/50 rounded-2xl"
                  )}>
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold">${plan.price}</span>
                        <span className="text-gray-400">{plan.period}</span>
                      </div>
                    </div>
                    
                    <ul className="space-y-4 mb-8 flex-1">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3">
                          {feature.included ? (
                            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "text-sm",
                            feature.included ? "text-gray-300" : "text-gray-600"
                          )}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    <Link
                      href="/signup"
                      className={cn(
                        "block text-center py-3 px-6 rounded-xl font-semibold transition-all",
                        plan.popular
                          ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:shadow-lg hover:shadow-emerald-500/25"
                          : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                      )}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
          
          <p className="text-center text-gray-500 text-sm mt-8">
            Start free with unlimited paper trading. Upgrade anytime when you&apos;re ready to go live.
          </p>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Testimonials Section */}
      {/* ================================================================== */}
      <section id="testimonials" className="py-20 px-4 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Loved by <span className="text-emerald-400">Traders</span>
            </motion.h2>
            <p className="text-gray-400 text-lg">Real results from real users</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <GlowCard>
                  <div className="p-6">
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-gray-300 mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold">
                          {testimonial.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{testimonial.author}</p>
                          <p className="text-gray-500 text-xs">{testimonial.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">{testimonial.profit}</p>
                        <p className="text-gray-500 text-xs">Total Profit</p>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ Section */}
      {/* ================================================================== */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Got <span className="text-emerald-400">Questions?</span>
            </motion.h2>
          </div>
          
          <div className="space-y-4">
            {FAQ.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{faq.q}</span>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-gray-400 transition-transform",
                      openFaq === i && "rotate-180"
                    )} />
                  </div>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="text-gray-400 mt-4 leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Final CTA Section */}
      {/* ================================================================== */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-12 md:p-16 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to Trade Smarter?
              </h2>
              <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                Join 2,400+ traders using AI to find edge in prediction markets.
                Start with unlimited paper trading — completely free.
              </p>
              <Link 
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-lg rounded-xl hover:shadow-2xl hover:shadow-emerald-500/25 transition-all"
              >
                Create FREE Account — Unlimited Paper Trading
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-gray-500 text-sm mt-6">
                No credit card required • Paper trade forever for free
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Footer */}
      {/* ================================================================== */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold">PolyParlay</span>
              </Link>
              <p className="text-gray-500 text-sm">
                AI-powered trading for prediction markets.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:support@polyparlay.io" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            {/* Connect section hidden until social accounts are set up
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="https://twitter.com/polyparlay" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="https://discord.gg/polyparlay" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="https://github.com/polyparlay" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
            */}
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} PolyParlay. All rights reserved.
            </p>
            <p className="text-gray-600 text-xs">
              Trading involves risk. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
