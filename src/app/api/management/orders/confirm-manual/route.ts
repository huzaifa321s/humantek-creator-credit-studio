import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('Exception in confirm-manual route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
