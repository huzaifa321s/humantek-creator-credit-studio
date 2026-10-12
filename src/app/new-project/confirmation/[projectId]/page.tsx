import { notFound, redirect } from 'next/navigation';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getProjectById } from '@/lib/store';
import { formatDbProject } from '@/lib/orders';
import type { ProjectRecord } from '@/types';
import ConfirmationContent from './ConfirmationContent';

export const dynamic = 'force-dynamic';

interface ConfirmationPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectConfirmationPage({ params }: ConfirmationPageProps) {
  const { projectId } = await params;

  // 1. Concurrently resolve user authentication and project record in parallel
  const [user, dbResult] = await Promise.all([
    getRequestUser(),
    isSupabaseConfigured()
      ? createAdminClient()
          .from('projects')
          .select('*, project_items(service_id, service_name, tier_level, quantity, total_credits), project_additions(name)')
          .eq('id', projectId)
          .maybeSingle()
      : Promise.resolve({ data: getProjectById(projectId), error: null }),
  ]);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/new-project/confirmation/${projectId}`)}`);
  }

  let project: ProjectRecord | null = null;
  const p = dbResult.data as any;

  if (p && !dbResult.error) {
    // Ownership strictly by user_id / userId or admin (NEVER insecure email match)
    const projectUserId = p.user_id || p.userId;
    const isOwner = projectUserId === user.id || user.isAdmin;

    if (isOwner) {
      project = isSupabaseConfigured() && !user.isDevFallback ? formatDbProject(p) : (p as ProjectRecord);
    }
  }

  if (!project) {
    notFound();
  }

  return <ConfirmationContent project={project} canChat={user.canChat || Boolean(user.emailConfirmed)} />;
}
