import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { createStorageSignedViewUrl, uploadStorageObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const BUCKET = 'project-attachments';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Strips path separators and unsafe characters from a client filename. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'file';
}

/**
 * Uploads one chat image to private storage for a project the caller can access.
 * Returns the storage path the messages API expects, plus a short-lived preview URL.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = rawId.startsWith('global:') ? 'global' : rawId;
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.isAdmin && !user.canManageProjects) {
      return NextResponse.json(
        { error: 'Viewers have read-only access and cannot upload attachments.' },
        { status: 403 }
      );
    }

    const rl = checkRateLimit(`upload:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    const isGlobal = id === 'global';

    if (isGlobal && !user.isAdmin) {
      if (!user.emailConfirmed || !user.canChat) {
        return NextResponse.json(
          { error: 'Chat requires a verified email and at least one submitted project.' },
          { status: 403 }
        );
      }
    }

    if (!isGlobal) {
      const { data: project, error: projErr } = await admin
        .from('projects')
        .select('id, user_id')
        .eq('id', id)
        .single();

      if (projErr || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (!user.isAdmin && project.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid upload payload' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WebP or GIF images are allowed' }, { status: 415 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Images must be under 10 MB' }, { status: 413 });
    }

    const fileName = sanitizeFilename(file.name);
    const storagePath = `projects/${id}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadErr } = await uploadStorageObject(
      admin,
      BUCKET,
      storagePath,
      file,
      file.type
    );

    if (uploadErr) {
      console.error('Chat attachment upload failed:', uploadErr);
      return NextResponse.json(
        { error: "Couldn't upload the image. Please try again." },
        { status: 502 }
      );
    }

    const signedUrl = await createStorageSignedViewUrl(admin, BUCKET, storagePath, 3600);

    return NextResponse.json({
      success: true,
      attachment: {
        storagePath,
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        url: signedUrl,
      },
    });
  } catch (err) {
    console.error('Error in POST /api/projects/[id]/attachments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
