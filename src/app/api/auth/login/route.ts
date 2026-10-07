import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/session';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    const userEmail = (email || '').trim().toLowerCase();
    const userPass = (password || '').trim();

    if (!userEmail || !userPass) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database service is not configured' },
        { status: 500 }
      );
    }

    // 1. Authenticate with Supabase
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPass,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    const userId = data.user.id;
    const admin = createAdminClient();

    // 2. Fetch authoritative profile (role, full name)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const userRole = profile?.role || 'client';
    const userName =
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

    // 4. Generate signed HMAC session token
    const token = await signSession({
      sub: userId,
      email: userEmail,
      name: userName,
      role: userRole,
      walletBalance,
    });

    // 5. Set httpOnly session cookie
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
        role: userRole,
        walletBalance,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
