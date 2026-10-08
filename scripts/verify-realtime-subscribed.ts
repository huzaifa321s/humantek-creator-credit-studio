import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('========================================================================');
  console.log('VERIFYING TIGHTENED POLICY & REALTIME SUBSCRIBED STATUS');
  console.log('========================================================================\n');

  // 1. Inspect tightened policy
  console.log('[1. Database Policy on realtime.messages]');
  const { data: policies, error: polErr } = await admin.rpc('check_realtime_policies');
  if (polErr) throw polErr;
  console.log(JSON.stringify(policies, null, 2));

  // 2. Real user sign in (Owner of proj-muz3vk7x-na18ew)
  const targetProjectId = 'proj-muz3vk7x-na18ew';
  const ownerEmail = 'huzaifafurqan22@gmail.com';

  console.log(`\n[2. Authenticating as Project Owner (${ownerEmail}) for Project ${targetProjectId}]`);
  
  // Generate magic link / session or use password
  // Let's create an ephemeral token for the owner
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ownerEmail,
  });

  if (linkErr || !linkData.properties?.hashed_token) {
    throw new Error(`Failed to generate link for owner: ${linkErr?.message}`);
  }

  // Verify OTP to get session
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: sessionData, error: otpErr } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (otpErr || !sessionData.session) {
    throw new Error(`Failed to verify OTP: ${otpErr?.message}`);
  }

  const accessToken = sessionData.session.access_token;
  console.log(`Owner signed in successfully. User UUID: ${sessionData.user?.id}`);
  console.log(`Access Token present: ${Boolean(accessToken)} (Length: ${accessToken.length})`);

  // 3. Set Auth on Realtime
  console.log('\n[3. Calling supabase.realtime.setAuth(accessToken)]');
  await client.realtime.setAuth(accessToken);

  // 4. Subscribe to private channel
  const topic = `project:${targetProjectId}`;
  console.log(`\n[4. Subscribing to Private Channel: ${topic}]`);
  const channel = client.channel(topic, {
    config: {
      broadcast: { self: false },
      private: true,
    },
  });

  const subscriptionResult = await new Promise<{ status: string; error?: any }>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ status: 'TIMEOUT' });
    }, 8000);

    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('Received broadcast payload:', payload);
      })
      .subscribe((status, err) => {
        console.log(`Channel callback fired: status="${status}", error=${err ? err.message || JSON.stringify(err) : 'none'}`);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve({ status: 'SUBSCRIBED' });
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          resolve({ status: 'CHANNEL_ERROR', error: err });
        }
      });
  });

  console.log('\n========================================================================');
  console.log('SUBSCRIPTION TEST RESULT:');
  console.log(`Status: ${subscriptionResult.status}`);
  if (subscriptionResult.error) {
    console.log(`Error: ${subscriptionResult.error.message || JSON.stringify(subscriptionResult.error)}`);
  }
  console.log('========================================================================');

  await client.removeChannel(channel);
  process.exit(subscriptionResult.status === 'SUBSCRIBED' ? 0 : 1);
}

main().catch((err) => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
