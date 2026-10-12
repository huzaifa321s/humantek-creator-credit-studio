import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface ManagementSummaryData {
  kpis: {
    totalRevenue: number;
    activeOrdersCount: number;
    pendingReviewCount: number;
    totalCreditsAllocated: number;
  };
  counts: {
    projects: number;
    pendingReview: number;
    wireOrders: number;
    alerts: number;
    ledger: number;
  };
}

export async function GET(_req: NextRequest) {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();

    // Run parallel count & aggregate queries with zero client RLS restriction
    const [
      allProjectsRes,
      pendingReviewRes,
      activeProjectsRes,
      ordersRes,
      pendingWireOrdersRes,
      alertsRes,
      ledgerRes,
    ] = await Promise.all([
      admin
        .from('projects')
        .select('id, package_price_usd, payment_status, total_credits, applied_wallet_credits', { count: 'exact' }),
      admin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
      admin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("delivered","declined")'),
      admin
        .from('orders')
        .select('id, status, captured_amount_cents, expected_amount_cents', { count: 'exact' })
        .eq('status', 'completed'),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_manual'),
      admin
        .from('admin_alerts')
        .select('id', { count: 'exact', head: true }),
      admin
        .from('credit_ledger')
        .select('id', { count: 'exact', head: true }),
    ]);

    const projects = allProjectsRes.data || [];
    const completedOrders = ordersRes.data || [];

    // 1. Calculate Total Revenue in USD
    const projectRevenue = projects
      .filter((p) => p.payment_status === 'paid')
      .reduce((sum, p) => sum + (Number(p.package_price_usd) || 0), 0);

    const orderRevenue = completedOrders.reduce((sum, o) => {
      const cents = o.captured_amount_cents || o.expected_amount_cents || 0;
      return sum + cents / 100;
    }, 0);

    const totalRevenue = Math.round((projectRevenue + orderRevenue) * 100) / 100;

    // 2. Active Orders & Pending Review
    const activeOrdersCount = activeProjectsRes.count ?? projects.filter(
      (p) => p.payment_status === 'paid'
    ).length;
    const pendingReviewCount = pendingReviewRes.count ?? 0;

    // 3. Credits Allocated
    const totalCreditsAllocated = projects.reduce((sum, p) => {
      return sum + (Number(p.total_credits) || Number(p.applied_wallet_credits) || 0);
    }, 0);

    // 4. Ledger count (if credit_ledger has records use count, otherwise derived from projects)
    const ledgerCount =
      (ledgerRes.count && ledgerRes.count > 0)
        ? ledgerRes.count
        : projects.length;

    const data: ManagementSummaryData = {
      kpis: {
        totalRevenue,
        activeOrdersCount,
        pendingReviewCount,
        totalCreditsAllocated,
      },
      counts: {
        projects: allProjectsRes.count ?? projects.length,
        pendingReview: pendingReviewCount,
        wireOrders: pendingWireOrdersRes.count ?? 0,
        alerts: alertsRes.count ?? 0,
        ledger: ledgerCount,
      },
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Exception in GET /api/management/summary:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
