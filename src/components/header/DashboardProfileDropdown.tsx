'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  MessageSquare,
  FolderKanban,
  Ticket,
  LogOut,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';

interface DashboardProfileDropdownProps {
  userEmail?: string | null;
  userName?: string | null;
  walletBalance?: number;
}

/**
 * Clean circular SVG avatar matching the Shadcn Studio reference.
 */
function CharacterAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Light circle background */}
      <circle cx="20" cy="20" r="20" fill="#E4E4E7" />
      {/* Hair */}
      <path
        d="M10 18C10 11.5 14.5 8 20 8C25.5 8 30 11.5 30 18C30 19 29 20 28 20C27 18 25.5 17 23.5 17C21.5 17 20 18 20 18C20 18 18.5 17 16.5 17C14.5 17 13 18 12 20C11 20 10 19 10 18Z"
        fill="#18181B"
      />
      {/* Sunglasses */}
      <rect x="13" y="16.5" width="6.2" height="4.2" rx="1.2" fill="#18181B" />
      <rect x="20.8" y="16.5" width="6.2" height="4.2" rx="1.2" fill="#18181B" />
      <path d="M19.2 18H20.8" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Smirk Smile */}
      <path
        d="M18 24.5C19.5 25.3 22 25 23.2 23.5"
        stroke="#18181B"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Nose */}
      <path d="M20 20.5V21.5" stroke="#18181B" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardProfileDropdown({
  userEmail,
  userName,
}: DashboardProfileDropdownProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setIsOpen: setChatOpen, unreadCounts } = useStudioChat();
  const { user, signOut } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveName = userName || user.name;
  const effectiveEmail = userEmail || user.email;

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      {/* =================================================================== */}
      {/* 1. Circular Avatar Trigger Button (Shadcn Studio Avatar)            */}
      {/* =================================================================== */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="User Account Menu"
            className="group relative size-8.5 rounded-full overflow-hidden border border-white/15 bg-zinc-900 hover:border-white/30 hover:ring-2 hover:ring-amber-500/30 transition-all cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 shrink-0"
          />
        }
      >
        <CharacterAvatar className="size-full object-cover" />
      </DropdownMenuTrigger>

      {/* =================================================================== */}
      {/* 2. Dropdown Menu Content (240px, rounded-xl, 36px rows, p-1)        */}
      {/* =================================================================== */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 rounded-xl border border-white/10 bg-zinc-950/95 text-zinc-100 p-1 shadow-lg backdrop-blur-md ring-1 ring-white/10"
      >
        {/* Identity Block: 14px semibold name, 12px muted email */}
        <div className="px-2.5 py-2 select-none">
          <p className="text-sm font-semibold leading-none text-zinc-100 truncate">{effectiveName}</p>
          <p className="mt-1 text-xs text-zinc-400 truncate">{effectiveEmail}</p>
        </div>

        {/* Separator 1 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 1: Your Projects */}
        <DropdownMenuItem
          render={
            <Link
              href="/projects"
              className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <FolderKanban className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
              <span>Your Projects</span>
            </Link>
          }
        />

        {/* Action 2: Chat with Producer */}
        <DropdownMenuItem
          className="group flex h-9 items-center justify-between rounded-lg px-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
          onClick={() => setChatOpen(true)}
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
            <span>Chat with Producer</span>
          </div>
          {totalUnreadChat > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-3xs font-bold">
              {totalUnreadChat}
            </span>
          )}
        </DropdownMenuItem>

        {/* Action 3: Credits & Promo */}
        <DropdownMenuItem
          render={
            <Link
              href="/redeem-code"
              className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <Ticket className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
              <span>Credits & Promo</span>
            </Link>
          }
        />

        {/* Separator 2 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 4: Compact Inline Theme Switcher (28px buttons, 16px icons) */}
        <div className="flex h-9 items-center justify-between px-2.5 text-sm font-medium text-zinc-200 select-none">
          <span>Theme</span>
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`size-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                mounted && theme === 'light'
                  ? 'bg-white/10 text-amber-400 font-semibold shadow-2xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun className="size-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`size-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                mounted && theme === 'dark'
                  ? 'bg-white/10 text-amber-400 font-semibold shadow-2xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Dark theme"
              aria-label="Dark theme"
            >
              <Moon className="size-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`size-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                mounted && theme === 'system'
                  ? 'bg-white/10 text-amber-400 font-semibold shadow-2xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="System theme"
              aria-label="System theme"
            >
              <Laptop className="size-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Separator 3 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 5: Sign out (Neutral idle, destructive red only on hover) */}
        <DropdownMenuItem
          className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-300 hover:text-red-400 hover:bg-red-500/10 focus-visible:bg-red-500/10 focus-visible:text-red-400 cursor-pointer transition-colors outline-none w-full"
          onClick={handleSignOut}
        >
          <LogOut className="size-4 text-zinc-400 group-hover:text-red-400 transition-colors shrink-0" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
