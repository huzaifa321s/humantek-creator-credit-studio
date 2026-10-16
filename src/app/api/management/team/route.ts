import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdminAal2,
  requireOwnerApi,
  normalizeTeamRole,
  isPrimaryOwnerEmail,
  type TeamRole,
} from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  teamRole: TeamRole;
  createdAt: string;
}

export interface TeamAccessResponse {
  members: TeamMemberRecord[];
  ownerEmail: string;
  ownerName: string;
  currentUserRole: TeamRole;
  canManageTeam: boolean;
}

function computeInitials(name?: string | null, email?: string | null): string {
  const cleanName = (name || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  if (cleanEmail.includes('@')) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }
  return 'TM';
}

function isAutomatedE2ETestAdmin(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower.endsWith('.test') || lower.startsWith('e2e-') || lower.startsWith('test-');
}

async function tryUpdateProfileTeamRole(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  teamRole: TeamRole | null
) {
  try {
    await admin
      .from('profiles')
      .update({ team_role: teamRole } as Record<string, unknown>)
      .eq('id', userId);
  } catch {
    // Ignore if team_role column migration hasn't been applied yet; app_metadata is also updated
  }
}

export async function GET() {
  const authRes = await requireOwnerApi();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  const { user: currentUser } = authRes;

  try {
    const admin = createAdminClient();

    const [profilesRes, authUsersRes] = await Promise.all([
      admin
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: true }),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const adminProfiles = (profilesRes.data || []) as Array<Record<string, unknown>>;
    const authUsers = authUsersRes.data?.users || [];
    const authUsersById = new Map(authUsers.map((u) => [u.id, u]));

    const missingAdminProfiles = adminProfiles.filter((p) => {
      const id = String(p.id || '');
      return id && !authUsersById.has(id);
    });

    if (missingAdminProfiles.length > 0) {
      const missingAuthResults = await Promise.all(
        missingAdminProfiles.map((p) => admin.auth.admin.getUserById(String(p.id)))
      );
      for (const res of missingAuthResults) {
        if (res.data?.user) {
          authUsersById.set(res.data.user.id, res.data.user);
        }
      }
    }

    const primaryOwnerEnv = (process.env.STUDIO_OWNER_EMAIL || '').trim().toLowerCase();

    // First pass: map raw profiles & filter out synthetic E2E accounts unless current user is one
    const rawMembers = adminProfiles.filter((p) => {
      const email = String(p.email || '').toLowerCase();
      if (p.id === currentUser.id) return true;
      return !isAutomatedE2ETestAdmin(email);
    });

    // Determine who the owner is using the exact same precedence as getRequestUser()
    let explicitOwnerFound = false;
    const mapped: TeamMemberRecord[] = rawMembers.map((p) => {
      const id = String(p.id || '');
      const email = String(p.email || '').toLowerCase().trim();
      const authUser = authUsersById.get(id);
      const rawName =
        (typeof p.full_name === 'string' && p.full_name.trim()) ||
        (typeof authUser?.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name.trim()) ||
        (typeof authUser?.user_metadata?.name === 'string' && authUser.user_metadata.name.trim()) ||
        (email.includes('@') ? email.split('@')[0] : 'Team Member');

      const fromCol = normalizeTeamRole(p.team_role);
      const fromMeta = normalizeTeamRole(authUser?.app_metadata?.team_role);
      let resolvedRole: TeamRole;

      if (isPrimaryOwnerEmail(email)) {
        resolvedRole = 'owner';
      } else if (fromCol || fromMeta) {
        resolvedRole = fromCol || fromMeta || 'manager';
      } else {
        resolvedRole = 'manager';
      }

      if (resolvedRole === 'owner') {
        explicitOwnerFound = true;
      }

      return {
        id,
        name: rawName,
        email,
        initials: computeInitials(rawName, email),
        avatarUrl: typeof p.avatar_url === 'string' ? p.avatar_url : null,
        teamRole: resolvedRole,
        createdAt: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
      };
    });

    // Guarantee at least one Owner exists (earliest admin if none explicitly marked)
    if (!explicitOwnerFound && mapped.length > 0) {
      mapped[0].teamRole = 'owner';
    }

    // Sort: Owner first, then Managers, then Viewers, then by createdAt
    const roleWeight: Record<TeamRole, number> = {
      owner: 0,
      manager: 1,
      viewer: 2,
    };

    mapped.sort((a, b) => {
      const diff = roleWeight[a.teamRole] - roleWeight[b.teamRole];
      if (diff !== 0) return diff;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const ownerMember = mapped.find((m) => m.teamRole === 'owner') || mapped[0];
    const currentMember = mapped.find((m) => m.id === currentUser.id);
    const effectiveCurrentRole: TeamRole =
      currentMember?.teamRole || currentUser.teamRole || 'manager';

    const response: TeamAccessResponse = {
      members: mapped,
      ownerEmail: ownerMember?.email || primaryOwnerEnv || 'saadahmed7066@gmail.com',
      ownerName: ownerMember?.name || 'Studio Owner',
      currentUserRole: effectiveCurrentRole,
      canManageTeam: effectiveCurrentRole === 'owner',
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Error in GET /api/management/team:', err);
    return NextResponse.json({ error: 'Failed to load team access list' }, { status: 500 });
  }
}

/**
 * POST /api/management/team
 * Restricted to Studio Owner. Grants management access ('manager' | 'viewer') to a user.
 * If the user does not yet have an account in Supabase Auth, creates one automatically.
 */
export async function POST(req: NextRequest) {
  const authRes = await requireOwnerApi();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body.email || '');
    const email = rawEmail.trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (
      typeof body.password === 'string' &&
      body.password.trim().length > 0 &&
      body.password.trim().length < 8
    ) {
      return NextResponse.json(
        { error: 'Initial password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (
      isPrimaryOwnerEmail(rawEmail) ||
      email === authRes.user.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Protected Studio Owner accounts cannot be modified or overwritten.' },
        { status: 403 }
      );
    }

    if (normalizeTeamRole(body.teamRole) === 'owner') {
      return NextResponse.json(
        { error: 'Only manager or viewer roles can be assigned.' },
        { status: 400 }
      );
    }

    const requestedRole: 'manager' | 'viewer' =
      normalizeTeamRole(body.teamRole) === 'viewer' ? 'viewer' : 'manager';

    const admin = createAdminClient();

    // 1. Check if a profile or auth user already exists for this email
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, email, full_name, role, team_role, avatar_url, created_at')
      .ilike('email', email)
      .maybeSingle();

    if (
      existingProfile &&
      existingProfile.role === 'admin' &&
      normalizeTeamRole(existingProfile.team_role) === 'owner'
    ) {
      return NextResponse.json(
        { error: 'Protected Studio Owner accounts cannot be modified or overwritten.' },
        { status: 403 }
      );
    }

    const displayName = (
      name ||
      (typeof existingProfile?.full_name === 'string' ? existingProfile.full_name.trim() : '') ||
      email.split('@')[0] ||
      'Team Member'
    ).slice(0, 80);

    let targetUserId: string | null = existingProfile?.id || null;
    let existingAuthUser: {
      id: string;
      created_at?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    } | null = null;

    if (!targetUserId) {
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const matchedAuthUser = (listData?.users || []).find(
        (u) => u.email?.toLowerCase() === email
      );
      if (matchedAuthUser) {
        targetUserId = matchedAuthUser.id;
        existingAuthUser = matchedAuthUser;
      }
    }

    // 2. If user doesn't exist in Supabase Auth yet, create the auth account
    if (!targetUserId) {
      const initialPassword =
        password.length >= 8
          ? password
          : `Humantek#${Math.random().toString(36).slice(2, 8)}!9A`;

      const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          name: displayName,
        },
        app_metadata: {
          team_role: requestedRole,
        },
      });

      if (createErr || !createdAuth.user) {
        return NextResponse.json(
          { error: createErr?.message || 'Could not create team member account.' },
          { status: 400 }
        );
      }

      targetUserId = createdAuth.user.id;
    } else {
      // Update existing auth user's metadata & optional password
      const { data: existingAuth } = await admin.auth.admin.getUserById(targetUserId);
      if (existingAuth?.user) {
        existingAuthUser = existingAuth.user;
      }
      const currentAppMeta = existingAuthUser?.app_metadata || {};
      const currentUserMeta = existingAuthUser?.user_metadata || {};

      if (
        existingProfile?.role === 'admin' &&
        normalizeTeamRole(currentAppMeta.team_role) === 'owner'
      ) {
        return NextResponse.json(
          { error: 'Protected Studio Owner accounts cannot be modified or overwritten.' },
          { status: 403 }
        );
      }

      await admin.auth.admin.updateUserById(targetUserId, {
        email_confirm: true,
        ...(password.length >= 8 ? { password } : {}),
        user_metadata: {
          ...currentUserMeta,
          ...(name ? { full_name: displayName, name: displayName } : {}),
        },
        app_metadata: {
          ...currentAppMeta,
          team_role: requestedRole,
        },
      });
    }

    // 3. Upsert profile with role = 'admin' (so all management RLS policies pass)
    const { error: upsertErr } = await admin.from('profiles').upsert(
      {
        id: targetUserId,
        email,
        full_name: displayName,
        role: 'admin',
      },
      { onConflict: 'id' }
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    await tryUpdateProfileTeamRole(admin, targetUserId, requestedRole);

    // Ensure wallet row exists
    await admin.from('wallets').upsert(
      {
        user_id: targetUserId,
        balance_purchased: 0,
        balance_promo: 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );

    const resolvedAvatarUrl =
      (typeof existingProfile?.avatar_url === 'string' && existingProfile.avatar_url) ||
      (typeof existingAuthUser?.user_metadata?.avatar_url === 'string' &&
        existingAuthUser.user_metadata.avatar_url) ||
      null;
    const resolvedCreatedAt =
      (typeof existingProfile?.created_at === 'string' && existingProfile.created_at) ||
      existingAuthUser?.created_at ||
      new Date().toISOString();

    return NextResponse.json({
      success: true,
      member: {
        id: targetUserId,
        name: displayName,
        email,
        initials: computeInitials(displayName, email),
        avatarUrl: resolvedAvatarUrl,
        teamRole: requestedRole,
        createdAt: resolvedCreatedAt,
      },
    });
  } catch (err) {
    console.error('Error in POST /api/management/team:', err);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}

/**
 * PATCH /api/management/team
 * Restricted to Studio Owner. Updates a team member's role ('owner' | 'manager' | 'viewer').
 */
export async function PATCH(req: NextRequest) {
  const authRes = await requireOwnerApi();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const newRole = normalizeTeamRole(body.teamRole);

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: 'Valid userId and teamRole (owner, manager, or viewer) are required.' },
        { status: 400 }
      );
    }

    // Prevent the current owner from demoting themselves if they are the only owner
    if (userId === authRes.user.id && newRole !== 'owner') {
      return NextResponse.json(
        { error: 'You cannot demote your own Owner account.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, email, role, team_role')
      .eq('id', userId)
      .maybeSingle();

    if (!targetProfile || targetProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
    }

    if (
      isPrimaryOwnerEmail(targetProfile.email || '') ||
      normalizeTeamRole(targetProfile.team_role) === 'owner'
    ) {
      return NextResponse.json(
        { error: 'Protected Studio Owner accounts cannot be demoted or removed.' },
        { status: 403 }
      );
    }

    const { data: existingAuth } = await admin.auth.admin.getUserById(userId);
    const currentAppMeta = existingAuth?.user?.app_metadata || {};

    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...currentAppMeta,
        team_role: newRole,
      },
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    await tryUpdateProfileTeamRole(admin, userId, newRole);

    return NextResponse.json({
      success: true,
      userId,
      teamRole: newRole,
    });
  } catch (err) {
    console.error('Error in PATCH /api/management/team:', err);
    return NextResponse.json({ error: 'Failed to update team role' }, { status: 500 });
  }
}

/**
 * DELETE /api/management/team
 * Restricted to Studio Owner. Revokes management access (reverts profile role to 'client').
 */
export async function DELETE(req: NextRequest) {
  const authRes = await requireOwnerApi();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (userId === authRes.user.id) {
      return NextResponse.json(
        { error: 'Owner account cannot remove its own management access.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, email, role, team_role')
      .eq('id', userId)
      .maybeSingle();

    if (!targetProfile || targetProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
    }

    if (
      isPrimaryOwnerEmail(targetProfile.email || '') ||
      normalizeTeamRole(targetProfile.team_role) === 'owner'
    ) {
      return NextResponse.json(
        { error: 'Protected Studio Owner accounts cannot be demoted or removed.' },
        { status: 403 }
      );
    }

    // Revert role to 'client'
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ role: 'client' })
      .eq('id', userId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    await tryUpdateProfileTeamRole(admin, userId, null);

    const { data: existingAuth } = await admin.auth.admin.getUserById(userId);
    if (existingAuth?.user) {
      const nextAppMeta = { ...(existingAuth.user.app_metadata || {}) };
      delete nextAppMeta.team_role;
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: nextAppMeta,
      });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    console.error('Error in DELETE /api/management/team:', err);
    return NextResponse.json({ error: 'Failed to remove team access' }, { status: 500 });
  }
}
