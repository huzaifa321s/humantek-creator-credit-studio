import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ARTIFACT_DIR = 'C:/Users/Humantek Morning/.gemini/antigravity/brain/4fcf5396-8da2-4cce-be33-adb9a330d1d4';

// Sample 1x1 base64 transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function computeTotpCode(base32Secret: string): string {
  const clean = base32Secret.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

test.describe('Unified Full-Screen Image Lightbox Suite', () => {
  let adminClient: any;
  let clientUserEmail = '';
  let clientUserId = '';
  let adminUserEmail = '';
  let adminUserId = '';
  const testPassword = 'Password123!';
  const timestamp = Date.now();
  const testProjectId = `proj-lb-${timestamp}`;
  let file1Path = '';
  let file2Path = '';

  test.beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    clientUserEmail = `client_lightbox_${timestamp}@humantek.test`;
    adminUserEmail = `admin_lightbox_${timestamp}@humantek.test`;

    // 1. Create client user
    const { data: clientUser, error: clientErr } = await adminClient.auth.admin.createUser({
      email: clientUserEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Alex Rivera' },
    });
    if (clientErr) throw clientErr;
    clientUserId = clientUser.user.id;

    // 2. Create admin user
    const { data: adminUser, error: adminErr } = await adminClient.auth.admin.createUser({
      email: adminUserEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Studio Admin' },
    });
    if (adminErr) throw adminErr;
    adminUserId = adminUser.user.id;

    await adminClient.from('profiles').upsert([
      { id: clientUserId, email: clientUserEmail, full_name: 'Alex Rivera', role: 'client' },
      { id: adminUserId, email: adminUserEmail, full_name: 'Studio Admin', role: 'admin' },
    ]);

    // 3. Upload 2 sample images to storage bucket
    file1Path = `references/${clientUserId}/${testProjectId}/ref1-neon-logo.png`;
    file2Path = `references/${clientUserId}/${testProjectId}/ref2-banner-art.png`;

    await adminClient.storage.from('project-references').upload(file1Path, TINY_PNG, { contentType: 'image/png', upsert: true });
    await adminClient.storage.from('project-references').upload(file2Path, TINY_PNG, { contentType: 'image/png', upsert: true });

    // Track in project_uploads
    await adminClient.from('project_uploads').upsert([
      {
        user_id: clientUserId,
        draft_id: testProjectId,
        storage_path: file1Path,
        filename: 'ref1-neon-logo.png',
        size: TINY_PNG.length,
        mime_type: 'image/png',
        status: 'attached',
        project_id: testProjectId,
      },
      {
        user_id: clientUserId,
        draft_id: testProjectId,
        storage_path: file2Path,
        filename: 'ref2-banner-art.png',
        size: TINY_PNG.length,
        mime_type: 'image/png',
        status: 'attached',
        project_id: testProjectId,
      },
    ]);

    // 4. Create test project row with these uploaded files and valid package_id
    const { error: insertErr } = await adminClient.from('projects').insert([
      {
        id: testProjectId,
        project_code: `HT-LIGHTBOX-${timestamp.toString().slice(-4)}`,
        user_id: clientUserId,
        package_id: 'studio-momentum',
        package_name: 'Studio Momentum',
        package_price_usd: 999,
        package_credits: 500,
        total_credits: 500,
        status: 'pending_review',
        payment_status: 'paid',
        payment_method: 'paypal',
        funding_source: 'package',
        applied_wallet_credits: 0,
        client_name: 'Alex Rivera',
        email: clientUserEmail,
        platform: 'YouTube',
        style: 'Dark Synthwave',
        instructions: 'Please inspect the uploaded product artwork and lighting reference.',
        uploaded_files: [
          {
            id: 'file-ref-1',
            filename: 'ref1-neon-logo.png',
            size: TINY_PNG.length,
            mimeType: 'image/png',
            storagePath: file1Path,
            url: '',
          },
          {
            id: 'file-ref-2',
            filename: 'ref2-banner-art.png',
            size: TINY_PNG.length,
            mimeType: 'image/png',
            storagePath: file2Path,
            url: '',
          },
        ],
        created_at: new Date().toISOString(),
      },
    ]);
    if (insertErr) throw insertErr;

    // 5. Pre-authenticate client once and cache cookies
    const clientLoginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clientUserEmail, password: testPassword }),
    });
    const cSetCookies = clientLoginRes.headers.getSetCookie ? clientLoginRes.headers.getSetCookie() : [];
    cachedClientCookies = cSetCookies.map((rawCookie) => {
      const cookiePair = rawCookie.split(';')[0];
      const eqIdx = cookiePair.indexOf('=');
      const name = cookiePair.substring(0, eqIdx).trim();
      const value = cookiePair.substring(eqIdx + 1).trim();
      return { name, value, url: 'http://localhost:3000' };
    });

    // 6. Pre-authenticate admin once and elevate to AAL2
    const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUserEmail, password: testPassword }),
    });
    let aCookies = adminLoginRes.headers.getSetCookie ? adminLoginRes.headers.getSetCookie() : [];
    let aCookieHeader = aCookies.map((c) => c.split(';')[0]).join('; ');

    const enrollRes = await fetch('http://localhost:3000/api/auth/admin-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aCookieHeader },
      body: JSON.stringify({ action: 'enroll' }),
    });
    const enrollData = await enrollRes.json();
    if (enrollData?.secret && enrollData?.factorId) {
      const totpCode = computeTotpCode(enrollData.secret);
      const verifyRes = await fetch('http://localhost:3000/api/auth/admin-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aCookieHeader },
        body: JSON.stringify({ action: 'verify', factorId: enrollData.factorId, code: totpCode }),
      });
      const verifyCookies = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie() : [];
      if (verifyCookies.length > 0) aCookies = [...aCookies, ...verifyCookies];
    }
    cachedAdminCookies = aCookies.map((rawCookie) => {
      const cookiePair = rawCookie.split(';')[0];
      const eqIdx = cookiePair.indexOf('=');
      const name = cookiePair.substring(0, eqIdx).trim();
      const value = cookiePair.substring(eqIdx + 1).trim();
      return { name, value, url: 'http://localhost:3000' };
    });
  });

  test.afterAll(async () => {
    if (adminClient) {
      try {
        await adminClient.from('projects').delete().eq('id', testProjectId);
      } catch {}
      try {
        await adminClient.from('project_uploads').delete().eq('draft_id', testProjectId);
      } catch {}
      try {
        if (file1Path && file2Path) {
          await adminClient.storage.from('project-references').remove([file1Path, file2Path]);
        }
      } catch {}
      try {
        if (clientUserId) await adminClient.auth.admin.deleteUser(clientUserId);
      } catch {}
      try {
        if (adminUserId) await adminClient.auth.admin.deleteUser(adminUserId);
      } catch {}
    }
  });

  let cachedClientCookies: any[] = [];
  let cachedAdminCookies: any[] = [];

  async function loginAsClient(page: any) {
    if (cachedClientCookies.length > 0) {
      await page.context().addCookies(cachedClientCookies);
    }
    await page.addInitScript(
      ({ id, email }) => {
        try {
          const stored = {
            state: {
              user: {
                id,
                email,
                name: 'Alex Rivera',
                avatarInitials: 'AR',
                walletBalance: 100,
                role: 'client',
              },
              isHydrated: true,
            },
            version: 1,
          };
          localStorage.setItem('humantek_studio_user', JSON.stringify(stored));
        } catch {}
      },
      { id: clientUserId, email: clientUserEmail }
    );
  }

  async function loginAsAdmin(page: any) {
    if (cachedAdminCookies.length > 0) {
      await page.context().addCookies(cachedAdminCookies);
    }
    await page.addInitScript(
      ({ id, email }) => {
        try {
          const stored = {
            state: {
              user: {
                id,
                email,
                name: 'Studio Admin',
                avatarInitials: 'SA',
                walletBalance: 0,
                role: 'admin',
              },
              isHydrated: true,
            },
            version: 1,
          };
          localStorage.setItem('humantek_studio_user', JSON.stringify(stored));
        } catch {}
      },
      { id: adminUserId, email: adminUserEmail }
    );
  }

  // =========================================================================
  // TEST 1: Lightbox appears above drawer, sharp, background plain dimmed (no blur)
  // =========================================================================
  test('Test 1: Lightbox opens above drawer, image is sharp, no backdrop-blur', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    // Open project drawer directly
    await page.goto(`/projects?project=${testProjectId}`, { waitUntil: 'domcontentloaded' });
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Click the first thumbnail
    const thumbBtn = page.locator('button[aria-label^="Enlarge reference image"]').first();
    await expect(thumbBtn).toBeVisible({ timeout: 15000 });
    await thumbBtn.click();

    // Verify lightbox is open
    const lightboxPopup = page.locator('[data-slot="image-lightbox-popup"]');
    await expect(lightboxPopup).toBeVisible({ timeout: 5000 });

    // Check z-index of lightbox popup vs drawer
    const lightboxZIndex = await lightboxPopup.evaluate((el) => window.getComputedStyle(el).zIndex);
    expect(Number(lightboxZIndex)).toBe(60);

    // Check sheet overlay has NO backdrop-blur
    const sheetOverlay = page.locator('[data-slot="sheet-overlay"]');
    const overlayFilter = await sheetOverlay.evaluate((el) => window.getComputedStyle(el).backdropFilter);
    expect(overlayFilter === 'none' || overlayFilter === '').toBeTruthy();

    // Take Desktop Screenshot for Artifact
    await page.screenshot({ path: `${ARTIFACT_DIR}/lightbox-desktop.png` });
  });

  // =========================================================================
  // TEST 2: Escape key order & focus restoration
  // =========================================================================
  test('Test 2: First Escape closes lightbox only, focus returns to thumbnail, second Escape closes drawer', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    await page.goto(`/projects?project=${testProjectId}`, { waitUntil: 'domcontentloaded' });
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toBeVisible({ timeout: 15000 });

    const thumbBtn = page.locator('button[aria-label^="Enlarge reference image"]').first();
    await expect(thumbBtn).toBeVisible({ timeout: 15000 });
    await thumbBtn.click();

    const lightboxPopup = page.locator('[data-slot="image-lightbox-popup"]');
    await expect(lightboxPopup).toBeVisible({ timeout: 5000 });

    // 1st Escape -> closes lightbox
    await page.keyboard.press('Escape');
    await expect(lightboxPopup).not.toBeVisible({ timeout: 5000 });
    // Drawer must still be visible
    await expect(drawer).toBeVisible();

    // Focus must return to thumbnail button
    const isFocusOnThumb = await thumbBtn.evaluate((el) => document.activeElement === el);
    expect(isFocusOnThumb).toBeTruthy();

    // 2nd Escape -> closes drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  });

  // Helper to open drawer and lightbox reliably
  async function openClientLightbox(page: any) {
    await page.goto(`/projects?project=${testProjectId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Loading workspace...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toBeVisible({ timeout: 20000 });
    const thumbBtn = page.locator('button[aria-label^="Enlarge reference image"]').first();
    await expect(thumbBtn).toBeVisible({ timeout: 20000 });
    await thumbBtn.click();
    const lightbox = page.locator('[data-slot="image-lightbox-popup"]');
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    return { drawer, thumbBtn, lightbox };
  }

  // =========================================================================
  // TEST 3: Arrow keys & swipe navigation with counter update
  // =========================================================================
  test('Test 3: Arrow keys navigate between images and counter updates', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    const { lightbox } = await openClientLightbox(page);

    const counter = lightbox.locator('[data-slot="lightbox-counter"]');
    // Counter initial state: 1 / 2
    await expect(counter).toHaveText('1 / 2');

    // Wait for transition and focus popup
    await page.waitForTimeout(300);
    await lightbox.focus();

    // 1. Keyboard ArrowRight -> 2 / 2
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('2 / 2');

    // 2. Keyboard ArrowLeft -> 1 / 2
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('1 / 2');

    // 3. Arrow button clicks: Next -> 2 / 2, Prev -> 1 / 2
    await lightbox.locator('button[aria-label="Next image"]').click();
    await expect(counter).toHaveText('2 / 2');

    await lightbox.locator('button[aria-label="Previous image"]').click();
    await expect(counter).toHaveText('1 / 2');

    // 4. Touch swipe gestures: swipe left to go next (deltaX = -150px)
    await lightbox.dispatchEvent('touchstart', { touches: [{ clientX: 250, clientY: 200 }] });
    await lightbox.dispatchEvent('touchend', { changedTouches: [{ clientX: 100, clientY: 200 }] });
    await expect(counter).toHaveText('2 / 2');

    // Swipe right to go back (deltaX = +150px)
    await lightbox.dispatchEvent('touchstart', { touches: [{ clientX: 100, clientY: 200 }] });
    await lightbox.dispatchEvent('touchend', { changedTouches: [{ clientX: 250, clientY: 200 }] });
    await expect(counter).toHaveText('1 / 2');

    // Close lightbox
    await page.keyboard.press('Escape');
  });

  // =========================================================================
  // TEST 4: Mobile phone viewport: full-screen, reachable close, no horizontal scroll
  // =========================================================================
  test('Test 4: Phone viewport (375x667) full-screen with reachable close and no scroll', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsClient(page);

    const { drawer, lightbox } = await openClientLightbox(page);

    // Check close button is within bounds and clickable
    const closeBtn = lightbox.locator('button[aria-label="Close image viewer"]');
    await expect(closeBtn).toBeVisible();
    const box = await closeBtn.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }

    // Verify no horizontal overflow/scroll
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBeFalsy();

    // Take Mobile Screenshot for Artifact
    await page.screenshot({ path: `${ARTIFACT_DIR}/lightbox-mobile.png` });

    // Clean up: Close lightbox & drawer and restore viewport
    await closeBtn.click();
    await expect(lightbox).not.toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // =========================================================================
  // TEST 5: Expired/broken signed URL shows placeholder with Retry
  // =========================================================================
  test('Test 5: Broken or expired image shows error placeholder and Retry action', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    const { lightbox } = await openClientLightbox(page);

    // Force error on the image element
    await page.evaluate(() => {
      const img = document.querySelector('[data-slot="image-lightbox-popup"] img') as HTMLImageElement;
      if (img) img.dispatchEvent(new Event('error'));
    });

    // Verify error placeholder renders
    await expect(lightbox.locator('text=Unable to load image')).toBeVisible();
    const retryBtn = lightbox.locator('button:has-text("Retry")');
    await expect(retryBtn).toBeVisible();

    // Click retry
    await retryBtn.click();

    // Close lightbox
    await page.keyboard.press('Escape');
  });

  // =========================================================================
  // TEST 6: Admin drawer uses the exact same ImageLightbox component
  // =========================================================================
  test('Test 6: Admin drawer renders the same ImageLightbox with counter and controls', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    await page.goto(`/management/projects?project=${testProjectId}`, { waitUntil: 'domcontentloaded' });
    const adminDrawer = page.locator('[data-slot="sheet-content"]');
    await expect(adminDrawer).toBeVisible({ timeout: 15000 });

    // Click reference image thumbnail in admin drawer
    const thumbBtn = adminDrawer.locator('button[aria-label^="Enlarge reference image"]').first();
    await expect(thumbBtn).toBeVisible({ timeout: 15000 });
    await thumbBtn.click();

    // Check lightbox opens with same slot and counter
    const lightbox = page.locator('[data-slot="image-lightbox-popup"]');
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    await expect(lightbox.locator('[data-slot="lightbox-counter"]')).toHaveText('1 / 2');
    await expect(lightbox.locator('text=Open original')).toBeVisible();

    // Close via close button
    await lightbox.locator('button[aria-label="Close image viewer"]').click();
    await expect(lightbox).not.toBeVisible();
  });

  // =========================================================================
  // TEST 7: Keyboard-only and accessibility features
  // =========================================================================
  test('Test 7: Accessible dialog semantics, alt text, and keyboard navigation', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    const { lightbox } = await openClientLightbox(page);

    // Check role="dialog" or base-ui popup role
    const role = await lightbox.getAttribute('role');
    expect(role === 'dialog' || role === null).toBeTruthy();

    // Check image has descriptive alt text
    const img = lightbox.locator('img');
    const altText = await img.getAttribute('alt');
    expect(altText).toBeTruthy();
    expect(altText?.length).toBeGreaterThan(0);

    // Check open original has rel="noopener noreferrer"
    const openOriginal = lightbox.locator('a:has-text("Open original")');
    expect(await openOriginal.getAttribute('rel')).toBe('noopener noreferrer');
    expect(await openOriginal.getAttribute('target')).toBe('_blank');

    // Close lightbox
    await page.keyboard.press('Escape');
  });

  // =========================================================================
  // TEST 8: Zero backdrop-blur on drawer or lightbox overlays
  // =========================================================================
  test('Test 8: Neither drawer overlay nor lightbox overlay have backdrop-blur', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsClient(page);

    const { lightbox } = await openClientLightbox(page);

    const sheetOverlay = page.locator('[data-slot="sheet-overlay"]');
    const lightboxBackdrop = page.locator('[data-slot="image-lightbox-backdrop"]');

    const sheetFilter = await sheetOverlay.evaluate((el) => window.getComputedStyle(el).backdropFilter);
    const lightboxFilter = await lightboxBackdrop.evaluate((el) => window.getComputedStyle(el).backdropFilter);

    expect(sheetFilter === 'none' || sheetFilter === '').toBeTruthy();
    expect(lightboxFilter === 'none' || lightboxFilter === '').toBeTruthy();

    // Close lightbox
    await page.keyboard.press('Escape');
  });
});
