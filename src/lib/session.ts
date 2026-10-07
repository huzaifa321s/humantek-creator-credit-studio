import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionData {
  sub: string;
  email: string;
  name: string;
  role: string;
  walletBalance?: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'session';
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'humantek-studio-super-secret-session-key-2026';

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signs a session payload into a tamper-proof HMAC-SHA256 token.
 */
export async function signSession(
  payload: Omit<SessionData, 'exp'> & { exp?: number }
): Promise<string> {
  const key = await getCryptoKey();
  const exp = payload.exp || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  const data: SessionData = { ...payload, exp };
  const encodedData = base64UrlEncode(new TextEncoder().encode(JSON.stringify(data)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedData)
  );
  const encodedSignature = base64UrlEncode(signature);
  return `${encodedData}.${encodedSignature}`;
}

/**
 * Decodes and verifies the HMAC-SHA256 signature and expiration of a session token.
 */
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    if (!token || !token.includes('.')) return null;
    const [encodedData, encodedSignature] = token.split('.');
    if (!encodedData || !encodedSignature) return null;

    const key = await getCryptoKey();
    const signature = base64UrlDecode(encodedSignature);
    const dataBytes = new TextEncoder().encode(encodedData);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );
    if (!isValid) return null;

    const decodedJson = new TextDecoder().decode(base64UrlDecode(encodedData));
    const session: SessionData = JSON.parse(decodedJson);

    // Verify expiry
    if (session.exp && session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current verified session from the incoming cookies, or null if none.
 * Uses React cache() for request memoization.
 */
export const getSession = cache(async (): Promise<SessionData | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
});

/**
 * Asserts an active session in a Server Component / Layout.
 * Redirects directly to `/login` if unauthenticated.
 */
export const verifySession = cache(async (): Promise<SessionData> => {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
});
