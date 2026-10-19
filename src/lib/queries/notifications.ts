'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  useNotificationStore,
  transformApiNotification,
  type StudioNotification,
} from '@/lib/notificationStore';
import { useUserStore } from '@/lib/userStore';
import { ApiError } from '@/components/Providers';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filter: string = 'all') => [...notificationKeys.all, filter] as const,
};

export interface NotificationsQueryData {
  notifications: StudioNotification[];
  unreadCount: number;
}

/**
 * Deduplicated TanStack Query hook for notifications.
 * Automatically synchronizes with `useNotificationStore` so sidebar badges,
 * header dropdowns, and `/notifications` stay in lockstep with zero duplicate requests.
 */
export function useNotificationsQuery(filter: string = 'all') {
  const isSignedIn = useUserStore((s) => Boolean(s.user?.email && s.isSessionVerified));

  const query = useQuery<NotificationsQueryData, ApiError>({
    queryKey: notificationKeys.list(filter),
    enabled: isSignedIn,
    placeholderData: () => {
      const storeState = useNotificationStore.getState();
      if (storeState.notifications.length > 0) {
        const items =
          filter === 'unread'
            ? storeState.notifications.filter((n) => !n.isRead)
            : storeState.notifications;
        return {
          notifications: items,
          unreadCount: storeState.unreadCount,
        };
      }
      return undefined;
    },
    queryFn: async ({ signal }): Promise<NotificationsQueryData> => {
      const res = await fetch(
        `/api/notifications?filter=${encodeURIComponent(filter)}&limit=100`,
        { signal, cache: 'no-store' }
      );
      if (res.status === 401 || res.status === 403) {
        return { notifications: [], unreadCount: 0 };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          (data as { error?: string }).error || `Notifications request failed (${res.status})`,
          res.status
        );
      }
      const rawList = Array.isArray((data as { notifications?: unknown[] }).notifications)
        ? ((data as { notifications: unknown[] }).notifications)
        : [];
      const mapped = rawList.map(transformApiNotification);
      const unreadCount =
        typeof (data as { unreadCount?: number }).unreadCount === 'number'
          ? (data as { unreadCount: number }).unreadCount
          : mapped.filter((n) => !n.isRead).length;

      return { notifications: mapped, unreadCount };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Synchronize fresh server data into useNotificationStore so sidebar badges (`StudioCardLayout`)
  // and persisted state stay up-to-date.
  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;
    const { notifications, unreadCount } = query.data;
    const store = useNotificationStore.getState();
    // Only overwrite full store list when viewing 'all', or update unreadCount + merge items
    if (filter === 'all') {
      useNotificationStore.setState({
        notifications,
        unreadCount,
        isLoading: false,
      });
    } else if (store.unreadCount !== unreadCount) {
      useNotificationStore.setState({
        unreadCount,
        isLoading: false,
      });
    }
  }, [query.data, query.isPlaceholderData, filter]);

  return query;
}

/**
 * Optimistically mark a single notification as read across all cached notification lists
 * and `useNotificationStore`, with automatic rollback on failure.
 */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_read: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          (data as { error?: string }).error || 'Failed to mark notification as read',
          res.status
        );
      }
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousEntries = queryClient.getQueriesData<NotificationsQueryData>({
        queryKey: notificationKeys.all,
      });

      // Update Zustand store optimistically
      const storeSnapshot = {
        notifications: useNotificationStore.getState().notifications,
        unreadCount: useNotificationStore.getState().unreadCount,
      };
      const targetInStore = storeSnapshot.notifications.find((n) => n.id === id);
      if (targetInStore && !targetInStore.isRead) {
        useNotificationStore.setState({
          notifications: storeSnapshot.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, unread: false } : n
          ),
          unreadCount: Math.max(0, storeSnapshot.unreadCount - 1),
        });
      }

      // Update all active TanStack Query notification caches
      queryClient.setQueriesData<NotificationsQueryData>(
        { queryKey: notificationKeys.all },
        (old) => {
          if (!old) return old;
          const target = old.notifications.find((n) => n.id === id);
          const wasUnread = Boolean(target && !target.isRead);
          return {
            notifications: old.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true, unread: false } : n
            ),
            unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
          };
        }
      );

      return { previousEntries, storeSnapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries as Array<
          [QueryKey, NotificationsQueryData | undefined]
        >) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.storeSnapshot) {
        useNotificationStore.setState(context.storeSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Optimistically mark all notifications as read across all cached notification lists
 * and `useNotificationStore`, with automatic rollback on failure.
 */
export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          (data as { error?: string }).error || 'Failed to mark all notifications as read',
          res.status
        );
      }
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousEntries = queryClient.getQueriesData<NotificationsQueryData>({
        queryKey: notificationKeys.all,
      });

      const storeSnapshot = {
        notifications: useNotificationStore.getState().notifications,
        unreadCount: useNotificationStore.getState().unreadCount,
      };

      useNotificationStore.setState({
        notifications: storeSnapshot.notifications.map((n) => ({
          ...n,
          isRead: true,
          unread: false,
        })),
        unreadCount: 0,
      });

      queryClient.setQueriesData<NotificationsQueryData>(
        { queryKey: notificationKeys.all },
        (old) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) => ({
              ...n,
              isRead: true,
              unread: false,
            })),
            unreadCount: 0,
          };
        }
      );

      return { previousEntries, storeSnapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries as Array<
          [QueryKey, NotificationsQueryData | undefined]
        >) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.storeSnapshot) {
        useNotificationStore.setState(context.storeSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Optimistically delete a single notification.
 */
export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          (data as { error?: string }).error || 'Failed to delete notification',
          res.status
        );
      }
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousEntries = queryClient.getQueriesData<NotificationsQueryData>({
        queryKey: notificationKeys.all,
      });

      const storeSnapshot = {
        notifications: useNotificationStore.getState().notifications,
        unreadCount: useNotificationStore.getState().unreadCount,
      };
      const target = storeSnapshot.notifications.find((n) => n.id === id);
      useNotificationStore.setState({
        notifications: storeSnapshot.notifications.filter((n) => n.id !== id),
        unreadCount:
          target && !target.isRead
            ? Math.max(0, storeSnapshot.unreadCount - 1)
            : storeSnapshot.unreadCount,
      });

      queryClient.setQueriesData<NotificationsQueryData>(
        { queryKey: notificationKeys.all },
        (old) => {
          if (!old) return old;
          const item = old.notifications.find((n) => n.id === id);
          return {
            notifications: old.notifications.filter((n) => n.id !== id),
            unreadCount:
              item && !item.isRead ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
          };
        }
      );

      return { previousEntries, storeSnapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries as Array<
          [QueryKey, NotificationsQueryData | undefined]
        >) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.storeSnapshot) {
        useNotificationStore.setState(context.storeSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Optimistically clear all read notifications.
 */
export function useClearReadNotificationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_read: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
          (data as { error?: string }).error || 'Failed to clear read notifications',
          res.status
        );
      }
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousEntries = queryClient.getQueriesData<NotificationsQueryData>({
        queryKey: notificationKeys.all,
      });

      const storeSnapshot = {
        notifications: useNotificationStore.getState().notifications,
        unreadCount: useNotificationStore.getState().unreadCount,
      };
      useNotificationStore.setState({
        notifications: storeSnapshot.notifications.filter((n) => !n.isRead),
      });

      queryClient.setQueriesData<NotificationsQueryData>(
        { queryKey: notificationKeys.all },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications.filter((n) => !n.isRead),
          };
        }
      );

      return { previousEntries, storeSnapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries as Array<
          [QueryKey, NotificationsQueryData | undefined]
        >) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.storeSnapshot) {
        useNotificationStore.setState(context.storeSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
