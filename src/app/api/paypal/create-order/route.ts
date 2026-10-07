import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';
import { computeOrderQuote } from '@/lib/pricing';
import { orderRequestSchema, firstIssue } from '@/lib/validation';
import { addPendingOrder, getUserBalance } from '@/lib/store';

/**
 * Creates a PayPal order for a server-priced quote. The full validated order
 * is stored server-side keyed by the PayPal order id, so the capture step
 * never needs (or trusts) client-supplied project data.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  if (parsed.data.fundingSource === 'wallet' || parsed.data.packageId === 'studio-wallet') {
    return NextResponse.json(
      { error: 'Wallet-funded projects have $0 USD due and should be launched directly with credits without PayPal.' },
      { status: 400 }
    );
  }

  const normEmail = (parsed.data.email || 'kira@example.com').toLowerCase().trim();
  const serverBalance = getUserBalance(normEmail);

  const quoteInput = {
    ...parsed.data,
    email: normEmail,
    walletBalance: serverBalance,
  };

  const result = computeOrderQuote(quoteInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  const { quote } = result;

  if (quote.fundingSource === 'wallet' || quote.priceUSD <= 0) {
    return NextResponse.json(
      { error: 'Wallet-funded projects have $0 USD due and should be launched directly with credits without PayPal.' },
      { status: 400 }
    );
  }

  try {
    const order = await createPayPalOrder(quote.priceUSD, parsed.data.projectId);
    addPendingOrder({
      orderId: order.id,
      request: { ...parsed.data, walletBalance: serverBalance },
      quote,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      orderId: order.id,
      quote: {
        packageName: quote.package.name,
        priceUSD: quote.priceUSD,
        usedCredits: quote.usedCredits,
        totalCredits: quote.totalCredits,
        remainingCredits: quote.remainingCredits,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create PayPal order';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
