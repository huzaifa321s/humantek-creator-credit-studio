import React from 'react';
import { RequireAdmin } from '@/components/auth/RequireAdmin';

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
