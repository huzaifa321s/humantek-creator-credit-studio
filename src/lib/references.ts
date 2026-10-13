import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UploadedFile } from '@/types';
import { REFERENCE_LIMITS } from '@/lib/validation';

/**
 * Step 4 reference images live in the private `project-references` bucket at:
 *   references/<userId>/<draftId>/<uuid>-<filename>
 *
 * Each upload is registered in `public.project_uploads` as 'pending'.
 * When the order/project is created, files are verified and flipped to 'attached'.
 * Abandoned drafts (>8 days pending) are cleaned up by the nightly cron job.
 */

const SIGNED_VIEW_TTL_SECONDS = 60 * 60; // 1 hour

export const referenceFolder = (userId: string, draftId: string) => `references/${userId}/${draftId}`;

export function isUserReferencePathFor(userId: string, draftId: string, storagePath: unknown): storagePath is string {
  if (typeof storagePath !== 'string') return false;
  const prefix = `${referenceFolder(userId, draftId)}/`;
  const rest = storagePath.slice(prefix.length);
  return storagePath.startsWith(prefix) && rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}

/** Legacy path check for backward compatibility with existing tests/records. */
export function isReferencePathFor(projectId: string, storagePath: unknown): storagePath is string {
  if (typeof storagePath !== 'string') return false;
  // Match either references/<userId>/<projectId>/... OR legacy references/<projectId>/...
  const parts = storagePath.split('/');
  if (parts.length === 4 && parts[0] === 'references' && parts[2] === projectId && !storagePath.includes('..')) {
    return true;
  }
  const prefix = `references/${projectId}/`;
  const rest = storagePath.slice(prefix.length);
  return storagePath.startsWith(prefix) && rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}

/** Strips path separators and unsafe characters from a client filename. */
export function sanitizeReferenceFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'image';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'image';
}

export interface StoredReference {
  id?: string;
  storagePath: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string | null;
  status?: 'pending' | 'attached';
}

/**
 * Lists the uploads recorded for a specific user and draft.
 * Source of truth is `project_uploads` with fallback to storage for legacy paths.
 */
export async function listUserDraftReferences(
  admin: SupabaseClient,
  userId: string,
  draftId: string
): Promise<StoredReference[]> {
  const { data, error } = await admin
    .from('project_uploads')
    .select('id, storage_path, filename, size, mime_type, created_at, status')
    .eq('user_id', userId)
    .eq('draft_id', draftId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Could not list project_uploads:', error.message);
    // Fallback to storage bucket list for resilient operation
    return listStoredReferences(admin, draftId, userId);
  }

  return (data || []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    filename: row.filename,
    size: Number(row.size) || 0,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    status: row.status as 'pending' | 'attached',
  }));
}

/** Lists stored objects directly from the storage bucket. */
export async function listStoredReferences(
  admin: SupabaseClient,
  projectId: string,
  userId?: string
): Promise<StoredReference[]> {
  const folder = userId ? referenceFolder(userId, projectId) : `references/${projectId}`;
  const { data, error } = await admin.storage
    .from(REFERENCE_LIMITS.bucket)
    .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });

  if (error) {
    // If user folder doesn't exist, try legacy folder
    if (userId) {
      const fallback = await admin.storage
        .from(REFERENCE_LIMITS.bucket)
        .list(`references/${projectId}`, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
      if (!fallback.error && fallback.data) {
        return (fallback.data || [])
          .filter((obj) => obj.id)
          .map((obj) => ({
            storagePath: `references/${projectId}/${obj.name}`,
            filename: obj.name.replace(/^[0-9a-f-]{36}-/i, ''),
            size: Number((obj.metadata as { size?: number })?.size) || 0,
            mimeType: (obj.metadata as { mimetype?: string })?.mimetype || 'application/octet-stream',
            createdAt: obj.created_at || null,
          }));
      }
    }
    return [];
  }

  return (data || [])
    .filter((obj) => obj.id)
    .map((obj) => {
      const meta = (obj.metadata || {}) as { size?: number; mimetype?: string };
      return {
        storagePath: `${folder}/${obj.name}`,
        filename: obj.name.replace(/^[0-9a-f-]{36}-/i, ''),
        size: Number(meta.size) || 0,
        mimeType: meta.mimetype || 'application/octet-stream',
        createdAt: obj.created_at || null,
      };
    });
}

/**
 * Attaches draft reference files to a submitted project.
 * STRICT: If a claimed file does not exist in `project_uploads` or storage,
 * it throws an error to fail submission clearly and prevent project creation.
 */
export async function attachProjectReferences(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
  claimed: Array<Partial<UploadedFile>> | undefined
): Promise<UploadedFile[]> {
  const wanted = (claimed || []).filter((f) => Boolean(f.storagePath));
  if (wanted.length === 0) return [];

  if (wanted.length > REFERENCE_LIMITS.maxFiles) {
    throw new Error(`Exceeded maximum limit of ${REFERENCE_LIMITS.maxFiles} reference files.`);
  }

  // 1. Fetch user's recorded uploads for this draft
  const { data: dbRecords, error: dbErr } = await admin
    .from('project_uploads')
    .select('*')
    .eq('user_id', userId)
    .eq('draft_id', projectId);

  const dbMap = new Map((dbRecords || []).map((r) => [r.storage_path, r]));

  // Also query bucket to ensure files physically exist
  const storedList = await listStoredReferences(admin, projectId, userId);
  const storedMap = new Map(storedList.map((s) => [s.storagePath, s]));

  const result: UploadedFile[] = [];
  const uploadIdsToAttach: string[] = [];
  let totalBytes = 0;

  for (const file of wanted) {
    const p = String(file.storagePath || '');
    const dbRec = dbMap.get(p);
    const inBucket = storedMap.has(p);

    // Fail clearly if file is missing, expired, or belongs to another tenant
    if (!dbRec && !inBucket) {
      throw new Error(`Reference file "${file.filename || p}" could not be found or has expired. Please re-upload before submitting.`);
    }

    const size = dbRec ? Number(dbRec.size) : storedMap.get(p)?.size || 0;
    const mime = dbRec ? dbRec.mime_type : storedMap.get(p)?.mimeType || 'image/png';
    const filename = dbRec?.filename || file.filename || 'image';

    if (!(REFERENCE_LIMITS.allowedTypes as readonly string[]).includes(mime)) {
      throw new Error(`File "${filename}" has an invalid type (${mime}). Only PNG, JPG, or WebP are allowed.`);
    }

    totalBytes += size;
    if (totalBytes > REFERENCE_LIMITS.maxTotalBytes) {
      throw new Error(`Reference files exceed total project limit of 50 MB.`);
    }

    if (dbRec) {
      uploadIdsToAttach.push(dbRec.id);
    }

    result.push({
      id: file.id || dbRec?.id || p,
      filename,
      size,
      mimeType: mime,
      storagePath: p,
      url: '',
    });
  }

  // 2. Mark uploads as attached to this project
  if (uploadIdsToAttach.length > 0) {
    await admin
      .from('project_uploads')
      .update({
        status: 'attached',
        project_id: projectId,
        attached_at: new Date().toISOString(),
      })
      .in('id', uploadIdsToAttach);
  }

  return result;
}

/** Legacy verification wrapper for backwards compatibility */
export async function verifyReferenceFiles(
  admin: SupabaseClient,
  projectId: string,
  claimed: Array<Partial<UploadedFile>> | undefined,
  userId?: string
): Promise<UploadedFile[]> {
  if (userId) {
    return attachProjectReferences(admin, userId, projectId, claimed);
  }
  const wanted = (claimed || []).filter((f) => isReferencePathFor(projectId, f.storagePath));
  if (wanted.length === 0) return [];

  const stored = new Map((await listStoredReferences(admin, projectId)).map((s) => [s.storagePath, s]));
  const result: UploadedFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const file of wanted) {
    const obj = stored.get(file.storagePath as string);
    if (!obj || seen.has(obj.storagePath)) continue;
    if (!(REFERENCE_LIMITS.allowedTypes as readonly string[]).includes(obj.mimeType)) continue;
    if (result.length >= REFERENCE_LIMITS.maxFiles) break;
    if (totalBytes + obj.size > REFERENCE_LIMITS.maxTotalBytes) break;

    seen.add(obj.storagePath);
    totalBytes += obj.size;
    result.push({
      id: typeof file.id === 'string' && file.id ? file.id.slice(0, 100) : obj.storagePath,
      filename: (file.filename || obj.filename).slice(0, 255),
      size: obj.size,
      mimeType: obj.mimeType,
      storagePath: obj.storagePath,
      url: '',
    });
  }

  return result;
}

/** Adds short-lived signed view URLs. Legacy records without a storagePath are returned unchanged. */
export async function signReferenceFiles(
  admin: SupabaseClient,
  files: UploadedFile[] | undefined,
  ttlSeconds: number = SIGNED_VIEW_TTL_SECONDS
): Promise<UploadedFile[]> {
  const list = Array.isArray(files) ? files : [];
  const paths = list.map((f) => f.storagePath).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return list;

  const { data, error } = await admin.storage
    .from(REFERENCE_LIMITS.bucket)
    .createSignedUrls(paths, ttlSeconds);

  if (error || !data) {
    console.error('Could not sign reference images:', error);
    return list.map((f) => (f.storagePath ? { ...f, url: '' } : f));
  }

  const urls = new Map(data.map((d) => [d.path, d.signedUrl]));
  return list.map((f) => (f.storagePath ? { ...f, url: urls.get(f.storagePath) || '' } : f));
}

/** True once a project row exists for this id — uploads are then locked (use project chat instead). */
export async function projectExists(admin: SupabaseClient, projectId: string): Promise<boolean> {
  const { data } = await admin.from('projects').select('id').eq('id', projectId).maybeSingle();
  return Boolean(data);
}
