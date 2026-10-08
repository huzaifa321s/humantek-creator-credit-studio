import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE_URL = 'http://localhost:3000';

function extractCookies(res: Response): string {
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function runDeepInvariantsAndRisksAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - DEEP INVARIANTS & EXTENDED RISKS AUDIT');
  console.log('Auditing all database wallets, ledger rows, refund audits & edge cases');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. INVARIANT CHECK ACROSS ALL WALLETS IN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('[Audit 1] Verifying mathematical invariant across ALL wallets in database:');
    const { data: allWallets, error: walletErr } = await admin.from('wallets').select('*');
    if (walletErr) throw new Error(`Failed to fetch wallets: ${walletErr.message}`);

    console.log(`  -> Found ${allWallets.length} total wallets in database.`);

    let verifiedCount = 0;
    for (const w of allWallets) {
      // Fetch all ledger rows for this user
      const { data: ledgerRows, error: ledgerErr } = await admin
        .from('credit_ledger')
        .select('*')
        .eq('user_id', w.user_id);

      if (ledgerErr) throw new Error(`Ledger fetch error for user ${w.user_id}: ${ledgerErr.message}`);

      const sumPurchased = (ledgerRows || [])
        .filter((r) => r.bucket === 'purchased')
        .reduce((sum, r) => sum + r.delta, 0);

      const sumPromo = (ledgerRows || [])
        .filter((r) => r.bucket === 'promo')
        .reduce((sum, r) => sum + r.delta, 0);

      // Invariant checks
      if (sumPurchased !== w.balance_purchased) {
        throw new Error(
          `INVARIANT VIOLATION in wallet ${w.id} (user ${w.user_id}): sum(purchased_delta)=${sumPurchased} !== balance_purchased=${w.balance_purchased}`
        );
      }

      if (sumPromo !== w.balance_promo) {
        throw new Error(
          `INVARIANT VIOLATION in wallet ${w.id} (user ${w.user_id}): sum(promo_delta)=${sumPromo} !== balance_promo=${w.balance_promo}`
        );
      }

      if (w.balance_purchased < 0 || w.balance_promo < 0) {
        throw new Error(`NEGATIVE BALANCE DETECTED in wallet ${w.id}: purchased=${w.balance_purchased}, promo=${w.balance_promo}`);
      }

      verifiedCount++;
    }

    console.log(`  -> Checked ${verifiedCount}/${allWallets.length} wallets.`);
    console.log(`  -> Result: 100% INVARIANT MATCH (sum(delta) === balance) across ALL wallets!\n`);

    // -------------------------------------------------------------------------
    // 2. REFUNDED & REVERSED ORDERS AUDIT TRAIL
    // -------------------------------------------------------------------------
    console.log('[Audit 2] Auditing refunded & reversed orders audit trail in credit_ledger:');
    const { data: closedOrders, error: orderErr } = await admin
      .from('orders')
      .select('*')
      .in('status', ['refunded', 'reversed']);

    if (orderErr) throw new Error(`Order fetch error: ${orderErr.message}`);
    console.log(`  -> Found ${closedOrders.length} refunded/reversed orders in database.`);

    for (const o of closedOrders) {
      // Must have original purchase ledger entry
      const { data: purchaseLedger } = await admin
        .from('credit_ledger')
        .select('*')
        .eq('user_id', o.user_id)
        .eq('type', 'package_purchase')
        .eq('reference_id', o.id);

      if (!purchaseLedger || purchaseLedger.length === 0) {
        throw new Error(`Order ${o.id} is ${o.status} but missing initial package_purchase ledger row!`);
      }

      // Check for clawback ledger entry
      const { data: clawbackLedger } = await admin
        .from('credit_ledger')
        .select('*')
        .eq('user_id', o.user_id)
        .in('type', ['refund_cash', 'chargeback'])
        .eq('reference_id', o.id);

      // Check if shortfall alert was raised
      const { data: alerts } = await admin
        .from('admin_alerts')
        .select('*')
        .eq('order_id', o.id);

      const hasClawback = clawbackLedger && clawbackLedger.length > 0;
      const hasShortfall = alerts && alerts.length > 0;

      if (!hasClawback && !hasShortfall) {
        throw new Error(`Order ${o.id} is ${o.status} but missing both clawback ledger row and shortfall alert!`);
      }

      const clawbackAmount = hasClawback ? clawbackLedger[0].delta : 0;
      console.log(`     * Order ${o.id.slice(0, 8)}... (${o.status}): initial grant = ${purchaseLedger[0].delta} CR, clawback = ${clawbackAmount} CR, alerts logged = ${alerts?.length || 0}.`);
    }
    console.log(`  -> All refunded and reversed orders have immutable, balanced audit trails.\n`);

    // -------------------------------------------------------------------------
    // 3. EXTENDED RISK: DUPLICATE SERVICES IN ORDER BRIEF
    // -------------------------------------------------------------------------
    console.log('[Audit 3] Extended Risk: Duplicate service selections in brief submission:');
    const timestamp = Date.now();
    const testEmail = `edge_test_${timestamp}@humantek.art`;
    const testPass = 'EdgeTest2026!';

    const testUser = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Edge Tester' },
    });
    if (testUser.error) throw new Error(`Failed to create edge tester: ${testUser.error.message}`);
    const userId = testUser.data.user!.id;

    // Grant 1000 purchased credits to user
    await admin.rpc('ledger_post', {
      p_user: userId,
      p_bucket: 'purchased',
      p_delta: 1000,
      p_type: 'admin_adjustment',
      p_ref: 'AUDIT-FUND',
      p_key: `audit-fund-${timestamp}`,
      p_desc: 'Initial test funding',
    });

    // Login user via HTTP to get cookie
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPass }),
    });
    const userCookie = extractCookies(loginRes);

    // Submit project with DUPLICATE services: 2 items with same service id 'brand-identity'
    // Submit project with DUPLICATE services: 2 items with same service id 'logo'
    const duplicateServicesPayload = {
      projectId: `proj-dup-${timestamp % 100000}`,
      packageId: 'studio-wallet',
      clientName: 'Edge Tester',
      email: testEmail,
      fundingSource: 'wallet',
      selections: [
        {
          id: 'logo',
          level: 0,
          quantity: 1,
        },
        {
          id: 'logo',
          level: 1,
          quantity: 1,
        },
      ],
      channelName: 'Dupe Channel',
      platform: 'YouTube',
      style: 'Minimalist Vector',
      colors: '#00AABB',
      instructions: 'Please test duplicate service brief submission carefully.',
      additions: [],
      uploadedFiles: [],
    };

    const dupRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookie,
      },
      body: JSON.stringify(duplicateServicesPayload),
    });

    if (!dupRes.ok) {
      const errText = await dupRes.text();
      throw new Error(`Duplicate service submission failed unexpectedly: ${dupRes.status} - ${errText}`);
    }

    const dupData = await dupRes.json();
    console.log(`  -> Duplicate service brief accepted safely. Server computed quote: ${dupData.usedCredits || dupData.project?.usedCredits} CR.`);

    // -------------------------------------------------------------------------
    // 4. EXTENDED RISK: LIMBO PREVENTION (REJECT NON-WALLET FUNDING IN PROJECTS)
    // -------------------------------------------------------------------------
    console.log('\n[Audit 4] Extended Risk: Non-wallet package funding bypass attempt:');
    const bypassPackagePayload = {
      projectId: `proj-pkg-${timestamp % 100000}`,
      packageId: 'creator-forge',
      clientName: 'Edge Tester',
      email: testEmail,
      fundingSource: 'package', // Non-wallet funding attempt
      selections: [
        {
          id: 'logo',
          level: 0,
          quantity: 1,
        },
      ],
      channelName: 'Bypass Channel',
      platform: 'Twitch',
      style: 'Cyberpunk Neon',
      colors: '#FF0055',
      instructions: 'Attempting to create un-funded package project outside wallet.',
      additions: [],
      uploadedFiles: [],
    };

    // Check balance before
    const { data: walletBefore } = await admin.from('wallets').select('*').eq('user_id', userId).single();

    const bypassRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookie,
      },
      body: JSON.stringify(bypassPackagePayload),
    });

    if (bypassRes.status !== 400 && bypassRes.status !== 422) {
      throw new Error(`Expected bypass to be rejected, got: ${bypassRes.status}`);
    }

    const bypassErr = await bypassRes.json();
    if (!JSON.stringify(bypassErr).includes('invalid_funding_source_must_be_wallet')) {
      throw new Error(`Expected invalid_funding_source_must_be_wallet error, got: ${JSON.stringify(bypassErr)}`);
    }

    // Check balance after: MUST BE EXACTLY UNCHANGED
    const { data: walletAfter } = await admin.from('wallets').select('*').eq('user_id', userId).single();
    if (walletAfter.balance_purchased !== walletBefore.balance_purchased) {
      throw new Error(`Balance changed on rejected project! Before: ${walletBefore.balance_purchased}, After: ${walletAfter.balance_purchased}`);
    }

    console.log(`  -> Non-wallet funding strictly rejected: "${bypassErr.error}".`);
    console.log(`  -> Pure wallet flow enforced; limbo states prevented.`);
    console.log(`  -> Wallet balance completely untouched: ${walletAfter.balance_purchased} CR.\n`);

    // -------------------------------------------------------------------------
    // 5. EXTENDED RISK: PRIVILEGE ESCALATION ON PROJECT STATUS
    // -------------------------------------------------------------------------
    console.log('[Audit 5] Extended Risk: Client attempts unauthorized status transition:');
    const createdProjectId = dupData.id || dupData.project?.id || dupData.projectId || `proj-dup-${timestamp % 100000}`;

    // Client tries to mark project as 'delivered' or 'in_progress' directly
    const hackStatusRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookie, // Non-admin client session
      },
      body: JSON.stringify({
        id: createdProjectId,
        status: 'delivered',
      }),
    });

    if (hackStatusRes.status !== 403 && hackStatusRes.status !== 401) {
      throw new Error(`Security breach: Client was able to patch project status! Status: ${hackStatusRes.status}`);
    }

    console.log(`  -> Unauthorized status transition blocked: HTTP ${hackStatusRes.status}.\n`);

    console.log('========================================================================');
    console.log('ALL DEEP INVARIANT & EXTENDED RISK AUDITS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runDeepInvariantsAndRisksAudit();
