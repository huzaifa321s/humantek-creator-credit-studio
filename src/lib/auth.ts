import { createClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { getSession } from '@/lib/session';

export interface RequestUser {
  id?: string;
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

const DEV_USER: RequestUser = { id: '00000000-0000-0000-0000-000000000001', email: 'dev@localhost', isAdmin: true, isDevFallback: true };

/**
 * Resolves the signed-in user for an API request.
 *
 * - Checks Supabase auth cookie first using authoritative getUser().
 * - Checks the signed session cookie.
 * - In local development without Supabase: returns a local dev admin.
 * - In production without Supabase: returns null (fail closed).
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  // 1. Check Supabase authoritative getUser() if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        const email = (data.user.email || '').toLowerCase();
        return {
          id: data.user.id,
          email,
          isAdmin: adminEmails().includes(email) || data.user.app_metadata?.role === 'admin',
          isDevFallback: false,
        };
      }
    } catch {
      // Fall through to cookie session
    }
  }

  // 2. Check signed server session cookie
  try {
    const session = await getSession();
    if (session?.email) {
      const email = session.email.toLowerCase();
      return {
        id: session.sub,
        email,
        isAdmin: adminEmails().includes(email) || session.role === 'admin',
        isDevFallback: false,
      };
    }
  } catch {
    // Fall through
  }

  return isProduction ? null : DEV_USER;
}
