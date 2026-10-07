import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseCredentials, isRealSupabaseConfigured } from './config';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../session';

const PROTECTED_PREFIXES = [
  '/projects',
  '/new-project',
  '/configure',
  '/wallet',
  '/messages',
  '/redeem-code',
  '/account',
];

const AUTH_PREFIXES = ['/login', '/sign-in'];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({
    request,
  });

  let isAuthenticated = false;
  let userEmail: string | null = null;
  let userRole: string | null = null;

  // 1. Check signed HMAC session cookie first (super fast, edge compatible)
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    const session = await verifySessionToken(sessionCookie);
    if (session?.email) {
      isAuthenticated = true;
      userEmail = session.email;
      userRole = session.role;
    }
  }

  // 2. Sync/refresh Supabase auth session if configured
  if (isRealSupabaseConfigured()) {
    const { url, key } = getSafeSupabaseCredentials();

    try {
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        isAuthenticated = true;
        userEmail = user.email;
        userRole = user.app_metadata?.role || userRole || 'client';
      }
    } catch {
      // Silently fall through
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isManagement = pathname.startsWith('/management');

  // Unauthenticated user attempting to access protected route -> redirect to /login
  if ((isProtected || isManagement) && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url);
    const targetUrl = pathname + request.nextUrl.search;
    if (targetUrl !== '/projects') {
      redirectUrl.searchParams.set('next', targetUrl);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated user attempting to access /login or /sign-in -> redirect to /projects (or target)
  if (isAuthPage && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const target =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : '/projects';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Management access check
  if (isManagement && isAuthenticated) {
    const ADMIN_LIST = ['dev@localhost', 'admin@humantek.art', 'huzaifa14321furqan@gmail.com'];
    const isAdmin =
      userRole === 'admin' ||
      (userEmail && ADMIN_LIST.includes(userEmail.toLowerCase()));
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
  }

  return supabaseResponse;
}
