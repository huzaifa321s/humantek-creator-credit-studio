import { NextResponse } from 'next/server';
import { isPayPalMockMode } from '@/lib/paypal';

/**
 * Tells the checkout which PayPal flow to use:
 *  - `server`: client id + secret configured — orders are created/captured by /api/paypal/*.
 *  - `client`: only NEXT_PUBLIC_PAYPAL_CLIENT_ID is set — the PayPal JS SDK creates and
 *    captures the order in the browser, and the brief is registered for payment verification.
 */
export async function GET() {
  return NextResponse.json({ mode: isPayPalMockMode() ? 'client' : 'server' });
}
