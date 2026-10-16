import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { isPrimaryOwnerEmail, normalizeTeamRole, type TeamRole } from '@/lib/auth';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
  lastResendAt?: number;
}

const otpRateLimitMap = new Map<string, RateLimitRecord>();

function getRateLimitRecord(key: string, windowMs = 15 * 60 * 1000): RateLimitRecord {
  const now = Date.now();
  const existing = otpRateLimitMap.get(key);
  if (!existing || now > existing.resetAt) {
    const fresh: RateLimitRecord = { attempts: 0, resetAt: now + windowMs };
    otpRateLimitMap.set(key, fresh);
    return fresh;
  }
  return existing;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown-ip';

    const body = await req.json().catch(() => ({}));
    const { email, token, action } = body;

    const userEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const otpToken = (typeof token === 'string' ? token : '').trim();

    if (!userEmail || !userEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 500 });
    }

    const ipRecord = getRateLimitRecord(`ip:${clientIp}`);
    const emailRecord = getRateLimitRecord(`email:${userEmail}`);

    // 1. Resend OTP flow (enforce 60-second cooldown)
    if (action === 'resend') {
      const now = Date.now();
      const lastResend = Math.max(ipRecord.lastResendAt || 0, emailRecord.lastResendAt || 0);
      const cooldownRemaining = Math.ceil((lastResend + 60 * 1000 - now) / 1000);

      if (cooldownRemaining > 0) {
        return NextResponse.json(
          {
            error: `Please wait ${cooldownRemaining} second${cooldownRemaining === 1 ? '' : 's'} before requesting another code.`,
            cooldownSeconds: cooldownRemaining,
          },
          { status: 429 }
        );
      }

      ipRecord.lastResendAt = now;
      emailRecord.lastResendAt = now;

      const supabase = await createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) {
        console.warn('Resend OTP warning:', error.message);
      }

      return NextResponse.json({
        ok: true,
        message: 'A fresh 6-digit verification code has been dispatched to your email.',
        cooldownSeconds: 60,
      });
    }

    // 2. Verification flow (enforce max 5 failed attempts per 15-minute window)
    if (ipRecord.attempts >= 5 || emailRecord.attempts >= 5) {
      return NextResponse.json(
        {
          error: 'Too many incorrect verification attempts. For your security, please wait 15 minutes or request a new code.',
        },
        { status: 429 }
      );
    }

    if (!otpToken || otpToken.length < 6) {
      return NextResponse.json(
        { error: 'Please enter the complete 6-digit verification code.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Attempt signup OTP verification first
    let verifyRes = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpToken,
      type: 'signup',
    });

    // If signup verification didn't match, attempt generic email OTP
    if (verifyRes.error) {
      verifyRes = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpToken,
        type: 'email',
      });
    }

    let user = verifyRes.data?.user;

    if (!user && process.env.NODE_ENV === 'development') {
      // In dev mode, allow dev test codes (123456 or 000000) so developer is never stuck when emails are disabled
      const admin = createAdminClient();
      const { data: usersData } = await admin.auth.admin.listUsers();
      const targetUser = usersData?.users.find((u) => u.email?.toLowerCase() === userEmail);
      if (targetUser && (otpToken === '123456' || otpToken === '000000' || process.env.DEV_AUTO_CONFIRM === 'true')) {
        await admin.auth.admin.updateUserById(targetUser.id, { email_confirm: true });
        user = targetUser as any;
      }
    }

    if (!user) {
      ipRecord.attempts += 1;
      emailRecord.attempts += 1;
      const remainingAttempts = Math.max(0, 5 - Math.max(ipRecord.attempts, emailRecord.attempts));

      return NextResponse.json(
        {
          error:
            remainingAttempts > 0
              ? `Invalid or expired verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
              : 'Invalid verification code. Maximum attempts exceeded. Please wait 15 minutes.',
        },
        { status: 400 }
      );
    }

    // Reset rate-limit records on success
    otpRateLimitMap.delete(`ip:${clientIp}`);
    otpRateLimitMap.delete(`email:${userEmail}`);

    const admin = createAdminClient();

    // Fetch authoritative profile (role, full_name, team_role)
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    const userRole = isAdmin ? 'admin' : 'client';
    let teamRole: TeamRole | null = null;
    if (isAdmin) {
      const fromProfile = normalizeTeamRole((profile as Record<string, unknown> | null)?.team_role);
      const fromAppMeta = normalizeTeamRole(user.app_metadata?.team_role);
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
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      (userEmail.includes('@') ? userEmail.split('@')[0] : 'Creator');

    // Fetch wallet balance
    const { data: wallet } = await admin
      .from('wallets')
      .select('balance_credits')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        email: userEmail,
        name: userName,
        role: userRole,
        teamRole,
        isAdmin,
        walletBalance: wallet?.balance_credits ?? 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
