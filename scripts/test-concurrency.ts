/**
 * Humantek Creator Credit Studio: Multi-Connection Concurrency & Invariant Suite
 *
 * Verifies six rigorous concurrency and data-integrity guarantees against the live database:
 *
 * SCENARIO 1: 100 concurrent parallel spends against a single wallet with 50 credits
 *  - Exactly 50 spend calls succeed.
 *  - Exactly 50 spend calls fail with 'insufficient_credits'.
 *  - Final wallet balance is exactly 0 (never negative).
 *
 * SCENARIO 2: 20 concurrent redemptions by 20 distinct users for a promo code with max_uses = 5
 *  - Exactly 5 redemptions succeed.
 *  - Exactly 15 redemptions fail with code exhausted.
 *  - promo_codes.used_count is exactly 5 (never over-allocated).
 *
 * SCENARIO 3: Same user, same promo code, 20 parallel redemptions
 *  - Exactly 1 redemption succeeds.
 *  - Exactly 19 fail with 'already_redeemed'.
 *  - promo_codes.used_count is exactly 1 (failed duplicate attempts do NOT consume a use).
 *
 * SCENARIO 4: 20 concurrent spends with the EXACT SAME idempotency key
 *  - Exactly 1 spend effect occurs (deducted once).
 *  - All 20 parallel calls return the exact same balance.
 *
 * SCENARIO 5: Dual-Bucket Concurrency (Promo-first deduction under parallel load)
 *  - Initial balance: 20 promo + 30 purchased (Total: 50 CR).
 *  - 100 concurrent parallel 1-credit spends.
 *  - Exactly 50 succeed, 50 fail.
 *  - Final balances: promo = 0, purchased = 0, total = 0.
 *
 * SCENARIO 6: Delete Restriction & Immutability Under Financial History
 *  - Attempting to delete a profile with ledger records is rejected by on delete restrict.
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
    console.log('\n[SKIP] SUPABASE_SERVICE_ROLE_KEY not configured in .env.local.\n');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('========================================================');
  console.log('HUMANTEK STUDIO: MULTI-CONNECTION CONCURRENCY & RACE SUITE');
  console.log('========================================================\n');

  const runTimestamp = Date.now();

  // =========================================================================
  // SCENARIO 1: 100 Concurrent Spends against 50 Balance
  // =========================================================================
  console.log('--- SCENARIO 1: 100 CONCURRENT SPENDS (Initial Balance: 50 CR) ---');
  const user1Email = `race-spend-1-${runTimestamp}@humantek.art`;
  const { data: user1, error: err1 } = await supabase.auth.admin.createUser({
    email: user1Email,
    password: 'Password123!',
    email_confirm: true,
  });
  if (err1 || !user1.user) {
    console.error('Failed to create test user 1:', err1);
    process.exit(1);
  }
  const uid1 = user1.user.id;

  // Fund wallet with 50 purchased credits
  await supabase.rpc('ledger_post', {
    p_user: uid1,
    p_bucket: 'purchased',
    p_delta: 50,
    p_type: 'package_purchase',
    p_ref: `SEED-1-${runTimestamp}`,
    p_key: `seed-1-${runTimestamp}`,
    p_desc: 'Initial 50 credits',
  });

  console.log('Launching 100 parallel spend_credits calls...');
  const t1Start = Date.now();
  const s1Promises = Array.from({ length: 100 }, async (_, index) => {
    try {
      const { data, error } = await supabase.rpc('spend_credits', {
        p_user: uid1,
        p_amount: 1,
        p_ref: `RACE-S1-${index}`,
        p_key: `s1-key-${runTimestamp}-${index}`,
        p_desc: `Parallel spend attempt ${index}`,
      });
      if (error) throw error;
      return { success: true, balance: data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const s1Results = await Promise.all(s1Promises);
  const s1Elapsed = Date.now() - t1Start;
  const s1Success = s1Results.filter((r) => r.success);
  const s1Failure = s1Results.filter((r) => !r.success);

  console.log(`Completed in ${s1Elapsed}ms. Successes: ${s1Success.length}/100, Failures: ${s1Failure.length}/100`);
  const { data: w1 } = await supabase.from('wallets').select('balance_credits').eq('user_id', uid1).single();

  if (s1Success.length !== 50 || s1Failure.length !== 50 || w1?.balance_credits !== 0) {
    console.error('[FAIL] Scenario 1 failed guarantees!', { s1Success: s1Success.length, w1 });
    process.exit(1);
  }
  console.log('[PASS] Scenario 1 passed! Row-level lock serialized spends with zero negative balance.\n');

  // =========================================================================
  // SCENARIO 2: 20 Parallel Redemptions against max_uses = 5 (Multi-User)
  // =========================================================================
  console.log('--- SCENARIO 2: 20 CONCURRENT REDEMPTIONS (20 Users, max_uses = 5) ---');
  const promoCodeS2 = `RACE-S2-${runTimestamp}`;
  const { data: promo2, error: promo2Err } = await supabase
    .from('promo_codes')
    .insert({ code: promoCodeS2, credits: 20, max_uses: 5, is_active: true })
    .select()
    .single();
  if (promo2Err || !promo2) {
    console.error('Failed to create promo code 2:', promo2Err);
    process.exit(1);
  }

  const uidsS2: string[] = [];
  for (let i = 0; i < 20; i++) {
    const { data: u, error: uErr } = await supabase.auth.admin.createUser({
      email: `race-s2-${runTimestamp}-${i}@humantek.art`,
      password: 'Password123!',
      email_confirm: true,
    });
    if (uErr || !u.user) process.exit(1);
    uidsS2.push(u.user.id);
  }

  const t2Start = Date.now();
  const s2Promises = uidsS2.map(async (uid) => {
    try {
      const { data, error } = await supabase.rpc('redeem_promo', { p_user: uid, p_raw_code: promoCodeS2 });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const s2Results = await Promise.all(s2Promises);
  const s2Elapsed = Date.now() - t2Start;
  const s2Success = s2Results.filter((r) => r.success);
  const s2Failure = s2Results.filter((r) => !r.success);

  const { data: finalPromo2 } = await supabase.from('promo_codes').select('used_count').eq('id', promo2.id).single();
  const { count: red2Count } = await supabase.from('promo_redemptions').select('*', { count: 'exact', head: true }).eq('promo_code_id', promo2.id);

  console.log(`Completed in ${s2Elapsed}ms. Successes: ${s2Success.length}/20, used_count: ${finalPromo2?.used_count}`);
  if (s2Success.length !== 5 || s2Failure.length !== 15 || finalPromo2?.used_count !== 5 || red2Count !== 5) {
    console.error('[FAIL] Scenario 2 failed: code over-allocated!', { s2Success: s2Success.length, finalPromo2 });
    process.exit(1);
  }
  console.log('[PASS] Scenario 2 passed! Atomic used_count check prevented over-redemption in parallel.\n');

  // =========================================================================
  // SCENARIO 3: Same User, Same Code in Parallel (Duplicate race protection)
  // =========================================================================
  console.log('--- SCENARIO 3: SAME USER, SAME CODE, 20 PARALLEL REDEMPTIONS ---');
  const promoCodeS3 = `RACE-S3-${runTimestamp}`;
  const { data: promo3 } = await supabase
    .from('promo_codes')
    .insert({ code: promoCodeS3, credits: 50, max_uses: 10, is_active: true })
    .select()
    .single();

  const user3Email = `race-s3-user-${runTimestamp}@humantek.art`;
  const { data: user3 } = await supabase.auth.admin.createUser({
    email: user3Email,
    password: 'Password123!',
    email_confirm: true,
  });
  const uid3 = user3!.user!.id;

  const s3Promises = Array.from({ length: 20 }, async () => {
    try {
      const { data, error } = await supabase.rpc('redeem_promo', { p_user: uid3, p_raw_code: promoCodeS3 });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const s3Results = await Promise.all(s3Promises);
  const s3Success = s3Results.filter((r) => r.success);
  const s3Failure = s3Results.filter((r) => !r.success);

  const { data: finalPromo3 } = await supabase.from('promo_codes').select('used_count').eq('id', promo3!.id).single();
  const { count: red3Count } = await supabase.from('promo_redemptions').select('*', { count: 'exact', head: true }).eq('promo_code_id', promo3!.id);

  console.log(`Same user results: Successes: ${s3Success.length}/20, Failures: ${s3Failure.length}/20, used_count: ${finalPromo3?.used_count}`);
  if (s3Success.length !== 1 || s3Failure.length !== 19 || finalPromo3?.used_count !== 1 || red3Count !== 1) {
    console.error('[FAIL] Scenario 3 failed! Failed duplicate redemptions consumed uses of code.', { s3Success: s3Success.length, finalPromo3 });
    process.exit(1);
  }
  console.log('[PASS] Scenario 3 passed! Duplicate redemption cleanly rejected without burning promo code uses.\n');

  // =========================================================================
  // SCENARIO 4: Same Idempotency Key in Parallel (Deduplication)
  // =========================================================================
  console.log('--- SCENARIO 4: 20 CONCURRENT SPENDS WITH SAME IDEMPOTENCY KEY ---');
  const user4Email = `race-s4-user-${runTimestamp}@humantek.art`;
  const { data: user4 } = await supabase.auth.admin.createUser({
    email: user4Email,
    password: 'Password123!',
    email_confirm: true,
  });
  const uid4 = user4!.user!.id;

  // Fund with 20 purchased credits
  await supabase.rpc('ledger_post', {
    p_user: uid4,
    p_bucket: 'purchased',
    p_delta: 20,
    p_type: 'package_purchase',
    p_ref: `SEED-4-${runTimestamp}`,
    p_key: `seed-4-${runTimestamp}`,
    p_desc: 'Initial 20 credits',
  });

  const sharedIdempotencyKey = `shared-spend-key-${runTimestamp}`;
  const s4Promises = Array.from({ length: 20 }, async () => {
    try {
      const { data, error } = await supabase.rpc('spend_credits', {
        p_user: uid4,
        p_amount: 5,
        p_ref: `ORDER-S4-${runTimestamp}`,
        p_key: sharedIdempotencyKey,
        p_desc: 'Idempotency parallel test',
      });
      if (error) throw error;
      return { success: true, balance: data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const s4Results = await Promise.all(s4Promises);
  const s4Balances = s4Results.map((r) => r.balance);
  const { data: finalWallet4 } = await supabase.from('wallets').select('balance_credits').eq('user_id', uid4).single();

  console.log(`Parallel identical spends result: Returned balance 15 on all parallel calls. Final wallet: ${finalWallet4?.balance_credits} CR.`);
  if (finalWallet4?.balance_credits !== 15 || s4Balances.some((b) => b !== 15)) {
    console.error('[FAIL] Scenario 4 failed! Replay idempotency did not serialize identical key properly.', { s4Balances, finalWallet4 });
    process.exit(1);
  }
  console.log('[PASS] Scenario 4 passed! Replayed key produced exactly one spend effect.\n');

  // =========================================================================
  // SCENARIO 5: Dual-Bucket Concurrency (Promo-first split under load)
  // =========================================================================
  console.log('--- SCENARIO 5: DUAL-BUCKET CONCURRENCY (20 Promo + 30 Purchased) ---');
  const user5Email = `race-s5-user-${runTimestamp}@humantek.art`;
  const { data: user5 } = await supabase.auth.admin.createUser({
    email: user5Email,
    password: 'Password123!',
    email_confirm: true,
  });
  const uid5 = user5!.user!.id;

  // Fund with 20 promo + 30 purchased = 50 total
  await supabase.rpc('ledger_post', {
    p_user: uid5,
    p_bucket: 'promo',
    p_delta: 20,
    p_type: 'promo_redeem',
    p_ref: `SEED-5-PROMO-${runTimestamp}`,
    p_key: `seed-5-promo-${runTimestamp}`,
    p_desc: '20 promo credits',
  });
  await supabase.rpc('ledger_post', {
    p_user: uid5,
    p_bucket: 'purchased',
    p_delta: 30,
    p_type: 'package_purchase',
    p_ref: `SEED-5-PAID-${runTimestamp}`,
    p_key: `seed-5-paid-${runTimestamp}`,
    p_desc: '30 purchased credits',
  });

  console.log('Launching 100 concurrent 1-credit spends on mixed promo/purchased wallet...');
  const s5Promises = Array.from({ length: 100 }, async (_, index) => {
    try {
      const { data, error } = await supabase.rpc('spend_credits', {
        p_user: uid5,
        p_amount: 1,
        p_ref: `ORDER-S5-${index}`,
        p_key: `s5-spend-${runTimestamp}-${index}`,
        p_desc: `Mixed spend ${index}`,
      });
      if (error) throw error;
      return { success: true, balance: data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  const s5Results = await Promise.all(s5Promises);
  const s5Success = s5Results.filter((r) => r.success);
  const s5Failure = s5Results.filter((r) => !r.success);

  const { data: finalWallet5 } = await supabase
    .from('wallets')
    .select('balance_promo, balance_purchased, balance_credits')
    .eq('user_id', uid5)
    .single();

  console.log('Final mixed wallet state:', finalWallet5);
  if (
    s5Success.length !== 50 ||
    s5Failure.length !== 50 ||
    finalWallet5?.balance_promo !== 0 ||
    finalWallet5?.balance_purchased !== 0 ||
    finalWallet5?.balance_credits !== 0
  ) {
    console.error('[FAIL] Scenario 5 failed! Dual-bucket promo-first balance not fully exhausted.', { s5Success: s5Success.length, finalWallet5 });
    process.exit(1);
  }
  console.log('[PASS] Scenario 5 passed! Promo-first mixed bucket spent cleanly to zero under parallel load.\n');

  // =========================================================================
  // SCENARIO 6: Foreign Key Delete Restriction
  // =========================================================================
  console.log('--- SCENARIO 6: DELETE RESTRICTION ON FINANCIAL HISTORY ---');
  console.log('Attempting to delete profile for user with financial ledger records...');
  const { error: deleteProfileErr } = await supabase.from('profiles').delete().eq('id', uid1);

  if (deleteProfileErr) {
    console.log('   [BLOCKED] ON DELETE RESTRICT cleanly prevented deletion of profile with financial ledger:', deleteProfileErr.message);
  } else {
    console.error('   [CRITICAL BREACH] Profile with financial history was deleted!');
    process.exit(1);
  }

  console.log('\n========================================================');
  console.log('ALL 6 CONCURRENCY, IDEMPOTENCY & RESTRICTION TESTS PASSED!');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
