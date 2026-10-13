import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseCredentials, isRealSupabaseConfigured } from './config';

const ADMIN_ONLY_PATHS = ['/management', '/admin'];
const CLIENT_ONLY_PATHS = [
  '/projects',
  '/configure',
  '/wallet',
  '/messages',
  '/redeem-code',
  '/account',
  '/notifications',
];

const AUTH_PREFIXES = ['/login', '/sign-in'];
const ADMIN_AUTH_PATH = '/admin-login';
const ADMIN_TOTP_PATH = '/admin-totp';

/**
 * Strict single-slash path sanitizer:
 * Only accepts paths starting with a single '/', not '//', no '\', no scheme/protocol, no colons.
 * Prevents open redirect attacks across the board.
 */
function sanitizeRedirectUrl(urlParam: string | null | undefined, fallback = '/projects'): string {
  if (!urlParam) return fallback;
  let decoded = urlParam.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  if (
    decoded.startsWith('/') &&
    !decoded.startsWith('//') &&
    !decoded.startsWith('/\\') &&
    !decoded.includes(':') &&
    !decoded.includes('\\')
  ) {
    return decoded;
  }
  return fallback;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Whitelist OAuth callback, cron endpoints, and webhooks so external callers pass cleanly
  if (
    pathname === '/auth/callback' ||
    pathname.startsWith('/auth/callback/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/paypal/webhook')
  ) {
    return supabaseResponse;
  }

  if (!isRealSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { url, key } = getSafeSupabaseCredentials();

  let user: { id: string; email?: string } | null = null;
  let userRole: 'admin' | 'client' = 'client';
  let isAal2 = false;

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
      // Query authoritative role strictly from profiles table (no email allowlist)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      userRole = profile?.role === 'admin' ? 'admin' : 'client';

      if (userRole === 'admin') {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        isAal2 = aalData?.currentLevel === 'aal2';
      }
    }
  } catch {
    user = null;
  }

  const isAuthenticated = Boolean(user && user.email);
  const isAdminAuthPage = pathname === ADMIN_AUTH_PATH || pathname === `${ADMIN_AUTH_PATH}/`;
  const isAdminTotpPage = pathname === ADMIN_TOTP_PATH || pathname === `${ADMIN_TOTP_PATH}/`;
  const isClientAuthPage = AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAdminPath = !isAdminAuthPage && !isAdminTotpPage && ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isClientPath = !isClientAuthPage && CLIENT_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isNewProjectPath = pathname === '/new-project' || pathname.startsWith('/new-project/');

  // Handle Root Gateway ('/')
  if (pathname === '/') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/new-project', request.url));
    }
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL(isAal2 ? '/management' : '/admin-totp?next=/management', request.url));
    }
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  // 1. UNHEALTHY / UNAUTHENTICATED USERS
  if (!isAuthenticated) {
    if (isAdminPath || isAdminTotpPage) {
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
    // /new-project, /admin-login, and /login are public for guests
    return supabaseResponse;
  }

  // 2. AUTHENTICATED ADMINISTRATORS
  if (userRole === 'admin') {
    // If on TOTP verification page
    if (isAdminTotpPage) {
      if (isAal2) {
        return NextResponse.redirect(new URL('/management', request.url));
      }
      return supabaseResponse;
    }

    // Admins must verify TOTP (AAL2) before accessing /management or admin console
    if (isAdminPath) {
      if (!isAal2) {
        const nextUrl = sanitizeRedirectUrl(pathname + request.nextUrl.search, '/management');
        return NextResponse.redirect(new URL(`/admin-totp?next=${encodeURIComponent(nextUrl)}`, request.url));
      }
      return supabaseResponse;
    }

    // Admins are prohibited from accessing client project creation & self-service pages
    if (isClientPath || isNewProjectPath) {
      return NextResponse.redirect(new URL(isAal2 ? '/management' : '/admin-totp?next=/management', request.url));
    }

    // Admins accessing login routes are redirected to console (or TOTP if not verified)
    if (isClientAuthPage || isAdminAuthPage) {
      return NextResponse.redirect(new URL(isAal2 ? '/management' : '/admin-totp?next=/management', request.url));
    }

    return supabaseResponse;
  }

  // 3. AUTHENTICATED CREATOR CLIENTS
  if (userRole === 'client') {
    // Clients attempting to access administration console or TOTP are redirected to their projects
    if (isAdminPath || isAdminTotpPage) {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
    // Clients visiting login/sign-in are redirected to their projects or target next
    if (isClientAuthPage) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const target = sanitizeRedirectUrl(nextParam, '/projects');
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Canonical Redirect Bridge: /projects/:id -> /projects?project=:id (HTTP 307 Temporary Redirect)
    const projectDetailMatch = pathname.match(/^\/projects\/([a-zA-Z0-9_-]+)$/);
    if (projectDetailMatch && projectDetailMatch[1]) {
      const targetUrl = new URL('/projects', request.url);
      targetUrl.searchParams.set('project', projectDetailMatch[1]);
      request.nextUrl.searchParams.forEach((val, key) => {
        if (key !== 'project') targetUrl.searchParams.set(key, val);
      });
      return NextResponse.redirect(targetUrl, 307);
    }
    // Allow /admin-login so users can authenticate with staff credentials if they possess them
    if (isAdminAuthPage) {
      return supabaseResponse;
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
