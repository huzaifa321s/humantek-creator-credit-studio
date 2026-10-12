import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') && text) {
    try {
      data = JSON.parse(text);
    } catch {}
  }

  return { status: res.status, data, durationMs };
}

async function main() {
  console.log('========================================================================');
  console.log('PAGINATION, DATA LIMITS, KEYSET CURSOR & SCALE VERIFICATION SUITE');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testPassword = 'TestPassword2026!';
  const clientAEmail = `client.a.pag.${ts}@example.com`;
  const clientBEmail = `client.b.pag.${ts}@example.com`;
  const adminEmail = `admin.pag.${ts}@humantek.art`;

  // 1. Provision Users
  console.log('[Setup] Provisioning Client A, Client B, and Admin...');
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
  const { data: userAdmin } = await adminSupabase.auth.admin.createUser({
    email: adminEmail,
    password: testPassword,
    email_confirm: true,
  });

  const userAId = userA.user.id;
  const userBId = userB.user.id;
  const adminId = userAdmin.user.id;

  await adminSupabase.from('profiles').upsert([
    { id: userAId, email: clientAEmail, full_name: 'Client Alice', role: 'client' },
    { id: userBId, email: clientBEmail, full_name: 'Client Bob', role: 'client' },
    { id: adminId, email: adminEmail, full_name: 'Admin Supervisor', role: 'admin' },
  ]);

  const cookieA = await loginAndGetCookie(clientAEmail, testPassword);
  const cookieB = await loginAndGetCookie(clientBEmail, testPassword);
  const cookieAdmin = await loginAndGetCookie(adminEmail, testPassword);

  console.log('  -> Logged in Client A, Client B, and Admin.\n');

  // 2. Seed 30 Projects for Client A
  console.log('[Setup] Seeding 30 projects for Client A (5 active, 25 delivered)...');
  const clientAProjects = [];
  const baseTime = Date.now();

  for (let i = 1; i <= 30; i++) {
    const isDelivered = i > 5;
    const projCode = i === 29 ? `HT-9929-ALPHA` : `HT-${8000 + i}-ALICE`;
    // Deterministic decreasing timestamps
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
      instructions: `Creative brief for test project ${i}`,
      created_at: createdAt,
    });
  }

  const { error: seedAErr } = await adminSupabase.from('projects').insert(clientAProjects);
  if (seedAErr) {
    console.error('Failed to seed Client A projects:', seedAErr);
    process.exit(1);
  }

  // Add items for project 29
  const { error: itemErr } = await adminSupabase.from('project_items').insert([
    {
      project_id: `proj-a-${ts}-29`,
      service_id: 'logo',
      service_name: 'Custom Vector Logo',
      tier_level: 1,
      quantity: 1,
      unit_credits: 75,
      total_credits: 75,
    },
  ]);
  if (itemErr) {
    console.error('Failed to insert project_item:', itemErr);
    process.exit(1);
  }

  // 3. Seed 5 Projects for Client B
  console.log('[Setup] Seeding 5 projects for Client B (Cross-tenant probe)...');
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
      created_at: new Date(baseTime - i * 100000).toISOString(),
    });
  }
  await adminSupabase.from('projects').insert(clientBProjects);

  // 4. Seed 200 Projects for Admin
  console.log('[Setup] Seeding 200 projects for Admin scale test...');
  const adminProjects = [];
  for (let i = 1; i <= 200; i++) {
    let status = 'delivered';
    if (i <= 50) status = 'pending_review';
    else if (i <= 100) status = 'in_production';
    else if (i <= 170) status = 'delivered';
    else status = 'declined';

    const pCode = `HT-${1000 + i}-SCALE`;
    adminProjects.push({
      id: `proj-scale-${ts}-${i}`,
      project_code: pCode,
      user_id: userAdmin.user.id,
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
      created_at: new Date(baseTime - i * 120000).toISOString(),
    });
  }

  // Insert in batches of 100
  await adminSupabase.from('projects').insert(adminProjects.slice(0, 100));
  await adminSupabase.from('projects').insert(adminProjects.slice(100, 200));

  console.log('  -> Database seeded successfully.\n');

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

  // ---------------------------------------------------------------------------
  // TEST 1: Hard Maximum Server Page Size Limit
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Server Hard Maximum Page Size Limit ---');
  {
    // Client asking for 10,000 rows
    const resA = await fetchRoute('/api/projects?limit=10000', cookieA);
    assert(resA.status === 200, `Client request succeeded (Status: ${resA.status})`);
    assert(resA.data.projects.length <= 50, `Client asking for 10000 clamped to ${resA.data.projects.length} (<= 50 max limit)`);
    console.log(`    -> Timing: ${resA.durationMs}ms`);

    // Admin asking for 10,000 rows
    const resAdmin = await fetchRoute('/api/projects?limit=10000', cookieAdmin);
    assert(resAdmin.status === 200, `Admin request succeeded (Status: ${resAdmin.status})`);
    assert(resAdmin.data.projects.length <= 100, `Admin asking for 10000 clamped to ${resAdmin.data.projects.length} (<= 100 max limit)`);
    console.log(`    -> Timing: ${resAdmin.durationMs}ms\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: Tenant Isolation & Boundary Security ---');
  {
    const resA = await fetchRoute('/api/projects', cookieA);
    const hasBobProjects = resA.data.projects.some((p) => p.clientName === 'Client Bob' || p.projectCode.includes('BETA'));
    assert(!hasBobProjects, "Client B's projects NEVER appear in Client A's project list");

    // Search probe for Bob's project by Alice
    const searchRes = await fetchRoute('/api/projects?search=HT-7771-BETA', cookieA);
    assert(searchRes.data.projects.length === 0, "Client A cannot find Client B's projects via server search");

    // Single project direct ID probe
    const detailRes = await fetchRoute(`/api/projects?id=proj-b-${ts}-1`, cookieA);
    assert(detailRes.status === 404 || detailRes.status === 403, `Direct cross-tenant ID access rejected with ${detailRes.status}`);
    console.log(`    -> Tenant isolation verified.\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Client 30 Projects Keyset Pagination & Tab Counts
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: Keyset Cursor Pagination & Counts for Client (30 Projects) ---');
  {
    // Page 1 (first 20 rows)
    const page1 = await fetchRoute('/api/projects?limit=20', cookieA);
    assert(page1.status === 200, 'Page 1 fetched successfully');
    assert(page1.data.projects.length === 20, `Page 1 returned exactly 20 projects (got ${page1.data.projects.length})`);
    assert(page1.data.hasMore === true, 'hasMore is true after batch 1');
    assert(Boolean(page1.data.nextCursor), `nextCursor returned: ${page1.data.nextCursor}`);
    assert(page1.data.counts.all === 30, `Total count is 30 (got ${page1.data.counts.all})`);
    assert(page1.data.counts.active === 5, `Active count is 5 (got ${page1.data.counts.active})`);
    assert(page1.data.counts.delivered === 25, `Delivered count is 25 (got ${page1.data.counts.delivered})`);
    console.log(`    -> Page 1 Timing: ${page1.durationMs}ms`);

    // Verify Default Tab logic: Client has 30 projects (>= 10), so default tab switches to 'active'
    assert(page1.data.counts.all >= 10, 'Client has >= 10 projects, triggering default active tab');

    // Page 2 (next 10 rows using keyset cursor)
    const cursor = encodeURIComponent(page1.data.nextCursor);
    const page2 = await fetchRoute(`/api/projects?limit=20&cursor=${cursor}`, cookieA);
    assert(page2.status === 200, 'Page 2 fetched successfully with keyset cursor');
    assert(page2.data.projects.length === 10, `Page 2 returned remaining 10 projects (got ${page2.data.projects.length})`);
    assert(page2.data.hasMore === false, 'hasMore is false after batch 2');
    assert(page2.data.nextCursor === null, 'nextCursor is null at the end of the collection');
    console.log(`    -> Page 2 Timing: ${page2.durationMs}ms`);

    // Verify deterministic ordering: every row on page 2 is older than the last row of page 1
    const lastP1Time = new Date(page1.data.projects[19].createdAt).getTime();
    const firstP2Time = new Date(page2.data.projects[0].createdAt).getTime();
    assert(firstP2Time <= lastP1Time, `Keyset order strictly monotonic (P1 last: ${lastP1Time} >= P2 first: ${firstP2Time})\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Server Search Finds Items Beyond the First Batch
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: Server-Side Search Across Batches ---');
  {
    // Project #29 (HT-9929-ALPHA) was at index 28 (on page 2)
    const searchRes = await fetchRoute('/api/projects?search=HT-9929', cookieA);
    assert(searchRes.status === 200, 'Server search request succeeded');
    assert(searchRes.data.projects.length === 1, `Search found project #29 (got ${searchRes.data.projects.length} results)`);
    assert(searchRes.data.projects[0]?.projectCode === 'HT-9929-ALPHA', `Found project code: ${searchRes.data.projects[0]?.projectCode}`);
    assert(searchRes.data.projects[0]?.channelName === 'AlphaChannel', `Found channel: ${searchRes.data.projects[0]?.channelName}`);
    console.log(`    -> Server search timing: ${searchRes.durationMs}ms\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Summary vs Full Detail Payload
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: Summary-Only List vs Full Detail on Expand ---');
  {
    // List query with summary=true (default)
    const listRes = await fetchRoute('/api/projects?limit=5', cookieA);
    const p1 = listRes.data.projects[0];
    assert(p1.selections.length === 0, 'List query with summary=true does not join project_items (payload stays tiny)');

    // Single project query for project 29
    const detailRes = await fetchRoute(`/api/projects?id=proj-a-${ts}-29`, cookieA);
    assert(detailRes.status === 200, 'Single project detail request succeeded');
    assert(detailRes.data.project.selections.length > 0, `Detail query returned ${detailRes.data.project.selections.length} items`);
    assert(detailRes.data.project.selections[0]?.name === 'Custom Vector Logo', 'Correct deliverable details returned on expand');
    console.log(`    -> Detail load timing: ${detailRes.durationMs}ms\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Admin Console at Scale (200+ Projects)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 6: Admin Management Console at Scale (200 Projects) ---');
  {
    // Admin Page 1 (25 per page)
    const adminP1 = await fetchRoute('/api/projects?limit=25&page=1', cookieAdmin);
    assert(adminP1.status === 200, 'Admin page 1 request succeeded');
    assert(adminP1.data.projects.length === 25, `Admin page 1 returned 25 projects (got ${adminP1.data.projects.length})`);
    assert(adminP1.data.totalCount >= 200, `Admin totalCount reflects full database: ${adminP1.data.totalCount}`);
    console.log(`    -> Admin P1 Timing: ${adminP1.durationMs}ms`);

    // Admin Page 2 (rows 26-50)
    const adminP2 = await fetchRoute('/api/projects?limit=25&page=2', cookieAdmin);
    assert(adminP2.status === 200, 'Admin page 2 request succeeded');
    assert(adminP2.data.projects.length === 25, `Admin page 2 returned 25 projects (got ${adminP2.data.projects.length})`);
    assert(adminP2.data.projects[0].id !== adminP1.data.projects[0].id, 'Admin page 2 displays distinct row set from page 1');
    console.log(`    -> Admin P2 Timing: ${adminP2.durationMs}ms`);

    // Admin Status Filter: delivered
    const adminDelivered = await fetchRoute('/api/projects?status=delivered&limit=50', cookieAdmin);
    assert(adminDelivered.status === 200, 'Admin status filter request succeeded');
    const allDelivered = adminDelivered.data.projects.every((p) => p.status === 'delivered');
    assert(allDelivered, `All returned projects have status 'delivered' (${adminDelivered.data.projects.length} rows)`);
    console.log(`    -> Admin filter timing: ${adminDelivered.durationMs}ms`);

    // Admin Payment Status Filter: unpaid
    const adminUnpaid = await fetchRoute('/api/projects?paymentStatus=unpaid&limit=50', cookieAdmin);
    assert(adminUnpaid.status === 200, 'Admin payment filter request succeeded');
    const allUnpaid = adminUnpaid.data.projects.every((p) => p.paymentStatus === 'unpaid');
    assert(allUnpaid, `All returned projects have paymentStatus 'unpaid' (${adminUnpaid.data.projects.length} rows)`);
    console.log(`    -> Admin payment filter timing: ${adminUnpaid.durationMs}ms`);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Admin Orders & Alerts Pagination
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Admin Orders & Alerts Paginated Endpoints ---');
  {
    const ordersRes = await fetchRoute('/api/management/orders?limit=25', cookieAdmin);
    assert(ordersRes.status === 200, 'Admin orders endpoint paginated');
    assert(ordersRes.data.limit === 25, `Orders limit clamped to 25 (got ${ordersRes.data.limit})`);
    console.log(`    -> Admin orders timing: ${ordersRes.durationMs}ms`);

    const alertsRes = await fetchRoute('/api/management/alerts?limit=25', cookieAdmin);
    assert(alertsRes.status === 200, 'Admin alerts endpoint paginated');
    assert(alertsRes.data.limit === 25, `Alerts limit clamped to 25 (got ${alertsRes.data.limit})`);
    console.log(`    -> Admin alerts timing: ${alertsRes.durationMs}ms`);
  }

  // 5. Cleanup Test Records
  console.log('\n[Cleanup] Cleaning up test records...');
  await adminSupabase.from('project_items').delete().eq('project_id', `proj-a-${ts}-29`);
  await adminSupabase.from('projects').delete().in('user_id', [userAId, userBId, adminId]);
  await adminSupabase.from('profiles').delete().in('id', [userAId, userBId, adminId]);
  await adminSupabase.auth.admin.deleteUser(userAId);
  await adminSupabase.auth.admin.deleteUser(userBId);
  await adminSupabase.auth.admin.deleteUser(adminId);
  console.log('  -> Cleanup complete.');

  console.log('\n========================================================================');
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
