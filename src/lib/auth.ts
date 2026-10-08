import 'server-only';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';

export interface RequestUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isDevFallback: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

import { ADMIN_EMAILS, isSystemAdminEmail } from '@/lib/auth/roles';

function adminEmails(): string[] {
  return ADMIN_EMAILS;
}

export function isSupabaseConfigured(): boolean {
  return isRealSupabaseConfigured();
}

export { getSafeRedirectUrl } from '@/lib/utils';

/**
 * Resolves the authenticated user for an API request or Server Component.
 * Authoritative: strictly checks the active Supabase session cookie and loads
 * the verified role from the PostgreSQL `profiles` table.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  if (!isSupabaseConfigured()) {
    if (!isProduction) {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'dev@localhost',
        role: 'admin',
        isAdmin: true,
        isDevFallback: true,
      };
    }
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      return null;
    }

    const email = user.email.toLowerCase();
    const admin = createAdminClient();

    // Query authoritative role from database
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || (isSystemAdminEmail(email) ? 'admin' : 'client');
    const isAdmin = role === 'admin' || isSystemAdminEmail(email);

    return {
      id: user.id,
      email,
      role: isAdmin ? 'admin' : 'client',
      isAdmin,
      isDevFallback: false,
    };
  } catch {
    return null;
  }
}

/**
 * Asserts that the request is authenticated. Redirects to `/login` if unauthenticated.
 */
export async function requireUser(): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Asserts that the request is from a verified non-admin client.
 * Redirects admins to `/management`.
 * Redirects unauthenticated users to `/login`.
 */
export async function requireClient(): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    redirect('/login');
  }
  if (user.isAdmin) {
    redirect('/management');
  }
  return user;
}

/**
 * Asserts that the request is from a verified admin.
 * Redirects unauthenticated users to `/admin-login`.
 * Redirects non-admins to `/projects`.
 */
export async function requireAdmin(): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    redirect('/admin-login');
  }
  if (!user.isAdmin) {
    redirect('/projects');
  }
  return user;
}

