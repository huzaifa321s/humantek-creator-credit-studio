import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAal2 } from '@/lib/auth';
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
    ledger: number;
    teamAccess: number;
  };
}

function isAutomatedTestEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@humantek.art') || lower.endsWith('.test');
}

export async function GET(_req: NextRequest) {
  const authRes = await requireAdminAal2();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  try {
    const admin = createAdminClient();

    // Run parallel count & aggregate queries with zero client RLS restriction
    const [
      allProjectsRes,
      ordersRes,
      pendingWireOrdersRes,
      ledgerRes,
      adminProfilesRes,
    ] = await Promise.all([
      admin
        .from('projects')
        .select('id, user_id, email, status, package_id, package_price_usd, payment_status, payment_method, funding_source, total_credits, applied_wallet_credits'),
      admin
        .from('orders')
        .select('id, user_id, package_id, status, captured_amount_cents, expected_amount_cents, metadata')
        .eq('status', 'fulfilled'),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_manual'),
      admin
        .from('credit_ledger')
        .select('id, profiles(email)'),
      admin
        .from('profiles')
        .select('id, email')
        .eq('role', 'admin'),
    ]);

    const rawProjects = allProjectsRes.data || [];
    const projects = rawProjects.filter((p) => !isAutomatedTestEmail(p.email));
    const fulfilledOrders = ordersRes.data || [];

    // Identify projects and users with fulfilled orders so we don't double-count the same package purchase
    const fulfilledOrderProjectIds = new Set<string>();
    const fulfilledOrderUserIdsWithoutProject = new Set<string>();
    for (const o of fulfilledOrders) {
      const metaProjId = (o.metadata as Record<string, unknown> | null)?.project_id;
      if (typeof metaProjId === 'string' && metaProjId) {
        fulfilledOrderProjectIds.add(metaProjId);
      } else if (o.user_id) {
        fulfilledOrderUserIdsWithoutProject.add(o.user_id);
      }
    }

    // 1. Calculate Total Revenue in USD
    const orderRevenue = fulfilledOrders.reduce((sum, o) => {
      const cents = o.captured_amount_cents || o.expected_amount_cents || 0;
      return sum + cents / 100;
    }, 0);

    // Include paid projects that are not already represented by a fulfilled order row or wallet credit spend
    const projectRevenue = projects
      .filter(
        (p) =>
          p.payment_status === 'paid' &&
          p.funding_source !== 'wallet' &&
          p.payment_method !== 'credits' &&
          !fulfilledOrderProjectIds.has(p.id) &&
          !(p.user_id && fulfilledOrderUserIdsWithoutProject.has(p.user_id) && orderRevenue > 0)
      )
      .reduce((sum, p) => sum + (Number(p.package_price_usd) || 0), 0);

    const totalRevenue = Math.round((projectRevenue + orderRevenue) * 100) / 100;

    // 2. Active Orders & Pending Review (strictly excluding delivered, declined, and cancelled)
    const activeOrdersCount = projects.filter(
      (p) => p.status !== 'delivered' && p.status !== 'declined' && p.status !== 'cancelled'
    ).length;
    const pendingReviewCount = projects.filter((p) => p.status === 'pending_review').length;

    // 3. Credits Allocated
    const totalCreditsAllocated = projects
      .filter((p) => p.status !== 'cancelled' && p.status !== 'declined')
      .reduce((sum, p) => {
        return sum + (Number(p.total_credits) || Number(p.applied_wallet_credits) || 0);
      }, 0);

    // 4. Ledger count (excluding automated test/archived rows)
    const realLedgerRows = (ledgerRes.data || []).filter((r: any) => {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return !isAutomatedTestEmail(prof?.email);
    });
    const ledgerCount =
      realLedgerRows.length > 0
        ? realLedgerRows.length
        : projects.length;

    const teamAccessCount = (adminProfilesRes.data || []).filter((a) => {
      const em = (a.email || '').toLowerCase();
      return !em.endsWith('.test') && !em.startsWith('e2e-') && !em.startsWith('test-');
    }).length || 1;

    const data: ManagementSummaryData = {
      kpis: {
        totalRevenue,
        activeOrdersCount,
        pendingReviewCount,
        totalCreditsAllocated,
      },
      counts: {
        projects: projects.length,
        pendingReview: pendingReviewCount,
        wireOrders: pendingWireOrdersRes.count ?? 0,
        ledger: ledgerCount,
        teamAccess: teamAccessCount,
      },
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Exception in GET /api/management/summary:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
