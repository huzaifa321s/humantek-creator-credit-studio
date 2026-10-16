import React from 'react';
import { requireOwner } from '@/lib/auth';
import { TeamAccessPageContent } from './TeamAccessPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementTeamPage() {
  await requireOwner();
  return <TeamAccessPageContent />;
}
