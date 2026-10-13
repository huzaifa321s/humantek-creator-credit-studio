import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function resetClient() {
  const userId = '0c6802ea-01b2-441a-b9a1-83bd628a4305'; // huzaifafurqan22@gmail.com
  
  // 1. Revoke / Sign out all active sessions globally in Supabase
  try {
    const { error: signOutErr } = await admin.auth.admin.signOut(userId, 'global');
    console.log('Revoked all sessions globally for user:', { signOutErr });
  } catch (e) {
    console.warn('Signout note:', e);
  }

  // 2. Set role to 'client' in public.profiles so this account is a normal client
  const { data: updatedProfile, error: profileErr } = await admin
    .from('profiles')
    .update({ role: 'client' })
    .eq('id', userId)
    .select('id, email, role, full_name')
    .single();

  console.log('Updated profile to client:', { updatedProfile, profileErr });

  // 3. Delete any remaining MFA factors so there are zero 2FA prompts
  const { data: factorList } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of factorList?.factors || []) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    console.log(`Deleted factor ${f.id}`);
  }
}

resetClient();
