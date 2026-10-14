import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveSafeRedirectBase } from '@/lib/auth/redirects';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
  lastSentAt?: number;
}

const resetRateLimitMap = new Map<string, RateLimitRecord>();

function getRateLimitRecord(key: string, windowMs = 15 * 60 * 1000): RateLimitRecord {
  const now = Date.now();
  const existing = resetRateLimitMap.get(key);
  if (!existing || now > existing.resetAt) {
    const fresh: RateLimitRecord = { attempts: 0, resetAt: now + windowMs };
    resetRateLimitMap.set(key, fresh);
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
    const action = typeof body.action === 'string' ? body.action : 'request';
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const userEmail = rawEmail.trim().toLowerCase();

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database service is not configured.' },
        { status: 500 }
      );
    }

    const ipRecord = getRateLimitRecord(`ip:${clientIp}`);
    const emailRecord = userEmail ? getRateLimitRecord(`email:${userEmail}`) : ipRecord;

    // =========================================================================
    // ACTION 1: UPDATE PASSWORD VIA ACTIVE RECOVERY SESSION (Email Link Flow)
    // =========================================================================
    if (action === 'update-session-password') {
      const newPassword = (typeof body.password === 'string' ? body.password : '').trim();
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long.' },
          { status: 400 }
        );
      }

      const supabase = await createClient();
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (!sessionUser || !sessionUser.email) {
        return NextResponse.json(
          { error: 'Recovery session expired or invalid. Please request a new reset code.' },
          { status: 401 }
        );
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message || 'Could not update password. Please try again.' },
          { status: 400 }
        );
      }

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('profiles')
        .select('role, full_name')
        .eq('id', sessionUser.id)
        .maybeSingle();

      const { data: wallet } = await admin
        .from('wallets')
        .select('balance_credits')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      const userName =
        profile?.full_name ||
        sessionUser.user_metadata?.name ||
        sessionUser.user_metadata?.full_name ||
        sessionUser.email.split('@')[0] ||
        'Creator';

      return NextResponse.json({
        ok: true,
        message: 'Your password has been updated successfully!',
        user: {
          id: sessionUser.id,
          email: sessionUser.email.toLowerCase(),
          name: userName,
          role: profile?.role || 'client',
          isAdmin: profile?.role === 'admin',
          walletBalance: wallet?.balance_credits ?? 0,
        },
      });
    }

    // =========================================================================
    // ACTION 2: VERIFY 6-DIGIT RECOVERY OTP & SET NEW PASSWORD
    // =========================================================================
    if (action === 'verify-and-reset') {
      const token = (typeof body.token === 'string' ? body.token : '').trim();
      const newPassword = (typeof body.password === 'string' ? body.password : '').trim();

      if (!userEmail || !userEmail.includes('@')) {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
      if (!token || token.length < 6) {
        return NextResponse.json(
          { error: 'Please enter the 6-digit recovery code sent to your email.' },
          { status: 400 }
        );
      }
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long.' },
          { status: 400 }
        );
      }

      if (ipRecord.attempts >= 5 || emailRecord.attempts >= 5) {
        return NextResponse.json(
          {
            error:
              'Too many failed attempts. Please wait 15 minutes or request a fresh recovery code.',
          },
          { status: 429 }
        );
      }

      const supabase = await createClient();

      // Verify recovery OTP first; fallback to generic email OTP if template used email OTP
      let verifyRes = await supabase.auth.verifyOtp({
        email: userEmail,
        token,
        type: 'recovery',
      });

      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: userEmail,
          token,
          type: 'email',
        });
      }

      let verifiedUser = verifyRes.data?.user;
      const admin = createAdminClient();

      // Dev fallback so local testing works when SMTP is not configured
      if (!verifiedUser && process.env.NODE_ENV === 'development') {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const targetUser = usersData?.users.find(
          (u) => u.email?.toLowerCase() === userEmail
        );
        if (
          targetUser &&
          (token === '123456' || token === '000000' || process.env.DEV_AUTO_CONFIRM === 'true')
        ) {
          await admin.auth.admin.updateUserById(targetUser.id, {
            password: newPassword,
            email_confirm: true,
          });
          await supabase.auth.signInWithPassword({
            email: userEmail,
            password: newPassword,
          });
          verifiedUser = targetUser;
        }
      }

      if (!verifiedUser) {
        ipRecord.attempts += 1;
        emailRecord.attempts += 1;
        const remaining = Math.max(
          0,
          5 - Math.max(ipRecord.attempts, emailRecord.attempts)
        );
        return NextResponse.json(
          {
            error:
              remaining > 0
                ? `Invalid or expired recovery code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                : 'Maximum attempts exceeded. Please wait 15 minutes or request a new code.',
          },
          { status: 400 }
        );
      }

      // Update password via active recovery session (or admin fallback if session wasn't attached)
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        const { error: adminUpdateErr } = await admin.auth.admin.updateUserById(
          verifiedUser.id,
          { password: newPassword }
        );
        if (adminUpdateErr) {
          return NextResponse.json(
            { error: adminUpdateErr.message || 'Failed to update password.' },
            { status: 400 }
          );
        }
        await supabase.auth.signInWithPassword({
          email: userEmail,
          password: newPassword,
        });
      }

      // Reset rate limits on success
      resetRateLimitMap.delete(`ip:${clientIp}`);
      resetRateLimitMap.delete(`email:${userEmail}`);

      const { data: profile } = await admin
        .from('profiles')
        .select('role, full_name')
        .eq('id', verifiedUser.id)
        .maybeSingle();

      const { data: wallet } = await admin
        .from('wallets')
        .select('balance_credits')
        .eq('user_id', verifiedUser.id)
        .maybeSingle();

      const userName =
        profile?.full_name ||
        verifiedUser.user_metadata?.name ||
        verifiedUser.user_metadata?.full_name ||
        userEmail.split('@')[0] ||
        'Creator';

      return NextResponse.json({
        ok: true,
        message: 'Password updated successfully!',
        user: {
          id: verifiedUser.id,
          email: userEmail,
          name: userName,
          role: profile?.role || 'client',
          isAdmin: profile?.role === 'admin',
          walletBalance: wallet?.balance_credits ?? 0,
        },
      });
    }

    // =========================================================================
    // ACTION 3 (DEFAULT): REQUEST PASSWORD RESET EMAIL / OTP
    // =========================================================================
    if (!userEmail || !userEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const lastSent = Math.max(ipRecord.lastSentAt || 0, emailRecord.lastSentAt || 0);
    const cooldownRemaining = Math.ceil((lastSent + 60 * 1000 - now) / 1000);

    if (cooldownRemaining > 0) {
      return NextResponse.json(
        {
          error: `Please wait ${cooldownRemaining} second${cooldownRemaining === 1 ? '' : 's'} before requesting another recovery code.`,
          cooldownSeconds: cooldownRemaining,
        },
        { status: 429 }
      );
    }

    ipRecord.lastSentAt = now;
    emailRecord.lastSentAt = now;

    try {
      const supabase = await createClient();
      const redirectBase = resolveSafeRedirectBase(req.url);
      const redirectTo = redirectBase
        ? `${redirectBase}/auth/callback?next=${encodeURIComponent('/login?reset=true')}`
        : undefined;

      await supabase.auth.resetPasswordForEmail(
        userEmail,
        redirectTo ? { redirectTo } : undefined
      );
    } catch {
      // Silently catch to prevent user enumeration
    }

    return NextResponse.json({
      ok: true,
      cooldownSeconds: 60,
      message:
        'If an account exists for that email, we sent a password recovery code and reset link.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
