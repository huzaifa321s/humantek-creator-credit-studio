/**
 * Supabase safe configuration and credential validator.
 * Ensures builds never fail due to missing or malformed environment variables.
 */

const DEFAULT_SUPABASE_URL = 'https://mock-project.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-anon-key-placeholder';

export function getSafeSupabaseCredentials(): { url: string; key: string } {
  let url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  // Strip surrounding quotes if present from .env files
  url = url.replace(/^["']+|["']+$/g, '').trim();

  // If no protocol was provided, prepend https://
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let validUrl = DEFAULT_SUPABASE_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
        validUrl = parsed.origin;
      }
    } catch {
      validUrl = DEFAULT_SUPABASE_URL;
    }
  }

  let key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  key = key.replace(/^["']+|["']+$/g, '').trim();
  if (!key || key === 'undefined' || key === 'null') {
    key = DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url: validUrl, key };
}

export function isRealSupabaseConfigured(): boolean {
  const { url, key } = getSafeSupabaseCredentials();
  if (url === DEFAULT_SUPABASE_URL || key === DEFAULT_SUPABASE_ANON_KEY) {
    return false;
  }
  if (!url.startsWith('https://') || key.length < 20) {
    return false;
  }
  return !/mock|placeholder|your[-_]|example/i.test(`${url} ${key}`);
}
