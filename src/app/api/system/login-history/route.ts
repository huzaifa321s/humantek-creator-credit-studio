import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Developer / Studio Owner endpoint to inspect the rolling 500-row login history.
 * Strictly restricted to authenticated admin accounts.
 */
export async function GET(req: NextRequest) {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [], total: 0 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit')) || 100;
  const limit = Math.min(Math.max(1, limitParam), 500);
  const emailFilter = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();

  try {
    const admin = createAdminClient();
    let query = admin
      .from('login_history')
      .select('id, user_id, email, role, auth_method, ip_address, location, device, user_agent, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (emailFilter) {
      query = query.ilike('email', `%${emailFilter}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
      total: count ?? (data?.length || 0),
      maxCap: 500,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load login history' },
      { status: 500 }
    );
  }
}
