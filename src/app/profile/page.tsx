import React from 'react';
import { requireUser } from '@/lib/auth';
import { ProfilePageContent } from './ProfilePageContent';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <ProfilePageContent
      initialUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        role: user.role === 'admin' ? 'admin' : 'client',
        teamRole: user.teamRole ?? null,
      }}
    />
  );
}
