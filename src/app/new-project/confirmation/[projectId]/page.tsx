import { notFound, redirect } from 'next/navigation';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getProjectById } from '@/lib/store';
import { formatDbProject } from '@/lib/orders';
import type { ProjectRecord } from '@/types';
import ConfirmationContent from './ConfirmationContent';

interface ConfirmationPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectConfirmationPage({ params }: ConfirmationPageProps) {
  const { projectId } = await params;

  const user = await getRequestUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/new-project/confirmation/${projectId}`)}`);
  }

  let project: ProjectRecord | null = null;

  if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
    const adminClient = createAdminClient();
    const { data: p, error } = await adminClient
      .from('projects')
      .select('*, project_items(*), project_additions(*)')
      .eq('id', projectId)
      .maybeSingle();

    if (p && !error) {
      // Ownership strictly by user_id or admin (NEVER email match!)
      const isOwner = p.user_id === user.id || user.isAdmin;

      if (isOwner) {
        project = formatDbProject(p);
      }
    }
  } else {
    const p = getProjectById(projectId);
    if (p) {
      // Ownership strictly by userId or admin (NEVER email match!)
      const isOwner = (p.userId ? p.userId === user.id : false) || user.isAdmin;

      if (isOwner) {
        project = p;
      }
    }
  }

  if (!project) {
    notFound();
  }

  return <ConfirmationContent project={project} canChat={user.canChat} />;
}
