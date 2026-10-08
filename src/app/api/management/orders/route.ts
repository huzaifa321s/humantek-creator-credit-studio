import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { data: orders, error } = await admin
      .from('orders')
      .select('id, user_id, provider, package_id, credits_to_grant, expected_amount_cents, captured_amount_cents, currency, status, provider_order_id, provider_capture_id, created_at, fulfilled_at, profiles(email, full_name), packages(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching management orders:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (err: any) {
    console.error('Orders route exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
