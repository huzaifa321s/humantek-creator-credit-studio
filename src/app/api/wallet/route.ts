import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getUserBalance, getLedger } from '@/lib/store';
import type { CreditLedgerEntry } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser();
    const queryEmail = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
    const effectiveEmail = user?.email || queryEmail || 'kira@example.com';

    // 1. Production / Real Supabase Path
    if (isSupabaseConfigured() && user?.id && !user.isDevFallback) {
      const adminClient = createAdminClient();

      // Fetch wallet balance
      const { data: wallet, error: walletError } = await adminClient
        .from('wallets')
        .select('balance_credits, balance_purchased, balance_promo')
        .eq('user_id', user.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        return NextResponse.json({ error: 'Failed to retrieve wallet' }, { status: 500 });
      }

      // Fetch user ledger entries
      const { data: rawLedger, error: ledgerError } = await adminClient
        .from('credit_ledger')
        .select('id, bucket, delta, type, reference_id, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ledgerError) {
        return NextResponse.json({ error: 'Failed to retrieve ledger' }, { status: 500 });
      }

      const ledger: CreditLedgerEntry[] = (rawLedger || []).map((row) => ({
        id: `led-${row.id}`,
        userEmail: effectiveEmail,
        type: row.type as CreditLedgerEntry['type'],
        creditsDelta: row.delta,
        usdAmount: 0,
        referenceId: row.reference_id || undefined,
        description: row.description || undefined,
        createdAt: row.created_at,
      }));

      return NextResponse.json({
        success: true,
        email: effectiveEmail,
        walletBalance: wallet?.balance_credits ?? 0,
        balancePurchased: wallet?.balance_purchased ?? 0,
        balancePromo: wallet?.balance_promo ?? 0,
        ledger,
      });
    }

    // 2. Development / Offline Fallback Path
    const walletBalance = getUserBalance(effectiveEmail);
    const ledger = getLedger().filter(
      (e) => (e.userEmail || '').toLowerCase().trim() === effectiveEmail
    );

    return NextResponse.json({
      success: true,
      email: effectiveEmail,
      walletBalance,
      balancePurchased: walletBalance,
      balancePromo: 0,
      ledger,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
