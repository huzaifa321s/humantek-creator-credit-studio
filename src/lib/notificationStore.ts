'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotificationType =
  | 'project_status'
  | 'payment_confirmed'
  | 'wallet_credit'
  | 'chat_message'
  | 'order_status'
  | 'system_alert';

export type NotificationEntityType = 'project' | 'order' | 'wallet' | 'chat' | 'system';

export type NotificationIconType = 'message' | 'credits' | 'sparkles' | 'check' | 'alert';

export interface StudioNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  actionLabel?: string | null;
  actionId?: string | null;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;

  // Backward-compatibility properties
  description: string;
  time: string;
  iconType: NotificationIconType;
  unread: boolean;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
}

export function getIconTypeForNotification(type: NotificationType): NotificationIconType {
  switch (type) {
    case 'chat_message':
      return 'message';
    case 'wallet_credit':
    case 'payment_confirmed':
      return 'credits';
    case 'project_status':
      return 'sparkles';
    case 'order_status':
      return 'check';
    default:
      return 'alert';
  }
}

/**
 * Strict internal URL sanitizer:
 * Rejects external hosts, double-slashes, protocols/schemes (javascript:, https:), backslashes.
 */
export function sanitizeInternalHref(rawHref: string | null | undefined): string | null {
  if (!rawHref || typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('\\') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Shared role-aware notification link resolver.
 * Enforces role isolation (admins to /management, clients to /projects or /wallet),
 * and deep links directly to projects/drawers.
 */
export function getNotificationHref(
  item: Partial<StudioNotification> | null | undefined,
  role: string = 'client'
): string | null {
  if (!item) return null;

  const isAdmin = role === 'admin';
  const entityType = item.entityType || (item.type === 'chat_message' ? 'chat' : null);
  const rawEntityId =
    item.entityId ||
    (item.actionId && item.actionId !== 'open-chat' ? item.actionId : null);
  const entityId = rawEntityId ? rawEntityId.trim() : null;

  // Chat notifications: admins go to /management/inbox?thread=<id>, clients open chat or /messages?project=<id>
  if (entityType === 'chat' || item.type === 'chat_message') {
    if (isAdmin) {
      return entityId
        ? `/management/inbox?thread=${encodeURIComponent(entityId)}`
        : '/management/inbox';
    }
    if (item.actionId === 'open-chat') {
      return null;
    }
    return entityId
      ? `/messages?project=${encodeURIComponent(entityId)}`
      : '/messages';
  }

  if (item.actionId === 'open-chat') {
    return null;
  }

  // 1. Resolve via Entity Type & Entity ID (First-class canonical routing)
  if (entityType === 'project' && entityId) {
    if (isAdmin) {
      return `/management/projects?project=${encodeURIComponent(entityId)}`;
    }
    return `/projects?project=${encodeURIComponent(entityId)}`;
  }

  if (entityType === 'order' && entityId) {
    if (isAdmin) {
      return `/management/ledger`;
    }
    return `/projects`;
  }

  if (entityType === 'wallet') {
    if (isAdmin) {
      return `/management/ledger`;
    }
    return `/wallet`;
  }

  // 2. Resolve via Raw Link with strict validation and role isolation
  if (item.link) {
    const sanitized = sanitizeInternalHref(item.link);
    if (!sanitized) return null;

    if (isAdmin) {
      // Never send admin to client pages
      if (sanitized.startsWith('/projects/') || sanitized.startsWith('/projects?') || sanitized.startsWith('/messages')) {
        const match = sanitized.match(/\/projects\/([a-zA-Z0-9_-]+)/);
        const isChatLink = sanitized.includes('tab=chat') || sanitized.startsWith('/messages');
        if (match && match[1]) {
          return isChatLink
            ? `/management/inbox?thread=${encodeURIComponent(match[1])}`
            : `/management/projects?project=${encodeURIComponent(match[1])}`;
        }
        try {
          const u = new URL(sanitized, 'http://localhost');
          const pId = u.searchParams.get('project') || u.searchParams.get('thread');
          if (pId) {
            return isChatLink
              ? `/management/inbox?thread=${encodeURIComponent(pId)}`
              : `/management/projects?project=${encodeURIComponent(pId)}`;
          }
        } catch {}
        return isChatLink ? '/management/inbox' : '/management/projects';
      }
      if (sanitized.startsWith('/wallet') || sanitized.startsWith('/billing') || sanitized.includes('tab=credits') || sanitized.startsWith('/management/orders')) {
        return '/management/ledger';
      }
      if (sanitized.startsWith('/management')) {
        try {
          const u = new URL(sanitized, 'http://localhost');
          const tab = u.searchParams.get('tab');
          const id = u.searchParams.get('id') || u.searchParams.get('project') || u.searchParams.get('thread');
          const subtab = u.searchParams.get('subtab');
          if (subtab === 'chat' || tab === 'messages') {
            return id ? `/management/inbox?thread=${encodeURIComponent(id)}` : '/management/inbox';
          }
          if (tab === 'projects') {
            return id ? `/management/projects?project=${encodeURIComponent(id)}` : '/management/projects';
          }
          if (tab === 'orders' || tab === 'wire-orders' || tab === 'ledger' || tab === 'credits') {
            return '/management/ledger';
          }
        } catch {}
        return sanitized;
      }
      return '/management';
    } else {
      // Client role: never send client to admin console
      if (sanitized.startsWith('/management') || sanitized.startsWith('/admin')) {
        return entityId ? `/projects?project=${encodeURIComponent(entityId)}` : '/projects';
      }

      if (sanitized.startsWith('/wallet') || sanitized.startsWith('/billing')) {
        return '/wallet';
      }

      // Convert legacy /projects/<id> directly to /messages?project=<id> (if chat) or /projects?project=<id>
      const match = sanitized.match(/^\/projects\/([a-zA-Z0-9_-]+)(.*)$/);
      if (match && match[1]) {
        const id = match[1];
        const rest = match[2] || '';
        if (rest.includes('tab=chat')) {
          return `/messages?project=${encodeURIComponent(id)}`;
        }
        return `/projects?project=${encodeURIComponent(id)}`;
      }

      return sanitized;
    }
  }

  return null;
}

export function transformApiNotification(raw: any): StudioNotification {
  const isRead = Boolean(raw.is_read ?? raw.isRead);
  const type: NotificationType = raw.type || 'system_alert';
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();
  const rawMessage = raw.message || raw.description || '';
  const message =
    rawMessage && /final files.*ready to download/i.test(rawMessage)
      ? 'Your project has been marked as completed.'
      : rawMessage;
  const rawActionLabel = raw.action_label || raw.actionLabel || null;
  const actionLabel =
    rawActionLabel && /download\s*files/i.test(rawActionLabel)
      ? 'View Project'
      : rawActionLabel;

  return {
    id: String(raw.id),
    type,
    title: raw.title || '',
    message,
    link: raw.link || null,
    actionLabel,
    actionId: raw.action_id || raw.actionId || null,
    entityType: raw.entity_type || raw.entityType || null,
    entityId: raw.entity_id || raw.entityId || null,
    isRead,
    createdAt,
    description: message,
    time: formatTimeAgo(createdAt),
    iconType: getIconTypeForNotification(type),
    unread: !isRead,
  };
}

interface NotificationStoreState {
  notifications: StudioNotification[];
  unreadCount: number;
  isLoading: boolean;
  activeFilter: string;
  setFilter: (filter: string) => void;
  fetchNotifications: (filterOverride?: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearRead: () => Promise<void>;
  clearAll: () => void;
  addNotification: (
    item: Partial<StudioNotification> & {
      title: string;
      description?: string;
      message?: string;
      iconType?: NotificationIconType;
      link?: string;
      actionId?: string;
    }
  ) => void;
}

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      activeFilter: 'all',

      setFilter: (filter: string) => {
        set({ activeFilter: filter });
        void get().fetchNotifications(filter);
      },

      fetchNotifications: async (filterOverride?: string) => {
        const filter = filterOverride ?? get().activeFilter;
        set({ isLoading: true });

        try {
          const res = await fetch(`/api/notifications?filter=${encodeURIComponent(filter)}&limit=50`, {
            cache: 'no-store',
          });

          if (!res.ok) {
            set({ isLoading: false });
            return;
          }

          const data = await res.json();
          if (data && data.ok) {
            const rawList = Array.isArray(data.notifications) ? data.notifications : [];
            const mapped = rawList.map(transformApiNotification);
            set({
              notifications: mapped,
              unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : mapped.filter((n: StudioNotification) => !n.isRead).length,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      markAsRead: async (id: string) => {
        const target = get().notifications.find((n) => n.id === id);
        if (!target || target.isRead) return;

        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, unread: false } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));

        try {
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_read: true }),
          });
        } catch (err) {
          console.warn('[NotificationStore] Failed to mark as read:', err);
        }
      },

      markAllAsRead: async () => {
        if (get().unreadCount === 0) return;

        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            isRead: true,
            unread: false,
          })),
          unreadCount: 0,
        }));

        try {
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mark_all_read: true }),
          });
        } catch (err) {
          console.warn('[NotificationStore] Failed to mark all as read:', err);
        }
      },

      deleteNotification: async (id: string) => {
        const target = get().notifications.find((n) => n.id === id);
        if (!target) return;

        // Optimistic update
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        }));

        try {
          await fetch('/api/notifications', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
        } catch (err) {
          console.warn('[NotificationStore] Failed to delete notification:', err);
        }
      },

      clearRead: async () => {
        // Optimistic update
        set((state) => ({
          notifications: state.notifications.filter((n) => !n.isRead),
        }));

        try {
          await fetch('/api/notifications', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clear_read: true }),
          });
        } catch (err) {
          console.warn('[NotificationStore] Failed to clear read notifications:', err);
        }
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      addNotification: (item) =>
        set((state) => {
          const id = item.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const msg = item.message || item.description || '';
          const type: NotificationType =
            item.type ||
            (item.iconType === 'credits'
              ? 'wallet_credit'
              : item.iconType === 'message'
              ? 'chat_message'
              : 'system_alert');

          const newNotif: StudioNotification = {
            id,
            type,
            title: item.title,
            message: msg,
            link: item.link || null,
            actionLabel: item.actionLabel || null,
            actionId: item.actionId || null,
            isRead: false,
            createdAt: item.createdAt || new Date().toISOString(),
            description: msg,
            time: item.time || 'Just now',
            iconType: item.iconType || getIconTypeForNotification(type),
            unread: true,
          };

          return {
            notifications: [newNotif, ...state.notifications].slice(0, 50),
            unreadCount: state.unreadCount + 1,
          };
        }),
    }),
    {
      name: 'humantek_studio_notifications',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      skipHydration: true,
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 30),
        unreadCount: state.unreadCount,
      }),
    }
  )
);
