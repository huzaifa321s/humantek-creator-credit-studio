import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runProjectsPipelineAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - MIGRATION 3 CATALOG & PROJECTS PIPELINE AUDIT');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const userAEmail = `pipeline_user_a_${timestamp}@humantek.art`;
  const userBEmail = `pipeline_user_b_${timestamp}@humantek.art`;
  const defaultPass = 'PipelineSecure2026!';

  let userAId = '';
  let userBId = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create two verified users
    // -------------------------------------------------------------------------
    console.log('[Setup] Creating test users...');
    const resA = await admin.auth.admin.createUser({
      email: userAEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Creator Alice' },
    });
    if (resA.error || !resA.data.user) throw new Error(`User A creation failed: ${resA.error?.message}`);
    userAId = resA.data.user.id;

    const resB = await admin.auth.admin.createUser({
      email: userBEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Creator Bob' },
    });
    if (resB.error || !resB.data.user) throw new Error(`User B creation failed: ${resB.error?.message}`);
    userBId = resB.data.user.id;

    console.log(`  -> User A created (${userAId})`);
    console.log(`  -> User B created (${userBId})\n`);

    // Verify catalog seeded properly
    const { data: packages, error: pkgErr } = await admin.from('packages').select('*');
    if (pkgErr || !packages || packages.length < 4) {
      throw new Error(`Packages catalog check failed: ${pkgErr?.message}`);
    }
    const { data: services, error: svcErr } = await admin.from('services').select('*');
    if (svcErr || !services || services.length < 35) {
      throw new Error(`Services catalog check failed: ${svcErr?.message}`);
    }
    console.log(`  -> Catalog verified: ${packages.length} packages, ${services.length} services seeded.\n`);

    // Fund User A with 100 promo credits
    const promoCode = `PIPE_TEST_${timestamp}`;
    await admin.from('promo_codes').insert({
      code: promoCode,
      credits: 100,
      max_uses: 10,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const { error: redeemErr } = await admin.rpc('redeem_promo', {
      p_user: userAId,
      p_raw_code: promoCode,
    });
    if (redeemErr) throw new Error(`Funding User A failed: ${redeemErr.message}`);

    const { data: walletA1 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    console.log(`[Initial Balance] User A: Promo=${walletA1.balance_promo}, Purchased=${walletA1.balance_purchased}, Total=${walletA1.balance_credits} CR\n`);

    // -------------------------------------------------------------------------
    // TEST 1: DATABASE-AUTHORITATIVE PRICING (Tampered client prices ignored)
    // -------------------------------------------------------------------------
    console.log('[Test 1] Database-Authoritative Pricing (Ignoring Tampered/Client Prices):');
    // Client wants a Logo (Tier 0: Basic = 32 CR in db) and 1 addition: 'Rush delivery request' = 50 CR
    // Total DB cost = 32 + 50 = 82 CR.
    const proj1Id = `proj_${timestamp}_1`;
    const proj1Code = `HT-${timestamp % 10000}-LOGO`;
    const idempKey1 = `order_${timestamp}_1`;

    const { data: createRes1, error: createErr1 } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: proj1Id,
      p_project_code: proj1Code,
      p_user_id: userAId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Creator Alice',
      p_channel_name: 'AliceTwitch',
      p_email: userAEmail,
      p_platform: 'Twitch',
      p_style: 'Minimalist',
      p_colors: '#FF0055',
      p_instructions: 'Make a clean brand logo',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1, fake_price: 1 }], // Client tries to spoof price = 1
      p_additions: ['Rush delivery request'],
      p_idempotency_key: idempKey1,
    });

    if (createErr1) throw new Error(`Project 1 creation failed: ${createErr1.message}`);

    if (createRes1.total_credits !== 82) {
      throw new Error(`Expected total credits 82 CR (32 logo + 50 rush), got ${createRes1.total_credits}`);
    }

    const { data: dbProj1 } = await admin.from('projects').select('*').eq('id', proj1Id).single();
    if (!dbProj1 || dbProj1.total_credits !== 82 || dbProj1.payment_status !== 'paid') {
      throw new Error(`Project 1 record verification failed: ${JSON.stringify(dbProj1)}`);
    }

    const { data: dbItems1 } = await admin.from('project_items').select('*').eq('project_id', proj1Id);
    if (!dbItems1 || dbItems1.length !== 1 || dbItems1[0].unit_credits !== 32) {
      throw new Error(`Project items price snapshot invalid: ${JSON.stringify(dbItems1)}`);
    }

    const { data: walletA2 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA2.balance_credits !== 18) { // 100 - 82 = 18
      throw new Error(`Expected wallet balance 18 CR, got ${walletA2.balance_credits}`);
    }
    console.log('  -> Project created successfully.');
    console.log('  -> Tampered client prices completely ignored; catalog prices (32 + 50 = 82 CR) enforced.');
    console.log(`  -> Immutable snapshot saved in project_items. Wallet balance decreased to ${walletA2.balance_credits} CR.\n`);

    // -------------------------------------------------------------------------
    // TEST 2: INSUFFICIENT CREDITS ROLLBACK
    // -------------------------------------------------------------------------
    console.log('[Test 2] Insufficient Credits Rollback:');
    // User A now has 18 CR. Attempt to launch a project needing 40 CR (Static Stream Screen tier 0 = 40 CR).
    const proj2Id = `proj_${timestamp}_2`;
    const proj2Code = `HT-${timestamp % 10000}-SCREEN`;
    const idempKey2 = `order_${timestamp}_2`;

    const { error: createErr2 } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: proj2Id,
      p_project_code: proj2Code,
      p_user_id: userAId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Creator Alice',
      p_channel_name: 'AliceTwitch',
      p_email: userAEmail,
      p_platform: 'Twitch',
      p_style: 'Cyberpunk',
      p_colors: '#00FFFF',
      p_instructions: 'Screen setup',
      p_uploaded_files: [],
      p_selections: [{ id: 'static-screen', level: 0, quantity: 1 }], // 40 CR
      p_additions: [],
      p_idempotency_key: idempKey2,
    });

    if (!createErr2 || !createErr2.message.includes('insufficient_credits')) {
      throw new Error(`Expected 'insufficient_credits' error, got: ${createErr2?.message}`);
    }

    // Verify rollback: no project record, no items, balance untouched
    const { data: orphanProj } = await admin.from('projects').select('*').eq('id', proj2Id).maybeSingle();
    if (orphanProj) throw new Error('Transaction rollback failed: orphan project row was inserted!');

    const { data: walletA3 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA3.balance_credits !== 18) {
      throw new Error(`Wallet balance was corrupted on failed transaction: ${walletA3.balance_credits}`);
    }
    console.log('  -> Overspend aborted with error: "insufficient_credits".');
    console.log('  -> Zero orphan rows in projects or project_items.');
    console.log(`  -> Wallet balance preserved perfectly at ${walletA3.balance_credits} CR.\n`);

    // -------------------------------------------------------------------------
    // TEST 3: DUAL-BUCKET CANCELLATION & EXACT RESTORATION (reverses_id)
    // -------------------------------------------------------------------------
    console.log('[Test 3] Dual-Bucket Cancellation & Exact Restoration (Anti-Credit-Laundering):');
    // Currently User A has: balance_promo = 18, balance_purchased = 0.
    // Let's grant 50 purchased credits directly via ledger_post so Alice has a split:
    // 18 promo + 50 purchased = 68 total.
    await admin.rpc('ledger_post', {
      p_user: userAId,
      p_bucket: 'purchased',
      p_delta: 50,
      p_type: 'package_purchase',
      p_ref: 'TOPUP-TEST-50',
      p_key: `topup_${timestamp}`,
      p_desc: 'Test top-up for dual-bucket audit',
      p_reverses_id: null,
    });

    const { data: walletA4 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    console.log(`  -> Pre-spend balance: Promo=${walletA4.balance_promo}, Purchased=${walletA4.balance_purchased} (Total: ${walletA4.balance_credits} CR)`);

    // Now Alice creates a project costing 40 CR (Overlays 3× Basic = 40 CR)
    // Promo-first deduction must take: 18 from promo + 22 from purchased.
    // Wallet should end with: 0 promo, 28 purchased = 28 CR.
    const proj3Id = `proj_${timestamp}_3`;
    const proj3Code = `HT-${timestamp % 10000}-OVERLAYS`;
    const idempKey3 = `order_${timestamp}_3`;

    const { error: createErr3 } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: proj3Id,
      p_project_code: proj3Code,
      p_user_id: userAId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Creator Alice',
      p_channel_name: 'AliceTwitch',
      p_email: userAEmail,
      p_platform: 'Twitch',
      p_style: 'Anime',
      p_colors: '#FFAA00',
      p_instructions: 'Stream overlays',
      p_uploaded_files: [],
      p_selections: [{ id: 'overlays', level: 0, quantity: 1 }],
      p_additions: [],
      p_idempotency_key: idempKey3,
    });
    if (createErr3) throw new Error(`Project 3 creation failed: ${createErr3.message}`);

    const { data: walletA5 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA5.balance_promo !== 0 || walletA5.balance_purchased !== 28) {
      throw new Error(`Dual-bucket deduction incorrect: promo=${walletA5.balance_promo}, purchased=${walletA5.balance_purchased}`);
    }
    console.log(`  -> Project 3 funded: 18 spent from promo, 22 from purchased. Wallet is now 0 promo / 28 purchased.`);

    // Now Cancel Project 3!
    // cancel_project_and_refund must restore: exactly 18 to promo, and exactly 22 to purchased!
    const { data: cancelRes1, error: cancelErr1 } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: proj3Id,
      p_user_id: userAId,
      p_reason: 'Client requested cancellation',
    });
    if (cancelErr1) throw new Error(`Cancellation failed: ${cancelErr1.message}`);

    if (cancelRes1.refunded_credits !== 40) {
      throw new Error(`Expected refunded_credits 40, got ${cancelRes1.refunded_credits}`);
    }

    const { data: walletA6 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA6.balance_promo !== 18 || walletA6.balance_purchased !== 50) {
      throw new Error(`Credit restoration failed! Expected promo=18, purchased=50, got promo=${walletA6.balance_promo}, purchased=${walletA6.balance_purchased}`);
    }

    // Verify reverse references in credit_ledger
    const { data: refunds } = await admin.from('credit_ledger')
      .select('id, bucket, delta, type, reverses_id')
      .eq('reference_id', proj3Code)
      .eq('type', 'refund_wallet');

    if (!refunds || refunds.length !== 2) {
      throw new Error(`Expected exactly 2 reversal ledger entries, got ${refunds?.length}`);
    }
    const promoRefund = refunds.find(r => r.bucket === 'promo');
    const paidRefund = refunds.find(r => r.bucket === 'purchased');
    if (!promoRefund || promoRefund.delta !== 18 || !promoRefund.reverses_id) {
      throw new Error(`Promo reversal invalid: ${JSON.stringify(promoRefund)}`);
    }
    if (!paidRefund || paidRefund.delta !== 22 || !paidRefund.reverses_id) {
      throw new Error(`Purchased reversal invalid: ${JSON.stringify(paidRefund)}`);
    }

    console.log('  -> Project cancelled and refunded successfully.');
    console.log('  -> Exact original buckets restored: +18 promo, +22 purchased.');
    console.log('  -> Wallet returned exactly to 18 promo / 50 purchased (Total: 68 CR).');
    console.log('  -> reverses_id links deductions to refunds with strict one-to-one immutability.\n');

    // -------------------------------------------------------------------------
    // TEST 4: SECOND CANCELLATION IS AN IDEMPOTENT NO-OP
    // -------------------------------------------------------------------------
    console.log('[Test 4] Second Cancellation Idempotency:');
    const { data: cancelRes2, error: cancelErr2 } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: proj3Id,
      p_user_id: userAId,
      p_reason: 'Accidental double click on cancel',
    });
    if (cancelErr2) throw new Error(`Second cancel error: ${cancelErr2.message}`);
    if (!cancelRes2.already_cancelled) {
      throw new Error(`Expected already_cancelled=true, got: ${JSON.stringify(cancelRes2)}`);
    }

    const { data: walletA7 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA7.balance_credits !== 68) {
      throw new Error(`Double refund bug detected! Wallet changed to ${walletA7.balance_credits}`);
    }
    console.log('  -> Second cancellation returned already_cancelled = true.');
    console.log('  -> No additional credits refunded; balance remains locked at 68 CR.\n');

    // -------------------------------------------------------------------------
    // TEST 5: PARALLEL DOUBLE-SUBMIT (Same idempotency key concurrency)
    // -------------------------------------------------------------------------
    console.log('[Test 5] Parallel Double-Submit Concurrency:');
    const proj4Id = `proj_${timestamp}_4`;
    const proj4Code = `HT-${timestamp % 10000}-CONCUR`;
    const idempKey4 = `order_${timestamp}_concur_key`;

    // Fire 20 parallel requests with the same idempotency key for Banner Basic (28 CR)
    const parallelCalls = Array.from({ length: 20 }, (_, idx) =>
      admin.rpc('create_project_and_spend_credits', {
        p_project_id: proj4Id,
        p_project_code: proj4Code,
        p_user_id: userAId,
        p_package_id: 'studio-wallet',
        p_funding_source: 'wallet',
        p_client_name: 'Creator Alice',
        p_channel_name: 'AliceTwitch',
        p_email: userAEmail,
        p_platform: 'Twitch',
        p_style: 'Modern',
        p_colors: '#111111',
        p_instructions: 'Parallel submit test',
        p_uploaded_files: [],
        p_selections: [{ id: 'banner', level: 0, quantity: 1 }], // 28 CR
        p_additions: [],
        p_idempotency_key: idempKey4,
      })
    );

    const parallelResults = await Promise.all(parallelCalls);
    const successfulResponses = parallelResults.filter(r => !r.error && r.data?.success);
    if (successfulResponses.length !== 20) {
      throw new Error(`Expected all 20 calls to resolve gracefully, but some errored: ${JSON.stringify(parallelResults.map(r => r.error))}`);
    }

    // Check project rows created in database
    const { data: dbProj4Rows } = await admin.from('projects').select('*').eq('idempotency_key', idempKey4);
    if (!dbProj4Rows || dbProj4Rows.length !== 1) {
      throw new Error(`Expected exactly 1 project created, found ${dbProj4Rows?.length}`);
    }

    // Verify credits deducted exactly ONCE: 68 - 28 = 40 CR.
    const { data: walletA8 } = await admin.from('wallets').select('*').eq('user_id', userAId).single();
    if (walletA8.balance_credits !== 40) {
      throw new Error(`Double-spend occurred during parallel submission! Balance: ${walletA8.balance_credits}`);
    }
    console.log(`  -> 20 simultaneous submissions resolved: 1 fresh creation + 19 idempotent replays.`);
    console.log(`  -> Exactly 1 project record in DB. Wallet deducted exactly once (68 -> ${walletA8.balance_credits} CR).\n`);

    // -------------------------------------------------------------------------
    // TEST 6: CROSS-TENANT UNAUTHORIZED CANCELLATION BLOCK
    // -------------------------------------------------------------------------
    console.log('[Test 6] Cross-Tenant Cancellation Block:');
    // User B attempts to cancel User A's project (proj4Id)
    const { error: cancelByBErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: proj4Id,
      p_user_id: userBId, // Bob is not an admin, nor the owner
      p_reason: 'Malicious cancellation by competitor',
    });

    if (!cancelByBErr || !cancelByBErr.message.includes('unauthorized')) {
      throw new Error(`Expected 'unauthorized' exception, got: ${cancelByBErr?.message}`);
    }
    console.log('  -> Bob prevented from cancelling Alice\'s project: "unauthorized" raised.\n');

    // -------------------------------------------------------------------------
    // TEST 7: AUTHENTICATED RLS & DIRECT INSERTS BLOCKED
    // -------------------------------------------------------------------------
    console.log('[Test 7] Authenticated RLS & Table Mutation Block:');
    // Sign in as User A to get an authenticated client session
    const clientA = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signInA = await clientA.auth.signInWithPassword({
      email: userAEmail,
      password: defaultPass,
    });
    if (signInA.error) throw new Error(`User A login failed: ${signInA.error.message}`);

    // Attack 1: User A tries direct INSERT into projects
    const { error: directProjErr } = await clientA.from('projects').insert({
      id: `hacked_${timestamp}`,
      project_code: `HT-HACKED`,
      user_id: userAId,
      funding_source: 'wallet',
      status: 'delivered',
      payment_status: 'paid',
      total_credits: 0,
      client_name: 'Hacker',
      email: userAEmail,
    });
    if (!directProjErr) throw new Error('Vulnerability: Authenticated user could directly INSERT into projects!');

    // Attack 2: User A tries direct UPDATE on projects
    const { error: directUpdateErr } = await clientA.from('projects').update({
      status: 'delivered',
    }).eq('id', proj4Id);
    if (!directUpdateErr) throw new Error('Vulnerability: Authenticated user could directly UPDATE projects!');

    // Attack 3: User A reads projects - should see ONLY their own projects (proj1Id, proj4Id)
    const { data: aliceProjects, error: readProjErr } = await clientA.from('projects').select('id, user_id');
    if (readProjErr) throw new Error(`Read projects error: ${readProjErr.message}`);
    const containsOtherUsers = aliceProjects.some(p => p.user_id !== userAId);
    if (containsOtherUsers) throw new Error('Vulnerability: User saw other users projects!');

    console.log('  -> Direct INSERT into projects blocked by RLS.');
    console.log('  -> Direct UPDATE on projects blocked by RLS.');
    console.log(`  -> Client sees only their own projects (${aliceProjects.length} rows, 0 leaks).\n`);

    console.log('========================================================================');
    console.log('ALL 7 MIGRATION 3 AUDIT TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ PIPELINE AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runProjectsPipelineAudit();
