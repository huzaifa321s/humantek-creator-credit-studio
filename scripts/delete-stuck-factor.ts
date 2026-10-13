import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const userId = '0c6802ea-01b2-441a-b9a1-83bd628a4305'; // huzaifafurqan22@gmail.com
  const factorId = 'a9bfd228-3d6b-40f8-b460-da65ca6cf2ab';
  const { data, error } = await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
  console.log('Deleted stuck factor result:', { data, error });
}

run();
