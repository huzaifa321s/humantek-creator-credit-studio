import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSafeRedirectUrl } from '@/lib/utils';
import { resolveSafeRedirectBase } from '@/lib/auth/redirects';
import { recordLoginEvent } from '@/lib/login-tracker';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const rawNext = searchParams.get('next');

  const redirectBase = resolveSafeRedirectBase(request.url);
  if (!redirectBase) {
    return NextResponse.json(
      { error: 'Untrusted or unconfigured redirect host.' },
      { status: 400 }
    );
  }
  const targetPath = getSafeRedirectUrl(rawNext, '/projects');

  // Handle OAuth Cancellation or Error at Google
  // Strictly map to static safe messages - NEVER echo error_description from query params
  if (error) {
    const isCancelled = error === 'access_denied' || error.toLowerCase().includes('cancel');
    const friendlyMessage = isCancelled
      ? 'Google sign-in was cancelled. You can sign in anytime or continue with email.'
      : 'Unable to authenticate with Google. Please try again or use email sign in.';

    const errorRedirect = targetPath.startsWith('/new-project')
      ? `${redirectBase}/new-project?error=${encodeURIComponent(friendlyMessage)}`
      : `${redirectBase}/login?error=${encodeURIComponent(friendlyMessage)}`;

    return NextResponse.redirect(errorRedirect);
  }

  // Handle Code Exchange
  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      // Query profile
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', data.user.id)
        .maybeSingle();

      // Safely sync verified Google avatar and display name into profiles table
      const isGoogle =
        data.user.app_metadata?.provider === 'google' ||
        data.user.identities?.some((i) => i.provider === 'google');

      const updatePayload: Record<string, string> = {};
      if (isGoogle) {
        const rawAvatar =
          data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture;
        let safeAvatar: string | null = null;
        if (
          typeof rawAvatar === 'string' &&
          /^https:\/\/lh[0-9]*\.googleusercontent\.com\//.test(rawAvatar) &&
          rawAvatar.length <= 512
        ) {
          safeAvatar = rawAvatar.replace(/[\r\n\t\x00-\x1F\x7F]/g, '');
        }

        const rawName =
          data.user.user_metadata?.full_name || data.user.user_metadata?.name;
        const cleanName =
          typeof rawName === 'string'
            ? rawName.replace(/[\r\n\t\x00-\x1F\x7F]/g, '').trim().slice(0, 80)
            : null;

        if (safeAvatar && safeAvatar !== profile?.avatar_url) {
          updatePayload.avatar_url = safeAvatar;
        }
        if (cleanName && (!profile?.full_name || profile.full_name === 'Creator')) {
          updatePayload.full_name = cleanName;
        }
      }

      if (!profile) {
        if (data.user.email) {
          await adminClient.from('profiles').upsert(
            {
              id: data.user.id,
              email: data.user.email.toLowerCase(),
              role: 'client',
              ...updatePayload,
            },
            { onConflict: 'id' }
          );
        }
      } else if (Object.keys(updatePayload).length > 0) {
        await adminClient.from('profiles').update(updatePayload).eq('id', data.user.id);
      }

      const userRole = profile?.role === 'admin' ? 'admin' : 'client';
      const isAdmin = userRole === 'admin';

      await recordLoginEvent(request, {
        userId: data.user.id,
        email: data.user.email || 'unknown@oauth',
        role: userRole,
        authMethod: 'google_oauth',
      });

      // If user is admin, redirect directly to management console
      if (isAdmin) {
        const isClientTarget =
          targetPath.startsWith('/projects') ||
          targetPath.startsWith('/new-project') ||
          targetPath.startsWith('/wallet');
        return NextResponse.redirect(
          `${redirectBase}${isClientTarget ? '/management' : targetPath}`
        );
      }

      // Valid client user: redirect directly to target (e.g. /new-project?step=5 or /projects)
      return NextResponse.redirect(`${redirectBase}${targetPath}`);
    }
  }

  // Auth failed or missing code
  return NextResponse.redirect(
    `${redirectBase}/login?error=${encodeURIComponent('Authentication session could not be established. Please try again.')}`
  );
}
