import React from 'react';
import { redirect } from 'next/navigation';
import { getRequestUser } from '@/lib/auth';
import CreatorStudioPage from './new-project/page';

export const dynamic = 'force-dynamic';

/**
 * Root Gateway Page (`/`)
 *
 * - Signed-in admins  -> `/management`
 * - Signed-in clients -> `/projects`
 * - Guests            -> Renders `<CreatorStudioPage />` directly (200 OK without HTTP 307 redirect penalty)
 */
export default async function RootGatewayPage() {
  const user = await getRequestUser();

  if (user?.email && !user.isDevFallback) {
    if (user.role === 'admin' || user.isAdmin) {
      redirect('/management');
    }
    redirect('/projects');
  }

  return <CreatorStudioPage />;
}
