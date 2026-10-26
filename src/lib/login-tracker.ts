import 'server-only';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isRealSupabaseConfigured } from '@/lib/supabase/config';

export type LoginAuthMethod =
  | 'password'
  | 'admin_console'
  | 'google_oauth'
  | 'otp'
  | 'signup'
  | 'failed_admin_login';

export interface RecordLoginEventParams {
  userId?: string | null;
  email: string;
  role?: string | null;
  authMethod: LoginAuthMethod;
}

export function extractRequestIp(req: NextRequest | Request): string {
  const h = req.headers;
  const cfIp = h.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = h.get('x-real-ip')?.trim() || h.get('x-client-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

export function extractRequestLocation(req: NextRequest | Request): string | null {
  const h = req.headers;
  const country =
    h.get('cf-ipcountry')?.trim() ||
    h.get('x-vercel-ip-country')?.trim() ||
    h.get('x-country-code')?.trim() ||
    '';
  const city = h.get('x-vercel-ip-city')?.trim() || h.get('cf-ipcity')?.trim() || '';
  if (city && country) {
    try {
      return `${decodeURIComponent(city)}, ${country}`;
    } catch {
      return `${city}, ${country}`;
    }
  }
  return country || null;
}

export function summarizeUserAgent(uaRaw?: string | null): string {
  if (!uaRaw) return 'Unknown Device';
  const ua = uaRaw.slice(0, 300);

  let browser = 'Browser';
  if (/Edg\/(\d+)/i.test(ua)) {
    browser = `Edge ${RegExp.$1}`;
  } else if (/OPR\/(\d+)/i.test(ua)) {
    browser = `Opera ${RegExp.$1}`;
  } else if (/Chrome\/(\d+)/i.test(ua) && !/Edg\//i.test(ua)) {
    browser = `Chrome ${RegExp.$1}`;
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = `Firefox ${RegExp.$1}`;
  } else if (/Version\/(\d+(?:\.\d+)?).*Safari\//i.test(ua)) {
    browser = `Safari ${RegExp.$1}`;
  }

  let os = 'Unknown OS';
  if (/Windows NT 10\.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/iPhone/i.test(ua)) {
    os = 'iPhone (iOS)';
  } else if (/iPad/i.test(ua)) {
    os = 'iPad (iPadOS)';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  return `${browser} on ${os}`;
}

/**
 * Records a login event in the rolling 500-row `public.login_history` table
 * and updates `last_login_at`, `last_login_ip`, and `last_login_device` on `public.profiles`.
 * Zero SMTP emails are sent. Never throws.
 */
export async function recordLoginEvent(
  req: NextRequest | Request,
  params: RecordLoginEventParams
): Promise<void> {
  if (!isRealSupabaseConfigured()) return;

  try {
    const cleanEmail = (params.email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const ipAddress = extractRequestIp(req);
    const location = extractRequestLocation(req);
    const rawUa = req.headers.get('user-agent') || null;
    const device = summarizeUserAgent(rawUa);
    const nowIso = new Date().toISOString();
    const role = (params.role || 'client').trim().toLowerCase();

    const admin = createAdminClient();

    await Promise.all([
      admin.from('login_history').insert({
        user_id: params.userId || null,
        email: cleanEmail,
        role,
        auth_method: params.authMethod,
        ip_address: ipAddress,
        location,
        device,
        user_agent: rawUa ? rawUa.slice(0, 300) : null,
        created_at: nowIso,
      }),
      params.userId && params.authMethod !== 'failed_admin_login'
        ? admin
            .from('profiles')
            .update({
              last_login_at: nowIso,
              last_login_ip: ipAddress,
              last_login_device: device,
            })
            .eq('id', params.userId)
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn('[LoginTracker] Could not record login event:', err);
  }
}
