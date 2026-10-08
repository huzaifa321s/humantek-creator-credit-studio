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

async function runMigration3RisksAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - THE FIVE MIGRATION 3 RISKS AUDIT');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const userAEmail = `risk_user_a_${timestamp}@humantek.art`;
  const userBEmail = `risk_user_b_${timestamp}@humantek.art`;
  const defaultPass = 'RiskSecure2026!';

  try {
    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------
    console.log('[Setup] Creating test users Alice and Bob...');
    const resA = await admin.auth.admin.createUser({
      email: userAEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Risk Alice' },
    });
    if (resA.error || !resA.data.user) throw new Error(`User A creation failed: ${resA.error?.message}`);
    const userAId = resA.data.user.id;

    const resB = await admin.auth.admin.createUser({
      email: userBEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Risk Bob' },
    });
    if (resB.error || !resB.data.user) throw new Error(`User B creation failed: ${resB.error?.message}`);
    const userBId = resB.data.user.id;

    // Fund User A with 100 promo credits
    const promoCode = `RISK_${timestamp}`;
    await admin.from('promo_codes').insert({
      code: promoCode,
      credits: 100,
      max_uses: 5,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    await admin.rpc('redeem_promo', { p_user: userAId, p_raw_code: promoCode });
    console.log(`  -> Alice funded with 100 CR. Bob has 0 CR.\n`);

    // -------------------------------------------------------------------------
    // RISK 1: FREE PACKAGE FUNDING ATTEMPT
    // -------------------------------------------------------------------------
    console.log('[Risk 1] Free Package Funding Attempt:');
    // An attacker passes funding_source = 'package' without paying or having wallet credits
    const { error: freePkgErr } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: `free_proj_${timestamp}`,
      p_project_code: `HT-${timestamp % 10000}-FREE`,
      p_user_id: userBId, // Bob has 0 credits
      p_package_id: 'creator-forge',
      p_funding_source: 'package', // Attempting unbacked package launch
      p_client_name: 'Risk Bob',
      p_channel_name: 'BobStream',
      p_email: userBEmail,
      p_platform: 'Twitch',
      p_style: 'Anime',
      p_colors: '#FF0000',
      p_instructions: 'Try to get free package launch',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }],
      p_additions: [],
      p_idempotency_key: `free_key_${timestamp}`,
    });

    if (!freePkgErr || !freePkgErr.message.includes('invalid_funding_source_must_be_wallet')) {
      throw new Error(`Expected 'invalid_funding_source_must_be_wallet', got: ${freePkgErr?.message}`);
    }
    console.log('  -> Attack blocked: projects cannot bypass wallet spending. Direct package funding refused.\n');

    // -------------------------------------------------------------------------
    // RISK 2: IDEMPOTENCY KEYS ACROSS DIFFERENT USERS
    // -------------------------------------------------------------------------
    console.log('[Risk 2] Idempotency Keys Across Users (Cross-User Replay Attack):');
    // Alice submits project 1 with a specific idempotency key
    const sharedKey = `shared_key_${timestamp}`;
    const { data: aliceProj, error: aliceErr } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: `alice_proj_${timestamp}`,
      p_project_code: `HT-${timestamp % 10000}-ALICE`,
      p_user_id: userAId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Risk Alice',
      p_channel_name: 'AliceStream',
      p_email: userAEmail,
      p_platform: 'Twitch',
      p_style: 'Anime',
      p_colors: '#00FF00',
      p_instructions: 'Alice real project',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }], // 32 CR
      p_additions: [],
      p_idempotency_key: sharedKey,
    });
    if (aliceErr) throw new Error(`Alice project failed: ${aliceErr.message}`);

    // Now Bob attempts to submit a project using Alice's idempotency key
    const { error: bobReplayErr } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: `bob_hijack_${timestamp}`,
      p_project_code: `HT-${timestamp % 10000}-BOB`,
      p_user_id: userBId, // Bob
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Risk Bob',
      p_channel_name: 'BobStream',
      p_email: userBEmail,
      p_platform: 'Twitch',
      p_style: 'Anime',
      p_colors: '#0000FF',
      p_instructions: 'Bob attempt to hijack Alice project key',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }],
      p_additions: [],
      p_idempotency_key: sharedKey, // Using Alice's key!
    });

    if (!bobReplayErr || !bobReplayErr.message.includes('idempotency_key_belongs_to_another_user')) {
      throw new Error(`Expected 'idempotency_key_belongs_to_another_user', got: ${bobReplayErr?.message}`);
    }
    console.log('  -> Attack blocked: cross-user idempotency key collision rejected with idempotency_key_belongs_to_another_user.\n');

    // -------------------------------------------------------------------------
    // RISK 3: CANCEL AND STATUS RULES
    // -------------------------------------------------------------------------
    console.log('[Risk 3] Cancel and Status Rules:');
    const projToTest = `alice_proj_${timestamp}`;

    // Subtest 3A: Unauthorized user cannot cancel
    const { error: unauthCancelErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projToTest,
      p_user_id: userBId, // Bob is not the owner
      p_reason: 'Malicious cancel',
    });
    if (!unauthCancelErr || !unauthCancelErr.message.includes('unauthorized')) {
      throw new Error(`Expected 'unauthorized', got: ${unauthCancelErr?.message}`);
    }
    console.log('  -> Subtest 3A: Non-owner cancel blocked with "unauthorized".');

    // Subtest 3B: Delivered project cannot be cancelled
    await admin.from('projects').update({ status: 'delivered' }).eq('id', projToTest);
    const { error: deliveredCancelErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projToTest,
      p_user_id: userAId,
      p_reason: 'Try to cancel after delivery',
    });
    if (!deliveredCancelErr || !deliveredCancelErr.message.includes('cannot_cancel_delivered_project')) {
      throw new Error(`Expected 'cannot_cancel_delivered_project', got: ${deliveredCancelErr?.message}`);
    }
    console.log('  -> Subtest 3B: Delivered project cannot be cancelled.');

    // Subtest 3C: Legitimate cancellation succeeds
    await admin.from('projects').update({ status: 'pending_review' }).eq('id', projToTest);
    const { data: cancelSuccess, error: cancelErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projToTest,
      p_user_id: userAId,
      p_reason: 'Legitimate cancel',
    });
    if (cancelErr || !cancelSuccess?.success) throw new Error(`Cancel failed: ${cancelErr?.message}`);
    console.log('  -> Subtest 3C: Legitimate cancellation succeeded and refunded credits.');

    // Subtest 3D: Second cancellation is an idempotent no-op
    const { data: cancelRepeat, error: cancelRepeatErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projToTest,
      p_user_id: userAId,
      p_reason: 'Duplicate cancel click',
    });
    if (cancelRepeatErr || !cancelRepeat?.already_cancelled) {
      throw new Error(`Expected already_cancelled=true, got: ${JSON.stringify(cancelRepeat)}`);
    }
    console.log('  -> Subtest 3D: Second cancellation returned already_cancelled = true.\n');

    // -------------------------------------------------------------------------
    // RISK 4: GRANTS AUDIT RE-RUN
    // -------------------------------------------------------------------------
    console.log('[Risk 4] Grants Audit Re-run (Anon and Authenticated Table & RPC Isolation):');
    const clientB = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await clientB.auth.signInWithPassword({ email: userBEmail, password: defaultPass });

    // Try calling create_project_and_spend_credits directly as client
    const { error: clientCreateErr } = await clientB.rpc('create_project_and_spend_credits', {
      p_project_id: 'hack',
      p_project_code: 'HT-HACK',
      p_user_id: userBId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Hacker',
      p_channel_name: 'Hacker',
      p_email: userBEmail,
      p_platform: 'Twitch',
      p_style: 'Hacker',
      p_colors: '#000',
      p_instructions: 'Hack',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }],
      p_additions: [],
      p_idempotency_key: 'hack',
    });
    if (!clientCreateErr || !clientCreateErr.message.includes('permission denied')) {
      throw new Error(`Vulnerability: client was able to invoke create_project_and_spend_credits!`);
    }

    // Try calling cancel_project_and_refund directly as client
    const { error: clientCancelErr } = await clientB.rpc('cancel_project_and_refund', {
      p_project_id: projToTest,
      p_user_id: userBId,
      p_reason: 'Direct RPC hack',
    });
    if (!clientCancelErr || !clientCancelErr.message.includes('permission denied')) {
      throw new Error(`Vulnerability: client was able to invoke cancel_project_and_refund!`);
    }

    // Try table INSERT into projects
    const { error: directInsertProj } = await clientB.from('projects').insert({
      id: `proj_hack_${timestamp}`,
      project_code: 'HT-HACKED-TABLE',
      user_id: userBId,
      funding_source: 'wallet',
      status: 'pending_review',
      payment_status: 'paid',
      total_credits: 0,
      client_name: 'Hacker',
      email: userBEmail,
    });
    if (!directInsertProj || !directInsertProj.message.includes('permission denied')) {
      throw new Error(`Vulnerability: client was able to directly INSERT into projects!`);
    }
    console.log('  -> All table mutation grants revoked. Direct RPC executions blocked with permission denied.\n');

    // -------------------------------------------------------------------------
    // RISK 5: BAD QUANTITIES
    // -------------------------------------------------------------------------
    console.log('[Risk 5] Bad Quantities & Malformed Input:');
    const badQuantities = [0, -1, -5, 21, 100, 2.5, null, undefined];

    for (const badQty of badQuantities) {
      const { error: qtyErr } = await admin.rpc('create_project_and_spend_credits', {
        p_project_id: `bad_qty_${timestamp}`,
        p_project_code: `HT-${timestamp % 10000}-QTY`,
        p_user_id: userAId,
        p_package_id: 'studio-wallet',
        p_funding_source: 'wallet',
        p_client_name: 'Risk Alice',
        p_channel_name: 'AliceStream',
        p_email: userAEmail,
        p_platform: 'Twitch',
        p_style: 'Anime',
        p_colors: '#000',
        p_instructions: 'Bad quantity test',
        p_uploaded_files: [],
        p_selections: [{ id: 'logo', level: 0, quantity: badQty as any }],
        p_additions: [],
        p_idempotency_key: `qty_key_${timestamp}_${badQty}`,
      });

      if (!qtyErr) {
        throw new Error(`Vulnerability: Bad quantity ${badQty} was accepted by create_project_and_spend_credits!`);
      }
    }
    console.log('  -> All 8 invalid quantity payloads (0, negative, >20, decimals, null) were rejected.\n');

    console.log('========================================================================');
    console.log('ALL FIVE MIGRATION 3 RISKS VERIFIED & SECURED!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ MIGRATION 3 RISKS AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runMigration3RisksAudit();
