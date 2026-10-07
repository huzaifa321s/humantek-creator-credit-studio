import { redirect } from 'next/navigation';
import { getRequestUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Root Gateway Page (`/`)
 *
 * Architecture:
 * - Contains NO client UI and renders NO heavy components.
 * - Redirect-only gateway:
 *     - Signed-in users   -> `/projects`
 *     - Signed-out users  -> `/login`
 * - Guarantees zero flash of unauthenticated wizard content (FOUC).
 */
export default async function RootGatewayPage() {
  const user = await getRequestUser();

  if (user?.email && !user.isDevFallback) {
    redirect('/projects');
  } else {
    redirect('/login');
  }
}
