import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';

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
  console.log('HUMANTEK STUDIO - REFERENCE ARCHITECTURE & CLEANUP SUITE (8 TESTS)');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testPass = 'SecureRefArchPass2026!';
  const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // Setup test users
  const aliceEmail = `alice.ref.${ts}@humantek.art`;
  const bobEmail = `bob.ref.${ts}@humantek.art`;
  const unverifiedEmail = `unverified.ref.${ts}@humantek.art`;

  console.log('[Setup] Creating test users:');
  const [resAlice, resBob, resUnverified] = await Promise.all([
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
    admin.auth.admin.createUser({
      email: unverifiedEmail,
      password: testPass,
      email_confirm: true,
      user_metadata: { full_name: 'Unverified Guest', mock_unconfirmed: true },
    }),
  ]);

  if (!resAlice.data.user || !resBob.data.user || !resUnverified.data.user) {
    throw new Error('Failed to create test users');
  }

  const aliceId = resAlice.data.user.id;
  const bobId = resBob.data.user.id;
  const unverifiedId = resUnverified.data.user.id;

  await admin.from('profiles').upsert([
    { id: aliceId, email: aliceEmail, full_name: 'Alice Creator', role: 'client' },
    { id: bobId, email: bobEmail, full_name: 'Bob Creator', role: 'client' },
    { id: unverifiedId, email: unverifiedEmail, full_name: 'Unverified Guest', role: 'client' },
  ]);

  await admin.from('wallets').upsert([
    { user_id: aliceId, balance_purchased: 1000, balance_promo: 0 },
    { user_id: bobId, balance_purchased: 1000, balance_promo: 0 },
  ]);

  const aliceCookie = await loginAndGetCookie(aliceEmail, testPass);
  const bobCookie = await loginAndGetCookie(bobEmail, testPass);
  const unverifiedCookie = await loginAndGetCookie(unverifiedEmail, testPass);

  console.log(`  ✓ Alice: ${aliceEmail} (${aliceId})`);
  console.log(`  ✓ Bob:   ${bobEmail} (${bobId})`);
  console.log(`  ✓ Unverified: ${unverifiedEmail} (${unverifiedId})`);

  // Ensure storage bucket
  await admin.storage.createBucket('project-references', {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  }).catch(() => {});

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Guest and Unverified User Rejection + Server Limits
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Guest and Unverified User Rejection + Limits ---');

    // 1a. Guest (no cookie) upload attempt
    const guestRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: `proj-draft-${ts}`,
        filename: 'test.png',
        size: 1024,
        mimeType: 'image/png',
      }),
    });
    const guestData = await guestRes.json();
    console.log(`  1a. Guest upload attempt: status ${guestRes.status} (expected 401) - "${guestData.error}"`);

    // 1b. Unverified user upload attempt
    const unverifiedRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: unverifiedCookie },
      body: JSON.stringify({
        projectId: `proj-draft-${ts}`,
        filename: 'test.png',
        size: 1024,
        mimeType: 'image/png',
      }),
    });
    const unverifiedData = await unverifiedRes.json();
    console.log(`  1b. Unverified user upload attempt: status ${unverifiedRes.status} (expected 403) - "${unverifiedData.error}"`);

    // 1c. File size limit (>10MB rejected)
    const oversizeRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: `proj-draft-${ts}`,
        filename: 'oversize.png',
        size: 15 * 1024 * 1024, // 15MB
        mimeType: 'image/png',
      }),
    });
    const oversizeData = await oversizeRes.json();
    console.log(`  1c. Oversize file (15MB): status ${oversizeRes.status} (expected 400) - "${oversizeData.error}"`);

    // 1d. Prohibited MIME type: SVG rejected
    const svgRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: `proj-draft-${ts}`,
        filename: 'vector.svg',
        size: 2048,
        mimeType: 'image/svg+xml',
      }),
    });
    const svgData = await svgRes.json();
    console.log(`  1d. SVG file rejection: status ${svgRes.status} (expected 400) - "${svgData.error}"`);

    const t1Pass = guestRes.status === 401 && unverifiedRes.status === 403 && oversizeRes.status === 400 && svgRes.status === 400;
    results.push({
      test: '1. Guest & Unverified Rejection + Server Limits',
      status: t1Pass ? 'PASS' : 'FAIL',
      details: `Guest: ${guestRes.status} (401), Unverified: ${unverifiedRes.status} (403), Oversize: ${oversizeRes.status} (400), SVG: ${svgRes.status} (400)`,
    });

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Tenant Isolation (User A vs User B)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Cross-Tenant Isolation (User A vs User B) ---');
    const draftAId = `proj-draft-a-${ts}`;

    // Alice obtains a signed upload URL
    const aliceSignRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        projectId: draftAId,
        filename: 'alice-concept.png',
        size: 5000,
        mimeType: 'image/png',
      }),
    });
    const aliceSignData = await aliceSignRes.json();
    console.log(`  2a. Alice issued upload URL: status ${aliceSignRes.status}, path: ${aliceSignData.upload?.storagePath}`);

    // Alice uploads mock image bytes directly to Supabase storage with her signed URL
    const dummyPng = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
    const storageRes = await admin.storage
      .from('project-references')
      .uploadToSignedUrl(aliceSignData.upload.storagePath, aliceSignData.upload.token, dummyPng, {
        contentType: 'image/png',
      });
    console.log(`  2b. Alice uploaded file to storage: ${!storageRes.error ? 'SUCCESS' : storageRes.error.message}`);

    // Bob tries to list Alice's draft files
    const bobListRes = await fetch(`${BASE_URL}/api/uploads?projectId=${draftAId}`, {
      headers: { Cookie: bobCookie },
    });
    const bobListData = await bobListRes.json();
    const bobCanSeeAlicesFiles = (bobListData.files || []).length > 0;
    console.log(`  2c. Bob GET /api/uploads for Alice's draft: ${bobListData.files?.length || 0} files visible (expected 0)`);

    // Bob tries to delete Alice's file
    const bobDeleteRes = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({
        projectId: draftAId,
        storagePath: aliceSignData.upload.storagePath,
      }),
    });
    console.log(`  2d. Bob DELETE Alice's file: status ${bobDeleteRes.status} (expected 404/400)`);

    // Bob tries to submit a project claiming Alice's file
    const bobSubmitWithAliceFileRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({
        projectId: `proj-bob-theft-${ts}`,
        packageId: 'studio-wallet',
        fundingSource: 'wallet',
        channelName: 'Bob Channel',
        platform: 'Twitch',
        style: 'Modern',
        colors: 'Blue/Gold',
        instructions: 'Attempting to attach stolen reference file from Alice.',
        additions: [],
        uploadedFiles: [
          {
            id: 'stolen-file',
            filename: 'alice-concept.png',
            size: 5000,
            mimeType: 'image/png',
            storagePath: aliceSignData.upload.storagePath,
          },
        ],
        selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
      }),
    });
    const bobTheftData = await bobSubmitWithAliceFileRes.json();
    console.log(`  2e. Bob project submission with Alice's file: status ${bobSubmitWithAliceFileRes.status} (expected 400) - "${bobTheftData.error}"`);

    const t2Pass =
      aliceSignRes.status === 200 &&
      !bobCanSeeAlicesFiles &&
      bobDeleteRes.status === 404 &&
      bobSubmitWithAliceFileRes.status === 400;
    results.push({
      test: "2. Cross-Tenant Isolation (User A vs User B)",
      status: t2Pass ? 'PASS' : 'FAIL',
      details: `Bob cannot read (0 files), Bob delete blocked (404), Bob project submission with Alice file rejected (400)`,
    });

    // -------------------------------------------------------------------------
    // TEST 3: Cron Security (No secret, wrong secret, wrong length, GET)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Cron Route Security ---');

    // 3a. No secret header
    const noSecretRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, { method: 'POST' });
    console.log(`  3a. No secret: status ${noSecretRes.status} (expected 401)`);

    // 3b. Wrong secret
    const wrongSecretRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: 'Bearer totally_wrong_password_key' },
    });
    console.log(`  3b. Wrong secret: status ${wrongSecretRes.status} (expected 401)`);

    // 3c. Wrong length secret (must NOT throw 500 due to SHA-256 hash comparison)
    const wrongLenRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: 'Bearer short' },
    });
    console.log(`  3c. Wrong length secret: status ${wrongLenRes.status} (expected 401, NOT 500)`);

    // 3d. GET method
    const getRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, { method: 'GET' });
    console.log(`  3d. GET method: status ${getRes.status} (expected 405 Method Not Allowed)`);

    const t3Pass = noSecretRes.status === 401 && wrongSecretRes.status === 401 && wrongLenRes.status === 401 && getRes.status === 405;
    results.push({
      test: '3. Cron Route Security (Secret & HTTP Method Enforcement)',
      status: t3Pass ? 'PASS' : 'FAIL',
      details: `No secret: 401, Wrong secret: 401, Short secret: 401 (no 500), GET: 405`,
    });

    // -------------------------------------------------------------------------
    // TEST 4: Cron Seeded Data & Idempotency
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Cron Seeded Data & Idempotency ---');
    const nineDaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const twelveDaysAgo = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();

    const oldOrphanPath = `references/${aliceId}/draft-old/old-orphan.png`;
    const recentPendingPath = `references/${aliceId}/draft-recent/recent-pending.png`;
    const attachedPath = `references/${aliceId}/draft-attached/attached-keep.png`;

    // Seed physical files in storage
    await Promise.all([
      admin.storage.from('project-references').upload(oldOrphanPath, dummyPng, { contentType: 'image/png', upsert: true }),
      admin.storage.from('project-references').upload(recentPendingPath, dummyPng, { contentType: 'image/png', upsert: true }),
      admin.storage.from('project-references').upload(attachedPath, dummyPng, { contentType: 'image/png', upsert: true }),
    ]);

    // Seed rows in project_uploads
    await admin.from('project_uploads').upsert([
      {
        user_id: aliceId,
        draft_id: 'draft-old',
        storage_path: oldOrphanPath,
        filename: 'old-orphan.png',
        size: 1024,
        mime_type: 'image/png',
        status: 'pending',
        created_at: nineDaysAgo,
      },
      {
        user_id: aliceId,
        draft_id: 'draft-recent',
        storage_path: recentPendingPath,
        filename: 'recent-pending.png',
        size: 1024,
        mime_type: 'image/png',
        status: 'pending',
        created_at: oneDayAgo,
      },
      {
        user_id: aliceId,
        draft_id: 'draft-attached',
        storage_path: attachedPath,
        filename: 'attached-keep.png',
        size: 1024,
        mime_type: 'image/png',
        status: 'attached',
        created_at: twelveDaysAgo,
        attached_at: twelveDaysAgo,
      },
    ]);

    // Seed 105 mock pending rows > 8 days to test batch pagination
    const bulkRows = [];
    for (let i = 0; i < 105; i++) {
      bulkRows.push({
        user_id: aliceId,
        draft_id: `draft-bulk-${i}`,
        storage_path: `references/${aliceId}/draft-bulk/bulk-${ts}-${i}.png`,
        filename: `bulk-${i}.png`,
        size: 512,
        mime_type: 'image/png',
        status: 'pending',
        created_at: nineDaysAgo,
      });
    }
    await admin.from('project_uploads').insert(bulkRows);
    console.log('  4a. Seeded 1 old orphan, 1 recent pending, 1 attached, and 105 paginated pending records');

    // Run cron first time
    const cron1Res = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cron1Data = await cron1Res.json();
    console.log(`  4b. Cron run 1: status ${cron1Res.status}, scanned: ${cron1Data.scanned}, removed: ${cron1Data.removedFiles}`);

    // Verify old orphan was removed from DB
    const { data: checkOld } = await admin.from('project_uploads').select('id').eq('storage_path', oldOrphanPath).maybeSingle();
    // Verify recent pending was KEPT
    const { data: checkRecent } = await admin.from('project_uploads').select('id').eq('storage_path', recentPendingPath).maybeSingle();
    // Verify attached file was KEPT
    const { data: checkAttached } = await admin.from('project_uploads').select('id').eq('storage_path', attachedPath).maybeSingle();

    console.log(`  4c. Verification: old orphan deleted: ${!checkOld}, recent pending kept: ${Boolean(checkRecent)}, attached kept: ${Boolean(checkAttached)}`);

    // Run cron second time immediately (assert idempotency)
    const cron2Res = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cron2Data = await cron2Res.json();
    console.log(`  4d. Cron run 2 (idempotent): status ${cron2Res.status}, removed: ${cron2Data.removedFiles} (expected 0)`);

    const t4Pass =
      cron1Res.status === 200 &&
      cron1Data.removedFiles >= 106 &&
      !checkOld &&
      Boolean(checkRecent) &&
      Boolean(checkAttached) &&
      cron2Data.removedFiles === 0;

    results.push({
      test: '4. Cron Seeded Data & Idempotency (>100 Paginated Batch)',
      status: t4Pass ? 'PASS' : 'FAIL',
      details: `Run 1 removed ${cron1Data.removedFiles} orphans, kept recent & attached. Run 2 removed 0 files (idempotent).`,
    });

    // -------------------------------------------------------------------------
    // TEST 5: Draft 2-Day Retention Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Draft 2-Day Retention Verification ---');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const twoDayDraftPath = `references/${aliceId}/draft-2days/sample.png`;

    await admin.storage.from('project-references').upload(twoDayDraftPath, dummyPng, { contentType: 'image/png', upsert: true });
    await admin.from('project_uploads').upsert({
      user_id: aliceId,
      draft_id: 'draft-2days',
      storage_path: twoDayDraftPath,
      filename: 'sample.png',
      size: 2048,
      mime_type: 'image/png',
      status: 'pending',
      created_at: twoDaysAgo,
    });

    // Run cleanup
    const cronRetRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cronRetData = await cronRetRes.json();

    const { data: checkTwoDay } = await admin.from('project_uploads').select('id, storage_path').eq('storage_path', twoDayDraftPath).maybeSingle();
    console.log(`  5a. Draft from 2 days ago preserved across cleanup: ${Boolean(checkTwoDay)} (removed: ${cronRetData.removedFiles})`);

    const t5Pass = Boolean(checkTwoDay);
    results.push({
      test: '5. Draft 2-Day Retention (8-Day Window Consistency)',
      status: t5Pass ? 'PASS' : 'FAIL',
      details: `2-day-old draft record preserved untouched under the 8-day cleanup window.`,
    });

    // -------------------------------------------------------------------------
    // TEST 6: Submitting with Missing File Gives Clear Error & No Project Created
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Missing File Rejection & No Project Created ---');
    const ghostProjectId = `proj-ghost-${ts}`;
    const missingFilePayload = {
      projectId: ghostProjectId,
      packageId: 'studio-wallet',
      fundingSource: 'wallet',
      channelName: 'Ghost Test Stream',
      platform: 'Twitch',
      style: 'Modern',
      colors: 'Purple & Onyx',
      instructions: 'Submitting with a missing file to test strict fail-safe behavior.',
      additions: [],
      uploadedFiles: [
        {
          id: 'ghost-file-123',
          filename: 'missing-artwork.png',
          size: 4096,
          mimeType: 'image/png',
          storagePath: `references/${aliceId}/${ghostProjectId}/nonexistent-file.png`,
        },
      ],
      selections: [{ id: 'logo', name: 'Logo Design', level: 0, quantity: 1, credits: 32 }],
    };

    const ghostSubmitRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify(missingFilePayload),
    });
    const ghostSubmitData = await ghostSubmitRes.json();
    console.log(`  6a. Submit with missing file: status ${ghostSubmitRes.status} (expected 400) - "${ghostSubmitData.error}"`);

    // Verify NO project was created in the database
    const { data: ghostInDb } = await admin.from('projects').select('id').eq('id', ghostProjectId).maybeSingle();
    console.log(`  6b. Project record in database: ${ghostInDb ? 'FOUND (LEAK)' : 'NULL (SAFE - NO PROJECT CREATED)'}`);

    const t6Pass = ghostSubmitRes.status === 400 && ghostSubmitData.error?.includes('could not be found or has expired') && !ghostInDb;
    results.push({
      test: '6. Submitting with Missing File Rejection',
      status: t6Pass ? 'PASS' : 'FAIL',
      details: `Rejected with 400 "${ghostSubmitData.error}". Database project record: null (none created).`,
    });

    // -------------------------------------------------------------------------
    // TEST 7: Real cURL Execution (Hostinger Simulation)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Real cURL Simulation (Hostinger Scheduler) ---');
    let curlOutput = '';
    let curlSuccess = false;
    try {
      const curlCmd = `curl -s -X POST -H "Authorization: Bearer ${cronSecret}" ${BASE_URL}/api/cron/cleanup-references`;
      curlOutput = execSync(curlCmd, { encoding: 'utf-8' });
      const parsedCurl = JSON.parse(curlOutput);
      curlSuccess = parsedCurl.success === true && typeof parsedCurl.durationMs === 'number';
      console.log(`  7a. cURL output:`, parsedCurl);
    } catch (curlErr: any) {
      console.error('cURL execution error:', curlErr.message);
    }

    results.push({
      test: '7. Real cURL Run (Hostinger Schedule Simulation)',
      status: curlSuccess ? 'PASS' : 'FAIL',
      details: `curl executed with Bearer secret. Returned HTTP 200 with JSON metrics: ${curlOutput.trim()}`,
    });

    // -------------------------------------------------------------------------
    // TEST 8: Run Record in DB & Missed Run Alert
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Run Record in DB & Missed Run Alert ---');
    // Check that cron_runs has rows recorded
    const { data: runs, error: runsErr } = await admin
      .from('cron_runs')
      .select('*')
      .eq('job_name', 'cleanup_references')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`  8a. Latest cron_runs records found: ${runs?.length || 0}`);
    const latestRun = runs?.[0];
    console.log(`      Latest run status: ${latestRun?.status}, scanned: ${latestRun?.scanned}, removed: ${latestRun?.removed_files}, duration: ${latestRun?.duration_ms}ms`);

    // Simulate missed run alert: Seed an older run > 36h ago, with no recent run
    const fortyHoursAgo = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
    // Temporarily update all existing runs to be 40 hours old
    await admin.from('cron_runs').update({ created_at: fortyHoursAgo }).neq('id', '00000000-0000-0000-0000-000000000000');

    // Fire cron: should detect missed schedule (>36h)
    const alertCronRes = await fetch(`${BASE_URL}/api/cron/cleanup-references`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const alertCronData = await alertCronRes.json();
    console.log(`  8b. Cron execution after >36h hiatus: alert triggered: "${alertCronData.alert}"`);

    const t8Pass =
      (runs?.length || 0) > 0 &&
      latestRun?.status === 'success' &&
      alertCronData.alert?.includes('Missed cron schedule detected');

    results.push({
      test: '8. Run Record in DB & Missed Run Alert (>36h)',
      status: t8Pass ? 'PASS' : 'FAIL',
      details: `Execution logged in cron_runs. Hiatus >36h successfully triggered: "${alertCronData.alert}".`,
    });

  } finally {
    // Cleanup test users and test files
    console.log('\n[Cleanup] Cleaning up test identities and test storage...');
    await Promise.all([
      admin.auth.admin.deleteUser(aliceId),
      admin.auth.admin.deleteUser(bobId),
      admin.auth.admin.deleteUser(unverifiedId),
    ]);
    console.log('  ✓ Test identities cleaned up.');
  }

  // ---------------------------------------------------------------------------
  // SUMMARY MATRIX
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('FINAL REFERENCE & CLEANUP ACCEPTANCE MATRIX');
  console.log('========================================================================');
  console.table(results);

  const allPassed = results.every((r) => r.status === 'PASS');
  console.log(`\nOVERALL SUITE RESULT: ${allPassed ? 'ALL 8 TESTS PASSED' : 'TESTS FAILED'}`);
  if (!allPassed) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
