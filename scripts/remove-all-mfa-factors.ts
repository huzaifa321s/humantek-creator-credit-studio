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

async function main() {
  console.log('Fetching all users to remove any MFA factors...');
  const { data: usersData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('Error listing users:', listErr);
    process.exit(1);
  }

  let totalDeleted = 0;
  for (const user of usersData.users) {
    const { data: factorsData, error: factorsErr } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (factorsErr) {
      console.warn(`Could not list factors for ${user.email}:`, factorsErr.message);
      continue;
    }

    const factors = factorsData?.factors || [];
    for (const factor of factors) {
      console.log(`Deleting factor ${factor.id} (${factor.friendly_name || factor.factor_type}, ${factor.status}) for ${user.email}...`);
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
      if (delErr) {
        console.error(`Failed to delete factor ${factor.id}:`, delErr);
      } else {
        totalDeleted++;
        console.log(`  ✓ Deleted factor ${factor.id}`);
      }
    }
  }

  console.log(`\nCompleted! Total MFA factors deleted: ${totalDeleted}`);
}

main().catch(console.error);
