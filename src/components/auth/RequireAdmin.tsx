'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

import { Spinner } from '@/components/ui/spinner';
import { StudioBackground } from '@/components/StudioBackground';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const router = useRouter();
  const { user, isHydrated, isAdmin } = useUserStore();

  useEffect(() => {
    if (!isHydrated) return;

    if (!user?.email) {
      router.replace('/admin-login');
    } else if (!isAdmin()) {
      router.replace('/projects');
    }
  }, [user, isHydrated, isAdmin, router]);

  if (!isHydrated || !user?.email || !isAdmin()) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-background text-foreground overflow-hidden">
        <StudioBackground variant="subtle" showDots={false} />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Spinner className="size-6 text-amber-500" />
          <p className="text-xs font-mono text-muted-foreground">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
