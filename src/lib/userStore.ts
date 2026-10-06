'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface StudioUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  walletBalance: number;
  channelName?: string;
  platform?: string;
  role?: string;
}

export const DEFAULT_CLIENT_USER: StudioUser = {
  id: 'user-client-kira',
  name: 'Kira Streams',
  email: 'kira@example.com',
  avatarInitials: 'KS',
  walletBalance: 80,
  channelName: 'KiraOfficial',
  platform: 'Twitch',
};

interface UserStoreState {
  user: StudioUser;
  updateUser: (patch: Partial<StudioUser>) => void;
  signOut: () => void;
  signInAsClient: (name?: string, email?: string) => void;
  addCredits: (amount: number, description?: string) => void;
  deductCredits: (amount: number, description?: string) => boolean;
  hasSufficientBalance: (amount: number) => boolean;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      user: DEFAULT_CLIENT_USER,
      updateUser: (patch) =>
        set((state) => {
          const updated = { ...state.user, ...patch };
          if (patch.name && !patch.avatarInitials) {
            const parts = patch.name.trim().split(/\s+/);
            updated.avatarInitials = parts.length > 1
              ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
              : patch.name.slice(0, 2).toUpperCase();
          }
          return { user: updated };
        }),
      signOut: () =>
        set({
          user: {
            id: 'client-guest',
            name: '',
            email: '',
            avatarInitials: 'GU',
            walletBalance: 0,
          },
        }),
      signInAsClient: (name = 'Kira Streams', email = 'kira@example.com') =>
        set({
          user: {
            ...DEFAULT_CLIENT_USER,
            name,
            email,
          },
        }),
      addCredits: (amount: number, _description?: string) => {
        void _description;
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return;
        set((state) => ({
          user: {
            ...state.user,
            walletBalance: (state.user.walletBalance || 0) + amount,
          },
        }));
      },
      deductCredits: (amount: number, _description?: string) => {
        void _description;
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return true;
        const currentBalance = get().user.walletBalance || 0;
        if (currentBalance < amount) return false;
        set((state) => ({
          user: {
            ...state.user,
            walletBalance: Math.max(0, (state.user.walletBalance || 0) - amount),
          },
        }));
        return true;
      },
      hasSufficientBalance: (amount: number) => {
        return (get().user.walletBalance || 0) >= amount;
      },
    }),
    {
      name: 'humantek_studio_user',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Cross-tab broadcast synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'humantek_studio_user' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed?.state?.user) {
          useUserStore.setState({ user: parsed.state.user });
        }
      } catch {
        // Ignore parse errors from other storage events
      }
    }
  });
}
