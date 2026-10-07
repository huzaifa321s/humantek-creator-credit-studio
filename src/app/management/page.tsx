import { requireAdmin } from '@/lib/auth';
import { ManagementContent } from './ManagementContent';

export const dynamic = 'force-dynamic';

/**
 * Server-Enforced Agency Management Dashboard
 *
 * Guarantees zero client-side bypass:
 * - Requires verified authenticated Supabase session.
 * - Authoritatively asserts admin role in PostgreSQL `profiles` table.
 * - Redirects unauthenticated users to `/login?next=/management`.
 * - Redirects non-admin client accounts to `/projects`.
 */
export default async function ManagementPage() {
  await requireAdmin();
  return <ManagementContent />;
}
