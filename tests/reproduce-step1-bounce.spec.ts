import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe('Reproduction: Checkout step-1 bounce regression suite', () => {
  test.setTimeout(60000);

  let testUser: any;
  let testUserEmail: string;
  const testUserPass = 'ReproTestPass2026!';

  test.beforeAll(async () => {
    const ts = Date.now();
    testUserEmail = `repro_client_${ts}@humantek.art`;

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPass,
      email_confirm: true,
      user_metadata: { full_name: 'Repro Test Client' },
    });
    if (error || !data.user) throw new Error(`User creation failed: ${error?.message}`);
    testUser = data.user;

    await adminSupabase.from('profiles').update({ role: 'client', full_name: 'Repro Test Client' }).eq('id', testUser.id);
    await adminSupabase.from('wallets').upsert({
      user_id: testUser.id,
      balance_purchased: 1000,
      balance_promo: 200,
    });
  });

  test.afterAll(async () => {
    if (testUser?.id) {
      await adminSupabase.auth.admin.deleteUser(testUser.id);
    }
  });

  test('Wallet Path: clicks through real UI steps and should reach confirmation route, NOT step 1', async ({ page }) => {
    // 1. Authenticate user via UI
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(testUserEmail);
    await page.locator('input[type="password"]').fill(testUserPass);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/projects/, { timeout: 15000 });

    // 2. Start new project from Step 1
    await page.goto('/new-project?step=1', { waitUntil: 'networkidle' });
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Select package "Creator Forge"
    const forgeBtn = page.getByRole('button', { name: 'Select Package' }).first();
    await forgeBtn.click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 3. Step 2: Add service
    await expect(page).toHaveURL(/.*step=2/, { timeout: 10000 });
    const addServiceBtn = page.locator('button:has-text("Add to Scope")').first();
    await addServiceBtn.click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 4. Step 3: Accept Policy
    await expect(page).toHaveURL(/.*step=3/, { timeout: 10000 });
    await page.locator('label:has-text("Required Acknowledgement")').click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 5. Step 4: Fill Project Details & Brief
    await expect(page).toHaveURL(/.*step=4/, { timeout: 10000 });
    await page.locator('input[placeholder*="KiraOfficial"]').fill('Repro Studio Twitch');
    await page.locator('textarea').first().fill('Detailed automated production test brief with more than thirty characters');
    await page.locator('label:has-text("Terms Confirmation")').click();

    // Advance to Step 5 (Review & Pay)
    const reviewBtn = page.locator('#studio-footer-actions button:has-text("Review & Pay")');
    await reviewBtn.click();
    await expect(page).toHaveURL(/.*step=5/, { timeout: 10000 });

    // Click wallet confirm & launch button
    const launchBtn = page.getByRole('button', { name: /Confirm & Launch/i });
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    // MUST reach /new-project/confirmation/[id], NOT /new-project?step=1
    await expect(page).toHaveURL(/\/new-project\/confirmation\/proj-/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Project started|Payment received/i);
  });

  test('Manual Path: clicks through real UI and submits for review without payment', async ({ page }) => {
    // 1. Authenticate user via UI
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(testUserEmail);
    await page.locator('input[type="password"]').fill(testUserPass);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/projects/, { timeout: 15000 });

    // 2. Start new project from Step 1
    await page.goto('/new-project?step=1', { waitUntil: 'networkidle' });
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Select package "Creator Forge"
    const forgeBtn = page.getByRole('button', { name: 'Select Package' }).first();
    await forgeBtn.click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 3. Step 2: Add service
    await expect(page).toHaveURL(/.*step=2/, { timeout: 10000 });
    const addServiceBtn = page.locator('button:has-text("Add to Scope")').first();
    await addServiceBtn.click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 4. Step 3: Accept Policy
    await expect(page).toHaveURL(/.*step=3/, { timeout: 10000 });
    await page.locator('label:has-text("Required Acknowledgement")').click();
    await page.locator('#studio-footer-actions button:has-text("Next")').click();

    // 5. Step 4: Fill Details
    await expect(page).toHaveURL(/.*step=4/, { timeout: 10000 });
    await page.locator('input[placeholder*="KiraOfficial"]').fill('Repro Manual Review Channel');
    await page.locator('textarea').first().fill('Manual review request with sufficient characters for brief validation');
    await page.locator('label:has-text("Terms Confirmation")').click();

    // Advance to Step 5
    const reviewBtn = page.locator('#studio-footer-actions button:has-text("Review & Pay")');
    await reviewBtn.click();
    await expect(page).toHaveURL(/.*step=5/, { timeout: 10000 });

    // Click "Request review (no payment yet) →"
    const manualBtn = page.getByRole('button', { name: /Request review/i });
    await expect(manualBtn).toBeVisible({ timeout: 10000 });
    await manualBtn.click();

    // MUST reach /new-project/confirmation/[id], NOT /new-project?step=1
    await expect(page).toHaveURL(/\/new-project\/confirmation\/proj-/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Project submitted for review|Project started/i);
  });
});
