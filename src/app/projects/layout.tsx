import React from 'react';
import { RequireClient } from '@/components/auth/RequireClient';

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireClient>{children}</RequireClient>;
}
