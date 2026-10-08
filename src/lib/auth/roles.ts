export type UserRole = 'client' | 'admin' | null;

export const ADMIN_EMAILS: string[] = [
  'dev@localhost',
  'admin@humantek.art',
  'huzaifa14321furqan@gmail.com',
  'huzaifafurqan22@gmail.com',
  ...(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
];

export function isSystemAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return ADMIN_EMAILS.includes(clean);
}

export function getRoleFromProfile(
  profile: { role?: string } | null,
  email?: string | null
): UserRole {
  if (profile?.role === 'admin') return 'admin';
  if (isSystemAdminEmail(email)) return 'admin';
  if (profile?.role) return 'client';
  return null;
}
