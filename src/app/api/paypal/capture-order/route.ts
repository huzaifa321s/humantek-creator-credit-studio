import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { getPendingOrder, getProjectById, markOrderCaptured } from '@/lib/store';
import { captureOrderSchema, firstIssue } from '@/lib/validation';
import { buildProjectRecord, recordPaidProject } from '@/lib/orders';

/**
 * Captures an approved PayPal order. Only the order id is accepted from the
 * client; everything else comes from the pending order stored at creation
 * time. The captured amount and status are verified before any project is
 * recorded, and repeated calls are idempotent.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = captureOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { orderId } = parsed.data;

  const pending = getPendingOrder(orderId);
  if (!pending) {
    return NextResponse.json({ error: 'Order not found or expired. Please start checkout again.' }, { status: 404 });
  }

  // Idempotency: a double-click or retry returns the already-recorded project.
  if (pending.projectId) {
    const existing = getProjectById(pending.projectId);
    if (existing) {
      return NextResponse.json({ success: true, project: existing, message: 'Payment already confirmed.' });
    }
  }

  const expected = pending.quote.priceUSD;

  try {
    const capture = await capturePayPalOrder(orderId, expected);

    const amountMatches = capture.amountUSD !== null && Math.abs(capture.amountUSD - expected) < 0.005;
    if (capture.status !== 'COMPLETED' || capture.currency !== 'USD' || !amountMatches) {
      console.error('[capture-order] Payment verification failed', { orderId, capture, expected });
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 402 });
    }

    const project = buildProjectRecord(pending.request, pending.quote, {
      status: 'payment_confirmed',
      paymentStatus: 'paid',
    });
    recordPaidProject(project, capture.captureId ?? orderId);
    markOrderCaptured(orderId, project.id);

    return NextResponse.json({
      success: true,
      project,
      message: 'Payment confirmed & project successfully logged into management queue!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not capture PayPal order';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
