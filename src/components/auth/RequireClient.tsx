'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

interface RequireClientProps {
  children: React.ReactNode;
}

export function RequireClient({ children }: RequireClientProps) {
  const router = useRouter();
  const { user, isHydrated, isAdmin } = useUserStore();

  useEffect(() => {
    if (!isHydrated) return;

    if (!user?.email) {
      router.replace('/login');
    } else if (isAdmin()) {
      router.replace('/management');
    }
  }, [user, isHydrated, isAdmin, router]);

  if (!isHydrated || !user?.email || isAdmin()) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-xs text-muted-foreground font-mono">Loading studio workspace...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
