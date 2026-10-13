import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSafeRedirectUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * GET /api/auth/admin-totp
 * Read-only status inspection:
 * Returns { enrolled: boolean, factorId: string | null }.
 * Strict security: Never mutates or enrolls factors in a GET request.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // Authoritative role check: profiles.role === 'admin'
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied: User is not an authorized administrator.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { data: factorsData, error: factorsErr } = await adminClient.auth.admin.mfa.listFactors({
      userId: user.id,
    });
    if (factorsErr) {
      return NextResponse.json(
        { error: factorsErr.message || 'Failed to list MFA factors' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const verifiedFactor = factorsData?.factors?.find((f) => f.status === 'verified');

    return NextResponse.json(
      {
        enrolled: Boolean(verifiedFactor),
        factorId: verifiedFactor ? verifiedFactor.id : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query MFA status';
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

/**
 * POST /api/auth/admin-totp
 * Handles both:
 * 1. action: 'enroll' -> Strictly refused if a verified factor already exists.
 * 2. action: 'verify' -> Verifies 6-digit TOTP challenge and elevates session to AAL2.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // Authoritative role check: Strictly from profiles.role in Postgres
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied: User is not an authorized administrator.' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, code, factorId: requestedFactorId, next } = body;

    // =========================================================================
    // SUB-ACTION 1: ENROLL (Controlled initial registration only)
    // =========================================================================
    if (action === 'enroll') {
      const { data: factorsData, error: listErr } = await adminClient.auth.admin.mfa.listFactors({
        userId: user.id,
      });
      if (listErr) {
        return NextResponse.json(
          { error: 'Failed to inspect existing factors' },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      const allFactors = factorsData?.factors || [];
      const existingVerified = allFactors.find((f) => f.status === 'verified');
      if (existingVerified) {
        return NextResponse.json(
          {
            error:
              'An administrator authenticator is already verified and active. Unauthorized re-enrollment is strictly refused.',
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // Clean up any abandoned unverified factors so enrollment never collides
      const unverified = allFactors.filter((f) => f.status !== 'verified');
      for (const f of unverified) {
        try {
          await adminClient.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
        } catch (delErr) {
          console.warn('Failed to delete unverified factor:', delErr);
        }
      }

      // Enroll fresh factor
      const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Creator Studio Admin',
      });

      if (enrollErr || !enrollData) {
        return NextResponse.json(
          { error: enrollErr?.message || 'Failed to initiate MFA enrollment' },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      // Return credentials with no-store. Never console.log or persist secret/QR in server logs.
      return NextResponse.json(
        {
          factorId: enrollData.id,
          qrCode: enrollData.totp.qr_code,
          secret: enrollData.totp.secret,
          uri: enrollData.totp.uri,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // =========================================================================
    // SUB-ACTION 2: VERIFY (Challenge & verify 6-digit TOTP)
    // =========================================================================
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your 6-digit authenticator code.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let targetFactorId = requestedFactorId;

    if (!targetFactorId) {
      const { data: factorsData, error: listErr } = await adminClient.auth.admin.mfa.listFactors({
        userId: user.id,
      });
      const allFactors = factorsData?.factors || [];
      if (listErr || !allFactors.length) {
        return NextResponse.json(
          { error: 'No MFA factor found. Please initiate enrollment.' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const verified = allFactors.find((f) => f.status === 'verified');
      targetFactorId = verified ? verified.id : allFactors[0].id;
    }

    const { data: verifyData, error: challengeErr } =
      await supabase.auth.mfa.challengeAndVerify({
        factorId: targetFactorId,
        code: code.trim(),
      });

    if (challengeErr) {
      return NextResponse.json(
        { error: challengeErr.message || 'Invalid verification code. Please try again.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const target = getSafeRedirectUrl(next, '/management');

    return NextResponse.json(
      {
        ok: true,
        message: 'Two-factor authentication successful.',
        redirect: target,
        aal: 'aal2',
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Two-factor verification failed';
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
