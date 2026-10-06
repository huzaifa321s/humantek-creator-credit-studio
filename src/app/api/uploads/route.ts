import { NextRequest, NextResponse } from 'next/server';
import { projectIdSchema } from '@/lib/validation';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Strips path separators and unsafe characters from a client filename. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'file';
}

export async function POST(req: NextRequest) {
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

  const projectIdResult = projectIdSchema.safeParse(formData.get('projectId'));
  if (!projectIdResult.success) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }
  const projectId = projectIdResult.data;

  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: 'Only PNG, JPG, WebP or GIF images are allowed' }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Images must be between 1 byte and 10 MB' }, { status: 413 });
  }

  const filename = sanitizeFilename(file.name);

  // In production with Supabase Storage:
  // const { data, error } = await supabase.storage.from('references').upload(`${projectId}/${filename}`, file);

  const uploaded = {
    id: `file-${crypto.randomUUID()}`,
    filename,
    size: file.size,
    url: `/uploads/${projectId}/${encodeURIComponent(filename)}`,
  };

  // `upload` kept for backwards compatibility with older clients.
  return NextResponse.json({ success: true, file: uploaded, upload: uploaded });
}
