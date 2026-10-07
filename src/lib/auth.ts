import { createClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { getSession } from '@/lib/session';

export interface RequestUser {
  email: string;
  isAdmin: boolean;
  /** True when no real auth provider is configured and we are in local development. */
  isDevFallback: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

function adminEmails(): string[] {
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return ['dev@localhost', 'admin@humantek.art', 'huzaifa14321furqan@gmail.com', ...envAdmins];
}

export function isSupabaseConfigured(): boolean {
  return isRealSupabaseConfigured();
}

const DEV_USER: RequestUser = { email: 'dev@localhost', isAdmin: true, isDevFallback: true };

/**
 * Resolves the signed-in user for an API request.
 *
 * - Checks the tamper-proof session cookie first.
 * - With Supabase configured: uses the Supabase session cookie.
 * - Without Supabase in development: returns a local dev admin so the app stays usable.
 * - Without Supabase in production: returns null (fail closed).
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  // 1. Check server session cookie first
  try {
    const session = await getSession();
    if (session?.email) {
      const email = session.email.toLowerCase();
      return {
        email,
        isAdmin: adminEmails().includes(email) || session.role === 'admin',
        isDevFallback: false,
      };
    }
  } catch {
    // Fall through to other auth checks
  }

  // 2. Check Supabase if configured
  if (!isSupabaseConfigured()) {
    return isProduction ? null : DEV_USER;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    const email = data.user.email.toLowerCase();
    return { email, isAdmin: adminEmails().includes(email), isDevFallback: false };
  } catch {
    return isProduction ? null : DEV_USER;
  }
}
