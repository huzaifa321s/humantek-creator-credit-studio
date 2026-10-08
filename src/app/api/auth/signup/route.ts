import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

    // Dev bypass strictly for local testing when running locally or explicit env flag is active
    const isDevAutoConfirm =
      process.env.DEV_AUTO_CONFIRM === 'true' ||
      process.env.NODE_ENV !== 'production';

    if (isDevAutoConfirm) {
      const admin = createAdminClient();
      const { data: created, error: adminErr } = await admin.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: { name: userName },
      });

      if (adminErr || !created.user) {
        return NextResponse.json(
          { error: 'Unable to complete registration. If you already have an account, please sign in.' },
          { status: 400 }
        );
      }

      try {
        await admin.from('profiles').update({ full_name: userName }).eq('id', created.user.id);
      } catch (e) {
        console.warn('Could not update profile full_name on dev auto-confirm:', e);
      }

      const supabase = await createClient();
      await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      return NextResponse.json({
        ok: true,
        requiresVerification: false,
        user: {
          id: created.user.id,
          email: userEmail,
          name: userName,
          role: 'client',
          walletBalance: 0,
        },
      });
    }

    // Production flow: Call Supabase auth.signUp with standard email confirmation
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: userEmail,
      password,
      options: {
        data: { name: userName },
      },
    });

    if (error) {
      // Non-revealing generic response to prevent email harvesting
      return NextResponse.json(
        { error: 'Unable to complete registration. If you already have an account, please sign in.' },
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
    } catch (e) {
      console.warn('Could not update profile full_name on signup:', e);
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
      message: 'Account created! Please check your email to verify your address before signing in.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sign up failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
