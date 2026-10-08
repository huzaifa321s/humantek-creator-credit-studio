// Mock server-only for standalone script execution
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as any;
} catch {}

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runWebhookRetryAndClawbackAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - WEBHOOK RETRY & PARTIAL CLAWBACK AUDIT');
  console.log('========================================================================\n');

  const { POST: webhookHandler } = await import('../src/app/api/paypal/webhook/route');

  const timestamp = Date.now();
  const testEmail = `retry_clawback_${timestamp}@humantek.art`;
  const defaultPass = 'AuditSecure2026!';

  try {
    // Setup User
    const res = await admin.auth.admin.createUser({
      email: testEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Retry Tester' },
    });
    if (res.error) throw new Error(res.error.message);
    const userId = res.data.user.id;

    // -------------------------------------------------------------------------
    // TEST 1: WEBHOOK RETRY AFTER TRANSIENT FAILURE (Bug 1 Fix Proof)
    // -------------------------------------------------------------------------
    console.log('[Test 1] Webhook Retry After Failure:');
    // Create an order for 660 credits ($1500)
    const { data: order1 } = await admin
      .from('orders')
      .insert({
        user_id: userId,
        package_id: 'creator-forge',
        credits_to_grant: 660,
        expected_amount_cents: 150000,
        currency: 'USD',
        status: 'created',
        idempotency_key: `retry_order_${timestamp}`,
        provider_order_id: `PAYPAL-ORD-RETRY-${timestamp}`,
      })
      .select('*')
      .single();

    const eventId = `WH-EVT-RETRY-${timestamp}`;

    // Step A: First delivery with corrupted amount causing a processing failure
    const failPayload = {
      id: eventId,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: `CAP-FAIL-${timestamp}`,
        custom_id: order1.id,
        amount: {
          value: '1.00', // Intentional amount mismatch causing failure
          currency_code: 'USD',
        },
      },
    };

    const req1 = new NextRequest('http://localhost:3000/api/paypal/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'paypal-transmission-sig': 'mock-sig',
        'paypal-transmission-id': 'trans-1',
      },
      body: JSON.stringify(failPayload),
    });

    const res1 = await webhookHandler(req1);
    const body1 = await res1.json();
    console.log(`  -> Delivery 1 result: status=${res1.status}, error=${body1.error}`);

    // Check webhook_events in DB: status must be 'failed'
    const { data: eventRow1 } = await admin.from('webhook_events').select('*').eq('event_id', eventId).single();
    if (!eventRow1 || eventRow1.status !== 'failed') {
      throw new Error(`Expected event status to be 'failed', got: ${eventRow1?.status}`);
    }
    console.log(`  -> Webhook event recorded with status: "failed".`);

    // Step B: PayPal retries the EXACT SAME event ID with corrected payload
    const successPayload = {
      ...failPayload,
      resource: {
        id: `CAP-SUCCESS-${timestamp}`,
        custom_id: order1.id,
        amount: {
          value: '1500.00', // Correct amount
          currency_code: 'USD',
        },
      },
    };

    // Reset order status to created so it can be fulfilled
    await admin.from('orders').update({ status: 'created' }).eq('id', order1.id);

    const req2 = new NextRequest('http://localhost:3000/api/paypal/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'paypal-transmission-sig': 'mock-sig',
        'paypal-transmission-id': 'trans-2',
      },
      body: JSON.stringify(successPayload),
    });

    const res2 = await webhookHandler(req2);
    const body2 = await res2.json();
    if (res2.status !== 200 || !body2.processed) {
      throw new Error(`Retry delivery was incorrectly rejected or dropped! status=${res2.status}, body=${JSON.stringify(body2)}`);
    }

    // Verify credits were deposited on retry
    const { data: walletAfterRetry } = await admin.from('wallets').select('*').eq('user_id', userId).single();
    if (walletAfterRetry.balance_purchased !== 660) {
      throw new Error(`Expected 660 credits after retry, got: ${walletAfterRetry.balance_purchased}`);
    }

    // Verify event in DB is now 'processed'
    const { data: eventRow2 } = await admin.from('webhook_events').select('*').eq('event_id', eventId).single();
    if (eventRow2.status !== 'processed') {
      throw new Error(`Expected event status to be 'processed', got: ${eventRow2?.status}`);
    }

    console.log(`  -> Delivery 2 (Retry of same event_id): successfully reprocessed!`);
    console.log(`  -> Credits deposited into wallet: ${walletAfterRetry.balance_purchased} CR.`);
    console.log(`  -> Webhook event status updated to "processed". Payment was not lost!\n`);

    // -------------------------------------------------------------------------
    // TEST 2: PARTIAL CLAWBACK & SHORTFALL ON SPENT CREDITS
    // -------------------------------------------------------------------------
    console.log('[Test 2] Partial Clawback & Shortfall Handling on Spent Credits:');
    // User currently has 660 purchased credits.
    // User spends 400 credits on a project (Overlays Standard = 84 * 4 = 336 + 64 etc. = 400 CR)
    // Remaining purchased balance: 260 credits.
    await admin.rpc('create_project_and_spend_credits', {
      p_project_id: `spend_proj_${timestamp}`,
      p_project_code: `HT-${timestamp % 10000}-PARTIAL`,
      p_user_id: userId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Partial Tester',
      p_channel_name: 'Tester',
      p_email: testEmail,
      p_platform: 'Twitch',
      p_style: 'Minimal',
      p_colors: '#000',
      p_instructions: 'Spend 400 credits',
      p_uploaded_files: [],
      p_selections: [
        { id: 'logo', level: 2, quantity: 2 }, // 180 * 2 = 360 CR
        { id: 'overlays', level: 0, quantity: 1 }, // 40 CR -> Total 400 CR
      ],
      p_additions: [],
      p_idempotency_key: `partial_spend_${timestamp}`,
    });

    const { data: walletPreRefund } = await admin.from('wallets').select('*').eq('user_id', userId).single();
    if (walletPreRefund.balance_purchased !== 260) {
      throw new Error(`Expected 260 remaining purchased balance, got: ${walletPreRefund.balance_purchased}`);
    }
    console.log(`  -> User spent 400 CR. Remaining purchased balance: ${walletPreRefund.balance_purchased} CR.`);

    // A full refund of order 1 (660 credits) is issued.
    // handle_refund must:
    // 1. Claw back the available 260 purchased credits (wallet ends at 0).
    // 2. Detect the 400 CR shortfall.
    // 3. Freeze the wallet (is_frozen = true).
    // 4. Log alert with shortfall=400, clawed_back=260.
    const { data: refundRes, error: refErr } = await admin.rpc('handle_refund', {
      p_order_id: order1.id,
      p_refund_id: `REFUND-PARTIAL-${timestamp}`,
      p_refund_amount_cents: 150000,
      p_reason: 'Buyer dispute refund',
    });
    if (refErr || !refundRes?.success) throw new Error(`handle_refund failed: ${refErr?.message}`);

    if (refundRes.clawed_back !== 260 || refundRes.shortfall !== 400 || !refundRes.wallet_frozen) {
      throw new Error(`Partial refund numbers invalid: ${JSON.stringify(refundRes)}`);
    }

    const { data: walletPostRefund } = await admin.from('wallets').select('*').eq('user_id', userId).single();
    if (walletPostRefund.balance_purchased !== 0 || !walletPostRefund.is_frozen) {
      throw new Error(`Wallet post refund state invalid: balance=${walletPostRefund.balance_purchased}, frozen=${walletPostRefund.is_frozen}`);
    }

    const { data: shortfallAlert } = await admin.from('admin_alerts').select('*').eq('order_id', order1.id).eq('type', 'refund_shortfall').single();
    if (!shortfallAlert || shortfallAlert.metadata.shortfall !== 400 || shortfallAlert.metadata.clawed_back !== 260) {
      throw new Error(`Shortfall alert missing or invalid: ${JSON.stringify(shortfallAlert)}`);
    }

    console.log(`  -> Partial refund executed:`);
    console.log(`     * Available balance clawed back: ${refundRes.clawed_back} CR (Wallet is now 0 CR).`);
    console.log(`     * Shortfall detected and recorded: ${refundRes.shortfall} CR.`);
    console.log(`     * Wallet successfully FROZEN (is_frozen = true).`);
    console.log(`     * Admin alert recorded with detailed breakdown.\n`);

    // -------------------------------------------------------------------------
    // TEST 3: EARLY DISPUTE FREEZE (CUSTOMER.DISPUTE.CREATED)
    // -------------------------------------------------------------------------
    console.log('[Test 3] Early Dispute Freeze (CUSTOMER.DISPUTE.CREATED):');
    const { data: order2 } = await admin
      .from('orders')
      .insert({
        user_id: userId,
        package_id: 'studio-momentum',
        credits_to_grant: 1160,
        expected_amount_cents: 250000,
        currency: 'USD',
        status: 'fulfilled',
        idempotency_key: `dispute_order_${timestamp}`,
        provider_order_id: `PAYPAL-ORD-DISPUTE-${timestamp}`,
      })
      .select('*')
      .single();

    const { data: disputeRes, error: disputeErr } = await admin.rpc('handle_dispute', {
      p_order_id: order2.id,
      p_dispute_id: `DISPUTE-${timestamp}`,
      p_reason: 'Unauthorized payment dispute',
    });
    if (disputeErr || !disputeRes?.wallet_frozen) throw new Error(`handle_dispute failed: ${disputeErr?.message}`);

    const { data: disputeAlert } = await admin.from('admin_alerts').select('*').eq('order_id', order2.id).eq('type', 'dispute_opened').single();
    if (!disputeAlert) throw new Error('Dispute alert missing');

    console.log(`  -> Dispute event processed: wallet frozen immediately upon notice.`);
    console.log(`  -> High-priority dispute alert recorded in admin_alerts.\n`);

    console.log('========================================================================');
    console.log('ALL WEBHOOK RETRY & PARTIAL CLAWBACK AUDITS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ WEBHOOK RETRY & CLAWBACK AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runWebhookRetryAndClawbackAudit();
