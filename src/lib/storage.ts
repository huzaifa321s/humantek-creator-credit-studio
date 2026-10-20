import 'server-only';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dual-Mode Storage Adapter (`company` | `supabase`).
 *
 * When `NEXT_PUBLIC_STORAGE_PROVIDER=company` (and `NEXT_PUBLIC_COMPANY_HUB_URL` +
 * `COMPANY_HUB_SECRET` are configured), all file uploads, signed view URLs,
 * directory listings, and deletions route directly to your 24/7 Company Server
 * Disk Hub (`scripts/company-server-hub.cjs`) with zero Supabase Storage or
 * Egress usage.
 *
 * Otherwise, defaults seamlessly to Supabase Storage.
 */

export type StorageProviderMode = 'company' | 'supabase';

export function getStorageProvider(): StorageProviderMode {
  const mode = (process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'supabase').trim().toLowerCase();
  const hubUrl = (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim();
  if (mode === 'company' && hubUrl) {
    return 'company';
  }
  return 'supabase';
}

function getCompanyHubBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_COMPANY_HUB_URL || '').trim().replace(/\/+$/, '');
}

function getCompanyHubSecret(): string {
  return (process.env.COMPANY_HUB_SECRET || process.env.PUSHER_SECRET || 'company-app-secret-12345').trim();
}

/**
 * Generates an HMAC-SHA256 signature for a storage operation:
 *   payload = `${action}:${bucket}:${storagePath}:${expiresAtUnixSec}`
 */
export function signCompanyStorageToken(
  action: 'put' | 'get',
  bucket: string,
  storagePath: string,
  expiresAt: number
): string {
  const secret = getCompanyHubSecret();
  const payload = `${action}:${bucket}:${storagePath}:${expiresAt}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function buildCompanySignedUrl(
  action: 'put' | 'get',
  bucket: string,
  storagePath: string,
  ttlSeconds: number
): { url: string; token: string; expiresAt: number } {
  const baseUrl = getCompanyHubBaseUrl();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signCompanyStorageToken(action, bucket, storagePath, expiresAt);
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = `${baseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}?exp=${expiresAt}&sig=${sig}`;
  return { url, token: sig, expiresAt };
}

export interface SignedUploadTarget {
  provider: StorageProviderMode;
  storagePath: string;
  token: string;
  uploadUrl?: string;
}

/**
 * Issues a signed upload target (2-hour TTL) for direct browser upload.
 */
export async function createStorageSignedUploadUrl(
  admin: SupabaseClient,
  bucket: string,
  storagePath: string,
  ttlSeconds: number = 7200
): Promise<{ data: SignedUploadTarget | null; error: Error | null }> {
  if (getStorageProvider() === 'company') {
    const { url, token } = buildCompanySignedUrl('put', bucket, storagePath, ttlSeconds);
    return {
      data: {
        provider: 'company',
        storagePath,
        token,
        uploadUrl: url,
      },
      error: null,
    };
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error || !data) {
    return { data: null, error: error || new Error('Failed to create signed upload URL') };
  }
  return {
    data: {
      provider: 'supabase',
      storagePath: data.path || storagePath,
      token: data.token,
    },
    error: null,
  };
}

/**
 * Uploads a File/Buffer from the server directly to the configured storage provider.
 */
export async function uploadStorageObject(
  admin: SupabaseClient,
  bucket: string,
  storagePath: string,
  file: File | Blob | Buffer,
  contentType: string
): Promise<{ error: Error | null }> {
  if (getStorageProvider() === 'company') {
    try {
      const { url } = buildCompanySignedUrl('put', bucket, storagePath, 600);
      const bodyBuffer =
        file instanceof Buffer
          ? new Uint8Array(file)
          : new Uint8Array(await (file as Blob).arrayBuffer());

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
          'x-hub-secret': getCompanyHubSecret(),
        },
        body: bodyBuffer,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { error: new Error(`Company hub upload failed (${res.status}): ${text}`) };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Company hub upload error') };
    }
  }

  const { error } = await admin.storage
    .from(bucket)
    .upload(storagePath, file, { contentType, upsert: false });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Creates a single short-lived signed view URL.
 */
export async function createStorageSignedViewUrl(
  admin: SupabaseClient,
  bucket: string,
  storagePath: string,
  ttlSeconds: number = 3600
): Promise<string | null> {
  if (getStorageProvider() === 'company') {
    return buildCompanySignedUrl('get', bucket, storagePath, ttlSeconds).url;
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Creates short-lived signed view URLs for multiple paths at once.
 */
export async function createStorageSignedViewUrls(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
  ttlSeconds: number = 3600
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  if (getStorageProvider() === 'company') {
    for (const p of paths) {
      if (p) {
        result.set(p, buildCompanySignedUrl('get', bucket, p, ttlSeconds).url);
      }
    }
    return result;
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, ttlSeconds);
  if (!error && data) {
    for (const item of data) {
      if (item.path && item.signedUrl) {
        result.set(item.path, item.signedUrl);
      }
    }
  }
  return result;
}

/**
 * Removes one or more objects from the configured storage provider.
 */
export async function removeStorageObjects(
  admin: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<{ error: Error | null }> {
  if (paths.length === 0) return { error: null };

  if (getStorageProvider() === 'company') {
    try {
      const baseUrl = getCompanyHubBaseUrl();
      const res = await fetch(`${baseUrl}/storage/v1/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-secret': getCompanyHubSecret(),
        },
        body: JSON.stringify({ bucket, paths }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { error: new Error(`Company hub remove failed (${res.status}): ${text}`) };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Company hub remove error') };
    }
  }

  const { error } = await admin.storage.from(bucket).remove(paths);
  return { error: error ? new Error(error.message) : null };
}

export interface ListedStorageObject {
  name: string;
  size: number;
  mimeType: string;
  createdAt: string | null;
}

/**
 * Lists files inside a folder in the configured storage provider.
 */
export async function listStorageFolder(
  admin: SupabaseClient,
  bucket: string,
  folder: string
): Promise<{ data: ListedStorageObject[] | null; error: Error | null }> {
  if (getStorageProvider() === 'company') {
    try {
      const baseUrl = getCompanyHubBaseUrl();
      const url = `${baseUrl}/storage/v1/list?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(folder)}`;
      const res = await fetch(url, {
        headers: { 'x-hub-secret': getCompanyHubSecret() },
      });
      if (!res.ok) {
        return { data: null, error: new Error(`Company hub list failed (${res.status})`) };
      }
      const json = (await res.json()) as { files?: ListedStorageObject[] };
      return { data: Array.isArray(json.files) ? json.files : [], error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Company hub list error') };
    }
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });

  if (error || !data) {
    return { data: null, error: error ? new Error(error.message) : new Error('List failed') };
  }

  return {
    data: data
      .filter((obj) => obj.id)
      .map((obj) => {
        const meta = (obj.metadata || {}) as { size?: number; mimetype?: string };
        return {
          name: obj.name,
          size: Number(meta.size) || 0,
          mimeType: meta.mimetype || 'application/octet-stream',
          createdAt: obj.created_at || null,
        };
      }),
    error: null,
  };
}
