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
  console.log('AUDIT: IS_ADMIN() FUNCTION BEHAVIOR & PG PRIVILEGE GRANTS');
  console.log('========================================================================\n');


  // Role A: Anonymous (no session)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: anonIsAdmin, error: anonErr } = await anonClient.rpc('is_admin');
  console.log('[Check 1] Anon client calls is_admin():');
  console.log('  -> Result:', anonIsAdmin, anonErr ? `(Error: ${anonErr.message})` : '');

  // Role B: Authenticated Normal User (role = 'client')
  const clientEmail = `normal_audit_${Date.now()}@humantek.art`;
  const clientPass = 'NormalUser2026!';
  const { data: normalAuthUser, error: normalCreateErr } = await admin.auth.admin.createUser({
    email: clientEmail,
    password: clientPass,
    email_confirm: true,
    user_metadata: { full_name: 'Normal Client' }
  });
  if (normalCreateErr) throw normalCreateErr;

  const normalClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: normalSession, error: loginErr } = await normalClient.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass
  });
  if (loginErr) throw loginErr;

  const { data: normalIsAdmin, error: normalRpcErr } = await normalClient.rpc('is_admin');
  console.log('\n[Check 2] Normal authenticated user (role = client) calls is_admin():');
  console.log('  -> Result:', normalIsAdmin, normalRpcErr ? `(Error: ${normalRpcErr.message})` : '');

  // Role C: Authenticated Admin User (role = 'admin')
  const adminEmail = `admin_audit_${Date.now()}@humantek.art`;
  const adminPass = 'AdminUser2026!';
  const { data: adminAuthUser, error: adminCreateErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
    user_metadata: { full_name: 'Real Admin' }
  });
  if (adminCreateErr) throw adminCreateErr;

  await admin.from('profiles').update({ role: 'admin' }).eq('id', adminAuthUser.user.id);

  const realAdminClient = createClient(supabaseUrl, supabaseAnonKey);
  await realAdminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass
  });

  const { data: realAdminIsAdmin, error: adminRpcErr } = await realAdminClient.rpc('is_admin');
  console.log('\n[Check 3] Real Admin authenticated user (role = admin) calls is_admin():');
  console.log('  -> Result:', realAdminIsAdmin, adminRpcErr ? `(Error: ${adminRpcErr.message})` : '');

  // Role D: Cross-tenant isolation re-check (Normal client tries to read someone else's data)
  console.log('\n[Check 4] Cross-tenant read isolation with authenticated normal client:');
  const { data: projects, error: projErr } = await normalClient.from('projects').select('id, client_name');
  console.log('  -> Projects returned for normal user:', projects?.length ?? 0, projErr ? projErr.message : '');

  const { data: orders, error: orderErr } = await normalClient.from('orders').select('id, amount_cents');
  console.log('  -> Orders returned for normal user:', orders?.length ?? 0, orderErr ? orderErr.message : '');

  const { data: alerts, error: alertErr } = await normalClient.from('admin_alerts').select('id, type');
  console.log('  -> Admin alerts returned for normal user:', alerts?.length ?? 0, alertErr ? alertErr.message : '');

  const { data: statusHistory, error: histErr } = await normalClient.from('project_status_history').select('*');
  console.log('  -> Status history rows returned for normal user:', statusHistory?.length ?? 0, histErr ? histErr.message : '');

  // Role E: Grants Audit query
  console.log('\n[Check 5] Querying PostgreSQL grants table for sensitive RPCs:');
  // We can query using RPC or through information_schema / pg_catalog via admin if available, or direct select
  // Let's test calling sensitive RPCs directly as normalClient:
  const sensitiveRpcs = [
    { name: 'fulfill_order', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_provider_capture_id: 'test', p_amount_cents: 100 } },
    { name: 'handle_refund', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_refund_id: 'test', p_refund_amount_cents: 100 } },
    { name: 'handle_reversal', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_reversal_id: 'test' } },
    { name: 'confirm_manual_payment', args: { p_order_id: '00000000-0000-0000-0000-000000000000', p_bank_reference: 'test', p_amount_cents: 100 } },
    { name: 'update_project_status', args: { p_project_id: 'test', p_new_status: 'delivered' } },
    { name: 'spend_credits', args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_project_id: 'test', p_cost_credits: 100 } },
    { name: 'redeem_promo', args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_code: 'TEST' } },
    { name: 'ledger_post', args: { p_user: '00000000-0000-0000-0000-000000000000', p_bucket: 'purchased', p_delta: 100, p_type: 'test', p_ref: 'test', p_key: 'test', p_desc: 'test' } },
  ];

  for (const rpc of sensitiveRpcs) {
    const { error: rpcError } = await normalClient.rpc(rpc.name, rpc.args);
    const blocked = rpcError ? (rpcError.message.includes('denied') || rpcError.code === '42501' || rpcError.message.includes('unauthorized') || rpcError.message.includes('function') || rpcError.message.includes('Could not find')) : false;
    console.log(`  * normalClient.rpc('${rpc.name}'): ${blocked ? '[BLOCKED]' : '[EXPOSED!]'} -> ${rpcError?.message || 'SUCCESS (VULNERABILITY!)'}`);
  }
}

main().catch(console.error);
