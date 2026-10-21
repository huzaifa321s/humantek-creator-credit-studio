import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { REFERENCE_LIMITS } from '@/lib/validation';
import { removeStorageObjects } from '@/lib/storage';
import { buildStudioNotificationEmail, sendStudioEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const MAX_DELETIONS_PER_RUN = 500;
const MISSED_RUN_THRESHOLD_MS = 36 * 60 * 60 * 1000; // 36 hours

/**
 * Constant-time secret verification:
 * Hashes both the provided token and expected secret with SHA-256 before timingSafeEqual.
 * This guarantees equal-length 32-byte buffers, completely preventing any length-leak or
 * timingSafeEqual exceptions regardless of input length.
 */
function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!provided) return false;

  const hashA = createHash('sha256').update(provided).digest();
  const hashB = createHash('sha256').update(secret).digest();
  return timingSafeEqual(hashA, hashB);
}

// Strictly reject GET, PUT, DELETE, PATCH with 405 Method Not Allowed
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}

/**
 * POST /api/cron/cleanup-references
 *
 * Runs nightly garbage collection for abandoned wizard reference uploads.
 * - Targets ONLY 'pending' rows in `public.project_uploads` older than 8 days
 *   (matches 7-day wizard draft retention + 1 day margin).
 * - Attached files for active/submitted projects are NEVER deleted.
 * - Supports dry-run testing (?dry_run=true or JSON body { dryRun: true }).
 * - Caps deletions per run (500 max) and paginates queries.
 * - Records execution history in `public.cron_runs`.
 * - Alerts if no run has completed in 36 hours.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // 1. Secret authorization
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const testEmailTo = req.nextUrl.searchParams.get('test_email')?.trim();
  if (testEmailTo) {
    const result = await sendStudioEmail(
      buildStudioNotificationEmail({
        to: testEmailTo,
        category: 'project_status_client',
        subject: 'Humantek Creator Credit Studio — Live SMTP Verification',
        badge: 'SMTP Verified',
        heading: 'Your Studio Email Delivery is Live!',
        message: 'This is a live verification email sent from your Hostinger Node.js server via mail.humantekart.com.',
        greetingName: 'Muhammad Huzaifa',
        details: [
          ['SMTP Host', process.env.SMTP_HOST || '(not set)'],
          ['SMTP User', process.env.SMTP_USER || '(not set)'],
          ['SMTP Port', process.env.SMTP_PORT || '465'],
        ],
        ctaLabel: 'Open Studio',
        ctaUrl: '/projects',
      })
    );
    return NextResponse.json({
      smtpConfigured: {
        host: process.env.SMTP_HOST || null,
        port: process.env.SMTP_PORT || null,
        user: process.env.SMTP_USER || null,
        hasPass: Boolean(process.env.SMTP_PASS),
        emailFrom: process.env.EMAIL_FROM || null,
      },
      result,
    });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Database and storage not configured' }, { status: 503 });
  }

  // Parse dry_run option from query param or body
  const isQueryDryRun = req.nextUrl.searchParams.get('dry_run') === 'true';
  let isBodyDryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.dryRun === 'boolean') {
      isBodyDryRun = body.dryRun;
    }
  } catch {}
  const dryRun = isQueryDryRun || isBodyDryRun;

  const admin = createAdminClient();
  const cutoffIso = new Date(Date.now() - REFERENCE_LIMITS.abandonedAfterMs).toISOString();

  let scanned = 0;
  let removedFiles = 0;
  let removedBytes = 0;
  let missedRunAlert: string | null = null;

  try {
    // 2. Check for missed run alert: Was there a successful run in the last 36 hours?
    const thirtySixHoursAgo = new Date(Date.now() - MISSED_RUN_THRESHOLD_MS).toISOString();
    const { data: lastSuccessfulRun } = await admin
      .from('cron_runs')
      .select('created_at')
      .eq('job_name', 'cleanup_references')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSuccessfulRun && new Date(lastSuccessfulRun.created_at).getTime() < Date.now() - MISSED_RUN_THRESHOLD_MS) {
      missedRunAlert = `Missed cron schedule detected. Previous successful cleanup was at ${lastSuccessfulRun.created_at} (>36 hours ago).`;
      console.warn(`[Cron Alert] ${missedRunAlert}`);
    }

    // 3. Paginated query for abandoned pending uploads (status = 'pending' AND created_at < 8 days)
    let offset = 0;
    while (removedFiles < MAX_DELETIONS_PER_RUN) {
      // In dryRun mode, records are not deleted, so offset must advance.
      // In deletion mode, records are deleted each batch, so next batch is always at offset 0.
      const fetchOffset = dryRun ? offset : 0;
      const { data: pendingRows, error: fetchErr } = await admin
        .from('project_uploads')
        .select('id, storage_path, size, created_at')
        .eq('status', 'pending')
        .lt('created_at', cutoffIso)
        .order('created_at', { ascending: true })
        .range(fetchOffset, fetchOffset + BATCH_SIZE - 1);

      if (fetchErr) {
        throw new Error(`Failed to query project_uploads: ${fetchErr.message}`);
      }

      if (!pendingRows || pendingRows.length === 0) break;
      scanned += pendingRows.length;

      const pathsToDelete = pendingRows.map((r) => r.storage_path);
      const idsToDelete = pendingRows.map((r) => r.id);
      const batchBytes = pendingRows.reduce((acc, r) => acc + (Number(r.size) || 0), 0);

      if (!dryRun) {
        // Delete physical files from configured Storage Provider (Company Hub or Supabase)
        const { error: removeErr } = await removeStorageObjects(
          admin,
          REFERENCE_LIMITS.bucket,
          pathsToDelete
        );
        if (removeErr) {
          console.error('Storage deletion batch error:', removeErr);
        }

        // Delete records from database
        const { error: dbDeleteErr } = await admin
          .from('project_uploads')
          .delete()
          .in('id', idsToDelete);

        if (dbDeleteErr) {
          console.error('Database deletion batch error:', dbDeleteErr);
        }
      } else {
        offset += pendingRows.length;
      }

      removedFiles += pendingRows.length;
      removedBytes += batchBytes;

      if (pendingRows.length < BATCH_SIZE || removedFiles >= MAX_DELETIONS_PER_RUN) break;
    }

    const durationMs = Date.now() - startTime;

    // 4. Record execution in `public.cron_runs`
    await admin.from('cron_runs').insert({
      job_name: 'cleanup_references',
      status: 'success',
      scanned,
      removed_files: removedFiles,
      removed_bytes: removedBytes,
      dry_run: dryRun,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      success: true,
      scanned,
      removedFiles,
      removedBytes,
      dryRun,
      durationMs,
      retentionCutoff: cutoffIso,
      alert: missedRunAlert,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Cleanup failed';
    const durationMs = Date.now() - startTime;
    console.error('Reference cleanup fatal error:', err);

    // Record failure in cron_runs
    try {
      await admin.from('cron_runs').insert({
        job_name: 'cleanup_references',
        status: 'failed',
        scanned,
        removed_files: removedFiles,
        removed_bytes: removedBytes,
        dry_run: dryRun,
        error: errorMsg,
        duration_ms: durationMs,
      });
    } catch {}

    return NextResponse.json(
      { error: errorMsg, scanned, removedFiles, removedBytes },
      { status: 500 }
    );
  }
}
