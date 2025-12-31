import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/landing',
  '/login',
  '/signup',
  '/auth/callback',
  '/privacy',
  '/terms',
  '/pricing',
  '/help',
  '/documentation',
  '/api/webhooks',
  '/api/help',
  '/api/live-feed',
];

// Routes that should be accessible without auth (for development/testing)
const ALWAYS_PUBLIC = [
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and always-public routes
  if (ALWAYS_PUBLIC.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  // Check for auth cookie
  const accessToken = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;
  
  // Also check for Supabase auth cookies (they might use different naming)
  const supabaseAccessToken = request.cookies.get('sb-access-token')?.value || 
                              request.cookies.get('supabase-auth-token')?.value;

  const hasAuthCookie = !!accessToken || !!refreshToken || !!supabaseAccessToken;

  // If user is not authenticated and trying to access protected route
  if (!hasAuthCookie && !isPublicRoute) {
    // Redirect to landing page
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access login/signup/landing
  if (hasAuthCookie && (pathname === '/login' || pathname === '/signup' || pathname === '/landing')) {
    // Redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
