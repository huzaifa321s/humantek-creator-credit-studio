import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { clampLimit, decodeCursor, encodeCursor, PAGINATION_LIMITS } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const cursorParam = searchParams.get('cursor');
  const pageParam = searchParams.get('page');

  const limit = clampLimit(limitParam, PAGINATION_LIMITS.ADMIN_DEFAULT, PAGINATION_LIMITS.ADMIN_MAX);
  const cursor = decodeCursor(cursorParam);

  if (!isSupabaseConfigured()) {
    const mockAlerts = [
      {
        id: 'mock-alert-1',
        type: 'REFUND_SHORTFALL',
        message: 'Refund requested for order ord-demo: user spent 400 credits; 260 clawed back, 400 shortfall remaining.',
        metadata: { orderId: 'ord-demo', shortfall: 400, clawback: 260 },
        created_at: new Date().toISOString(),
      },
    ];
    return NextResponse.json({
      alerts: mockAlerts,
      totalCount: mockAlerts.length,
      hasMore: false,
      nextCursor: null,
      limit,
    });
  }

  try {
    const adminClient = createAdminClient();
    let query = adminClient
      .from('admin_alerts')
      .select('id, type, message, metadata, created_at, user_id, order_id', { count: 'exact' });

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    } else if (pageParam) {
      const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
      const offset = (pageNum - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (!pageParam) {
      query = query.limit(limit + 1);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      console.error('Error fetching admin alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch admin alerts' }, { status: 500 });
    }

    const list = rows || [];
    let items = list;
    let hasMore = false;
    let nextCursor: string | null = null;

    if (!pageParam) {
      hasMore = list.length > limit;
      items = hasMore ? list.slice(0, limit) : list;
      const lastRow = items[items.length - 1];
      nextCursor = hasMore && lastRow ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id }) : null;
    } else {
      const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
      hasMore = pageNum * limit < (count ?? 0);
    }

    return NextResponse.json({
      alerts: items,
      totalCount: count ?? items.length,
      hasMore,
      nextCursor,
      limit,
    });
  } catch (err: any) {
    console.error('Exception in GET /api/management/alerts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
