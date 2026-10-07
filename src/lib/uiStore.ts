'use client';

import { create } from 'zustand';

interface UIStoreState {
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;

  isScopeGuideOpen: boolean;
  setScopeGuideOpen: (open: boolean) => void;
  toggleScopeGuide: () => void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  isScopeGuideOpen: false,
  setScopeGuideOpen: (open) => set({ isScopeGuideOpen: open }),
  toggleScopeGuide: () => set((state) => ({ isScopeGuideOpen: !state.isScopeGuideOpen })),
}));
