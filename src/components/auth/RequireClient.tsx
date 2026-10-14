'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

interface RequireClientProps {
  children: React.ReactNode;
}

export function RequireClient({ children }: RequireClientProps) {
  const router = useRouter();
  const {
    user,
    isHydrated,
    isSessionVerified,
    isAdmin,
    updateUser,
    setSessionVerified,
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

      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data.authenticated && data.user) {
            updateUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || data.user.email?.split('@')[0],
              avatarUrl: data.user.avatarUrl ?? null,
              role: data.user.role || 'client',
              emailVerified: Boolean(data.user.emailConfirmed),
              hasProjects: Boolean(data.user.hasProjects),
              canChat: Boolean(data.user.canChat),
            });
            setSessionVerified(true);

            const role = (data.user.role || '').toLowerCase();
            if (role === 'admin') {
              router.replace('/management');
              return;
            }

            setIsVerifying(false);
            return;
          }
        }
      } catch {
        // Fallback below if session check fails and no local user exists
        if (active && isHydrated && user?.email && !isAdmin()) {
          setIsVerifying(false);
          return;
        }
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
    updateUser,
    setSessionVerified,
    signOut,
    router,
  ]);

  if (isVerifying || !isHydrated || !user?.email || isAdmin()) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-xs text-muted-foreground font-mono">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
