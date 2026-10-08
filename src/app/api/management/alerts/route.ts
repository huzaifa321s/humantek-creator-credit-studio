import { NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      alerts: [
        {
          id: 'mock-alert-1',
          type: 'REFUND_SHORTFALL',
          message: 'Refund requested for order ord-demo: user spent 400 credits; 260 clawed back, 400 shortfall remaining.',
          metadata: { orderId: 'ord-demo', shortfall: 400, clawback: 260 },
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  try {
    const adminClient = createAdminClient();
    const { data: alerts, error } = await adminClient
      .from('admin_alerts')
      .select('id, type, message, metadata, created_at, user_id, order_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching admin alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch admin alerts' }, { status: 500 });
    }

    return NextResponse.json({ alerts: alerts || [] });
  } catch (err: any) {
    console.error('Exception in GET /api/management/alerts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
