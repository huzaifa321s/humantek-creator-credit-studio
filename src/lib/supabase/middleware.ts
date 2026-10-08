import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseCredentials, isRealSupabaseConfigured } from './config';
import { ADMIN_EMAILS, isSystemAdminEmail } from '@/lib/auth/roles';

const ADMIN_ONLY_PATHS = ['/management', '/admin'];
const CLIENT_ONLY_PATHS = [
  '/projects',
  '/configure',
  '/wallet',
  '/messages',
  '/redeem-code',
  '/account',
];

const AUTH_PREFIXES = ['/login', '/sign-in'];
const ADMIN_AUTH_PATH = '/admin-login';

function sanitizeRedirectUrl(urlParam: string | null | undefined, fallback = '/projects'): string {
  if (!urlParam) return fallback;
  const trimmed = urlParam.trim();
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }
  return fallback;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!isRealSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { url, key } = getSafeSupabaseCredentials();

  let user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null = null;
  let userRole: 'admin' | 'client' = 'client';

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

    // Authoritative user verification via Supabase session
    const {
      data: { user: authedUser },
    } = await supabase.auth.getUser();

    user = authedUser;

    if (user && user.email) {
      const email = user.email.toLowerCase().trim();
      const appRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
      if (appRole === 'admin' || isSystemAdminEmail(email)) {
        userRole = 'admin';
      } else {
        // Query database profile if available
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        userRole = profile?.role === 'admin' ? 'admin' : 'client';
      }
    }
  } catch {
    user = null;
  }

  const isAuthenticated = Boolean(user && user.email);
  const isAdminPath = ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isClientPath = CLIENT_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isClientAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminAuthPage = pathname === ADMIN_AUTH_PATH;
  const isNewProjectPath = pathname.startsWith('/new-project');

  // Handle Root Gateway ('/')
  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/new-project', request.url));
    }
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/management', request.url));
    }
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  // 1. UNHEALTHY / UNAUTHENTICATED USERS
  if (!isAuthenticated) {
    if (isAdminPath) {
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }
    if (isClientPath) {
      const redirectUrl = new URL('/login', request.url);
      const targetUrl = sanitizeRedirectUrl(pathname + request.nextUrl.search, '');
      if (targetUrl && targetUrl !== '/projects') {
        redirectUrl.searchParams.set('next', targetUrl);
      }
      return NextResponse.redirect(redirectUrl);
    }
    // /new-project is public for guests (steps 1–4)
    return supabaseResponse;
  }

  // 2. AUTHENTICATED ADMINISTRATORS
  if (userRole === 'admin') {
    // Admins are prohibited from accessing client project creation & self-service pages
    if (isClientPath || isNewProjectPath) {
      return NextResponse.redirect(new URL('/management', request.url));
    }
    // Admins accessing any login route are redirected to management
    if (isClientAuthPage || isAdminAuthPage) {
      return NextResponse.redirect(new URL('/management', request.url));
    }
    return supabaseResponse;
  }

  // 3. AUTHENTICATED CREATOR CLIENTS
  if (userRole === 'client') {
    // Clients attempting to access administration console are redirected to their projects
    if (isAdminPath) {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
    // Clients attempting to access admin login portal are redirected to client login
    if (isAdminAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Clients visiting login/sign-in are redirected to their projects or target next
    if (isClientAuthPage) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const target = sanitizeRedirectUrl(nextParam, '/projects');
      return NextResponse.redirect(new URL(target, request.url));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
