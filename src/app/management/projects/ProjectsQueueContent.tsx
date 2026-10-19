'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import { AdminProjectsTable } from '@/components/management/AdminProjectsTable';
import { useUpdateProjectStatus } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';
import { toast } from 'sonner';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';
import type { ProjectRecord } from '@/types';

function InnerProjectsQueue() {
  const router = useRouter();
  const topLoader = useTopLoader();
  const { setActiveProjectId } = useStudioChat();

  const updateStatus = useUpdateProjectStatus();
  const isUpdating = updateStatus.isPending ? updateStatus.variables?.id ?? null : null;

  const handleUpdateStatus = (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus'],
    prev?: {
      status: ProjectRecord['status'];
      paymentStatus?: ProjectRecord['paymentStatus'];
      paymentMethod?: ProjectRecord['paymentMethod'];
    },
    newPaymentMethod?: ProjectRecord['paymentMethod']
  ) => {
    updateStatus.mutate(
      { id, status: newStatus, paymentStatus: newPayment, paymentMethod: newPaymentMethod },
      {
        onSuccess: () => {
          const statusChanged = !prev || prev.status !== newStatus;
          const paymentChanged = Boolean(
            prev && newPayment && (prev.paymentStatus || 'unpaid') !== newPayment
          );
          if (statusChanged && paymentChanged) {
            toast.success(
              `Updated status to ${newStatus.replace(/_/g, ' ')} and payment to ${newPayment}`
            );
          } else if (paymentChanged && newPayment) {
            toast.success(`Updated payment status to ${newPayment}`);
          } else {
            toast.success(`Updated status to ${newStatus.replace(/_/g, ' ')}`);
          }
        },
        onError: (err) => toast.error(err.message || 'Failed to update status'),
      }
    );
  };

  const handleOpenChat = (projectId: string) => {
    setActiveProjectId(projectId);
    topLoader.start();
    router.push(`/management/inbox?thread=${projectId}`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <AdminProjectsTable
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
        <StudioPageLoader
          label="Loading client projects..."
          variant="table"
          showHeader={false}
        />
      }
    >
      <InnerProjectsQueue />
    </Suspense>
  );
}
