import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MASTER_ADMIN_EMAIL = 'admin@humantek.art';
const MASTER_ADMIN_PASS = 'AdminPassword123!';

async function wipeDatabase() {
  console.log('========================================================================');
  console.log('WIPING ALL USERS EXCEPT MASTER ADMIN (admin@humantek.art)');
  console.log('========================================================================\n');

  // STEP 1: Ensure master admin exists or create it
  console.log('[1/12] Ensuring master admin account exists...');
  const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  let masterUser = existingUsers.users.find(
    (u) => u.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()
  );

  if (!masterUser) {
    console.log(`  Creating master admin ${MASTER_ADMIN_EMAIL}...`);
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: MASTER_ADMIN_EMAIL,
      password: MASTER_ADMIN_PASS,
      email_confirm: true,
      user_metadata: { full_name: 'Humantek Admin' },
    });
    if (createErr) throw createErr;
    masterUser = newUser.user;
    console.log(`  ✓ Created master admin with ID: ${masterUser.id}`);
  } else {
    console.log(`  Master admin exists with ID: ${masterUser.id}. Updating password & confirmation...`);
    await admin.auth.admin.updateUserById(masterUser.id, {
      password: MASTER_ADMIN_PASS,
      email_confirm: true,
      user_metadata: { full_name: 'Humantek Admin' },
    });
    console.log(`  ✓ Updated master admin credentials.`);
  }

  // Ensure profile exists for master admin
  await admin.from('profiles').upsert({
    id: masterUser.id,
    email: MASTER_ADMIN_EMAIL,
    role: 'admin',
    full_name: 'Humantek Admin',
    avatar_url: null,
  });

  const masterUserId = masterUser.id;

  // STEP 2: Delete project message attachments
  console.log('\n[2/12] Cleaning project message attachments...');
  const { error: errAtt } = await admin
    .from('project_message_attachments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (errAtt) console.warn('  Error:', errAtt.message);
  else console.log('  ✓ Cleared project message attachments.');

  // STEP 3: Delete project messages
  console.log('\n[3/12] Cleaning project messages...');
  const { error: errMsgs } = await admin
    .from('project_messages')
    .delete()
    .gte('id', 0);
  if (errMsgs) console.warn('  Error:', errMsgs.message);
  else console.log('  ✓ Cleared project messages.');

  // STEP 4: Delete project read states
  console.log('\n[4/12] Cleaning project read states...');
  const { error: errRead } = await admin
    .from('project_read_states')
    .delete()
    .gte('last_read_message_id', 0);
  if (errRead) console.warn('  Error:', errRead.message);
  else console.log('  ✓ Cleared project read states.');

  // STEP 5: Delete project child items & history
  console.log('\n[5/12] Cleaning project child items & history...');
  await admin.from('project_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('project_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('project_additions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✓ Cleared status history, items, and additions.');

  // STEP 6: Delete all projects
  console.log('\n[6/12] Cleaning projects table...');
  const { error: errProj } = await admin
    .from('projects')
    .delete()
    .neq('id', '__none__');
  if (errProj) console.warn('  Error:', errProj.message);
  else console.log('  ✓ Cleared all projects.');

  // STEP 7: Delete admin alerts & webhook events
  console.log('\n[7/12] Cleaning admin alerts and webhook events...');
  await admin.from('admin_alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('webhook_events').delete().gte('id', 0);
  console.log('  ✓ Cleared admin alerts and webhook events.');

  // STEP 8: Delete orders
  console.log('\n[8/12] Cleaning orders table...');
  const { error: errOrd } = await admin
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (errOrd) console.warn('  Error:', errOrd.message);
  else console.log('  ✓ Cleared all orders.');

  // STEP 9: Delete promo redemptions & credit ledger
  console.log('\n[9/12] Cleaning promo redemptions and credit ledger...');
  await admin.from('promo_redemptions').delete().gte('id', 0);
  await admin.from('credit_ledger').update({ reverses_id: null }).gte('id', 0);
  await admin.from('credit_ledger').delete().gte('id', 0);
  console.log('  ✓ Cleared promo redemptions and credit ledger.');

  // STEP 10: Delete wallets and profiles for ALL users EXCEPT master admin
  console.log('\n[10/12] Deleting non-master wallets and profiles...');
  const { error: errWallets } = await admin
    .from('wallets')
    .delete()
    .neq('user_id', masterUserId);
  if (errWallets) console.warn('  Error deleting wallets:', errWallets.message);
  else console.log('  ✓ Cleared non-master wallets.');

  const { error: errProfiles } = await admin
    .from('profiles')
    .delete()
    .neq('id', masterUserId);
  if (errProfiles) console.warn('  Error deleting profiles:', errProfiles.message);
  else console.log('  ✓ Cleared non-master profiles.');

  // STEP 11: Delete all users from auth.users EXCEPT master admin
  console.log('\n[11/12] Deleting users from auth.users (excluding master admin)...');
  const usersToDelete = existingUsers.users.filter((u) => u.id !== masterUserId);
  let deletedCount = 0;
  let failedCount = 0;

  for (const u of usersToDelete) {
    try {
      // First unenroll MFA factors if any to prevent foreign key errors
      const factorsRes = await admin.auth.admin.mfa.listFactors({ userId: u.id });
      if (factorsRes.data?.factors) {
        for (const f of factorsRes.data.factors) {
          await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: u.id });
        }
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.warn(`  Failed to delete auth user ${u.email} (${u.id}):`, delErr.message);
        failedCount++;
      } else {
        deletedCount++;
      }
    } catch (e: any) {
      console.warn(`  Error deleting ${u.email}:`, e.message);
      failedCount++;
    }
  }
  console.log(`  ✓ Successfully deleted ${deletedCount} auth.users accounts (${failedCount} failed).`);

  // STEP 12: Reset master admin wallet & baseline
  console.log('\n[12/12] Setting up master admin baseline...');
  await admin.from('profiles').upsert({
    id: masterUserId,
    email: MASTER_ADMIN_EMAIL,
    role: 'admin',
    full_name: 'Humantek Admin',
  });

  await admin.from('wallets').upsert({
    user_id: masterUserId,
    balance_purchased: 10000,
    balance_promo: 0,
    is_frozen: false,
  });
  console.log('  ✓ Master admin profile verified and wallet funded with 10,000 CR.');

  // FINAL VERIFICATION AUDIT
  console.log('\n========================================================================');
  console.log('DATABASE VERIFICATION AUDIT');
  console.log('========================================================================');

  const { count: finalP } = await admin.from('projects').select('*', { count: 'exact', head: true });
  const { count: finalM } = await admin.from('project_messages').select('*', { count: 'exact', head: true });
  const { count: finalO } = await admin.from('orders').select('*', { count: 'exact', head: true });
  const { count: finalLedger } = await admin.from('credit_ledger').select('*', { count: 'exact', head: true });
  const { count: finalProf } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  const { count: finalW } = await admin.from('wallets').select('*', { count: 'exact', head: true });
  const { data: finalUsers } = await admin.auth.admin.listUsers();

  console.log(`Projects:         ${finalP} rows`);
  console.log(`Messages:         ${finalM} rows`);
  console.log(`Orders:           ${finalO} rows`);
  console.log(`Ledger:           ${finalLedger} rows`);
  console.log(`Profiles:         ${finalProf} row (admin@humantek.art)`);
  console.log(`Wallets:          ${finalW} row (admin@humantek.art)`);
  console.log(`Auth Users:       ${finalUsers?.users.length} user (admin@humantek.art)`);

  console.log('\nActive Users in Supabase:');
  for (const u of finalUsers?.users || []) {
    console.log(`  -> ID: ${u.id} | Email: ${u.email} | Provider: ${u.app_metadata?.provider}`);
  }

  console.log('\n========================================================================');
  console.log('✓ FRESH DATABASE RESET COMPLETE!');
  console.log(`  Master Admin: ${MASTER_ADMIN_EMAIL}`);
  console.log(`  Password:     ${MASTER_ADMIN_PASS}`);
  console.log('========================================================================');
}

wipeDatabase().catch((err) => {
  console.error('Fatal error during database reset:', err);
  process.exit(1);
});
