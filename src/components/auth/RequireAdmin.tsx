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
  const { user, isHydrated, isAdmin, updateUser } = useUserStore();
  const [isVerifying, setIsVerifying] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    async function verify() {
      // 1. If user store is already hydrated and user is verified admin, permit immediately
      if (isHydrated && user?.email && isAdmin()) {
        setIsVerifying(false);
        return;
      }

      // 2. Fetch server session to synchronize cookie auth into client store
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (active && data.authenticated && data.user) {
            updateUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || data.user.email?.split('@')[0],
              role: data.user.role || 'client',
              emailVerified: Boolean(data.user.emailConfirmed),
              hasProjects: Boolean(data.user.hasProjects),
              canChat: Boolean(data.user.canChat),
            });

            const role = (data.user.role || '').toLowerCase();
            const email = (data.user.email || '').toLowerCase();
            const isAdminUser =
              role === 'admin' ||
              ['dev@localhost', 'admin@humantek.art', 'huzaifa14321furqan@gmail.com', 'huzaifafurqan22@gmail.com'].includes(email);

            if (isAdminUser) {
              setIsVerifying(false);
              return;
            } else {
              router.replace('/projects');
              return;
            }
          }
        }
      } catch {
        // Fallback below
      }

      if (active) {
        setIsVerifying(false);
        if (!user?.email) {
          router.replace('/admin-login');
        } else if (!isAdmin()) {
          router.replace('/projects');
        }
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [user, isHydrated, isAdmin, updateUser, router]);

  if (isVerifying || !user?.email || !isAdmin()) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-background text-foreground overflow-hidden">
        <StudioBackground variant="subtle" showDots={false} />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Spinner className="size-6 text-amber-500" />
          <p className="text-xs font-mono text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
