import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, type TeamRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'client';
  teamRole: TeamRole | null;
  isAdmin: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  authProvider: 'google' | 'email';
}

function cleanText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').trim().slice(0, maxLen);
}

/**
 * GET /api/profile
 * Returns the authenticated user's real profile details across all roles (Client, Owner, Manager, Viewer).
 */
export async function GET() {
  try {
    const reqUser = await getRequestUser();
    if (!reqUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (reqUser.isDevFallback) {
      const fallback: UserProfileResponse = {
        id: reqUser.id,
        email: reqUser.email,
        name: reqUser.name,
        avatarUrl: reqUser.avatarUrl,
        role: reqUser.isAdmin ? 'admin' : 'client',
        teamRole: reqUser.teamRole || null,
        isAdmin: reqUser.isAdmin,
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
        authProvider: 'email',
      };
      return NextResponse.json({ profile: fallback });
    }

    const admin = createAdminClient();
    const [profileRes, authUserRes] = await Promise.all([
      admin.from('profiles').select('*').eq('id', reqUser.id).maybeSingle(),
      admin.auth.admin.getUserById(reqUser.id),
    ]);

    const profileRow = (profileRes.data || {}) as Record<string, unknown>;
    const authUser = authUserRes.data?.user;
    const userMeta = (authUser?.user_metadata || {}) as Record<string, unknown>;
    const appMeta = (authUser?.app_metadata || {}) as Record<string, unknown>;

    const providers = Array.isArray(appMeta.providers)
      ? appMeta.providers.map((p) => String(p).toLowerCase())
      : [];
    const primaryProvider = String(appMeta.provider || '').toLowerCase();
    const authProvider: 'google' | 'email' =
      primaryProvider === 'google' || providers.includes('google') ? 'google' : 'email';

    const resolvedName =
      cleanText(profileRow.full_name, 80) ||
      cleanText(userMeta.full_name, 80) ||
      cleanText(userMeta.name, 80) ||
      reqUser.name;

    const rawGoogleAvatar = userMeta.avatar_url || userMeta.picture;
    const verifiedGoogleAvatar =
      typeof rawGoogleAvatar === 'string' &&
      /^https:\/\/lh[0-9]*\.googleusercontent\.com\//.test(rawGoogleAvatar) &&
      rawGoogleAvatar.length <= 512
        ? rawGoogleAvatar.replace(/[\r\n\t\x00-\x1F\x7F]/g, '')
        : null;

    const resolvedAvatarUrl =
      reqUser.avatarUrl ||
      (typeof profileRow.avatar_url === 'string' && profileRow.avatar_url) ||
      verifiedGoogleAvatar ||
      null;

    const createdAt =
      (typeof profileRow.created_at === 'string' && profileRow.created_at) ||
      authUser?.created_at ||
      new Date().toISOString();

    const response: UserProfileResponse = {
      id: reqUser.id,
      email: reqUser.email,
      name: resolvedName,
      avatarUrl: resolvedAvatarUrl,
      role: reqUser.isAdmin ? 'admin' : 'client',
      teamRole: reqUser.teamRole || null,
      isAdmin: reqUser.isAdmin,
      emailConfirmed: reqUser.emailConfirmed,
      createdAt,
      authProvider,
    };

    return NextResponse.json({ profile: response });
  } catch (err) {
    console.error('Error in GET /api/profile:', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Updates the authenticated user's Full Name (and optional password) in public.profiles and auth.users.
 */
export async function PATCH(req: NextRequest) {
  try {
    const reqUser = await getRequestUser();
    if (!reqUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const nextName = cleanText(body.name, 80);
    const nextPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (nextPassword && nextPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (!nextPassword && (!nextName || nextName.length < 2)) {
      return NextResponse.json(
        { error: 'Full name must be at least 2 characters long.' },
        { status: 400 }
      );
    }

    if (reqUser.isDevFallback) {
      return NextResponse.json({
        success: true,
        profile: {
          id: reqUser.id,
          email: reqUser.email,
          name: nextName || reqUser.name,
        },
      });
    }

    const admin = createAdminClient();

    // 1. Update public.profiles full_name if provided
    if (nextName && nextName.length >= 2) {
      const { error: profErr } = await admin
        .from('profiles')
        .update({ full_name: nextName })
        .eq('id', reqUser.id);

      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 400 });
      }
    }

    // 2. Sync auth.users user_metadata full_name & name (and optional password)
    const { data: existingAuth } = await admin.auth.admin.getUserById(reqUser.id);
    const currentMeta = (existingAuth?.user?.user_metadata || {}) as Record<string, unknown>;

    const { error: authErr } = await admin.auth.admin.updateUserById(reqUser.id, {
      ...(nextPassword ? { password: nextPassword } : {}),
      ...(nextName && nextName.length >= 2
        ? {
            user_metadata: {
              ...currentMeta,
              full_name: nextName,
              name: nextName,
            },
          }
        : {}),
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: reqUser.id,
        email: reqUser.email,
        name: nextName || reqUser.name,
      },
    });
  } catch (err) {
    console.error('Error in PATCH /api/profile:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
