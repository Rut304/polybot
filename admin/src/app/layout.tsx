import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PolyBot Control Center',
  description: 'Prediction Market Arbitrage Bot Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-dark-bg flex">
            <Navigation />
            <main className="flex-1 ml-64 transition-all duration-300">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
