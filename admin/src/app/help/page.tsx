'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Book,
  Search,
  ChevronRight,
  BookOpen,
  Plug,
  BarChart3,
  CreditCard,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt?: string;
  content?: string;
  view_count?: number;
}

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: BookOpen, color: 'text-emerald-400' },
  { id: 'integrations', label: 'Integrations', icon: Plug, color: 'text-blue-400' },
  { id: 'strategies', label: 'Strategies', icon: BarChart3, color: 'text-purple-400' },
  { id: 'billing', label: 'Billing', icon: CreditCard, color: 'text-yellow-400' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, color: 'text-pink-400' },
];

// Loading fallback for Suspense
function HelpLoadingFallback() {
  return (
    <div className="min-h-screen bg-dark-bg p-8 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-green border-t-transparent"></div>
    </div>
  );
}

// Main content component that uses useSearchParams
function HelpPageContent() {
  const searchParams = useSearchParams();
  const articleSlug = searchParams.get('article');
  const categoryFilter = searchParams.get('category');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  // Fetch articles list
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['help-articles', categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/help?${params}`);
      if (!res.ok) throw new Error('Failed to fetch articles');
      return res.json();
    },
    enabled: !articleSlug,
  });

  // Fetch single article
  const { data: article, isLoading: articleLoading } = useQuery({
    queryKey: ['help-article', articleSlug],
    queryFn: async () => {
      const res = await fetch(`/api/help?slug=${articleSlug}`);
      if (!res.ok) throw new Error('Article not found');
      return res.json();
    },
    enabled: !!articleSlug,
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ articleId, isHelpful }: { articleId: string; isHelpful: boolean }) => {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, is_helpful: isHelpful }),
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      setFeedbackSent(variables.articleId);
    },
  });

  const articles: HelpArticle[] = articlesData?.articles || [];
  const filteredArticles = searchQuery
    ? articles.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles;

  // Single article view
  if (articleSlug) {
    return (
      <div className="min-h-screen bg-dark-bg p-6">
        <div className="max-w-4xl mx-auto">
          {articleLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green" />
            </div>
          ) : article ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Back button */}
              <Link
                href="/help"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Help Center
              </Link>

              {/* Article content */}
              <div className="bg-dark-card border border-dark-border rounded-xl p-8">
                <div className="mb-6">
                  <span className="text-xs font-medium text-neon-green uppercase tracking-wider">
                    {CATEGORIES.find(c => c.id === article.category)?.label || article.category}
                  </span>
                  <h1 className="text-3xl font-bold text-white mt-2">{article.title}</h1>
                </div>

                {/* Markdown content */}
                <div className="prose prose-invert prose-emerald max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-8 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-medium text-white mt-4 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1 ml-4">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1 ml-4">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-300 ml-2">{children}</li>,
                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                      a: ({ href, children }) => (
                        <a href={href} className="text-neon-green hover:underline" target={href?.startsWith('http') ? '_blank' : undefined}>
                          {children}
                        </a>
                      ),
                      code: ({ children }) => (
                        <code className="bg-dark-bg px-2 py-0.5 rounded text-sm text-emerald-400">{children}</code>
                      ),
                    }}
                  >
                    {article.content}
                  </ReactMarkdown>
                </div>

                {/* Feedback */}
                <div className="mt-8 pt-8 border-t border-dark-border">
                  {feedbackSent === article.id ? (
                    <p className="text-center text-gray-400">Thanks for your feedback!</p>
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-gray-400">Was this helpful?</span>
                      <button
                        onClick={() => feedbackMutation.mutate({ articleId: article.id, isHelpful: true })}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Yes
                      </button>
                      <button
                        onClick={() => feedbackMutation.mutate({ articleId: article.id, isHelpful: false })}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <ThumbsDown className="w-4 h-4" />
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Article not found</p>
              <Link href="/help" className="text-neon-green hover:underline mt-2 inline-block">
                Back to Help Center
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Help center index
  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neon-green/10 border border-neon-green/20 rounded-full text-neon-green text-sm font-medium mb-4"
          >
            <Book className="w-4 h-4" />
            Help Center
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">How can we help?</h1>
          <p className="text-gray-400">Find answers to common questions and learn how to use PolyParlay</p>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative max-w-2xl mx-auto"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            className="w-full pl-12 pr-4 py-4 bg-dark-card border border-dark-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-neon-green transition-colors"
          />
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = categoryFilter === cat.id;
            return (
              <Link
                key={cat.id}
                href={isActive ? '/help' : `/help?category=${cat.id}`}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                  isActive
                    ? "bg-neon-green/10 border-neon-green text-neon-green"
                    : "bg-dark-card border-dark-border text-gray-400 hover:border-gray-600 hover:text-white"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && cat.color)} />
                <span className="text-sm font-medium">{cat.label}</span>
              </Link>
            );
          })}
        </motion.div>

        {/* Articles List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          {articlesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No articles found</p>
            </div>
          ) : (
            filteredArticles.map((article, i) => {
              const category = CATEGORIES.find(c => c.id === article.category);
              const Icon = category?.icon || HelpCircle;
              return (
                <Link
                  key={article.id}
                  href={`/help?article=${article.slug}`}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-center gap-4 p-4 bg-dark-card border border-dark-border rounded-xl hover:border-neon-green/50 transition-all group"
                  >
                    <div className={cn("p-2 rounded-lg bg-dark-bg", category?.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white group-hover:text-neon-green transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-400 truncate">{article.excerpt}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-neon-green transition-colors" />
                  </motion.div>
                </Link>
              );
            })
          )}
        </motion.div>

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-neon-green/10 to-cyan-500/10 border border-neon-green/20 rounded-xl p-6 text-center"
        >
          <MessageCircle className="w-10 h-10 text-neon-green mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Still need help?</h3>
          <p className="text-gray-400 mb-4">Our support team is here to help you.</p>
          <button
            onClick={() => {
              // Trigger Crisp chat if available
              if (typeof window !== 'undefined' && (window as any).$crisp) {
                (window as any).$crisp.push(['do', 'chat:open']);
              } else {
                window.location.href = 'mailto:support@polyparlay.io';
              }
            }}
            className="px-6 py-2 bg-neon-green text-black font-medium rounded-lg hover:bg-neon-green/90 transition-colors"
          >
            Contact Support
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// Exported component with Suspense boundary for useSearchParams
export default function HelpPage() {
  return (
    <Suspense fallback={<HelpLoadingFallback />}>
      <HelpPageContent />
    </Suspense>
  );
}
