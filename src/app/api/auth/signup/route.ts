import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/session';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
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

    const admin = createAdminClient();

    // 1. Create user via admin API with email_confirm: true
    // This triggers handle_new_user() in Postgres, creating profiles & wallets rows
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name: userName },
    });

    if (createError) {
      const msg = createError.message || 'Failed to create account.';
      if (
        msg.toLowerCase().includes('already') ||
        msg.toLowerCase().includes('registered')
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!created?.user) {
      return NextResponse.json(
        { error: 'Unable to initialize user account.' },
        { status: 500 }
      );
    }

    const userId = created.user.id;

    // 2. Fetch the newly initialized wallet (created by Postgres trigger)
    const { data: wallet } = await admin
      .from('wallets')
      .select('balance_credits')
      .eq('user_id', userId)
      .single();

    const walletBalance = wallet?.balance_credits ?? 0;

    // 3. Sign in on the server client so Supabase auth cookies are set
    try {
      const serverSupabase = await createClient();
      await serverSupabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });
    } catch {
      // Non-fatal if server cookies fail; signed session token will serve as primary cookie
    }

    // 4. Generate signed HMAC session token
    const token = await signSession({
      sub: userId,
      email: userEmail,
      name: userName,
      role: 'client',
      walletBalance,
    });

    // 5. Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        role: 'client',
        walletBalance,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sign up failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
