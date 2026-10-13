'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Coins, Layers, MessageSquare, Sparkles, ChevronRight } from 'lucide-react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { IconTile } from '@/components/reui/icon-tile';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  useNotificationStore,
  type StudioNotification,
  type NotificationType,
} from '@/lib/notificationStore';
import { useUserStore } from '@/lib/userStore';
import { useChatStore } from '@/lib/chatStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  project_status: Sparkles,
  order_status: Layers,
  payment_confirmed: Coins,
  wallet_credit: Coins,
  chat_message: MessageSquare,
  system_alert: Bell,
};

export default function NotificationsPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const {
    notifications,
    unreadCount,
    isLoading,
    activeFilter,
    setFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Refresh the list when a new notification arrives
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void fetchNotifications()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const handleOpen = (item: StudioNotification) => {
    void markAsRead(item.id);
    if (item.actionId === 'open-chat') {
      useChatStore.getState().setIsOpen(true);
    } else if (item.link) {
      router.push(item.link);
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
              onClick={() => void markAllAsRead()}
              className="self-start sm:self-auto"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </Button>
          )}
        </div>

        <FilterTabs
          value={activeFilter}
          onValueChange={(val) => setFilter(val)}
          size="sm"
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread', count: unreadCount > 0 ? unreadCount : undefined },
          ]}
        />

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
              <EmptyMedia variant="icon">
                <Bell className="size-6 text-muted-foreground" />
              </EmptyMedia>
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
          <Card className="divide-y divide-border/60">
            {notifications.map((item) => {
              const Icon = TYPE_ICONS[item.type] || Bell;
              const isClickable = Boolean(item.link || item.actionId === 'open-chat');

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
                    <p className="text-2xs text-muted-foreground/80 mt-1">{item.time}</p>
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
          </Card>
        )}
      </div>
    </StudioCardLayout>
  );
}
