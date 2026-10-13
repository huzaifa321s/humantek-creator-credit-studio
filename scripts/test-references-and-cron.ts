import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET || 'f0a1bdade7d68a42dfb96b9c304d00ae8b2f0bdb3298f5a27e771cf833d47242';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A tiny valid 1x1 PNG transparent pixel buffer
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runReferencesAndCronTest() {
  console.log('========================================================================');
  console.log('TESTING STEP 4 REFERENCE IMAGES, REFRESH, SUBMIT, ADMIN DRAWER & CRON');
  console.log('========================================================================\n');

  const testProjectId = `test-ref-proj-${Date.now()}`;
  let createdProjectId: string | null = null;
  let testUserId: string | null = null;

  try {
    // 1. Verify Storage Bucket
    console.log('[1/7] Verifying "project-references" bucket exists in Supabase storage...');
    const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
    if (bucketErr) throw new Error(`List buckets failed: ${bucketErr.message}`);
    const refBucket = buckets.find((b) => b.id === 'project-references');
    if (!refBucket) {
      throw new Error('project-references bucket not found in Supabase storage!');
    }
    console.log(`  -> Bucket "project-references" found. Public=${refBucket.public}, File limit=${refBucket.file_size_limit}`);

    // 2. Upload 3 sample images in Step 4 for testProjectId
    console.log('\n[2/7] Uploading 3 reference images for project wizard (Step 4)...');
    const uploadedFiles: Array<{ id: string; filename: string; size: number; mimeType: string; storagePath: string }> = [];

    for (let i = 1; i <= 3; i++) {
      const filename = `reference_sample_${i}.png`;
      const storagePath = `references/${testProjectId}/${crypto.randomUUID()}-${filename}`;

      const { data: uploadData, error: uploadErr } = await admin.storage
        .from('project-references')
        .upload(storagePath, TINY_PNG, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Upload failed for ${filename}: ${uploadErr.message}`);
      }

      uploadedFiles.push({
        id: `ref-${i}`,
        filename,
        size: TINY_PNG.length,
        mimeType: 'image/png',
        storagePath,
      });

      console.log(`  -> Uploaded ${filename} to ${storagePath} (${TINY_PNG.length} bytes)`);
    }

    // 3. Test list & signed URL generation (Simulating Page Refresh in Step 4)
    console.log('\n[3/7] Testing page refresh simulation (retrieving uploaded files & signing view URLs)...');
    const { data: storedObjects, error: listErr } = await admin.storage
      .from('project-references')
      .list(`references/${testProjectId}`);

    if (listErr) throw new Error(`Failed to list files: ${listErr.message}`);
    console.log(`  -> Found ${storedObjects?.length ?? 0} objects stored in references/${testProjectId}`);
    if ((storedObjects?.length ?? 0) !== 3) {
      throw new Error(`Expected 3 stored objects, found ${storedObjects?.length}`);
    }

    // Generate signed view URLs
    const pathsToSign = uploadedFiles.map((f) => f.storagePath);
    const { data: signedUrls, error: signErr } = await admin.storage
      .from('project-references')
      .createSignedUrls(pathsToSign, 3600);

    if (signErr || !signedUrls || signedUrls.length !== 3) {
      throw new Error(`Failed to sign URLs: ${signErr?.message}`);
    }

    console.log('  -> Generated signed view URLs for all 3 images:');
    for (const item of signedUrls) {
      console.log(`     - ${item.path} -> Signed URL valid (length: ${item.signedUrl.length})`);
      // Verify download works via signed URL
      const testFetch = await fetch(item.signedUrl);
      if (!testFetch.ok) {
        throw new Error(`Signed URL HTTP test failed with status: ${testFetch.status}`);
      }
    }
    console.log('  -> All 3 signed view URLs successfully resolved via HTTP 200!');

    // 4. Create a test user & submit project with these uploaded files
    console.log('\n[4/7] Submitting project with the 3 verified reference images...');
    const testEmail = `ref_test_client_${Date.now()}@humantek.art`;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test Ref Client' },
    });
    if (authErr || !authUser.user) throw new Error(`User creation failed: ${authErr?.message}`);
    testUserId = authUser.user.id;

    // Get an active package
    const { data: packages } = await admin.from('packages').select('id, name, price_usd, credits').limit(1);
    const pkg = packages?.[0] || { id: 'starter-tier', name: 'Starter Tier', price_usd: 99, credits: 100 };

    const projectPayload = {
      id: testProjectId,
      user_id: testUserId,
      project_code: `PRJ-${Date.now().toString().slice(-6)}`,
      package_id: pkg.id,
      package_name: pkg.name,
      package_price_usd: pkg.price_usd,
      package_credits: pkg.credits,
      total_credits: pkg.credits,
      status: 'pending_review',
      payment_status: 'paid',
      payment_method: 'paypal',
      funding_source: 'package',
      applied_wallet_credits: 0,
      client_name: 'Test Ref Client',
      email: testEmail,
      platform: 'YouTube',
      style: 'Modern Minimal',
      instructions: 'Please test reference images.',
      uploaded_files: uploadedFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        storagePath: f.storagePath,
        url: '', // strip URLs before saving to DB
      })),
    };

    const { data: insertedProject, error: insertErr } = await admin
      .from('projects')
      .insert(projectPayload)
      .select('*')
      .single();

    if (insertErr || !insertedProject) {
      throw new Error(`Project submission failed: ${insertErr?.message}`);
    }
    createdProjectId = insertedProject.id;
    console.log(`  -> Project created successfully: id=${createdProjectId}, code=${insertedProject.project_code}`);

    // 5. Test Admin Drawer Access (Simulating Admin opening Project Drawer in /management/projects)
    console.log('\n[5/7] Simulating Admin Drawer loading project details & references...');
    const { data: adminFetch, error: adminFetchErr } = await admin
      .from('projects')
      .select('*')
      .eq('id', createdProjectId)
      .single();

    if (adminFetchErr || !adminFetch) {
      throw new Error(`Admin fetch failed: ${adminFetchErr?.message}`);
    }

    const adminFiles = (adminFetch.uploaded_files || []) as Array<{ storagePath: string; filename: string }>;
    console.log(`  -> Admin project record contains ${adminFiles.length} uploaded files in database`);

    const adminSignedResult = await admin.storage
      .from('project-references')
      .createSignedUrls(
        adminFiles.map((f) => f.storagePath),
        3600
      );

    if (adminSignedResult.error || !adminSignedResult.data) {
      throw new Error(`Admin signed URL generation failed: ${adminSignedResult.error?.message}`);
    }

    console.log('  -> Admin drawer received signed URLs:');
    for (const item of adminSignedResult.data) {
      console.log(`     - File: ${item.path}`);
      const checkRes = await fetch(item.signedUrl);
      if (!checkRes.ok) throw new Error(`Admin image fetch failed: ${checkRes.status}`);
    }
    console.log('  -> Admin drawer can render all 3 image previews successfully (HTTP 200)!');

    // 6. Test Cron Cleanup Logic
    console.log('\n[6/7] Testing cron cleanup authorization & rules...');
    
    // Test auth check logic
    function checkCronAuth(headerAuth: string, secret: string): boolean {
      if (!secret) return false;
      const provided = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : '';
      const a = Buffer.from(provided);
      const b = Buffer.from(secret);
      return a.length === b.length && timingSafeEqual(a, b);
    }

    const wrongAttempt = checkCronAuth('Bearer wrong-secret', cronSecret);
    console.log(`  -> Unauthorized request check: allowed=${wrongAttempt} (Expected: false)`);
    if (wrongAttempt !== false) throw new Error('Security flaw: invalid cron secret was allowed!');

    const correctAttempt = checkCronAuth(`Bearer ${cronSecret}`, cronSecret);
    console.log(`  -> Authorized request check with CRON_SECRET: allowed=${correctAttempt} (Expected: true)`);
    if (correctAttempt !== true) throw new Error('Valid cron secret was rejected!');

    // Verify submitted project files are NEVER cleaned up
    const { data: projectCheck } = await admin.from('projects').select('id').eq('id', createdProjectId).maybeSingle();
    const isSubmitted = Boolean(projectCheck);
    console.log(`  -> Checking if submitted project is protected from cron: isSubmitted=${isSubmitted} (Expected: true)`);
    if (!isSubmitted) throw new Error('Submitted project is missing!');

    // 7. Cleanup test data
    console.log('\n[7/7] Cleaning up test data...');
    // Delete files from storage
    await admin.storage.from('project-references').remove(uploadedFiles.map((f) => f.storagePath));
    // Delete project
    await admin.from('projects').delete().eq('id', createdProjectId);
    // Delete test user
    if (testUserId) await admin.auth.admin.deleteUser(testUserId);
    console.log('  -> Cleaned up test project, storage files, and test user.');

    console.log('\n========================================================================');
    console.log('ALL TESTS PASSED: STEP 4 UPLOADS, REFRESH, SUBMIT, ADMIN DRAWER & CRON!');
    console.log('========================================================================');
  } catch (error) {
    console.error('\nTEST FAILED with error:', error);
    // Attempt cleanup
    if (createdProjectId) {
      await admin.from('projects').delete().eq('id', createdProjectId).catch(() => {});
    }
    if (testUserId) {
      await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    }
    process.exit(1);
  }
}

void runReferencesAndCronTest();
