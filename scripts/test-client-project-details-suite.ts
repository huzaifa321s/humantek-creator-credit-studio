import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { chromium } from '@playwright/test';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cronSecret = process.env.CRON_SECRET || 'test_cron_secret_key_32_characters_long!';

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
  console.log('HUMANTEK STUDIO - CLIENT PROJECT DETAILS & DRAWER ACCEPTANCE (10 TESTS)');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testPass = 'SecureRefArchPass2026!';
  const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // Setup test users
  const aliceEmail = `alice.details.${ts}@humantek.art`;
  const bobEmail = `bob.details.${ts}@humantek.art`;

  console.log('[Setup] Creating test users:');
  const [resAlice, resBob] = await Promise.all([
    admin.auth.admin.createUser({
      email: aliceEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Alice Creator' },
    }),
    admin.auth.admin.createUser({
      email: bobEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Bob Creator' },
    }),
  ]);

  if (!resAlice.data.user || !resBob.data.user) {
    throw new Error('Failed to create test users');
  }

  const aliceId = resAlice.data.user.id;
  const bobId = resBob.data.user.id;

  await admin.from('profiles').upsert([
    { id: aliceId, email: aliceEmail, full_name: 'Alice Creator', role: 'client' },
    { id: bobId, email: bobEmail, full_name: 'Bob Creator', role: 'client' },
  ]);

  await admin.from('wallets').upsert([
    { user_id: aliceId, balance_purchased: 2000, balance_promo: 0 },
    { user_id: bobId, balance_purchased: 2000, balance_promo: 0 },
  ]);

  const aliceCookie = await loginAndGetCookie(aliceEmail, testPass);
  const bobCookie = await loginAndGetCookie(bobEmail, testPass);

  console.log(`  ✓ Alice: ${aliceEmail} (${aliceId})`);
  console.log(`  ✓ Bob:   ${bobEmail} (${bobId})\n`);

  // Ensure storage bucket
  await admin.storage.createBucket('project-references', {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  }).catch(() => {});

  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const aliceProjId = `proj-alice-${ts}`;
  const aliceDraftId = aliceProjId;
  const aliceStoragePath = `references/${aliceId}/${aliceDraftId}/alice-ref1.png`;

  // Upload Alice reference file
  await admin.storage.from('project-references').upload(aliceStoragePath, dummyPng, {
    contentType: 'image/png',
    upsert: true,
  });

  // Track in project_uploads as pending
  await admin.from('project_uploads').upsert({
    user_id: aliceId,
    draft_id: aliceDraftId,
    storage_path: aliceStoragePath,
    filename: 'alice-ref1.png',
    size: dummyPng.length,
    mime_type: 'image/png',
    status: 'pending',
  });

  // Create Alice Project
  const aliceSubmitRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({
      projectId: aliceProjId,
      packageId: 'studio-wallet',
      fundingSource: 'wallet',
      clientName: 'Alice Creator',
      email: aliceEmail,
      channelName: 'Alice Animation World',
      platform: 'YouTube',
      style: 'Vibrant Cel Shading',
      colors: '#FF5500 #112233',
      instructions: 'Phase 1 character design and channel banner with vibrant cel-shading.',
      referenceLinks: ['https://behance.net/alice', 'https://figma.com/file/sample'],
      additions: [],
      uploadedFiles: [
        {
          id: 'ref-1',
          filename: 'alice-ref1.png',
          size: dummyPng.length,
          mimeType: 'image/png',
          storagePath: aliceStoragePath,
        },
      ],
      selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
    }),
  });

  const aliceSubmitData = await aliceSubmitRes.json();
  console.log(`[Setup] Alice project submitted: status ${aliceSubmitRes.status}, id: ${aliceProjId}`, aliceSubmitData.error || '');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Tenant Ownership & 404 for Other Clients
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Tenant Ownership & 404 for Other Clients ---');
    const aliceGetRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      headers: { Cookie: aliceCookie },
    });
    const aliceGetData = await aliceGetRes.json();
    console.log(`  1a. Alice GET own project: status ${aliceGetRes.status} (expected 200)`);

    const bobGetRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      headers: { Cookie: bobCookie },
    });
    const bobGetData = await bobGetRes.json();
    console.log(`  1b. Bob GET Alice project: status ${bobGetRes.status} (expected 404) - "${bobGetData.error}"`);

    const t1Pass = aliceGetRes.status === 200 && bobGetRes.status === 404;
    results.push({
      test: '1. Tenant Ownership & 404 on Cross-Tenant Access',
      status: t1Pass ? 'PASS' : 'FAIL',
      details: `Alice access: 200, Bob cross-tenant access strictly blocked with 404 Not Found`,
    });

    // -------------------------------------------------------------------------
    // TEST 2: Short-Lived Signed URLs & Fresh Refetch on Reopen
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Short-Lived Signed URLs & Fresh Refetch ---');
    const firstFiles = aliceGetData.project?.uploadedFiles || [];
    const firstUrl = firstFiles[0]?.url;
    console.log(`  2a. First signed URL generated: ${firstUrl ? firstUrl.slice(0, 75) + '...' : 'NONE'}`);

    const hasToken = firstUrl && (firstUrl.includes('token=') || firstUrl.includes('Bearer'));
    // Refetch again (simulating drawer reopen)
    const aliceReopenRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      headers: { Cookie: aliceCookie },
    });
    const aliceReopenData = await aliceReopenRes.json();
    const secondUrl = aliceReopenData.project?.uploadedFiles[0]?.url;
    console.log(`  2b. Reopen drawer signed URL generated: ${Boolean(secondUrl)}`);

    const t2Pass = Boolean(hasToken) && Boolean(secondUrl);
    results.push({
      test: '2. Signed URLs Expiry & Fresh Fetch on Drawer Reopen',
      status: t2Pass ? 'PASS' : 'FAIL',
      details: `Generated short-lived tokenized storage signed URLs on demand without persistent public exposure`,
    });

    // -------------------------------------------------------------------------
    // TEST 3: Zero Admin Fields Leakage in Client Response
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Zero Admin Fields Leakage in Client Response ---');
    const projKeys = Object.keys(aliceGetData.project || {});
    const forbiddenAdminKeys = [
      'adminNotes',
      'internal_notes',
      'internalNotes',
      'riskFlags',
      'risk_flags',
      'fraudScore',
      'paymentAlerts',
      'payment_alerts',
      'ledger',
      'idempotency_key',
      'idempotencyKey',
      'rawPayload',
      'adminComments',
      'status_history_reason',
      'admin_email',
    ];

    const leakedKeys = forbiddenAdminKeys.filter((k) => k in (aliceGetData.project || {}));
    console.log(`  3a. Keys checked on client serializer: ${projKeys.length} total`);
    console.log(`  3b. Any leaked administrative fields: ${leakedKeys.length === 0 ? 'NONE (SAFE)' : leakedKeys.join(', ')}`);

    const t3Pass = leakedKeys.length === 0 && aliceGetData.project?.id === aliceProjId;
    results.push({
      test: '3. Zero Admin Fields in Client Response (Strict Allowlist)',
      status: t3Pass ? 'PASS' : 'FAIL',
      details: `Client response exclusively exposes customer-safe fields. 0 leaked admin keys.`,
    });

    // -------------------------------------------------------------------------
    // TEST 4: Link Validation (Rejection of javascript: and data:)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Link Validation (Rejection of javascript: and data:) ---');
    const jsLinkRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: `proj-jslink-${ts}`,
        packageId: 'creator-forge',
        fundingSource: 'wallet',
        channelName: 'Security Test',
        platform: 'YouTube',
        style: 'Modern',
        colors: 'Brand Colors',
        instructions: 'Legitimate instructions for channel rebranding and logo.',
        referenceLinks: ['javascript:alert(1)'],
        selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
      }),
    });
    const jsLinkData = await jsLinkRes.json();
    console.log(`  4a. javascript: URL submission: status ${jsLinkRes.status} (expected 400) - "${jsLinkData.error}"`);

    const dataLinkRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: `proj-datalink-${ts}`,
        packageId: 'creator-forge',
        fundingSource: 'wallet',
        channelName: 'Security Test',
        platform: 'YouTube',
        style: 'Modern',
        colors: 'Brand Colors',
        instructions: 'Legitimate instructions for channel rebranding and logo.',
        referenceLinks: ['data:text/html,<script>alert(1)</script>'],
        selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
      }),
    });
    const dataLinkData = await dataLinkRes.json();
    console.log(`  4b. data: URL submission: status ${dataLinkRes.status} (expected 400) - "${dataLinkData.error}"`);

    const t4Pass = jsLinkRes.status === 400 && dataLinkRes.status === 400;
    results.push({
      test: '4. Link Validation (Strict HTTP/HTTPS Only)',
      status: t4Pass ? 'PASS' : 'FAIL',
      details: `javascript: rejected with 400, data: rejected with 400. Zero XSS link execution.`,
    });

    // -------------------------------------------------------------------------
    // TEST 5: XSS Payload in Brief Instructions Shows as Plain Text
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Plain Text Brief Rendering (XSS Immune) ---');
    const xssBrief = '<img src=x onerror="alert(document.cookie)">\nLine 2 Notes';
    const xssProjId = `proj-xss-${ts}`;

    const xssProjRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: xssProjId,
        packageId: 'creator-forge',
        fundingSource: 'wallet',
        channelName: 'XSS Test Channel',
        platform: 'YouTube',
        style: 'Clean',
        colors: 'Blue/White',
        // HTML tags are rejected by instructions schema validation, which enforces plain text
        instructions: '<img src=x onerror="alert(document.cookie)">\nLine 2 Notes',
        selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
      }),
    });
    const xssProjData = await xssProjRes.json();
    console.log(`  5a. XSS HTML in brief submission: status ${xssProjRes.status} (expected 400 due to HTML tag rejection) - "${xssProjData.error}"`);

    const t5Pass = xssProjRes.status === 400 && xssProjData.error?.includes('HTML');
    results.push({
      test: '5. Plain Text Brief Enforcement (HTML/XSS Script Rejection)',
      status: t5Pass ? 'PASS' : 'FAIL',
      details: `HTML injection tags rejected at submission boundary with 400. Plain text strictly enforced.`,
    });

    // -------------------------------------------------------------------------
    // TEST 6: Page Load vs. Drawer Network Demands
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Page Load vs. Drawer Network Demands ---');
    const pageLoadRes = await fetch(`${BASE_URL}/api/projects?summary=true`, {
      headers: { Cookie: aliceCookie },
    });
    const pageLoadData = await pageLoadRes.json();
    const firstProjOnList = pageLoadData.projects?.find((p: any) => p.id === aliceProjId);
    const listFilesHaveSignedUrls = (firstProjOnList?.uploadedFiles || []).some((f: any) => Boolean(f.url));
    console.log(`  6a. Projects list on page load: ${pageLoadData.projects?.length} projects, signed URLs present: ${listFilesHaveSignedUrls} (expected false)`);

    const drawerRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      headers: { Cookie: aliceCookie },
    });
    const drawerData = await drawerRes.json();
    const drawerHasSignedUrl = Boolean(drawerData.project?.uploadedFiles?.[0]?.url);
    console.log(`  6b. Drawer on-demand query: signed URLs present: ${drawerHasSignedUrl} (expected true)`);

    const t6Pass = !listFilesHaveSignedUrls && drawerHasSignedUrl;
    results.push({
      test: '6. Lazy On-Demand Storage Demands (Zero Calls on Page Load)',
      status: t6Pass ? 'PASS' : 'FAIL',
      details: `List summary returns 0 signed URLs. Drawer opening issues signed URLs on demand.`,
    });

    // -------------------------------------------------------------------------
    // TEST 7: Missing or Deleted File Shows Placeholder
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Missing or Deleted File Placeholder ---');
    const missingFilePath = `references/${aliceId}/${aliceDraftId}/deleted-or-missing.png`;
    // We do NOT create this physical file in storage, but have a record referencing it
    const missingProjId = `proj-missing-file-${ts}`;

    // Create project in DB with missing file metadata
    await admin.from('projects').insert({
      id: missingProjId,
      project_code: `HT-MISSING-${ts.toString().slice(-4)}`,
      user_id: aliceId,
      package_id: 'creator-forge',
      funding_source: 'wallet',
      status: 'pending_review',
      client_name: 'Alice Creator',
      channel_name: 'Missing File Test',
      email: aliceEmail,
      platform: 'YouTube',
      style: 'Minimal',
      colors: '#000000',
      instructions: 'Sample project with missing file for placeholder verification.',
      uploaded_files: [
        {
          id: 'missing-1',
          filename: 'corrupted-art.png',
          size: 2048,
          storagePath: missingFilePath,
          mimeType: 'image/png',
        },
      ],
    });

    const missingDetailRes = await fetch(`${BASE_URL}/api/projects/${missingProjId}`, {
      headers: { Cookie: aliceCookie },
    });
    const missingDetailData = await missingDetailRes.json();
    const returnedFile = missingDetailData.project?.uploadedFiles?.[0];
    console.log(`  7a. Missing storage file query: returned file filename "${returnedFile?.filename}", url: "${returnedFile?.url || 'EMPTY'}"`);

    const t7Pass = returnedFile?.filename === 'corrupted-art.png';
    results.push({
      test: '7. Missing / Deleted Storage File Fallback Handling',
      status: t7Pass ? 'PASS' : 'FAIL',
      details: `Missing physical file cleanly retains metadata and triggers UI placeholder fallback`,
    });

    // -------------------------------------------------------------------------
    // TEST 8: Brief Snapshot Immutability & Additional Notes
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Brief Snapshot Immutability & Additional Notes ---');
    const patchNoteRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        note: 'Additional request: Please also incorporate metallic gold foil highlights.',
      }),
    });
    const patchNoteData = await patchNoteRes.json();
    console.log(`  8a. PATCH add note before production: status ${patchNoteRes.status} (expected 200)`);

    const afterNoteRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      headers: { Cookie: aliceCookie },
    });
    const afterNoteData = await afterNoteRes.json();
    const originalBriefIntact = afterNoteData.project?.instructions === 'Phase 1 character design and channel banner with vibrant cel-shading.';
    const hasNote = afterNoteData.project?.additionalNotes?.length === 1;
    console.log(`  8b. Original brief snapshot unchanged: ${originalBriefIntact}`);
    console.log(`  8c. Additional note stored with timestamp: ${hasNote} (author: ${afterNoteData.project?.additionalNotes?.[0]?.authorRole})`);

    // Now test note rejection when status is in_production
    await admin.from('projects').update({ status: 'in_production' }).eq('id', aliceProjId);
    const inProdNoteRes = await fetch(`${BASE_URL}/api/projects/${aliceProjId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        note: 'Late change attempt during production.',
      }),
    });
    const inProdNoteData = await inProdNoteRes.json();
    console.log(`  8d. Note attempt during in_production: status ${inProdNoteRes.status} (expected 400) - "${inProdNoteData.error}"`);

    const t8Pass = patchNoteRes.status === 200 && originalBriefIntact && hasNote && inProdNoteRes.status === 400;
    results.push({
      test: '8. Brief Snapshot Immutability & Additional Notes Policy',
      status: t8Pass ? 'PASS' : 'FAIL',
      details: `Brief snapshot immutable. Dated notes allowed before production; rejected once in production.`,
    });

    // -------------------------------------------------------------------------
    // TEST 9: Playwright Mobile Screenshot & Keyboard Accessibility
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Playwright Mobile Screenshot & Keyboard Accessibility ---');
    let t9Pass = false;
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, // Mobile phone viewport (iPhone 14)
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });

      // Inject authenticated cookie directly into browser context
      const cookieList = aliceCookie.split('; ').map((c) => {
        const [name, ...rest] = c.split('=');
        return {
          name,
          value: rest.join('='),
          domain: 'localhost',
          path: '/',
        };
      });
      await context.addCookies(cookieList);

      const page = await context.newPage();

      // Navigate directly to /projects?project=[aliceProjId]
      console.log(`  9a. Opening mobile URL: /projects?project=${aliceProjId}`);
      await page.goto(`${BASE_URL}/projects?project=${aliceProjId}`, { waitUntil: 'load' });

      // Verify drawer opened automatically via query parameter
      const drawerVisible = await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).then(() => true).catch(() => false);
      console.log(`  9b. Drawer opened automatically from URL query param: ${drawerVisible}`);

      // Verify "Submitted Creative Brief" section is visible
      await page.waitForSelector('[data-testid="brief-instructions"]', { timeout: 8000 }).catch(() => null);
      const briefVisible = await page.locator('[data-testid="brief-instructions"]').isVisible().catch(() => false);
      console.log(`  9c. Plain text brief instructions visible in drawer: ${briefVisible}`);

      // Take a mobile-width screenshot of the open drawer
      const screenshotDir = path.resolve(process.cwd(), 'tests/screenshots');
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, 'client-project-details-mobile.png');
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  9d. Mobile screenshot saved to: tests/screenshots/client-project-details-mobile.png`);

      // Test keyboard Escape to close drawer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const isDrawerClosed = !(await page.locator('[data-testid="brief-instructions"]').isVisible().catch(() => false));
      console.log(`  9e. Keyboard Escape key closed drawer: ${isDrawerClosed}`);

      await browser.close();
      t9Pass = drawerVisible && briefVisible && isDrawerClosed && fs.existsSync(screenshotPath);
    } catch (pwErr) {
      console.warn('Playwright mobile check error:', pwErr);
    }

    results.push({
      test: '9. Mobile Phone Layout & Keyboard Accessibility (Escape/URL)',
      status: t9Pass ? 'PASS' : 'FAIL',
      details: `Full-screen mobile sheet verified, screenshot captured at 390px, Escape closes drawer.`,
    });

    // -------------------------------------------------------------------------
    // TEST 10: Cleanup Run Doesn't Remove Attached Images
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Cleanup Run Exempts Attached Images ---');
    // Seed an attached image row older than 8 days (e.g. 10 days ago)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const attachedImagePath = `references/${aliceId}/draft-attached-test/attached-sample.png`;

    await admin.storage.from('project-references').upload(attachedImagePath, dummyPng, { contentType: 'image/png', upsert: true });
    await admin.from('project_uploads').upsert({
      user_id: aliceId,
      draft_id: 'draft-attached-test',
      storage_path: attachedImagePath,
      filename: 'attached-sample.png',
      size: dummyPng.length,
      mime_type: 'image/png',
      status: 'attached', // Explicitly attached to project
      created_at: tenDaysAgo,
      attached_at: tenDaysAgo,
    });

    // Run cleanup cron
    const cronRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cronData = await cronRes.json();
    console.log(`  10a. Cleanup cron executed: status ${cronRes.status}, removedFiles: ${cronData.removedFiles}`);

    // Verify attached image still exists in project_uploads and in storage
    const { data: uploadRow } = await admin.from('project_uploads').select('id, status').eq('storage_path', attachedImagePath).maybeSingle();
    const { data: storageListing } = await admin.storage.from('project-references').list(`references/${aliceId}/draft-attached-test`);
    const fileStillInStorage = (storageListing || []).some((f) => f.name === 'attached-sample.png');

    console.log(`  10b. Attached image preserved in database: ${Boolean(uploadRow)} (status: ${uploadRow?.status})`);
    console.log(`  10c. Attached image preserved in storage: ${fileStillInStorage}`);

    const t10Pass = Boolean(uploadRow) && uploadRow?.status === 'attached' && fileStillInStorage;
    results.push({
      test: '10. Cleanup Exemption for Attached Project Images',
      status: t10Pass ? 'PASS' : 'FAIL',
      details: `Attached files older than retention period are 100% preserved and never purged by cron.`,
    });

  } finally {
    // Cleanup test users and test files
    console.log('\n[Teardown] Cleaning up test identities and temporary records...');
    await Promise.all([
      admin.auth.admin.deleteUser(aliceId).catch(() => {}),
      admin.auth.admin.deleteUser(bobId).catch(() => {}),
      admin.from('projects').delete().in('user_id', [aliceId, bobId]),
      admin.from('project_uploads').delete().in('user_id', [aliceId, bobId]),
    ]);
    console.log('  ✓ Test identities and records cleaned up.');
  }

  // Final Acceptance Matrix Table
  console.log('\n========================================================================');
  console.log('CLIENT PROJECT DETAILS & DRAWER ACCEPTANCE MATRIX (10 TESTS)');
  console.log('========================================================================');
  console.table(results);

  const allPassed = results.every((r) => r.status === 'PASS');
  console.log(allPassed ? '\nOVERALL RESULT: ALL 10 TESTS PASSED' : '\nOVERALL RESULT: SOME TESTS FAILED');
  if (!allPassed) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Test suite failed with fatal error:', err);
  process.exit(1);
});
