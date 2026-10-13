import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signReferenceFiles } from '@/lib/references';
import { serializeClientProject, serializeAdminProject } from '@/lib/serializers/project';
import { getProjectById } from '@/lib/store';

export const dynamic = 'force-dynamic';

const addNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, 'Additional note must be at least 5 characters')
    .max(2000, 'Additional note must be under 2,000 characters')
    .refine((v) => !/<\/?[a-z][^>]*>/i.test(v), 'HTML tags are not allowed'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  if (user.role === 'admin' && !user.isAdmin) {
    return NextResponse.json(
      {
        error: 'Two-factor authentication (AAL2) required to access project management operations.',
        code: 'AAL2_REQUIRED',
      },
      { status: 403 }
    );
  }

  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();
      const { data: projectRow, error: fetchErr } = await adminClient
        .from('projects')
        .select('*, project_items(*), project_additions(*)')
        .eq('id', projectId)
        .maybeSingle();

      if (fetchErr) {
        console.error('Error fetching project detail:', fetchErr);
        return NextResponse.json({ error: 'Failed to retrieve project' }, { status: 500 });
      }

      if (!projectRow) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Strict tenant ownership check: non-admins cannot access other clients' projects
      if (!user.isAdmin && projectRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Batch generate short-lived signed URLs for reference files
      if (Array.isArray(projectRow.uploaded_files) && projectRow.uploaded_files.length > 0) {
        projectRow.uploaded_files = await signReferenceFiles(adminClient, projectRow.uploaded_files, 900);
      }

      const serialized = user.isAdmin
        ? serializeAdminProject(projectRow)
        : serializeClientProject(projectRow);

      return NextResponse.json({ project: serialized });
    } catch (err) {
      console.error('Exception in GET /api/projects/[id]:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Fallback in-memory store
  const p = getProjectById(projectId);
  if (!p) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!user.isAdmin && p.userId && p.userId !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const serialized = user.isAdmin ? serializeAdminProject(p) : serializeClientProject(p);
  return NextResponse.json({ project: serialized });
}

/**
 * PATCH /api/projects/[id]:
 * Appends a dated additional note to the project before production starts.
 * The original brief instructions remain an immutable snapshot.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid note content' },
      { status: 400 }
    );
  }

  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    try {
      const adminClient = createAdminClient();
      const { data: projectRow, error: fetchErr } = await adminClient
        .from('projects')
        .select('id, user_id, status, additional_notes')
        .eq('id', projectId)
        .maybeSingle();

      if (fetchErr || !projectRow) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (!user.isAdmin && projectRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Gate: Once in production or later, client modifications must go through chat
      if (!user.isAdmin && !['pending_review', 'payment_confirmed'].includes(projectRow.status)) {
        return NextResponse.json(
          {
            error: 'This project is already in production. Please send further notes or requests directly through studio messages.',
          },
          { status: 400 }
        );
      }

      const existingNotes = Array.isArray(projectRow.additional_notes) ? projectRow.additional_notes : [];
      const newNote = {
        id: crypto.randomUUID(),
        note: parsed.data.note,
        createdAt: new Date().toISOString(),
        authorRole: user.isAdmin ? 'admin' : 'client',
      };

      const updatedNotes = [...existingNotes, newNote];

      const { error: updateErr } = await adminClient
        .from('projects')
        .update({
          additional_notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (updateErr) {
        console.error('Failed to append additional note:', updateErr);
        return NextResponse.json({ error: 'Failed to save additional note' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Additional note added successfully',
        additionalNotes: updatedNotes,
      });
    } catch (err) {
      console.error('Exception in PATCH /api/projects/[id]:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Note recorded' });
}
