import { NextRequest, NextResponse } from 'next/server';
import { getUserBalance, getLedger } from '@/lib/store';

/**
 * Returns the authoritative global wallet balance and ledger history for an account.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawEmail = searchParams.get('email') || 'kira@example.com';
  const email = rawEmail.toLowerCase().trim();

  const walletBalance = getUserBalance(email);
  const ledger = getLedger().filter(
    (entry) => (entry.userEmail || '').toLowerCase().trim() === email
  );

  return NextResponse.json({
    success: true,
    email,
    walletBalance,
    ledger,
  });
}
