import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await admin
    .from('project_messages')
    .select('id, project_id, sender_id, kind, body, client_message_id, created_at, profiles(id, full_name, email, role)');

  console.log('Query result:', data, 'Error:', error);
}

main().catch(console.error);
