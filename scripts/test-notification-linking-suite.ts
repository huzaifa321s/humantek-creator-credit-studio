import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { chromium } from '@playwright/test';
import {
  sanitizeInternalHref,
  getNotificationHref,
  type StudioNotification,
} from '../src/lib/notificationStore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loginAndGetCookie(email: string, pass: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });

  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (rawCookies.length > 0) {
    return rawCookies.map((c) => c.split(';')[0]).join('; ');
  }
  const single = res.headers.get('set-cookie');
  if (single) {
    return single.split(',').map((c) => c.split(';')[0]).join('; ');
  }
  return '';
}

async function runSuite() {
  console.log('========================================================================');
  console.log('HUMANTEK STUDIO - NOTIFICATION LINKING & DEEP LINK SUITE (8 SCENARIOS)');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testPass = 'SecureLinkArchPass2026!';
  const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  const aliceEmail = `alice.notif.${ts}@humantek.art`;
  const bobEmail = `bob.notif.${ts}@humantek.art`;

  console.log('[Setup] Creating test users:');
  const [resAlice, resBob] = await Promise.all([
    admin.auth.admin.createUser({
      email: aliceEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Alice Notifications' },
    }),
    admin.auth.admin.createUser({
      email: bobEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Bob Foreign' },
    }),
  ]);

  if (!resAlice.data.user || !resBob.data.user) {
    console.error('Failed to create test users:', resAlice.error, resBob.error);
    process.exit(1);
  }

  const aliceId = resAlice.data.user.id;
  const bobId = resBob.data.user.id;

  // Create profiles
  await admin.from('profiles').upsert([
    { id: aliceId, email: aliceEmail, full_name: 'Alice Notifications', role: 'client' },
    { id: bobId, email: bobEmail, full_name: 'Bob Foreign', role: 'client' },
  ]);

  // Create wallets
  await admin.from('wallets').upsert([
    { user_id: aliceId, balance_purchased: 2000, balance_promo: 0 },
    { user_id: bobId, balance_purchased: 2000, balance_promo: 0 },
  ]);

  console.log(`  ✓ Alice: ${aliceEmail} (${aliceId})`);
  console.log(`  ✓ Bob: ${bobEmail} (${bobId})`);

  const aliceProject1Id = `proj-alice-${ts}`;
  const aliceDeliveredProjectId = `proj-deliv-${ts}`;
  const bobProjectId = `proj-bob-${ts}`;

  try {
    // 1. Create Active Project for Alice
    const { error: p1Err } = await admin.from('projects').insert({
      id: aliceProject1Id,
      project_code: `HT-ALICE-${ts.toString().slice(-4)}`,
      user_id: aliceId,
      package_id: 'studio-wallet',
      package_name: 'Starter Stream Pack',
      client_name: 'Alice Notifications',
      email: aliceEmail,
      channel_name: 'AliceLive',
      platform: 'Twitch',
      style: 'Cyberpunk Neon',
      colors: '#00F5FF, #FF007F',
      instructions: 'Please design an overlay.',
      funding_source: 'wallet',
      status: 'in_production',
      payment_status: 'paid',
      total_credits: 250,
      uploaded_files: [],
      reference_links: [],
    });

    if (p1Err) throw new Error(`Failed to insert Alice project: ${p1Err.message}`);

    // Create Delivered Project for Alice
    const { error: pDelivErr } = await admin.from('projects').insert({
      id: aliceDeliveredProjectId,
      project_code: `HT-DELIV-${ts.toString().slice(-4)}`,
      user_id: aliceId,
      package_id: 'studio-wallet',
      package_name: 'Emote Bundle',
      client_name: 'Alice Notifications',
      email: aliceEmail,
      channel_name: 'AliceArchive',
      platform: 'Discord',
      style: 'Chibi Kawaii',
      colors: '#FFB6C1',
      instructions: 'Emotes created last month.',
      funding_source: 'wallet',
      status: 'delivered',
      payment_status: 'paid',
      total_credits: 150,
      uploaded_files: [],
      reference_links: [],
    });

    if (pDelivErr) throw new Error(`Failed to insert Alice delivered project: ${pDelivErr.message}`);

    // Create Bob's private project (foreign to Alice)
    const { error: pBobErr } = await admin.from('projects').insert({
      id: bobProjectId,
      project_code: `HT-BOB-${ts.toString().slice(-4)}`,
      user_id: bobId,
      package_id: 'studio-wallet',
      package_name: 'Secret Pack',
      client_name: 'Bob Foreign',
      email: bobEmail,
      channel_name: 'BobSecretChannel',
      platform: 'YouTube',
      style: 'Minimalist Dark',
      colors: '#111111',
      instructions: 'Top secret project.',
      funding_source: 'wallet',
      status: 'in_production',
      payment_status: 'paid',
      total_credits: 300,
      uploaded_files: [],
      reference_links: [],
    });

    if (pBobErr) throw new Error(`Failed to insert Bob project: ${pBobErr.message}`);

    console.log(`  ✓ Alice Project: ${aliceProject1Id}`);
    console.log(`  ✓ Alice Delivered Project: ${aliceDeliveredProjectId}`);
    console.log(`  ✓ Bob Project: ${bobProjectId}\n`);

    // Create notification for Alice referencing her project with canonical entity_type and entity_id
    await admin.from('notifications').insert({
      user_id: aliceId,
      type: 'project_status',
      title: 'Project Update Available',
      message: 'Draft assets for your Twitch Overlay are ready for review.',
      entity_type: 'project',
      entity_id: aliceProject1Id,
      action_label: 'View details',
      link: `/projects?project=${aliceProject1Id}`,
      is_read: false,
    });

    const aliceCookie = await loginAndGetCookie(aliceEmail, testPass);

    // Launch headless Chromium browser for UI verifications
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Inject Alice's session cookies into the browser context with url
    if (aliceCookie) {
      const cookieParts = aliceCookie.split('; ').map((c) => {
        const [name, ...val] = c.split('=');
        return {
          name,
          value: val.join('='),
          url: BASE_URL,
        };
      });
      await context.addCookies(cookieParts);
    }

    // -------------------------------------------------------------------------
    // TEST 1: "View project" opens /projects with drawer on that project (no 404)
    // -------------------------------------------------------------------------
    console.log('[Test 1] Notification "View project" link opens drawer on /projects with no 404');
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'domcontentloaded' });

      // Click notification item
      const notifItem = page.locator('button:has-text("Project Update Available")');
      await notifItem.waitFor({ timeout: 10000 });
      await notifItem.click();

      // Drawer should open and URL should be /projects?project=<aliceProject1Id>
      await page.waitForURL(`**/projects?project=${aliceProject1Id}*`, { timeout: 10000 });
      const drawerTitle = page.locator('[data-slot="sheet-title"]:has-text("AliceLive")');
      await drawerTitle.waitFor({ timeout: 10000 });

      // Ensure no 404 was displayed
      const notFoundVisible = await page
        .locator('[data-slot="sheet-content"]')
        .getByText('This project isn’t available')
        .isVisible();

      if (!notFoundVisible && (await drawerTitle.isVisible())) {
        results.push({
          test: 'Test 1: View project opens /projects with drawer (no 404)',
          status: 'PASS',
          details: `URL navigated to ${page.url()} and drawer rendered 'AliceLive' project successfully.`,
        });
      } else {
        throw new Error('Drawer did not render or displayed not found');
      }
      await page.close();
    } catch (err: any) {
      results.push({
        test: 'Test 1: View project opens /projects with drawer (no 404)',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Old notification with /projects/<id> works via redirect bridge
    // -------------------------------------------------------------------------
    console.log('[Test 2] Old notification with /projects/<id> works via redirect bridge (307)');
    try {
      // 1. Check HTTP response redirect header
      const rawRes = await fetch(`${BASE_URL}/projects/${aliceProject1Id}?section=files`, {
        redirect: 'manual',
        headers: aliceCookie ? { Cookie: aliceCookie } : {},
      });

      const location = rawRes.headers.get('location') || '';
      const isRedirect = rawRes.status === 307 || rawRes.status === 308 || rawRes.status === 302;
      const preservesQuery = location.includes(`project=${aliceProject1Id}`) && location.includes('section=files');

      // 2. Browser navigation verification
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/projects/${aliceProject1Id}?section=files`, { waitUntil: 'domcontentloaded' });
      const drawerTitle = page.locator('[data-slot="sheet-title"]:has-text("AliceLive")');
      await drawerTitle.waitFor({ timeout: 10000 });
      const currentUrl = page.url();
      const hasDrawer = await drawerTitle.isVisible();

      if (isRedirect && preservesQuery && hasDrawer) {
        results.push({
          test: 'Test 2: Old /projects/<id> works via redirect bridge with query preserved',
          status: 'PASS',
          details: `HTTP status ${rawRes.status} -> Location: ${location}. Browser landed on ${currentUrl} and drawer opened.`,
        });
      } else {
        throw new Error(`Redirect failed: status=${rawRes.status}, location=${location}, hasDrawer=${hasDrawer}`);
      }
      await page.close();
    } catch (err: any) {
      results.push({
        test: 'Test 2: Old /projects/<id> works via redirect bridge with query preserved',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Foreign, deleted, or malformed ID shows friendly message and clears param on close
    // -------------------------------------------------------------------------
    console.log('[Test 3] Foreign, deleted, or malformed ID shows friendly message and clears param on close');
    try {
      const page = await context.newPage();

      // Case A: Missing / malformed ID
      await page.goto(`${BASE_URL}/projects?project=missing-or-invalid-uuid-9999`, { waitUntil: 'domcontentloaded' });
      const missingMsg = page.locator('[data-slot="sheet-content"]').getByText('This project isn’t available');
      await missingMsg.waitFor({ timeout: 10000 });
      const subtextVisible = await page
        .locator('[data-slot="sheet-content"]')
        .getByText('This project may have been deleted')
        .isVisible();

      // Click "Back to Projects"
      const backBtn = page.locator('[data-slot="sheet-content"]').getByRole('button', { name: 'Back to Projects' });
      await backBtn.click();
      await page.waitForFunction(() => !window.location.search.includes('project='), { timeout: 8000 });
      const urlAfterClose = page.url();
      const paramCleared = !urlAfterClose.includes('project=');

      // Case B: Foreign ID (Bob's private project accessed by Alice)
      await page.goto(`${BASE_URL}/projects?project=${bobProjectId}`, { waitUntil: 'domcontentloaded' });
      const foreignMsg = page.locator('[data-slot="sheet-content"]').getByText('This project isn’t available');
      await foreignMsg.waitFor({ timeout: 10000 });
      const backBtn2 = page.locator('[data-slot="sheet-content"]').getByRole('button', { name: 'Back to Projects' });
      await backBtn2.click();
      await page.waitForFunction(() => !window.location.search.includes('project='), { timeout: 8000 });
      const urlAfterClose2 = page.url();
      const paramCleared2 = !urlAfterClose2.includes('project=');

      if (subtextVisible && paramCleared && paramCleared2) {
        results.push({
          test: 'Test 3: Foreign, deleted, or malformed ID shows friendly message and clears param',
          status: 'PASS',
          details: 'Foreign & malformed IDs displayed "This project isn’t available" and clicking "Back to Projects" cleared ?project= from URL.',
        });
      } else {
        throw new Error(`Failed: subtextVisible=${subtextVisible}, paramCleared=${paramCleared}, paramCleared2=${paramCleared2}`);
      }
      await page.close();
    } catch (err: any) {
      results.push({
        test: 'Test 3: Foreign, deleted, or malformed ID shows friendly message and clears param',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Logged out link redirects to login with next= and returns to project drawer after auth
    // -------------------------------------------------------------------------
    console.log('[Test 4] Logged out link redirects to login with next= parameter');
    try {
      // 1. Verify HTTP level middleware redirect for unauthenticated visitor
      const unauthHttpRes = await fetch(`${BASE_URL}/projects/${aliceProject1Id}`, {
        redirect: 'manual',
      });
      const unauthLocation = unauthHttpRes.headers.get('location') || '';
      const hasNextInHeader = unauthLocation.includes('login') && unauthLocation.includes('next=');

      // 2. Browser level test: unauthenticated navigation
      const unauthContext = await browser.newContext();
      const page = await unauthContext.newPage();

      await page.goto(`${BASE_URL}/projects/${aliceProject1Id}`);
      await page.waitForURL('**/login?next=*', { timeout: 10000 });
      const loginUrl = page.url();
      const hasNextInUrl = loginUrl.includes('next=') && loginUrl.includes(encodeURIComponent(`/projects/${aliceProject1Id}`));

      // Perform login in this flow
      await page.fill('#auth-signin-email', aliceEmail);
      await page.fill('#auth-signin-password', testPass);
      await page.locator('button[type="submit"]:has-text("Sign In")').click();

      // After login, should redirect through next= and land on the project drawer
      await page.waitForURL(`**/*project=${aliceProject1Id}*`, { timeout: 15000 });
      const drawerTitle = page.locator('[data-slot="sheet-title"]:has-text("AliceLive")');
      await drawerTitle.waitFor({ timeout: 15000 });
      const drawerVisible = await drawerTitle.isVisible();

      if (hasNextInHeader && hasNextInUrl && drawerVisible) {
        results.push({
          test: 'Test 4: Logged out link redirects to login with next= and returns to drawer',
          status: 'PASS',
          details: `Unauth request intercepted to ${loginUrl}, authenticated, and returned to /projects?project=${aliceProject1Id} with drawer open.`,
        });
      } else {
        throw new Error(`Failed auth return: hasNextInHeader=${hasNextInHeader}, hasNextInUrl=${hasNextInUrl}, drawerVisible=${drawerVisible}`);
      }
      await unauthContext.close();
    } catch (err: any) {
      results.push({
        test: 'Test 4: Logged out link redirects to login with next= and returns to drawer',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Client with multiple projects: old project opens drawer regardless of active tab
    // -------------------------------------------------------------------------
    console.log('[Test 5] Notification for old delivered project opens drawer regardless of active tab');
    try {
      const page = await context.newPage();
      // Start on projects page
      await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });

      // Navigate to the delivered project via deep link ?project=<aliceDeliveredProjectId>
      await page.goto(`${BASE_URL}/projects?project=${aliceDeliveredProjectId}`);

      // The drawer must fetch independently and display 'AliceArchive'
      const drawerTitle = page.locator('[data-slot="sheet-title"]:has-text("AliceArchive")');
      await drawerTitle.waitFor({ timeout: 10000 });
      const deliveredDrawerVisible = await drawerTitle.isVisible();
      const deliveredBadge = await page.locator('[data-slot="sheet-content"]').getByText('Delivered').isVisible();

      if (deliveredDrawerVisible && deliveredBadge) {
        results.push({
          test: 'Test 5: Old project opens drawer regardless of active tab',
          status: 'PASS',
          details: 'Drawer fetched delivered project directly via independent ID query even while active tab was filtered.',
        });
      } else {
        throw new Error('Delivered project drawer was not shown');
      }
      await page.close();
    } catch (err: any) {
      results.push({
        test: 'Test 5: Old project opens drawer regardless of active tab',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 6: Closing drawer clears param. Back and refresh behave sensibly.
    // -------------------------------------------------------------------------
    console.log('[Test 6] Closing drawer clears param; Back and Refresh work correctly');
    try {
      const page = await context.newPage();
      // 1. Open drawer directly via URL
      await page.goto(`${BASE_URL}/projects?project=${aliceProject1Id}`, { waitUntil: 'domcontentloaded' });
      const drawerTitle = page.locator('[data-slot="sheet-title"]:has-text("AliceLive")');
      await drawerTitle.waitFor({ timeout: 10000 });

      // 2. Refresh page - drawer must still be open
      await page.reload({ waitUntil: 'domcontentloaded' });
      await drawerTitle.waitFor({ timeout: 10000 });
      const stillOpenAfterRefresh = await drawerTitle.isVisible();

      // 3. Close drawer using close button
      const closeBtn = page.locator('[data-slot="sheet-close"]').or(page.locator('button:has-text("Close")'));
      if (await closeBtn.first().isVisible()) {
        await closeBtn.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForFunction(() => !window.location.search.includes('project='), { timeout: 8000 });
      const urlCleared = !page.url().includes('project=');

      // 4. Browser Back navigation restores project param and drawer
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.location.search.includes('project='), { timeout: 8000 });
      await drawerTitle.waitFor({ timeout: 10000 });
      const restoredOnBack = await drawerTitle.isVisible();

      if (stillOpenAfterRefresh && urlCleared && restoredOnBack) {
        results.push({
          test: 'Test 6: Closing drawer clears param. Back and refresh behave sensibly',
          status: 'PASS',
          details: 'Refresh preserved drawer, closing cleared query param, and browser Back restored the project drawer.',
        });
      } else {
        throw new Error(`Failed: refresh=${stillOpenAfterRefresh}, cleared=${urlCleared}, restored=${restoredOnBack}`);
      }
      await page.close();
    } catch (err: any) {
      results.push({
        test: 'Test 6: Closing drawer clears param. Back and refresh behave sensibly',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 7: Admin vs client role-aware routing isolation
    // -------------------------------------------------------------------------
    console.log('[Test 7] Admin vs client role-aware routing isolation');
    try {
      const projectItem: Partial<StudioNotification> = {
        entityType: 'project',
        entityId: 'proj-456',
        link: '/projects/proj-456',
      };

      const walletItem: Partial<StudioNotification> = {
        entityType: 'wallet',
        link: '/wallet',
      };

      const clientTryingAdminLink: Partial<StudioNotification> = {
        entityType: 'project',
        entityId: 'proj-789',
        link: '/management?tab=projects&id=proj-789',
      };

      // Admin role expectations
      const adminProjectHref = getNotificationHref(projectItem, 'admin');
      const adminWalletHref = getNotificationHref(walletItem, 'admin');

      // Client role expectations
      const clientProjectHref = getNotificationHref(projectItem, 'client');
      const clientWalletHref = getNotificationHref(walletItem, 'client');
      const clientBlockedAdminHref = getNotificationHref(clientTryingAdminLink, 'client');

      const adminOk =
        adminProjectHref === '/management?tab=projects&id=proj-456' &&
        adminWalletHref === '/management?tab=credits';

      const clientOk =
        clientProjectHref === '/projects?project=proj-456' &&
        clientWalletHref === '/wallet' &&
        clientBlockedAdminHref === '/projects?project=proj-789' &&
        !clientBlockedAdminHref?.startsWith('/management');

      if (adminOk && clientOk) {
        results.push({
          test: 'Test 7: Admin vs client role-aware routing isolation',
          status: 'PASS',
          details: `Admin routed to: [${adminProjectHref}, ${adminWalletHref}]. Client routed to: [${clientProjectHref}, ${clientWalletHref}], with admin console link blocked to [${clientBlockedAdminHref}].`,
        });
      } else {
        throw new Error(`Isolation failed: adminOk=${adminOk}, clientOk=${clientOk}`);
      }
    } catch (err: any) {
      results.push({
        test: 'Test 7: Admin vs client role-aware routing isolation',
        status: 'FAIL',
        details: err.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 8: External / malicious links blocked/ignored
    // -------------------------------------------------------------------------
    console.log('[Test 8] External / malicious links blocked/ignored');
    try {
      const attackVectors = [
        'https://malicious-phishing.com/login',
        'http://evil.com',
        '//attacker.com/bypass',
        'javascript:alert(document.cookie)',
        '/\\malicious-redirect.com',
        '\\attacker.com',
        'data:text/html,<script>alert(1)</script>',
      ];

      const blockedResults = attackVectors.map((v) => {
        const sanitized = sanitizeInternalHref(v);
        const resolved = getNotificationHref({ link: v }, 'client');
        return { vector: v, sanitized, resolved };
      });

      const allBlocked = blockedResults.every(
        (r) => r.sanitized === null && r.resolved === null
      );

      // Also verify valid internal paths pass
      const validPath = '/projects?project=test-123';
      const validResolved = getNotificationHref({ link: validPath }, 'client');
      const validPass = validResolved === '/projects?project=test-123';

      if (allBlocked && validPass) {
        results.push({
          test: 'Test 8: External / malicious links blocked/ignored',
          status: 'PASS',
          details: `All ${attackVectors.length} attack vectors rejected (returned null). Valid internal paths preserved cleanly.`,
        });
      } else {
        throw new Error(`Sanitizer failed: allBlocked=${allBlocked}, validPass=${validPass}`);
      }
    } catch (err: any) {
      results.push({
        test: 'Test 8: External / malicious links blocked/ignored',
        status: 'FAIL',
        details: err.message,
      });
    }

    await browser.close();
  } finally {
    // Cleanup test data
    console.log('\n[Cleanup] Removing test projects and accounts...');
    if (aliceProject1Id) await admin.from('projects').delete().eq('id', aliceProject1Id);
    if (aliceDeliveredProjectId) await admin.from('projects').delete().eq('id', aliceDeliveredProjectId);
    if (bobProjectId) await admin.from('projects').delete().eq('id', bobProjectId);
    await admin.from('notifications').delete().eq('user_id', aliceId);
    await admin.auth.admin.deleteUser(aliceId);
    await admin.auth.admin.deleteUser(bobId);
    console.log('  ✓ Cleanup complete.');
  }

  // Print Summary Table
  console.log('\n========================================================================');
  console.log('                       TEST SUITE EXECUTION SUMMARY');
  console.log('========================================================================');
  results.forEach((r, idx) => {
    const icon = r.status === 'PASS' ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${icon} (${idx + 1}/8) ${r.test}`);
    console.log(`       Details: ${r.details}`);
  });
  console.log('========================================================================\n');

  const allPassed = results.every((r) => r.status === 'PASS') && results.length === 8;
  if (!allPassed) {
    console.error(`FAILED: ${results.filter((r) => r.status === 'FAIL').length} tests failed.`);
    process.exit(1);
  } else {
    console.log(`SUCCESS: All 8 test scenarios PASSED perfectly!`);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
