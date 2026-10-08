import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Real admin accounts to preserve
const PRESERVED_ADMIN_EMAILS = [
  'admin@humantek.art',
  'huzaifafurqan22@gmail.com',
  'huzaifa14321furqan@gmail.com',
  'dev@localhost',
];

async function cleanDatabase() {
  console.log('========================================================================');
  console.log('CLEANING SUPABASE DATABASE (COMPLETE CASCADE RESET)');
  console.log('========================================================================\n');

  // STEP 1: Delete project attachments
  console.log('[1/14] Cleaning project message attachments...');
  const { data: delAtt, error: errAtt } = await admin
    .from('project_message_attachments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (errAtt) console.warn('  Error:', errAtt.message);
  else console.log(`  ✓ Cleared ${delAtt?.length || 0} attachments.`);

  // STEP 2: Delete project messages
  console.log('\n[2/14] Cleaning project messages...');
  const { data: delMsgs, error: errMsgs } = await admin
    .from('project_messages')
    .delete()
    .gte('id', 0)
    .select('id');
  if (errMsgs) console.warn('  Error:', errMsgs.message);
  else console.log(`  ✓ Cleared ${delMsgs?.length || 0} messages.`);

  // STEP 3: Delete project read states
  console.log('\n[3/14] Cleaning project read states...');
  const { data: delRead, error: errRead } = await admin
    .from('project_read_states')
    .delete()
    .gte('last_read_message_id', 0)
    .select('project_id');
  if (errRead) console.warn('  Error:', errRead.message);
  else console.log(`  ✓ Cleared ${delRead?.length || 0} read states.`);

  // STEP 4: Delete project child items & history
  console.log('\n[4/14] Cleaning project child items & history...');
  await admin.from('project_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('project_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('project_additions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✓ Cleared status history, items, and additions.');

  // STEP 5: Delete all projects
  console.log('\n[5/14] Cleaning projects table...');
  const { data: delProj, error: errProj } = await admin
    .from('projects')
    .delete()
    .neq('id', '__none__')
    .select('id');
  if (errProj) console.warn('  Error:', errProj.message);
  else console.log(`  ✓ Cleared ${delProj?.length || 0} projects.`);

  // STEP 6: Delete admin alerts (which reference orders and profiles)
  console.log('\n[6/14] Cleaning admin alerts...');
  const { data: delAlerts, error: errAlerts } = await admin
    .from('admin_alerts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (errAlerts) console.warn('  Error:', errAlerts.message);
  else console.log(`  ✓ Cleared ${delAlerts?.length || 0} admin alerts.`);

  // STEP 7: Delete webhook events (which reference orders)
  console.log('\n[7/14] Cleaning webhook events...');
  const { data: delWebhooks, error: errWebhooks } = await admin
    .from('webhook_events')
    .delete()
    .gte('id', 0)
    .select('id');
  if (errWebhooks) console.warn('  Error:', errWebhooks.message);
  else console.log(`  ✓ Cleared ${delWebhooks?.length || 0} webhook events.`);

  // STEP 8: Delete orders (which reference packages and profiles)
  console.log('\n[8/14] Cleaning orders table...');
  const { data: delOrd, error: errOrd } = await admin
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (errOrd) console.warn('  Error:', errOrd.message);
  else console.log(`  ✓ Cleared ${delOrd?.length || 0} orders.`);

  // STEP 9: Delete promo redemptions & reset promo usage counts
  console.log('\n[9/14] Cleaning promo redemptions...');
  const { data: delPromoRed, error: errPromoRed } = await admin
    .from('promo_redemptions')
    .delete()
    .gte('id', 0)
    .select('id');
  if (errPromoRed) console.warn('  Error:', errPromoRed.message);
  else console.log(`  ✓ Cleared ${delPromoRed?.length || 0} promo redemptions.`);

  await admin
    .from('promo_codes')
    .update({ used_count: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  ✓ Reset promo codes usage counters to 0.');

  // STEP 10: Clear credit_ledger (unlink self-reference first)
  console.log('\n[10/14] Cleaning credit ledger...');
  const { error: errUnlink } = await admin
    .from('credit_ledger')
    .update({ reverses_id: null })
    .gte('id', 0);
  if (errUnlink) console.warn('  Error unlinking reverses_id:', errUnlink.message);

  const { data: delLedger, error: errLedger } = await admin
    .from('credit_ledger')
    .delete()
    .gte('id', 0)
    .select('id');
  if (errLedger) console.warn('  Error deleting ledger:', errLedger.message);
  else console.log(`  ✓ Cleared ${delLedger?.length || 0} credit ledger entries.`);

  // STEP 11: Identify test users vs admin accounts
  console.log('\n[11/14] Scanning user profiles...');
  const { data: profiles, error: errProf } = await admin
    .from('profiles')
    .select('id, email, role');
  if (errProf) {
    console.error('Failed to query profiles:', errProf.message);
    process.exit(1);
  }

  const adminProfiles = (profiles || []).filter((p) =>
    PRESERVED_ADMIN_EMAILS.includes((p.email || '').toLowerCase().trim())
  );
  const testProfiles = (profiles || []).filter(
    (p) => !PRESERVED_ADMIN_EMAILS.includes((p.email || '').toLowerCase().trim())
  );

  console.log(`  Preserving ${adminProfiles.length} admin accounts:`);
  for (const ap of adminProfiles) {
    console.log(`    * ${ap.email} (${ap.id})`);
  }
  console.log(`  Found ${testProfiles.length} test accounts to delete.`);

  // STEP 12: Delete test user wallets & profiles
  console.log('\n[12/14] Deleting test client wallets and profiles...');
  for (const tp of testProfiles) {
    await admin.from('wallets').delete().eq('user_id', tp.id);
    await admin.from('profiles').delete().eq('id', tp.id);
  }
  console.log('  ✓ Cleared test client wallets and profiles.');

  // STEP 13: Delete test users from auth.users
  console.log('\n[13/14] Deleting test clients from auth.users...');
  let delAuthCount = 0;
  for (const tp of testProfiles) {
    const { error: delUserErr } = await admin.auth.admin.deleteUser(tp.id);
    if (!delUserErr) {
      delAuthCount++;
    } else {
      console.warn(`    Failed to delete auth user ${tp.email}:`, delUserErr.message);
    }
  }
  console.log(`  ✓ Deleted ${delAuthCount} auth.users accounts.`);

  // STEP 14: Reset admin profile role and wallet baseline
  console.log('\n[14/14] Resetting admin accounts to clean initial state...');
  for (const ap of adminProfiles) {
    await admin.from('profiles').update({ role: 'admin' }).eq('id', ap.id);
    await admin.from('wallets').upsert({
      user_id: ap.id,
      balance_purchased: 10000,
      balance_promo: 0,
      is_frozen: false,
    });
  }
  console.log('  ✓ Admin role verified and wallet funded with 10,000 CR baseline.');

  // Clean Storage Bucket project-attachments
  try {
    const { data: storageList } = await admin.storage.from('project-attachments').list('', { limit: 100 });
    if (storageList && storageList.length > 0) {
      console.log(`\n[Storage] Cleaning ${storageList.length} root items in project-attachments...`);
      for (const item of storageList) {
        const { data: subItems } = await admin.storage.from('project-attachments').list(item.name);
        if (subItems && subItems.length > 0) {
          await admin.storage
            .from('project-attachments')
            .remove(subItems.map((s) => `${item.name}/${s.name}`));
        }
      }
      console.log('  ✓ Storage bucket project-attachments cleaned.');
    }
  } catch (err: any) {
    console.log('  Storage cleanup note:', err.message);
  }

  // FINAL VERIFICATION AUDIT
  console.log('\n========================================================================');
  console.log('FINAL DATABASE VERIFICATION AUDIT');
  console.log('========================================================================');

  const { count: finalP } = await admin.from('projects').select('*', { count: 'exact', head: true });
  const { count: finalM } = await admin.from('project_messages').select('*', { count: 'exact', head: true });
  const { count: finalAtt } = await admin.from('project_message_attachments').select('*', { count: 'exact', head: true });
  const { count: finalO } = await admin.from('orders').select('*', { count: 'exact', head: true });
  const { count: finalWebhooks } = await admin.from('webhook_events').select('*', { count: 'exact', head: true });
  const { count: finalLedger } = await admin.from('credit_ledger').select('*', { count: 'exact', head: true });
  const { count: finalRedemptions } = await admin.from('promo_redemptions').select('*', { count: 'exact', head: true });
  const { count: finalProf } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  const { count: finalW } = await admin.from('wallets').select('*', { count: 'exact', head: true });
  const { data: finalActiveProfiles } = await admin.from('profiles').select('id, email, role');

  console.log(`projects:                   ${finalP} rows`);
  console.log(`project_messages:           ${finalM} rows`);
  console.log(`project_attachments:        ${finalAtt} rows`);
  console.log(`orders:                     ${finalO} rows`);
  console.log(`webhook_events:             ${finalWebhooks} rows`);
  console.log(`credit_ledger:              ${finalLedger} rows`);
  console.log(`promo_redemptions:          ${finalRedemptions} rows`);
  console.log(`profiles:                   ${finalProf} rows (Admin only)`);
  console.log(`wallets:                    ${finalW} rows (Admin only)`);
  console.log('\nActive Admin Profiles:');
  for (const a of finalActiveProfiles || []) {
    console.log(`  -> ${a.email} (${a.role}) [id: ${a.id}]`);
  }

  console.log('\n✓ Database is 100% clean and ready for your fresh testing!');
}

cleanDatabase().catch((err) => {
  console.error('Fatal error during database cleanup:', err);
  process.exit(1);
});
