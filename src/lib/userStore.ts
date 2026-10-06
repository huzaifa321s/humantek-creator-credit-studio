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
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
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
            name: 'Client',
            email: 'client@creator.studio',
            avatarInitials: 'CL',
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
    }),
    {
      name: 'humantek_studio_user',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
