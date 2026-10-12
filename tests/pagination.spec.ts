import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe('Creator Studio Pagination, Accessibility & Scale UI Suite', () => {
  test.setTimeout(90000);

  const ts = Date.now();
  const testTag = `PW_PAG_${ts}`;
  const testPass = 'PlaywrightTest2026!';

  // User 1: 30-project client (5 active, 25 delivered)
  const client30Email = `pw.client30.${ts}@example.com`;
  let client30Id: string;
  let client30Cookies: { name: string; value: string; url: string }[] = [];

  // User 2: 2-project client (filters should be hidden)
  const client2Email = `pw.client2.${ts}@example.com`;
  let client2Id: string;
  let client2Cookies: { name: string; value: string; url: string }[] = [];

  // User 3: 12-project all-delivered client (default tab fallback to "all")
  const clientDeliveredEmail = `pw.client12deliv.${ts}@example.com`;
  let clientDeliveredId: string;
  let clientDeliveredCookies: { name: string; value: string; url: string }[] = [];

  // User 4: Admin with 200 projects
  const adminEmail = `pw.admin200.${ts}@humantek.art`;
  let adminId: string;
  let adminCookies: { name: string; value: string; url: string }[] = [];

  async function loginAndGetCookies(email: string, pass: string) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return setCookies.map((c) => {
      const parts = c.split(';')[0].split('=');
      return {
        name: parts[0].trim(),
        value: parts.slice(1).join('=').trim(),
        url: 'http://localhost:3000',
      };
    });
  }

  test.beforeAll(async () => {
    // 1. Provision Client 30
    const { data: u30 } = await adminSupabase.auth.admin.createUser({
      email: client30Email,
      password: testPass,
      email_confirm: true,
    });
    client30Id = u30.user!.id;
    await adminSupabase.from('profiles').upsert({ id: client30Id, email: client30Email, full_name: 'Alice 30 Projects', role: 'client' });

    // Seed 30 projects (5 active, 25 delivered)
    const p30List: any[] = [];
    const baseTime = Date.now();
    for (let i = 1; i <= 30; i++) {
      const isDelivered = i > 5;
      const pCode = i === 29 ? `HT-ALPHA-9929` : `HT-PW30-${String(i).padStart(2, '0')}`;
      p30List.push({
        id: `proj-pw30-${ts}-${i}`,
        project_code: pCode,
        user_id: client30Id,
        package_id: 'studio-momentum',
        package_name: 'Studio Momentum',
        status: isDelivered ? 'delivered' : 'in_production',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 1500,
        package_credits: 660,
        total_credits: 660,
        client_name: 'Alice 30 Projects',
        channel_name: i === 29 ? 'AlphaCreative Studio' : `Show #${i}`,
        email: client30Email,
        platform: 'YouTube',
        style: 'Minimal',
        colors: '#FFD700',
        instructions: `[${testTag}] Brief #${i}`,
        created_at: new Date(baseTime - i * 60000).toISOString(),
      });
    }
    await adminSupabase.from('projects').insert(p30List);

    // Seed deliverable items for Project 29
    await adminSupabase.from('project_items').insert([
      {
        project_id: `proj-pw30-${ts}-29`,
        service_id: 'logo',
        service_name: 'Custom Vector Logo',
        tier_level: 1,
        quantity: 1,
        unit_credits: 75,
        total_credits: 75,
      },
      {
        project_id: `proj-pw30-${ts}-29`,
        service_id: 'banner',
        service_name: 'YouTube Panoramic Banner',
        tier_level: 1,
        quantity: 1,
        unit_credits: 150,
        total_credits: 150,
      },
    ]);

    // 2. Provision Client 2 (<= 3 projects to test hidden filter tabs)
    const { data: u2 } = await adminSupabase.auth.admin.createUser({
      email: client2Email,
      password: testPass,
      email_confirm: true,
    });
    client2Id = u2.user!.id;
    await adminSupabase.from('profiles').upsert({ id: client2Id, email: client2Email, full_name: 'Bob 2 Projects', role: 'client' });
    await adminSupabase.from('projects').insert([
      {
        id: `proj-pw2-${ts}-1`,
        project_code: `HT-PW2-01`,
        user_id: client2Id,
        package_id: 'creator-forge',
        package_name: 'Creator Forge',
        status: 'in_production',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 500,
        package_credits: 220,
        total_credits: 220,
        client_name: 'Bob 2 Projects',
        channel_name: 'Bob Channel',
        email: client2Email,
        platform: 'YouTube',
        instructions: `[${testTag}] Bob brief 1`,
        created_at: new Date(baseTime - 10000).toISOString(),
      },
      {
        id: `proj-pw2-${ts}-2`,
        project_code: `HT-PW2-02`,
        user_id: client2Id,
        package_id: 'creator-forge',
        package_name: 'Creator Forge',
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 500,
        package_credits: 220,
        total_credits: 220,
        client_name: 'Bob 2 Projects',
        channel_name: 'Bob Channel',
        email: client2Email,
        platform: 'YouTube',
        instructions: `[${testTag}] Bob brief 2`,
        created_at: new Date(baseTime - 20000).toISOString(),
      },
    ]);

    // 3. Provision Client 12 Delivered (0 active — tests fallback from default 'active' tab to 'all')
    const { data: u12 } = await adminSupabase.auth.admin.createUser({
      email: clientDeliveredEmail,
      password: testPass,
      email_confirm: true,
    });
    clientDeliveredId = u12.user!.id;
    await adminSupabase.from('profiles').upsert({ id: clientDeliveredId, email: clientDeliveredEmail, full_name: 'Delivered Only Client', role: 'client' });
    const p12List: any[] = [];
    for (let i = 1; i <= 12; i++) {
      p12List.push({
        id: `proj-pw12-${ts}-${i}`,
        project_code: `HT-PW12-${String(i).padStart(2, '0')}`,
        user_id: clientDeliveredId,
        package_id: 'studio-momentum',
        package_name: 'Studio Momentum',
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 1500,
        package_credits: 660,
        total_credits: 660,
        client_name: 'Delivered Only Client',
        channel_name: `DeliveredShow #${i}`,
        email: clientDeliveredEmail,
        platform: 'YouTube',
        instructions: `[${testTag}] Delivered brief #${i}`,
        created_at: new Date(baseTime - i * 40000).toISOString(),
      });
    }
    await adminSupabase.from('projects').insert(p12List);

    // 4. Provision Admin 200
    const { data: uAdmin } = await adminSupabase.auth.admin.createUser({
      email: adminEmail,
      password: testPass,
      email_confirm: true,
    });
    adminId = uAdmin.user!.id;
    await adminSupabase.from('profiles').upsert({ id: adminId, email: adminEmail, full_name: 'Admin Scale Tester', role: 'admin' });
    const pAdminList: any[] = [];
    for (let i = 1; i <= 200; i++) {
      pAdminList.push({
        id: `proj-pwadmin-${ts}-${i}`,
        project_code: `HT-PWADMIN-${String(i).padStart(3, '0')}`,
        user_id: adminId,
        package_id: 'signature-collective',
        package_name: 'Signature Collective',
        status: i <= 50 ? 'pending_review' : (i <= 100 ? 'in_production' : 'delivered'),
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 3000,
        package_credits: 1500,
        total_credits: 1500,
        client_name: `Admin Scale Client ${i}`,
        channel_name: `AdminChannel ${i}`,
        email: `scale.pw.${i}@example.com`,
        platform: 'YouTube',
        instructions: `[${testTag}] Admin brief #${i}`,
        created_at: new Date(baseTime - i * 50000).toISOString(),
      });
    }
    await adminSupabase.from('projects').insert(pAdminList.slice(0, 100));
    await adminSupabase.from('projects').insert(pAdminList.slice(100, 200));

    // Authenticate all users
    client30Cookies = await loginAndGetCookies(client30Email, testPass);
    client2Cookies = await loginAndGetCookies(client2Email, testPass);
    clientDeliveredCookies = await loginAndGetCookies(clientDeliveredEmail, testPass);
    adminCookies = await loginAndGetCookies(adminEmail, testPass);
  });

  test.afterAll(async () => {
    // Clean up all seeded records
    await adminSupabase.from('project_items').delete().like('project_id', `proj-pw30-${ts}-%`);
    await adminSupabase.from('projects').delete().in('user_id', [client30Id, client2Id, clientDeliveredId, adminId]);
    await adminSupabase.from('profiles').delete().in('id', [client30Id, client2Id, clientDeliveredId, adminId]);
    await adminSupabase.auth.admin.deleteUser(client30Id);
    await adminSupabase.auth.admin.deleteUser(client2Id);
    await adminSupabase.auth.admin.deleteUser(clientDeliveredId);
    await adminSupabase.auth.admin.deleteUser(adminId);
  });

  // ===========================================================================
  // TEST 1: 30-Project Client on Phone Viewport — Tabs, Compact Rows, Keyboard, Load More & Screenshot
  // ===========================================================================
  test('30-Project Client on Mobile Viewport: Compact rows, keyboard toggle, Load more and phone screenshot', async ({ page }) => {
    // Set mobile phone viewport (iPhone 13/14 size: 390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies(client30Cookies);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // Header & page title verification
    await expect(page.locator('h1')).toHaveText('My Projects', { timeout: 25000 });

    // 1. Default Tab: Client has 30 projects and 5 active, so default tab switches to 'active' ("In Progress")
    const inProgressTab = page.locator('button:has-text("In Progress")');
    await expect(inProgressTab).toBeVisible({ timeout: 15000 });

    // 2. Switch to 'Delivered' tab
    const deliveredTab = page.locator('button:has-text("Delivered")');
    await expect(deliveredTab).toBeVisible();
    await deliveredTab.click();

    // Wait for delivered projects to render
    await page.waitForTimeout(600);

    // 3. Compact Rows Accessibility Verification: role="button", aria-expanded="false"
    const compactRows = page.locator('div[role="button"][aria-expanded]');
    await expect(compactRows.first()).toBeVisible({ timeout: 15000 });
    const initialExpanded = await compactRows.first().getAttribute('aria-expanded');
    expect(initialExpanded).toBe('false');

    // 4. Click row to expand
    await compactRows.first().click();
    await page.waitForTimeout(300);
    const postClickExpanded = await compactRows.first().getAttribute('aria-expanded');
    expect(postClickExpanded).toBe('true');

    // Verify expanded details appeared (Pipeline stepper and deliverable section)
    await expect(page.locator('text=Delivery Completion Pipeline')).toBeVisible();

    // 5. Keyboard accessibility: collapse via Space key and re-expand via Enter key
    await compactRows.first().focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    expect(await compactRows.first().getAttribute('aria-expanded')).toBe('false');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    expect(await compactRows.first().getAttribute('aria-expanded')).toBe('true');

    // 6. Keyset Pagination "Load More" Button:
    // Delivered tab has 25 projects total. Limit per batch is 20, so 20 projects are shown.
    const loadMoreButton = page.locator('button:has-text("Load More Projects")');
    await expect(loadMoreButton).toBeVisible();
    const liveCounter = page.locator('p[aria-live="polite"]');
    await expect(liveCounter).toContainText('Loaded 20 of 25 projects');

    // Click "Load More Projects" to fetch remaining batch (5 projects)
    await loadMoreButton.click();
    await page.waitForTimeout(800);

    // Verify counter updated to 25 and Load More button disappears
    await expect(liveCounter).toContainText('Loaded 25 of 25 projects', { timeout: 15000 });
    await expect(loadMoreButton).not.toBeVisible({ timeout: 15000 });

    // 7. Debounced Server Search: Search for Project 29 (HT-ALPHA-9929)
    const searchInput = page.locator('input[placeholder*="Search by code"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('ALPHA');
    await page.waitForTimeout(600); // Wait for debounce

    // Verify search filtered down to project 29
    await expect(page.locator('text=HT-ALPHA-9929')).toBeVisible({ timeout: 15000 });

    // 8. Capture Mobile Phone Screenshot
    const screenshotPath = path.join(process.cwd(), 'tests', 'screenshots', 'phone-projects-delivered.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[Screenshot Captured] Phone viewport saved to: ${screenshotPath}`);
  });

  // ===========================================================================
  // TEST 2: Filter Tabs & Search Hidden when <= 3 Projects
  // ===========================================================================
  test('Filters & search are completely hidden when client has 3 or fewer projects', async ({ page }) => {
    await page.context().addCookies(client2Cookies);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // Header & page title verification
    await expect(page.locator('h1')).toHaveText('My Projects', { timeout: 25000 });

    // The 2 project cards should be rendered directly
    await expect(page.locator('text=HT-PW2-01')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=HT-PW2-02')).toBeVisible();

    // Client 2 only has 2 projects: Filter tabs and search bar must NOT be rendered
    const filterTabs = page.locator('button:has-text("In Progress")');
    const searchInput = page.locator('input[placeholder*="Search by code"]');
    await expect(filterTabs).not.toBeVisible();
    await expect(searchInput).not.toBeVisible();
  });

  // ===========================================================================
  // TEST 3: Default Tab Fallback to "All" when 0 Active Projects Exist
  // ===========================================================================
  test('Client with 12 delivered projects (0 active) falls back to "All" tab (not an empty In Progress tab)', async ({ page }) => {
    await page.context().addCookies(clientDeliveredCookies);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // Header & page title verification
    await expect(page.locator('h1')).toHaveText('My Projects', { timeout: 25000 });

    // Filter tabs should be visible because client has 12 projects (> 3)
    const allTab = page.locator('button:has-text("All")');
    await expect(allTab).toBeVisible();

    // Active tab count is 0, All tab count is 12
    await expect(page.locator('button:has-text("In Progress")')).toContainText('0');
    await expect(allTab).toContainText('12');

    // Page must NOT show empty state; it should show delivered projects under 'All'
    await expect(page.locator('text=HT-PW12-01')).toBeVisible();
    await expect(page.locator('text=No projects match the selected filter')).not.toBeVisible();
  });

  // ===========================================================================
  // TEST 4: Admin at Scale (200 Projects Pagination)
  // ===========================================================================
  test('Admin management query with 200 projects reflects real total count and offset pagination', async ({ page }) => {
    await page.context().addCookies(adminCookies);

    // Query admin projects endpoint
    const response = await page.request.get('/api/projects?limit=25&page=1');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.projects.length).toBe(25);
    expect(data.totalCount).toBeGreaterThanOrEqual(200);

    // Query page 2
    const p2Response = await page.request.get('/api/projects?limit=25&page=2');
    expect(p2Response.status()).toBe(200);
    const dataP2 = await p2Response.json();
    expect(dataP2.projects.length).toBe(25);
    expect(dataP2.projects[0].id).not.toBe(data.projects[0].id);
  });
});
