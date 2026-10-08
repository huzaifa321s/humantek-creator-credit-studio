import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createPayPalOrder } from '@/lib/paypal';
import { PACKAGES } from '@/lib/catalog';

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

  const { packageId, idempotencyKey: rawKey } = (body as Record<string, unknown>) || {};
  if (typeof packageId !== 'string' || !packageId.trim()) {
    return NextResponse.json({ error: 'Valid package ID is required' }, { status: 400 });
  }

  const idempKey = typeof rawKey === 'string' && rawKey.trim()
    ? rawKey.trim()
    : `order-req-${crypto.randomUUID()}`;

  // 1. Production / Real Supabase Path
  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    const adminClient = createAdminClient();

    // Replay check: scoped per user
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempKey)
      .maybeSingle();

    if (existingOrder && existingOrder.provider_order_id && ['created', 'approved', 'capture_pending'].includes(existingOrder.status)) {
      return NextResponse.json({
        orderId: existingOrder.provider_order_id,
        internalOrderId: existingOrder.id,
        credits: existingOrder.credits_to_grant,
        expectedAmountCents: existingOrder.expected_amount_cents,
      });
    }

    // Read package authoritatively from database catalog
    const { data: pkg, error: pkgErr } = await adminClient
      .from('packages')
      .select('*')
      .eq('id', packageId.trim())
      .eq('is_active', true)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Unknown or inactive package selected' }, { status: 400 });
    }

    const priceUSD = Number(pkg.price_usd);
    const expectedAmountCents = Math.round(priceUSD * 100);

    if (expectedAmountCents <= 0 || pkg.credits <= 0) {
      return NextResponse.json(
        { error: 'Selected package cannot be purchased via PayPal' },
        { status: 400 }
      );
    }

    try {
      // Insert initial order record with status 'created'
      const { data: newOrder, error: insertErr } = await adminClient
        .from('orders')
        .insert({
          user_id: user.id,
          package_id: pkg.id,
          credits_to_grant: pkg.credits,
          expected_amount_cents: expectedAmountCents,
          currency: 'USD',
          status: 'created',
          idempotency_key: idempKey,
        })
        .select('*')
        .single();

      if (insertErr || !newOrder) {
        throw new Error(insertErr?.message || 'Failed to initialize database order');
      }

      // Call PayPal with intent: CAPTURE, formatted USD string, custom_id, and PayPal-Request-Id header
      const paypalOrder = await createPayPalOrder(priceUSD, newOrder.id, idempKey);

      // Save PayPal's provider_order_id in orders
      await adminClient
        .from('orders')
        .update({ provider_order_id: paypalOrder.id })
        .eq('id', newOrder.id);

      return NextResponse.json({
        orderId: paypalOrder.id,
        internalOrderId: newOrder.id,
        priceUSD,
        credits: pkg.credits,
        packageName: pkg.name,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create PayPal order';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // 2. Dev Mock Fallback
  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg || pkg.price <= 0) {
    return NextResponse.json({ error: 'Unknown package' }, { status: 400 });
  }

  const mockPaypal = await createPayPalOrder(pkg.price, `mock-proj-${Date.now()}`, idempKey);
  return NextResponse.json({
    orderId: mockPaypal.id,
    internalOrderId: `mock-order-${Date.now()}`,
    priceUSD: pkg.price,
    credits: pkg.credits,
    packageName: pkg.name,
  });
}
