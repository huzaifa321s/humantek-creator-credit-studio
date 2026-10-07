import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { adjustUserBalance, getUserBalance } from '@/lib/store';

// Rate limiting: in-memory sliding window for brute-force protection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(identifier: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limiting per user / IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || user.email;
    if (isRateLimited(`redeem:${clientIp}`)) {
      return NextResponse.json(
        { error: 'Too many redemption attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body.code === 'string' ? body.code : '';
    const cleanCode = rawCode.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      return NextResponse.json({ error: 'Please enter a valid promo code' }, { status: 400 });
    }

    // 1. Production / Real Supabase Path (Atomic PostgreSQL RPC)
    if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
      const adminClient = createAdminClient();

      const { data, error } = await adminClient.rpc('redeem_promo', {
        p_user: user.id,
        p_raw_code: cleanCode,
      });

      if (error) {
        const errorMsg = error.message || '';
        if (errorMsg.includes('email_not_confirmed')) {
          return NextResponse.json(
            { error: 'Please confirm your email address before redeeming promotional credits.' },
            { status: 403 }
          );
        }
        if (errorMsg.includes('already_redeemed')) {
          return NextResponse.json(
            { error: 'You have already redeemed this promo voucher.' },
            { status: 400 }
          );
        }
        if (errorMsg.includes('invalid_or_exhausted_code') || errorMsg.includes('invalid_code')) {
          return NextResponse.json(
            { error: 'Invalid, expired, or fully claimed promo code.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: 'Unable to redeem code. Please verify and try again.' },
          { status: 400 }
        );
      }

      const result = data as {
        success: boolean;
        credits_granted: number;
        new_balance: number;
        code: string;
      };

      return NextResponse.json({
        success: true,
        code: result.code,
        creditsAdded: result.credits_granted,
        newWalletBalance: result.new_balance,
        message: `Successfully redeemed ${result.credits_granted} CR to your studio wallet!`,
      });
    }

    // 2. Development / Offline Fallback Path
    // Parse credits from patterns like HT-150CR-XXXX or default to 80 CR
    let grantedCredits = 80;
    const match = cleanCode.match(/(\d+)\s*CR/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0 && parsed <= 5000) grantedCredits = parsed;
    }

    const newBalance = adjustUserBalance(
      user.email,
      grantedCredits,
      `Redeemed promotional code ${cleanCode}`
    );

    return NextResponse.json({
      success: true,
      code: cleanCode,
      creditsAdded: grantedCredits,
      newWalletBalance: newBalance,
      message: `Successfully redeemed ${grantedCredits} CR to your studio wallet!`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
