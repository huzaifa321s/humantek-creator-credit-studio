import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isPrimaryOwnerEmail, normalizeTeamRole, type TeamRole } from '@/lib/auth';

// Sliding-window rate limiting map: IP -> attempts & reset time
const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): boolean {
  if (process.env.NODE_ENV !== 'production' && (ip === 'unknown-ip' || ip === '127.0.0.1' || ip === '::1')) {
    return false;
  }
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    loginRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (record.count >= maxAttempts) {
    return true;
  }
  record.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown-ip';

    if (checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, adminOnly } = body;

    const userEmail = (email || '').trim().toLowerCase();
    const userPass = (password || '').trim();

    if (!userEmail || !userPass) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database service is not configured.' },
        { status: 500 }
      );
    }

    // 1. Authenticate with Supabase Auth via @supabase/ssr server client
    // This automatically sets the standard Supabase auth cookies (sb-*-auth-token)
    const supabase = await createClient();
    let { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPass,
    });

    if (error) {
      if (
        process.env.NODE_ENV === 'development' &&
        error.message?.toLowerCase().includes('email not confirmed')
      ) {
        try {
          const admin = createAdminClient();
          const { data: usersData } = await admin.auth.admin.listUsers();
          const targetUser = usersData.users.find((u) => u.email?.toLowerCase() === userEmail);
          if (targetUser) {
            await admin.auth.admin.updateUserById(targetUser.id, { email_confirm: true });
            const retry = await supabase.auth.signInWithPassword({
              email: userEmail,
              password: userPass,
            });
            if (!retry.error && retry.data.user) {
              data = retry.data;
              error = null;
            }
          }
        } catch (devErr) {
          console.warn('[DEV Auto-Confirm Login] Error:', devErr);
        }
      }
    }

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }
    if (!data.user.email_confirmed_at) {
      if (process.env.NODE_ENV === 'development') {
        try {
          const admin = createAdminClient();
          await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
        } catch (devErr) {
          console.warn('[DEV Auto-Confirm] Error:', devErr);
        }
      } else {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error: 'Please verify your email address before signing in. Check your email for the verification code.',
            requiresVerification: true,
          },
          { status: 403 }
        );
      }
    }

    const userId = data.user.id;
    const admin = createAdminClient();

    // 2. Fetch authoritative profile (role, full name, team_role) strictly from Postgres (no email allowlist)
    let { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Data Integrity: If profile row is missing, auto-heal client profile
    if (!profile) {
      try {
        const fallbackName = (data.user.user_metadata?.name || data.user.user_metadata?.full_name || (userEmail.split('@')[0]) || 'Creator').slice(0, 80);
        await admin.from('profiles').upsert({
          id: userId,
          email: userEmail,
          full_name: fallbackName,
          role: 'client',
        }, { onConflict: 'id', ignoreDuplicates: true });
        await admin.from('wallets').upsert({
          user_id: userId,
          balance_purchased: 0,
          balance_promo: 0,
        }, { onConflict: 'user_id', ignoreDuplicates: true });
        profile = { role: 'client', full_name: fallbackName };
      } catch (healErr) {
        console.warn('Could not auto-heal missing profile:', healErr);
      }
    }

    const isAdmin = profile?.role === 'admin';
    const userRole = isAdmin ? 'admin' : 'client';

    // If this request came from the restricted /admin-login portal, strictly enforce admin role
    if (adminOnly && !isAdmin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Access denied: Administrator privileges required. Client accounts must use the client portal.' },
        { status: 403 }
      );
    }

    let teamRole: TeamRole | null = null;
    if (isAdmin) {
      const fromProfile = normalizeTeamRole((profile as Record<string, unknown> | null)?.team_role);
      const fromAppMeta = normalizeTeamRole(data.user.app_metadata?.team_role);
      if (isPrimaryOwnerEmail(userEmail)) {
        teamRole = 'owner';
      } else if (fromProfile) {
        teamRole = fromProfile;
      } else if (fromAppMeta) {
        teamRole = fromAppMeta;
      } else {
        teamRole = 'manager';
      }
    }

    const userName =
      profile?.full_name ||
      data.user.user_metadata?.name ||
      data.user.user_metadata?.full_name ||
      (userEmail.includes('@') ? userEmail.split('@')[0] : 'Creator');

    // 3. Fetch authoritative wallet balance from wallets table
    const { data: wallet } = await admin
      .from('wallets')
      .select('balance_credits, balance_purchased, balance_promo')
      .eq('user_id', userId)
      .single();

    const walletBalance = wallet?.balance_credits ?? 0;

    return NextResponse.json({
      ok: true,
      redirect: isAdmin ? '/management' : '/projects',
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        role: userRole,
        teamRole,
        isAdmin,
        walletBalance,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
