import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspectUser() {
  const { data: users } = await admin.auth.admin.listUsers();
  const u = users?.users.find((x) => x.email === 'huzz3711@gmail.com');
  console.log('huzz3711 user data:', {
    provider: u?.app_metadata?.provider,
    raw_user_meta_data: u?.user_metadata,
  });
}

inspectUser();
