'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  ExternalLink,
  Copy,
  AlertTriangle,
  Info,
  Clock,
  Shield,
  Key,
  Link2,
  Building2,
  Coins,
  Target,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ===========================
// PLATFORM CONFIGURATION DATA
// ===========================

interface SetupStep {
  title: string;
  description: string;
  action?: 'link' | 'input' | 'checkbox' | 'info';
  link?: string;
  linkText?: string;
  inputFields?: {
    name: string;
    label: string;
    placeholder: string;
    type: 'text' | 'password';
    required: boolean;
    helpText?: string;
  }[];
  checkboxText?: string;
  warning?: string;
  tip?: string;
  image?: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'prediction' | 'crypto' | 'stocks' | 'options';
  description: string;
  requirements: string[];
  restrictions: string[];
  fees?: string;
  approvalRequired: boolean;
  approvalTime?: string;
  apiKeyType: 'oauth' | 'api_key' | 'api_key_secret' | 'api_key_secret_passphrase';
  steps: SetupStep[];
  secretNames: string[];
  testEndpoint?: string;
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  // ===========================
  // PREDICTION MARKETS
  // ===========================
  polymarket: {
    id: 'polymarket',
    name: 'Polymarket',
    icon: '🎯',
    color: 'purple',
    category: 'prediction',
    description: 'Decentralized prediction market on Polygon. No trading fees!',
    requirements: [
      'Polygon wallet (MetaMask, Coinbase Wallet, etc.)',
      'USDC on Polygon network',
      'Email account for sign-up',
    ],
    restrictions: [
      '⚠️ Not available to US residents (VPN at your own risk)',
      'Minimum trade size: $1',
      'Withdrawal requires Polygon gas fees (~$0.01)',
    ],
    fees: '0% trading fees, 0% withdrawal fees',
    approvalRequired: false,
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Polymarket Account',
        description: 'Sign up for a Polymarket account using your email or wallet.',
        action: 'link',
        link: 'https://polymarket.com',
        linkText: 'Go to Polymarket',
        tip: 'Use a VPN if you\'re in a restricted region (at your own risk).',
      },
      {
        title: 'Fund Your Account',
        description: 'Deposit USDC to your Polymarket account. You can bridge from Ethereum or buy directly.',
        action: 'link',
        link: 'https://polymarket.com/deposit',
        linkText: 'Deposit USDC',
        tip: 'Recommended starting balance: $100-500 for paper testing strategies.',
      },
      {
        title: 'Generate API Credentials',
        description: 'Navigate to Settings → API Keys to create your trading credentials.',
        action: 'link',
        link: 'https://polymarket.com/settings/api-keys',
        linkText: 'Manage API Keys',
        warning: 'Keep your API secret secure. Never share it with anyone.',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API Key and Secret from Polymarket and paste them below.',
        action: 'input',
        inputFields: [
          {
            name: 'POLYMARKET_API_KEY',
            label: 'API Key',
            placeholder: 'pk_...',
            type: 'text',
            required: true,
            helpText: 'Starts with "pk_"',
          },
          {
            name: 'POLYMARKET_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your secret key',
            type: 'password',
            required: true,
            helpText: 'Keep this secret - never share it',
          },
        ],
      },
      {
        title: 'Verify Connection',
        description: 'We\'ll test your credentials to make sure everything is working.',
        action: 'info',
        tip: 'If verification fails, double-check that you copied the full API key and secret.',
      },
    ],
    secretNames: ['POLYMARKET_API_KEY', 'POLYMARKET_API_SECRET'],
  },

  kalshi: {
    id: 'kalshi',
    name: 'Kalshi',
    icon: '📊',
    color: 'blue',
    category: 'prediction',
    description: 'CFTC-regulated prediction market. Legal for US residents!',
    requirements: [
      'US residency with valid SSN',
      'Must be 18+ years old',
      'US bank account for deposits/withdrawals',
    ],
    restrictions: [
      'US residents only',
      'Some states restricted (check Kalshi\'s list)',
      '7% fee on profits (not on losses)',
      'Daily/weekly position limits on some markets',
    ],
    fees: '7% fee on net profits only',
    approvalRequired: true,
    approvalTime: '1-3 business days for identity verification',
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Kalshi Account',
        description: 'Sign up and complete identity verification (KYC). This is required by US regulations.',
        action: 'link',
        link: 'https://kalshi.com/sign-up',
        linkText: 'Sign Up for Kalshi',
        warning: 'You\'ll need your SSN and government ID for verification.',
      },
      {
        title: 'Wait for Account Approval',
        description: 'Kalshi reviews your identity documents. This typically takes 1-3 business days.',
        action: 'info',
        tip: 'You\'ll receive an email when your account is approved.',
      },
      {
        title: 'Fund Your Account',
        description: 'Link your bank account and deposit funds via ACH transfer.',
        action: 'link',
        link: 'https://kalshi.com/wallet',
        linkText: 'Add Funds',
        tip: 'ACH deposits are free. Wire transfers have a $25 fee.',
      },
      {
        title: 'Generate API Credentials',
        description: 'Go to Settings → API Access to create your API key.',
        action: 'link',
        link: 'https://kalshi.com/settings/api',
        linkText: 'Manage API Keys',
        warning: 'Generate a key with "Trade" permissions for full functionality.',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API credentials and paste them below.',
        action: 'input',
        inputFields: [
          {
            name: 'KALSHI_API_KEY',
            label: 'API Key (Email)',
            placeholder: 'your.email@example.com',
            type: 'text',
            required: true,
            helpText: 'Your Kalshi login email',
          },
          {
            name: 'KALSHI_API_SECRET',
            label: 'API Password',
            placeholder: 'Your API password',
            type: 'password',
            required: true,
            helpText: 'The password you created for API access',
          },
        ],
      },
    ],
    secretNames: ['KALSHI_API_KEY', 'KALSHI_API_SECRET'],
  },

  // ===========================
  // INTERACTIVE BROKERS (Special OAuth flow)
  // ===========================
  ibkr: {
    id: 'ibkr',
    name: 'Interactive Brokers',
    icon: '🏦',
    color: 'red',
    category: 'options',
    description: 'Professional-grade broker for stocks, options, futures, and forex.',
    requirements: [
      'IBKR Pro account (not IBKR Lite for full API access)',
      'Web API subscription enabled in Account Management',
      'Minimum $0 to open, but $2,000+ recommended',
      'US residents: Must be 18+, non-US varies by country',
    ],
    restrictions: [
      '⚠️ IBKR Lite has limited API functionality',
      '⚠️ Web API requires separate subscription (free)',
      'Pattern Day Trader rules apply ($25K minimum for unlimited day trades)',
      'Options trading requires separate approval',
      'Margin accounts require $2,000 minimum',
    ],
    fees: '$0 commission on US stocks, $0.65/contract for options',
    approvalRequired: true,
    approvalTime: '1-5 business days for account approval',
    apiKeyType: 'oauth',
    steps: [
      {
        title: 'Account Requirements',
        description: 'Before connecting, ensure you have the right account setup:',
        action: 'info',
        warning: 'IBKR Lite users: Your API access is limited. Consider upgrading to IBKR Pro for full trading capabilities.',
      },
      {
        title: 'Create or Login to IBKR Account',
        description: 'If you don\'t have an account, sign up for IBKR Pro (recommended for API trading).',
        action: 'link',
        link: 'https://www.interactivebrokers.com/en/trading/individual.php',
        linkText: 'Open IBKR Account',
        tip: 'Select "IBKR Pro" for lowest commissions and full API access.',
      },
      {
        title: 'Enable Web API Access',
        description: 'In Account Management, navigate to Settings → API → Web API and enable it.',
        action: 'link',
        link: 'https://www.interactivebrokers.com/portal',
        linkText: 'Go to Account Management',
        warning: 'This is a FREE subscription but must be explicitly enabled.',
      },
      {
        title: 'Paper Trading Setup (Optional)',
        description: 'For testing, enable paper trading in Account Management → Settings → Paper Trading.',
        action: 'info',
        tip: 'Paper trading lets you test strategies without risking real money. Highly recommended!',
      },
      {
        title: 'Connect via OAuth',
        description: 'Click the button below to securely connect your IBKR account. You\'ll be redirected to IBKR to authorize access.',
        action: 'info',
        tip: 'OAuth is the most secure way to connect. Your password is never shared with us.',
      },
    ],
    secretNames: [], // OAuth handles this
  },

  // ===========================
  // CRYPTO EXCHANGES
  // ===========================
  alpaca: {
    id: 'alpaca',
    name: 'Alpaca',
    icon: '🦙',
    color: 'green',
    category: 'stocks',
    description: 'Commission-free stock and crypto trading with excellent API.',
    requirements: [
      'US residency (or supported country)',
      'Must be 18+ years old',
      'Social Security Number (US) or Tax ID',
    ],
    restrictions: [
      'Crypto trading not available in all states',
      'Pattern Day Trader rules apply for margin accounts',
      'Paper trading available for testing',
    ],
    fees: '$0 commission on stocks, crypto fees vary',
    approvalRequired: true,
    approvalTime: '1-3 business days',
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Alpaca Account',
        description: 'Sign up for a free Alpaca account. Paper trading is available immediately!',
        action: 'link',
        link: 'https://app.alpaca.markets/signup',
        linkText: 'Sign Up for Alpaca',
        tip: 'You can start paper trading immediately while waiting for live account approval.',
      },
      {
        title: 'Complete Verification',
        description: 'For live trading, complete identity verification with your SSN and ID.',
        action: 'info',
        tip: 'Paper trading doesn\'t require verification.',
      },
      {
        title: 'Generate API Keys',
        description: 'Go to your Alpaca dashboard and create API keys.',
        action: 'link',
        link: 'https://app.alpaca.markets/paper/dashboard/overview',
        linkText: 'Go to Dashboard',
        warning: 'For paper trading, use Paper Trading API keys. For live, use Live API keys.',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API Key ID and Secret Key from Alpaca.',
        action: 'input',
        inputFields: [
          {
            name: 'ALPACA_API_KEY',
            label: 'API Key ID',
            placeholder: 'PKXXXXXXXXXXXXXXXX',
            type: 'text',
            required: true,
            helpText: 'Starts with "PK" for paper or "AK" for live',
          },
          {
            name: 'ALPACA_API_SECRET',
            label: 'Secret Key',
            placeholder: 'Your secret key',
            type: 'password',
            required: true,
            helpText: 'Keep this secure',
          },
        ],
      },
      {
        title: 'Select Trading Mode',
        description: 'Choose whether to use paper trading or live trading.',
        action: 'checkbox',
        checkboxText: 'Use Paper Trading (recommended for testing)',
      },
    ],
    secretNames: ['ALPACA_API_KEY', 'ALPACA_API_SECRET'],
  },

  binance: {
    id: 'binance',
    name: 'Binance',
    icon: '🟡',
    color: 'yellow',
    category: 'crypto',
    description: 'World\'s largest crypto exchange by volume.',
    requirements: [
      'Email address',
      'Phone number for 2FA',
      'Identity verification for higher limits',
    ],
    restrictions: [
      '⚠️ Binance.com not available to US residents - use Binance.US',
      'Withdrawal limits based on verification level',
      'Some features restricted by country',
    ],
    fees: '0.1% spot trading fee (lower with BNB)',
    approvalRequired: false,
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Binance Account',
        description: 'Sign up for Binance (or Binance.US if you\'re in the United States).',
        action: 'link',
        link: 'https://www.binance.com/en/register',
        linkText: 'Sign Up for Binance',
        warning: 'US residents must use Binance.US: https://www.binance.us',
      },
      {
        title: 'Enable Two-Factor Authentication',
        description: 'For security, enable 2FA before creating API keys.',
        action: 'link',
        link: 'https://www.binance.com/en/my/security',
        linkText: 'Security Settings',
        warning: 'API keys cannot be created without 2FA enabled.',
      },
      {
        title: 'Create API Key',
        description: 'Go to API Management and create a new API key.',
        action: 'link',
        link: 'https://www.binance.com/en/my/settings/api-management',
        linkText: 'API Management',
        tip: 'Label it something recognizable like "PolyParlay Trading Bot"',
      },
      {
        title: 'Configure API Permissions',
        description: 'Enable "Enable Reading" and "Enable Spot & Margin Trading". Do NOT enable withdrawals.',
        action: 'info',
        warning: '🔒 Never enable "Enable Withdrawals" for trading bots!',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API Key and Secret from Binance.',
        action: 'input',
        inputFields: [
          {
            name: 'BINANCE_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'BINANCE_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your API secret',
            type: 'password',
            required: true,
            helpText: 'This is only shown once when created!',
          },
        ],
      },
    ],
    secretNames: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'],
  },

  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    icon: '🔵',
    color: 'blue',
    category: 'crypto',
    description: 'Most trusted US crypto exchange. Great for beginners.',
    requirements: [
      'Valid government ID',
      'US bank account or debit card',
      'Must be 18+ years old',
    ],
    restrictions: [
      'Higher fees than other exchanges (use Coinbase Advanced for lower fees)',
      'Some coins not available in all states',
      'Withdrawal holds for new payment methods',
    ],
    fees: '0.5% spread + transaction fee (Advanced: 0.6% maker/taker)',
    approvalRequired: true,
    approvalTime: 'Usually instant, up to 24 hours for full verification',
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Coinbase Account',
        description: 'Sign up for Coinbase and complete identity verification.',
        action: 'link',
        link: 'https://www.coinbase.com/signup',
        linkText: 'Sign Up for Coinbase',
      },
      {
        title: 'Upgrade to Coinbase Advanced',
        description: 'For API trading, you\'ll use Coinbase Advanced (formerly Coinbase Pro).',
        action: 'link',
        link: 'https://www.coinbase.com/advanced',
        linkText: 'Go to Advanced Trade',
        tip: 'Lower fees than regular Coinbase!',
      },
      {
        title: 'Create API Key',
        description: 'In Settings → API, create a new API key with trading permissions.',
        action: 'link',
        link: 'https://www.coinbase.com/settings/api',
        linkText: 'API Settings',
        warning: 'Select "Trade" permission. Do NOT select "Transfer" for security.',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API credentials from Coinbase.',
        action: 'input',
        inputFields: [
          {
            name: 'COINBASE_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'COINBASE_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your API secret',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
    secretNames: ['COINBASE_API_KEY', 'COINBASE_API_SECRET'],
  },

  kraken: {
    id: 'kraken',
    name: 'Kraken',
    icon: '🐙',
    color: 'purple',
    category: 'crypto',
    description: 'Established crypto exchange with strong security track record.',
    requirements: [
      'Email address',
      'Government ID for verification',
      'Proof of residence for higher limits',
    ],
    restrictions: [
      'Some features not available in certain US states',
      'Margin trading requires additional verification',
      'Staking not available to US clients',
    ],
    fees: '0.16% maker / 0.26% taker',
    approvalRequired: true,
    approvalTime: '1-5 days depending on verification level',
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Kraken Account',
        description: 'Sign up and verify your identity to unlock trading.',
        action: 'link',
        link: 'https://www.kraken.com/sign-up',
        linkText: 'Sign Up for Kraken',
      },
      {
        title: 'Complete Verification',
        description: 'At minimum, complete Intermediate verification for trading.',
        action: 'link',
        link: 'https://www.kraken.com/u/verify',
        linkText: 'Verify Identity',
        tip: 'Intermediate level unlocks crypto deposits and trading.',
      },
      {
        title: 'Create API Key',
        description: 'In Settings → API, create a key with trade permissions.',
        action: 'link',
        link: 'https://www.kraken.com/u/security/api',
        linkText: 'API Management',
        warning: 'Only enable "Query Funds" and "Create & Modify Orders". Never enable withdrawals!',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API Key and Private Key from Kraken.',
        action: 'input',
        inputFields: [
          {
            name: 'KRAKEN_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'KRAKEN_API_SECRET',
            label: 'Private Key',
            placeholder: 'Your private key (base64)',
            type: 'password',
            required: true,
            helpText: 'This is the base64-encoded private key',
          },
        ],
      },
    ],
    secretNames: ['KRAKEN_API_KEY', 'KRAKEN_API_SECRET'],
  },

  kucoin: {
    id: 'kucoin',
    name: 'KuCoin',
    icon: '🟢',
    color: 'green',
    category: 'crypto',
    description: 'Popular exchange with wide altcoin selection.',
    requirements: [
      'Email address',
      'Optional: KYC for higher limits',
    ],
    restrictions: [
      'Not officially available to US residents',
      'Non-KYC accounts have withdrawal limits',
      'Some trading pairs restricted by region',
    ],
    fees: '0.1% spot trading fee',
    approvalRequired: false,
    apiKeyType: 'api_key_secret_passphrase',
    steps: [
      {
        title: 'Create KuCoin Account',
        description: 'Sign up for KuCoin with your email.',
        action: 'link',
        link: 'https://www.kucoin.com/ucenter/signup',
        linkText: 'Sign Up for KuCoin',
        warning: 'KuCoin is not officially available to US residents.',
      },
      {
        title: 'Enable 2FA',
        description: 'Set up Google Authenticator or other 2FA for security.',
        action: 'link',
        link: 'https://www.kucoin.com/account/security',
        linkText: 'Security Settings',
      },
      {
        title: 'Create API Key',
        description: 'In API Management, create a new API key with a passphrase.',
        action: 'link',
        link: 'https://www.kucoin.com/account/api',
        linkText: 'API Management',
        warning: 'You\'ll need to create a Trading Password and API Passphrase.',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'KuCoin requires 3 pieces: API Key, Secret, and Passphrase.',
        action: 'input',
        inputFields: [
          {
            name: 'KUCOIN_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'KUCOIN_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your API secret',
            type: 'password',
            required: true,
          },
          {
            name: 'KUCOIN_API_PASSPHRASE',
            label: 'API Passphrase',
            placeholder: 'Your passphrase',
            type: 'password',
            required: true,
            helpText: 'The passphrase you created with the API key',
          },
        ],
      },
    ],
    secretNames: ['KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_API_PASSPHRASE'],
  },

  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    icon: '💧',
    color: 'cyan',
    category: 'crypto',
    description: 'On-chain perpetuals DEX with CEX-like experience. Great for whale tracking!',
    requirements: [
      'Ethereum wallet (MetaMask, etc.)',
      'USDC on Arbitrum network',
    ],
    restrictions: [
      'Perpetual futures only (no spot trading)',
      'High leverage available (use with caution)',
      'On-chain = your keys, your crypto',
    ],
    fees: '0.01% maker / 0.035% taker',
    approvalRequired: false,
    apiKeyType: 'api_key',
    steps: [
      {
        title: 'Connect Wallet',
        description: 'Connect your Ethereum wallet to Hyperliquid.',
        action: 'link',
        link: 'https://app.hyperliquid.xyz',
        linkText: 'Go to Hyperliquid',
        tip: 'Make sure you have USDC on Arbitrum to deposit.',
      },
      {
        title: 'Deposit Funds',
        description: 'Bridge USDC from Arbitrum to Hyperliquid.',
        action: 'info',
        tip: 'You can also deposit directly from CEXs that support Arbitrum withdrawals.',
      },
      {
        title: 'Generate API Key',
        description: 'In Settings → API, create an API wallet for trading.',
        action: 'link',
        link: 'https://app.hyperliquid.xyz/portfolio',
        linkText: 'Go to Portfolio',
        warning: 'The API wallet is a separate signing key - not your main wallet!',
      },
      {
        title: 'Enter API Wallet Key',
        description: 'Enter your Hyperliquid API wallet private key.',
        action: 'input',
        inputFields: [
          {
            name: 'HYPERLIQUID_API_KEY',
            label: 'API Wallet Private Key',
            placeholder: '0x...',
            type: 'password',
            required: true,
            helpText: 'This is the private key of your API sub-wallet',
          },
          {
            name: 'HYPERLIQUID_WALLET_ADDRESS',
            label: 'Main Wallet Address',
            placeholder: '0x...',
            type: 'text',
            required: true,
            helpText: 'Your main wallet address (for reference)',
          },
        ],
      },
    ],
    secretNames: ['HYPERLIQUID_API_KEY', 'HYPERLIQUID_WALLET_ADDRESS'],
  },

  bybit: {
    id: 'bybit',
    name: 'Bybit',
    icon: '⚫',
    color: 'gray',
    category: 'crypto',
    description: 'Popular derivatives exchange with spot trading.',
    requirements: [
      'Email address',
      'KYC for higher limits',
    ],
    restrictions: [
      'Not available to US residents',
      'Some products restricted by region',
    ],
    fees: '0.1% spot, 0.01%/0.06% futures maker/taker',
    approvalRequired: false,
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Bybit Account',
        description: 'Sign up for Bybit with your email.',
        action: 'link',
        link: 'https://www.bybit.com/register',
        linkText: 'Sign Up for Bybit',
        warning: 'Not available to US residents.',
      },
      {
        title: 'Complete KYC (Optional)',
        description: 'Verify your identity for higher trading and withdrawal limits.',
        action: 'info',
      },
      {
        title: 'Create API Key',
        description: 'In Account → API Management, create a new API key.',
        action: 'link',
        link: 'https://www.bybit.com/user/api-management',
        linkText: 'API Management',
        warning: 'Enable "Read-Write" for trading. Never enable "Assets" permissions!',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'Copy your API Key and Secret from Bybit.',
        action: 'input',
        inputFields: [
          {
            name: 'BYBIT_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'BYBIT_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your API secret',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
    secretNames: ['BYBIT_API_KEY', 'BYBIT_API_SECRET'],
  },

  okx: {
    id: 'okx',
    name: 'OKX',
    icon: '⚪',
    color: 'white',
    category: 'crypto',
    description: 'Major exchange with comprehensive trading features.',
    requirements: [
      'Email or phone number',
      'KYC for trading',
    ],
    restrictions: [
      'Not available to US residents',
      'Some features vary by region',
    ],
    fees: '0.08% maker / 0.1% taker (spot)',
    approvalRequired: true,
    approvalTime: '1-3 days for KYC',
    apiKeyType: 'api_key_secret_passphrase',
    steps: [
      {
        title: 'Create OKX Account',
        description: 'Sign up for OKX and complete verification.',
        action: 'link',
        link: 'https://www.okx.com/account/register',
        linkText: 'Sign Up for OKX',
        warning: 'Not available to US residents.',
      },
      {
        title: 'Complete KYC',
        description: 'Identity verification is required for API access.',
        action: 'info',
      },
      {
        title: 'Create API Key',
        description: 'In Settings → API, create a key with a passphrase.',
        action: 'link',
        link: 'https://www.okx.com/account/my-api',
        linkText: 'API Management',
        warning: 'You must set a passphrase - remember it!',
      },
      {
        title: 'Enter Your API Credentials',
        description: 'OKX requires API Key, Secret, and Passphrase.',
        action: 'input',
        inputFields: [
          {
            name: 'OKX_API_KEY',
            label: 'API Key',
            placeholder: 'Your API key',
            type: 'text',
            required: true,
          },
          {
            name: 'OKX_API_SECRET',
            label: 'API Secret',
            placeholder: 'Your API secret',
            type: 'password',
            required: true,
          },
          {
            name: 'OKX_API_PASSPHRASE',
            label: 'Passphrase',
            placeholder: 'Your passphrase',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
    secretNames: ['OKX_API_KEY', 'OKX_API_SECRET', 'OKX_API_PASSPHRASE'],
  },

  webull: {
    id: 'webull',
    name: 'Webull',
    icon: '🐂',
    color: 'orange',
    category: 'stocks',
    description: 'Commission-free stock and options trading.',
    requirements: [
      'US residency',
      'Must be 18+',
      'SSN required',
    ],
    restrictions: [
      'Limited API access - mainly for data, not automated trading',
      'Pattern Day Trader rules apply',
      'Options require separate approval',
    ],
    fees: '$0 commission on stocks',
    approvalRequired: true,
    approvalTime: '1-3 days',
    apiKeyType: 'api_key_secret',
    steps: [
      {
        title: 'Create Webull Account',
        description: 'Sign up for Webull and verify your identity.',
        action: 'link',
        link: 'https://www.webull.com/activity',
        linkText: 'Sign Up for Webull',
      },
      {
        title: 'Note on API Access',
        description: 'Webull\'s official API is limited. This integration uses unofficial methods that may have restrictions.',
        action: 'info',
        warning: 'Webull API access is more limited than other brokers. Consider Alpaca for better API support.',
      },
      {
        title: 'Enter Credentials',
        description: 'Use your Webull login credentials (we store them securely).',
        action: 'input',
        inputFields: [
          {
            name: 'WEBULL_EMAIL',
            label: 'Email/Phone',
            placeholder: 'Your Webull login',
            type: 'text',
            required: true,
          },
          {
            name: 'WEBULL_PASSWORD',
            label: 'Password',
            placeholder: 'Your password',
            type: 'password',
            required: true,
            helpText: 'Stored encrypted, never shared',
          },
          {
            name: 'WEBULL_TRADING_PIN',
            label: 'Trading PIN',
            placeholder: '6-digit PIN',
            type: 'password',
            required: true,
          },
        ],
      },
    ],
    secretNames: ['WEBULL_EMAIL', 'WEBULL_PASSWORD', 'WEBULL_TRADING_PIN'],
  },
};

// ===========================
// SETUP WIZARD COMPONENT
// ===========================

interface PlatformSetupWizardProps {
  platformId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (secrets: Record<string, string>) => void;
  mode?: 'simulation' | 'live';  // New: simulation mode skips credential setup
}

export function PlatformSetupWizard({
  platformId,
  isOpen,
  onClose,
  onComplete,
  mode = 'live',
}: PlatformSetupWizardProps) {
  const platform = PLATFORM_CONFIGS[platformId];
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isChecked, setIsChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData({});
      setIsChecked(false);
    }
  }, [isOpen, platformId]);

  if (!platform) {
    return null;
  }

  // SIMULATION MODE: Show simplified dialog - no credential setup needed
  if (mode === 'simulation' && isOpen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-lg overflow-hidden bg-dark-card rounded-2xl border border-dark-border shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-dark-border">
              <div className="flex items-center gap-4">
                <div className="text-4xl p-3 rounded-xl bg-neon-green/20">
                  {platform.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {platform.name} - Paper Trading
                  </h2>
                  <p className="text-sm text-gray-400">{platform.description}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Success Banner */}
              <div className="p-4 rounded-xl bg-neon-green/10 border border-neon-green/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-neon-green flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-neon-green">No Setup Required!</p>
                    <p className="text-sm text-gray-300 mt-1">
                      Paper trading uses real market data from {platform.name}, but no actual trades are executed. 
                      Your positions and P&L are simulated.
                    </p>
                  </div>
                </div>
              </div>

              {/* What You Get */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-400">What&apos;s Included:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-neon-green" />
                    Real-time market data & prices
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-neon-green" />
                    Paper portfolio tracking
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-neon-green" />
                    Simulated order execution
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-neon-green" />
                    Strategy backtesting
                  </li>
                </ul>
              </div>

              {/* Ready for Live? */}
              <div className="p-3 rounded-lg bg-dark-border/50">
                <p className="text-xs text-gray-400">
                  💡 When you&apos;re ready for live trading, you can add your API credentials in Settings → API Keys.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-dark-border flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-dark-border text-gray-400 hover:bg-dark-border/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onComplete({});
                  onClose();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-neon-green text-black font-semibold hover:bg-neon-green/90 transition-colors"
              >
                Enable Paper Trading
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // LIVE MODE: Full setup wizard
  const step = platform.steps[currentStep];
  const isLastStep = currentStep === platform.steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save credentials:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canProceed = () => {
    if (step.action === 'input' && step.inputFields) {
      return step.inputFields
        .filter(f => f.required)
        .every(f => formData[f.name]?.trim());
    }
    if (step.action === 'checkbox') {
      return isChecked;
    }
    return true;
  };

  const getCategoryIcon = () => {
    switch (platform.category) {
      case 'prediction': return <Target className="w-5 h-5" />;
      case 'crypto': return <Coins className="w-5 h-5" />;
      case 'stocks': return <TrendingUp className="w-5 h-5" />;
      case 'options': return <Building2 className="w-5 h-5" />;
      default: return <Key className="w-5 h-5" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-dark-card rounded-2xl border border-dark-border shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-dark-card border-b border-dark-border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'text-3xl p-3 rounded-xl',
                    platform.color === 'purple' && 'bg-purple-500/20',
                    platform.color === 'blue' && 'bg-blue-500/20',
                    platform.color === 'red' && 'bg-red-500/20',
                    platform.color === 'green' && 'bg-green-500/20',
                    platform.color === 'yellow' && 'bg-yellow-500/20',
                    platform.color === 'cyan' && 'bg-cyan-500/20',
                    platform.color === 'gray' && 'bg-gray-500/20',
                    platform.color === 'white' && 'bg-white/10',
                    platform.color === 'orange' && 'bg-orange-500/20',
                  )}>
                    {platform.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Connect {platform.name}
                      {getCategoryIcon()}
                    </h2>
                    <p className="text-sm text-gray-400">{platform.description}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-dark-border transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 flex items-center gap-2">
                {platform.steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      idx < currentStep ? 'bg-neon-green' :
                      idx === currentStep ? 'bg-neon-blue' :
                      'bg-dark-border'
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Step {currentStep + 1} of {platform.steps.length}
              </p>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {/* Requirements & Restrictions (First step only) */}
              {currentStep === 0 && (
                <div className="space-y-4 mb-6">
                  {/* Requirements */}
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <h4 className="font-medium text-green-400 flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      Requirements
                    </h4>
                    <ul className="space-y-1 text-sm text-green-300/80">
                      {platform.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Restrictions */}
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <h4 className="font-medium text-yellow-400 flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Important Restrictions
                    </h4>
                    <ul className="space-y-1 text-sm text-yellow-300/80">
                      {platform.restrictions.map((res, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-1">•</span>
                          {res}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Fees & Approval Time */}
                  <div className="flex gap-4">
                    {platform.fees && (
                      <div className="flex-1 p-3 rounded-xl bg-dark-border/50">
                        <p className="text-xs text-gray-400">Trading Fees</p>
                        <p className="text-sm text-white font-medium">{platform.fees}</p>
                      </div>
                    )}
                    {platform.approvalRequired && (
                      <div className="flex-1 p-3 rounded-xl bg-dark-border/50">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Approval Time
                        </p>
                        <p className="text-sm text-white font-medium">{platform.approvalTime}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step Content */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>

                {/* Warning */}
                {step.warning && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {step.warning}
                    </p>
                  </div>
                )}

                {/* Tip */}
                {step.tip && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-400 flex items-start gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {step.tip}
                    </p>
                  </div>
                )}

                {/* Action: Link */}
                {step.action === 'link' && step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-neon-blue/20 border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/30 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {step.linkText || 'Open Link'}
                  </a>
                )}

                {/* Action: Input Fields */}
                {step.action === 'input' && step.inputFields && (
                  <div className="space-y-4">
                    {step.inputFields.map(field => (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            className="w-full px-4 py-3 bg-dark-lighter border border-dark-border rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-blue transition-colors"
                          />
                          {formData[field.name] && field.type === 'text' && (
                            <button
                              onClick={() => copyToClipboard(formData[field.name])}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-dark-border"
                            >
                              {copied ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          )}
                        </div>
                        {field.helpText && (
                          <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action: Checkbox */}
                {step.action === 'checkbox' && (
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-dark-lighter border border-dark-border cursor-pointer hover:border-neon-blue/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setIsChecked(e.target.checked)}
                      className="w-5 h-5 rounded border-dark-border bg-dark-card text-neon-blue focus:ring-neon-blue"
                    />
                    <span className="text-gray-300">{step.checkboxText}</span>
                  </label>
                )}

                {/* OAuth Special Case */}
                {platform.apiKeyType === 'oauth' && isLastStep && (
                  <button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Link2 className="w-5 h-5" />
                    )}
                    Connect {platform.name} via OAuth
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-dark-card border-t border-dark-border p-4 flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={isFirstStep}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  isFirstStep
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:text-white hover:bg-dark-border'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex gap-3">
                {/* "I already have an account" - skip to API key step */}
                {isFirstStep && platform.apiKeyType !== 'oauth' && (
                  <button
                    onClick={() => {
                      // Find the step with input fields (API key entry)
                      const inputStepIdx = platform.steps.findIndex(s => s.action === 'input');
                      if (inputStepIdx >= 0) {
                        setCurrentStep(inputStepIdx);
                      } else {
                        // Fallback: go to last step
                        setCurrentStep(platform.steps.length - 1);
                      }
                    }}
                    className="px-4 py-2 rounded-lg text-neon-blue hover:text-white hover:bg-dark-border border border-neon-blue/30 transition-colors"
                  >
                    I already have an account →
                  </button>
                )}
                
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                
                {!(platform.apiKeyType === 'oauth' && isLastStep) && (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || isSubmitting}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all',
                      canProceed()
                        ? 'bg-neon-green text-black hover:bg-neon-green/90'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isLastStep ? (
                      <>
                        <Shield className="w-4 h-4" />
                        Save & Connect
                      </>
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PlatformSetupWizard;
