import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getDeveloperAlertEmail, reportStudioError } from '@/lib/error-reporter';
import { resolveIpGeoLocation } from '@/lib/login-tracker';

export const dynamic = 'force-dynamic';

/**
 * Developer / Studio Owner endpoint to inspect the rolling 500-row login history,
 * per-user last-login footprint, and security diagnostics.
 * Strictly restricted to authenticated admin accounts.
 */
export async function GET(req: NextRequest) {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  const diagnostics = {
    supabaseConfigured: Boolean(isSupabaseConfigured()),
    smtpConfigured,
    smtpHost: process.env.SMTP_HOST || null,
    developerAlertEmail: getDeveloperAlertEmail(),
    paypalMode: (
      process.env.PAYPAL_ENV ||
      process.env.NEXT_PUBLIC_PAYPAL_ENV ||
      'sandbox'
    ).toLowerCase(),
    nodeEnv: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      entries: [],
      profiles: [],
      total: 0,
      maxCap: 500,
      diagnostics,
    });
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit')) || 250;
  const limit = Math.min(Math.max(1, limitParam), 500);
  const emailFilter = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();

  try {
    const admin = createAdminClient();
    let historyQuery = admin
      .from('login_history')
      .select(
        'id, user_id, email, role, auth_method, ip_address, location, device, user_agent, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (emailFilter) {
      historyQuery = historyQuery.ilike('email', `%${emailFilter}%`);
    }

    const profilesQuery = admin
      .from('profiles')
      .select('*')
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .limit(200);

    const [historyRes, profilesRes] = await Promise.all([historyQuery, profilesQuery]);

    if (historyRes.error) {
      return NextResponse.json({ error: historyRes.error.message }, { status: 500 });
    }

    const rawEntries = historyRes.data || [];

    // Backfill missing Geo Location for up to 10 distinct public IPs in existing rows
    const missingGeoIps = Array.from(
      new Set(
        rawEntries
          .filter(
            (e) =>
              (!e.location || e.location.toLowerCase() === 'unknown') &&
              e.ip_address &&
              e.ip_address !== 'unknown'
          )
          .map((e) => e.ip_address as string)
      )
    ).slice(0, 10);

    if (missingGeoIps.length > 0) {
      const resolvedMap = new Map<string, string>();
      await Promise.all(
        missingGeoIps.map(async (ip) => {
          const geo = await resolveIpGeoLocation(ip);
          if (geo) {
            resolvedMap.set(ip, geo);
            // Persist backfilled location in Supabase asynchronously
            admin
              .from('login_history')
              .update({ location: geo })
              .eq('ip_address', ip)
              .is('location', null)
              .then(() => {});
          }
        })
      );

      for (const entry of rawEntries) {
        if ((!entry.location || entry.location.toLowerCase() === 'unknown') && entry.ip_address) {
          const resolved = resolvedMap.get(entry.ip_address);
          if (resolved) {
            entry.location = resolved;
          }
        }
      }
    }

    const mappedProfiles = (profilesRes.data || []).map((p: Record<string, unknown>) => ({
      id: String(p.id || ''),
      email: String(p.email || ''),
      name: (p.full_name as string) || (p.name as string) || null,
      role: String(p.role || 'client'),
      team_role: (p.team_role as string) || null,
      last_login_at: (p.last_login_at as string) || null,
      last_login_ip: (p.last_login_ip as string) || null,
      last_login_device: (p.last_login_device as string) || null,
      created_at: String(p.created_at || ''),
    }));

    return NextResponse.json({
      entries: rawEntries,
      profiles: mappedProfiles,
      total: historyRes.count ?? rawEntries.length,
      maxCap: 500,
      diagnostics,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load login history' },
      { status: 500 }
    );
  }
}

/**
 * Allows an authenticated developer/admin on /management/dev-security-vault
 * to trigger a live test error alert email to `DEVELOPER_ALERT_EMAIL`.
 */
export async function POST(req: NextRequest) {
  const user = await getRequestUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'test_error_alert') {
      const targetEmail = getDeveloperAlertEmail();
      const testError = new Error(
        `Manual diagnostic test triggered from /management/dev-security-vault at ${new Date().toISOString()}`
      );
      await reportStudioError({
        area: 'Developer Security Vault (Test Alert)',
        route: '/management/dev-security-vault',
        error: testError,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        severity: 'WARNING',
        context: {
          triggeredBy: user.email,
          testRunId: `TEST-${Date.now().toString(36).toUpperCase()}`,
          purpose: 'Verify SMTP delivery to developer alert inbox',
        },
      });

      return NextResponse.json({
        ok: true,
        targetEmail,
        message: `Test developer error email dispatched to ${targetEmail}`,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to execute action' },
      { status: 500 }
    );
  }
}
