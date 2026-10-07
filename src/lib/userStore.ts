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

interface UserStoreState {
  user: StudioUser | null;
  isHydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  updateUser: (patch: Partial<StudioUser>) => void;
  signOut: () => void;
  signInAsClient: (
    name?: string,
    email?: string,
    walletBalance?: number,
    id?: string,
    role?: string
  ) => void;
  addCredits: (amount: number, description?: string) => void;
  deductCredits: (amount: number, description?: string) => boolean;
  hasSufficientBalance: (amount: number) => boolean;
}

function computeInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.includes('@')) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'CR';
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      isHydrated: false,
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      updateUser: (patch) =>
        set((state) => {
          if (!state.user) return state;
          const updated: StudioUser = { ...state.user, ...patch };
          if (patch.name && !patch.avatarInitials) {
            updated.avatarInitials = computeInitials(patch.name, updated.email);
          }
          return { user: updated };
        }),
      signOut: () =>
        set({
          user: null,
        }),
      signInAsClient: (
        name = 'Creator',
        email = '',
        walletBalance = 0,
        id = `user-${Date.now()}`,
        role = 'client'
      ) =>
        set({
          user: {
            id,
            name,
            email,
            avatarInitials: computeInitials(name, email),
            walletBalance: typeof walletBalance === 'number' ? walletBalance : 0,
            role,
          },
        }),
      addCredits: (amount: number, _description?: string) => {
        void _description;
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return;
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              walletBalance: (state.user.walletBalance || 0) + amount,
            },
          };
        });
      },
      deductCredits: (amount: number, _description?: string) => {
        void _description;
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return true;
        const currentUser = get().user;
        if (!currentUser) return false;
        if ((currentUser.walletBalance || 0) < amount) return false;
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                walletBalance: Math.max(0, (state.user.walletBalance || 0) - amount),
              }
            : null,
        }));
        return true;
      },
      hasSufficientBalance: (amount: number) => {
        const currentUser = get().user;
        return Boolean(currentUser && (currentUser.walletBalance || 0) >= amount);
      },
    }),
    {
      name: 'humantek_studio_user',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Purge any stale client-guest from previous dev sessions
          if (state.user && (state.user.id === 'client-guest' || !state.user.email)) {
            state.user = null;
          }
          state.setHydrated(true);
        }
      },
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
          if (parsed.state.user.id === 'client-guest' || !parsed.state.user.email) {
            useUserStore.setState({ user: null });
          } else {
            useUserStore.setState({ user: parsed.state.user });
          }
        } else {
          useUserStore.setState({ user: null });
        }
      } catch {
        // Ignore parse errors from other storage events
      }
    }
  });
}
