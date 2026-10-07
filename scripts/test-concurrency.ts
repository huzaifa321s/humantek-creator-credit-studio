/**
 * Humantek Creator Credit Studio: Multi-Connection Concurrency & Race Condition Test Suite
 *
 * Runs two rigorous parallel race scenarios against the test database:
 *
 * SCENARIO 1: 100 simultaneous parallel spends against a single wallet with 50 credits
 *  - Exactly 50 spend calls succeed.
 *  - Exactly 50 spend calls fail with 'insufficient_credits'.
 *  - Final wallet balance is exactly 0 (never negative).
 *
 * SCENARIO 2: 20 concurrent redemptions by 20 distinct users for a promo code with max_uses = 5
 *  - Users are provisioned via supabase.auth.admin.createUser({ email_confirm: true })
 *    to bypass email sending and avoid rate limiting.
 *  - Exactly 5 redemptions succeed.
 *  - Exactly 15 redemptions fail with code exhausted.
 *  - promo_codes.used_count is exactly 5 (never over-allocated).
 *
 * Usage:
 *   npx tsx scripts/test-concurrency.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Auto-load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  if (!SERVICE_KEY || SERVICE_KEY.includes('mockServiceRoleKey')) {
    console.log('\n[SKIP] SUPABASE_SERVICE_ROLE_KEY not configured in .env.local.');
    console.log('Connect your test Supabase project to run the live concurrency suite.\n');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('========================================================');
  console.log('HUMANTEK STUDIO: MULTI-CONNECTION CONCURRENCY SUITE');
  console.log('========================================================\n');

  // =========================================================================
  // SCENARIO 1: 100 Concurrent Spends against 50 Balance
  // =========================================================================
  console.log('--- SCENARIO 1: 100 CONCURRENT SPENDS (Initial Balance: 50 CR) ---');
  const runTimestamp = Date.now();
  const testEmail = `concurrency-${runTimestamp}@humantek.art`;

  // Provision user via auth.admin.createUser with email_confirm: true (no emails sent)
  console.log(`Creating test user ${testEmail} with confirmed email...`);
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!',
    email_confirm: true,
  });

  if (createErr || !newUser.user) {
    console.error('Failed to create test user for concurrency test:', createErr);
    process.exit(1);
  }

  const testUserId = newUser.user.id;

  // Fund wallet with 50 purchased credits via ledger_post
  const { error: seedErr } = await supabase.rpc('ledger_post', {
    p_user: testUserId,
    p_bucket: 'purchased',
    p_delta: 50,
    p_type: 'package_purchase',
    p_ref: `SEED-${runTimestamp}`,
    p_key: `seed-key-${runTimestamp}`,
    p_desc: 'Initial 50 credits for concurrency test',
  });

  if (seedErr) {
    console.error('Failed to seed 50 credits to test wallet:', seedErr);
    process.exit(1);
  }

  console.log(`User ${testUserId} funded with 50 purchased credits.`);
  console.log('Launching 100 parallel spend_credits calls...');

  const spendStartTime = Date.now();
  const spendPromises = Array.from({ length: 100 }, async (_, index) => {
    const key = `spend-race-${runTimestamp}-${index}`;
    try {
      const { data, error } = await supabase.rpc('spend_credits', {
        p_user: testUserId,
        p_amount: 1,
        p_ref: `RACE-REF-${index}`,
        p_key: key,
        p_desc: `Parallel spend attempt ${index}`,
      });
      if (error) throw error;
      return { success: true, balance: data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const spendResults = await Promise.all(spendPromises);
  const spendElapsed = Date.now() - spendStartTime;

  const spendSuccesses = spendResults.filter((r) => r.success);
  const spendFailures = spendResults.filter((r) => !r.success);

  console.log(`Finished 100 parallel spends in ${spendElapsed}ms.`);
  console.log(`Successes: ${spendSuccesses.length} / 100`);
  console.log(`Failures:  ${spendFailures.length} / 100`);

  const { data: walletAfterSpend } = await supabase
    .from('wallets')
    .select('balance_credits, balance_purchased, balance_promo')
    .eq('user_id', testUserId)
    .single();

  console.log('Final wallet state:', walletAfterSpend);

  if (spendSuccesses.length !== 50 || spendFailures.length !== 50 || walletAfterSpend?.balance_credits !== 0) {
    console.error('[FAIL] Scenario 1 failed: Expected exactly 50 successes, 50 failures, and 0 balance.');
    process.exit(1);
  }
  console.log('[PASS] Scenario 1 passed! Row-level lock serialized spends with zero negative balance.\n');

  // =========================================================================
  // SCENARIO 2: 20 Parallel Redemptions against max_uses = 5
  // =========================================================================
  console.log('--- SCENARIO 2: 20 CONCURRENT REDEMPTIONS (max_uses = 5) ---');
  const promoCodeName = `RACE-PROMO-${runTimestamp}`;

  // Insert promo code with max_uses = 5
  const { data: insertedPromo, error: promoInsertErr } = await supabase
    .from('promo_codes')
    .insert({
      code: promoCodeName,
      credits: 20,
      max_uses: 5,
      is_active: true,
    })
    .select()
    .single();

  if (promoInsertErr || !insertedPromo) {
    console.error('Failed to create promo code for race test:', promoInsertErr);
    process.exit(1);
  }

  // Provision 20 distinct confirmed users without sending emails
  console.log(`Provisioning 20 test users with email_confirm: true...`);
  const userIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const { data: u, error: uErr } = await supabase.auth.admin.createUser({
      email: `race-user-${runTimestamp}-${i}@humantek.art`,
      password: 'Password123!',
      email_confirm: true,
    });
    if (uErr || !u.user) {
      console.error(`Failed to provision user ${i}:`, uErr);
      process.exit(1);
    }
    userIds.push(u.user.id);
  }

  console.log(`Firing 20 simultaneous redemptions for code ${promoCodeName}...`);
  const redeemStartTime = Date.now();
  const redeemPromises = userIds.map(async (uid) => {
    try {
      const { data, error } = await supabase.rpc('redeem_promo', {
        p_user: uid,
        p_raw_code: promoCodeName,
      });
      if (error) throw error;
      return { success: true, user: uid, data };
    } catch (err: any) {
      return { success: false, user: uid, error: err.message || String(err) };
    }
  });

  const redeemResults = await Promise.all(redeemPromises);
  const redeemElapsed = Date.now() - redeemStartTime;

  const redeemSuccesses = redeemResults.filter((r) => r.success);
  const redeemFailures = redeemResults.filter((r) => !r.success);

  console.log(`Finished 20 parallel redemptions in ${redeemElapsed}ms.`);
  console.log(`Successes: ${redeemSuccesses.length} / 20`);
  console.log(`Failures:  ${redeemFailures.length} / 20`);

  // Verify promo_codes.used_count
  const { data: finalPromo } = await supabase
    .from('promo_codes')
    .select('used_count, max_uses')
    .eq('id', insertedPromo.id)
    .single();

  console.log('Final promo code state:', finalPromo);

  // Verify redemption audit rows
  const { count: redemptionCount } = await supabase
    .from('promo_redemptions')
    .select('*', { count: 'exact', head: true })
    .eq('promo_code_id', insertedPromo.id);

  console.log(`Total promo_redemptions rows recorded: ${redemptionCount}`);

  if (
    redeemSuccesses.length === 5 &&
    redeemFailures.length === 15 &&
    finalPromo?.used_count === 5 &&
    redemptionCount === 5
  ) {
    console.log('[PASS] Scenario 2 passed! Atomic used_count check prevented over-redemption in parallel connections.\n');
  } else {
    console.error('[FAIL] Scenario 2 race condition detected! Over-allocation occurred.');
    process.exit(1);
  }

  console.log('========================================================');
  console.log('ALL CONCURRENCY & RACE CONDITION GUARANTEES VERIFIED!');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
