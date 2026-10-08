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

async function runManualPaymentAndStatusAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - MANUAL PAYMENT & STATUS STATE MACHINE AUDIT');
  console.log('Testing manual provider, admin confirmation RPC, and status audit trail');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const clientEmail = `manual_client_${timestamp}@humantek.art`;
  const adminEmail = `admin_tester_${timestamp}@humantek.art`;
  const pass = 'AuditPass2026!';

  try {
    // 1. Provision client and admin users
    console.log('[Setup] Provisioning client and admin users...');
    const userClient = await admin.auth.admin.createUser({
      email: clientEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: 'Manual Client' },
    });
    const userAdmin = await admin.auth.admin.createUser({
      email: adminEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Tester' },
    });

    if (userClient.error || userAdmin.error) {
      throw new Error(`User provisioning error: ${userClient.error?.message || userAdmin.error?.message}`);
    }

    // Set admin role in profiles
    await admin.from('profiles').update({ role: 'admin' }).eq('id', userAdmin.data.user!.id);

    // Login client and admin via HTTP to get native cookies
    console.log('[Setup] Logging in to capture native session cookies...');
    const clientLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clientEmail, password: pass }),
    });
    const clientCookie = extractCookies(clientLogin);

    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: pass }),
    });
    const adminCookie = extractCookies(adminLogin);

    console.log('  -> Sessions established.\n');

    // -------------------------------------------------------------------------
    // TEST 1: CLIENT CREATES MANUAL ORDER
    // -------------------------------------------------------------------------
    console.log('[Test 1] POST /api/orders/manual client order creation:');
    const orderRes = await fetch(`${BASE_URL}/api/orders/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientCookie,
      },
      body: JSON.stringify({
        packageId: 'creator-forge',
        idempotencyKey: `manual-order-${timestamp}`,
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(`Manual order creation failed: ${orderRes.status} - ${errText}`);
    }

    const orderData = await orderRes.json();
    console.log(`  -> Order created: ID=${orderData.orderId}, Status=${orderData.status}`);
    console.log(`  -> Payment Reference: ${orderData.instructions.referenceCode}`);
    console.log(`  -> Instructions generated: IBAN=${orderData.instructions.iban}, Bank=${orderData.instructions.bankName}`);

    // Verify order in database
    const { data: dbOrder } = await admin.from('orders').select('*').eq('id', orderData.orderId).single();
    if (dbOrder.provider !== 'manual' || dbOrder.status !== 'created' || dbOrder.credits_to_grant !== 660) {
      throw new Error(`DB order state mismatch: ${JSON.stringify(dbOrder)}`);
    }
    console.log('  -> DB Order row verified: provider="manual", status="created", credits_to_grant=660.\n');

    // -------------------------------------------------------------------------
    // TEST 2: UNAUTHORIZED CLIENT CANNOT CONFIRM PAYMENT
    // -------------------------------------------------------------------------
    console.log('[Test 2] Client attempts unauthorized payment confirmation:');
    const hackConfirm = await fetch(`${BASE_URL}/api/management/orders/confirm-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientCookie, // Non-admin client
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        bankReference: 'FAKE-WIRE-123',
        amountCents: 150000,
      }),
    });

    if (hackConfirm.status !== 403 && hackConfirm.status !== 401) {
      throw new Error(`Security breach: Client was able to access confirm-manual! Status: ${hackConfirm.status}`);
    }
    console.log(`  -> Client confirmation blocked: HTTP ${hackConfirm.status}.\n`);

    // -------------------------------------------------------------------------
    // TEST 3: AMOUNT MISMATCH REJECTION
    // -------------------------------------------------------------------------
    console.log('[Test 3] Admin confirms with amount mismatch (Underpayment):');
    const underpayConfirm = await fetch(`${BASE_URL}/api/management/orders/confirm-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie, // Admin session
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        bankReference: 'UNDERPAY-REF-1',
        amountCents: 50000, // $500 instead of $1500
      }),
    });

    if (underpayConfirm.status !== 400) {
      throw new Error(`Expected underpayment to be rejected with 400, got: ${underpayConfirm.status}`);
    }
    console.log('  -> Underpayment rejected cleanly.\n');

    // -------------------------------------------------------------------------
    // TEST 4: LEGITIMATE ADMIN CONFIRMS MANUAL PAYMENT
    // -------------------------------------------------------------------------
    console.log('[Test 4] Legitimate Admin confirms manual bank wire:');
    const validConfirm = await fetch(`${BASE_URL}/api/management/orders/confirm-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        bankReference: `WIRE-PK-MEEZAN-${timestamp}`,
        amountCents: 150000,
        notes: 'Verified via Meezan Bank business online portal',
      }),
    });

    if (!validConfirm.ok) {
      const errText = await validConfirm.text();
      throw new Error(`Valid confirmation failed: ${validConfirm.status} - ${errText}`);
    }

    const confirmData = await validConfirm.json();
    console.log(`  -> Confirmation succeeded: credits_granted=${confirmData.result.credits_granted}`);

    // Verify client wallet
    const { data: clientWallet } = await admin.from('wallets').select('*').eq('user_id', userClient.data.user!.id).single();
    if (clientWallet.balance_purchased !== 660) {
      throw new Error(`Client wallet was not credited! Balance: ${clientWallet.balance_purchased}`);
    }
    console.log(`  -> Client wallet verified: ${clientWallet.balance_purchased} purchased CR.`);

    // Verify ledger entry
    const { data: ledgerRow } = await admin
      .from('credit_ledger')
      .select('*')
      .eq('user_id', userClient.data.user!.id)
      .eq('reference_id', orderData.orderId)
      .single();

    console.log(`  -> Credit ledger row: delta=${ledgerRow.delta}, type=${ledgerRow.type}, desc="${ledgerRow.description}"`);

    // Verify admin alert
    const { data: alertRow } = await admin
      .from('admin_alerts')
      .select('*')
      .eq('order_id', orderData.orderId)
      .eq('type', 'manual_payment_confirmed')
      .single();

    console.log(`  -> Audit alert verified in admin_alerts: "${alertRow.message}"\n`);

    // -------------------------------------------------------------------------
    // TEST 5: AUDITED PROJECT STATUS STATE MACHINE
    // -------------------------------------------------------------------------
    console.log('[Test 5] Audited Project Status State Machine & History:');
    // Create a project for client funded via the newly confirmed credits
    const projId = `proj_status_test_${timestamp}`;
    await admin.rpc('create_project_and_spend_credits', {
      p_project_id: projId,
      p_project_code: `HT-${timestamp % 10000}-STATE`,
      p_user_id: userClient.data.user!.id,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Status Tester',
      p_channel_name: 'Tester',
      p_email: clientEmail,
      p_platform: 'Twitch',
      p_style: 'Minimal',
      p_colors: '#000',
      p_instructions: 'Testing status transitions and history',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }], // 40 credits
      p_additions: [],
      p_idempotency_key: `status_proj_${timestamp}`,
    });

    console.log('  -> Project created in status "pending_review".');

    // Admin transitions: pending_review -> in_production
    const patch1 = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        id: projId,
        status: 'in_production',
      }),
    });
    if (!patch1.ok) throw new Error(`Patch 1 failed: ${patch1.status} - ${await patch1.text()}`);

    // Admin transitions: in_production -> review_round
    const patch2 = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        id: projId,
        status: 'review_round',
      }),
    });
    if (!patch2.ok) throw new Error(`Patch 2 failed: ${patch2.status} - ${await patch2.text()}`);

    // Admin transitions: review_round -> delivered
    const patch3 = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        id: projId,
        status: 'delivered',
      }),
    });
    if (!patch3.ok) throw new Error(`Patch 3 failed: ${patch3.status} - ${await patch3.text()}`);

    // Verify project_status_history in database
    const { data: historyRows } = await admin
      .from('project_status_history')
      .select('*')
      .eq('project_id', projId)
      .order('created_at', { ascending: true });

    if (!historyRows || historyRows.length < 3) {
      throw new Error(`Expected at least 3 status history rows, got: ${historyRows?.length}`);
    }

    console.log(`  -> Project status history verified (${historyRows.length} audited steps):`);
    for (const h of historyRows) {
      console.log(`     * ${h.old_status} -> ${h.new_status} (at ${new Date(h.created_at).toLocaleTimeString()})`);
    }

    // Try illegal transition to non-existent status
    const illegalPatch = await fetch(`${BASE_URL}/api/projects`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        id: projId,
        status: 'totally_fake_status',
      }),
    });
    if (illegalPatch.status !== 400) {
      throw new Error(`Expected illegal status to be rejected with 400, got: ${illegalPatch.status}`);
    }
    console.log('  -> Invalid status transition rejected by state machine.\n');

    console.log('========================================================================');
    console.log('ALL MANUAL PAYMENT & STATUS STATE MACHINE AUDITS PASSED WITH 100%!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runManualPaymentAndStatusAudit();
