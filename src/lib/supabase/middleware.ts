import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseCredentials, isRealSupabaseConfigured } from './config';

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

const ADMIN_EMAILS = [
  'dev@localhost',
  'admin@humantek.art',
  'huzaifa14321furqan@gmail.com',
  ...(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
];

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
  } catch {
    user = null;
  }

  const isAuthenticated = Boolean(user && user.email);
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isManagement = pathname.startsWith('/management');

  // 1. Unauthenticated access to protected route -> redirect to /login
  if ((isProtected || isManagement) && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url);
    const targetUrl = sanitizeRedirectUrl(pathname + request.nextUrl.search, '');
    if (targetUrl && targetUrl !== '/projects') {
      redirectUrl.searchParams.set('next', targetUrl);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated access to auth screens -> redirect to target or /projects
  if (isAuthPage && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const target = sanitizeRedirectUrl(nextParam, '/projects');
    return NextResponse.redirect(new URL(target, request.url));
  }

  // 3. Management route access control
  if (isManagement && isAuthenticated) {
    const email = (user?.email || '').toLowerCase();
    const isAdmin =
      (user?.app_metadata as Record<string, unknown> | undefined)?.role === 'admin' ||
      ADMIN_EMAILS.includes(email);

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
  }

  return supabaseResponse;
}
