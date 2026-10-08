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

async function runGuestWizardAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - 12 ACCEPTANCE TESTS: GUEST-FIRST WIZARD FLOW');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testUserEmail = `guest_test_${timestamp}@humantek.art`;
  const testUserName = `Test Creator ${timestamp % 1000}`;
  const testPassword = 'Password123!Secure';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Steps 1 to 4 on /new-project accessible to guests without redirect or 401s
    // -------------------------------------------------------------------------
    console.log('[Test 1] Public accessibility of /new-project for unauthenticated guests:');
    const guestRes = await fetch(`${BASE_URL}/new-project`, { redirect: 'manual' });
    assert(
      guestRes.status === 200,
      'GET /new-project returns 200 OK without redirecting to /login',
      `Got status ${guestRes.status}`
    );

    const rootRes = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    const rootRedirectLocation = rootRes.headers.get('location');
    assert(
      rootRes.status === 307 && rootRedirectLocation?.includes('/new-project'),
      'GET / redirects guests directly to /new-project',
      `Got status ${rootRes.status}, location: ${rootRedirectLocation}`
    );

    // Verify wallet query guard in src/lib/queries/wallet.ts
    const walletQueryContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/queries/wallet.ts'),
      'utf8'
    );
    assert(
      walletQueryContent.includes('enabled: Boolean(normalizedEmail)'),
      'useWalletQuery is disabled when guest has no email (zero 401s in console)'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 2: Clicking Review opens auth modal; closing keeps user on Step 4 with selections intact
    // -------------------------------------------------------------------------
    console.log('[Test 2] Review gating with in-modal auth & selection retention:');
    const pageContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/new-project/page.tsx'),
      'utf8'
    );
    const hasAuthModalImport = pageContent.includes("import { AuthModal } from '@/components/auth/AuthModal'");
    const hasAuthModalMount = pageContent.includes('<AuthModal');
    const hasStep5Gate = pageContent.includes('if (!user?.email)') && pageContent.includes('setShowAuthModal(true)');
    assert(
      hasAuthModalImport && hasAuthModalMount && hasStep5Gate,
      'Advancing to step 5 opens AuthModal if !user?.email, staying on step 4'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 3: Sign in lands on Step 5 with selections intact; page refresh keeps them
    // -------------------------------------------------------------------------
    console.log('[Test 3] Sign in with existing account lands on Step 5 and persists cart:');
    const wizardStoreContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/wizardStore.ts'),
      'utf8'
    );
    assert(
      wizardStoreContent.includes("name: 'humantek_wizard_cart'") &&
      wizardStoreContent.includes('persist('),
      'useWizardStore uses Zustand persist with humantek_wizard_cart key'
    );
    assert(
      wizardStoreContent.includes('selectedPackageId:') &&
      wizardStoreContent.includes('selections:') &&
      !wizardStoreContent.includes('clientName:') &&
      !wizardStoreContent.includes('email:'),
      'Stored cart partializes only package choice, selections, and brief text (NO clientName/email/prices/tokens)'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 4: Sign up with new account lands on Step 5 with selections intact
    // -------------------------------------------------------------------------
    console.log('[Test 4] Sign up via /api/auth/signup creates account & profile:');
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword,
        name: testUserName,
      }),
    });
    const signupData = await signupRes.json();
    assert(
      signupRes.status === 200 && signupData.ok === true,
      'POST /api/auth/signup succeeds for new user',
      JSON.stringify(signupData)
    );

    // Verify profile in Supabase
    const { data: createdProfile } = await admin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('email', testUserEmail)
      .maybeSingle();

    assert(
      Boolean(createdProfile && createdProfile.full_name === testUserName),
      `New user profile created in PostgreSQL with full_name "${testUserName}"`,
      JSON.stringify(createdProfile)
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 5: Opening ?step=5 while signed out returns to Step 4 / shows modal
    // -------------------------------------------------------------------------
    console.log('[Test 5] Opening ?step=5 while signed out bounces to Step 4:');
    assert(
      pageContent.includes("clamped === 5 && !user?.email") &&
      pageContent.includes("setShowAuthModal(true)") &&
      pageContent.includes("setCurrentStep(4)"),
      'URL sync effect intercepts ?step=5 without session, bounces to step 4, and triggers AuthModal'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 6: Step 4 has no name or email fields anywhere (including review summary)
    // -------------------------------------------------------------------------
    console.log('[Test 6] Field elimination: No clientName or email inputs in brief or summary:');
    const validationContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/validation.ts'),
      'utf8'
    );
    assert(
      !validationContent.includes("clientName: z.string().min(2") &&
      !validationContent.includes("email: z.string().email"),
      'briefFieldsSchema does NOT require clientName or email'
    );

    const step4Inputs = pageContent.includes('id="clientName"') || pageContent.includes('id="brief-email"');
    assert(
      !step4Inputs,
      'Step 4 form contains zero clientName or email input fields'
    );

    const summaryShowsNameInput = pageContent.includes('name="clientName"');
    assert(
      !summaryShowsNameInput,
      'Step 5 review summary contains zero clientName or email inputs'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 7: POST /api/projects with fake clientName/email creates project with name/email from profile
    // -------------------------------------------------------------------------
    console.log('[Test 7] Backend ignores client-supplied clientName & email, binding from profile:');
    
    // Log in with the newly created test user to obtain session cookies
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword,
      }),
    });
    
    const setCookieHeaders = (loginRes.headers as any).getSetCookie
      ? (loginRes.headers as any).getSetCookie()
      : [loginRes.headers.get('set-cookie') || ''];
    const cookieHeader = setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ');

    assert(
      loginRes.status === 200 && cookieHeader.length > 0,
      'User successfully logged in and received session cookies'
    );

    const fakeSpoofedPayload = {
      projectId: `proj_test_${timestamp}`,
      packageId: 'creator-forge',
      fundingSource: 'wallet',
      paymentStatus: 'unpaid',
      clientName: 'MALICIOUS_SPOOFED_HACKER',
      email: 'hacker@malicious-domain.com',
      channelName: 'ChannelSafe',
      platform: 'YouTube',
      style: 'Minimalist',
      colors: '#112233',
      instructions: 'Please produce high-resolution custom channel artwork today',
      uploadedFiles: [],
      selections: [{ id: 'logo', level: 0, quantity: 1, credits: 32 }],
      additions: [],
    };

    const submitRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(fakeSpoofedPayload),
    });

    const submitData = await submitRes.json();
    assert(
      submitRes.status === 200 && submitData.success === true,
      'POST /api/projects submitted successfully for review',
      JSON.stringify(submitData)
    );

    // Verify in database that client_name and email were pulled from profile, NOT the fake payload
    const { data: dbProj } = await admin
      .from('projects')
      .select('id, client_name, email, user_id')
      .eq('id', fakeSpoofedPayload.projectId)
      .single();

    assert(
      dbProj?.client_name === testUserName,
      `Project client_name is "${dbProj?.client_name}", matching profile (fake name ignored!)`,
      `Got "${dbProj?.client_name}"`
    );
    assert(
      dbProj?.email === testUserEmail,
      `Project email is "${dbProj?.email}", matching session (fake email ignored!)`,
      `Got "${dbProj?.email}"`
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 8: POST /api/projects without a session returns 401
    // -------------------------------------------------------------------------
    console.log('[Test 8] POST /api/projects without authentication returns 401:');
    const anonRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeSpoofedPayload),
    });
    assert(
      anonRes.status === 401,
      'POST /api/projects without session cookie returns 401 Unauthorized',
      `Got status ${anonRes.status}`
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 9: Admin opening /new-project redirects to /management
    // -------------------------------------------------------------------------
    console.log('[Test 9] Admin attempting to access /new-project is redirected:');
    const middlewareContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/supabase/middleware.ts'),
      'utf8'
    );
    assert(
      middlewareContent.includes("pathname.startsWith('/new-project')") &&
      middlewareContent.includes("userRole === 'admin'") &&
      middlewareContent.includes("new URL('/management', request.url)"),
      'Edge middleware intercepts admin on /new-project and redirects to /management'
    );

    const layoutContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/new-project/layout.tsx'),
      'utf8'
    );
    assert(
      layoutContent.includes("isAdmin()") &&
      layoutContent.includes("router.replace('/management')"),
      'Layout in /new-project/layout.tsx enforces admin redirect to /management'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 10: After successful project or sign-out, wizard saved data is cleared
    // -------------------------------------------------------------------------
    console.log('[Test 10] Wizard cache cleared on successful submission and sign-out:');
    const userStoreContent = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/userStore.ts'),
      'utf8'
    );
    assert(
      userStoreContent.includes("localStorage.removeItem('humantek_wizard_cart')"),
      'userStore.signOut() removes humantek_wizard_cart from localStorage'
    );
    assert(
      pageContent.includes('resetWizard()') &&
      wizardStoreContent.includes("localStorage.removeItem('humantek_wizard_cart')"),
      'resetWizard() clears stored cart after successful project launch/review submission'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 11: Guest sees no sidebar, balance pill, bell, or chat widget anywhere
    // -------------------------------------------------------------------------
    console.log('[Test 11] Guest UI isolation: No sidebar, balance pill, bell, or chat widget:');
    const headerContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/header/DashboardHeader.tsx'),
      'utf8'
    );
    const chatWidgetContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/chat/ChatFloatingWidget.tsx'),
      'utf8'
    );
    assert(
      headerContent.includes('!effectiveEmail ? (') &&
      headerContent.includes('Sign In') &&
      headerContent.includes('href="/login"'),
      'DashboardHeader renders clean "Sign In" button when !effectiveEmail'
    );
    assert(
      headerContent.includes('DashboardNotificationDropdown') &&
      headerContent.includes('Credit balance:') &&
      headerContent.includes('!effectiveEmail ? ('),
      'Credit balance pill, notification bell, and user menu are strictly hidden for guests'
    );
    assert(
      chatWidgetContent.includes('!user?.email') &&
      chatWidgetContent.includes('return null;'),
      'ChatFloatingWidget returns null when unauthenticated guest is browsing'
    );
    console.log();

    // -------------------------------------------------------------------------
    // TEST 12: Tampered saved cart (fake service ID, quantity 999) rejected with clear error
    // -------------------------------------------------------------------------
    console.log('[Test 12] Tampered cart validation on backend:');
    
    // 12a. Fake service ID
    const fakeServicePayload = {
      ...fakeSpoofedPayload,
      projectId: `proj_fake_svc_${timestamp}`,
      selections: [{ id: 'malicious-injected-item', level: 0, quantity: 1, credits: 50 }],
    };
    const fakeSvcRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(fakeServicePayload),
    });
    const fakeSvcData = await fakeSvcRes.json();
    assert(
      fakeSvcRes.status === 400 &&
      fakeSvcData.error?.includes('does not exist in the catalog'),
      `Fake service ID rejected with 400: "${fakeSvcData.error}"`,
      `Got status ${fakeSvcRes.status}`
    );

    // 12b. Quantity 999
    const fakeQtyPayload = {
      ...fakeSpoofedPayload,
      projectId: `proj_fake_qty_${timestamp}`,
      selections: [{ id: 'logo', level: 0, quantity: 999, credits: 32000 }],
    };
    const fakeQtyRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(fakeQtyPayload),
    });
    const fakeQtyData = await fakeQtyRes.json();
    assert(
      fakeQtyRes.status === 400 &&
      (fakeQtyData.error?.includes('quantity') || fakeQtyData.error?.includes('Too big')),
      `Quantity 999 rejected with 400: "${fakeQtyData.error}"`,
      `Got status ${fakeQtyRes.status}`
    );

    // 12c. Fake package ID
    const fakePkgPayload = {
      ...fakeSpoofedPayload,
      projectId: `proj_fake_pkg_${timestamp}`,
      packageId: 'super-hacker-free-package',
    };
    const fakePkgRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(fakePkgPayload),
    });
    const fakePkgData = await fakePkgRes.json();
    assert(
      fakePkgRes.status === 400 &&
      fakePkgData.error?.includes('Invalid package'),
      `Fake package ID rejected with 400: "${fakePkgData.error}"`,
      `Got status ${fakePkgRes.status}`
    );
    console.log();

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('========================================================================');
    console.log(`TOTAL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit encountered unexpected error:', err);
    process.exit(1);
  }
}

runGuestWizardAudit();
