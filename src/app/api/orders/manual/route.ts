import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { PACKAGES } from '@/lib/catalog';
import { ManualPaymentAdapter } from '@/lib/payments/adapter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (user.isAdmin) {
    return NextResponse.json(
      { error: 'Administrators cannot create client purchase orders.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { packageId, idempotencyKey } = body;

    if (!packageId) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package selected' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check existing order with same user & idempotency key
    const idempKey = idempotencyKey || `manual_${user.id}_${packageId}_${Date.now()}`;
    const { data: existing } = await admin
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempKey)
      .maybeSingle();

    let order = existing;
    if (!order) {
      const { data: inserted, error: insertErr } = await admin
        .from('orders')
        .insert({
          user_id: user.id,
          provider: 'manual',
          package_id: pkg.id,
          credits_to_grant: pkg.credits,
          expected_amount_cents: Math.round(pkg.price * 100),
          currency: 'USD',
          status: 'created',
          idempotency_key: idempKey,
        })
        .select('*')
        .single();

      if (insertErr || !inserted) {
        console.error('Error creating manual order:', insertErr);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
      }
      order = inserted;
    }

    // Format manual payment instructions
    const adapter = new ManualPaymentAdapter();
    const checkoutResult = await adapter.createCheckout({
      orderId: order.id,
      packageId: pkg.id,
      packageName: pkg.name,
      priceUSD: pkg.price,
      credits: pkg.credits,
      userEmail: user.email,
      userId: user.id,
      idempotencyKey: idempKey,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      creditsToGrant: pkg.credits,
      priceUSD: pkg.price,
      instructions: checkoutResult.manualInstructions,
    });
  } catch (err: any) {
    console.error('Manual order exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
