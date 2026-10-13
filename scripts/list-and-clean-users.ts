import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: usersData, error: uErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) {
    console.error('Error listing auth users:', uErr);
    return;
  }

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, email, role, full_name, avatar_url');

  if (pErr) {
    console.error('Error listing profiles:', pErr);
    return;
  }

  const profMap = new Map((profiles || []).map((p) => [p.id, p]));

  const adminUsers: any[] = [];
  const nonAdminUsers: any[] = [];

  for (const u of usersData?.users || []) {
    const prof = profMap.get(u.id);
    const item = {
      id: u.id,
      email: u.email,
      role: prof?.role || 'NO_PROFILE',
      full_name: prof?.full_name || 'N/A',
      provider: u.app_metadata?.provider || 'email',
    };
    if (prof?.role === 'admin') {
      adminUsers.push(item);
    } else {
      nonAdminUsers.push(item);
    }
  }

  console.log(`=== ADMINS TO PRESERVE (COUNT: ${adminUsers.length}) ===`);
  for (const a of adminUsers) {
    console.log(`- ID: ${a.id} | Email: ${a.email} | Name: ${a.full_name}`);
  }

  console.log(`\n=== NON-ADMIN USERS TO DELETE (COUNT: ${nonAdminUsers.length}) ===`);
  console.log('Sample of non-admin users to delete:');
  for (const c of nonAdminUsers.slice(0, 15)) {
    console.log(`- ID: ${c.id} | Email: ${c.email} | Role: ${c.role} | Provider: ${c.provider}`);
  }
  if (nonAdminUsers.length > 15) {
    console.log(`... and ${nonAdminUsers.length - 15} more non-admin users.`);
  }

  // Also check if huzaifafurqan22@gmail.com is in nonAdminUsers
  const targetUser = nonAdminUsers.find((u) => u.email === 'huzaifafurqan22@gmail.com');
  console.log('\nTarget test user huzaifafurqan22@gmail.com is in delete list:', !!targetUser);
}

run();
