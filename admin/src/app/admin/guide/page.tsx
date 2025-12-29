'use client';

import { useState } from 'react';
import {
  BookOpen,
  Shield,
  Database,
  Server,
  Zap,
  Users,
  Key,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Terminal,
  Play,
  Settings,
  Bug,
  FileText,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Lightbulb,
  Clock,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-700 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

function AccordionSection({ section, isOpen, onToggle }: {
  section: GuideSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-700 rounded-lg">
            {section.icon}
          </div>
          <span className="font-medium">{section.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-gray-700 bg-gray-900/50">
          {section.content}
        </div>
      )}
    </div>
  );
}

export default function AdminGuidePage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));
  
  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const sections: GuideSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      icon: <BookOpen className="w-5 h-5 text-blue-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Welcome to the PolyBot Admin Guide. This documentation covers system administration,
            testing, monitoring, and troubleshooting for the PolyBot trading platform.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <Shield className="w-8 h-8 text-blue-400 mb-2" />
              <h4 className="font-medium mb-1">Security</h4>
              <p className="text-sm text-gray-400">RLS policies, MFA, API key encryption</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <Database className="w-8 h-8 text-green-400 mb-2" />
              <h4 className="font-medium mb-1">Database</h4>
              <p className="text-sm text-gray-400">Supabase Pro with 50+ tables</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <Activity className="w-8 h-8 text-purple-400 mb-2" />
              <h4 className="font-medium mb-1">Monitoring</h4>
              <p className="text-sm text-gray-400">E2E tests, diagnostics, logs</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'e2e-testing',
      title: 'E2E Testing with Playwright',
      icon: <Bug className="w-5 h-5 text-green-400" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-400">80 E2E Tests Available</p>
              <p className="text-sm text-gray-400">
                Automated tests cover navigation, dashboard, API endpoints, and all major features.
              </p>
            </div>
          </div>
          
          <h4 className="font-medium text-lg">Running Tests</h4>
          <CodeBlock code={`# Run all tests
npm run test:e2e

# Run with visual UI
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test navigation.spec.ts

# Run tests matching pattern
npx playwright test --grep "dashboard"`} />
          
          <h4 className="font-medium text-lg mt-6">Test Files</h4>
          <div className="space-y-2">
            {[
              { file: 'navigation.spec.ts', desc: 'Core navigation and routing tests' },
              { file: 'dashboard.spec.ts', desc: 'Main dashboard functionality' },
              { file: 'api.spec.ts', desc: 'API endpoint integration tests' },
              { file: 'failed-trades.spec.ts', desc: 'Failed trades page tests' },
              { file: 'ai-insights.spec.ts', desc: 'AI insights page tests' },
              { file: 'feature-flags.spec.ts', desc: 'Admin feature control tests' },
              { file: 'auth.spec.ts', desc: 'Authentication flow tests' },
              { file: 'settings.spec.ts', desc: 'User settings and profile tests' },
              { file: 'trading.spec.ts', desc: 'Trading workflow tests' },
            ].map(({ file, desc }) => (
              <div key={file} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <code className="text-sm text-green-400">{file}</code>
                </div>
                <span className="text-sm text-gray-400">{desc}</span>
              </div>
            ))}
          </div>
          
          <h4 className="font-medium text-lg mt-6">Writing New Tests</h4>
          <CodeBlock language="typescript" code={`import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-page');
    await page.waitForLoadState('networkidle');
  });

  test('should display content', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Expected Text')).toBeVisible();
  });

  test('should handle user interaction', async ({ page }) => {
    await page.click('button:has-text("Click Me")');
    await expect(page.locator('.result')).toContainText('Success');
  });
});`} />
          
          <h4 className="font-medium text-lg mt-6">CI Integration</h4>
          <p className="text-gray-400 mb-2">
            Add to your GitHub Actions workflow:
          </p>
          <CodeBlock language="yaml" code={`- name: Run E2E Tests
  run: |
    cd admin
    npx playwright install chromium
    npm run test:e2e
  env:
    E2E_BASE_URL: http://localhost:3001`} />
        </div>
      ),
    },
    {
      id: 'diagnostics',
      title: 'System Diagnostics',
      icon: <Activity className="w-5 h-5 text-yellow-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            The diagnostics page tests all system components and external connections.
          </p>
          
          <h4 className="font-medium text-lg">Test Categories</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: 'Authentication & Session', tests: 3 },
              { name: 'Database Connections', tests: 7 },
              { name: 'External APIs', tests: 4 },
              { name: 'Bot Status', tests: 3 },
              { name: 'Trading Workflow', tests: 4 },
              { name: 'Exchange Connections', tests: 3 },
              { name: 'E2E Tests', tests: 80 },
            ].map(cat => (
              <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-gray-300">{cat.name}</span>
                <span className="text-sm bg-gray-700 px-2 py-1 rounded">{cat.tests} tests</span>
              </div>
            ))}
          </div>
          
          <Link
            href="/diagnostics"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Open Diagnostics
          </Link>
        </div>
      ),
    },
    {
      id: 'database',
      title: 'Database Management',
      icon: <Database className="w-5 h-5 text-green-400" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Key Tables</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left p-3">Table</th>
                  <th className="text-left p-3">Purpose</th>
                  <th className="text-left p-3">RLS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { table: 'polybot_config', purpose: 'Bot configuration per user', rls: true },
                  { table: 'polybot_trades', purpose: 'Trade history', rls: true },
                  { table: 'polybot_positions', purpose: 'Open positions', rls: true },
                  { table: 'polybot_balances', purpose: 'Account balances', rls: true },
                  { table: 'polybot_profiles', purpose: 'User profiles', rls: true },
                  { table: 'polybot_feature_flags', purpose: 'Feature toggles', rls: true },
                  { table: 'user_exchange_credentials', purpose: 'API keys (encrypted)', rls: true },
                ].map(row => (
                  <tr key={row.table}>
                    <td className="p-3 font-mono text-blue-400">{row.table}</td>
                    <td className="p-3 text-gray-400">{row.purpose}</td>
                    <td className="p-3">
                      {row.rls ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <h4 className="font-medium text-lg mt-6">Running Migrations</h4>
          <CodeBlock code={`# Connect to Supabase SQL Editor and run:
\\i scripts/create_feature_flags_table.sql
\\i scripts/create_team_invitations.sql
\\i scripts/security_fix_critical.sql`} />
        </div>
      ),
    },
    {
      id: 'feature-flags',
      title: 'Feature Flags',
      icon: <Zap className="w-5 h-5 text-purple-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Control feature rollout with global flags and per-user overrides.
          </p>
          
          <h4 className="font-medium text-lg">Flag Categories</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['trading', 'ui', 'beta', 'maintenance'].map(cat => (
              <div key={cat} className="p-3 bg-gray-800 rounded-lg text-center">
                <span className="text-sm capitalize">{cat}</span>
              </div>
            ))}
          </div>
          
          <h4 className="font-medium text-lg mt-6">Using Feature Flags in Code</h4>
          <CodeBlock language="typescript" code={`import { useFeatureFlag, FeatureEnabled } from '@/lib/useFeatureFlags';

// Hook usage
function MyComponent() {
  const isEnabled = useFeatureFlag('new_dashboard');
  
  if (!isEnabled) return null;
  return <NewDashboard />;
}

// Component usage
<FeatureEnabled flag="whale_tracking">
  <WhaleTracker />
</FeatureEnabled>`} />
          
          <Link
            href="/admin/features"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage Features
          </Link>
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      icon: <Shield className="w-5 h-5 text-red-400" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-400">Security Audit Complete</p>
              <p className="text-sm text-gray-400">
                RLS enabled on 17+ tables, MFA available, API keys encrypted.
              </p>
            </div>
          </div>
          
          <h4 className="font-medium text-lg">Security Checklist</h4>
          <div className="space-y-2">
            {[
              { item: 'Row Level Security (RLS) enabled', status: true },
              { item: 'MFA available for all users', status: true },
              { item: 'API keys stored encrypted', status: true },
              { item: 'Session tokens auto-refresh', status: true },
              { item: 'Supabase Auth with email verification', status: true },
              { item: 'CORS configured for production domain', status: true },
            ].map(({ item, status }) => (
              <div key={item} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                {status ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
                <span className="text-gray-300">{item}</span>
              </div>
            ))}
          </div>
          
          <h4 className="font-medium text-lg mt-6">Emergency Procedures</h4>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-medium text-red-400 mb-2">In case of security breach:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
              <li>Enable maintenance mode via Feature Flags</li>
              <li>Rotate all API keys in Supabase</li>
              <li>Review Supabase Auth logs for suspicious activity</li>
              <li>Invalidate all user sessions</li>
              <li>Check bot logs for unauthorized trades</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Common Issues</h4>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="font-medium text-yellow-400 mb-2">Auth session not loading</p>
              <p className="text-sm text-gray-400 mb-2">
                If users see a blank page or auth errors:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
                <li>Check Supabase Dashboard → Auth → Users</li>
                <li>Verify NEXT_PUBLIC_SUPABASE_URL is correct</li>
                <li>Clear browser localStorage and retry</li>
                <li>Check browser console for CORS errors</li>
              </ol>
            </div>
            
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="font-medium text-yellow-400 mb-2">Bot not trading</p>
              <p className="text-sm text-gray-400 mb-2">
                If the bot is running but not executing trades:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
                <li>Check /diagnostics for API connection status</li>
                <li>Verify exchange API keys are valid</li>
                <li>Check if trading is enabled in config</li>
                <li>Review bot logs for error messages</li>
              </ol>
            </div>
            
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="font-medium text-yellow-400 mb-2">Database permission errors</p>
              <p className="text-sm text-gray-400 mb-2">
                If getting RLS or permission denied errors:
              </p>
              <CodeBlock code={`-- Run in Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'polybot_config';

-- Check if user has correct role
SELECT * FROM auth.users WHERE id = 'user-id-here';`} />
            </div>
          </div>
          
          <Link
            href="/logs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Terminal className="w-4 h-4" />
            View Logs
          </Link>
        </div>
      ),
    },
    {
      id: 'deployment',
      title: 'Deployment',
      icon: <Server className="w-5 h-5 text-cyan-400" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Vercel Deployment</h4>
          <p className="text-gray-400 mb-2">
            The admin dashboard is deployed to Vercel with automatic deployments on push to main.
          </p>
          
          <h4 className="font-medium text-lg mt-6">Environment Variables</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left p-3">Variable</th>
                  <th className="text-left p-3">Required</th>
                  <th className="text-left p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { var: 'NEXT_PUBLIC_SUPABASE_URL', req: true, desc: 'Supabase project URL' },
                  { var: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', req: true, desc: 'Supabase anon key' },
                  { var: 'SUPABASE_SERVICE_ROLE_KEY', req: true, desc: 'Service role (server only)' },
                  { var: 'STRIPE_SECRET_KEY', req: true, desc: 'Stripe API key' },
                  { var: 'RESEND_API_KEY', req: false, desc: 'For email sending' },
                  { var: 'NEXT_PUBLIC_CRISP_WEBSITE_ID', req: false, desc: 'Live chat' },
                ].map(row => (
                  <tr key={row.var}>
                    <td className="p-3 font-mono text-blue-400 text-xs">{row.var}</td>
                    <td className="p-3">
                      {row.req ? (
                        <span className="text-red-400">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-400">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <h4 className="font-medium text-lg mt-6">Deploy Commands</h4>
          <CodeBlock code={`# Build locally
cd admin && npm run build

# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls`} />
        </div>
      ),
    },
  ];
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/admin" className="hover:text-gray-300">Admin</Link>
              <ChevronRight className="w-4 h-4" />
              <span>Guide</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="text-blue-400" />
              Admin Guide
            </h1>
            <p className="text-gray-400 mt-1">
              Complete documentation for system administration and testing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/diagnostics"
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Diagnostics
            </Link>
          </div>
        </div>
        
        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/diagnostics', icon: <Activity className="w-5 h-5" />, label: 'Diagnostics', color: 'text-blue-400' },
            { href: '/admin/features', icon: <Zap className="w-5 h-5" />, label: 'Features', color: 'text-purple-400' },
            { href: '/logs', icon: <Terminal className="w-5 h-5" />, label: 'Logs', color: 'text-green-400' },
            { href: '/secrets', icon: <Key className="w-5 h-5" />, label: 'API Keys', color: 'text-yellow-400' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-3"
            >
              <span className={link.color}>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
        
        {/* Sections */}
        <div className="space-y-3">
          {sections.map(section => (
            <AccordionSection
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-800/50 rounded-lg text-center text-gray-500 text-sm">
          <p>Last updated: December 28, 2025</p>
          <p className="mt-1">
            Questions? Contact{' '}
            <a href="mailto:support@polybot.app" className="text-blue-400 hover:underline">
              support@polybot.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
