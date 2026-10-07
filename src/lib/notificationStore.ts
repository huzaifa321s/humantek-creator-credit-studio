'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotificationIconType = 'message' | 'credits' | 'sparkles' | 'check' | 'alert';

export interface StudioNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  iconType: NotificationIconType;
  unread: boolean;
  link?: string;
  actionId?: 'open-chat' | 'open-projects' | 'open-wallet' | string;
}

export const INITIAL_NOTIFICATIONS: StudioNotification[] = [
  {
    id: 'notif-1',
    title: 'Creative Team Active',
    description: 'Our team is on standby for realtime project feedback and updates.',
    time: 'Just now',
    iconType: 'message',
    unread: true,
    actionId: 'open-chat',
  },
  {
    id: 'notif-2',
    title: 'Credit balance ready',
    description: 'Balance is verified and ready to allocate across media production deliverables.',
    time: '1h ago',
    iconType: 'credits',
    unread: true,
    link: '/redeem-code',
  },
  {
    id: 'notif-3',
    title: 'Design System Upgraded',
    description: 'Executive dark header navigation and compact workspace active.',
    time: '2h ago',
    iconType: 'sparkles',
    unread: false,
    link: '/projects',
  },
];

interface NotificationStoreState {
  notifications: StudioNotification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (
    item: Omit<StudioNotification, 'id' | 'unread' | 'time'> & { id?: string; time?: string }
  ) => void;
}

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,

      markAsRead: (id: string) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, unread: false })),
        })),

      clearAll: () =>
        set({
          notifications: [],
        }),

      addNotification: (item) =>
        set((state) => {
          const newNotif: StudioNotification = {
            ...item,
            time: item.time || 'Just now',
            id: item.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            unread: true,
          };
          // Keep newest first, max 20 notifications
          return {
            notifications: [newNotif, ...state.notifications].slice(0, 20),
          };
        }),
    }),
    {
      name: 'humantek_studio_notifications',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
