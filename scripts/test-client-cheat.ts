/**
 * Humantek Creator Credit Studio: Client Penetration & Cheat Test Suite
 *
 * Simulates a malicious attacker using both the public anon key and an
 * authenticated user session trying to bypass policies, escalate privileges,
 * and manipulate financial records.
 *
 * Attack Vectors Tested:
 * 1. Anon: RPC ledger_post -> BLOCKED
 * 2. Anon: RPC spend_credits -> BLOCKED
 * 3. Anon: RPC redeem_promo -> BLOCKED
 * 4. Anon: Direct table UPDATE on wallets -> BLOCKED (0 rows / error)
 * 5. Anon: Direct table INSERT into credit_ledger -> BLOCKED
 * 6. Anon: Direct table SELECT dump on promo_codes -> BLOCKED (0 rows)
 * 7. Anon: Cross-tenant SELECT on wallets -> BLOCKED (0 rows)
 * 8. Authenticated: Privilege escalation (UPDATE profiles SET role = 'admin') -> BLOCKED
 * 9. Authenticated: Direct table UPDATE on own wallet balance -> BLOCKED
 * 10. Authenticated: RPC ledger_post -> BLOCKED
 * 11. Authenticated: RPC spend_credits -> BLOCKED
 * 12. Authenticated: RPC redeem_promo -> BLOCKED
 * 13. Authenticated: Direct table INSERT into credit_ledger -> BLOCKED
 * 14. Authenticated: Direct table SELECT dump on promo_codes -> BLOCKED (0 rows)
 * 15. Authenticated: Cross-tenant SELECT on wallets -> BLOCKED (only own row visible)
 * 16. Authenticated: Direct table INSERT into wallets -> BLOCKED
 *
 * Usage:
 *   npx tsx scripts/test-client-cheat.ts
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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  if (!ANON_KEY || ANON_KEY.includes('MockKey')) {
    console.log('\n[SKIP] NEXT_PUBLIC_SUPABASE_ANON_KEY not configured in .env.local.\n');
    return;
  }

  console.log('========================================================');
  console.log('HUMANTEK STUDIO: CLIENT PENETRATION & PRIVILEGE ESCALATION SUITE');
  console.log('Testing attack surface for Anon and Authenticated roles');
  console.log('========================================================\n');

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  let cheatPassedCount = 0;
  let totalTests = 0;
  const targetUser = '00000000-0000-0000-0000-000000000001';

  // -------------------------------------------------------------
  // PART 1: UN-AUTHENTICATED (ANON) ATTACKS
  // -------------------------------------------------------------
  console.log('--- PART 1: UNAUTHENTICATED (ANON) CLIENT ATTACKS ---');

  // 1. Attack ledger_post (anon)
  totalTests++;
  console.log('1. Attempting unauthorized RPC ledger_post (anon)...');
  const { error: err1 } = await anonClient.rpc('ledger_post', {
    p_user: targetUser,
    p_bucket: 'purchased',
    p_delta: 5000,
    p_type: 'package_purchase',
    p_ref: 'HACK-5000',
    p_key: 'hack-key-1',
    p_desc: 'Malicious injection',
  });
  if (err1) {
    console.log('   [BLOCKED]', err1.message);
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] ledger_post executed directly from client!');
    process.exit(1);
  }

  // 2. Attack spend_credits (anon)
  totalTests++;
  console.log('2. Attempting direct RPC spend_credits (anon)...');
  const { error: err2 } = await anonClient.rpc('spend_credits', {
    p_user: targetUser,
    p_amount: 10,
    p_ref: 'HACK-SPEND',
    p_key: 'hack-spend-key',
    p_desc: 'Bypassing API',
  });
  if (err2) {
    console.log('   [BLOCKED]', err2.message);
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] spend_credits executed directly from client!');
    process.exit(1);
  }

  // 3. Attack redeem_promo (anon)
  totalTests++;
  console.log('3. Attempting direct RPC redeem_promo (anon)...');
  const { error: err3 } = await anonClient.rpc('redeem_promo', {
    p_user: targetUser,
    p_raw_code: 'TEST-CODE',
  });
  if (err3) {
    console.log('   [BLOCKED]', err3.message);
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] redeem_promo executed directly from client!');
    process.exit(1);
  }

  // 4. Attack wallets table update directly (anon)
  totalTests++;
  console.log('4. Attempting direct table UPDATE on wallets (anon)...');
  const { data: updateData, error: err4 } = await anonClient
    .from('wallets')
    .update({ balance_purchased: 99999 })
    .eq('user_id', targetUser)
    .select();
  if (err4 || !updateData || updateData.length === 0) {
    console.log('   [BLOCKED]', err4 ? err4.message : '0 rows modified (RLS enforced)');
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] Direct wallet balance mutation succeeded!', updateData);
    process.exit(1);
  }

  // 5. Attack credit_ledger table insert directly (anon)
  totalTests++;
  console.log('5. Attempting direct INSERT into credit_ledger (anon)...');
  const { data: insertData, error: err5 } = await anonClient
    .from('credit_ledger')
    .insert({
      user_id: targetUser,
      bucket: 'purchased',
      delta: 1000,
      type: 'package_purchase',
      idempotency_key: 'hacked-direct-insert',
    })
    .select();
  if (err5) {
    console.log('   [BLOCKED]', err5.message);
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] Direct credit_ledger insertion succeeded!', insertData);
    process.exit(1);
  }

  // 6. Attack promo_codes table (dumping unredeemed promo codes)
  totalTests++;
  console.log('6. Attempting table SELECT dump on promo_codes (anon)...');
  const { data: promoDump, error: err6 } = await anonClient
    .from('promo_codes')
    .select('*');
  if (err6 || !promoDump || promoDump.length === 0) {
    console.log('   [BLOCKED]', err6 ? err6.message : '0 rows returned (code dumping blocked)');
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] Client dumped active promo codes table!', promoDump);
    process.exit(1);
  }

  // 7. Attack wallets table (trying to read other users balances)
  totalTests++;
  console.log('7. Attempting cross-tenant SELECT on wallets table (anon)...');
  const { data: allWallets } = await anonClient.from('wallets').select('*');
  if (!allWallets || allWallets.length === 0) {
    console.log('   [BLOCKED] 0 cross-tenant rows exposed to anon client');
    cheatPassedCount++;
  } else {
    console.error('   [CRITICAL BREACH] Client read unauthorized wallet rows!', allWallets);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // PART 2: AUTHENTICATED CLIENT ATTACKS
  // -------------------------------------------------------------
  if (SERVICE_KEY && !SERVICE_KEY.includes('mockServiceRoleKey')) {
    console.log('\n--- PART 2: AUTHENTICATED CLIENT PRIVILEGE ESCALATION ATTACKS ---');
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const runTimestamp = Date.now();
    const authEmail = `cheat-client-${runTimestamp}@humantek.art`;
    const authPassword = 'SecurePassword2026!';

    const { data: createdAuthUser, error: authCreateErr } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password: authPassword,
      email_confirm: true,
    });

    if (!createdAuthUser?.user || authCreateErr) {
      console.error('Failed to provision authenticated test user:', authCreateErr);
      process.exit(1);
    }

    const authedClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: sessionData, error: loginErr } = await authedClient.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (loginErr || !sessionData.user) {
      console.error('Failed to log in as authenticated client:', loginErr);
      process.exit(1);
    }

    const authedUid = sessionData.user.id;
    console.log(`Signed in with verified session as client ${authEmail} (uid: ${authedUid}).\n`);

    // 8. Privilege Escalation: Update own role to 'admin'
    totalTests++;
    console.log('8. Attempting Privilege Escalation: UPDATE profiles SET role = \'admin\' on own row...');
    const { data: privData, error: privErr } = await authedClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', authedUid)
      .select();

    // Verify role in database
    const { data: profileCheck } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authedUid)
      .single();

    if ((privErr || !privData || privData.length === 0) && profileCheck?.role === 'client') {
      console.log('   [BLOCKED] Role update rejected by RLS policy. Profile role remains "client".');
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Client successfully escalated privilege to admin!', profileCheck);
      process.exit(1);
    }

    // 9. Authenticated user trying to increase their own balance directly
    totalTests++;
    console.log('9. Authenticated user attempting direct UPDATE on own wallet...');
    const { data: authedUpdate, error: authedUpErr } = await authedClient
      .from('wallets')
      .update({ balance_purchased: 99999 })
      .eq('user_id', authedUid)
      .select();

    if (authedUpErr || !authedUpdate || authedUpdate.length === 0) {
      console.log('   [BLOCKED]', authedUpErr ? authedUpErr.message : '0 rows modified (UPDATE denied by policy)');
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client mutated own balance!', authedUpdate);
      process.exit(1);
    }

    // 10. Authenticated user trying to call ledger_post
    totalTests++;
    console.log('10. Authenticated user attempting RPC ledger_post...');
    const { error: authedLedgerErr } = await authedClient.rpc('ledger_post', {
      p_user: authedUid,
      p_bucket: 'purchased',
      p_delta: 5000,
      p_type: 'package_purchase',
      p_ref: 'AUTH-HACK',
      p_key: `auth-hack-${runTimestamp}`,
      p_desc: 'Authenticated hack',
    });
    if (authedLedgerErr) {
      console.log('   [BLOCKED]', authedLedgerErr.message);
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client ran ledger_post!');
      process.exit(1);
    }

    // 11. Authenticated user trying to call spend_credits
    totalTests++;
    console.log('11. Authenticated user attempting RPC spend_credits...');
    const { error: authedSpendErr } = await authedClient.rpc('spend_credits', {
      p_user: authedUid,
      p_amount: 1,
      p_ref: 'AUTH-SPEND-HACK',
      p_key: `auth-spend-hack-${runTimestamp}`,
      p_desc: 'Direct client spend call',
    });
    if (authedSpendErr) {
      console.log('   [BLOCKED]', authedSpendErr.message);
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client ran spend_credits directly!');
      process.exit(1);
    }

    // 12. Authenticated user trying to call redeem_promo
    totalTests++;
    console.log('12. Authenticated user attempting RPC redeem_promo directly...');
    const { error: authedPromoErr } = await authedClient.rpc('redeem_promo', {
      p_user: authedUid,
      p_raw_code: 'TEST-CODE',
    });
    if (authedPromoErr) {
      console.log('   [BLOCKED]', authedPromoErr.message);
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client ran redeem_promo directly!');
      process.exit(1);
    }

    // 13. Authenticated user trying to insert into credit_ledger
    totalTests++;
    console.log('13. Authenticated user attempting direct INSERT into credit_ledger...');
    const { error: authedLedgerInsertErr } = await authedClient
      .from('credit_ledger')
      .insert({
        user_id: authedUid,
        bucket: 'purchased',
        delta: 1000,
        type: 'package_purchase',
        idempotency_key: `auth-insert-${runTimestamp}`,
      });
    if (authedLedgerInsertErr) {
      console.log('   [BLOCKED]', authedLedgerInsertErr.message);
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client inserted into credit_ledger!');
      process.exit(1);
    }

    // 14. Authenticated user trying to dump promo_codes
    totalTests++;
    console.log('14. Authenticated user attempting table SELECT dump on promo_codes...');
    const { data: authedPromoDump, error: authedPromoDumpErr } = await authedClient
      .from('promo_codes')
      .select('*');
    if (authedPromoDumpErr || !authedPromoDump || authedPromoDump.length === 0) {
      console.log('   [BLOCKED]', authedPromoDumpErr ? authedPromoDumpErr.message : '0 rows returned (code dumping blocked)');
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client dumped promo_codes table!', authedPromoDump);
      process.exit(1);
    }

    // 15. Authenticated user trying cross-tenant read on wallets
    totalTests++;
    console.log('15. Authenticated user attempting cross-tenant read on wallets...');
    const { data: authedRead } = await authedClient.from('wallets').select('*');
    if (authedRead && authedRead.length === 1 && authedRead[0].user_id === authedUid) {
      console.log('   [PASS] Authenticated user strictly received only their own wallet row (1 row)');
      cheatPassedCount++;
    } else if (!authedRead || authedRead.length === 0) {
      console.log('   [PASS] 0 rows returned');
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated user saw other users wallets!', authedRead);
      process.exit(1);
    }

    // 16. Authenticated user trying to insert into wallets table
    totalTests++;
    console.log('16. Authenticated user attempting direct INSERT into wallets...');
    const { error: authedWalletInsertErr } = await authedClient
      .from('wallets')
      .insert({
        user_id: authedUid,
        balance_purchased: 500,
        balance_promo: 500,
      });
    if (authedWalletInsertErr) {
      console.log('   [BLOCKED]', authedWalletInsertErr.message);
      cheatPassedCount++;
    } else {
      console.error('   [CRITICAL BREACH] Authenticated client inserted new wallet row!');
      process.exit(1);
    }
  }

  console.log('\n========================================================');
  console.log(`ALL ${cheatPassedCount}/${totalTests} PENETRATION & PRIVILEGE ESCALATION ATTEMPTS WERE BLOCKED!`);
  console.log('Zero unauthorized RPC access, RLS fully enforced on all roles.');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
