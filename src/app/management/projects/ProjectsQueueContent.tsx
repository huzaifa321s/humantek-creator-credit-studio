'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AdminProjectsTable } from '@/components/management/AdminProjectsTable';
import { useProjectsQuery, useUpdateProjectStatus } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectRecord } from '@/types';

const EMPTY_PROJECTS: ProjectRecord[] = [];

function InnerProjectsQueue() {
  const router = useRouter();
  const { setActiveProjectId } = useStudioChat();

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const isLoading = projectsQuery.isPending;
  const updateStatus = useUpdateProjectStatus();
  const isUpdating = updateStatus.isPending ? updateStatus.variables?.id ?? null : null;

  const handleUpdateStatus = (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus']
  ) => {
    updateStatus.mutate(
      { id, status: newStatus, paymentStatus: newPayment },
      {
        onSuccess: () =>
          toast.success(`Updated status to ${newStatus.replace(/_/g, ' ')}`),
        onError: (err) => toast.error(err.message || 'Failed to update status'),
      }
    );
  };

  const handleOpenChat = (projectId: string) => {
    setActiveProjectId(projectId);
    router.push(`/management/inbox?thread=${projectId}`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AdminProjectsTable
        projects={projects}
        isLoading={isLoading}
        onOpenChat={handleOpenChat}
        onUpdateStatus={handleUpdateStatus}
        isUpdatingId={isUpdating}
      />
    </div>
  );
}

export function ProjectsQueueContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <InnerProjectsQueue />
    </Suspense>
  );
}
