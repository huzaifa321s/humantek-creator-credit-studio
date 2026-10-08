import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { capturePayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orderId, internalOrderId } = (body as Record<string, unknown>) || {};
  const queryOrderId = (typeof orderId === 'string' && orderId.trim())
    ? orderId.trim()
    : (typeof internalOrderId === 'string' ? internalOrderId.trim() : '');

  if (!queryOrderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  // 1. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    const adminClient = createAdminClient();

    // Query order from database
    let query = adminClient.from('orders').select('*');
    if (queryOrderId.includes('-') && queryOrderId.length === 36) {
      // UUID check
      query = query.or(`id.eq.${queryOrderId},provider_order_id.eq.${queryOrderId}`);
    } else {
      query = query.eq('provider_order_id', queryOrderId);
    }

    const { data: order, error: orderErr } = await query.maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Strict Cross-Tenant Authorization Check
    if (order.user_id !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to capture this order' }, { status: 403 });
    }

    // Idempotency: if already fulfilled, return success immediately
    if (order.status === 'fulfilled') {
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('balance_credits')
        .eq('user_id', order.user_id)
        .single();

      return NextResponse.json({
        success: true,
        status: 'fulfilled',
        creditsGranted: order.credits_to_grant,
        newWalletBalance: wallet?.balance_credits,
        message: 'Order was already fulfilled.',
      });
    }

    const expectedUSD = order.expected_amount_cents / 100;
    const captureIdempKey = `cap-${order.id}`;

    try {
      const capture = await capturePayPalOrder(order.provider_order_id || queryOrderId, expectedUSD, captureIdempKey);

      if (capture.status === 'COMPLETED') {
        const capturedAmountCents = capture.amountUSD !== null
          ? Math.round(capture.amountUSD * 100)
          : order.expected_amount_cents;

        const { data: fulfillRes, error: fulfillErr } = await adminClient.rpc('fulfill_order', {
          p_order_id: order.id,
          p_capture_id: capture.captureId || `cap-${Date.now()}`,
          p_amount_cents: capturedAmountCents,
          p_currency: capture.currency || 'USD',
        });

        if (fulfillErr) {
          throw new Error(fulfillErr.message);
        }

        if (!fulfillRes?.success) {
          return NextResponse.json({ error: fulfillRes?.error || 'Order fulfillment failed' }, { status: 422 });
        }

        return NextResponse.json({
          success: true,
          status: 'fulfilled',
          creditsGranted: fulfillRes.credits_granted,
          newWalletBalance: fulfillRes.new_balance,
          message: 'Payment completed! Credits successfully added to your Studio Wallet.',
        });
      } else if (capture.status === 'PENDING') {
        await adminClient
          .from('orders')
          .update({ status: 'capture_pending' })
          .eq('id', order.id);

        return NextResponse.json({
          success: true,
          status: 'capture_pending',
          message: 'Payment is pending settlement. Your credits will be automatically credited once verified by PayPal.',
        });
      } else {
        await adminClient
          .from('orders')
          .update({ status: 'denied' })
          .eq('id', order.id);

        return NextResponse.json({
          success: false,
          status: capture.status,
          error: 'Payment was not approved or was denied by PayPal.',
        }, { status: 402 });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not capture PayPal order';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // 2. Dev Mock Fallback
  return NextResponse.json({
    success: true,
    status: 'fulfilled',
    creditsGranted: 660,
    newWalletBalance: 660,
    message: 'Mock payment captured successfully.',
  });
}
