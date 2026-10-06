import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';
import { computeOrderQuote } from '@/lib/pricing';
import { orderRequestSchema, firstIssue } from '@/lib/validation';
import { addPendingOrder } from '@/lib/store';

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

  const result = computeOrderQuote(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  const { quote } = result;

  try {
    const order = await createPayPalOrder(quote.priceUSD, parsed.data.projectId);
    addPendingOrder({
      orderId: order.id,
      request: parsed.data,
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
