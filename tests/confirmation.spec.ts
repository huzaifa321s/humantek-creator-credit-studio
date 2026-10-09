import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe('Confirmation Route & Checkout UX Safety Suite', () => {
  test.setTimeout(60000);

  let testUser: any;
  let testUserEmail: string;
  let testUserPass = 'PlaywrightTestPass2026!';
  let authCookie: { name: string; value: string; url: string }[] = [];

  test.beforeAll(async () => {
    const ts = Date.now();
    testUserEmail = `pw_client_${ts}@humantek.art`;

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPass,
      email_confirm: true,
      user_metadata: { full_name: 'Playwright Test Client' },
    });
    if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
    testUser = data.user;

    await adminSupabase.from('profiles').update({ role: 'client', full_name: 'Playwright Test Client' }).eq('id', testUser.id);
    await adminSupabase.from('wallets').upsert({
      user_id: testUser.id,
      balance_purchased: 500,
      balance_promo: 100,
    });

    // Obtain cookie from Next.js login endpoint
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: testUserPass }),
    });

    const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    authCookie = setCookies.map((c) => {
      const parts = c.split(';')[0].split('=');
      return {
        name: parts[0].trim(),
        value: parts.slice(1).join('=').trim(),
        url: 'http://localhost:3000',
      };
    });
  });

  test.afterAll(async () => {
    if (testUser?.id) {
      await adminSupabase.auth.admin.deleteUser(testUser.id);
    }
  });

  test('1. Success & Persistent Receipt: Navigates to /new-project/confirmation/[id] and persists across reload', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-pw-${ts}`;

    // Load page to establish origin, then set localStorage without polluting global context
    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ pId, uId, email }) => {
      window.localStorage.setItem(
        'humantek_studio_user',
        JSON.stringify({
          state: {
            user: {
              id: uId,
              name: 'Playwright Test Client',
              email: email,
              avatarInitials: 'PC',
              walletBalance: 600,
              role: 'client',
              emailVerified: true,
              hasProjects: true,
              canChat: true,
            },
            isHydrated: true,
          },
          version: 1,
        })
      );
      window.localStorage.setItem(
        'humantek_wizard_cart',
        JSON.stringify({
          state: {
            projectId: pId,
            selectedPackageId: 'creator-forge',
            fundingSource: 'wallet',
            selections: {
              logo: { level: 0, quantity: 1 },
            },
            policyAccepted: true,
            brief: {
              channelName: 'Playwright Channel',
              platform: 'Twitch',
              style: 'Modern',
              colors: 'Amber and Black',
              instructions: 'Detailed automated test brief with sufficient words and length for validation.',
            },
            uploadedFiles: [],
            termsAccepted: true,
            currentStep: 5,
            savedAt: Date.now(),
          },
          version: 1,
        })
      );
    }, { pId: projectId, uId: testUser.id, email: testUserEmail });

    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });

    // Click Confirm & Launch button
    const launchBtn = page.getByRole('button', { name: /Confirm & Launch/i });
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    // Verify navigation to dedicated confirmation URL
    await expect(page).toHaveURL(new RegExp(`/new-project/confirmation/${projectId}`), { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Project started|Payment received/i);

    // Reload page: receipt persists and loads 200 from DB
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/new-project/confirmation/${projectId}`));
    await expect(page.locator('h1')).toContainText(/Project started|Payment received/i);
    await expect(page.getByText(/Creator Forge/i).first()).toBeVisible();
  });

  test('2. Back button history safety: pressing Back does not reopen step 5 checkout form', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-pw-back-${ts}`;

    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ pId, uId, email }) => {
      window.localStorage.setItem(
        'humantek_studio_user',
        JSON.stringify({
          state: {
            user: {
              id: uId,
              name: 'Playwright Test Client',
              email: email,
              avatarInitials: 'PC',
              walletBalance: 600,
              role: 'client',
              emailVerified: true,
              hasProjects: true,
              canChat: true,
            },
            isHydrated: true,
          },
          version: 1,
        })
      );
      window.localStorage.setItem(
        'humantek_wizard_cart',
        JSON.stringify({
          state: {
            projectId: pId,
            selectedPackageId: 'creator-forge',
            fundingSource: 'wallet',
            selections: {
              logo: { level: 0, quantity: 1 },
            },
            policyAccepted: true,
            brief: {
              channelName: 'Back Button Channel',
              platform: 'Twitch',
              style: 'Clean',
              colors: 'White and Gold',
              instructions: 'Brief verification for back button history safety and replaceState check.',
            },
            uploadedFiles: [],
            termsAccepted: true,
            currentStep: 5,
            savedAt: Date.now(),
          },
          version: 1,
        })
      );
    }, { pId: projectId, uId: testUser.id, email: testUserEmail });

    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });

    const launchBtn = page.getByRole('button', { name: /Confirm & Launch/i });
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    await expect(page).toHaveURL(new RegExp(`/new-project/confirmation/${projectId}`), { timeout: 15000 });

    // Press browser Back button
    await page.goBack();
    await page.waitForTimeout(500);

    // Assert that we are NOT on an active step 5 checkout form
    const currentUrl = page.url();
    const hasActiveCheckout = await page.getByRole('button', { name: /Confirm & Launch|Pay with PayPal/i }).isVisible().catch(() => false);
    expect(hasActiveCheckout, `Browser Back button should not display checkout payment form: currently at ${currentUrl}`).toBe(false);
  });

  test('3. Accessible Heading focus: confirmation heading receives programmatic focus on mount', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-pw-a11y-${ts}`;

    // Create project in DB
    await adminSupabase.from('projects').insert({
      id: projectId,
      project_code: `HT-${ts.toString().slice(-4)}-PW`,
      user_id: testUser.id,
      package_id: 'creator-forge',
      package_name: 'Creator Forge',
      funding_source: 'wallet',
      payment_status: 'paid',
      payment_method: 'credits',
      status: 'pending_review',
      client_name: 'Playwright Test Client',
      email: testUserEmail,
      instructions: 'Testing accessible heading focus on confirmation mount.',
    });

    await page.goto(`/new-project/confirmation/${projectId}`, { waitUntil: 'networkidle' });

    const heading = page.locator('h1[tabindex="-1"]');
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused({ timeout: 5000 });
  });

  test('4. Chat button timing: Message our team button renders via ChatGate without delay', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-pw-chat-${ts}`;

    await adminSupabase.from('projects').insert({
      id: projectId,
      project_code: `HT-${ts.toString().slice(-4)}-CHAT`,
      user_id: testUser.id,
      package_id: 'creator-forge',
      package_name: 'Creator Forge',
      funding_source: 'wallet',
      payment_status: 'paid',
      payment_method: 'credits',
      status: 'pending_review',
      client_name: 'Playwright Test Client',
      email: testUserEmail,
      instructions: 'Testing ChatGate button immediate render and timing.',
    });

    await page.goto(`/new-project/confirmation/${projectId}`, { waitUntil: 'networkidle' });

    // The chat entry button wrapped in ChatGate must be visible immediately
    const chatBtn = page.locator('[data-chat-entry="confirmation-chat"]');
    await expect(chatBtn).toBeVisible({ timeout: 5000 });
    await expect(chatBtn).toContainText(/Message our team/i);
  });

  test('5. Empty-cart rule: Guest, new client, and just-submitted client visiting ?step=5 are redirected to /projects', async ({ page, context }) => {
    // 5a. Guest (no auth, empty localStorage) visiting ?step=5
    // Redirects to /projects; middleware intercepts unauthenticated requests to /projects and routes to /login
    await context.clearCookies();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/(login|projects)/, { timeout: 10000 });

    // 5b. New client (authenticated, empty cart) visiting ?step=5
    if (authCookie.length > 0) await context.addCookies(authCookie);
    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ uId, email }) => {
      localStorage.removeItem('humantek_wizard_cart');
      localStorage.setItem('humantek_studio_user', JSON.stringify({
        state: {
          user: { id: uId, email: email, name: 'Playwright Client', role: 'client', walletBalance: 500 },
          isHydrated: true,
        },
        version: 1,
      }));
    }, { uId: testUser.id, email: testUserEmail });
    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    // 5c. Just-submitted client (cart cleared) navigating back to ?step=5
    await page.evaluate(() => localStorage.removeItem('humantek_wizard_cart'));
    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
  });

  test('6. Lost-response retry with idempotency key: re-submitting returns 200 replayed with zero extra charge', async () => {
    const ts = Date.now();
    const retryProjectId = `proj-pw-idemp-${ts}`;
    const payload = {
      projectId: retryProjectId,
      packageId: 'studio-wallet',
      fundingSource: 'wallet',
      instructions: 'Testing network lost-response replay scenario with identical key.',
      additions: [],
      selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
    };

    const cookieHeader = authCookie.map((c) => `${c.name}=${c.value}`).join('; ');

    // 1st request
    const res1 = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(200);

    // Query balance after 1st call
    const { data: w1 } = await adminSupabase.from('wallets').select('balance_credits').eq('user_id', testUser.id).single();
    const bal1 = w1?.balance_credits;

    // 2nd request (simulating lost-response retry with same idempotency key)
    const res2 = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.replayed).toBe(true);

    // Query balance after 2nd call: must be unchanged (no secondary charge!)
    const { data: w2 } = await adminSupabase.from('wallets').select('balance_credits').eq('user_id', testUser.id).single();
    const bal2 = w2?.balance_credits;

    expect(bal2).toBe(bal1);
  });
});
