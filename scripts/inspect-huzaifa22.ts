import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function inspectUser() {
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('email', 'huzaifafurqan22@gmail.com')
    .single();

  console.log('--- PROFILES TABLE ---');
  console.log(profile);

  const { data: { users } } = await admin.auth.admin.listUsers();
  const authUser = users.find(u => u.email?.toLowerCase() === 'huzaifafurqan22@gmail.com');

  console.log('--- AUTH.USERS RECORD ---');
  if (authUser) {
    console.log({
      id: authUser.id,
      email: authUser.email,
      app_metadata: authUser.app_metadata,
      user_metadata: authUser.user_metadata,
      identities: authUser.identities?.map(i => ({ provider: i.provider, identity_data: i.identity_data })),
    });
  } else {
    console.log('User not found in auth.users');
  }
}

inspectUser();
