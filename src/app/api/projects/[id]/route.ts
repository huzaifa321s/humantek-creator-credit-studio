import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signReferenceFiles } from '@/lib/references';
import { serializeClientProject, serializeAdminProject } from '@/lib/serializers/project';
import { getProjectById } from '@/lib/store';

export const dynamic = 'force-dynamic';

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

  // Fallback in-memory store (strictly disabled in production)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }
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
