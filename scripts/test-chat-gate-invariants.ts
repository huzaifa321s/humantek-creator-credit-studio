import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function runChatGateAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - AUDIT: CENTRAL CHAT GATE INVARIANTS & COVERAGE');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Server Auth Computation (getRequestUser)
    // -------------------------------------------------------------------------
    console.log('[Test 1] Server-authoritative canChat calculation in src/lib/auth.ts:');
    const authCode = fs.readFileSync(path.join(process.cwd(), 'src/lib/auth.ts'), 'utf8');
    assert(
      authCode.includes('canChat = !isAdmin && role === \'client\' && emailConfirmed && hasProjects;'),
      'getRequestUser computes canChat strictly for verified clients owning >=1 project'
    );
    assert(
      authCode.includes('user.email_confirmed_at'),
      'emailConfirmed checks user.email_confirmed_at'
    );
    assert(
      authCode.includes("from('projects')") && authCode.includes('hasProjects = (count ?? 0) > 0;'),
      'hasProjects checks projects table count > 0'
    );

    // -------------------------------------------------------------------------
    // TEST 2: /api/auth/session returns canChat
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Session API endpoint returns accurate canChat flag:');
    const guestSessionRes = await fetch(`${BASE_URL}/api/auth/session`);
    const guestSessionData = await guestSessionRes.json();
    assert(
      guestSessionRes.status === 200,
      'GET /api/auth/session returns 200 for guest'
    );
    assert(
      guestSessionData.authenticated === false && guestSessionData.canChat === false,
      'Guest session data has authenticated=false and canChat=false'
    );

    // -------------------------------------------------------------------------
    // TEST 3: ChatGate component implementation & storage key auto-purging
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] ChatGate component and automatic storage key purging:');
    const chatGateCode = fs.readFileSync(path.join(process.cwd(), 'src/components/chat/ChatGate.tsx'), 'utf8');
    assert(
      chatGateCode.includes('humantek_project_chat_v6') &&
      chatGateCode.includes('humantek_client_chat_v2') &&
      chatGateCode.includes('humantek_client_chat_messages_v1'),
      'ChatGate tracks and purges all active and legacy chat storage keys'
    );
    assert(
      chatGateCode.includes('if (isLoading || !canChat) return <>{fallback}</>;'),
      'ChatGate renders fallback (null) when canChat is false or flags are loading'
    );
    assert(
      chatGateCode.includes('!isAdmin()'),
      'ChatGate preserves chat storage for admins and only purges guests/non-chat clients'
    );
    assert(
      chatGateCode.includes('return <>{children}</>;'),
      'ChatGate renders children ONLY when canChat is true'
    );

    // -------------------------------------------------------------------------
    // TEST 4: userStore.signOut() purges all chat storage keys
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] userStore signOut actively destroys chat storage keys:');
    const userStoreCode = fs.readFileSync(path.join(process.cwd(), 'src/lib/userStore.ts'), 'utf8');
    assert(
      userStoreCode.includes("localStorage.removeItem('humantek_project_chat_v6')") &&
      userStoreCode.includes("sessionStorage.removeItem('humantek_project_chat_v6')"),
      'userStore.signOut() removes humantek_project_chat_v6 from both localStorage & sessionStorage'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Comprehensive tagging of all chat entry points
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Verification that all chat entry points are tagged & gated:');
    
    // 1. Floating launcher & drawer in ChatFloatingWidget
    const floatingCode = fs.readFileSync(path.join(process.cwd(), 'src/components/chat/ChatFloatingWidget.tsx'), 'utf8');
    assert(
      floatingCode.includes('data-chat-entry="floating-launcher"') &&
      floatingCode.includes('data-chat-entry="floating-drawer"'),
      'ChatFloatingWidget tags launcher and drawer with data-chat-entry'
    );
    assert(
      floatingCode.includes('<ChatGate>'),
      'ChatFloatingWidget is wrapped in <ChatGate>'
    );

    // 2. Header chat button in DashboardHeader
    const headerCode = fs.readFileSync(path.join(process.cwd(), 'src/components/header/DashboardHeader.tsx'), 'utf8');
    assert(
      headerCode.includes('data-chat-entry="header-icon"') &&
      headerCode.includes('<ChatGate>'),
      'DashboardHeader tags header icon with data-chat-entry and wraps in <ChatGate>'
    );

    // 3. Sidebar chat links in StudioCardLayout
    const sidebarCode = fs.readFileSync(path.join(process.cwd(), 'src/components/StudioCardLayout.tsx'), 'utf8');
    assert(
      sidebarCode.includes('data-chat-entry="sidebar-link"') &&
      sidebarCode.includes('<ChatGate>'),
      'StudioCardLayout tags sidebar link with data-chat-entry and wraps in <ChatGate>'
    );

    // 4. Mobile footer and wizard buttons in new-project/page.tsx
    const wizardCode = fs.readFileSync(path.join(process.cwd(), 'src/app/new-project/page.tsx'), 'utf8');
    assert(
      wizardCode.includes('data-chat-entry="mobile-footer"'),
      'new-project tags mobile footer button with data-chat-entry="mobile-footer"'
    );
    assert(
      wizardCode.includes('data-chat-entry="package-questions-chat"'),
      'new-project tags Step 1 package questions with data-chat-entry="package-questions-chat"'
    );
    assert(
      wizardCode.includes('data-chat-entry="confirmation-chat"'),
      'new-project tags confirmation screen chat with data-chat-entry="confirmation-chat"'
    );
    assert(
      wizardCode.includes('data-chat-entry="brief-questions-chat"'),
      'new-project tags Step 5 brief review chat with data-chat-entry="brief-questions-chat"'
    );

    // 5. Projects page chat button
    const projectsCode = fs.readFileSync(path.join(process.cwd(), 'src/app/projects/page.tsx'), 'utf8');
    assert(
      projectsCode.includes('data-chat-entry="project-card-chat"') &&
      projectsCode.includes('<ChatGate>'),
      'Projects page tags project card chat button with data-chat-entry and wraps in <ChatGate>'
    );

    // 6. Messages page gate
    const messagesCode = fs.readFileSync(path.join(process.cwd(), 'src/app/messages/page.tsx'), 'utf8');
    assert(
      messagesCode.includes('<ChatGate fallback={<RedirectToProjects />}>'),
      '/messages page is protected by <ChatGate fallback={<RedirectToProjects />}>'
    );

    // 7. Search Dialog
    const searchCode = fs.readFileSync(path.join(process.cwd(), 'src/components/header/DashboardSearchDialog.tsx'), 'utf8');
    assert(
      searchCode.includes('...(canChat') &&
      searchCode.includes('nav-messages') &&
      searchCode.includes('action-chat'),
      'DashboardSearchDialog conditionally gates nav-messages and action-chat behind canChat'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Mobile Footer Responsive Layout
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Mobile footer styling rules:');
    assert(
      wizardCode.includes("currentStep === 1 ? \"w-full sm:w-auto sm:ml-auto\" : \"flex-1 sm:flex-none justify-end\""),
      'Step 1 Next button expands w-full on mobile, Steps 2-5 flex-1 on mobile'
    );
    assert(
      wizardCode.includes("w-full sm:w-auto justify-center"),
      'Next button has w-full sm:w-auto class on mobile'
    );

    // -------------------------------------------------------------------------
    // TEST 7: DB Level Verification for Client with vs without project
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Database & auth verification with real accounts:');
    const timestamp = Date.now();
    const clientEmail = `chat_gate_client_${timestamp}@humantek.art`;
    const clientPass = 'Password123!Secure';

    // Create client
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: clientEmail,
      password: clientPass,
      email_confirm: true,
      user_metadata: { full_name: 'Chat Test Client' },
    });

    if (createErr || !newUser.user) {
      throw new Error(`Failed to create client: ${createErr?.message}`);
    }

    const clientUserId = newUser.user.id;

    // Client has confirmed email, but 0 projects
    const { count: projCount0 } = await admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', clientUserId);

    assert(projCount0 === 0, 'New client has 0 projects');

    // Simulate login
    const clientLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clientEmail, password: clientPass }),
    });

    assert(clientLoginRes.status === 200, 'Client logged in successfully');
    const clientCookies = clientLoginRes.headers.get('set-cookie') || '';

    // Check session API for client with 0 projects
    const sessionRes0 = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: clientCookies },
    });
    const sessionData0 = await sessionRes0.json();

    assert(
      sessionData0.authenticated === true,
      'Client is authenticated'
    );
    assert(
      sessionData0.user.hasProjects === false,
      'Client hasProjects is false'
    );
    assert(
      sessionData0.canChat === false,
      'Client with 0 projects has canChat === false (NO chat entry points!)'
    );

    // Now insert a project for this client using the schema's exact columns
    const testProjectId = `proj-test-${timestamp}`;
    const { data: createdProj, error: projErr } = await admin.from('projects').insert({
      id: testProjectId,
      user_id: clientUserId,
      project_code: `HT-TEST-${timestamp % 10000}`,
      client_name: 'Chat Test Client',
      email: clientEmail,
      package_name: 'Creator Starter',
      funding_source: 'package',
      package_price_usd: 450,
      package_credits: 150,
      total_credits: 150,
      applied_wallet_credits: 0,
      status: 'pending_review',
      payment_status: 'unpaid',
      payment_method: 'unpaid',
    }).select().single();

    if (projErr) {
      throw new Error(`Failed to insert project: ${projErr.message}`);
    }

    // Check session API again for client with >=1 project
    const sessionRes1 = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: clientCookies },
    });
    const sessionData1 = await sessionRes1.json();

    assert(
      sessionData1.user.hasProjects === true,
      'Client hasProjects is now true'
    );
    assert(
      sessionData1.canChat === true,
      'Client with active project has canChat === true (Chat unlocked!)'
    );

    // Cleanup test user and project
    await admin.from('projects').delete().eq('id', createdProj.id);
    await admin.auth.admin.deleteUser(clientUserId);
    console.log('  Cleaned up temporary test user and project.');

  } catch (err: any) {
    console.error('Audit encountered error:', err.message || err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`TOTAL CHAT GATE AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runChatGateAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
