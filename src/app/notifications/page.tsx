'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Coins, FolderKanban, Layers, MessageSquare, ChevronRight } from 'lucide-react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { TablePaginationBar } from '@/components/ui/table';
import { IconTile } from '@/components/reui/icon-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { Illustration } from '@/components/ui/illustration';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  useNotificationStore,
  getNotificationHref,
  type StudioNotification,
  type NotificationType,
} from '@/lib/notificationStore';
import {
  notificationKeys,
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/lib/queries/notifications';
import { useUserStore } from '@/lib/userStore';
import { useChatStore } from '@/lib/chatStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const PAGE_SIZE_TIERS = [5, 10, 25, 50] as const;

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  project_status: FolderKanban,
  order_status: Layers,
  payment_confirmed: Coins,
  wallet_credit: Coins,
  chat_message: MessageSquare,
  system_alert: Bell,
};

export default function NotificationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const topLoader = useTopLoader();
  const queryClient = useQueryClient();
  const user = useUserStore((s) => s.user);
  const { activeFilter, setFilter } = useNotificationStore();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const notificationsQuery = useNotificationsQuery(activeFilter);
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const isLoading = notificationsQuery.isPending;

  // Smart dynamic page-size tiers matching all other studio tables
  const maxNeededTier =
    PAGE_SIZE_TIERS.find((t) => t >= Math.max(notifications.length, 5)) ??
    PAGE_SIZE_TIERS[PAGE_SIZE_TIERS.length - 1];
  const availablePageSizes = PAGE_SIZE_TIERS.filter((t) => t <= maxNeededTier);
  const effectivePageSize = Math.min(pageSize, maxNeededTier);

  const totalCount = notifications.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * effectivePageSize;
  const fromIndex = totalCount === 0 ? 0 : startIndex + 1;
  const toIndex = Math.min(startIndex + effectivePageSize, totalCount);
  const pagedNotifications = notifications.slice(startIndex, startIndex + effectivePageSize);

  // Refresh the list when a new notification arrives via Realtime
  useEffect(() => {
    if (!user?.id) return;
    let activeChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    let supabaseClient: ReturnType<typeof createClient> | null = null;

    const connectTimer = setTimeout(() => {
      supabaseClient = createClient();
      activeChannel = supabaseClient
        .channel(`notifications-page-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        )
        .subscribe();
    }, 50);

    return () => {
      clearTimeout(connectTimer);
      if (activeChannel && supabaseClient) {
        void supabaseClient.removeChannel(activeChannel);
      }
    };
  }, [user?.id, queryClient]);

  const handleOpen = (item: StudioNotification) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    const isClientRole = (user?.role || 'client') !== 'admin';
    if (isClientRole && (item.actionId === 'open-chat' || item.type === 'chat_message' || item.entityType === 'chat')) {
      const targetChatId =
        item.entityId ||
        (item.actionId && item.actionId !== 'open-chat' ? item.actionId : undefined);
      useChatStore.getState().setIsOpen(true, targetChatId || undefined);
      return;
    }
    const href = getNotificationHref(item, user?.role || 'client');
    if (href) {
      if (href.split('?')[0] !== pathname) {
        topLoader.start();
      }
      router.push(href);
    }
  };

  return (
    <StudioCardLayout mode="standalone" backLabel="Back to Studio">
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Header — same pattern as My Projects */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Notifications
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Updates about your projects, payments, and messages.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="self-start sm:self-auto"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <FilterTabs
            value={activeFilter}
            onValueChange={(val) => {
              setFilter(val);
              setCurrentPage(1);
            }}
            size="sm"
            className="w-auto"
            tabs={[
              { value: 'all', label: 'All', count: activeFilter === 'all' && totalCount > 0 ? totalCount : undefined },
              { value: 'unread', label: 'Unread', count: unreadCount > 0 ? unreadCount : undefined },
            ]}
          />

          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
              Showing <b className="text-foreground">{fromIndex}–{toIndex}</b> of{' '}
              <b className="text-foreground">{totalCount}</b>
            </span>
          )}
        </div>

        {isLoading && notifications.length === 0 ? (
          <Card className="divide-y divide-border/60">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </Card>
        ) : notifications.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <Illustration name="empty-notifications" size={96} />
              <EmptyTitle className="text-xl font-bold text-foreground">
                {activeFilter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                {activeFilter === 'unread'
                  ? 'You have no unread notifications.'
                  : 'When something important happens, you will see it here.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="overflow-hidden border-border/80 shadow-2xs">
            <div className="divide-y divide-border/60">
              {pagedNotifications.map((item) => {
                const Icon = TYPE_ICONS[item.type] || Bell;
                const href = getNotificationHref(item, user?.role || 'client');
                const isClickable = Boolean(href || item.actionId === 'open-chat');

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpen(item)}
                    className={cn(
                      'group w-full flex items-start gap-3 p-4 text-left transition-colors cursor-pointer',
                      'hover:bg-muted/40 focus-visible:outline-hidden focus-visible:bg-muted/40',
                      !item.isRead && 'bg-amber-400/[0.04]'
                    )}
                  >
                    <IconTile
                      variant="outline"
                      size="sm"
                      className={cn(
                        'shrink-0',
                        !item.isRead ? 'text-brand-text dark:text-amber-400' : 'text-muted-foreground'
                      )}
                    >
                      <Icon />
                    </IconTile>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            'text-sm truncate',
                            !item.isRead ? 'font-bold text-foreground' : 'font-medium text-foreground/80'
                          )}
                        >
                          {item.title}
                        </p>
                        {!item.isRead && <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-2xs text-muted-foreground/80">{item.time}</p>
                        {isClickable && (
                          <span className="inline-flex sm:hidden items-center gap-0.5 text-xs font-semibold text-brand-text dark:text-amber-400 shrink-0">
                            {item.actionLabel || 'View'}
                            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {isClickable && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-text dark:text-amber-400 shrink-0 self-center">
                        {item.actionLabel || 'View'}
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <TablePaginationBar
              page={activePage}
              totalPages={totalPages}
              pageSize={effectivePageSize}
              pageSizeOptions={availablePageSizes}
              totalCount={totalCount}
              fromIndex={fromIndex}
              toIndex={toIndex}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </Card>
        )}
      </div>
    </StudioCardLayout>
  );
}
