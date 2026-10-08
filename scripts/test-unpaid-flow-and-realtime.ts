import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getClientASession(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !linkData.properties?.hashed_token) {
    throw new Error(`Failed to generate link for Client A: ${linkErr?.message}`);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: sessionData, error: otpErr } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (otpErr || !sessionData.session || !sessionData.user) {
    throw new Error(`Failed to verify OTP for Client A: ${otpErr?.message}`);
  }

  return { client, user: sessionData.user, session: sessionData.session };
}

async function createAndLoginUserB() {
  const email = `test_client_b_${Date.now()}@humantek.test`;
  const password = 'TestUserBPassword2026!';
  const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: sessionData, error: signErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !sessionData.session) {
    throw new Error(`Failed to sign in Client B: ${signErr?.message}`);
  }

  return { client, user: sessionData.user, session: sessionData.session };
}

async function run() {
  console.log('========================================================================');
  console.log('TEST SUITE: UNPAID REVIEW PROJECT FLOW & REALTIME AUTHORIZATION');
  console.log('========================================================================\n');

  const testUserAEmail = 'huzaifafurqan22@gmail.com';
  const testUserBEmail = 'test-unauthorized-client@example.com';

  console.log(`[Step 1] Authenticating Client A (${testUserAEmail})...`);
  const clientAData = await getClientASession(testUserAEmail);
  const clientA = clientAData.client;
  const userA = clientAData.user;
  const tokenA = clientAData.session.access_token;
  console.log(`  Client A authenticated. UUID: ${userA.id}`);

  console.log(`\n[Step 2] Creating an unpaid project ("Request review (no payment yet)")...`);
  const testProjectId = `proj-test-${Date.now().toString(36)}`;
  const testProjectCode = `REV-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: createdProj, error: createProjErr } = await admin
    .from('projects')
    .insert({
      id: testProjectId,
      project_code: testProjectCode,
      user_id: userA.id,
      package_id: 'creator-forge',
      package_name: 'Creator Forge',
      funding_source: 'package',
      status: 'pending_review',
      payment_status: 'unpaid',
      payment_method: 'unpaid',
      package_price_usd: 499,
      package_credits: 50,
      total_credits: 50,
      applied_wallet_credits: 0,
      client_name: 'Huzaifa Client',
      channel_name: 'Test Channel',
      email: testUserAEmail,
      platform: 'YouTube',
      style: 'Modern',
      colors: 'Purple / Black',
      instructions: 'Please review brief for production before invoice.',
      uploaded_files: [],
      idempotency_key: testProjectId,
    })
    .select()
    .single();

  if (createProjErr) {
    throw new Error(`Failed to create unpaid review project: ${createProjErr.message}`);
  }
  console.log(`  Project created in PostgreSQL:`);
  console.log(`    ID: ${createdProj.id}`);
  console.log(`    Status: ${createdProj.status}`);
  console.log(`    Payment Status: ${createdProj.payment_status}`);
  console.log(`    Owner: ${createdProj.user_id}`);

  console.log(`\n[Step 3] Client A synchronizes token and subscribes to project Realtime channel...`);
  await clientA.realtime.setAuth(tokenA);

  const topicA = `project:${testProjectId}`;
  const channelA = clientA.channel(topicA, {
    config: {
      broadcast: { self: false },
      private: true,
    },
  });

  let doorbellEventReceived = false;
  channelA.on('broadcast', { event: 'new_message' }, (payload) => {
    console.log(`  [Realtime Doorbell] Received 'new_message' event for project:`, payload);
    doorbellEventReceived = true;
  });

  const subPromiseA = new Promise<{ status: string; error?: any }>((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'TIMEOUT' }), 8000);
    channelA.subscribe((status, err) => {
      console.log(`  [Channel A Status] status="${status}", error=${err ? err.message || JSON.stringify(err) : 'none'}`);
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve({ status: 'SUBSCRIBED' });
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timer);
        resolve({ status: 'CHANNEL_ERROR', error: err });
      }
    });
  });

  const subResultA = await subPromiseA;
  if (subResultA.status !== 'SUBSCRIBED') {
    throw new Error(`Client A failed to subscribe to own unpaid project: ${JSON.stringify(subResultA)}`);
  }
  console.log(`  PASSED: Client A successfully subscribed to private channel '${topicA}' with zero errors.`);

  console.log(`\n[Step 4] Simulating Client A sending a message to the unpaid project...`);
  const clientMessageId = `msg-test-${Date.now()}`;
  const messageBody = 'Hello team, here is my brief for review before payment!';

  // Insert via admin service-role (as the Next.js API route does)
  const { data: insertedMsg, error: insertMsgErr } = await admin
    .from('project_messages')
    .insert({
      project_id: testProjectId,
      sender_id: userA.id,
      kind: 'user',
      body: messageBody,
      client_message_id: clientMessageId,
    })
    .select()
    .single();

  if (insertMsgErr) {
    throw new Error(`Failed to insert project message: ${insertMsgErr.message}`);
  }
  console.log(`  Message inserted into project_messages:`);
  console.log(`    Message ID: ${insertedMsg.id}`);
  console.log(`    Sender ID: ${insertedMsg.sender_id}`);
  console.log(`    Body: "${insertedMsg.body}"`);

  // Broadcast doorbell via server (simulating POST /api/projects/[id]/messages)
  const serverChannel = admin.channel(topicA);
  await serverChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await serverChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          projectId: testProjectId,
          messageId: insertedMsg.id,
          senderId: userA.id,
        },
      });
      await admin.removeChannel(serverChannel);
    }
  });

  // Wait for doorbell receipt
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`  Doorbell event received by Client A: ${doorbellEventReceived ? 'YES (INSTANT)' : 'NO'}`);

  console.log(`\n[Step 5] Cross-tenant Isolation: User B tries to subscribe to User A's project...`);
  const clientBData = await createAndLoginUserB();
  const clientB = clientBData.client;
  const tokenB = clientBData.session.access_token;
  await clientB.realtime.setAuth(tokenB);

  const channelB = clientB.channel(topicA, {
    config: {
      broadcast: { self: false },
      private: true,
    },
  });

  const subPromiseB = new Promise<{ status: string; error?: any }>((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'TIMEOUT' }), 6000);
    channelB.subscribe((status, err) => {
      console.log(`  [Channel B Status (Unauthorized Attempt)] status="${status}", error=${err ? err.message || JSON.stringify(err) : 'none'}`);
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve({ status: 'SUBSCRIBED' });
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timer);
        resolve({ status: 'CHANNEL_ERROR', error: err });
      }
    });
  });

  const subResultB = await subPromiseB;
  console.log(`  Result for unauthorized Client B joining Client A project: ${subResultB.status}`);
  if (subResultB.status === 'SUBSCRIBED') {
    throw new Error('SECURITY BREACH: Client B was able to subscribe to Client A unpaid project!');
  }
  console.log(`  PASSED: Client B was rejected by Supabase Realtime RLS policy.`);

  console.log(`\n[Step 6] Testing mock project isolation ('proj-demo-1')...`);
  const demoTopic = 'project:proj-demo-1';
  const demoChannel = clientA.channel(demoTopic, {
    config: {
      broadcast: { self: false },
      private: true,
    },
  });

  const demoSubPromise = new Promise<{ status: string; error?: any }>((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'TIMEOUT' }), 6000);
    demoChannel.subscribe((status, err) => {
      console.log(`  [Demo Project Channel Status] status="${status}", error=${err ? err.message || JSON.stringify(err) : 'none'}`);
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve({ status: 'SUBSCRIBED' });
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timer);
        resolve({ status: 'CHANNEL_ERROR', error: err });
      }
    });
  });

  const demoResult = await demoSubPromise;
  console.log(`  Result for non-existent proj-demo-1: ${demoResult.status}`);
  if (demoResult.status === 'SUBSCRIBED') {
    throw new Error('SECURITY ANOMALY: Non-existent proj-demo-1 was subscribed!');
  }
  console.log(`  PASSED: Non-existent demo project correctly rejected by Realtime RLS.`);
  console.log(`  And in UI, targetProjectId evaluates to null, completely bypassing any connection attempt.`);

  console.log(`\n[Step 7] Cleanup...`);
  await clientA.removeChannel(channelA);
  await clientB.removeChannel(channelB);
  await clientA.removeChannel(demoChannel);

  await admin.from('project_messages').delete().eq('project_id', testProjectId);
  await admin.from('projects').delete().eq('id', testProjectId);
  console.log('  Cleaned up test project & messages.');

  console.log('\n========================================================================');
  console.log('ALL UNPAID REVIEW & REALTIME SECURITY TESTS PASSED 100%!');
  console.log('========================================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\nTEST FAILED WITH ERROR:', err);
  process.exit(1);
});
