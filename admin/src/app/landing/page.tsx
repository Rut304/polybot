'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: Target,
    title: 'Automated Arbitrage',
    description: 'Find price differences between Polymarket and Kalshi automatically.',
    tier: 'free',
  },
  {
    icon: Brain,
    title: 'AI Market Insights',
    description: 'Get AI-powered analysis on market movements and opportunities.',
    tier: 'pro',
  },
  {
    icon: TrendingUp,
    title: '10+ Trading Strategies',
    description: 'RSI, momentum, news-based, and more automated strategies.',
    tier: 'pro',
  },
  {
    icon: Fish,
    title: 'Whale Tracker',
    description: 'Follow and copy trades from the top performing wallets.',
    tier: 'elite',
  },
  {
    icon: Landmark,
    title: 'Congress Tracker',
    description: 'Trade alongside congressional stock movements.',
    tier: 'elite',
  },
  {
    icon: Calculator,
    title: 'Tax Reports',
    description: 'Automated tax calculations and Form 8949 export.',
    tier: 'elite',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for learning to trade prediction markets',
    icon: Gift,
    color: 'gray',
    features: [
      'Unlimited simulation trading',
      'Top 3 trading strategies',
      'Basic dashboard & analytics',
      'Community Discord access',
    ],
    limitations: ['No live trading', 'Limited strategies'],
    cta: 'Start Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    description: 'For active traders ready to go live',
    icon: Sparkles,
    color: 'blue',
    features: [
      'Everything in Free',
      '1,000 live trades/month',
      'All 10+ strategies',
      'Missed Money Analysis',
      'AI Market Insights',
      'Email support',
    ],
    limitations: [],
    cta: 'Start 7-Day Trial',
    popular: true,
  },
  {
    name: 'Elite',
    price: '$99.99',
    period: '/month',
    description: 'Maximum edge for serious traders',
    icon: Crown,
    color: 'yellow',
    features: [
      'Everything in Pro',
      'Unlimited live trades',
      'Whale Tracker',
      'Congress Tracker',
      'Tax Analysis & Reports',
      'Custom Strategy Builder',
      'API Access',
      'Priority support',
    ],
    limitations: [],
    cta: 'Go Elite',
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    quote: "Made $2,400 in my first month using the arbitrage scanner. The price differences are real.",
    author: "Alex T.",
    role: "Pro Member",
    avatar: "A",
  },
  {
    quote: "The whale tracker alone is worth Elite. Following smart money changed my win rate completely.",
    author: "Sarah M.",
    role: "Elite Member",
    avatar: "S",
  },
  {
    quote: "Started with paper trading, gained confidence, upgraded to Pro. Best investment I've made.",
    author: "Mike R.",
    role: "Pro Member",
    avatar: "M",
  },
];

const STATS = [
  { value: '$50M+', label: 'Volume Analyzed' },
  { value: '10K+', label: 'Opportunities Found' },
  { value: '87%', label: 'Avg Win Rate' },
  { value: '24/7', label: 'Market Monitoring' },
];

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/80 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-neon-green to-neon-blue rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">PolyParlay</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="#features" className="text-gray-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link 
                href="/login"
                className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/signup"
                className="px-4 py-2 bg-gradient-to-r from-neon-green to-neon-blue text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-neon-green/10 border border-neon-green/30 rounded-full text-neon-green text-sm font-medium mb-6">
              <Rocket className="w-4 h-4" />
              Now with unlimited free simulation trading
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Trade Prediction Markets
              <br />
              <span className="bg-gradient-to-r from-neon-green to-neon-blue bg-clip-text text-transparent">
                Like a Pro
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Automated arbitrage, AI insights, and whale tracking for Polymarket & Kalshi.
              Start with unlimited paper trading — no credit card required.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/signup"
                className="px-8 py-4 bg-gradient-to-r from-neon-green to-neon-blue text-white font-bold text-lg rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 group"
              >
                Start Free Simulation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#demo"
                className="px-8 py-4 bg-dark-card border border-dark-border text-white font-semibold text-lg rounded-xl hover:bg-dark-border transition-colors flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto"
          >
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-neon-green to-neon-blue bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-dark-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Win</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              From automated arbitrage to whale tracking, we give you the edge.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-neon-green/30 transition-colors"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                    feature.tier === 'free' && "bg-gray-500/20",
                    feature.tier === 'pro' && "bg-blue-500/20",
                    feature.tier === 'elite' && "bg-yellow-500/20",
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      feature.tier === 'free' && "text-gray-400",
                      feature.tier === 'pro' && "text-blue-400",
                      feature.tier === 'elite' && "text-yellow-400",
                    )} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    {feature.tier !== 'free' && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        feature.tier === 'pro' && "bg-blue-500/20 text-blue-400",
                        feature.tier === 'elite' && "bg-yellow-500/20 text-yellow-400",
                      )}>
                        {feature.tier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Start free, upgrade when you're ready to go live.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className={cn(
                    "relative bg-dark-card border rounded-2xl p-8",
                    plan.popular 
                      ? "border-neon-blue shadow-lg shadow-neon-blue/20" 
                      : "border-dark-border",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-neon-blue text-white text-sm font-semibold rounded-full">
                      Most Popular
                    </div>
                  )}
                  
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    plan.color === 'gray' && "bg-gray-500/20",
                    plan.color === 'blue' && "bg-blue-500/20",
                    plan.color === 'yellow' && "bg-yellow-500/20",
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      plan.color === 'gray' && "text-gray-400",
                      plan.color === 'blue' && "text-blue-400",
                      plan.color === 'yellow' && "text-yellow-400",
                    )} />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                  
                  <Link
                    href={plan.name === 'Free' ? '/signup' : '/signup?plan=' + plan.name.toLowerCase()}
                    className={cn(
                      "block w-full py-3 rounded-xl font-semibold text-center transition-all mb-6",
                      plan.popular
                        ? "bg-gradient-to-r from-neon-blue to-neon-green text-white hover:opacity-90"
                        : "bg-dark-border hover:bg-gray-700 text-white"
                    )}
                  >
                    {plan.cta}
                  </Link>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-neon-green flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((limitation, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-500">
                        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-dark-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Traders Love PolyParlay</h2>
            <p className="text-gray-400 text-lg">Join thousands of profitable prediction market traders.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-dark-card border border-dark-border rounded-xl p-6"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-neon-green/20 to-neon-blue/20 border border-neon-green/30 rounded-3xl p-12"
          >
            <h2 className="text-4xl font-bold mb-4">Ready to Start Winning?</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              Join thousands of traders using PolyParlay. Start with free simulation — no credit card needed.
            </p>
            <Link 
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-neon-green to-neon-blue text-white font-bold text-lg rounded-xl hover:opacity-90 transition-opacity group"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-dark-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-neon-green to-neon-blue rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">PolyParlay</span>
            </div>
            <div className="flex items-center gap-6 text-gray-500 text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              <span>© 2024 RuTroh LLC. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
