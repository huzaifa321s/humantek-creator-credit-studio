import { test, expect } from '@playwright/test';

test.describe('Creator Studio - Regression & UX Check', () => {
  test.setTimeout(60000);

  test('1. Guest Header: Sign In button appears immediately without skeleton delay', async ({ page }) => {
    await page.goto('/new-project?step=1', { waitUntil: 'domcontentloaded' });
    const signInButton = page.locator('header a[href="/login"] button:has-text("Sign In")');
    await expect(signInButton).toBeVisible({ timeout: 5000 });
  });

  test('2. Guest Review Gate: Desktop opens Dialog modal; selections persist across refresh', async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/new-project?step=1', { waitUntil: 'networkidle' });

    // Step 1: Wait for hydration and select package "Creator Forge"
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    const forgeBtn = page.getByRole('button', { name: 'Select Package' }).first();
    await forgeBtn.click();
    await expect(page.locator('button:has-text("Selected")').first()).toBeVisible({ timeout: 5000 });
    const nextBtn1 = page.locator('#studio-footer-actions button:has-text("Next")');
    await expect(nextBtn1).toBeEnabled({ timeout: 5000 });
    await nextBtn1.click();
    await expect(page).toHaveURL(/.*step=2/, { timeout: 10000 });

    // Step 2: Add service
    const addServiceBtn = page.locator('button:has-text("Add to Scope")').first();
    await addServiceBtn.click();
    await expect(page.locator('button[aria-label="Remove from scope"]').first()).toBeVisible({ timeout: 5000 });

    // Advance to Step 3
    const nextBtn2 = page.locator('#studio-footer-actions button:has-text("Next")');
    await nextBtn2.click();
    await expect(page).toHaveURL(/.*step=3/, { timeout: 10000 });

    // Step 3: Accept policy
    await page.locator('label:has-text("Required Acknowledgement")').click();
    await page.waitForTimeout(300);

    // Advance to Step 4
    const nextBtn3 = page.locator('#studio-footer-actions button:has-text("Next")');
    await nextBtn3.click();
    await expect(page).toHaveURL(/.*step=4/, { timeout: 10000 });

    // Step 4: Fill brief
    const channelInput = page.locator('input[placeholder*="KiraOfficial"]');
    await channelInput.fill('Studio Verification Channel');

    const instructionsTextarea = page.locator('textarea').first();
    await instructionsTextarea.fill('Detailed automated production test instructions with sufficient characters for brief validation');

    // Accept terms
    await page.locator('label:has-text("Terms Confirmation")').click();

    const beforeUrl = page.url();
    const beforeStorage = await page.evaluate(() => window.localStorage.getItem('humantek_wizard_cart'));
    console.log('BEFORE RELOAD URL:', beforeUrl);
    console.log('BEFORE RELOAD STORAGE:', beforeStorage);

    // Refresh page: selections, brief text, and step 4 should persist without empty cart flash
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder*="KiraOfficial"]')).toHaveValue('Studio Verification Channel', { timeout: 10000 });

    // Click Review & Pay -> AuthModal opens as Dialog on Desktop
    const reviewBtn = page.locator('#studio-footer-actions button:has-text("Review & Pay")');
    await expect(reviewBtn).toBeVisible({ timeout: 5000 });
    await reviewBtn.click();

    const authModal = page.locator('[data-testid="auth-dialog"]');
    await expect(authModal).toBeVisible({ timeout: 5000 });
    await expect(authModal.locator('input[type="email"]')).toBeVisible();
  });

  test('3. Mobile Viewport: AuthModal renders on phone viewports when clicking Review', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/new-project?step=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Select package on mobile
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    const mobileForgeBtn = page.getByRole('button', { name: 'Select Package' }).first();
    await mobileForgeBtn.click();
    await expect(page.locator('button:has-text("Selected")').first()).toBeVisible({ timeout: 5000 });

    // Step 1 -> 2
    await page.locator('#studio-footer-actions button:has-text("Next")').click();
    await expect(page).toHaveURL(/.*step=2/, { timeout: 10000 });

    // Step 2: Add service
    const addServiceBtn = page.locator('button:has-text("Add to Scope")').first();
    await addServiceBtn.click();
    await expect(page.locator('button[aria-label="Remove from scope"]').first()).toBeVisible({ timeout: 5000 });

    // Step 2 -> 3
    await page.locator('#studio-footer-actions button:has-text("Next")').click();
    await expect(page).toHaveURL(/.*step=3/, { timeout: 10000 });

    // Accept policy
    await page.locator('label:has-text("Required Acknowledgement")').click();

    // Step 3 -> 4
    await page.locator('#studio-footer-actions button:has-text("Next")').click();
    await expect(page).toHaveURL(/.*step=4/, { timeout: 10000 });

    // Fill brief
    await page.locator('input[placeholder*="KiraOfficial"]').fill('Mobile Channel');
    await page.locator('textarea').first().fill('Mobile verification instructions with sufficient characters for brief validation');
    await page.locator('label:has-text("Terms Confirmation")').click();

    // Click Review & Pay on mobile
    const reviewBtn = page.locator('#studio-footer-actions button:has-text("Review & Pay")');
    await expect(reviewBtn).toBeVisible({ timeout: 5000 });
    await reviewBtn.click();

    // AuthModal opens on mobile as a bottom drawer
    const drawer = page.locator('[data-testid="auth-drawer"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.locator('input[type="email"]')).toBeVisible();
  });
});
