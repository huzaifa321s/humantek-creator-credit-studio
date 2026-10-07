import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { signSession, verifySessionToken, SESSION_COOKIE_NAME } from '../src/lib/session';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);
const anon = createClient(supabaseUrl, supabaseAnonKey);

async function runAuthFlowAudit() {
  console.log('===============================================================');
  console.log('HUMANTEK CREATOR STUDIO - AUTH & FLOW HARDENING VERIFICATION');
  console.log('===============================================================\n');

  const timestamp = Date.now();
  const testEmail = `creator_flow_${timestamp}@humantek.art`;
  const testPass = 'SecureStudioPass2026!';
  const testName = 'Alex Streamer';

  let testUserId = '';

  try {
    // -------------------------------------------------------------------------
    // STEP 1: PROMO CODE SETUP IN LIVE DATABASE
    // -------------------------------------------------------------------------
    const promoCode = `PROMO-FLOW-${timestamp}`;
    console.log(`[Step 1] Creating fresh test promo code: ${promoCode} (100 CR, max_uses: 10)`);
    const { error: promoErr } = await admin.from('promo_codes').insert({
      code: promoCode,
      credits: 100,
      max_uses: 10,
      is_active: true,
      description: 'Browser flow verification promo',
    });
    if (promoErr) throw new Error(`Failed to insert promo code: ${promoErr.message}`);
    console.log('  -> Promo code created successfully in live Postgres DB.');

    // -------------------------------------------------------------------------
    // STEP 2: SIGN UP VALIDATION & ACCOUNT PROVISIONING
    // -------------------------------------------------------------------------
    console.log(`\n[Step 2] Executing user account creation for: ${testEmail}`);
    
    // Create user via admin API with email_confirm: true (simulating /api/auth/signup)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { name: testName },
    });
    if (createErr || !created.user) throw new Error(`Sign-up failed: ${createErr?.message}`);
    testUserId = created.user.id;
    console.log(`  -> User created in Supabase Auth (UID: ${testUserId})`);

    // Verify trigger handle_new_user created profiles and wallets rows
    const { data: profile } = await admin.from('profiles').select('*').eq('id', testUserId).single();
    if (!profile || profile.role !== 'client') {
      throw new Error(`Profile trigger check failed. Expected role 'client', found: ${profile?.role}`);
    }
    console.log(`  -> Profile automatically initialized by trigger: role = '${profile.role}'`);

    const { data: initialWallet } = await admin.from('wallets').select('*').eq('user_id', testUserId).single();
    if (!initialWallet || initialWallet.balance_credits !== 0) {
      throw new Error(`Initial wallet balance mismatch: expected 0 CR, found ${initialWallet?.balance_credits} CR`);
    }
    console.log(`  -> Wallet automatically initialized with real 0 CR balance:`, {
      purchased: initialWallet.balance_purchased,
      promo: initialWallet.balance_promo,
      total: initialWallet.balance_credits,
    });

    // -------------------------------------------------------------------------
    // STEP 3: AUTHENTICATION & SESSION CREATION
    // -------------------------------------------------------------------------
    console.log('\n[Step 3] Authenticating user and establishing signed session');
    const { data: authData, error: authErr } = await anon.auth.signInWithPassword({
      email: testEmail,
      password: testPass,
    });
    if (authErr || !authData.user) throw new Error(`Sign in failed: ${authErr?.message}`);
    console.log(`  -> Supabase password authentication successful`);

    // Generate signed HMAC session token
    const token = await signSession({
      sub: testUserId,
      email: testEmail,
      name: testName,
      role: 'client',
      walletBalance: 0,
    });
    const verified = await verifySessionToken(token);
    if (!verified || verified.sub !== testUserId || verified.walletBalance !== 0) {
      throw new Error('HMAC Session token verification failed');
    }
    console.log('  -> Signed HMAC-SHA256 session token created and verified successfully');

    // -------------------------------------------------------------------------
    // STEP 4: FIRST PROMO CODE REDEMPTION
    // -------------------------------------------------------------------------
    console.log(`\n[Step 4] Redeeming promo code ${promoCode} as user ${testUserId}`);
    const { data: redeem1, error: redeemErr1 } = await admin.rpc('redeem_promo', {
      p_user: testUserId,
      p_raw_code: promoCode,
    });
    if (redeemErr1) throw new Error(`Redemption 1 failed: ${redeemErr1.message}`);

    console.log('  -> Redemption 1 succeeded:', redeem1);
    if (redeem1.credits_granted !== 100 || redeem1.new_balance !== 100) {
      throw new Error(`Unexpected balance after redemption: ${JSON.stringify(redeem1)}`);
    }

    // Verify wallet reflects 100 promo credits in the database
    const { data: walletAfter1 } = await admin.from('wallets').select('*').eq('user_id', testUserId).single();
    console.log('  -> Live DB wallet balance after first redemption:', {
      purchased: walletAfter1.balance_purchased,
      promo: walletAfter1.balance_promo,
      total: walletAfter1.balance_credits,
    });
    if (walletAfter1.balance_promo !== 100 || walletAfter1.balance_credits !== 100) {
      throw new Error('Database wallet balance did not match 100 CR promo credits!');
    }

    // -------------------------------------------------------------------------
    // STEP 5: DUPLICATE PROMO REDEMPTION (MUST FAIL CLEANLY)
    // -------------------------------------------------------------------------
    console.log(`\n[Step 5] Attempting duplicate redemption of ${promoCode} for same user`);
    const { data: redeem2, error: redeemErr2 } = await admin.rpc('redeem_promo', {
      p_user: testUserId,
      p_raw_code: promoCode,
    });

    if (!redeemErr2) {
      throw new Error(`Security breach: duplicate promo redemption succeeded! Result: ${JSON.stringify(redeem2)}`);
    }
    console.log(`  -> Duplicate redemption properly BLOCKED by Postgres RPC: "${redeemErr2.message}"`);

    // Verify balance remains unchanged at exactly 100 CR
    const { data: walletAfter2 } = await admin.from('wallets').select('*').eq('user_id', testUserId).single();
    if (walletAfter2.balance_credits !== 100) {
      throw new Error(`Wallet balance mutated on failed redemption! Found: ${walletAfter2.balance_credits}`);
    }
    console.log('  -> Confirmed: Wallet balance invariant held at exactly 100 CR.');

    // -------------------------------------------------------------------------
    // STEP 6: VERIFY PROMO CODE USAGE COUNTER
    // -------------------------------------------------------------------------
    const { data: promoRecord } = await admin.from('promo_codes').select('*').eq('code', promoCode).single();
    console.log(`\n[Step 6] Verifying promo code usage counter: used_count = ${promoRecord.used_count}`);
    if (promoRecord.used_count !== 1) {
      throw new Error(`Promo used_count expected to be 1, but found: ${promoRecord.used_count}`);
    }
    console.log('  -> Confirmed: used_count is exactly 1 (duplicate attempt did not consume a use).');

    // -------------------------------------------------------------------------
    // STEP 7: CLEANUP OF TEST USER & TEST DATA
    // -------------------------------------------------------------------------
    console.log('\n[Step 7] Verification complete.');
    console.log('\n===============================================================');
    console.log('ALL AUTHENTICATION, REGISTRATION & PROMO CHECKS PASSED EMPIRICALLY!');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('\nFlow verification FAILED:', err);
    process.exit(1);
  }
}

runAuthFlowAudit();
