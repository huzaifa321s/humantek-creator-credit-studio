import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getUserBalance, getLedger, getProjects } from '@/lib/store';
import { PACKAGES } from '@/lib/catalog';
import type { CreditLedgerEntry } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser();
    const queryEmail = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
    const effectiveEmail = (user?.email || queryEmail || 'kira@example.com').toLowerCase().trim();

    // 1. Production / Real Supabase Path
    if (isSupabaseConfigured() && user?.id && !user.isDevFallback) {
      const adminClient = createAdminClient();

      const [walletRes, ledgerRes, projectsRes, ordersRes] = await Promise.all([
        adminClient
          .from('wallets')
          .select('balance_credits, balance_purchased, balance_promo')
          .eq('user_id', user.id)
          .single(),
        adminClient
          .from('credit_ledger')
          .select('id, reverses_id, bucket, delta, type, reference_id, description, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(200),
        adminClient
          .from('projects')
          .select(
            'id, user_id, project_code, email, package_id, package_name, package_price_usd, package_credits, total_credits, applied_wallet_credits, payment_status, payment_method, funding_source, created_at'
          )
          .or(`user_id.eq.${user.id},email.ilike.${effectiveEmail}`)
          .order('created_at', { ascending: false })
          .limit(200),
        adminClient
          .from('orders')
          .select('id, order_code, package_id, credits_granted, amount_cents, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (walletRes.error && walletRes.error.code !== 'PGRST116') {
        return NextResponse.json({ error: 'Failed to retrieve wallet' }, { status: 500 });
      }

      if (ledgerRes.error) {
        return NextResponse.json({ error: 'Failed to retrieve ledger' }, { status: 500 });
      }

      const wallet = walletRes.data;
      const rawLedger = ledgerRes.data || [];
      const dbProjects = projectsRes.data || [];
      const dbOrders = ordersRes.data || [];

      const projectByRef = new Map<string, (typeof dbProjects)[number]>();
      for (const p of dbProjects) {
        if (p.project_code) projectByRef.set(p.project_code, p);
        if (p.id) projectByRef.set(p.id, p);
      }

      const orderByRef = new Map<string, (typeof dbOrders)[number]>();
      for (const o of dbOrders) {
        if (o.order_code) orderByRef.set(o.order_code, o);
        if (o.id) orderByRef.set(o.id, o);
      }

      const reversedLedgerIds = new Set<number>();
      for (const r of rawLedger) {
        if (r.reverses_id != null) {
          reversedLedgerIds.add(Number(r.reverses_id));
        }
      }

      const ledgerPurchaseRefs = new Set<string>();
      const ledgerSpendRefs = new Set<string>();
      const ledger: CreditLedgerEntry[] = [];

      for (const row of rawLedger) {
        const matchedProject = row.reference_id ? projectByRef.get(row.reference_id) : undefined;
        const matchedOrder = row.reference_id ? orderByRef.get(row.reference_id) : undefined;

        let txType: CreditLedgerEntry['type'] = 'service_deduction';
        if (row.type === 'package_purchase') {
          txType = 'package_purchase';
          if (row.reference_id) ledgerPurchaseRefs.add(row.reference_id);
          if (matchedProject?.project_code) ledgerPurchaseRefs.add(matchedProject.project_code);
          if (matchedProject?.id) ledgerPurchaseRefs.add(matchedProject.id);
        } else if (row.type === 'promo_redeem' || row.type === 'redeem_code') {
          txType = 'redeem_code';
        } else if (row.type === 'manual_Adjustment' || row.type === 'manual_topup' || row.type === 'promo_credit') {
          txType = 'promo_credit';
        } else if (row.type?.includes('refund') || row.type === 'chargeback') {
          txType = 'refund';
        } else {
          txType = 'service_deduction';
          if (row.reference_id) ledgerSpendRefs.add(row.reference_id);
          if (matchedProject?.project_code) ledgerSpendRefs.add(matchedProject.project_code);
          if (matchedProject?.id) ledgerSpendRefs.add(matchedProject.id);
        }

        let usdAmount = 0;
        if (txType === 'package_purchase' || row.type === 'refund_cash' || row.type === 'chargeback') {
          if (matchedOrder?.amount_cents) {
            usdAmount = Number(matchedOrder.amount_cents) / 100;
          } else if (matchedProject?.package_price_usd) {
            usdAmount = Number(matchedProject.package_price_usd);
          } else if (matchedProject?.package_id) {
            const pkg = PACKAGES.find((k) => k.id === matchedProject.package_id);
            if (pkg) usdAmount = pkg.price;
          } else {
            const pkgByCredits = PACKAGES.find((k) => k.credits === Math.abs(Number(row.delta)));
            if (pkgByCredits) usdAmount = pkgByCredits.price;
          }
        }

        const isReversed = reversedLedgerIds.has(Number(row.id));
        const resolvedRef =
          matchedProject?.project_code ||
          matchedOrder?.order_code ||
          row.reference_id ||
          `HT-CR-${String(row.id).padStart(5, '0')}`;

        ledger.push({
          id: `led-${row.id}`,
          userId: user.id,
          userEmail: effectiveEmail,
          type: txType,
          creditsDelta: Number(row.delta),
          usdAmount,
          referenceId: resolvedRef,
          description:
            row.description ||
            (txType === 'package_purchase'
              ? `${matchedProject?.package_name || 'Package'} credit allocation (${resolvedRef})`
              : txType === 'service_deduction'
                ? `Project scope deduction (${resolvedRef})`
                : txType === 'redeem_code'
                  ? `Promo code redeemed (${resolvedRef})`
                  : `Credit adjustment (${resolvedRef})`),
          createdAt: row.created_at,
          status: isReversed ? 'reversed' : 'completed',
          bucket: (row.bucket as 'purchased' | 'promo') || 'purchased',
          projectId: matchedProject?.id,
          projectCode: matchedProject?.project_code || undefined,
        });
      }

      // Include pending/unpaid or pre-ledger project transactions not yet in credit_ledger
      for (const p of dbProjects) {
        const refCode = p.project_code || `HT-${p.id.slice(-6).toUpperCase()}`;
        const pkg = p.package_id ? PACKAGES.find((k) => k.id === p.package_id) : undefined;
        const isWallet = p.funding_source === 'wallet' || p.payment_method === 'credits';

        const effectivePkgCredits =
          Number(p.package_credits) || pkg?.credits || Number(p.total_credits) || 0;
        const effectiveUsd = Number(p.package_price_usd) || pkg?.price || 0;
        const txStatus: NonNullable<CreditLedgerEntry['status']> =
          p.payment_status === 'paid'
            ? 'completed'
            : p.payment_status === 'refunded'
              ? 'reversed'
              : 'pending';

        const hasLedgerPurchase =
          ledgerPurchaseRefs.has(refCode) || ledgerPurchaseRefs.has(p.id);
        const hasLedgerSpend =
          ledgerSpendRefs.has(refCode) || ledgerSpendRefs.has(p.id);

        if (!isWallet && effectiveUsd > 0 && !hasLedgerPurchase) {
          ledger.push({
            id: `led-deposit-${p.id}`,
            userId: user.id,
            userEmail: effectiveEmail,
            type: 'package_purchase',
            creditsDelta: effectivePkgCredits,
            usdAmount: effectiveUsd,
            referenceId: refCode,
            description: `${p.package_name || pkg?.name || 'Package'} credit allocation (${refCode})`,
            createdAt: p.created_at,
            status: txStatus,
            bucket: 'purchased',
            projectId: p.id,
            projectCode: refCode,
          });
        }

        const creditsUsed = Number(p.applied_wallet_credits) || Number(p.total_credits) || 0;
        if (creditsUsed > 0 && !hasLedgerSpend) {
          ledger.push({
            id: `led-deduct-${p.id}`,
            userId: user.id,
            userEmail: effectiveEmail,
            type: 'service_deduction',
            creditsDelta: -creditsUsed,
            usdAmount: 0,
            referenceId: refCode,
            description: `Project scope deduction (${refCode})`,
            createdAt: p.created_at,
            status: txStatus,
            bucket: 'purchased',
            projectId: p.id,
            projectCode: refCode,
          });
        }
      }

      ledger.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({
        success: true,
        email: effectiveEmail,
        walletBalance: wallet?.balance_credits ?? 0,
        balancePurchased: wallet?.balance_purchased ?? 0,
        balancePromo: wallet?.balance_promo ?? 0,
        ledger,
      });
    }

    // 2. Development / Offline Fallback Path
    const walletBalance = getUserBalance(effectiveEmail);
    const localProjects = getProjects().filter(
      (p) => (p.email || '').toLowerCase().trim() === effectiveEmail
    );
    const projectByRef = new Map<string, (typeof localProjects)[number]>();
    for (const p of localProjects) {
      if (p.projectCode) projectByRef.set(p.projectCode, p);
      if (p.id) projectByRef.set(p.id, p);
    }

    const ledger = getLedger()
      .filter((e) => (e.userEmail || '').toLowerCase().trim() === effectiveEmail)
      .map((e) => {
        const matched = e.referenceId ? projectByRef.get(e.referenceId) : undefined;
        return {
          ...e,
          status: e.status || 'completed',
          bucket: e.bucket || (e.type === 'redeem_code' || e.type === 'promo_credit' ? 'promo' : 'purchased'),
          projectId: e.projectId || matched?.id,
          projectCode: e.projectCode || matched?.projectCode,
        };
      });

    return NextResponse.json({
      success: true,
      email: effectiveEmail,
      walletBalance,
      balancePurchased: walletBalance,
      balancePromo: 0,
      ledger,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
