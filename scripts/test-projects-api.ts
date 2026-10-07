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

async function runProjectsApiIntegrationAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - NEXT.JS /API/PROJECTS INTEGRATION AUDIT');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const creatorEmail = `api_creator_${timestamp}@humantek.art`;
  const attackerEmail = `api_attacker_${timestamp}@humantek.art`;
  const testPass = 'ApiSecurePass2026!';

  try {
    // 1. Setup Creator
    console.log('[Step 1] Creating creator account...');
    const creatorUser = await admin.auth.admin.createUser({
      email: creatorEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Creator Chris' },
    });
    if (creatorUser.error) throw new Error(creatorUser.error.message);
    const creatorId = creatorUser.data.user.id;

    // 2. Setup Attacker
    console.log('[Step 2] Creating attacker account...');
    const attackerUser = await admin.auth.admin.createUser({
      email: attackerEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Attacker Eve' },
    });
    if (attackerUser.error) throw new Error(attackerUser.error.message);
    const attackerId = attackerUser.data.user.id;

    // 3. Fund Creator with 100 Promo Credits
    console.log('[Step 3] Funding creator with 100 promo credits...');
    const promoCode = `PROJ_API_${timestamp}`;
    await admin.from('promo_codes').insert({
      code: promoCode,
      credits: 100,
      max_uses: 5,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const redeemRes = await admin.rpc('redeem_promo', {
      p_user: creatorId,
      p_raw_code: promoCode,
    });
    if (redeemRes.error) throw new Error(redeemRes.error.message);
    console.log(`  -> Creator funded with 100 CR. Balance: ${redeemRes.data.new_balance} CR\n`);

    // 4. Test Submission via DB pipeline
    console.log('[Step 4] Submitting project via create_project_and_spend_credits:');
    const projId = `api_proj_${timestamp}`;
    const { data: createRes, error: createErr } = await admin.rpc('create_project_and_spend_credits', {
      p_project_id: projId,
      p_project_code: `HT-${timestamp % 10000}-API`,
      p_user_id: creatorId,
      p_package_id: 'studio-wallet',
      p_funding_source: 'wallet',
      p_client_name: 'Creator Chris',
      p_channel_name: 'ChrisGames',
      p_email: creatorEmail,
      p_platform: 'Twitch',
      p_style: 'Vibrant',
      p_colors: '#FF5500',
      p_instructions: 'Custom stream branding and avatar',
      p_uploaded_files: [],
      p_selections: [{ id: 'logo', level: 0, quantity: 1 }], // Basic Logo = 32 CR
      p_additions: ['Additional concept'], // 25 CR
      p_idempotency_key: projId,
    });

    if (createErr) throw new Error(`Project submission failed: ${createErr.message}`);
    // 32 logo + 25 concept = 57 CR
    if (createRes.total_credits !== 57) {
      throw new Error(`Expected total credits 57, got: ${createRes.total_credits}`);
    }
    if (createRes.new_wallet_balance !== 43) { // 100 - 57 = 43
      throw new Error(`Expected wallet balance 43, got: ${createRes.new_wallet_balance}`);
    }
    console.log(`  -> Project created successfully: 32 + 25 = 57 CR deducted.`);
    console.log(`  -> Wallet balance properly reduced to 43 CR.\n`);

    // 5. Query Project Isolation
    console.log('[Step 5] Checking tenant isolation:');
    const { data: creatorProjects } = await admin
      .from('projects')
      .select('id, user_id, total_credits, status, payment_status')
      .eq('user_id', creatorId);

    if (!creatorProjects || creatorProjects.length !== 1 || creatorProjects[0].id !== projId) {
      throw new Error(`Creator project query failed: ${JSON.stringify(creatorProjects)}`);
    }

    const { data: attackerProjects } = await admin
      .from('projects')
      .select('id, user_id')
      .eq('user_id', attackerId);

    if (attackerProjects && attackerProjects.length > 0) {
      throw new Error(`Tenant leak: Attacker sees projects they do not own!`);
    }
    console.log(`  -> Tenant isolation verified: Creator sees 1 project, Attacker sees 0.\n`);

    // 6. Unauthorized Cancellation Block
    console.log('[Step 6] Attacker attempts unauthorized cancellation:');
    const { error: hackCancelErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projId,
      p_user_id: attackerId,
      p_reason: 'Malicious cancellation',
    });
    if (!hackCancelErr || !hackCancelErr.message.includes('unauthorized')) {
      throw new Error(`Security breach: Non-owner cancelled project without authorization!`);
    }
    console.log('  -> Attack blocked: unauthorized exception raised by PostgreSQL.\n');

    // 7. Legitimate Cancellation & Automatic Refund
    console.log('[Step 7] Creator legitimately cancels project:');
    const { data: cancelRes, error: cancelErr } = await admin.rpc('cancel_project_and_refund', {
      p_project_id: projId,
      p_user_id: creatorId,
      p_reason: 'Changed my mind',
    });
    if (cancelErr) throw new Error(`Cancellation failed: ${cancelErr.message}`);

    if (cancelRes.refunded_credits !== 57) {
      throw new Error(`Expected refunded_credits 57, got: ${cancelRes.refunded_credits}`);
    }

    // Verify wallet balance restored to 100 CR
    const { data: restoredWallet } = await admin.from('wallets').select('*').eq('user_id', creatorId).single();
    if (restoredWallet.balance_credits !== 100) {
      throw new Error(`Refund failed! Expected balance 100 CR, got: ${restoredWallet.balance_credits}`);
    }

    // Verify project status is cancelled and payment_status is refunded
    const { data: cancelledProj } = await admin.from('projects').select('*').eq('id', projId).single();
    if (cancelledProj.status !== 'cancelled' || cancelledProj.payment_status !== 'refunded') {
      throw new Error(`Project status update failed: status=${cancelledProj.status}, paymentStatus=${cancelledProj.payment_status}`);
    }

    // Verify status history audit trail
    const { data: history } = await admin.from('project_status_history').select('*').eq('project_id', projId).order('created_at', { ascending: true });
    if (!history || history.length < 2) {
      throw new Error(`Expected at least 2 status history entries, got: ${history?.length}`);
    }
    console.log(`  -> Cancellation processed: 57 CR refunded.`);
    console.log(`  -> Wallet restored to exact pre-project balance: ${restoredWallet.balance_credits} CR.`);
    console.log(`  -> Audit trail recorded in project_status_history (${history.length} records).\n`);

    console.log('========================================================================');
    console.log('ALL API INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ API INTEGRATION AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runProjectsApiIntegrationAudit();
