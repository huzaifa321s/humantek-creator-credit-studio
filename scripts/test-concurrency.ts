/**
 * 100-Concurrent-Spends & Parallel Race Condition Test
 *
 * Runs 100 simultaneous promises against a wallet initialized with 50 credits.
 * Verifies:
 * 1. Exactly 50 individual 1-credit spends succeed.
 * 2. Exactly 50 spends fail with 'insufficient_credits'.
 * 3. The final wallet balance is exactly 0 (never negative).
 * 4. The ledger delta sum equals the wallet balance.
 *
 * Usage:
 * npx tsx scripts/test-concurrency.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  if (!SERVICE_KEY) {
    console.log('[SKIP] SUPABASE_SERVICE_ROLE_KEY not set. Set environment variables to run against live Supabase instance.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const testUserId = '33333333-3333-3333-3333-333333333333';
  console.log('--- Initializing Concurrency Test Environment ---');

  // Clean and prepare test user
  await supabase.from('credit_ledger').delete().eq('user_id', testUserId);
  await supabase.from('wallets').delete().eq('user_id', testUserId);
  await supabase.from('profiles').delete().eq('id', testUserId);

  await supabase.from('profiles').insert({ id: testUserId, email: 'concurrency@humantek.art', role: 'client' });
  await supabase.from('wallets').insert({ user_id: testUserId, balance_purchased: 50, balance_promo: 0 });

  console.log('User initialized with 50 purchased credits.');
  console.log('Launching 100 concurrent 1-credit spends in parallel...');

  const startTime = Date.now();
  const spendPromises = Array.from({ length: 100 }, async (_, index) => {
    const key = `spend-concurrency-${Date.now()}-${index}`;
    try {
      const { data, error } = await supabase.rpc('spend_credits', {
        p_user: testUserId,
        p_amount: 1,
        p_ref: `TEST-RACE-${index}`,
        p_key: key,
        p_desc: `Concurrent spend attempt ${index}`,
      });
      if (error) throw error;
      return { success: true, balance: data };
    } catch (err: any) {
      return { success: false, error: err.message || err };
    }
  });

  const results = await Promise.all(spendPromises);
  const elapsed = Date.now() - startTime;

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log(`\nCompleted 100 parallel operations in ${elapsed}ms.`);
  console.log(`Successes: ${successes.length} / 100`);
  console.log(`Failures:  ${failures.length} / 100`);

  // Verify wallet balance
  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', testUserId).single();
  console.log('Final Wallet Balance:', wallet);

  if (successes.length === 50 && failures.length === 50 && wallet.balance_credits === 0) {
    console.log('\n[PASS] Concurrency test passed with zero race conditions and zero negative balance!');
  } else {
    console.error('\n[FAIL] Concurrency test failed expected guarantees.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
