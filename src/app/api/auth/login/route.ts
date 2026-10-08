import { NextRequest, NextResponse } from 'next/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Sliding-window rate limiting map: IP -> attempts & reset time
const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): boolean {
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPass,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const userId = data.user.id;
    const admin = createAdminClient();

    // 2. Fetch authoritative profile (role, full name) from Postgres
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle();

    const ADMIN_EMAILS = [
      'dev@localhost',
      'admin@humantek.art',
      'huzaifa14321furqan@gmail.com',
      'huzaifaf22@gmail.com',
      'huzaifafurqan22@gmail.com',
      ...(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ];

    const isAdmin = profile?.role === 'admin' || ADMIN_EMAILS.includes(userEmail);
    const userRole = isAdmin ? 'admin' : 'client';

    // If this request came from the restricted /admin-login portal, strictly enforce admin role
    if (adminOnly && !isAdmin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Access denied: Administrator privileges required. Client accounts must use the client portal.' },
        { status: 403 }
      );
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
        isAdmin,
        walletBalance,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
