'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useManagementTeamQuery,
  useAddTeamMemberMutation,
  useUpdateTeamRoleMutation,
  useRemoveTeamMemberMutation,
} from '@/lib/queries/management';
import { useUserStore } from '@/lib/userStore';
import type { TeamRole } from '@/lib/auth';
import type { TeamMemberRecord } from '@/app/api/management/team/route';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  ResponsiveTableShell,
  ResponsiveDesktopView,
  MobileCardList,
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardBody,
  MobileDataCardFooter,
  MobileDataCardActions,
  TablePaginationBar,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  UserPlus,
  Trash2,
  Lock,
  Search,
  RotateCcw,
  Users,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatStudioDate, formatStudioRelativeTime } from '@/lib/utils';

type RoleFilter = 'all' | TeamRole;

function getRoleLabel(role: TeamRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'manager':
      return 'Manager';
    case 'viewer':
    default:
      return 'Viewer';
  }
}

function getRoleBadgeVariant(role: TeamRole): 'gold' | 'success' | 'outline' {
  switch (role) {
    case 'owner':
      return 'gold';
    case 'manager':
      return 'success';
    case 'viewer':
    default:
      return 'outline';
  }
}

function getRoleSelectClasses(role: TeamRole): string {
  switch (role) {
    case 'owner':
      return 'border-amber-400/40 bg-amber-400/10 text-brand-text dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300';
    case 'manager':
      return 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'viewer':
    default:
      return 'border-border/80 bg-secondary/60 text-muted-foreground';
  }
}

export function TeamAccessPageContent() {
  const router = useRouter();
  const { user, isHydrated, isSessionVerified } = useUserStore();
  const { data, isPending } = useManagementTeamQuery();
  const addMemberMutation = useAddTeamMemberMutation();
  const updateRoleMutation = useUpdateTeamRoleMutation();
  const removeMemberMutation = useRemoveTeamMemberMutation();

  useEffect(() => {
    if (isHydrated && isSessionVerified && (user?.role !== 'admin' || user?.teamRole !== 'owner')) {
      router.replace('/management');
    }
  }, [isHydrated, isSessionVerified, user?.role, user?.teamRole, router]);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'manager' | 'viewer'>('manager');
  const [newPassword, setNewPassword] = useState('');
  const isAdding = addMemberMutation.isPending;

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMemberRecord | null>(null);

  const members = useMemo(() => data?.members || [], [data?.members]);
  const ownerEmail = data?.ownerEmail || 'admin@humantek.art';
  const currentUserRole: TeamRole =
    data?.currentUserRole || user?.teamRole || 'manager';
  const isOwner = Boolean(data?.canManageTeam || currentUserRole === 'owner');

  const roleCounts = useMemo(() => {
    const counts = { all: members.length, owner: 0, manager: 0, viewer: 0 };
    for (const m of members) {
      if (m.teamRole === 'owner') counts.owner += 1;
      else if (m.teamRole === 'manager') counts.manager += 1;
      else counts.viewer += 1;
    }
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.teamRole !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.teamRole.toLowerCase().includes(q)
      );
    });
  }, [members, roleFilter, searchQuery]);

  // Smart dynamic page-size tiers: only show tiers up to the first tier that fits all records
  const PAGE_SIZE_TIERS = [5, 10, 25, 50] as const;
  const totalCount = filteredMembers.length;
  const maxNeededTier =
    PAGE_SIZE_TIERS.find((t) => t >= Math.max(totalCount, 5)) ??
    PAGE_SIZE_TIERS[PAGE_SIZE_TIERS.length - 1];
  const availablePageSizes = PAGE_SIZE_TIERS.filter((t) => t <= maxNeededTier);
  const effectivePageSize = Math.min(pageSize, maxNeededTier);

  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const activePage = Math.min(page, totalPages);
  const fromIndex = totalCount === 0 ? 0 : (activePage - 1) * effectivePageSize + 1;
  const toIndex = Math.min(activePage * effectivePageSize, totalCount);

  const paginatedMembers = useMemo(() => {
    const start = (activePage - 1) * effectivePageSize;
    return filteredMembers.slice(start, start + effectivePageSize);
  }, [filteredMembers, activePage, effectivePageSize]);

  const resetFilters = () => {
    setRoleFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }
    if (newPassword.trim().length > 0 && newPassword.trim().length < 8) {
      toast.error('Initial password must be at least 8 characters long.');
      return;
    }

    try {
      const json = await addMemberMutation.mutateAsync({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        teamRole: newRole,
        password: newPassword.trim() || undefined,
      });

      toast.success(
        `${json.member?.name || newEmail} added as ${getRoleLabel(newRole)}.`
      );
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('manager');
      setIsGrantModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add team member.');
    }
  };

  const handleRoleChange = async (userId: string, nextRole: TeamRole) => {
    setUpdatingUserId(userId);
    try {
      await updateRoleMutation.mutateAsync({ userId, teamRole: nextRole });
      toast.success(`Role updated to ${getRoleLabel(nextRole)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    const target = memberToRemove;
    setRemovingUserId(target.id);
    try {
      await removeMemberMutation.mutateAsync(target.id);
      toast.success(`Removed management access for ${target.name}.`);
      setMemberToRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove access.');
    } finally {
      setRemovingUserId(null);
    }
  };

  if (isHydrated && isSessionVerified && (user?.role !== 'admin' || user?.teamRole !== 'owner')) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Non-Owner Read-Only Governance Banner (Using shared Alert component) */}
      {!isPending && !isOwner && (
        <Alert variant="info" className="rounded-xl border-border/80 bg-secondary/40 px-4 py-3">
          <Lock className="size-4 text-brand-text dark:text-amber-400" />
          <AlertTitle className="text-xs sm:text-sm font-bold text-foreground">
            Owner approval required
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-0.5">
            Only <span className="font-semibold text-foreground font-mono">{ownerEmail}</span> can
            grant, modify, or revoke studio management access.
          </AlertDescription>
        </Alert>
      )}

      {/* 3. Filter Tabs, Search Toolbar & Owner "Grant Access" Action (Consistent with AdminProjectsTable & LedgerPageContent) */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FilterTabs
              value={roleFilter}
              onValueChange={(val) => {
                setRoleFilter(val as RoleFilter);
                setPage(1);
              }}
              size="sm"
              tabs={[
                { value: 'all', label: 'All Accounts', count: roleCounts.all },
                { value: 'owner', label: 'Owner', count: roleCounts.owner },
                { value: 'manager', label: 'Managers', count: roleCounts.manager },
                { value: 'viewer', label: 'Viewers', count: roleCounts.viewer },
              ]}
            />

            {isOwner && (
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => setIsGrantModalOpen(true)}
                className="h-8 px-3.5 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20 shrink-0"
              >
                <UserPlus className="size-3.5" />
                <span>Grant Access</span>
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-8 text-xs bg-card rounded-lg border-border/80 focus-visible:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
                <b className="text-foreground">{totalCount}</b>
              </span>

              {(searchQuery || roleFilter !== 'all') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Approved Accounts Responsive Table + Mobile Cards */}
        <ResponsiveTableShell>
          {isPending && !data ? (
            <>
              <MobileCardList>
                {[1, 2, 3].map((i) => (
                  <MobileDataCard key={i}>
                    <MobileDataCardHeader>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-3 w-36 rounded-md" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </MobileDataCardHeader>
                  </MobileDataCard>
                ))}
              </MobileCardList>
              <ResponsiveDesktopView className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </ResponsiveDesktopView>
            </>
          ) : filteredMembers.length === 0 ? (
            <Empty className="py-12 border-0">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="bg-amber-400/15 text-brand-text dark:text-amber-400 size-10"
                >
                  <Users className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-bold text-foreground">
                  No matching team accounts
                </EmptyTitle>
                <EmptyDescription className="text-xs text-muted-foreground">
                  {searchQuery
                    ? `No team members matched "${searchQuery}".`
                    : 'No team members found in this role category.'}
                </EmptyDescription>
                {(searchQuery || roleFilter !== 'all') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-2 h-8 text-xs font-semibold cursor-pointer"
                  >
                    Clear Filters
                  </Button>
                )}
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <MobileCardList>
                {paginatedMembers.map((member) => {
                  const isMemberOwner = member.teamRole === 'owner';
                  const isSelf = member.id === user?.id;
                  const isUpdatingThis = updatingUserId === member.id;
                  const isRemovingThis = removingUserId === member.id;
                  const canManageMember = isOwner && !isMemberOwner && !isSelf;

                  return (
                    <MobileDataCard key={member.id}>
                      <MobileDataCardHeader>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {member.name}
                            </span>
                            {isSelf && (
                              <Badge
                                variant="outline"
                                size="xs"
                                className="font-mono uppercase text-3xs bg-secondary/60 text-muted-foreground"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xs text-muted-foreground font-mono truncate">
                            {member.email}
                          </div>
                        </div>

                        <Badge
                          variant={getRoleBadgeVariant(member.teamRole)}
                          size="sm"
                          className="shrink-0"
                        >
                          {getRoleLabel(member.teamRole)}
                        </Badge>
                      </MobileDataCardHeader>

                      <MobileDataCardBody>
                        <div className="text-2xs text-muted-foreground">
                          {member.teamRole === 'owner'
                            ? 'Full studio & team access control'
                            : member.teamRole === 'manager'
                              ? 'Can update projects & issue credits'
                              : 'Read-only management access'}
                        </div>
                      </MobileDataCardBody>

                      <MobileDataCardFooter>
                        <span
                          className="font-mono tabular-nums text-2xs text-muted-foreground flex items-center gap-1"
                          title={formatStudioDate(member.createdAt)}
                        >
                          <Clock className="size-3 text-muted-foreground/70" />
                          {formatStudioRelativeTime(member.createdAt)}
                        </span>

                        {canManageMember && (
                          <MobileDataCardActions>
                            <Select
                              value={member.teamRole}
                              disabled={isUpdatingThis || isRemovingThis}
                              onValueChange={(val) => {
                                if (val === 'manager' || val === 'viewer' || val === 'owner') {
                                  void handleRoleChange(member.id, val);
                                }
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-8 px-2.5 text-xs font-bold rounded-lg border w-28 cursor-pointer',
                                  getRoleSelectClasses(member.teamRole)
                                )}
                              >
                                <SelectValue>{getRoleLabel(member.teamRole)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manager" className="text-xs font-semibold">
                                  Manager
                                </SelectItem>
                                <SelectItem value="viewer" className="text-xs font-semibold">
                                  Viewer
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              loading={isRemovingThis}
                              disabled={isRemovingThis || isUpdatingThis}
                              onClick={() => setMemberToRemove(member)}
                              className="h-8 px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Revoke</span>
                            </Button>
                          </MobileDataCardActions>
                        )}
                      </MobileDataCardFooter>
                    </MobileDataCard>
                  );
                })}
              </MobileCardList>

              {/* Desktop Table View (>= md) */}
              <ResponsiveDesktopView>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                      <TableHead className="py-3 px-4 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Team Member
                      </TableHead>
                      <TableHead className="py-3 px-4 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Email Address
                      </TableHead>
                      <TableHead className="py-3 px-4 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Access Scope
                      </TableHead>
                      <TableHead className="py-3 px-4 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Role
                      </TableHead>
                      <TableHead className="py-3 px-4 text-right text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Added
                      </TableHead>
                      {isOwner && (
                        <TableHead
                          sticky="right"
                          className="py-3 px-4 text-right text-2xs font-bold uppercase tracking-wider text-muted-foreground"
                        >
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMembers.map((member) => {
                      const isMemberOwner = member.teamRole === 'owner';
                      const isSelf = member.id === user?.id;
                      const isUpdatingThis = updatingUserId === member.id;
                      const isRemovingThis = removingUserId === member.id;
                      const canManageMember = isOwner && !isMemberOwner && !isSelf;

                      return (
                        <TableRow
                          key={member.id}
                          className="hover:bg-muted/35 transition-colors"
                        >
                          {/* Team Member Name */}
                          <TableCell className="py-3.5 px-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-foreground truncate max-w-[220px]">
                                {member.name}
                              </span>
                              {isSelf && (
                                <Badge
                                  variant="outline"
                                  size="xs"
                                  className="font-mono uppercase text-3xs bg-secondary/60 text-muted-foreground shrink-0"
                                >
                                  You
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Email */}
                          <TableCell className="py-3.5 px-4">
                            <span className="text-xs font-mono text-muted-foreground">
                              {member.email}
                            </span>
                          </TableCell>

                          {/* Access Scope */}
                          <TableCell className="py-3.5 px-4">
                            <span className="text-xs text-muted-foreground">
                              {member.teamRole === 'owner'
                                ? 'Full control & team governance'
                                : member.teamRole === 'manager'
                                  ? 'Projects, messages & credits'
                                  : 'Read-only console access'}
                            </span>
                          </TableCell>

                          {/* Role Badge */}
                          <TableCell className="py-3.5 px-4">
                            <Badge variant={getRoleBadgeVariant(member.teamRole)} size="sm">
                              {getRoleLabel(member.teamRole)}
                            </Badge>
                          </TableCell>

                          {/* Added Date */}
                          <TableCell
                            className="py-3.5 px-4 text-right text-xs text-muted-foreground font-mono tabular-nums"
                            title={formatStudioDate(member.createdAt)}
                          >
                            {formatStudioDate(member.createdAt)}
                          </TableCell>

                          {/* Owner Controls */}
                          {isOwner && (
                            <TableCell sticky="right" className="py-3.5 px-4 text-right">
                              {canManageMember ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Select
                                    value={member.teamRole}
                                    disabled={isUpdatingThis || isRemovingThis}
                                    onValueChange={(val) => {
                                      if (
                                        val === 'manager' ||
                                        val === 'viewer' ||
                                        val === 'owner'
                                      ) {
                                        void handleRoleChange(member.id, val);
                                      }
                                    }}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        'h-8 px-2.5 text-xs font-bold rounded-lg border w-28 cursor-pointer',
                                        getRoleSelectClasses(member.teamRole)
                                      )}
                                    >
                                      <SelectValue>{getRoleLabel(member.teamRole)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        value="manager"
                                        className="text-xs font-semibold"
                                      >
                                        Manager
                                      </SelectItem>
                                      <SelectItem
                                        value="viewer"
                                        className="text-xs font-semibold"
                                      >
                                        Viewer
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    loading={isRemovingThis}
                                    disabled={isRemovingThis || isUpdatingThis}
                                    onClick={() => setMemberToRemove(member)}
                                    title={`Revoke ${member.name}'s management access`}
                                    aria-label={`Revoke ${member.name}'s management access`}
                                    className="size-8 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-2xs text-muted-foreground/70 font-mono">
                                  {isMemberOwner ? 'Protected' : 'Current session'}
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveDesktopView>

              {/* Reusable Pagination Bar matching Client Projects & Credit History */}
              <TablePaginationBar
                page={activePage}
                totalPages={totalPages}
                pageSize={effectivePageSize}
                pageSizeOptions={availablePageSizes}
                totalCount={totalCount}
                fromIndex={fromIndex}
                toIndex={toIndex}
                isLoading={isPending}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </ResponsiveTableShell>
      </div>

      {/* 5. Grant Management Access Modal (Consistent with LedgerPageContent Issue Credits Dialog) */}
      <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="size-7 rounded-lg bg-amber-400/15 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0">
                <UserPlus className="size-4" />
              </span>
              <span>Grant Management Access</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new team member or promote an existing studio account to Manager or Viewer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="team-member-name"
                className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block"
              >
                Full Name
              </Label>
              <Input
                id="team-member-name"
                type="text"
                placeholder="e.g. Saad Ahmed"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-xs bg-background rounded-lg border-border/80"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="team-member-email"
                className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block"
              >
                Email Address
              </Label>
              <Input
                id="team-member-email"
                type="email"
                required
                placeholder="teammate@humantek.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-9 text-xs bg-background rounded-lg border-border/80"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Access Role
                </Label>
                <Select
                  value={newRole}
                  onValueChange={(val) => {
                    if (val === 'manager' || val === 'viewer') {
                      setNewRole(val);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-border/80 w-full">
                    <SelectValue>{getRoleLabel(newRole)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager" className="text-xs">
                      Manager — Projects & credits
                    </SelectItem>
                    <SelectItem value="viewer" className="text-xs">
                      Viewer — Read-only access
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="team-member-password"
                  className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block"
                >
                  Initial Password (Optional)
                </Label>
                <Input
                  id="team-member-password"
                  type="password"
                  minLength={8}
                  placeholder="Min 8 chars (new accounts)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 text-xs bg-background rounded-lg border-border/80"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsGrantModalOpen(false)}
                className="h-9 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gold"
                size="sm"
                loading={isAdding}
                loadingText="Granting access..."
                className="h-9 px-4 text-xs font-bold gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
              >
                <UserPlus className="size-3.5" />
                <span>Approve Account</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Revoke Access Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open && !removingUserId) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Revoke management access?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will downgrade{' '}
              <span className="font-semibold text-foreground">{memberToRemove?.name}</span> (
              <span className="font-mono">{memberToRemove?.email}</span>) back to a standard client
              account. They will no longer be able to view or access the management console.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              size="sm"
              disabled={Boolean(removingUserId)}
              className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="sm"
              loading={Boolean(removingUserId)}
              loadingText="Revoking..."
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRemoveMember();
              }}
              className="h-8 text-xs font-bold rounded-lg cursor-pointer"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
