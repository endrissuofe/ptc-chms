import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { canAccess, HOME_BY_ROLE } from '@/lib/roles';

/**
 * Runs before every matched page and API request.
 * - Not signed in: pages go to /login, APIs get 401.
 * - Signed in but wrong role: pages go to that role's home screen, APIs get 403.
 * Public: /login, /api/auth/*, /api/health, /api/cron/* (cron has its own secret), static files.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname === '/') {
      return NextResponse.redirect(new URL(HOME_BY_ROLE[role] || '/login', req.url));
    }

    const pagePath = pathname.startsWith('/api/') ? null : pathname;
    if (pagePath && !canAccess(pagePath, role)) {
      return NextResponse.redirect(new URL(HOME_BY_ROLE[role] || '/login', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // APIs answer 401/403 as JSON themselves (see lib/api.js requireRole);
        // pages without a session are sent to /login.
        if (req.nextUrl.pathname.startsWith('/api/')) return true;
        return Boolean(token);
      },
    },
    pages: { signIn: '/login' },
  },
);

export const config = {
  matcher: [
    '/((?!login|api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons/|robots.txt|ptc-logo.png|manifest.webmanifest).*)',
  ],
};
