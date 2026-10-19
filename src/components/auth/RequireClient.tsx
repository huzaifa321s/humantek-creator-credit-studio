'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/lib/userStore';
import { fetchAndSyncSession } from '@/lib/queries/session';

import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

interface RequireClientProps {
  children: React.ReactNode;
}

export function RequireClient({ children }: RequireClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    user,
    isHydrated,
    isSessionVerified,
    isAdmin,
    signOut,
  } = useUserStore();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (isHydrated && isSessionVerified && user?.email) {
        if (isAdmin()) {
          router.replace('/management');
          return;
        }
        setIsVerifying(false);
        return;
      }

      const data = await fetchAndSyncSession(queryClient);
      if (active && data?.authenticated && data.user) {
        const role = (data.user.role || '').toLowerCase();
        if (role === 'admin') {
          router.replace('/management');
          return;
        }

        setIsVerifying(false);
        return;
      }

      if (active && data === null && isHydrated && user?.email && !isAdmin()) {
        setIsVerifying(false);
        return;
      }

      if (active) {
        signOut();
        setIsVerifying(false);
        const currentUrl =
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/projects';
        router.replace(`/login?next=${encodeURIComponent(currentUrl)}`);
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [
    user,
    isHydrated,
    isSessionVerified,
    isAdmin,
    signOut,
    router,
    queryClient,
  ]);

  if (isVerifying || !isHydrated || !user?.email || isAdmin()) {
    return (
      <StudioCardLayout mode="standalone" backLabel="Back to Studio">
        <StudioPageLoader label="Loading workspace..." variant="cards" />
      </StudioCardLayout>
    );
  }

  return <>{children}</>;
}

