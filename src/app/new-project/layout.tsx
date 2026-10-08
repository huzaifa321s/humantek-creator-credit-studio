'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isHydrated, isAdmin } = useUserStore();

  useEffect(() => {
    if (!isHydrated) return;
    if (isAdmin()) {
      router.replace('/management');
    }
  }, [isHydrated, isAdmin, router]);

  if (isHydrated && isAdmin()) {
    return null;
  }

  return <>{children}</>;
}
