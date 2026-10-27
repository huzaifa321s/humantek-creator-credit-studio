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
  deviceHint?: string | null;
}

const geoCache = new Map<string, { location: string; expiresAt: number }>();
const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (
    !clean ||
    clean === 'unknown' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost'
  ) {
    return true;
  }
  if (
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('172.16.') ||
    clean.startsWith('172.17.') ||
    clean.startsWith('172.18.') ||
    clean.startsWith('172.19.') ||
    clean.startsWith('172.2') ||
    clean.startsWith('172.30.') ||
    clean.startsWith('172.31.') ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
}

export function extractRequestIp(req: NextRequest | Request): string {
  const h = req.headers;
  const cfIp = h.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.replace(/^::ffff:/i, '');
  }

  const realIp = h.get('x-real-ip')?.trim() || h.get('x-client-ip')?.trim();
  if (realIp) return realIp.replace(/^::ffff:/i, '');

  return 'unknown';
}

export function extractRequestLocation(req: NextRequest | Request): string | null {
  const h = req.headers;
  const country =
    h.get('cf-ipcountry')?.trim() ||
    h.get('x-vercel-ip-country')?.trim() ||
    h.get('x-country-code')?.trim() ||
    h.get('x-geo-country')?.trim() ||
    '';
  const city =
    h.get('x-vercel-ip-city')?.trim() ||
    h.get('cf-ipcity')?.trim() ||
    h.get('x-geo-city')?.trim() ||
    '';
  if (city && country) {
    try {
      return `${decodeURIComponent(city)}, ${country}`;
    } catch {
      return `${city}, ${country}`;
    }
  }
  return country || null;
}

/**
 * Resolves city/region/country (+ ISP) for a public IP address when reverse-proxy
 * geo headers (Cloudflare / Vercel) are not present (e.g. on Hostinger Node.js).
 */
export async function resolveIpGeoLocation(
  ip: string,
  req?: NextRequest | Request
): Promise<string | null> {
  if (req) {
    const fromHeaders = extractRequestLocation(req);
    if (fromHeaders && fromHeaders.toLowerCase() !== 'unknown' && fromHeaders !== 'XX') {
      return fromHeaders;
    }
  }

  const cleanIp = (ip || '').trim().replace(/^::ffff:/i, '');
  if (!cleanIp || cleanIp === 'unknown') return null;
  if (isPrivateOrLocalIp(cleanIp)) {
    return 'Local Network (LAN / Dev)';
  }

  const cached = geoCache.get(cleanIp);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.location;
  }

  // Primary lookup: ipwho.is (HTTPS, zero API key required)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const parts = [data.city, data.region, data.country].filter(Boolean);
        const isp = data.connection?.isp || data.connection?.org || '';
        if (parts.length > 0) {
          const loc = isp ? `${parts.join(', ')} (${isp})` : parts.join(', ');
          geoCache.set(cleanIp, { location: loc, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
          return loc;
        }
      }
    }
  } catch {
    // Fall through to backup lookup
  }

  // Backup lookup: ip-api.com
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,regionName,city,isp`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const parts = [data.city, data.regionName, data.country].filter(Boolean);
        const isp = data.isp || '';
        if (parts.length > 0) {
          const loc = isp ? `${parts.join(', ')} (${isp})` : parts.join(', ');
          geoCache.set(cleanIp, { location: loc, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
          return loc;
        }
      }
    }
  } catch {
    // Ignore geo lookup network timeout
  }

  return null;
}

export function summarizeUserAgent(uaRaw?: string | null, deviceHint?: string | null): string {
  if (!uaRaw) return deviceHint ? `Unknown Browser · ${deviceHint}` : 'Unknown Device';
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

  const base = `${browser} on ${os}`;
  const cleanHint = (deviceHint || '').trim().slice(0, 80);
  return cleanHint ? `${base} · ${cleanHint}` : base;
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
    const location = await resolveIpGeoLocation(ipAddress, req);
    const rawUa = req.headers.get('user-agent') || null;
    const device = summarizeUserAgent(rawUa, params.deviceHint);
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
