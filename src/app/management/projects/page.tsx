import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { ProjectsQueueContent } from './ProjectsQueueContent';

export const dynamic = 'force-dynamic';

export default async function ManagementProjectsPage() {
  await requireAdmin();
  return <ProjectsQueueContent />;
}
