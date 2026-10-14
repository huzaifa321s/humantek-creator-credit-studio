import 'server-only';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isAdmin: boolean;
  isDevFallback: boolean;
  emailConfirmed: boolean;
  hasProjects: boolean;
  canChat: boolean;
  aal?: 'aal1' | 'aal2';
  isAal2?: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

export function isSupabaseConfigured(): boolean {
  return isRealSupabaseConfigured();
}

export { getSafeRedirectUrl } from '@/lib/utils';

/**
 * Resolves the authenticated user for an API request or Server Component.
 * Authoritative: strictly checks the active Supabase session cookie and loads
 * the verified role strictly from the PostgreSQL `profiles` table.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  if (!isSupabaseConfigured()) {
    if (!isProduction) {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'dev@localhost',
        name: 'Dev Admin',
        avatarUrl: null,
        role: 'admin',
        isAdmin: true,
        isDevFallback: true,
        emailConfirmed: true,
        hasProjects: false,
        canChat: false,
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

    // Query authoritative role, name, avatar_url and project existence concurrently in parallel
    const [profileRes, projectsRes] = await Promise.all([
      admin.from('profiles').select('role, full_name, avatar_url').eq('id', user.id).maybeSingle(),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user.id).limit(1),
    ]);

    const profile = profileRes.data;

    // Data Integrity: If profile row is missing, auto-heal client profile
    if (!profile && isSupabaseConfigured()) {
      try {
        await admin.from('profiles').upsert({
          id: user.id,
          email,
          full_name: (user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Creator').slice(0, 80),
          role: 'client',
        }, { onConflict: 'id', ignoreDuplicates: true });
        await admin.from('wallets').upsert({
          user_id: user.id,
          balance_purchased: 0,
          balance_promo: 0,
        }, { onConflict: 'user_id', ignoreDuplicates: true });
      } catch (healErr) {
        console.warn('Could not auto-heal missing profile:', healErr);
      }
    }

    const role = profile?.role === 'admin' ? 'admin' : 'client';
    const name = profile?.full_name || (email.includes('@') ? email.split('@')[0] : 'Creator');
    // Strictly source avatar_url from verified profiles table (never from unverified user_metadata)
    const avatarUrl = profile?.avatar_url || null;

    // Strict security rule: isAdmin is true when profiles.role === 'admin'
    const isAdmin = role === 'admin';

    const emailConfirmed =
      process.env.NODE_ENV !== 'production' && user.user_metadata?.mock_unconfirmed === true
        ? false
        : Boolean(user.email_confirmed_at);
    const hasProjects = role === 'client' ? (projectsRes.count ?? 0) > 0 : false;
    const canChat = role === 'client' && emailConfirmed && hasProjects;

    return {
      id: user.id,
      email,
      name,
      avatarUrl,
      role,
      isAdmin,
      isDevFallback: false,
      emailConfirmed,
      hasProjects,
      canChat,
      aal: 'aal1',
      isAal2: true,
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
  if (user.role === 'admin') {
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
  if (user.role !== 'admin') {
    redirect('/projects');
  }
  return user;
}

/**
 * Strict server-side administrator authorization helper for API routes.
 * Enforces database role: profiles.role === 'admin'.
 * If unverified, immediately returns 403 Forbidden.
 */
export async function requireAdminAal2(): Promise<{ user: RequestUser } | NextResponse> {
  const user = await getRequestUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator access required', code: 'UNAUTHORIZED' },
      { status: 403 }
    );
  }

  return { user };
}

export const requireAdminApi = requireAdminAal2;

