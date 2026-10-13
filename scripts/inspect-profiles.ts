import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, role, full_name, avatar_url');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  console.log('--- ALL PROFILES IN DATABASE ---');
  console.log(JSON.stringify(profiles, null, 2));
}

inspect();
