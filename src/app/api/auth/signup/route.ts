import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recordLoginEvent } from '@/lib/login-tracker';

const signupRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = signupRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    signupRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
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
        { error: 'Too many registration attempts. Please wait 15 minutes and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const rawPassword = typeof body.password === 'string' ? body.password : '';
    const rawName = typeof body.name === 'string' ? body.name : '';

    const userEmail = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();
    const userName =
      rawName.trim() ||
      (userEmail.includes('@') ? userEmail.split('@')[0] : 'Creator');

    if (!userEmail || !userEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database service is not configured.' },
        { status: 500 }
      );
    }

    // Public registration flow: strictly call Supabase auth.signUp with unconfirmed email
    // NEVER auto-confirm via admin.createUser in public signup to prevent pre-account-takeover attacks
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: userEmail,
      password,
      options: {
        data: { name: userName },
      },
    });


    if (error) {
      if (
        (error as any)?.code === 'over_email_send_rate_limit' ||
        error.message?.toLowerCase().includes('rate limit')
      ) {
        return NextResponse.json(
          {
            error:
              'Email delivery rate limit reached by the email service. Please try again later or contact support.',
          },
          { status: 429 }
        );
      }

      const isAlreadyRegistered =
        error.message?.toLowerCase().includes('already') ||
        (error as any)?.code === 'user_already_exists';

      if (isAlreadyRegistered) {
        return NextResponse.json(
          {
            error: 'An account with this email already exists. Please sign in with your password.',
            alreadyRegistered: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: error.message || 'Unable to complete registration. Please try again.',
        },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Registration failed. Please try again.' },
        { status: 400 }
      );
    }

    try {
      const admin = createAdminClient();
      await admin.from('profiles').update({ full_name: userName }).eq('id', data.user.id);
      await recordLoginEvent(req, {
        userId: data.user.id,
        email: userEmail,
        role: 'client',
        authMethod: 'signup',
      });
    } catch (e) {
      console.warn('Could not update profile full_name on signup:', e);
    }

    // In development mode, auto-confirm user if SMTP/email sending is disabled so dev works seamlessly
    if (process.env.NODE_ENV === 'development' && data.user && !data.session) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
        });
        if (signInData?.session) {
          return NextResponse.json({
            ok: true,
            requiresVerification: false,
            user: {
              id: data.user.id,
              email: userEmail,
              name: userName,
              role: 'client',
              walletBalance: 0,
            },
          });
        }
      } catch (devErr) {
        console.warn('[DEV Auto-Confirm] Error:', devErr);
      }
    }

    // If Supabase auto-confirmed or session is present (e.g. SMTP confirmation disabled)
    if (data.session) {
      return NextResponse.json({
        ok: true,
        requiresVerification: false,
        user: {
          id: data.user.id,
          email: userEmail,
          name: userName,
          role: 'client',
          walletBalance: 0,
        },
      });
    }

    // Standard flow requiring email verification
    return NextResponse.json({
      ok: true,
      requiresVerification: true,
      message: 'Account created! Check your email for a verification code. If you already have an account, sign in instead.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sign up failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
