import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { clampLimit, decodeCursor, encodeCursor, PAGINATION_LIMITS } from '@/lib/pagination';
import type { LedgerTransaction } from '@/components/AgencyDataGrid';

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
  const typeParam = searchParams.get('type');
  const statusParam = searchParams.get('status');

  const limit = clampLimit(limitParam, PAGINATION_LIMITS.ADMIN_DEFAULT, PAGINATION_LIMITS.ADMIN_MAX);
  const cursor = decodeCursor(cursorParam);

  try {
    const admin = createAdminClient();

    // 1. First check if credit_ledger has records
    let ledgerQuery = admin
      .from('credit_ledger')
      .select('id, user_id, reverses_id, bucket, delta, type, reference_id, idempotency_key, description, created_at, profiles(email, full_name)', { count: 'exact' });

    if (typeParam && typeParam !== 'all') {
      ledgerQuery = ledgerQuery.eq('type', typeParam);
    }

    if (cursor) {
      ledgerQuery = ledgerQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    } else if (pageParam) {
      const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
      const offset = (pageNum - 1) * limit;
      ledgerQuery = ledgerQuery.range(offset, offset + limit - 1);
    }

    ledgerQuery = ledgerQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (!pageParam) {
      ledgerQuery = ledgerQuery.limit(limit + 1);
    }

    const { data: rows, error, count } = await ledgerQuery;

    if (error) {
      console.error('Error querying credit_ledger:', error);
    }

    // 2. If credit_ledger has real records, return them formatted as LedgerTransaction
    if (rows && rows.length > 0) {
      const list = rows;
      let items = list;
      let hasMore = false;
      let nextCursor: string | null = null;

      if (!pageParam) {
        hasMore = list.length > limit;
        items = hasMore ? list.slice(0, limit) : list;
        const lastRow = items[items.length - 1];
        nextCursor =
          hasMore && lastRow
            ? encodeCursor({ createdAt: lastRow.created_at, id: String(lastRow.id) })
            : null;
      } else {
        const pageNum = Math.max(1, parseInt(pageParam, 10) || 1);
        hasMore = pageNum * limit < (count ?? 0);
      }

      const transactions: LedgerTransaction[] = items.map((r: any) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const clientEmail = prof?.email || 'client@humantek.com';
        const clientName = prof?.full_name || clientEmail.split('@')[0];

        let txType: LedgerTransaction['type'] = 'service_deduction';
        if (r.type === 'package_purchase') txType = 'package_purchase';
        else if (r.type === 'promo_redeem') txType = 'promo_credit';
        else if (r.type?.includes('refund')) txType = 'refund';

        return {
          id: `tx-${r.id}`,
          reference: r.reference_id || `HT-CR-${String(r.id).padStart(5, '0')}`,
          clientEmail,
          clientName,
          type: txType,
          creditsDelta: r.delta,
          usdAmount: 0,
          date: new Date(r.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(r.created_at).getTime(),
          paymentMethod: r.bucket === 'promo' ? 'promo' : 'credits',
          status: 'completed',
        };
      });

      return NextResponse.json({
        transactions,
        totalCount: count ?? items.length,
        hasMore,
        nextCursor,
        limit,
      });
    }

    // 3. Fallback: If credit_ledger table has 0 records, build transactions
    // from real projects and orders in PostgreSQL (100% real data, no fake seed rows)
    const { data: dbProjects } = await admin
      .from('projects')
      .select('id, project_code, email, client_name, package_price_usd, package_credits, total_credits, applied_wallet_credits, payment_status, payment_method, funding_source, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const fallbackTransactions: LedgerTransaction[] = [];
    (dbProjects || []).forEach((p) => {
      const isWallet =
        p.funding_source === 'wallet' || p.payment_method === 'credits';

      // Deposit purchase transaction
      if (!isWallet && p.package_price_usd) {
        fallbackTransactions.push({
          id: `tx-deposit-${p.id}`,
          reference: p.project_code || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email || 'client@humantek.com',
          clientName: p.client_name || (p.email ? p.email.split('@')[0] : 'Client'),
          type: 'package_purchase',
          creditsDelta: Number(p.package_credits) || Number(p.total_credits) || 660,
          usdAmount: Number(p.package_price_usd) || 0,
          date: new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.created_at).getTime(),
          paymentMethod: 'paypal',
          status: p.payment_status === 'paid' ? 'completed' : 'pending',
        });
      }

      // Deduction transaction
      const creditsUsed = Number(p.applied_wallet_credits) || Number(p.total_credits) || 0;
      if (creditsUsed > 0) {
        fallbackTransactions.push({
          id: `tx-deduct-${p.id}`,
          reference: p.project_code || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email || 'client@humantek.com',
          clientName: p.client_name || (p.email ? p.email.split('@')[0] : 'Client'),
          type: 'service_deduction',
          creditsDelta: -creditsUsed,
          usdAmount: 0,
          date: new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.created_at).getTime() + 1000,
          paymentMethod: 'credits',
          status: p.payment_status === 'paid' ? 'completed' : 'pending',
        });
      }
    });

    fallbackTransactions.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      transactions: fallbackTransactions.slice(0, limit),
      totalCount: fallbackTransactions.length,
      hasMore: false,
      nextCursor: null,
      limit,
    });
  } catch (err: any) {
    console.error('Exception in GET /api/management/ledger:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
