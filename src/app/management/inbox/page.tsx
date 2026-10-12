import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { InboxPageContent } from './InboxPageContent';

export const dynamic = 'force-dynamic';

export default async function ManagementInboxPage() {
  await requireAdmin();
  return <InboxPageContent />;
}
