import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAal2 } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { clampLimit } from '@/lib/pagination';
import { PACKAGES } from '@/lib/catalog';
import { parseGiftPromoMetadata } from '@/lib/email';
import type {
  LedgerTransaction,
  LedgerCustomerSummary,
  SharedPromoTransferInfo,
  SharedPromoAuditLogItem,
} from '@/components/AgencyDataGrid';

export const dynamic = 'force-dynamic';

function isAutomatedTestEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@humantek.art') || lower.endsWith('.test');
}

export async function GET(req: NextRequest) {
  const authRes = await requireAdminAal2();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const pageParam = searchParams.get('page');
  const typeParam = searchParams.get('type');
  const statusParam = searchParams.get('status');
  const customerParam = searchParams.get('customer')?.toLowerCase().trim();

  const limit = clampLimit(limitParam, 500, 1000);

  try {
    const admin = createAdminClient();

    // Fetch credit_ledger, projects, orders, wallets, profiles, promo_codes, and promo_redemptions in parallel
    const [
      ledgerRes,
      projectsRes,
      ordersRes,
      walletsRes,
      profilesRes,
      promoCodesRes,
      promoRedemptionsRes,
    ] = await Promise.all([
      admin
        .from('credit_ledger')
        .select(
          'id, user_id, reverses_id, bucket, delta, type, reference_id, idempotency_key, description, created_at, profiles(email, full_name)'
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500),
      admin
        .from('projects')
        .select(
          'id, user_id, project_code, email, client_name, package_id, package_name, package_price_usd, package_credits, total_credits, applied_wallet_credits, payment_status, payment_method, funding_source, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('orders')
        .select(
          'id, user_id, provider, package_id, credits_to_grant, expected_amount_cents, captured_amount_cents, status, created_at, metadata'
        )
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('wallets')
        .select('user_id, balance_credits, balance_purchased, balance_promo')
        .limit(500),
      admin
        .from('profiles')
        .select('id, email, full_name, role')
        .limit(500),
      admin
        .from('promo_codes')
        .select('id, code, credits, max_uses, used_count, is_active, description, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('promo_redemptions')
        .select('id, user_id, promo_code_id, credits_granted, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (ledgerRes.error) {
      console.error('Error querying credit_ledger:', ledgerRes.error);
    }

    const ledgerRows = ledgerRes.data || [];
    const dbProjects = projectsRes.data || [];
    const dbOrders = ordersRes.data || [];
    const dbWallets = walletsRes.data || [];
    const dbProfiles = profilesRes.data || [];
    const dbPromoCodes = promoCodesRes.data || [];
    const dbPromoRedemptions = promoRedemptionsRes.data || [];

    // Build lookup maps for USD enrichment, wallets, profiles, and gift promo codes
    const walletByUserId = new Map<string, (typeof dbWallets)[number]>();
    for (const w of dbWallets) {
      if (w.user_id) walletByUserId.set(w.user_id, w);
    }

    const profileByEmail = new Map<string, (typeof dbProfiles)[number]>();
    const profileById = new Map<string, (typeof dbProfiles)[number]>();
    for (const prof of dbProfiles) {
      if (prof.id) profileById.set(prof.id, prof);
      if (prof.email) {
        profileByEmail.set(prof.email.toLowerCase().trim(), prof);
      }
    }

    // Map promo redemptions by promo_code_id
    const redemptionByPromoId = new Map<
      string,
      { userId: string; creditsGranted: number; createdAt: string }
    >();
    for (const red of dbPromoRedemptions) {
      if (red.promo_code_id) {
        redemptionByPromoId.set(String(red.promo_code_id), {
          userId: String(red.user_id || ''),
          creditsGranted: Number(red.credits_granted || 0),
          createdAt: String(red.created_at || ''),
        });
      }
    }

    // Build lookup maps for Client-to-Client Shared Promo Codes (by code and by promo_code.id)
    const giftTransferByRef = new Map<string, SharedPromoTransferInfo>();
    const sharedPromos: SharedPromoAuditLogItem[] = [];

    for (const row of dbPromoCodes) {
      const meta = parseGiftPromoMetadata(row.description);
      if (!meta) continue;

      const senderEmail = meta.senderEmail.toLowerCase().trim();
      if (isAutomatedTestEmail(senderEmail) && isAutomatedTestEmail(meta.recipientEmail)) {
        continue;
      }

      const senderProfile =
        (meta.senderId ? profileById.get(meta.senderId) : undefined) ||
        profileByEmail.get(senderEmail);
      const senderName =
        senderProfile?.full_name ||
        meta.senderName ||
        senderEmail.split('@')[0] ||
        'Creator';

      const redemption = redemptionByPromoId.get(String(row.id));
      const redeemedProfile = redemption?.userId
        ? profileById.get(redemption.userId)
        : undefined;
      const targetRecipientEmail = (
        redeemedProfile?.email ||
        meta.recipientEmail ||
        ''
      )
        .toLowerCase()
        .trim();
      const recipientProfile =
        redeemedProfile || profileByEmail.get(targetRecipientEmail);
      const recipientName =
        recipientProfile?.full_name ||
        (targetRecipientEmail ? targetRecipientEmail.split('@')[0] : 'Recipient');

      const isClaimed =
        Boolean(redemption) || Number(row.used_count) >= Number(row.max_uses);

      const transferInfo: SharedPromoTransferInfo = {
        code: String(row.code),
        credits: Number(row.credits || 0),
        senderName,
        senderEmail,
        recipientName,
        recipientEmail: targetRecipientEmail,
        note: meta.note,
        isClaimed,
        claimedAt: redemption?.createdAt || null,
        createdAt: String(row.created_at || meta.createdAt),
      };

      if (row.code) {
        giftTransferByRef.set(String(row.code).toUpperCase(), transferInfo);
      }
      if (row.id) {
        giftTransferByRef.set(String(row.id), transferInfo);
      }

      sharedPromos.push({
        id: String(row.id),
        ...transferInfo,
      });
    }

    const projectByRef = new Map<string, (typeof dbProjects)[number]>();
    for (const p of dbProjects) {
      if (p.project_code) projectByRef.set(p.project_code, p);
      if (p.id) projectByRef.set(p.id, p);
    }

    const orderByRef = new Map<string, (typeof dbOrders)[number]>();
    for (const o of dbOrders) {
      if (o.id) orderByRef.set(o.id, o);
      const metaProjId = (o.metadata as Record<string, unknown> | null)?.project_id;
      if (typeof metaProjId === 'string' && metaProjId) {
        orderByRef.set(metaProjId, o);
      }
    }

    // Track which ledger row IDs have been reversed by a subsequent row
    const reversedLedgerIds = new Set<number>();
    for (const r of ledgerRows) {
      if (r.reverses_id != null) {
        reversedLedgerIds.add(Number(r.reverses_id));
      }
    }

    // Track which project references already have settled ledger entries
    const ledgerPurchaseRefs = new Set<string>();
    const ledgerSpendRefs = new Set<string>();

    const allTransactions: LedgerTransaction[] = [];

    // 1. Map settled/reversed rows from credit_ledger
    for (const r of ledgerRows as any[]) {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const matchedOrder = r.reference_id ? orderByRef.get(r.reference_id) : undefined;
      const linkedProjId = (matchedOrder?.metadata as Record<string, unknown> | null)?.project_id;
      const matchedProject =
        (r.reference_id ? projectByRef.get(r.reference_id) : undefined) ||
        (typeof linkedProjId === 'string' ? projectByRef.get(linkedProjId) : undefined);

      const clientEmail =
        prof?.email || matchedProject?.email || 'client@humantek.com';

      if (isAutomatedTestEmail(clientEmail)) {
        continue;
      }

      const clientName =
        prof?.full_name ||
        matchedProject?.client_name ||
        clientEmail.split('@')[0];

      // Check if this ledger row is part of a Client-to-Client Shared Promo Transfer
      const rawRefStr = r.reference_id ? String(r.reference_id).trim() : '';
      const codeFromDescMatch =
        typeof r.description === 'string'
          ? r.description.match(/HT-GIFT-[A-Z0-9-]+/i)
          : null;
      const candidateGiftCode = codeFromDescMatch
        ? codeFromDescMatch[0].toUpperCase()
        : rawRefStr.toUpperCase();

      const matchedGiftTransfer =
        (rawRefStr ? giftTransferByRef.get(rawRefStr) : undefined) ||
        (candidateGiftCode ? giftTransferByRef.get(candidateGiftCode) : undefined);

      let txType: LedgerTransaction['type'] = 'service_deduction';
      if (r.type === 'package_purchase') {
        txType = 'package_purchase';
        if (r.reference_id) ledgerPurchaseRefs.add(r.reference_id);
        if (matchedOrder?.id) ledgerPurchaseRefs.add(matchedOrder.id);
        if (typeof linkedProjId === 'string' && linkedProjId) ledgerPurchaseRefs.add(linkedProjId);
        if (matchedProject?.project_code) ledgerPurchaseRefs.add(matchedProject.project_code);
        if (matchedProject?.id) ledgerPurchaseRefs.add(matchedProject.id);
      } else if (
        r.type === 'promo_redeem' ||
        r.type === 'admin_adjustment' ||
        r.type === 'manual_Adjustment' ||
        Boolean(matchedGiftTransfer)
      ) {
        txType = 'promo_credit';
      } else if (r.type?.includes('refund') || r.type === 'chargeback') {
        txType = 'refund';
      } else {
        txType = 'service_deduction';
        if (r.reference_id) ledgerSpendRefs.add(r.reference_id);
        if (matchedProject?.project_code) ledgerSpendRefs.add(matchedProject.project_code);
        if (matchedProject?.id) ledgerSpendRefs.add(matchedProject.id);
      }

      // Resolve real USD amount for package purchases and cash refunds
      const orderAmountCents =
        matchedOrder?.captured_amount_cents ?? matchedOrder?.expected_amount_cents;
      let usdAmount = 0;
      if (txType === 'package_purchase' || r.type === 'refund_cash' || r.type === 'chargeback') {
        if (orderAmountCents != null && Number(orderAmountCents) > 0) {
          usdAmount = Number(orderAmountCents) / 100;
        } else if (matchedProject?.package_price_usd) {
          usdAmount = Number(matchedProject.package_price_usd);
        } else if (matchedProject?.package_id) {
          const pkg = PACKAGES.find((k) => k.id === matchedProject.package_id);
          if (pkg) usdAmount = pkg.price;
        } else if (matchedOrder?.package_id) {
          const pkg = PACKAGES.find((k) => k.id === matchedOrder.package_id);
          if (pkg) usdAmount = pkg.price;
        } else {
          const pkgByCredits = PACKAGES.find((k) => k.credits === Math.abs(Number(r.delta)));
          if (pkgByCredits) usdAmount = pkgByCredits.price;
        }
      }

      const isReversed = reversedLedgerIds.has(Number(r.id));
      const deltaNum = Number(r.delta);

      // Build clear description when this row is a friend-to-friend gift promo transfer
      let enrichedDescription: string | undefined = r.description || undefined;
      if (matchedGiftTransfer) {
        if (deltaNum > 0) {
          enrichedDescription = `Redeemed friend promo ${matchedGiftTransfer.code} — Shared by ${matchedGiftTransfer.senderName} (${matchedGiftTransfer.senderEmail})`;
        } else if (deltaNum < 0) {
          enrichedDescription = `Shared promo code ${matchedGiftTransfer.code} to ${matchedGiftTransfer.recipientName} (${matchedGiftTransfer.recipientEmail})`;
        }
      }

      allTransactions.push({
        id: `tx-${r.id}`,
        reference:
          matchedGiftTransfer?.code ||
          matchedProject?.project_code ||
          matchedOrder?.id ||
          r.reference_id ||
          `HT-CR-${String(r.id).padStart(5, '0')}`,
        clientEmail,
        clientName,
        type: txType,
        creditsDelta: deltaNum,
        usdAmount,
        date: new Date(r.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }),
        timestamp: new Date(r.created_at).getTime(),
        paymentMethod:
          r.bucket === 'promo' || matchedGiftTransfer
            ? 'promo'
            : txType === 'package_purchase'
              ? 'paypal'
              : 'credits',
        status: isReversed ? 'reversed' : 'completed',
        description: enrichedDescription,
        bucket: r.bucket || 'purchased',
        sharedPromo: matchedGiftTransfer
          ? {
              ...matchedGiftTransfer,
              direction: deltaNum >= 0 ? 'received' : 'sent',
            }
          : undefined,
      });
    }

    for (const o of dbOrders) {
      if (o.status === 'fulfilled' && ledgerPurchaseRefs.has(o.id)) {
        const metaProjId = (o.metadata as Record<string, unknown> | null)?.project_id;
        if (typeof metaProjId === 'string' && metaProjId) {
          ledgerPurchaseRefs.add(metaProjId);
          const linkedProj = projectByRef.get(metaProjId);
          if (linkedProj?.project_code) ledgerPurchaseRefs.add(linkedProj.project_code);
        }
      }
    }

    // 2. Include pending/unpaid or pre-ledger project transactions not yet in credit_ledger
    for (const p of dbProjects) {
      if (isAutomatedTestEmail(p.email)) continue;

      const refCode = p.project_code || `HT-${p.id.slice(-6).toUpperCase()}`;
      const pkg = p.package_id ? PACKAGES.find((k) => k.id === p.package_id) : undefined;
      const isWallet = p.funding_source === 'wallet' || p.payment_method === 'credits';

      const effectivePkgCredits =
        Number(p.package_credits) || pkg?.credits || Number(p.total_credits) || 0;
      const effectiveUsd =
        Number(p.package_price_usd) || pkg?.price || 0;
      const txStatus: LedgerTransaction['status'] =
        p.payment_status === 'paid'
          ? 'completed'
          : p.payment_status === 'refunded'
            ? 'reversed'
            : 'pending';

      const hasLedgerPurchase =
        ledgerPurchaseRefs.has(refCode) || ledgerPurchaseRefs.has(p.id);
      const hasLedgerSpend =
        ledgerSpendRefs.has(refCode) || ledgerSpendRefs.has(p.id);

      // Deposit / Package Purchase entry
      if (!isWallet && effectiveUsd > 0 && !hasLedgerPurchase) {
        allTransactions.push({
          id: `tx-deposit-${p.id}`,
          reference: refCode,
          clientEmail: p.email || 'client@humantek.com',
          clientName: p.client_name || (p.email ? p.email.split('@')[0] : 'Client'),
          type: 'package_purchase',
          creditsDelta: effectivePkgCredits,
          usdAmount: effectiveUsd,
          date: new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.created_at).getTime(),
          paymentMethod: 'paypal',
          status: txStatus,
          description: `${p.package_name || pkg?.name || 'Package'} allocation (${refCode})`,
          bucket: 'purchased',
        });
      }

      // Service Scope Deduction entry
      const creditsUsed = Number(p.applied_wallet_credits) || Number(p.total_credits) || 0;
      if (creditsUsed > 0 && !hasLedgerSpend) {
        allTransactions.push({
          id: `tx-deduct-${p.id}`,
          reference: refCode,
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
          status: txStatus,
          description: `Production scope deduction (${refCode})`,
          bucket: 'purchased',
        });
      }
    }

    // 3. Build comprehensive per-customer credit summaries across all transactions, projects, and wallets
    const customerMap = new Map<
      string,
      LedgerCustomerSummary & { _projectKeys: Set<string> }
    >();

    const ensureCustomer = (rawEmail: string, fallbackName?: string | null, userId?: string | null) => {
      const normalizedEmail = (rawEmail || 'client@humantek.com').toLowerCase().trim();
      let entry = customerMap.get(normalizedEmail);
      if (!entry) {
        const prof = profileByEmail.get(normalizedEmail);
        const resolvedUserId = userId || prof?.id || null;
        const wallet = resolvedUserId ? walletByUserId.get(resolvedUserId) : undefined;
        const displayName =
          prof?.full_name ||
          fallbackName ||
          normalizedEmail.split('@')[0];

        entry = {
          clientEmail: normalizedEmail,
          clientName: displayName,
          userId: resolvedUserId,
          walletBalance: Number(wallet?.balance_credits || 0),
          walletPurchased: Number(wallet?.balance_purchased || 0),
          walletPromo: Number(wallet?.balance_promo || 0),
          settledCreditsAllocated: 0,
          pendingCreditsAllocated: 0,
          settledCreditsUsed: 0,
          pendingCreditsUsed: 0,
          settledUsdVolume: 0,
          pendingUsdVolume: 0,
          projectCount: 0,
          transactionCount: 0,
          _projectKeys: new Set<string>(),
        };
        customerMap.set(normalizedEmail, entry);
      } else if (fallbackName && entry.clientName === entry.clientEmail.split('@')[0]) {
        entry.clientName = fallbackName;
      }
      return entry;
    };

    for (const prof of dbProfiles) {
      if (!prof.email || prof.role === 'admin' || isAutomatedTestEmail(prof.email)) continue;
      ensureCustomer(prof.email, prof.full_name, prof.id);
    }

    for (const p of dbProjects) {
      if (!p.email || isAutomatedTestEmail(p.email)) continue;
      const entry = ensureCustomer(p.email, p.client_name, p.user_id);
      const refKey = p.project_code || p.id;
      if (refKey) entry._projectKeys.add(refKey);
    }

    for (const t of allTransactions) {
      if (isAutomatedTestEmail(t.clientEmail)) continue;
      const entry = ensureCustomer(t.clientEmail, t.clientName);
      entry.transactionCount += 1;
      if (
        t.reference &&
        t.reference.startsWith('HT-') &&
        !t.reference.startsWith('HT-GIFT-') &&
        !t.reference.startsWith('HT-CR-') &&
        !t.reference.startsWith('HT-ADJ-')
      ) {
        entry._projectKeys.add(t.reference);
      }

      if (t.status === 'completed') {
        if (t.creditsDelta > 0) {
          entry.settledCreditsAllocated += t.creditsDelta;
        } else if (t.creditsDelta < 0) {
          entry.settledCreditsUsed += Math.abs(t.creditsDelta);
        }
        entry.settledUsdVolume += t.usdAmount;
      } else if (t.status === 'pending') {
        if (t.creditsDelta > 0) {
          entry.pendingCreditsAllocated += t.creditsDelta;
        } else if (t.creditsDelta < 0) {
          entry.pendingCreditsUsed += Math.abs(t.creditsDelta);
        }
        entry.pendingUsdVolume += t.usdAmount;
      }
    }

    const customers: LedgerCustomerSummary[] = Array.from(customerMap.values())
      .map(({ _projectKeys, ...c }) => {
        const netSettledRemaining = Math.max(0, c.settledCreditsAllocated - c.settledCreditsUsed);
        const effectiveWalletBalance = Math.max(c.walletBalance, netSettledRemaining);
        const effectiveWalletPurchased = Math.max(
          c.walletPurchased,
          Math.max(0, effectiveWalletBalance - c.walletPromo)
        );
        return {
          ...c,
          walletBalance: effectiveWalletBalance,
          walletPurchased: effectiveWalletPurchased,
          projectCount: _projectKeys.size,
        };
      })
      .sort((a, b) => b.transactionCount - a.transactionCount || a.clientName.localeCompare(b.clientName));

    // Apply optional query filters
    let filtered = allTransactions;
    if (customerParam && customerParam !== 'all') {
      filtered = filtered.filter((t) => t.clientEmail.toLowerCase().trim() === customerParam);
    }
    if (typeParam && typeParam !== 'all') {
      if (typeParam === 'shared_promo') {
        filtered = filtered.filter((t) => Boolean(t.sharedPromo));
      } else {
        filtered = filtered.filter((t) => t.type === typeParam);
      }
    }
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((t) => t.status === statusParam);
    }

    // Sort newest first
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const totalCount = filtered.length;
    const pageNum = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const offset = (pageNum - 1) * limit;
    const pagedTransactions = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      transactions: pagedTransactions,
      customers,
      sharedPromos,
      totalCount,
      hasMore,
      nextCursor: null,
      limit,
    });
  } catch (err: any) {
    console.error('Exception in GET /api/management/ledger:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ============================================================================
 * FUTURE USE: Manual Credit Issuing API (Commented out for future activation)
 * ============================================================================
export async function POST(req: NextRequest) {
  const { requireAdminWrite } = await import('@/lib/auth');
  const { createNotification } = await import('@/lib/notifications');

  const authRes = await requireAdminWrite();
  if (authRes instanceof NextResponse) {
    return authRes;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const rawDelta = Number(body.delta);
    const bucket = body.bucket === 'purchased' ? 'purchased' : 'promo';
    const description = String(body.description || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please select or enter a valid client email address.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rawDelta) || rawDelta === 0 || Math.abs(rawDelta) > 10000) {
      return NextResponse.json(
        { error: 'Credit amount must be a non-zero integer between -10,000 and +10,000 CR.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Find client profile by email
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json(
        { error: `No registered client account found for ${email}. The client must sign up first.` },
        { status: 404 }
      );
    }

    // Ensure client wallet row exists before posting ledger adjustment
    await admin
      .from('wallets')
      .upsert({ user_id: profile.id }, { onConflict: 'user_id', ignoreDuplicates: true });

    const refId = `HT-ADJ-${Date.now().toString(36).toUpperCase()}`;
    const idempotencyKey = `manual:${profile.id}:${Date.now()}`;
    const effectiveDesc =
      description ||
      (rawDelta > 0
        ? `Issued +${rawDelta} CR (${bucket}) by ${authRes.user.name}`
        : `Adjusted ${rawDelta} CR (${bucket}) by ${authRes.user.name}`);

    const { error: rpcErr } = await admin.rpc('ledger_post', {
      p_user: profile.id,
      p_bucket: bucket,
      p_delta: rawDelta,
      p_type: 'admin_adjustment',
      p_ref: refId,
      p_key: idempotencyKey,
      p_desc: effectiveDesc,
      p_reverses_id: null,
    });

    if (rpcErr) {
      if (rpcErr.message.includes('negative_wallet_balance_prohibited')) {
        return NextResponse.json(
          { error: 'Deduction exceeds the client’s available balance in this bucket.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    if (rawDelta > 0) {
      void createNotification({
        userId: profile.id,
        type: 'wallet_credit',
        title: `Credits added · +${rawDelta} CR`,
        email: {
          category: 'wallet_adjustment_client',
          badge: 'Studio Wallet Update',
          details: [
            ['Credits added', `+${rawDelta} Credits`],
            ['Reason', effectiveDesc],
            ['Reference', refId],
          ],
        },
        message: `${effectiveDesc}. +${rawDelta} CR have been added to your Studio Wallet.`,
        link: '/wallet',
        actionLabel: 'View Wallet',
        actionId: refId,
        entityType: 'wallet',
        entityId: refId,
      });
    } else if (rawDelta < 0) {
      void createNotification({
        userId: profile.id,
        type: 'wallet_credit',
        title: `Credits deducted · ${rawDelta} CR`,
        message: `${effectiveDesc}. ${Math.abs(rawDelta)} CR have been deducted from your Studio Wallet.`,
        link: '/wallet',
        actionLabel: 'View Wallet',
        actionId: refId,
        entityType: 'wallet',
        entityId: refId,
        email: {
          category: 'wallet_adjustment_client',
          badge: 'Studio Wallet Update',
          details: [
            ['Credits deducted', `${rawDelta} Credits`],
            ['Reason', effectiveDesc],
            ['Reference', refId],
          ],
        },
      });
    }

    return NextResponse.json({
      success: true,
      reference: refId,
      delta: rawDelta,
      clientEmail: profile.email,
    });
  } catch (err) {
    console.error('Exception in POST /api/management/ledger:', err);
    return NextResponse.json({ error: 'Failed to issue credits' }, { status: 500 });
  }
}
============================================================================ */


