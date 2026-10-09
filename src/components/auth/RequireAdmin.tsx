'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

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
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-xs font-mono text-zinc-400">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
