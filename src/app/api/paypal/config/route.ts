import { NextResponse } from 'next/server';
import { canUseServerCheckout } from '@/lib/paypal';

export const dynamic = 'force-dynamic';

/**
 * Tells the checkout which PayPal flow to use:
 *  - `server`: client id + secret are valid — orders are created/captured by /api/paypal/*.
 *  - `client`: no secret, or PayPal rejected it — the PayPal JS SDK creates and captures the
 *    order in the browser, and the brief is registered for payment verification.
 */
export async function GET() {
  const mode = (await canUseServerCheckout()) ? 'server' : 'client';
  return NextResponse.json({ mode }, { headers: { 'Cache-Control': 'no-store' } });
}
