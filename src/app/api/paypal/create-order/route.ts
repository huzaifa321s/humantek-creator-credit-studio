import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';
import { PACKAGES } from '@/lib/catalog';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageId, projectId } = body;

    const selectedPackage = PACKAGES.find((p) => p.id === packageId);
    if (!selectedPackage) {
      return NextResponse.json(
        { error: 'Invalid package selected' },
        { status: 400 }
      );
    }

    const order = await createPayPalOrder(selectedPackage.price, projectId);
    return NextResponse.json({ orderId: order.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create PayPal order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
