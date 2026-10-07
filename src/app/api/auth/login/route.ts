import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/session';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getUserBalance } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, isDemo, name } = body;

    let userEmail = (email || '').trim().toLowerCase();
    let userName = (name || '').trim();
    let userId = `user-${Date.now()}`;
    const ADMIN_LIST = ['dev@localhost', 'admin@humantek.art', 'huzaifa14321furqan@gmail.com'];
    const isAdminUser = ADMIN_LIST.includes(userEmail) || (process.env.ADMIN_EMAILS || '').includes(userEmail);
    let userRole = isAdminUser ? 'admin' : 'client';

    if (isDemo) {
      userEmail = userEmail || 'creator@humantek.art';
      userName = userName || 'Kira Streams';
      userId = 'user-client-kira';
    }

    if (!userEmail) {
      userEmail = 'creator@humantek.art';
    }
    if (!userName) {
      userName = userEmail.includes('@') ? userEmail.split('@')[0] : 'Creator';
    }

    // If Supabase is real and configured and not demo, verify via Supabase
    if (isRealSupabaseConfigured() && !isDemo) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password || '',
      });

      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || 'Invalid email or password' },
          { status: 401 }
        );
      }

      userId = data.user.id;
      userEmail = data.user.email?.toLowerCase() || userEmail;
      userName =
        data.user.user_metadata?.name ||
        data.user.user_metadata?.full_name ||
        userName;
      userRole = data.user.user_metadata?.role || 'client';
    }

    // Ensure wallet exists in server ledger with starter credits (80 CR)
    const walletBalance = getUserBalance(userEmail);

    // Generate signed session token
    const token = await signSession({
      sub: userId,
      email: userEmail,
      name: userName,
      role: userRole,
      walletBalance,
    });

    // Set httpOnly session cookie
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
