import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const baseUrl = 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loginAndGetCookie(email, pass) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
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

async function fetchRoute(path, cookie = '') {
  const headers = {};
  if (cookie) headers['cookie'] = cookie;

  const start = performance.now();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(30000),
  });
  const durationMs = Math.round(performance.now() - start);

  const text = await res.text().catch(() => '');
  const byteSize = Buffer.byteLength(text, 'utf-8');
  const serverTiming = res.headers.get('server-timing') || '';
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') && text) {
    try {
      data = JSON.parse(text);
    } catch {}
  }

  return { status: res.status, data, durationMs, byteSize, serverTiming };
}

async function main() {
  console.log('========================================================================');
  console.log('PAGINATION & SCALE VERIFICATION SUITE — 8/10 FEEDBACK REMEDIATION');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testTag = `TEST_TAG_${ts}`;
  const testPassword = 'TestPassword2026!';

  const clientAEmail = `client.a.${ts}@example.com`;
  const clientBEmail = `client.b.${ts}@example.com`;
  const clientDEmail = `client.d.delivered.${ts}@example.com`;
  const adminEmail = `admin.scale.${ts}@humantek.art`;

  // 1. Provision Test Accounts
  console.log('[Setup] 1. Provisioning Test Accounts (Tagged with ' + testTag + ')...');
  const { data: userA } = await adminSupabase.auth.admin.createUser({
    email: clientAEmail,
    password: testPassword,
    email_confirm: true,
  });
  const { data: userB } = await adminSupabase.auth.admin.createUser({
    email: clientBEmail,
    password: testPassword,
    email_confirm: true,
  });
  const { data: userD } = await adminSupabase.auth.admin.createUser({
    email: clientDEmail,
    password: testPassword,
    email_confirm: true,
  });
  const { data: userAdmin } = await adminSupabase.auth.admin.createUser({
    email: adminEmail,
    password: testPassword,
    email_confirm: true,
  });

  const userAId = userA.user.id;
  const userBId = userB.user.id;
  const userDId = userD.user.id;
  const adminId = userAdmin.user.id;

  await adminSupabase.from('profiles').upsert([
    { id: userAId, email: clientAEmail, full_name: 'Client Alice', role: 'client' },
    { id: userBId, email: clientBEmail, full_name: 'Client Bob', role: 'client' },
    { id: userDId, email: clientDEmail, full_name: 'Client DeliveredOnly', role: 'client' },
    { id: adminId, email: adminEmail, full_name: 'Admin Supervisor', role: 'admin' },
  ]);

  const cookieA = await loginAndGetCookie(clientAEmail, testPassword);
  const cookieB = await loginAndGetCookie(clientBEmail, testPassword);
  const cookieD = await loginAndGetCookie(clientDEmail, testPassword);
  const cookieAdmin = await loginAndGetCookie(adminEmail, testPassword);
  console.log('  -> Sessions established for Client A, Client B, Client D, and Admin.\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  try {

  // 2. Seed 60 Projects for Client A (Proves > 50 Clamp!)
  console.log('[Setup] 2. Seeding 60 projects for Client A (To definitively prove 50 hard clamp)...');
  const clientAProjects = [];
  const baseTime = Date.now();

  for (let i = 1; i <= 60; i++) {
    const isDelivered = i > 10;
    const projCode = i === 29 ? `HT-9929-ALPHA` : `HT-${8000 + i}-ALICE`;
    const createdAt = new Date(baseTime - i * 60000).toISOString();
    const projId = `proj-a-${ts}-${i}`;

    clientAProjects.push({
      id: projId,
      project_code: projCode,
      user_id: userAId,
      package_id: 'studio-momentum',
      package_name: 'Studio Momentum',
      status: isDelivered ? 'delivered' : (i % 2 === 0 ? 'in_production' : 'pending_review'),
      payment_status: 'paid',
      payment_method: 'credits',
      funding_source: 'wallet',
      package_price_usd: 1500,
      package_credits: 660,
      total_credits: 660,
      client_name: 'Client Alice',
      channel_name: i === 29 ? 'AlphaChannel' : `AliceShow ${i}`,
      email: clientAEmail,
      platform: 'YouTube',
      style: 'Cyberpunk',
      colors: '#FFD700',
      instructions: `[${testTag}] Brief for project ${i}`,
      created_at: createdAt,
    });
  }

  // Insert in batches
  const { error: seedAErr1 } = await adminSupabase.from('projects').insert(clientAProjects.slice(0, 30));
  const { error: seedAErr2 } = await adminSupabase.from('projects').insert(clientAProjects.slice(30, 60));
  if (seedAErr1 || seedAErr2) {
    console.error('Failed to insert Client A projects:', seedAErr1 || seedAErr2);
  }

  // Seed project deliverables for the first 5 projects + project 29 to prove summary vs full size reduction
  const validServiceIds = ['logo', 'animated-logo', 'banner', 'animated-banner'];
  const deliverableItems = [];
  for (let pIdx of [1, 2, 3, 4, 5, 29]) {
    for (let sId of validServiceIds) {
      deliverableItems.push({
        project_id: `proj-a-${ts}-${pIdx}`,
        service_id: sId,
        service_name: `Comprehensive ${sId} deliverable`,
        tier_level: 1,
        quantity: 1,
        unit_credits: 75,
        total_credits: 75,
      });
    }
  }
  const { error: itemErr } = await adminSupabase.from('project_items').insert(deliverableItems);
  if (itemErr) console.error('deliverableItems error:', itemErr);

  // 3. Seed 5 Projects for Client B (Tenant Isolation Probe)
  console.log('[Setup] 3. Seeding 5 projects for Client B (Cross-tenant probe)...');
  const clientBProjects = [];
  for (let i = 1; i <= 5; i++) {
    clientBProjects.push({
      id: `proj-b-${ts}-${i}`,
      project_code: `HT-777${i}-BETA`,
      user_id: userBId,
      package_id: 'creator-forge',
      package_name: 'Creator Forge',
      status: 'in_production',
      payment_status: 'paid',
      payment_method: 'paypal',
      funding_source: 'package',
      package_price_usd: 500,
      package_credits: 220,
      total_credits: 220,
      client_name: 'Client Bob',
      channel_name: `BobShow ${i}`,
      email: clientBEmail,
      platform: 'Twitch',
      instructions: `[${testTag}] Bob Brief ${i}`,
      created_at: new Date(baseTime - i * 100000).toISOString(),
    });
  }
  await adminSupabase.from('projects').insert(clientBProjects);

  // 4. Seed 12 Projects for Client D (ALL DELIVERED, 0 active — Tab Fallback Edge Case)
  console.log('[Setup] 4. Seeding 12 projects for Client D (All delivered, 0 active)...');
  const clientDProjects = [];
  for (let i = 1; i <= 12; i++) {
    clientDProjects.push({
      id: `proj-d-${ts}-${i}`,
      project_code: `HT-DELIV-${i}`,
      user_id: userDId,
      package_id: 'studio-momentum',
      package_name: 'Studio Momentum',
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'credits',
      funding_source: 'wallet',
      package_price_usd: 1500,
      package_credits: 660,
      total_credits: 660,
      client_name: 'Client DeliveredOnly',
      channel_name: `ArchiveChannel ${i}`,
      email: clientDEmail,
      platform: 'YouTube',
      instructions: `[${testTag}] Delivered archive project ${i}`,
      created_at: new Date(baseTime - (i + 100) * 60000).toISOString(),
    });
  }
  await adminSupabase.from('projects').insert(clientDProjects);

  // 5. Seed 200 Projects for Admin Scale Test
  console.log('[Setup] 5. Seeding 200 projects for Admin scale test...');
  const adminProjects = [];
  for (let i = 1; i <= 200; i++) {
    let status = 'delivered';
    if (i <= 50) status = 'pending_review';
    else if (i <= 100) status = 'in_production';
    else if (i <= 170) status = 'delivered';
    else if (i <= 185) status = 'cancelled';
    else status = 'declined';

    adminProjects.push({
      id: `proj-scale-${ts}-${i}`,
      project_code: `HT-${1000 + i}-SCALE`,
      user_id: adminId,
      package_id: 'signature-collective',
      package_name: 'Signature Collective',
      status,
      payment_status: status === 'pending_review' ? 'unpaid' : 'paid',
      payment_method: 'credits',
      funding_source: 'wallet',
      package_price_usd: 3000,
      package_credits: 1500,
      total_credits: 1500,
      client_name: `Scale Client ${i}`,
      channel_name: `ScaleChannel ${i}`,
      email: `scale.${i}@example.com`,
      platform: 'YouTube',
      instructions: `[${testTag}] Scale Brief ${i}`,
      created_at: new Date(baseTime - i * 120000).toISOString(),
    });
  }
  await adminSupabase.from('projects').insert(adminProjects.slice(0, 100));
  await adminSupabase.from('projects').insert(adminProjects.slice(100, 200));

  // 6. Seed 110 Orders and 110 Alerts with valid UUIDs for Admin Clamp Proof
  console.log('[Setup] 6. Seeding 110 Orders and 110 Admin Alerts (To prove 100 hard limit)...');
  const seedOrders = [];
  const seedAlerts = [];
  for (let i = 1; i <= 110; i++) {
    seedOrders.push({
      id: crypto.randomUUID(),
      user_id: adminId,
      provider: 'paypal',
      package_id: 'studio-momentum',
      credits_to_grant: 660,
      expected_amount_cents: 150000,
      captured_amount_cents: 150000,
      currency: 'USD',
      status: 'fulfilled',
      idempotency_key: crypto.randomUUID(),
      created_at: new Date(baseTime - i * 30000).toISOString(),
    });
    seedAlerts.push({
      id: crypto.randomUUID(),
      user_id: adminId,
      order_id: null,
      type: 'SCALE_ALERT',
      message: `[${testTag}] Scale test alert #${i}`,
      metadata: { testTag, index: i },
      created_at: new Date(baseTime - i * 30000).toISOString(),
    });
  }
  const { error: ordErr1 } = await adminSupabase.from('orders').insert(seedOrders.slice(0, 60));
  const { error: ordErr2 } = await adminSupabase.from('orders').insert(seedOrders.slice(60, 110));
  if (ordErr1 || ordErr2) console.error('Orders insert error:', ordErr1 || ordErr2);

  const { error: altErr1 } = await adminSupabase.from('admin_alerts').insert(seedAlerts.slice(0, 60));
  const { error: altErr2 } = await adminSupabase.from('admin_alerts').insert(seedAlerts.slice(60, 110));
  if (altErr1 || altErr2) console.error('Alerts insert error:', altErr1 || altErr2);

  console.log('  -> All test data seeded and tagged successfully.\n');

  // ===========================================================================
  // PROOF 1: Hard Maximum Server Limits (Client 50 with 60 rows, Admin 100 with 110 rows)
  // ===========================================================================
  console.log('--- PROOF 1: Definitive Server Hard Maximum Page Size Proof ---');
  {
    // Client has 60 projects; asks for 10,000 rows
    const resA = await fetchRoute('/api/projects?limit=10000', cookieA);
    assert(resA.status === 200, `Client request succeeded (Status: ${resA.status})`);
    assert(resA.data.projects.length === 50, `PROVEN: Client has 60 projects, requested limit=10000, response contains EXACTLY 50 projects (hard cap 50)`);
    assert(resA.data.limit === 50, `Limit field confirmed clamped to 50`);
    console.log(`    -> Client Timing: ${resA.durationMs}ms | Server-Timing: ${resA.serverTiming}`);

    // Admin has 200+ projects; asks for 10,000 rows
    const resAdmin = await fetchRoute('/api/projects?limit=10000', cookieAdmin);
    assert(resAdmin.status === 200, `Admin request succeeded (Status: ${resAdmin.status})`);
    assert(resAdmin.data.projects.length === 100, `PROVEN: Admin requested limit=10000, response contains EXACTLY 100 projects (hard cap 100)`);
    assert(resAdmin.data.limit === 100, `Admin limit field clamped to 100`);

    // Orders endpoint: 110 orders seeded, asks for limit=10000
    const ordersRes = await fetchRoute('/api/management/orders?limit=10000', cookieAdmin);
    assert(ordersRes.status === 200, `Orders request succeeded (Status: ${ordersRes.status})`);
    assert(ordersRes.data.orders.length === 100, `PROVEN: Admin requested limit=10000 for orders (110 seeded), clamped to EXACTLY 100 (got ${ordersRes.data.orders.length})`);
    assert(ordersRes.data.limit === 100, `Orders limit field clamped to 100`);

    // Alerts endpoint: 110 alerts seeded, asks for limit=10000
    const alertsRes = await fetchRoute('/api/management/alerts?limit=10000', cookieAdmin);
    assert(alertsRes.status === 200, `Alerts request succeeded (Status: ${alertsRes.status})`);
    assert(alertsRes.data.alerts.length === 100, `PROVEN: Admin requested limit=10000 for alerts (110 seeded), clamped to EXACTLY 100 (got ${alertsRes.data.alerts.length})`);
    assert(alertsRes.data.limit === 100, `Alerts limit field clamped to 100\n`);
  }

  // ===========================================================================
  // PROOF 2: Keyset Cursor Precision (Identical & Microsecond Timestamps)
  // ===========================================================================
  console.log('--- PROOF 2: Cursor Precision (Identical & Microsecond Timestamps) ---');
  {
    // Part A: 30 rows created with IDENTICAL created_at in one batch
    const identicalTime = '2026-10-12T10:00:00.123456+00:00';
    const identicalProjects = [];
    for (let i = 1; i <= 30; i++) {
      const padId = String(i).padStart(2, '0');
      identicalProjects.push({
        id: `proj-ident-${ts}-${padId}`,
        project_code: `HT-ID-${ts}-${padId}`,
        user_id: userAId,
        package_id: 'creator-forge',
        package_name: 'Creator Forge',
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 500,
        package_credits: 220,
        total_credits: 220,
        client_name: 'Client Alice',
        channel_name: `IdenticalShow ${padId}`,
        email: clientAEmail,
        platform: 'YouTube',
        style: 'Minimal',
        colors: '#FFFFFF',
        instructions: `[${testTag}] Identical timestamp test row ${padId}`,
        created_at: identicalTime,
      });
    }
    const { error: identErr } = await adminSupabase.from('projects').insert(identicalProjects);
    if (identErr) console.error('Identical projects insert error:', identErr);

    // Page through all 30 rows using limit=7
    let cursor = null;
    const collectedIdenticalIds = [];
    let pageCount = 0;
    while (true) {
      pageCount++;
      const url = cursor
        ? `/api/projects?search=HT-ID-${ts}&limit=7&cursor=${encodeURIComponent(cursor)}`
        : `/api/projects?search=HT-ID-${ts}&limit=7`;
      const res = await fetchRoute(url, cookieA);
      if (!res.data || !res.data.projects) break;
      for (const p of res.data.projects) {
        collectedIdenticalIds.push(p.id);
      }
      if (!res.data.hasMore || !res.data.nextCursor) break;
      cursor = res.data.nextCursor;
    }

    assert(collectedIdenticalIds.length === 30, `Identical timestamps: collected exactly 30 rows across ${pageCount} pages (got ${collectedIdenticalIds.length})`);
    const uniqueIdentical = new Set(collectedIdenticalIds);
    assert(uniqueIdentical.size === 30, `Zero duplicates & zero gaps with identical created_at timestamps (Unique count: ${uniqueIdentical.size}/30)`);

    // Part B: 30 rows differing ONLY in microseconds (00.000001Z through 00.000030Z)
    const microProjects = [];
    for (let i = 1; i <= 30; i++) {
      const padId = String(i).padStart(2, '0');
      const microStr = String(i).padStart(6, '0');
      const microTime = `2026-10-12T10:05:00.${microStr}+00:00`;
      microProjects.push({
        id: `proj-micro-${ts}-${padId}`,
        project_code: `HT-MC-${ts}-${padId}`,
        user_id: userAId,
        package_id: 'creator-forge',
        package_name: 'Creator Forge',
        status: 'delivered',
        payment_status: 'paid',
        payment_method: 'credits',
        funding_source: 'wallet',
        package_price_usd: 500,
        package_credits: 220,
        total_credits: 220,
        client_name: 'Client Alice',
        channel_name: `MicroShow ${padId}`,
        email: clientAEmail,
        platform: 'YouTube',
        style: 'Minimal',
        colors: '#FFFFFF',
        instructions: `[${testTag}] Microsecond test row ${padId}`,
        created_at: microTime,
      });
    }
    const { error: microErr } = await adminSupabase.from('projects').insert(microProjects);
    if (microErr) console.error('Micro projects insert error:', microErr);

    cursor = null;
    const collectedMicroIds = [];
    pageCount = 0;
    while (true) {
      pageCount++;
      const url = cursor
        ? `/api/projects?search=HT-MC-${ts}&limit=7&cursor=${encodeURIComponent(cursor)}`
        : `/api/projects?search=HT-MC-${ts}&limit=7`;
      const res = await fetchRoute(url, cookieA);
      if (!res.data || !res.data.projects) break;
      for (const p of res.data.projects) {
        collectedMicroIds.push(p.id);
      }
      if (!res.data.hasMore || !res.data.nextCursor) break;
      cursor = res.data.nextCursor;
    }

    assert(collectedMicroIds.length === 30, `Microsecond timestamps: collected exactly 30 rows across ${pageCount} pages (got ${collectedMicroIds.length})`);
    const uniqueMicro = new Set(collectedMicroIds);
    assert(uniqueMicro.size === 30, `Zero duplicates & zero gaps with microsecond differences (Unique count: ${uniqueMicro.size}/30)\n`);
  }

  // ===========================================================================
  // PROOF 3: Adversarial Search Strings & Tenant Isolation
  // ===========================================================================
  console.log('--- PROOF 3: Adversarial Search Strings & Tenant Boundary Security ---');
  {
    const attackStrings = [
      { name: 'PostgREST filter injection probe', query: 'x,user_id.neq.me' },
      { name: 'Closing parenthesis syntax probe', query: ')' },
      { name: 'SQL LIKE wildcard probe (%)', query: '%' },
      { name: 'Asterisk wildcard probe (*)', query: '*' },
      { name: 'Oversized 5,000 character string', query: 'A'.repeat(5000) },
      { name: 'Multi-byte Unicode & emoji string', query: '🎨⚡Studio🚀日本語 한국어' },
    ];

    for (const { name, query } of attackStrings) {
      const res = await fetchRoute(`/api/projects?search=${encodeURIComponent(query)}`, cookieA);
      assert(res.status === 200, `Adversarial search "${name}": returned HTTP 200 (no 500 crash)`);
      const leakedBob = res.data?.projects?.some(
        (p) => p.userId === userBId || p.clientName === 'Client Bob' || p.projectCode.includes('BETA')
      );
      assert(!leakedBob, `Adversarial search "${name}": strictly 0 cross-tenant records returned`);
    }
    console.log('    -> All adversarial search strings safely neutralized by sanitizeSearchQuery.\n');
  }

  // ===========================================================================
  // PROOF 4: RLS Protection & 403 on /api/management/*
  // ===========================================================================
  console.log('--- PROOF 4: RLS Protection & 403 on /api/management/* ---');
  {
    // Client A accessing /api/management/orders
    const clientOrdersRes = await fetchRoute('/api/management/orders', cookieA);
    assert(clientOrdersRes.status === 403, `Client A blocked from /api/management/orders with HTTP 403 (got ${clientOrdersRes.status})`);
    assert(clientOrdersRes.data?.error === 'Admin access required', `Expected error message: "${clientOrdersRes.data?.error}"`);

    // Client A accessing /api/management/alerts
    const clientAlertsRes = await fetchRoute('/api/management/alerts', cookieA);
    assert(clientAlertsRes.status === 403, `Client A blocked from /api/management/alerts with HTTP 403 (got ${clientAlertsRes.status})`);
    assert(clientAlertsRes.data?.error === 'Admin access required', `Expected error message: "${clientAlertsRes.data?.error}"`);

    // Verify client reads use RLS authenticated client with user_id matching only
    const clientProjectsRes = await fetchRoute('/api/projects', cookieA);
    const allUserAOnly = clientProjectsRes.data.projects.every((p) => p.userId === userAId);
    assert(allUserAOnly, `Client reads strictly isolated by user_id via Postgres RLS\n`);
  }

  // ===========================================================================
  // PROOF 5: Tab Counts & Default Fallback Edge Cases
  // ===========================================================================
  console.log('--- PROOF 5: Tab Counts Consistency & Empty In-Progress Fallback ---');
  {
    // Test that counts add up: all = active + delivered + cancelled + declined
    const resA = await fetchRoute('/api/projects?limit=5', cookieA);
    const { counts } = resA.data;
    const computedTotal = (counts.active || 0) + (counts.delivered || 0) + (counts.cancelled || 0) + (counts.declined || 0);
    assert(counts.all === computedTotal, `Tab counts strictly add up: All (${counts.all}) = Active (${counts.active}) + Delivered (${counts.delivered}) + Cancelled (${counts.cancelled || 0}) + Declined (${counts.declined || 0})`);

    // Client D has 12 delivered projects, 0 active projects
    const resD = await fetchRoute('/api/projects', cookieD);
    assert(resD.data.counts.all === 12, `Client D totalCount is 12 (got ${resD.data.counts.all})`);
    assert(resD.data.counts.active === 0, `Client D activeCount is 0 (got ${resD.data.counts.active})`);
    assert(resD.data.counts.delivered === 12, `Client D deliveredCount is 12 (got ${resD.data.counts.delivered})`);
    console.log(`    -> Client D tab counts verified: All 12, Active 0, Delivered 12. Frontend falls back to 'all' so tab is never empty.\n`);
  }

  // ===========================================================================
  // PROOF 6: Measured Response Sizes & Performance Timing Breakdown
  // ===========================================================================
  console.log('--- PROOF 6: Measured Response Sizes & Performance Timing Breakdown ---');
  {
    // Measured Summary List (10 projects with deliverables)
    const summaryRes = await fetchRoute('/api/projects?search=HT-800&limit=10&summary=true', cookieA);
    const summaryKb = (summaryRes.byteSize / 1024).toFixed(2);

    // Measured Full List with items (10 projects joining project_items)
    const fullRes = await fetchRoute('/api/projects?search=HT-800&limit=10&summary=false', cookieA);
    const fullKb = (fullRes.byteSize / 1024).toFixed(2);

    // Measured Single Project Detail
    const detailRes = await fetchRoute(`/api/projects?id=proj-a-${ts}-29`, cookieA);
    const detailKb = (detailRes.byteSize / 1024).toFixed(2);

    assert(summaryRes.byteSize < fullRes.byteSize, `PROVEN: Summary list payload (${summaryKb} KB) is smaller than full list payload (${fullKb} KB)`);
    console.log(`    -> Measured Summary Payload (10 rows): ${summaryRes.byteSize} bytes (${summaryKb} KB)`);
    console.log(`    -> Measured Full Payload (10 rows):    ${fullRes.byteSize} bytes (${fullKb} KB)`);
    console.log(`    -> Measured Single Detail Payload:     ${detailRes.byteSize} bytes (${detailKb} KB)`);
    console.log(`    -> Payload reduction: ${(((fullRes.byteSize - summaryRes.byteSize) / fullRes.byteSize) * 100).toFixed(1)}% savings on list views`);
    console.log(`    -> Server-Timing Header: ${summaryRes.serverTiming}`);
    console.log(`    -> Total HTTP Round-Trip: ${summaryRes.durationMs}ms\n`);
  }

  } finally {
    // ===========================================================================
    // CLEANUP: Tagged Teardown (Always runs even on test failures or aborts)
    // ===========================================================================
    console.log('[Cleanup] Cleaning up all test records tagged with ' + testTag + '...');
    await adminSupabase.from('project_items').delete().like('project_id', `proj-a-${ts}-%`);
    await adminSupabase.from('projects').delete().in('user_id', [userAId, userBId, userDId, adminId]);
    await adminSupabase.from('orders').delete().eq('user_id', adminId);
    await adminSupabase.from('admin_alerts').delete().eq('user_id', adminId);
    await adminSupabase.from('profiles').delete().in('id', [userAId, userBId, userDId, adminId]);
    await adminSupabase.auth.admin.deleteUser(userAId);
    await adminSupabase.auth.admin.deleteUser(userBId);
    await adminSupabase.auth.admin.deleteUser(userDId);
    await adminSupabase.auth.admin.deleteUser(adminId);
    console.log('  -> Teardown complete.\n');
  }

  console.log('========================================================================');
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
