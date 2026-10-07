import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/sign-in', '/forgot-password', '/signup'];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sessionCookie = req.cookies.get('session')?.value;
  const hasSession = Boolean(sessionCookie);

  const isPublic = PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // 1. Gateway route `/`: No UI, server-side instant redirect
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(hasSession ? '/projects' : '/login', req.url)
    );
  }

  // 2. Unauthenticated access to protected routes: redirect to `/login?next=...`
  if (!hasSession && !isPublic) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  // 3. Authenticated user opening auth pages: redirect to `/projects`
  if (hasSession && (pathname === '/login' || pathname === '/sign-in')) {
    return NextResponse.redirect(new URL('/projects', req.url));
  }

  // 4. Passthrough to Supabase session refresh if active
  return await updateSession(req);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/*)
     * - _next/static (static build files)
     * - _next/image (Next image optimization)
     * - favicon.ico, images, and fonts
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|woff|woff2)$).*)',
  ],
};
