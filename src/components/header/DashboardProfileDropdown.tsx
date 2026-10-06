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
  Coins,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/reui/icon-tile';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { cn } from '@/lib/utils';

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
  walletBalance,
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
  const effectiveBalance =
    walletBalance !== undefined && walletBalance !== null
      ? walletBalance
      : user.walletBalance;

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      {/* =================================================================== */}
      {/* 1. Reusable Avatar Trigger with Online Status Badge                 */}
      {/* =================================================================== */}
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="User Account Menu"
            className="relative size-8.5 rounded-full p-0 border border-white/15 bg-zinc-900 hover:border-white/30 hover:ring-2 hover:ring-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/50 cursor-pointer select-none transition-all shrink-0"
          />
        }
      >
        <Avatar size="default" className="size-8.5 ring-1 ring-white/10 hover:ring-amber-500/40 transition-all">
          <AvatarFallback className="bg-zinc-800 text-zinc-100 font-bold text-xs p-0 overflow-hidden">
            <CharacterAvatar className="size-full object-cover" />
          </AvatarFallback>
          <AvatarBadge className="bg-emerald-500 ring-2 ring-zinc-950 size-2.5" />
        </Avatar>
      </DropdownMenuTrigger>

      {/* =================================================================== */}
      {/* 2. Dropdown Menu Content (256px, rounded-xl, design system styled)  */}
      {/* =================================================================== */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="dark w-64 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 p-1.5 shadow-2xl ring-1 ring-white/10"
      >
        {/* Identity Block: Reusable Avatar, Client Badge, Name & Email */}
        <div className="flex items-center gap-2.5 p-2 select-none rounded-lg bg-white/3 border border-white/5 mb-1">
          <Avatar size="default" className="size-9 shrink-0 ring-1 ring-white/15">
            <AvatarFallback className="bg-zinc-800 text-zinc-100 font-semibold text-xs p-0 overflow-hidden">
              <CharacterAvatar className="size-full object-cover" />
            </AvatarFallback>
            <AvatarBadge className="bg-emerald-500 ring-2 ring-zinc-950 size-2" />
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-zinc-100 truncate">{effectiveName}</span>
              <Badge variant="gold" size="xs" className="font-bold text-[9px] uppercase px-1.5 py-0 border-amber-500/30">
                CLIENT
              </Badge>
            </div>
            <p className="text-2xs text-zinc-400 truncate mt-0.5">{effectiveEmail}</p>
          </div>
        </div>

        {/* Studio Credit Balance Quick View */}
        <DropdownMenuItem
          render={
            <Link
              href="/redeem-code"
              className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-xs my-0.5 transition-colors cursor-pointer w-full outline-none"
            >
              <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                <Coins className="size-3.5 text-amber-400" />
                <span className="text-2xs">Studio Credits</span>
              </div>
              <Badge variant="gold-solid" size="xs" className="font-bold tracking-tight">
                {effectiveBalance} CR
              </Badge>
            </Link>
          }
        />

        {/* Separator 1 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 1: Your Projects */}
        <DropdownMenuItem
          render={
            <Link
              href="/projects"
              className="group flex h-9 items-center justify-between rounded-lg px-2 text-xs font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <div className="flex items-center gap-2.5">
                <IconTile
                  variant="outline"
                  size="xs"
                  className="size-6 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 border-white/10 bg-white/5 transition-colors"
                >
                  <FolderKanban className="size-3.5" />
                </IconTile>
                <span>Your Projects</span>
              </div>
              <ChevronRight className="size-3 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
            </Link>
          }
        />

        {/* Action 2: Chat with Producer */}
        <DropdownMenuItem
          className="group flex h-9 items-center justify-between rounded-lg px-2 text-xs font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
          onClick={() => setChatOpen(true)}
        >
          <div className="flex items-center gap-2.5">
            <IconTile
              variant="outline"
              size="xs"
              className="size-6 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 border-white/10 bg-white/5 transition-colors"
            >
              <MessageSquare className="size-3.5" />
            </IconTile>
            <span>Chat with Producer</span>
          </div>
          {totalUnreadChat > 0 ? (
            <Badge variant="gold" size="xs" className="font-bold border-amber-500/40">
              {totalUnreadChat}
            </Badge>
          ) : (
            <ChevronRight className="size-3 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
          )}
        </DropdownMenuItem>

        {/* Action 3: Credits & Promo */}
        <DropdownMenuItem
          render={
            <Link
              href="/redeem-code"
              className="group flex h-9 items-center justify-between rounded-lg px-2 text-xs font-medium text-zinc-200 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:text-white cursor-pointer transition-colors w-full outline-none"
            >
              <div className="flex items-center gap-2.5">
                <IconTile
                  variant="outline"
                  size="xs"
                  className="size-6 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 border-white/10 bg-white/5 transition-colors"
                >
                  <Ticket className="size-3.5" />
                </IconTile>
                <span>Credits & Promo</span>
              </div>
              <ChevronRight className="size-3 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
            </Link>
          }
        />

        {/* Separator 2 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 4: Compact Theme Switcher with Reusable Buttons */}
        <div className="flex h-9 items-center justify-between px-2 text-xs font-medium text-zinc-200 select-none">
          <span className="text-zinc-300">Theme</span>
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setTheme('light')}
              className={cn(
                'size-6 rounded-md transition-all cursor-pointer',
                mounted && theme === 'light'
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun className="size-3.5 shrink-0" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setTheme('dark')}
              className={cn(
                'size-6 rounded-md transition-all cursor-pointer',
                mounted && theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
              title="Dark theme"
              aria-label="Dark theme"
            >
              <Moon className="size-3.5 shrink-0" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setTheme('system')}
              className={cn(
                'size-6 rounded-md transition-all cursor-pointer',
                mounted && theme === 'system'
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
              title="System theme"
              aria-label="System theme"
            >
              <Laptop className="size-3.5 shrink-0" />
            </Button>
          </div>
        </div>

        {/* Separator 3 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* Action 5: Sign out with Destructive Reusable Hover */}
        <DropdownMenuItem
          className="group flex h-9 items-center gap-2.5 rounded-lg px-2 text-xs font-medium text-zinc-300 hover:text-red-400 hover:bg-red-500/10 focus-visible:bg-red-500/10 focus-visible:text-red-400 cursor-pointer transition-colors outline-none w-full"
          onClick={handleSignOut}
        >
          <IconTile
            variant="outline"
            size="xs"
            className="size-6 text-zinc-400 group-hover:text-red-400 group-hover:border-red-500/30 border-white/10 bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" />
          </IconTile>
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
