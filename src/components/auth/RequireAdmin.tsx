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
  const { user, isHydrated, isSessionVerified, isAdmin, updateUser, setSessionVerified, signOut } = useUserStore();
  const [isVerifying, React_useState] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    async function verify() {
      // 1. Only permit immediately if session has already been verified against the server
      if (isHydrated && isSessionVerified && user?.email && isAdmin()) {
        React_useState(false);
        return;
      }

      // 2. Fetch authoritative server session to synchronize cookie auth into client store
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
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
            setSessionVerified(true);

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
        }
      } catch {
        // Fallback below
      }

      if (active) {
        signOut();
        React_useState(false);
        window.location.replace('/admin-login');
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [user, isHydrated, isSessionVerified, isAdmin, updateUser, setSessionVerified, signOut, router]);

  if (isVerifying || !isSessionVerified || !user?.email || !isAdmin()) {
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
