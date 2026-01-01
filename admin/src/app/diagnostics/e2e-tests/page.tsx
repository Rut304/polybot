'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bug,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  ArrowLeft,
  ExternalLink,
  Clock,
  FileCode,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Eye,
} from 'lucide-react';

interface TestFile {
  name: string;
  path: string;
  testCount: number;
  description: string;
  category: 'auth' | 'ui' | 'api' | 'workflow' | 'accessibility' | 'integration';
  coverage: 'complete' | 'partial' | 'missing';
  lastRun?: string;
  status?: 'passed' | 'failed' | 'skipped';
  passCount?: number;
  failCount?: number;
}

// Define all test files with their metadata
const TEST_FILES: TestFile[] = [
  // Auth & Session
  { name: 'auth.spec.ts', path: 'e2e/auth.spec.ts', testCount: 12, category: 'auth', coverage: 'partial',
    description: 'Login page UI, protected routes, session checks (actual login not tested)' },
  
  // UI Pages
  { name: 'dashboard.spec.ts', path: 'e2e/dashboard.spec.ts', testCount: 14, category: 'ui', coverage: 'partial',
    description: 'Dashboard header, stats cards, loading states, layout' },
  { name: 'settings.spec.ts', path: 'e2e/settings.spec.ts', testCount: 20, category: 'ui', coverage: 'partial',
    description: 'Settings page UI elements, toggles, input fields (persistence not tested)' },
  { name: 'trading.spec.ts', path: 'e2e/trading.spec.ts', testCount: 26, category: 'ui', coverage: 'partial',
    description: 'Markets page, positions, trade history, watchlist UI' },
  { name: 'pages-coverage.spec.ts', path: 'e2e/pages-coverage.spec.ts', testCount: 33, category: 'ui', coverage: 'complete',
    description: 'News, Whales, Congress, Leaderboard, Pricing pages load tests' },
  { name: 'failed-trades.spec.ts', path: 'e2e/failed-trades.spec.ts', testCount: 14, category: 'ui', coverage: 'partial',
    description: 'Failed trades page, pro tier gating' },
  { name: 'ai-insights.spec.ts', path: 'e2e/ai-insights.spec.ts', testCount: 12, category: 'ui', coverage: 'partial',
    description: 'AI insights page UI' },
  
  // Navigation & Workflows
  { name: 'navigation.spec.ts', path: 'e2e/navigation.spec.ts', testCount: 12, category: 'workflow', coverage: 'complete',
    description: 'Sidebar navigation, route changes, breadcrumbs' },
  { name: 'workflows.spec.ts', path: 'e2e/workflows.spec.ts', testCount: 28, category: 'workflow', coverage: 'complete',
    description: 'Multi-page user journeys, navigation flows' },
  
  // API Tests
  { name: 'api.spec.ts', path: 'e2e/api.spec.ts', testCount: 10, category: 'api', coverage: 'partial',
    description: 'API endpoint status checks, basic response validation' },
  { name: 'live-feed-api.spec.ts', path: 'e2e/live-feed-api.spec.ts', testCount: 8, category: 'api', coverage: 'complete',
    description: 'TradingView webhook, Live feed API tests' },
  { name: 'api-consistency.spec.ts', path: 'e2e/api-consistency.spec.ts', testCount: 10, category: 'api', coverage: 'partial',
    description: 'API response consistency across endpoints' },
  
  // Strategy Config
  { name: 'strategy-config.spec.ts', path: 'e2e/strategy-config.spec.ts', testCount: 15, category: 'integration', coverage: 'complete',
    description: 'Strategy configuration field validation, mappings' },
  { name: 'feature-flags.spec.ts', path: 'e2e/feature-flags.spec.ts', testCount: 10, category: 'integration', coverage: 'partial',
    description: 'Admin feature flag tests' },
  { name: 'platform-filtering.spec.ts', path: 'e2e/platform-filtering.spec.ts', testCount: 12, category: 'integration', coverage: 'partial',
    description: 'Platform-specific data filtering' },
  { name: 'metrics-calculation.spec.ts', path: 'e2e/metrics-calculation.spec.ts', testCount: 15, category: 'integration', coverage: 'complete',
    description: 'P&L calculations, win rate, ROI metrics' },
  { name: 'pnl-calculation.spec.ts', path: 'e2e/pnl-calculation.spec.ts', testCount: 20, category: 'integration', coverage: 'complete',
    description: 'Detailed P&L and data integrity validation' },
  { name: 'secrets-flow.spec.ts', path: 'e2e/secrets-flow.spec.ts', testCount: 8, category: 'integration', coverage: 'partial',
    description: 'Exchange credential management flow' },
  
  // Accessibility & Mobile
  { name: 'accessibility.spec.ts', path: 'e2e/accessibility.spec.ts', testCount: 24, category: 'accessibility', coverage: 'complete',
    description: 'Keyboard navigation, ARIA labels, focus indicators' },
  { name: 'mobile.spec.ts', path: 'e2e/mobile.spec.ts', testCount: 16, category: 'accessibility', coverage: 'complete',
    description: 'Mobile responsive design, touch targets' },
  { name: 'link-validation.spec.ts', path: 'e2e/link-validation.spec.ts', testCount: 10, category: 'ui', coverage: 'complete',
    description: 'All links are valid and not broken' },
];

// Missing test scenarios that should be added
const MISSING_TESTS = [
  { category: 'Auth', tests: [
    'Complete signup flow with email/password',
    'OAuth login (Google, etc.)',
    'Login with invalid credentials',
    'Password reset flow',
    'Session token refresh',
    'Logout functionality',
  ]},
  { category: 'Onboarding', tests: [
    'Complete 5-step wizard',
    'Skip wizard functionality',
    'Resume onboarding after refresh',
    'Wallet connection step',
    'Strategy selection step',
  ]},
  { category: 'Settings', tests: [
    'Save settings and verify persistence',
    'Toggle strategy enable/disable with API call',
    'Update trading parameters',
    'Theme switching persistence',
  ]},
  { category: 'Subscription', tests: [
    'View pricing tiers comparison',
    'Upgrade to Pro via Stripe',
    'Successful payment callback',
    'Feature gating enforcement',
  ]},
  { category: 'Trading', tests: [
    'Filter trades by date range',
    'Filter trades by platform',
    'Export trade history to CSV',
    'Trade detail modal',
  ]},
  { category: 'API Credentials', tests: [
    'Add new API key',
    'Test API key connection',
    'Delete API key',
    'Mask sensitive values',
  ]},
];

const CATEGORY_COLORS = {
  auth: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ui: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  api: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  workflow: 'bg-green-500/20 text-green-400 border-green-500/30',
  accessibility: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  integration: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const COVERAGE_BADGES = {
  complete: { text: 'Complete', color: 'bg-green-500/20 text-green-400' },
  partial: { text: 'Partial', color: 'bg-yellow-500/20 text-yellow-400' },
  missing: { text: 'Missing', color: 'bg-red-500/20 text-red-400' },
};

export default function E2ETestsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Auth', 'Onboarding']);
  const [activeTab, setActiveTab] = useState<'existing' | 'missing'>('existing');
  
  const filteredTests = TEST_FILES.filter(t => {
    if (filter !== 'all' && t.category !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && 
        !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalTests = TEST_FILES.reduce((sum, t) => sum + t.testCount, 0);
  const byCategory = TEST_FILES.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.testCount;
    return acc;
  }, {} as Record<string, number>);
  
  const coverageSummary = {
    complete: TEST_FILES.filter(t => t.coverage === 'complete').length,
    partial: TEST_FILES.filter(t => t.coverage === 'partial').length,
    missing: MISSING_TESTS.reduce((sum, c) => sum + c.tests.length, 0),
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/diagnostics" 
              className="p-2 hover:bg-dark-card rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bug className="w-6 h-6 text-green-400" />
                E2E Test Coverage
              </h1>
              <p className="text-gray-400 text-sm">
                {totalTests} automated tests across {TEST_FILES.length} test files
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="https://github.com/Rut304/polybot/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:border-gray-600 transition-colors flex items-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              GitHub Actions
            </a>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="text-3xl font-bold text-white">{totalTests}</div>
            <div className="text-sm text-gray-400">Total Tests</div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="text-3xl font-bold text-green-400">{coverageSummary.complete}</div>
            <div className="text-sm text-gray-400">Complete Coverage Files</div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-400">{coverageSummary.partial}</div>
            <div className="text-sm text-gray-400">Partial Coverage Files</div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <div className="text-3xl font-bold text-red-400">{coverageSummary.missing}</div>
            <div className="text-sm text-gray-400">Missing Test Scenarios</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Tests by Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCategory).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? 'all' : cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  filter === cat 
                    ? CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] 
                    : 'bg-dark-bg text-gray-400 border-dark-border hover:border-gray-600'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}: {count}
              </button>
            ))}
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-700 text-white"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-dark-border">
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'existing' 
                ? 'text-green-400 border-b-2 border-green-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Existing Tests ({TEST_FILES.length} files)
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'missing' 
                ? 'text-red-400 border-b-2 border-red-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Missing Tests ({coverageSummary.missing} scenarios)
          </button>
        </div>

        {/* Search */}
        {activeTab === 'existing' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search test files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-card border border-dark-border rounded-lg text-white placeholder-gray-500 focus:border-neon-blue focus:outline-none"
            />
          </div>
        )}

        {/* Test Files List */}
        {activeTab === 'existing' && (
          <div className="space-y-2">
            {filteredTests.map((test) => (
              <div
                key={test.name}
                className="bg-dark-card border border-dark-border rounded-xl p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{test.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[test.category]}`}>
                          {test.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${COVERAGE_BADGES[test.coverage].color}`}>
                          {COVERAGE_BADGES[test.coverage].text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{test.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{test.testCount}</div>
                      <div className="text-xs text-gray-500">tests</div>
                    </div>
                    <a
                      href={`https://github.com/Rut304/polybot/blob/main/admin/${test.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-dark-border rounded-lg transition-colors"
                      title="View on GitHub"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Missing Tests */}
        {activeTab === 'missing' && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-400">Test Coverage Gaps</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    These test scenarios are recommended to improve coverage. Most current tests are &quot;smoke tests&quot; 
                    that verify pages load, but don&apos;t test actual user interactions or data persistence.
                  </p>
                </div>
              </div>
            </div>

            {MISSING_TESTS.map((category) => (
              <div key={category.category} className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-dark-border/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories.includes(category.category) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-white">{category.category}</span>
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                      {category.tests.length} missing
                    </span>
                  </div>
                </button>
                {expandedCategories.includes(category.category) && (
                  <div className="px-4 pb-4">
                    <ul className="space-y-2">
                      {category.tests.map((test, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          {test}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📋 Testing Recommendations</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-red-400 mb-2">🔴 High Priority</h4>
              <ul className="space-y-1 text-sm text-gray-400">
                <li>• Authentication flows (signup, login, logout)</li>
                <li>• Onboarding wizard completion</li>
                <li>• Subscription upgrade flow</li>
                <li>• Strategy enable/disable functionality</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-yellow-400 mb-2">🟡 Medium Priority</h4>
              <ul className="space-y-1 text-sm text-gray-400">
                <li>• Settings persistence after save</li>
                <li>• API credential management</li>
                <li>• Trade history filters and export</li>
                <li>• Dashboard real-time updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
