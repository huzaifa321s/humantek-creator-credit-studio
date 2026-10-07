import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Root Gateway Page (`/`)
 *
 * Recommended Architecture:
 * - Contains NO client UI and renders NO heavy components.
 * - Redirect-only gateway:
 *     - Signed-in users   -> `/projects`
 *     - Signed-out users  -> `/login`
 * - Guarantees zero flash of unauthenticated wizard content (FOUC).
 */
export default async function RootGatewayPage() {
  const session = await getSession();

  if (session?.email) {
    redirect('/projects');
  } else {
    redirect('/login');
  }
}
