export type UserRole = 'client' | 'admin' | null;

/**
 * Strict database-only role resolution.
 * An email allowlist makes an email address equal to admin power.
 * All administrative capabilities are strictly dictated by PostgreSQL `profiles.role`.
 */
export function getRoleFromProfile(
  profile: { role?: string } | null
): UserRole {
  if (profile?.role === 'admin') return 'admin';
  if (profile?.role === 'client') return 'client';
  return null;
}
