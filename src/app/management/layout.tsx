import React from 'react';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { ManagementLayoutShell } from '@/components/management/ManagementLayoutShell';

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAdmin>
      <ManagementLayoutShell>{children}</ManagementLayoutShell>
    </RequireAdmin>
  );
}
