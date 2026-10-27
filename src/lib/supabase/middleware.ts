import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseCredentials, isRealSupabaseConfigured } from './config';

const ADMIN_ONLY_PATHS = ['/management', '/admin'];
const CLIENT_ONLY_PATHS = [
  '/projects',
  '/configure',
  '/wallet',
  '/billing',
  '/messages',
  '/redeem-code',
  '/account',
];
const SHARED_AUTH_PATHS = ['/notifications', '/profile'];

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

function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
  status?: number
): NextResponse {
  const res = status ? NextResponse.redirect(url, status) : NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
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
      // Query authoritative role strictly from profiles table (using service role key if available so RLS never blocks role check)
      const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
      const roleClient = serviceKey
        ? createServerClient(url, serviceKey, {
            cookies: { getAll: () => [], setAll: () => {} },
          })
        : supabase;
      const { data: profile } = await roleClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      userRole = profile?.role === 'admin' ? 'admin' : 'client';
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
  const isSharedAuthPath = SHARED_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isNewProjectPath = pathname === '/new-project' || pathname.startsWith('/new-project/');

  // Handle Root Gateway ('/')
  if (pathname === '/') {
    if (!isAuthenticated) {
      return redirectWithCookies(new URL('/new-project', request.url), supabaseResponse);
    }
    if (userRole === 'admin') {
      return redirectWithCookies(new URL('/management', request.url), supabaseResponse);
    }
    return redirectWithCookies(new URL('/projects', request.url), supabaseResponse);
  }

  // 1. UNHEALTHY / UNAUTHENTICATED USERS
  if (!isAuthenticated) {
    if (isAdminPath || isAdminTotpPage) {
      const redirectUrl = new URL('/admin-login', request.url);
      const targetUrl = sanitizeRedirectUrl(pathname + request.nextUrl.search, '');
      if (targetUrl && targetUrl !== '/management' && targetUrl !== '/admin-totp') {
        redirectUrl.searchParams.set('next', targetUrl);
      }
      return redirectWithCookies(redirectUrl, supabaseResponse);
    }
    if (isClientPath || isSharedAuthPath) {
      const redirectUrl = new URL('/login', request.url);
      const targetUrl = sanitizeRedirectUrl(pathname + request.nextUrl.search, '');
      if (targetUrl && targetUrl !== '/projects') {
        redirectUrl.searchParams.set('next', targetUrl);
      }
      return redirectWithCookies(redirectUrl, supabaseResponse);
    }
    // /new-project, /admin-login, and /login are public for guests
    return supabaseResponse;
  }

  // 2. AUTHENTICATED ADMINISTRATORS
  const isPasswordResetFlow =
    isClientAuthPage && request.nextUrl.searchParams.get('reset') === 'true';

  if (userRole === 'admin') {
    if (isAdminTotpPage) {
      return redirectWithCookies(new URL('/management', request.url), supabaseResponse);
    }

    if (isAdminPath || isSharedAuthPath || isPasswordResetFlow) {
      return supabaseResponse;
    }

    // Admins are prohibited from accessing client project creation & self-service pages
    if (isClientPath || isNewProjectPath) {
      return redirectWithCookies(new URL('/management', request.url), supabaseResponse);
    }

    // Admins accessing login routes are redirected to console
    if (isClientAuthPage || isAdminAuthPage) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const target = sanitizeRedirectUrl(nextParam, '/management');
      const safeAdminTarget = ADMIN_ONLY_PATHS.some((p) => target === p || target.startsWith(p + '/'))
        ? target
        : '/management';
      return redirectWithCookies(new URL(safeAdminTarget, request.url), supabaseResponse);
    }

    return supabaseResponse;
  }

  // 3. AUTHENTICATED CREATOR CLIENTS
  if (userRole === 'client') {
    // Clients attempting to access administration console or legacy TOTP are redirected to their projects
    if (isAdminPath || isAdminTotpPage) {
      return redirectWithCookies(new URL('/projects', request.url), supabaseResponse);
    }
    // Allow password reset completion screen (/login?reset=true) even when recovery session is active
    if (isPasswordResetFlow) {
      return supabaseResponse;
    }
    // Clients visiting login/sign-in are redirected to their projects or target next
    if (isClientAuthPage) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const target = sanitizeRedirectUrl(nextParam, '/projects');
      return redirectWithCookies(new URL(target, request.url), supabaseResponse);
    }

    // Canonical Redirect Bridge: /projects/:id -> /projects?project=:id (HTTP 307 Temporary Redirect)
    const projectDetailMatch = pathname.match(/^\/projects\/([a-zA-Z0-9_-]+)$/);
    if (projectDetailMatch && projectDetailMatch[1]) {
      const targetUrl = new URL('/projects', request.url);
      targetUrl.searchParams.set('project', projectDetailMatch[1]);
      request.nextUrl.searchParams.forEach((val, key) => {
        if (key !== 'project') targetUrl.searchParams.set(key, val);
      });
      return redirectWithCookies(targetUrl, supabaseResponse, 307);
    }
    // Allow /admin-login so users can authenticate with staff credentials if they possess them
    if (isAdminAuthPage) {
      return supabaseResponse;
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
