import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runAvatarHardeningSuite() {
  console.log('========================================================');
  console.log('AVATAR & PROFILE SECURITY HARDENING TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  const testEmail = `avatar_audit_${Date.now()}@humantek.art`;
  const testPassword = 'SafePassword2026!';
  let userId: string | null = null;
  let googleUserId: string | null = null;

  try {
    // 1. Create a genuine auth user to establish valid foreign key
    const { data: userData, error: userCreateErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Safe Avatar Tester' },
    });

    assert('Created authenticated test user in auth.users', !userCreateErr && !!userData?.user, userCreateErr?.message);
    if (!userData?.user) return;
    userId = userData.user.id;

    // Verify baseline profile has avatar_url: null for email signups
    const { data: baseProfile, error: baseErr } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', userId)
      .single();

    assert('Trigger created baseline profile with avatar_url: null', !baseErr && baseProfile?.avatar_url === null, baseErr?.message);

    // 2. Reject non-Google avatar domain (e.g. tracking image or malicious domain)
    const { error: evilDomainErr } = await admin.from('profiles').update({
      avatar_url: 'https://attacker.com/logger.png',
    }).eq('id', userId);
    assert(
      'DB rejects non-Google avatar domain (check_safe_avatar_url)',
      evilDomainErr !== null && evilDomainErr.message.includes('check_safe_avatar_url'),
      evilDomainErr ? evilDomainErr.message : 'Update unexpectedly succeeded!'
    );

    // 3. Reject data: image URIs (XSS / payload injection)
    const { error: dataUriErr } = await admin.from('profiles').update({
      avatar_url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=',
    }).eq('id', userId);
    assert(
      'DB rejects data: URI avatars',
      dataUriErr !== null && dataUriErr.message.includes('check_safe_avatar_url'),
      dataUriErr ? dataUriErr.message : 'Data URI unexpectedly succeeded!'
    );

    // 4. Reject URLs containing control characters (\r, \n, \0)
    const { error: ctrlCharErr } = await admin.from('profiles').update({
      avatar_url: 'https://lh3.googleusercontent.com/a/photo\r\nevil',
    }).eq('id', userId);
    assert(
      'DB rejects avatar URLs containing control characters or line breaks',
      ctrlCharErr !== null && ctrlCharErr.message.includes('check_safe_avatar_url'),
      ctrlCharErr ? ctrlCharErr.message : 'Control chars unexpectedly succeeded!'
    );

    // 5. Reject URLs longer than 512 characters
    const longUrl = 'https://lh3.googleusercontent.com/a/' + 'A'.repeat(500);
    const { error: lengthErr } = await admin.from('profiles').update({
      avatar_url: longUrl,
    }).eq('id', userId);
    assert(
      'DB rejects avatar URLs exceeding 512 characters',
      lengthErr !== null && lengthErr.message.includes('check_safe_avatar_url'),
      lengthErr ? lengthErr.message : 'Oversized URL unexpectedly succeeded!'
    );

    // 6. Reject non-HTTPS URLs
    const { error: httpErr } = await admin.from('profiles').update({
      avatar_url: 'http://lh3.googleusercontent.com/a/insecure-photo',
    }).eq('id', userId);
    assert(
      'DB rejects insecure http:// avatar URLs (requires https://)',
      httpErr !== null && httpErr.message.includes('check_safe_avatar_url'),
      httpErr ? httpErr.message : 'HTTP unexpectedly succeeded!'
    );

    // 7. Accept genuine Google CDN avatar URL (lh3.googleusercontent.com / lh5.googleusercontent.com)
    const validGoogleAvatar = 'https://lh3.googleusercontent.com/a/ACg8ocL12345abcdef67890-test=s96-c';
    const { error: validAvatarErr } = await admin.from('profiles').update({
      avatar_url: validGoogleAvatar,
    }).eq('id', userId);
    assert('DB accepts valid Google CDN avatar URL', !validAvatarErr, validAvatarErr?.message);

    // 8. Verify persisted avatar in database
    const { data: retrievedProfile } = await admin
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', userId)
      .single();
    assert(
      'Profiles table correctly stored and returned the Google avatar URL',
      retrievedProfile?.avatar_url === validGoogleAvatar,
      `Expected ${validGoogleAvatar}, got ${retrievedProfile?.avatar_url}`
    );

    // 9. Test trigger extraction for Google Provider signup
    const googleEmail = `google_oauth_${Date.now()}@gmail.com`;
    const googleAvatar = 'https://lh4.googleusercontent.com/a/ACg8ocGooglePhotoId=s96-c';
    const { data: googleUser, error: googleCreateErr } = await admin.auth.admin.createUser({
      email: googleEmail,
      email_confirm: true,
      app_metadata: { provider: 'google' },
      user_metadata: {
        avatar_url: googleAvatar,
        full_name: 'Verified Google User',
        iss: 'https://accounts.google.com',
      },
    });

    assert('Created test user simulating Google OAuth', !googleCreateErr && !!googleUser?.user, googleCreateErr?.message);
    if (googleUser?.user) {
      googleUserId = googleUser.user.id;
      const { data: googleProfile } = await admin
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', googleUserId)
        .single();

      assert(
        'handle_new_user() trigger automatically extracted and stored Google avatar',
        googleProfile?.avatar_url === googleAvatar,
        `Expected ${googleAvatar}, got ${googleProfile?.avatar_url}`
      );
      assert(
        'handle_new_user() trigger stored sanitized full_name',
        googleProfile?.full_name === 'Verified Google User',
        `Expected "Verified Google User", got ${googleProfile?.full_name}`
      );
    }
  } catch (err) {
    console.error('Unexpected test suite error:', err);
  } finally {
    // Cleanup
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
    if (googleUserId) {
      await admin.auth.admin.deleteUser(googleUserId);
    }
    console.log('[CLEANUP] Deleted ephemeral audit users.');
  }

  console.log(`\n========================================================`);
  console.log(`RESULTS: ${passed}/${total} assertions passed.`);
  console.log(`========================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAvatarHardeningSuite();
