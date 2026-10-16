'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import {
  Search,
  FolderKanban,
  Ticket,
  Receipt,
  ShieldCheck,
  Plus,
  MessageSquare,
  Coins,
  ArrowRight,
  Sliders,
  X,
  Users,
  User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useChatStore } from '@/lib/chatStore';
import { useSidebar } from '@/components/ui/sidebar';
import { useUserStore } from '@/lib/userStore';
import { useChatGate } from '@/components/chat/ChatGate';

interface DashboardSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance?: number;
}

interface SearchItem {
  id: string;
  category: 'Navigation' | 'Actions';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  action: () => void;
  badge?: string;
}

export function DashboardSearchDialog({
  open,
  onOpenChange,
  walletBalance = 0,
}: DashboardSearchDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const topLoader = useTopLoader();
  const { user } = useUserStore();
  const { isMobile, setOpenMobile } = useSidebar();
  const { canChat } = useChatGate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigateTo = useCallback(
    (href: string) => {
      if (isMobile) setOpenMobile(false);
      if (href.split('?')[0] !== pathname) {
        topLoader.start();
      }
      router.push(href);
    },
    [isMobile, setOpenMobile, pathname, topLoader, router]
  );

  const isStaffOrAdmin = Boolean(
    user?.role &&
    user.role.toLowerCase() !== 'client' &&
    user.role.toLowerCase() !== 'user' &&
    (
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'producer' ||
      user.role.toLowerCase() === 'staff'
    )
  );

  const searchItems: SearchItem[] = useMemo(
    () =>
      isStaffOrAdmin
        ? [
            {
              id: 'nav-management',
              category: 'Navigation' as const,
              title: 'Agency Overview',
              description: 'Studio operations dashboard, active production metrics, and KPIs',
              icon: ShieldCheck,
              keywords: ['agency', 'management', 'admin', 'console', 'overview', 'dashboard'],
              action: () => navigateTo('/management'),
            },
            {
              id: 'nav-admin-projects',
              category: 'Navigation' as const,
              title: 'Client Projects',
              description: 'Manage client briefs, production statuses, and deliverables',
              icon: FolderKanban,
              keywords: ['projects', 'clients', 'status', 'deliverables', 'queue', 'production'],
              action: () => navigateTo('/management/projects'),
            },
            {
              id: 'nav-admin-inbox',
              category: 'Navigation' as const,
              title: 'Client Messages',
              description: 'Real-time studio inbox and client project communications',
              icon: MessageSquare,
              keywords: ['inbox', 'chat', 'messages', 'clients', 'support', 'feedback'],
              action: () => navigateTo('/management/inbox'),
              badge: 'Live',
            },
            {
              id: 'nav-admin-ledger',
              category: 'Navigation' as const,
              title: 'Credit History & Promo Codes',
              description: 'Audit studio credit transactions, issue credits, and manage promo codes',
              icon: Receipt,
              keywords: ['credit', 'history', 'ledger', 'promo', 'code', 'issue', 'transactions', 'billing'],
              action: () => navigateTo('/management/ledger'),
            },
            ...(user?.teamRole === 'owner'
              ? [
                  {
                    id: 'nav-admin-team',
                    category: 'Navigation' as const,
                    title: 'Team Access',
                    description: 'Control Owner, Manager, and Viewer roles for studio team members',
                    icon: Users,
                    keywords: ['team', 'access', 'roles', 'owner', 'manager', 'viewer', 'permissions', 'staff'],
                    action: () => navigateTo('/management/team'),
                  },
                ]
              : []),
            {
              id: 'nav-admin-profile',
              category: 'Navigation' as const,
              title: 'Account Profile',
              description: 'View your account status, role permissions, and edit your personal details',
              icon: User,
              keywords: ['profile', 'account', 'name', 'password', 'settings', 'details'],
              action: () => navigateTo('/profile'),
            },
          ]
        : [
            {
              id: 'nav-projects',
              category: 'Navigation' as const,
              title: 'My Projects',
              description: 'See where each project is and how many credits it uses',
              icon: FolderKanban,
              keywords: ['projects', 'status', 'deliverables', 'history', 'milestones', 'progress'],
              action: () => navigateTo('/projects'),
            },
            {
              id: 'nav-wizard',
              category: 'Navigation' as const,
              title: 'New Project',
              description: 'Configure and start your next creative media project',
              icon: Plus,
              keywords: ['new', 'project', 'brief', 'create', 'order', 'package', 'home', 'services', 'wizard'],
              action: () => navigateTo('/new-project'),
            },
            ...(canChat
              ? [
                  {
                    id: 'nav-messages',
                    category: 'Navigation' as const,
                    title: 'Messages',
                    description: 'Direct chat with our team for project updates, feedback, and questions',
                    icon: MessageSquare,
                    keywords: ['chat', 'messages', 'team', 'feedback', 'support', 'talk', 'producer'],
                    action: () => {
                      useChatStore.getState().setIsOpen(true);
                      if (isMobile) setOpenMobile(false);
                    },
                    badge: 'Chat',
                  },
                ]
              : []),
            {
              id: 'nav-wallet',
              category: 'Navigation' as const,
              title: 'Credit History',
              description: 'View your studio credit balance, package allocations, and usage ledger',
              icon: Receipt,
              keywords: ['credit', 'history', 'ledger', 'wallet', 'balance', 'transactions', 'usage'],
              action: () => navigateTo('/wallet'),
            },
            {
              id: 'nav-redeem',
              category: 'Navigation' as const,
              title: 'Promo Code',
              description: 'Enter promotional codes to claim instant studio credits',
              icon: Ticket,
              keywords: ['promo', 'code', 'redeem', 'voucher', 'coupon', 'discount', 'free credits'],
              action: () => navigateTo('/redeem-code'),
            },
            {
              id: 'nav-profile',
              category: 'Navigation' as const,
              title: 'Account Profile',
              description: 'View your account status and edit your personal details or password',
              icon: User,
              keywords: ['profile', 'account', 'name', 'password', 'settings', 'details'],
              action: () => navigateTo('/profile'),
            },
            ...(canChat
              ? [
                  {
                    id: 'action-chat',
                    category: 'Actions' as const,
                    title: 'Chat with Our Team',
                    description: 'Instant live briefing, revisions, and creative feedback',
                    icon: MessageSquare,
                    keywords: ['chat', 'team', 'producer', 'support', 'message', 'help'],
                    action: () => {
                      useChatStore.getState().setIsOpen(true);
                      if (isMobile) setOpenMobile(false);
                    },
                    badge: 'Live',
                  },
                ]
              : []),
            {
              id: 'action-balance',
              category: 'Actions' as const,
              title: `Credit balance (${walletBalance} CR)`,
              description: 'Review credit utilization, top-ups, and balance breakdown',
              icon: Coins,
              keywords: ['balance', 'credits', 'wallet', 'funds', 'cr', 'coins', 'ledger'],
              action: () => navigateTo('/wallet'),
            },
          ],
    [navigateTo, isMobile, setOpenMobile, canChat, isStaffOrAdmin, user?.teamRole, walletBalance]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchItems;
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query, searchItems]);


  // Handle global shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (item: SearchItem) => {
    onOpenChange(false);
    item.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="dark p-0 max-w-xl overflow-hidden bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl rounded-xl ring-1 ring-white/10"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search Dashboard and Actions</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-zinc-800/80 bg-zinc-950">
          <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type to search pages, actions, or tools..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-2xs text-zinc-500">
              <Kbd className="bg-zinc-900 border-zinc-800 text-zinc-400">ESC</Kbd>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              No matching pages or actions found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  data-chat-entry={item.id === 'nav-messages' ? 'search-messages' : undefined}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-md shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-amber-400/20 text-amber-400'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-3xs px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 font-semibold uppercase tracking-wider">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                      isSelected ? 'opacity-100 text-amber-400' : 'opacity-0'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Dialog Footer with Hotkeys */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-2xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd className="bg-zinc-900 border-zinc-800 text-zinc-400">↑↓</Kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd className="bg-zinc-900 border-zinc-800 text-zinc-400">↵</Kbd> Select
            </span>
          </div>
          <span className="text-zinc-500">Humantek Studio Quick Actions</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
