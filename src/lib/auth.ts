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

    // Security & Data Integrity: If profile row is missing, raise an alert and auto-heal
    if (!profile && isSupabaseConfigured()) {
      try {
        await admin.from('admin_alerts').insert({
          type: 'missing_profile',
          message: `Authenticated user ${user.id} (${email}) has no profile row. Auto-healing client profile.`,
          metadata: { userId: user.id, email, severity: 'warning' },
        });
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
      } catch (alertErr) {
        console.warn('Could not record missing profile alert:', alertErr);
      }
    }

    const role = profile?.role === 'admin' ? 'admin' : 'client';
    const name = profile?.full_name || (email.includes('@') ? email.split('@')[0] : 'Creator');
    // Strictly source avatar_url from verified profiles table (never from unverified user_metadata)
    const avatarUrl = profile?.avatar_url || null;

    // Determine Authenticator Assurance Level via Supabase Native MFA
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const aal = (aalData?.currentLevel as 'aal1' | 'aal2') || 'aal1';
    const isAal2 = aal === 'aal2';

    // Strict security rule: isAdmin is true ONLY when profiles.role === 'admin' AND session assurance is AAL2!
    // If an admin has only passed password/OAuth (AAL1), isAdmin is strictly false across all non-management routes.
    const isAdmin = role === 'admin' && isAal2;

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
      aal,
      isAal2,
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
 * Redirects admins to `/management` (or `/admin-totp` if AAL2 not completed).
 * Redirects unauthenticated users to `/login`.
 */
export async function requireClient(): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    redirect('/login');
  }
  if (user.role === 'admin') {
    if (!user.isAal2) {
      redirect('/admin-totp?next=/management');
    }
    redirect('/management');
  }
  return user;
}

/**
 * Asserts that the request is from a verified admin who has completed AAL2 two-factor verification.
 * Redirects unauthenticated users to `/admin-login`.
 * Redirects non-admins to `/projects`.
 * Redirects admins without AAL2 to `/admin-totp`.
 */
export async function requireAdmin(): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    redirect('/admin-login');
  }
  if (user.role !== 'admin') {
    redirect('/projects');
  }
  if (!user.isAal2) {
    redirect('/admin-totp?next=/management');
  }
  return user;
}

/**
 * Strict server-side administrator authorization helper for API routes.
 * Enforces BOTH:
 * 1. Database role: profiles.role === 'admin'
 * 2. Authenticator Assurance Level: AAL2 (Supabase Native MFA TOTP)
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

  if (!user.isAal2) {
    return NextResponse.json(
      {
        error: 'Two-factor authentication (AAL2) required to access management operations.',
        code: 'AAL2_REQUIRED',
        redirect: '/admin-totp',
      },
      { status: 403 }
    );
  }

  return { user };
}

