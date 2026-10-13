import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data: users } = await admin.auth.admin.listUsers();
  const adm = users?.users.find((u) => u.email === 'admin@humantek.art');
  if (!adm) {
    console.log('admin@humantek.art not found');
    return;
  }
  console.log('Admin ID:', adm.id);
  const { data: factors, error } = await admin.auth.admin.mfa.listFactors({ userId: adm.id });
  console.log('Admin MFA factors:', JSON.stringify(factors, null, 2), 'error:', error);
}

run();
