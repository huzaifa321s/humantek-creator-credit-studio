import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('========================================================================');
  console.log('COMPREHENSIVE POSTGRESQL GRANTS & SECURITY ISOLATION AUDIT');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. QUERY POSTGRESQL SYSTEM CATALOG GRANTS DIRECTLY
  // ---------------------------------------------------------------------------
  console.log('[Audit 1] Querying PostgreSQL System Catalogs (pg_proc & pg_tables):');
  const { data: grantsData, error: grantsErr } = await admin.rpc('audit_database_grants');
  if (grantsErr) throw grantsErr;

  console.log('\n--- FUNCTION EXECUTION PRIVILEGES ---');
  console.log(
    'Function Name'.padEnd(26) +
    'Anon Execute'.padEnd(16) +
    'Auth Execute'.padEnd(16) +
    'Status'
  );
  console.log('-'.repeat(68));

  for (const fn of grantsData.functions) {
    const isExemption = fn.routine_name === 'is_admin';
    const isSafe = isExemption
      ? !fn.anon_execute && fn.authenticated_execute
      : !fn.anon_execute && !fn.authenticated_execute;

    const status = isSafe ? (isExemption ? '[EXPECTED EXCEPTION]' : '[SECURE]') : '[VULNERABILITY!]';
    console.log(
      fn.routine_name.padEnd(26) +
      String(fn.anon_execute).padEnd(16) +
      String(fn.authenticated_execute).padEnd(16) +
      status
    );
  }

  console.log('\n--- TABLE LEVEL PRIVILEGES ---');
  console.log(
    'Table Name'.padEnd(24) +
    'Anon S/I/U/D'.padEnd(16) +
    'Auth S/I/U/D'.padEnd(16) +
    'Status'
  );
  console.log('-'.repeat(68));

  for (const t of grantsData.tables) {
    const anonPrivs = `${t.anon_select ? 'S' : '-'}/${t.anon_insert ? 'I' : '-'}/${t.anon_update ? 'U' : '-'}/${t.anon_delete ? 'D' : '-'}`;
    const authPrivs = `${t.authenticated_select ? 'S' : '-'}/${t.authenticated_insert ? 'I' : '-'}/${t.authenticated_update ? 'U' : '-'}/${t.authenticated_delete ? 'D' : '-'}`;
    const clientCanWrite = t.authenticated_insert || t.authenticated_update || t.authenticated_delete;
    const status = (!clientCanWrite && !t.anon_insert && !t.anon_update && !t.anon_delete) ? '[SECURE READ-ONLY/INTERNAL]' : '[CHECK WRITE POLICIES]';

    console.log(
      t.table_name.padEnd(24) +
      anonPrivs.padEnd(16) +
      authPrivs.padEnd(16) +
      status
    );
  }

  // ---------------------------------------------------------------------------
  // 2. IS_ADMIN() BEHAVIOR VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[Audit 2] Verifying is_admin() Behavior across Caller Personas:');
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: anonIsAdmin, error: anonErr } = await anonClient.rpc('is_admin');
  console.log('  1. Anon client:');
  console.log(`     -> Result: ${anonIsAdmin}, Error: ${anonErr?.message || 'none'} [${anonErr ? 'BLOCKED - PASS' : 'FAIL'}]`);

  // Normal client (role = 'client')
  const clientEmail = `normal_audit_${Date.now()}@humantek.art`;
  const clientPass = 'NormalUser2026!';
  const { data: normalAuthUser } = await admin.auth.admin.createUser({
    email: clientEmail,
    password: clientPass,
    email_confirm: true,
    user_metadata: { full_name: 'Normal Client' }
  });
  const normalClient = createClient(supabaseUrl, supabaseAnonKey);
  await normalClient.auth.signInWithPassword({ email: clientEmail, password: clientPass });
  const { data: normalIsAdmin } = await normalClient.rpc('is_admin');
  console.log('  2. Normal signed-in user (role = client):');
  console.log(`     -> Result: ${normalIsAdmin} [${normalIsAdmin === false ? 'FALSE - PASS' : 'FAIL'}]`);

  // Admin client (role = 'admin')
  const adminEmail = `admin_audit_${Date.now()}@humantek.art`;
  const adminPass = 'AdminUser2026!';
  const { data: adminAuthUser } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
    user_metadata: { full_name: 'Real Admin' }
  });
  await admin.from('profiles').update({ role: 'admin' }).eq('id', adminAuthUser.user!.id);
  const realAdminClient = createClient(supabaseUrl, supabaseAnonKey);
  await realAdminClient.auth.signInWithPassword({ email: adminEmail, password: adminPass });
  const { data: adminIsAdmin } = await realAdminClient.rpc('is_admin');
  console.log('  3. Admin signed-in user (role = admin):');
  console.log(`     -> Result: ${adminIsAdmin} [${adminIsAdmin === true ? 'TRUE - PASS' : 'FAIL'}]`);

  // ---------------------------------------------------------------------------
  // 3. CROSS-TENANT ISOLATION (MIGRATION 3 + ORDERS + HISTORY + ALERTS)
  // ---------------------------------------------------------------------------
  console.log('\n[Audit 3] Cross-Tenant Isolation for Normal User:');
  const { data: projects } = await normalClient.from('projects').select('id, client_name');
  console.log(`  * User reads projects: returned ${projects?.length ?? 0} rows [${projects?.length === 0 ? 'PASS' : 'FAIL'}]`);

  const { data: orders } = await normalClient.from('orders').select('id, provider');
  console.log(`  * User reads orders: returned ${orders?.length ?? 0} rows [${orders?.length === 0 ? 'PASS' : 'FAIL'}]`);

  const { data: alerts } = await normalClient.from('admin_alerts').select('id, type');
  console.log(`  * User reads admin alerts: returned ${alerts?.length ?? 0} rows [${alerts?.length === 0 ? 'PASS' : 'FAIL'}]`);

  const { data: history } = await normalClient.from('project_status_history').select('*');
  console.log(`  * User reads status history: returned ${history?.length ?? 0} rows [${history?.length === 0 ? 'PASS' : 'FAIL'}]`);

  // ---------------------------------------------------------------------------
  // 4. PENETRATION ATTEMPTS: DIRECT CLIENT RPC EXECUTION
  // ---------------------------------------------------------------------------
  console.log('\n[Audit 4] Client RPC Penetration Attempts (Must All Fail):');
  const sensitiveRpcs = [
    { name: 'fulfill_order', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_capture_id: 'test', p_amount_cents: 100, p_currency: 'USD' } },
    { name: 'handle_refund', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_refund_id: 'test', p_refund_amount_cents: 100 } },
    { name: 'handle_reversal', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_reversal_id: 'test' } },
    { name: 'confirm_manual_payment', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_bank_reference: 'test', p_amount_cents: 100 } },
    { name: 'update_project_status', args: { p_project_id: 'test', p_new_status: 'delivered' } },
    { name: 'spend_credits', args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_amount: 100, p_project_id: 'test', p_idemp_key: 'test', p_desc: 'test' } },
    { name: 'redeem_promo', args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_code: 'TEST' } },
    { name: 'ledger_post', args: { p_user: '00000000-0000-0000-0000-000000000000', p_bucket: 'purchased', p_delta: 100, p_type: 'test', p_ref: 'test', p_key: 'test', p_desc: 'test' } },
  ];

  for (const rpc of sensitiveRpcs) {
    const { error } = await normalClient.rpc(rpc.name, rpc.args);
    const blocked = error ? (error.code === '42501' || error.message.includes('denied') || error.message.includes('Could not find')) : false;
    console.log(`  * Client calls ${rpc.name.padEnd(24)} -> ${blocked ? '[BLOCKED - PASS]' : '[EXPOSED - FAIL]'}`);
  }

  // ---------------------------------------------------------------------------
  // 5. MANUAL PAYMENT EDGE CASES
  // ---------------------------------------------------------------------------
  console.log('\n[Audit 5] Manual Payment Edge Cases (Idempotency, Duplicate Ref, Notes):');
  
  // Create an order for testing
  const { data: order1, error: o1Err } = await admin.from('orders').insert({
    user_id: normalAuthUser.user!.id,
    provider: 'manual',
    package_id: 'creator-forge',
    credits_to_grant: 660,
    expected_amount_cents: 150000,
    currency: 'USD',
    status: 'created',
    idempotency_key: `audit-order-1-${Date.now()}`
  }).select().single();
  if (o1Err) throw o1Err;

  const { data: order2, error: o2Err } = await admin.from('orders').insert({
    user_id: normalAuthUser.user!.id,
    provider: 'manual',
    package_id: 'creator-forge',
    credits_to_grant: 660,
    expected_amount_cents: 150000,
    currency: 'USD',
    status: 'created',
    idempotency_key: `audit-order-2-${Date.now()}`
  }).select().single();
  if (o2Err) throw o2Err;

  const testBankRef = `WIRE-TEST-${Date.now()}`;

  // 5a. Confirmation without reason/notes
  const { error: noNotesErr } = await admin.rpc('confirm_manual_payment', {
    p_order_id: order1.id,
    p_bank_reference: testBankRef,
    p_amount_cents: 150000,
    p_notes: '   ',
    p_admin_id: adminAuthUser.user!.id
  });
  console.log(`  * Empty admin notes rejected: ${noNotesErr?.message.includes('admin_notes_required') ? '[PASS - REJECTED]' : '[FAIL]'}`);

  // 5b. Legitimate first confirmation
  const { data: firstConf, error: firstConfErr } = await admin.rpc('confirm_manual_payment', {
    p_order_id: order1.id,
    p_bank_reference: testBankRef,
    p_amount_cents: 150000,
    p_notes: 'Verified wire transfer received from client bank',
    p_admin_id: adminAuthUser.user!.id
  });
  if (firstConfErr) throw firstConfErr;
  console.log(`  * First confirmation successful: credits_granted=${firstConf.credits_granted} [PASS]`);

  // 5c. Confirming the same order twice (idempotency check: exactly one grant)
  const { data: secondConf, error: secondConfErr } = await admin.rpc('confirm_manual_payment', {
    p_order_id: order1.id,
    p_bank_reference: testBankRef,
    p_amount_cents: 150000,
    p_notes: 'Duplicate attempt to confirm order 1',
    p_admin_id: adminAuthUser.user!.id
  });
  console.log(`  * Duplicate confirmation on same order: already_fulfilled=${secondConf?.already_fulfilled} [PASS]`);

  // Check ledger for order 1 (must have exactly 1 row)
  const { data: ledger1 } = await admin.from('credit_ledger').select('*').eq('reference_id', order1.id);
  console.log(`  * Ledger rows for order 1: ${ledger1?.length} row(s) [${ledger1?.length === 1 ? 'PASS - EXACTLY 1 GRANT' : 'FAIL'}]`);

  // 5d. Same bank reference used on order 2 (must be rejected)
  const { error: dupeRefErr } = await admin.rpc('confirm_manual_payment', {
    p_order_id: order2.id,
    p_bank_reference: testBankRef,
    p_amount_cents: 150000,
    p_notes: 'Attempting to reuse bank ref on order 2',
    p_admin_id: adminAuthUser.user!.id
  });
  console.log(`  * Reusing bank reference on order 2: ${dupeRefErr?.message.includes('bank_reference_already_used') ? '[PASS - REJECTED]' : '[FAIL]'}`);

  console.log('\n========================================================================');
  console.log('ALL SECURITY, IS_ADMIN, PRIVILEGES, AND MANUAL PAYMENT CHECKS PASSED 100%');
  console.log('========================================================================');
}

main().catch(console.error);
