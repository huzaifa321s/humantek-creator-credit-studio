import { NextRequest, NextResponse } from 'next/server';
import { getUserBalance, addLedgerEntry, getLedger } from '@/lib/store';
import { firstIssue } from '@/lib/validation';
import { z } from 'zod';

const redeemRequestSchema = z.object({
  code: z.string().trim().min(3).max(40),
  email: z.string().trim().email().optional().default('kira@example.com'),
});

/**
 * Redeems a promotional voucher or creator pass directly into the client's global wallet.
 * Enforces single-use idempotency and writes an immutable audit entry to the credit ledger.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = redeemRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { code, email } = parsed.data;
  const cleanCode = code.toUpperCase().trim();
  const normEmail = email.toLowerCase().trim();

  // Idempotency: verify this code has not already been claimed by this account
  const alreadyClaimed = getLedger().some(
    (e) =>
      e.referenceId === cleanCode &&
      (e.userEmail || '').toLowerCase().trim() === normEmail
  );

  if (alreadyClaimed) {
    return NextResponse.json(
      {
        error: `Promo code ${cleanCode} has already been redeemed for ${normEmail}.`,
        code: cleanCode,
        walletBalance: getUserBalance(normEmail),
      },
      { status: 409 }
    );
  }

  // Parse credit value: e.g. HT-200CR-ABCD -> 200, LAUNCH150 -> 150, or default 150 CR
  const match = cleanCode.match(/(\d+)\s*(?:CR)?/i);
  const parsedAmount = match ? parseInt(match[1], 10) : 150;
  const creditAmount =
    !isNaN(parsedAmount) && parsedAmount >= 10 && parsedAmount <= 5000
      ? parsedAmount
      : 150;

  const now = new Date().toISOString();
  addLedgerEntry({
    id: `led-${crypto.randomUUID()}`,
    userEmail: normEmail,
    type: 'promo_credit',
    creditsDelta: creditAmount,
    usdAmount: 0,
    referenceId: cleanCode,
    description: `Promo pass ${cleanCode} redeemed to Studio Wallet (+${creditAmount} CR)`,
    createdAt: now,
  });

  const newWalletBalance = getUserBalance(normEmail);

  return NextResponse.json({
    success: true,
    code: cleanCode,
    creditsAdded: creditAmount,
    newWalletBalance,
    message: `Success! ${creditAmount} CR deposited into your Studio Wallet. New balance: ${newWalletBalance} CR.`,
  });
}
