import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

test.describe('Admin Management Console — Nested Routes & Architecture Suite', () => {
  let adminEmail = '';
  let adminId = '';
  const testPassword = 'Password123!';
  let adminClient: any;

  test.beforeAll(async () => {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ts = Date.now();
    adminEmail = `admin_nested_${ts}@humantek.test`;

    // 1. Create Admin User
    const { data: adminUser, error: adminErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (adminErr || !adminUser.user) {
      throw new Error(`Failed to create admin user: ${adminErr?.message}`);
    }
    adminId = adminUser.user.id;

    // 2. Authoritative Admin Role in profiles
    await adminClient.from('profiles').upsert([
      { id: adminId, email: adminEmail, full_name: 'Lead Admin', role: 'admin' },
    ]);

    // 3. Seed 2 sample projects for testing
    await adminClient.from('projects').insert([
      {
        id: `proj-test-${ts}-1`,
        project_code: `HT-NEST-1`,
        user_id: adminId,
        package_id: 'standard',
        package_name: 'Studio Standard',
        package_price_usd: 1200,
        total_credits: 500,
        status: 'pending_review',
        payment_status: 'paid',
        client_name: 'Test Client Alpha',
        email: 'alpha@example.com',
        created_at: new Date().toISOString(),
      },
      {
        id: `proj-test-${ts}-2`,
        project_code: `HT-NEST-2`,
        user_id: adminId,
        package_id: 'pro',
        package_name: 'Studio Pro',
        package_price_usd: 2500,
        total_credits: 1000,
        status: 'in_progress',
        payment_status: 'paid',
        client_name: 'Test Client Beta',
        email: 'beta@example.com',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);
  });

  test.afterAll(async () => {
    if (adminClient && adminId) {
      await adminClient.from('projects').delete().eq('user_id', adminId);
      await adminClient.from('profiles').delete().eq('id', adminId);
      await adminClient.auth.admin.deleteUser(adminId);
    }
  });

  test('Executive Overview, Nested Route Navigation & Legacy Redirects', async ({ page, baseURL }) => {
    test.setTimeout(90000);
    const url = baseURL || 'http://localhost:3000';

    // 1. Log in via API to set session cookies
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: testPassword }),
    });
    expect(loginRes.ok).toBeTruthy();

    const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    const authCookies = setCookies.map((rawCookie) => {
      const cookiePair = rawCookie.split(';')[0];
      const eqIdx = cookiePair.indexOf('=');
      const name = cookiePair.substring(0, eqIdx).trim();
      const value = cookiePair.substring(eqIdx + 1).trim();
      return {
        name,
        value,
        domain: 'localhost',
        path: '/',
      };
    });
    if (authCookies.length > 0) {
      await page.context().addCookies(authCookies);
    }

    await page.addInitScript(
      ({ id, email }) => {
        try {
          const stored = {
            state: {
              user: {
                id,
                email,
                name: 'Lead Admin',
                avatarInitials: 'LA',
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
      { id: adminId, email: adminEmail }
    );

    // 2. Visit /management (Overview)
    await page.goto(`${url}/management`, { waitUntil: 'domcontentloaded' });

    // Assert Management Shell & Header
    await expect(page.locator('text=Agency Management Console')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Studio Admin').first()).toBeVisible();

    // Assert Live Action Centers & KPI presence
    await expect(page.getByRole('heading', { name: 'Project Scope Reviews' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Wire & Manual Orders' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Security & Settlements' })).toBeVisible();

    // 3. Test Navigation via Sidebar Links to /management/projects
    const navTab = (href: string) => page.locator(`aside a[href="${href}"], [data-sidebar="sidebar"] a[href="${href}"], a[href="${href}"]`).first();

    await navTab('/management/projects').click();
    await expect(page).toHaveURL(`${url}/management/projects`, { timeout: 10000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // 4. Test Drawer Deep-Linking with URL synchronization
    const detailsBtn = page.locator('button:has-text("Details")').first();
    await detailsBtn.click();
    await expect(page.locator('text=Close Drawer')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/project=/, { timeout: 10000 });

    // Close Drawer
    await page.locator('button:has-text("Close Drawer")').click();
    await expect(page.locator('text=Close Drawer')).not.toBeVisible();
    await expect(page).not.toHaveURL(/project=/, { timeout: 10000 });

    // 5. Test Navigation to /management/inbox
    await navTab('/management/inbox').click();
    await expect(page).toHaveURL(`${url}/management/inbox`, { timeout: 20000 });
    await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible({ timeout: 20000 });

    // 6. Test Navigation to /management/ledger
    await navTab('/management/ledger').click();
    await expect(page).toHaveURL(`${url}/management/ledger`, { timeout: 20000 });
    await expect(page.locator('input[placeholder*="Search reference"]')).toBeVisible({ timeout: 25000 });

    // 7. Test Navigation to /management/orders
    await navTab('/management/orders').click();
    await expect(page).toHaveURL(`${url}/management/orders`, { timeout: 20000 });
    await expect(page.locator('text=Manual Bank / Wire & Payoneer Orders')).toBeVisible({ timeout: 20000 });

    // 8. Test Navigation to /management/alerts
    await navTab('/management/alerts').click();
    await expect(page).toHaveURL(`${url}/management/alerts`, { timeout: 20000 });
    await expect(page.locator('text=Audit log of chargebacks, refund shortfalls')).toBeVisible({ timeout: 20000 });

    // 9. Test Legacy Backwards Compatibility: /management?tab=projects redirects to /management/projects
    await page.goto(`${url}/management?tab=projects`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`${url}/management/projects`, { timeout: 20000 });

    // 10. Test Legacy Backwards Compatibility: /management?tab=wire-orders redirects to /management/orders
    await page.goto(`${url}/management?tab=wire-orders`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(`${url}/management/orders`, { timeout: 10000 });
  });
});
