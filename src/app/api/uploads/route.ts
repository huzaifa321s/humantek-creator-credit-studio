import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = (formData.get('projectId') as string) || 'temp';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // In production with Supabase Storage:
    // const { data, error } = await supabase.storage.from('references').upload(`${projectId}/${file.name}`, file);

    const upload = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      filename: file.name,
      size: file.size,
      url: `/uploads/${projectId}/${file.name}`,
    };

    return NextResponse.json({
      success: true,
      upload,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'File upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
