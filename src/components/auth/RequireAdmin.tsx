'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/lib/userStore';
import { fetchAndSyncSession } from '@/lib/queries/session';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isHydrated, isSessionVerified, isAdmin, signOut } = useUserStore();
  const [isVerifying, React_useState] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    async function verify() {
      // 1. Only permit immediately if session has already been verified against the server and teamRole is resolved
      if (isHydrated && isSessionVerified && user?.email && isAdmin() && user?.teamRole) {
        React_useState(false);
        return;
      }

      // 2. Fetch authoritative server session via deduplicated TanStack Query cache
      const data = await fetchAndSyncSession(queryClient);
      if (active && data?.authenticated && data.user) {
        const role = (data.user.role || '').toLowerCase();
        const isAdminUser = role === 'admin';

        if (isAdminUser) {
          React_useState(false);
          return;
        } else {
          router.replace('/projects');
          return;
        }
      }

      if (active) {
        signOut();
        React_useState(false);
        window.location.replace('/admin-login');
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [user, isHydrated, isSessionVerified, isAdmin, signOut, router, queryClient]);

  if (isVerifying || !isSessionVerified || !user?.email || !isAdmin()) {
    return (
      <StudioCardLayout mode="standalone" backLabel="Back to Studio">
        <StudioPageLoader label="Verifying console access..." variant="overview" />
      </StudioCardLayout>
    );
  }

  return <>{children}</>;
}

