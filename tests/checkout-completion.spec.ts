import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe('Checkout Navigation & State Isolation Suite', () => {
  test.setTimeout(60000);

  let testUser: any;
  let testUserEmail: string;
  const testUserPass = 'CheckoutTestPass2026!';
  let authCookie: { name: string; value: string; url: string }[] = [];

  test.beforeAll(async () => {
    const ts = Date.now();
    testUserEmail = `checkout_client_${ts}@humantek.art`;

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPass,
      email_confirm: true,
      user_metadata: { full_name: 'Checkout Test Client' },
    });
    if (error || !data.user) throw new Error(`User creation failed: ${error?.message}`);
    testUser = data.user;

    await adminSupabase.from('profiles').update({ role: 'client', full_name: 'Checkout Test Client' }).eq('id', testUser.id);
    await adminSupabase.from('wallets').upsert({
      user_id: testUser.id,
      balance_purchased: 1500,
      balance_promo: 500,
    });

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

  test('1. Wallet Checkout Path: real UI submission navigates cleanly to /new-project/confirmation/[id] (no Step 1 bounce)', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-chk-wallet-${ts}`;

    // Seed wizard cart and authenticated client session on step 5
    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ pId, uId, email }) => {
      localStorage.setItem('humantek_studio_user', JSON.stringify({
        state: {
          user: { id: uId, email: email, name: 'Checkout Test Client', role: 'client', walletBalance: 2000 },
          isHydrated: true,
        },
        version: 1,
      }));
      localStorage.setItem('humantek_wizard_cart', JSON.stringify({
        state: {
          projectId: pId,
          selectedPackageId: 'creator-forge',
          fundingSource: 'wallet',
          selections: { logo: { level: 0, quantity: 1 } },
          policyAccepted: true,
          brief: {
            channelName: 'Wallet Test Stream',
            platform: 'Twitch',
            style: 'Bold',
            colors: 'Amber/Black',
            instructions: 'Automated test instructions for wallet checkout navigation verification.',
          },
          uploadedFiles: [],
          termsAccepted: true,
          currentStep: 5,
          savedAt: Date.now(),
        },
        version: 1,
      }));
    }, { pId: projectId, uId: testUser.id, email: testUserEmail });

    // Monitor Network sequence
    const requestUrls: string[] = [];
    page.on('request', (req) => requestUrls.push(`${req.method()} ${req.url()}`));

    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });

    // Click Confirm & Launch button (exact match to distinguish from sticky bottom bar)
    const launchBtn = page.getByRole('button', { name: 'Confirm & Launch', exact: true });
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    // Assert that we navigate to the confirmation route, and NEVER bounce back to step 1
    await expect(page).toHaveURL(new RegExp(`/new-project/confirmation/${projectId}`), { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Project started|Payment received/i);

    // Verify wizard draft is now cleaned up on the confirmation page
    const cartAfterConfirmation = await page.evaluate(() => {
      const stored = localStorage.getItem('humantek_wizard_cart');
      if (!stored) return null;
      try {
        const parsed = JSON.parse(stored);
        return parsed?.state?.selectedPackageId || null;
      } catch {
        return null;
      }
    });
    expect(cartAfterConfirmation).toBeFalsy();
  });

  test('2. Manual Review Path: real UI submission navigates cleanly to /new-project/confirmation/[id]', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-chk-manual-${ts}`;

    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ pId, uId, email }) => {
      localStorage.setItem('humantek_studio_user', JSON.stringify({
        state: {
          user: { id: uId, email: email, name: 'Checkout Test Client', role: 'client', walletBalance: 2000 },
          isHydrated: true,
        },
        version: 1,
      }));
      localStorage.setItem('humantek_wizard_cart', JSON.stringify({
        state: {
          projectId: pId,
          selectedPackageId: 'studio-momentum',
          fundingSource: 'package',
          selections: { logo: { level: 0, quantity: 1 } },
          policyAccepted: true,
          brief: {
            channelName: 'Manual Review Stream',
            platform: 'YouTube',
            style: 'Modern',
            colors: 'Blue/White',
            instructions: 'Automated test instructions for manual review submission path.',
          },
          uploadedFiles: [],
          termsAccepted: true,
          currentStep: 5,
          savedAt: Date.now(),
        },
        version: 1,
      }));
    }, { pId: projectId, uId: testUser.id, email: testUserEmail });

    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });

    // Click "Request review (no payment yet) →"
    const manualBtn = page.getByRole('button', { name: /Request review/i });
    await expect(manualBtn).toBeVisible({ timeout: 10000 });
    await manualBtn.click();

    // Assert navigation to confirmation route
    await expect(page).toHaveURL(new RegExp(`/new-project/confirmation/${projectId}`), { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Order received|Project submitted for review|Project started|Payment received/i);
  });

  test('3. Recovery Banner: missing project ID preserves cart and shows link to My Projects', async ({ page, context }) => {
    if (authCookie.length > 0) await context.addCookies(authCookie);

    const ts = Date.now();
    const projectId = `proj-chk-fail-${ts}`;

    // Intercept project creation to return response with missing project ID
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, project: null }),
      });
    });

    await page.goto('/new-project', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ pId, uId, email }) => {
      localStorage.setItem('humantek_studio_user', JSON.stringify({
        state: {
          user: { id: uId, email: email, name: 'Checkout Test Client', role: 'client', walletBalance: 2000 },
          isHydrated: true,
        },
        version: 1,
      }));
      localStorage.setItem('humantek_wizard_cart', JSON.stringify({
        state: {
          projectId: pId,
          selectedPackageId: 'creator-forge',
          fundingSource: 'wallet',
          selections: { logo: { level: 0, quantity: 1 } },
          policyAccepted: true,
          brief: {
            channelName: 'Failure Recovery Stream',
            platform: 'Twitch',
            style: 'Retro',
            colors: 'Purple',
            instructions: 'Testing recovery banner and cart preservation on malformed response.',
          },
          uploadedFiles: [],
          termsAccepted: true,
          currentStep: 5,
          savedAt: Date.now(),
        },
        version: 1,
      }));
    }, { pId: projectId, uId: testUser.id, email: testUserEmail });

    await page.goto('/new-project?step=5', { waitUntil: 'networkidle' });

    const launchBtn = page.getByRole('button', { name: 'Confirm & Launch', exact: true });
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    // Verify recovery banner is displayed with link to My Projects
    await expect(page.getByText(/could not confirm the project ID/i)).toBeVisible({ timeout: 5000 });
    const projectsLink = page.getByRole('link', { name: /View in My Projects/i });
    await expect(projectsLink).toBeVisible();

    // Cart is preserved (NOT wiped!)
    const preservedPackage = await page.evaluate(() => {
      const stored = localStorage.getItem('humantek_wizard_cart');
      return JSON.parse(stored || '{}')?.state?.selectedPackageId;
    });
    expect(preservedPackage).toBe('creator-forge');
  });
});
