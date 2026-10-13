import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function findAdmins() {
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('role', 'admin');

  console.log('=== ADMIN PROFILES IN DATABASE ===');
  console.log(JSON.stringify(adminProfiles, null, 2));

  // Also check all factors in auth.mfa
  for (const prof of adminProfiles || []) {
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: prof.id });
    console.log(`Factors for ${prof.email} (${prof.id}):`, factors);
  }
}

findAdmins();
