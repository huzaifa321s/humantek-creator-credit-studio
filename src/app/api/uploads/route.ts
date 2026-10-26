import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { reportStudioError } from '@/lib/error-reporter';
import {
  REFERENCE_LIMITS,
  firstIssue,
  projectIdSchema,
  referenceUploadRequestSchema,
} from '@/lib/validation';
import {
  listUserDraftReferences,
  projectExists,
  referenceFolder,
  sanitizeReferenceFilename,
  signReferenceFiles,
} from '@/lib/references';
import { createStorageSignedUploadUrl, removeStorageObjects } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const MB = 1024 * 1024;

function storageUnavailable() {
  return NextResponse.json(
    { error: 'Reference uploads are unavailable right now. You can share images in project chat after submitting.' },
    { status: 503 }
  );
}

/**
 * POST /api/uploads: Issues a signed upload URL to an authenticated, email-verified user.
 * Records the upload in `public.project_uploads` as 'pending'.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return storageUnavailable();

  const user = await getRequestUser().catch(() => null);

  // 1. Strict Guest & Verification Gates
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in to upload reference images, or paste reference links in your brief.' },
      { status: 401 }
    );
  }

  if (!user.emailConfirmed) {
    return NextResponse.json(
      { error: 'Please verify your email address to upload reference images.' },
      { status: 403 }
    );
  }

  // 2. IP / User Rate Limiting
  const rl = checkRateLimit(`ref-sign:${user.id}`, 30, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many upload requests. Please wait a moment.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid upload request body' }, { status: 400 });
  }

  const parsed = referenceUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { projectId, filename, size, mimeType } = parsed.data;

  try {
    const admin = createAdminClient();

    // Cannot upload to an already submitted project
    if (await projectExists(admin, projectId)) {
      return NextResponse.json(
        { error: 'This project has already been submitted. Share new references in project chat.' },
        { status: 409 }
      );
    }

    // 3. User Daily & Pending Quota Checks
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [recentUploadsRes, pendingUploadsRes, draftUploadsRes] = await Promise.all([
      admin
        .from('project_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo),
      admin
        .from('project_uploads')
        .select('size')
        .eq('user_id', user.id)
        .eq('status', 'pending'),
      admin
        .from('project_uploads')
        .select('size')
        .eq('user_id', user.id)
        .eq('draft_id', projectId),
    ]);

    const dailyCount = recentUploadsRes.count ?? 0;
    if (dailyCount >= REFERENCE_LIMITS.maxDailyUploadsPerUser) {
      return NextResponse.json(
        { error: `Daily upload limit reached (${REFERENCE_LIMITS.maxDailyUploadsPerUser} images per 24 hours).` },
        { status: 429 }
      );
    }

    const pendingBytes = (pendingUploadsRes.data || []).reduce((acc, row) => acc + (Number(row.size) || 0), 0);
    if (pendingBytes + size > REFERENCE_LIMITS.maxUserPendingBytes) {
      return NextResponse.json(
        { error: `Pending upload quota exceeded (${REFERENCE_LIMITS.maxUserPendingBytes / MB} MB max across unfinished drafts).` },
        { status: 400 }
      );
    }

    // 4. Per-Draft Limits (max 10 files, max 50 MB)
    const draftFiles = draftUploadsRes.data || [];
    if (draftFiles.length >= REFERENCE_LIMITS.maxFiles) {
      return NextResponse.json(
        { error: `You can attach up to ${REFERENCE_LIMITS.maxFiles} reference images per project.` },
        { status: 400 }
      );
    }

    const draftBytes = draftFiles.reduce((acc, row) => acc + (Number(row.size) || 0), 0);
    if (draftBytes + size > REFERENCE_LIMITS.maxTotalBytes) {
      return NextResponse.json(
        { error: `Reference images can total up to ${REFERENCE_LIMITS.maxTotalBytes / MB} MB per project.` },
        { status: 400 }
      );
    }

    // 5. Generate Namespaced Path: references/<userId>/<projectId>/<uuid>-<filename>
    const safeName = sanitizeReferenceFilename(filename);
    const fileUuid = crypto.randomUUID();
    const storagePath = `${referenceFolder(user.id, projectId)}/${fileUuid}-${safeName}`;

    // 6. Record Pending Upload in Database
    const { data: uploadRow, error: dbErr } = await admin
      .from('project_uploads')
      .insert({
        user_id: user.id,
        draft_id: projectId,
        storage_path: storagePath,
        filename: safeName,
        size,
        mime_type: mimeType,
        status: 'pending',
      })
      .select('id')
      .single();

    if (dbErr || !uploadRow) {
      console.error('Failed to insert project_upload record:', dbErr);
      await reportStudioError({
        area: 'Reference Upload DB Record Failed',
        route: 'POST /api/uploads',
        severity: 'ERROR',
        error: dbErr || 'Missing uploadRow',
        user,
        context: { projectId, filename: safeName, size, mimeType },
      });
      return NextResponse.json({ error: 'Could not initialize upload record.' }, { status: 500 });
    }

    // 7. Issue Signed Upload URL (Company Hub or Supabase Storage)
    const { data: uploadData, error: storageErr } = await createStorageSignedUploadUrl(
      admin,
      REFERENCE_LIMITS.bucket,
      storagePath
    );

    if (storageErr || !uploadData) {
      // Rollback DB record if signed upload URL creation failed
      await admin.from('project_uploads').delete().eq('id', uploadRow.id);
      console.error('createStorageSignedUploadUrl failed:', storageErr);
      await reportStudioError({
        area: 'Reference Upload Signed URL Failed',
        route: 'POST /api/uploads',
        severity: 'ERROR',
        error: storageErr || 'Missing uploadData',
        user,
        context: { projectId, filename: safeName, storagePath },
      });
      return NextResponse.json({ error: "Couldn't prepare upload link. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      upload: {
        provider: uploadData.provider,
        storagePath: uploadData.storagePath,
        token: uploadData.token,
        uploadUrl: uploadData.uploadUrl,
      },
      file: {
        id: uploadRow.id,
        filename: safeName,
        size,
        mimeType,
        storagePath: uploadData.storagePath,
      },
    });
  } catch (err) {
    console.error('Error in POST /api/uploads:', err);
    await reportStudioError({
      area: 'Reference Upload Exception',
      route: 'POST /api/uploads',
      severity: 'ERROR',
      error: err,
      user,
      context: { projectId },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/uploads: Lists stored references for the authenticated user's draft.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return storageUnavailable();

  const user = await getRequestUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const projectId = projectIdSchema.safeParse(req.nextUrl.searchParams.get('projectId'));
  if (!projectId.success) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // If submitted, references are accessed strictly through authorized project APIs
    if (await projectExists(admin, projectId.data)) {
      return NextResponse.json({ files: [] });
    }

    const stored = await listUserDraftReferences(admin, user.id, projectId.data);
    const files = await signReferenceFiles(
      admin,
      stored.map((s) => ({
        id: s.id || s.storagePath,
        filename: s.filename,
        size: s.size,
        mimeType: s.mimeType,
        storagePath: s.storagePath,
        url: '',
      }))
    );
    return NextResponse.json({ files });
  } catch (err) {
    console.error('Error in GET /api/uploads:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const deleteSchema = z.object({
  projectId: projectIdSchema,
  storagePath: z.string().max(300),
});

/**
 * DELETE /api/uploads: Removes an uploaded reference from the user's pending draft.
 */
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) return storageUnavailable();

  const user = await getRequestUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    if (await projectExists(admin, parsed.data.projectId)) {
      return NextResponse.json({ error: 'Submitted project references cannot be removed here.' }, { status: 409 });
    }

    // Strict Cross-Tenant Check: Upload must belong to this user and draft, and be pending
    const { data: record, error: findErr } = await admin
      .from('project_uploads')
      .select('id, storage_path, user_id, status')
      .eq('storage_path', parsed.data.storagePath)
      .eq('user_id', user.id)
      .eq('draft_id', parsed.data.projectId)
      .eq('status', 'pending')
      .maybeSingle();

    if (findErr || !record) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    // 1. Remove from configured storage provider
    const { error: storageErr } = await removeStorageObjects(
      admin,
      REFERENCE_LIMITS.bucket,
      [record.storage_path]
    );

    if (storageErr) {
      console.warn('Storage deletion warning:', storageErr);
    }

    // 2. Delete row from project_uploads
    await admin.from('project_uploads').delete().eq('id', record.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/uploads:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
