'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Coins,
  ChevronRight,
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
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  unread: boolean;
  link?: string;
}

export function DashboardNotificationDropdown() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Dedicated Producer Active',
      description: 'Your lead creative director is on standby for realtime brief feedback.',
      time: 'Just now',
      icon: MessageSquare,
      unread: true,
      link: '/projects',
    },
    {
      id: 'notif-2',
      title: 'Studio Credits Ready',
      description: 'Balance is verified and ready to allocate across media production deliverables.',
      time: '1h ago',
      icon: Coins,
      unread: true,
      link: '/redeem-code',
    },
    {
      id: 'notif-3',
      title: 'Design System Upgraded',
      description: 'Executive dark header navigation and compact workspace active.',
      time: '2h ago',
      icon: Sparkles,
      unread: false,
      link: '/projects',
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleItemClick = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    if (item.link) {
      router.push(item.link);
    }
  };

  return (
    <DropdownMenu>
      {/* =================================================================== */}
      {/* Trigger: Reusable Button with Pulse Indicator Dot                   */}
      {/* =================================================================== */}
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
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-zinc-950 animate-pulse" />
        )}
      </DropdownMenuTrigger>

      {/* =================================================================== */}
      {/* Content: Compact Shadcn DropdownMenu aligned to Design System       */}
      {/* =================================================================== */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="dark w-72 sm:w-80 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 p-1 shadow-xl ring-1 ring-white/10"
      >
        {/* Header Row: Title & Mark All Read */}
        <div className="flex items-center justify-between px-2.5 py-1.5 select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="gold" size="xs" className="font-bold border border-amber-500/30">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={markAllAsRead}
              className="h-6 px-1.5 text-2xs font-medium text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-colors gap-1"
            >
              <CheckCircle2 className="size-3" />
              <span>Mark all read</span>
            </Button>
          )}
        </div>

        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* List of Notification Items or Empty State */}
        {notifications.length === 0 ? (
          <Empty className="py-6 px-4">
            <EmptyMedia>
              <Bell className="size-6 text-zinc-500" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-xs text-zinc-200">No notifications</EmptyTitle>
              <EmptyDescription className="text-2xs text-zinc-400">
                You are all caught up with your studio activities.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DropdownMenuGroup className="space-y-0.5">
            {notifications.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="group flex items-start gap-2.5 rounded-lg p-2 text-xs cursor-pointer transition-colors hover:bg-white/5 focus-visible:bg-white/5 outline-none w-full"
                >
                  <IconTile
                    variant={item.unread ? 'soft' : 'outline'}
                    size="xs"
                    radius="default"
                    className={cn(
                      'shrink-0 mt-0.5',
                      item.unread
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-zinc-400 border-white/10 bg-white/5'
                    )}
                  >
                    <Icon className="size-3.5" />
                  </IconTile>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'text-xs truncate',
                          item.unread ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-300'
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="text-3xs text-zinc-400 shrink-0">{item.time}</span>
                    </div>
                    <p className="text-2xs text-zinc-400 line-clamp-1 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  {item.unread && (
                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Footer: View All Projects Activity */}
        <DropdownMenuItem
          render={
            <Link
              href="/projects"
              className="group flex h-8 items-center justify-between rounded-lg px-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <span>View All Activity</span>
              <ChevronRight className="size-3.5 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
