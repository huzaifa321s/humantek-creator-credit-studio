const PROD_ALLOWED_REDIRECT_HOSTS = [
  'humantekartclient.webportfolio.live',
  'humantek.art',
  'www.humantek.art',
];

const DEV_ALLOWED_REDIRECT_HOSTS = [
  'localhost',
  '127.0.0.1',
  ...PROD_ALLOWED_REDIRECT_HOSTS,
];

/**
 * Returns the host allowlist strictly isolated by environment.
 * Production NEVER permits localhost or 127.0.0.1.
 */
export function getAllowedRedirectHosts(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? PROD_ALLOWED_REDIRECT_HOSTS : DEV_ALLOWED_REDIRECT_HOSTS;
}

/**
 * Resolves a safe redirect base origin, strictly enforcing the environment allowlist.
 * Prevents host header poisoning via untrusted x-forwarded-host or spoofed origins.
 * In production, fails closed (returns null) if no valid allowed host is resolved.
 */
export function resolveSafeRedirectBase(
  requestUrlString: string,
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
): string | null {
  const allowedHosts = getAllowedRedirectHosts();
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Validate incoming request origin against allowlist
  try {
    const requestUrl = new URL(requestUrlString);
    const isRequestHostAllowed = allowedHosts.some(
      (h) => requestUrl.hostname === h || requestUrl.hostname.endsWith(`.${h}`)
    );

    if (isRequestHostAllowed) {
      return requestUrl.origin;
    }
  } catch {}

  // 2. If request origin is untrusted (e.g. host poisoning attempt),
  // fallback to validated configured SITE_URL
  if (configuredSiteUrl) {
    try {
      const parsed = new URL(configuredSiteUrl);
      const isAllowed = allowedHosts.some(
        (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
      );
      if (isAllowed) {
        return parsed.origin;
      }
    } catch {}
  }

  // 3. Fallbacks:
  // In development, fallback to localhost:3000
  if (!isProduction) {
    return 'http://localhost:3000';
  }

  // In production, FAIL CLOSED if neither request nor configured URL is allowed
  return null;
}
