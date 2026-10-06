import { createClient } from '@/lib/supabase/server';

export interface RequestUser {
  email: string;
  isAdmin: boolean;
  /** True when no real auth provider is configured and we are in local development. */
  isDevFallback: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url.startsWith('https://') || key.length < 20) return false;
  return !/mock|placeholder|your[-_]|example/i.test(`${url} ${key}`);
}

const DEV_USER: RequestUser = { email: 'dev@localhost', isAdmin: true, isDevFallback: true };

/**
 * Resolves the signed-in user for an API request.
 *
 * - With Supabase configured: uses the session cookie; admins are listed in ADMIN_EMAILS.
 * - Without Supabase in development: returns a local dev admin so the app stays usable.
 * - Without Supabase in production: returns null (fail closed).
 */
export async function getRequestUser(): Promise<RequestUser | null> {
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
