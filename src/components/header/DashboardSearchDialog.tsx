'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FolderKanban,
  Ticket,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Coins,
  ArrowRight,
  Sliders,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useStudioChat } from '@/lib/chatStore';

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
  const { setIsOpen: setChatOpen } = useStudioChat();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchItems: SearchItem[] = useMemo(
    () => [
      {
        id: 'nav-wizard',
        category: 'Navigation',
        title: 'Creator Studio Wizard',
        description: 'Configure and brief your next creative media project',
        icon: Sparkles,
        keywords: ['wizard', 'brief', 'create', 'order', 'package', 'new', 'home'],
        action: () => router.push('/'),
      },
      {
        id: 'nav-configure',
        category: 'Navigation',
        title: 'Service Configuration',
        description: 'Customize video, graphics, and production deliverables',
        icon: Sliders,
        keywords: ['service', 'configure', 'custom', 'options', 'addons'],
        action: () => router.push('/configure'),
      },
      {
        id: 'nav-projects',
        category: 'Navigation',
        title: 'Your Projects Tracker',
        description: 'Track milestones, deliverables, approvals, and assets',
        icon: FolderKanban,
        keywords: ['projects', 'tracker', 'milestones', 'status', 'deliverables', 'history'],
        action: () => router.push('/projects'),
        badge: 'Tracker',
      },
      {
        id: 'nav-redeem',
        category: 'Navigation',
        title: 'Redeem Promo Voucher',
        description: 'Enter promotional codes to claim instant studio credits',
        icon: Ticket,
        keywords: ['redeem', 'code', 'voucher', 'promo', 'coupon', 'discount', 'free credits'],
        action: () => router.push('/redeem-code'),
      },
      {
        id: 'nav-management',
        category: 'Navigation',
        title: 'Agency Console',
        description: 'Administrative workspace, client overview, and billing',
        icon: ShieldCheck,
        keywords: ['agency', 'management', 'admin', 'console', 'workspace', 'billing'],
        action: () => router.push('/management'),
        badge: 'Admin',
      },
      {
        id: 'action-chat',
        category: 'Actions',
        title: 'Chat with Dedicated Producer',
        description: 'Instant live briefing, revisions, and creative feedback',
        icon: MessageSquare,
        keywords: ['chat', 'producer', 'support', 'message', 'help', 'creative director'],
        action: () => setChatOpen(true),
        badge: 'Live',
      },
      {
        id: 'action-balance',
        category: 'Actions',
        title: `Studio Balance (${walletBalance} CR)`,
        description: 'Review credit utilization, top-ups, and balance breakdown',
        icon: Coins,
        keywords: ['balance', 'credits', 'wallet', 'funds', 'cr', 'coins'],
        action: () => router.push('/redeem-code'),
      },
    ],
    [router, setChatOpen, walletBalance]
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

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
        className="p-0 max-w-xl overflow-hidden bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl rounded-2xl ring-1 ring-white/10"
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search pages, actions, or tools..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
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
                          ? 'bg-amber-500/20 text-amber-400'
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
                          <span className="text-3xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold uppercase tracking-wider">
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
