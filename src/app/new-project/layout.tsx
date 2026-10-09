'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/userStore';

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrated, isAdmin } = useUserStore();

  const isConfirmationPage = pathname?.includes('/confirmation/');

  useEffect(() => {
    if (!isHydrated) return;
    if (isAdmin() && !isConfirmationPage) {
      router.replace('/management');
    }
  }, [isHydrated, isAdmin, router, isConfirmationPage]);

  if (isHydrated && isAdmin() && !isConfirmationPage) {
    return null;
  }

  return <>{children}</>;
}

