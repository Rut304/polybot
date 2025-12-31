import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PolyParlay - Automated Prediction Market Trading',
  description: 'Trade Polymarket, Kalshi, stocks & crypto automatically. AI-powered arbitrage, copy trading, and strategy automation. Free paper trading.',
  keywords: ['prediction markets', 'Polymarket', 'Kalshi', 'arbitrage', 'automated trading', 'copy trading', 'crypto trading', 'stock trading'],
  authors: [{ name: 'PolyParlay' }],
  creator: 'PolyParlay',
  publisher: 'PolyParlay',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://polyparlay.io',
    siteName: 'PolyParlay',
    title: 'PolyParlay - Automated Prediction Market Trading',
    description: 'Trade Polymarket, Kalshi, stocks & crypto automatically. Free paper trading.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PolyParlay Trading Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PolyParlay - Automated Prediction Market Trading',
    description: 'Trade Polymarket, Kalshi, stocks & crypto automatically.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
  metadataBase: new URL('https://polyparlay.io'),
};

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'PolyParlay',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Automated prediction market and stock trading platform with AI-powered arbitrage, copy trading, and strategy automation.',
  url: 'https://polyparlay.io',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Unlimited paper trading forever',
    },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '29',
      priceCurrency: 'USD',
      description: 'Live trading on prediction markets',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '99',
      priceCurrency: 'USD',
      description: 'Full platform access with priority support',
    },
  ],
  featureList: [
    'Polymarket trading',
    'Kalshi trading',
    'Cross-platform arbitrage',
    'Copy trading',
    'Congressional trading tracker',
    'Stock & crypto trading',
    'AI-powered insights',
    'TradingView integration',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '127',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
