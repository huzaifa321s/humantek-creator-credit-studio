'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Coins,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/reui/icon-tile';
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  useNotificationStore,
  getNotificationHref,
  type StudioNotification,
  type NotificationType,
} from '@/lib/notificationStore';
import { useUserStore } from '@/lib/userStore';
import { createClient } from '@/lib/supabase/client';
import { useChatStore } from '@/lib/chatStore';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  project_status: Sparkles,
  order_status: Layers,
  payment_confirmed: Coins,
  wallet_credit: Coins,
  chat_message: MessageSquare,
  system_alert: Bell,
};

export function DashboardNotificationDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const topLoader = useTopLoader();
  const { isMobile, setOpenMobile } = useSidebar();
  const user = useUserStore((s) => s.user);
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } =
    useNotificationStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    void fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription to new notifications
  useEffect(() => {
    if (!user?.id) return;

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`realtime-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('[RealtimeNotifications] Failed to connect:', err);
    }
  }, [user?.id, fetchNotifications]);

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    void markAllAsRead();
  };

  const handleItemClick = (item: StudioNotification) => {
    void markAsRead(item.id);
    if (isMobile) {
      setOpenMobile(false);
    }
    const isClientRole = (user?.role || 'client') !== 'admin';
    if (isClientRole && (item.actionId === 'open-chat' || item.type === 'chat_message' || item.entityType === 'chat')) {
      const targetChatId =
        item.entityId ||
        (item.actionId && item.actionId !== 'open-chat' ? item.actionId : undefined);
      if (pathname === '/messages') {
        if (targetChatId) {
          useChatStore.getState().setActiveProjectId(targetChatId);
        }
      } else {
        useChatStore.getState().setIsOpen(true, targetChatId || undefined);
      }
      return;
    }
    const href = getNotificationHref(item, user?.role || 'client') || '/notifications';
    if (href.split('?')[0] !== pathname) {
      topLoader.start();
    }
    router.push(href);
  };

  return (
    <DropdownMenu>
      {/* Trigger: Reusable Button with Pulse Indicator Dot */}
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            className="group relative size-8 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors select-none"
          />
        }
      >
        <Bell className="size-4 text-zinc-300 group-hover:text-white transition-colors" />
        {mounted && unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-zinc-950 animate-pulse shadow-xs shadow-amber-400/50" />
        )}
      </DropdownMenuTrigger>

      {/* Content: Compact Shadcn DropdownMenu aligned to Executive Studio Design System */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="dark w-76 sm:w-88 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 p-1.5 shadow-xl ring-1 ring-white/10 flex flex-col"
      >
        {/* Header Row: Title & Mark All Read */}
        <div className="flex items-center justify-between px-2 py-1.5 select-none shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">Notifications</span>
            {mounted && unreadCount > 0 && (
              <Badge
                variant="gold"
                size="xs"
                className="font-bold border border-amber-400/30 font-mono tabular-nums"
              >
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleMarkAll}
              className="h-6 px-2 text-2xs font-semibold text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-colors gap-1"
            >
              <CheckCircle2 className="size-3 text-amber-400" />
              <span>Mark all read</span>
            </Button>
          )}
        </div>

        <DropdownMenuSeparator className="my-1 h-px bg-white/10 shrink-0" />

        {/* List of Notification Items or Empty State */}
        {notifications.length === 0 ? (
          <Empty className="py-8 px-4 shrink-0">
            <EmptyMedia>
              <Bell className="size-6 text-zinc-500" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-xs font-semibold text-zinc-200">No notifications</EmptyTitle>
              <EmptyDescription className="text-2xs text-zinc-400">
                You are all caught up with your studio activities.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto overscroll-contain scrollbar-thin [scrollbar-gutter:stable]">
            <DropdownMenuGroup className="space-y-0.5">
              {notifications.slice(0, 10).map((item) => {
                const Icon = TYPE_ICONS[item.type] || Bell;

                return (
                  <DropdownMenuItem
                    key={item.id}
                    data-chat-entry={item.actionId === 'open-chat' ? 'notification-chat' : undefined}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-start gap-2.5 rounded-lg p-2 text-xs cursor-pointer transition-colors hover:bg-white/5 focus-visible:bg-white/5 outline-none w-full"
                  >
                    <IconTile
                      variant="outline"
                      size="xs"
                      className={cn(
                        'shrink-0 mt-0.5 border-white/10 bg-white/5',
                        !item.isRead ? 'text-amber-400' : 'text-zinc-400'
                      )}
                    >
                      <Icon className="size-3.5" />
                    </IconTile>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-xs truncate',
                            !item.isRead ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-300'
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-2xs text-zinc-500 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-2xs text-zinc-400 line-clamp-1 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                    {!item.isRead && (
                      <span className="size-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        )}

        <DropdownMenuSeparator className="my-1 h-px bg-white/10 shrink-0" />

        {/* Footer: View All Notifications Page */}
        <DropdownMenuItem
          className="shrink-0 p-0"
          render={
            <Link
              href="/notifications"
              className="group flex h-8 items-center justify-between rounded-lg px-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <span>View All Notifications</span>
              <ChevronRight className="size-3.5 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
