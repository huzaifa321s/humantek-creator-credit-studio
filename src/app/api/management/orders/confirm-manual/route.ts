import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAal2 } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const userOrRes = await requireAdminAal2();
    if (userOrRes instanceof NextResponse) {
      return userOrRes;
    }
    const user = userOrRes.user;

    const body = await req.json();
    const { orderId, bankReference, amountCents, notes } = body;

    if (!orderId || !bankReference || !amountCents) {
      return NextResponse.json(
        { error: 'orderId, bankReference, and amountCents are required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Call PostgreSQL audited function confirm_manual_payment
    const { data: result, error } = await admin.rpc('confirm_manual_payment', {
      p_order_id: orderId,
      p_bank_reference: bankReference,
      p_amount_cents: Number(amountCents),
      p_notes: notes || `Confirmed by ${user.email}`,
      p_admin_id: user.id,
    });

    if (error) {
      console.error('Error confirming manual payment:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to confirm manual payment' },
        { status: 400 }
      );
    }

    // Major action notification: Payment approved
    const { data: confirmedOrder } = await admin
      .from('orders')
      .select('user_id, credits_to_grant, expected_amount_cents')
      .eq('id', orderId)
      .maybeSingle();

    if (confirmedOrder?.user_id) {
      void createNotification({
        userId: confirmedOrder.user_id,
        type: 'payment_confirmed',
        title: 'Payment approved',
        message: `Your payment was confirmed. +${confirmedOrder.credits_to_grant} credits added to your wallet.`,
        link: '/billing',
        actionLabel: 'View Balance',
        actionId: orderId,
      });
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('Exception in confirm-manual route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
