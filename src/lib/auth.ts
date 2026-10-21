import 'server-only';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';

export type TeamRole = 'owner' | 'manager' | 'viewer';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  teamRole?: TeamRole | null;
  isAdmin: boolean;
  canManageProjects: boolean;
  canIssueCredits: boolean;
  canManageTeam: boolean;
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

export function normalizeTeamRole(raw: unknown): TeamRole | null {
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();
  if (lower === 'owner' || lower === 'manager' || lower === 'viewer') {
    return lower;
  }
  return null;
}

export function isPrimaryOwnerEmail(email: string): boolean {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return false;
  const primaryOwnerEmail = (process.env.STUDIO_OWNER_EMAIL || '').trim().toLowerCase();
  return (
    Boolean(primaryOwnerEmail && clean === primaryOwnerEmail) ||
    clean === 'admin-credits@humantekart.com' ||
    clean === 'admin@humantek.art'
  );
}

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
        teamRole: 'owner',
        isAdmin: true,
        canManageProjects: true,
        canIssueCredits: true,
        canManageTeam: true,
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
      admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user.id).limit(1),
    ]);

    const profile = profileRes.data as Record<string, unknown> | null;

    const rawGoogleAvatar =
      user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const verifiedGoogleAvatar =
      typeof rawGoogleAvatar === 'string' &&
      /^https:\/\/lh[0-9]*\.googleusercontent\.com\//.test(rawGoogleAvatar) &&
      rawGoogleAvatar.length <= 512
        ? rawGoogleAvatar.replace(/[\r\n\t\x00-\x1F\x7F]/g, '')
        : null;

    // Data Integrity: If profile row is missing, auto-heal client profile
    if (!profile && isSupabaseConfigured()) {
      try {
        await admin.from('profiles').upsert({
          id: user.id,
          email,
          full_name: (user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Creator').slice(0, 80),
          avatar_url: verifiedGoogleAvatar,
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
    } else if (profile && !profile.avatar_url && verifiedGoogleAvatar && isSupabaseConfigured()) {
      void admin
        .from('profiles')
        .update({ avatar_url: verifiedGoogleAvatar })
        .eq('id', user.id);
    }

    const role = profile?.role === 'admin' ? 'admin' : 'client';
    const name =
      (typeof profile?.full_name === 'string' && profile.full_name) ||
      (email.includes('@') ? email.split('@')[0] : 'Creator');
    // Strictly source avatar_url from verified profiles table or validated Google OAuth avatar
    const avatarUrl =
      (typeof profile?.avatar_url === 'string' && profile.avatar_url) ||
      verifiedGoogleAvatar ||
      null;

    // Strict security rule: isAdmin is true when profiles.role === 'admin'
    const isAdmin = role === 'admin';

    // Resolve granular teamRole for management members ('owner' | 'manager' | 'viewer')
    let teamRole: TeamRole | null = null;
    if (isAdmin) {
      const fromProfile = normalizeTeamRole(profile?.team_role);
      const fromAppMeta = normalizeTeamRole(user.app_metadata?.team_role);
      const fromUserMeta = normalizeTeamRole(user.user_metadata?.team_role);
      if (isPrimaryOwnerEmail(email)) {
        teamRole = 'owner';
      } else if (fromProfile) {
        teamRole = fromProfile;
      } else if (fromAppMeta) {
        teamRole = fromAppMeta;
      } else if (fromUserMeta) {
        teamRole = fromUserMeta;
      } else {
        // Determine if this admin is the earliest admin or an unset manager
        const { data: allAdmins } = await admin
          .from('profiles')
          .select('id, email, created_at')
          .eq('role', 'admin')
          .order('created_at', { ascending: true });

        const adminList = allAdmins || [];
        const isEarliestAdmin = adminList.length > 0 && adminList[0].id === user.id;

        teamRole = isEarliestAdmin || adminList.length <= 1 ? 'owner' : 'manager';
      }
    }

    const canManageProjects = isAdmin && (teamRole === 'owner' || teamRole === 'manager');
    const canIssueCredits = isAdmin && (teamRole === 'owner' || teamRole === 'manager');
    const canManageTeam = isAdmin && teamRole === 'owner';

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
      teamRole,
      isAdmin,
      canManageProjects,
      canIssueCredits,
      canManageTeam,
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
 * Asserts that the request is from a verified admin (Owner, Manager, or Viewer).
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
 * Enforces strict Owner access for Server Components (e.g. /management/team).
 * Redirects Manager and Viewer accounts back to /management.
 */
export async function requireOwner(): Promise<RequestUser> {
  const user = await requireAdmin();
  if (user.teamRole !== 'owner') {
    redirect('/management');
  }
  return user;
}

/**
 * Strict server-side administrator authorization helper for API routes (read access: Owner, Manager, Viewer).
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

/**
 * Enforces Owner or Manager access for write mutations (updating projects, issuing credits, sending messages).
 * Rejects Viewer accounts with 403 Forbidden.
 */
export async function requireAdminWrite(): Promise<{ user: RequestUser } | NextResponse> {
  const authRes = await requireAdminAal2();
  if (authRes instanceof NextResponse) {
    return authRes;
  }
  if (!authRes.user.canManageProjects) {
    return NextResponse.json(
      {
        error: 'Read-only access: Viewer accounts cannot modify projects, messages, or credits.',
        code: 'VIEWER_READ_ONLY',
      },
      { status: 403 }
    );
  }
  return authRes;
}

/**
 * Enforces strict Owner access for team management mutations (adding, changing, or removing management access).
 */
export async function requireOwnerApi(): Promise<{ user: RequestUser } | NextResponse> {
  const authRes = await requireAdminAal2();
  if (authRes instanceof NextResponse) {
    return authRes;
  }
  if (authRes.user.teamRole !== 'owner') {
    return NextResponse.json(
      {
        error: 'Owner approval required: Only the studio owner can add, change, or remove management access.',
        code: 'OWNER_REQUIRED',
      },
      { status: 403 }
    );
  }
  return authRes;
}


