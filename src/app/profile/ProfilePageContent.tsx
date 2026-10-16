'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { useUserStore } from '@/lib/userStore';
import type { UserProfileResponse } from '@/app/api/profile/route';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, Eye, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

function getRoleMeta(role?: string | null, teamRole?: string | null, email?: string | null) {
  const isStaff = (role || '').toLowerCase() === 'admin';
  if (!isStaff) {
    return {
      label: 'Client',
      badgeVariant: 'outline' as const,
    };
  }
  const cleanEmail = (email || '').trim().toLowerCase();
  const isOwnerEmail = cleanEmail === 'admin@humantek.art';
  const normalizedTeamRole = isOwnerEmail ? 'owner' : (teamRole || '').toLowerCase();

  switch (normalizedTeamRole) {
    case 'owner':
      return {
        label: 'Owner',
        badgeVariant: 'gold' as const,
      };
    case 'viewer':
      return {
        label: 'Viewer',
        badgeVariant: 'outline' as const,
      };
    case 'manager':
    default:
      return {
        label: 'Manager',
        badgeVariant: 'success' as const,
      };
  }
}

export interface ProfilePageInitialUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'client' | 'admin';
  teamRole: 'owner' | 'manager' | 'viewer' | null;
}

export function ProfilePageContent({ initialUser }: { initialUser?: ProfilePageInitialUser }) {
  const queryClient = useQueryClient();
  const { user, updateUser } = useUserStore();

  const { data, isPending, refetch } = useQuery<{ profile: UserProfileResponse }>({
    queryKey: ['user', 'profile', initialUser?.id || user?.id || 'me'],
    queryFn: async () => {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load profile');
      }
      return json as { profile: UserProfileResponse };
    },
    staleTime: 15_000,
  });

  const profile = data?.profile;

  const [name, setName] = useState(initialUser?.name || '');
  const [hasEditedName, setHasEditedName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize name input when server profile loads (do not overwrite unsaved user typing)
  useEffect(() => {
    if (hasEditedName) return;
    if (profile?.name) {
      setName(profile.name);
    } else if (initialUser?.name) {
      setName((prev) => prev || initialUser.name);
    } else if (user?.name) {
      setName((prev) => prev || user.name);
    }
  }, [profile?.name, initialUser?.name, user?.name, hasEditedName]);

  // Sync name, avatar and teamRole to client store
  useEffect(() => {
    const activeSource = profile || initialUser;
    if (!activeSource) return;

    const updates: Partial<{
      name: string;
      avatarUrl: string;
      teamRole: 'owner' | 'manager' | 'viewer' | null;
    }> = {};
    if (!hasEditedName && profile?.name && profile.name !== user?.name) {
      updates.name = profile.name;
    }
    if (activeSource.avatarUrl && activeSource.avatarUrl !== user?.avatarUrl) {
      updates.avatarUrl = activeSource.avatarUrl;
    }
    if (activeSource.teamRole && activeSource.teamRole !== user?.teamRole) {
      updates.teamRole = activeSource.teamRole;
    }
    if (Object.keys(updates).length > 0) {
      updateUser(updates);
    }
  }, [profile, initialUser, hasEditedName, user?.name, user?.avatarUrl, user?.teamRole, updateUser]);

  const effectiveRole = profile?.role || initialUser?.role || user?.role || 'client';
  const effectiveTeamRole = profile?.teamRole ?? initialUser?.teamRole ?? user?.teamRole ?? null;
  const effectiveEmail = profile?.email || initialUser?.email || user?.email || '';
  const isStaff = effectiveRole.toLowerCase() === 'admin';
  const isViewer = isStaff && effectiveTeamRole === 'viewer';
  const roleMeta = useMemo(
    () => getRoleMeta(effectiveRole, effectiveTeamRole, effectiveEmail),
    [effectiveRole, effectiveTeamRole, effectiveEmail]
  );

  const originalName = (profile?.name ?? initialUser?.name ?? user?.name ?? '').trim();
  const isDirty = Boolean(name.trim() && name.trim() !== originalName);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      toast.error('Name must be at least 2 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Could not update name.');
        return;
      }

      // Immediately update client store so header & profile dropdown reflect the new name
      setHasEditedName(false);
      updateUser({ name: cleanName });

      toast.success('Your name has been updated.');
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['management', 'team'] }),
      ]);
    } catch {
      toast.error('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const topRightBadge = isStaff ? (
    isViewer ? (
      <Badge variant="outline" size="sm" className="gap-1.5 px-2.5 py-1">
        <Eye className="size-3.5 text-muted-foreground shrink-0" />
        <span>Viewer · Read-Only</span>
      </Badge>
    ) : (
      <Badge variant="gold" size="sm" className="gap-1.5 px-2.5 py-1">
        <ShieldCheck className="size-3.5 shrink-0" />
        <span>{roleMeta.label} Access</span>
      </Badge>
    )
  ) : (
    <StudioNewProjectButton />
  );

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel={isStaff ? 'Back to Console' : 'Back to Studio'}
      topRightBadge={topRightBadge}
    >
      <div className="space-y-6 pb-24 sm:pb-16 animate-in fade-in duration-200">
        {/* Standard Standalone Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Account Profile
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Manage your display name and view your registered studio account details.
            </p>
          </div>

          <Badge
            variant={roleMeta.badgeVariant}
            size="sm"
            className="font-bold uppercase tracking-wider self-start sm:self-auto"
          >
            {roleMeta.label}
          </Badge>
        </div>

        {/* Profile Form Card */}
        <div className="max-w-xl">
          {isPending && !profile && !user ? (
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-5 sm:p-6 space-y-4">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </Card>
          ) : (
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
              <CardHeader className="p-4 sm:p-6 pb-2.5 sm:pb-3">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="size-4 text-brand-text dark:text-amber-400 shrink-0" />
                  <span>Personal Information</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                  Your full name is displayed on project briefs, studio messages, and order receipts.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 pt-2">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name" className="text-xs font-semibold text-foreground">
                      Full Name
                    </Label>
                    <Input
                      id="profile-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => {
                        setHasEditedName(true);
                        setName(e.target.value);
                      }}
                      className="h-9 sm:h-10 text-xs sm:text-sm bg-background/50 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email" className="text-xs font-semibold text-muted-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={effectiveEmail}
                      disabled
                      readOnly
                      className="h-9 sm:h-10 text-xs sm:text-sm bg-muted/40 text-muted-foreground cursor-not-allowed font-mono rounded-lg"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Your login email is linked to your studio projects and credit ledger and cannot be changed here.
                    </p>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <Button
                      type="submit"
                      variant="gold"
                      size="default"
                      disabled={isSaving || !isDirty}
                      loading={isSaving}
                      loadingText="Saving..."
                      className="h-9 sm:h-10 px-5 text-xs font-bold rounded-lg cursor-pointer shadow-xs shadow-amber-400/20 w-full sm:w-auto"
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </StudioCardLayout>
  );
}

