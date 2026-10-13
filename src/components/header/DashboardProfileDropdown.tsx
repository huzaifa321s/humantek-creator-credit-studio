'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  FolderKanban,
  Coins,
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
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/lib/userStore';
import { cn } from '@/lib/utils';

interface DashboardProfileDropdownProps {
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  walletBalance?: number;
}

export function DashboardProfileDropdown({
  userEmail,
  userName,
  userAvatarUrl,
  walletBalance,
}: DashboardProfileDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useUserStore();

  const isProjectsActive = pathname === '/projects';

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveName = userName || user?.name;
  const effectiveEmail = userEmail || user?.email;
  const avatarUrl = userAvatarUrl || user?.avatarUrl;
  const effectiveBalance =
    walletBalance !== undefined && walletBalance !== null
      ? walletBalance
      : user?.walletBalance ?? 0;

  // Resolve person's name or email username if not set ("Welcome" as last resort)
  const displayName = useMemo(() => {
    if (effectiveName && effectiveName.trim().toLowerCase() !== 'client') {
      return effectiveName.trim();
    }
    if (effectiveEmail && effectiveEmail.includes('@')) {
      return effectiveEmail.split('@')[0];
    }
    return 'Welcome';
  }, [effectiveName, effectiveEmail]);

  // Compute initials for clean fallback (2 capital letters)
  const effectiveInitials = useMemo(() => {
    if (user?.avatarInitials) return user.avatarInitials;
    if (displayName && displayName !== 'Welcome') {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length > 1) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return displayName.slice(0, 2).toUpperCase();
    }
    if (effectiveEmail && effectiveEmail.includes('@')) {
      return effectiveEmail.slice(0, 2).toUpperCase();
    }
    return 'CR';
  }, [user?.avatarInitials, displayName, effectiveEmail]);

  // Only show role badge for staff/admin roles; clients don't need a role badge
  const isStaff = Boolean(
    user?.role &&
    user.role.toLowerCase() !== 'client' &&
    user.role.toLowerCase() !== 'user'
  );

  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    signOut();
    queryClient.clear();
    router.push('/login');
    router.refresh();
  };

  return (
    <DropdownMenu>
      {/* =================================================================== */}
      {/* 1. Reusable Avatar Trigger (Accessible, zero fake presence dot)     */}
      {/* =================================================================== */}
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Account menu"
            className="relative size-8.5 rounded-full p-0 border border-white/15 bg-zinc-900 hover:border-white/30 hover:ring-2 hover:ring-amber-400/30 focus-visible:ring-2 focus-visible:ring-amber-400/50 cursor-pointer select-none transition-all shrink-0"
          />
        }
      >
        <Avatar size="default" className="size-8.5 ring-1 ring-white/10 hover:ring-amber-400/40 transition-all">
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-square size-full object-cover rounded-full"
            />
          )}
          <AvatarFallback className="bg-zinc-800 text-amber-300 font-bold text-xs select-none">
            {effectiveInitials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      {/* =================================================================== */}
      {/* 2. Dropdown Menu Content (240px w-60, rounded-xl, design system)   */}
      {/* =================================================================== */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="dark w-60 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 p-1 shadow-2xl ring-1 ring-white/10"
      >
        {/* 1. Identity Block: Avatar, Name & Email (No boxed card, no duplicate CLIENT badge) */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 select-none">
          <Avatar size="default" className="size-8.5 shrink-0 ring-1 ring-white/15">
            {avatarUrl && (
              <AvatarImage
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="aspect-square size-full object-cover rounded-full"
              />
            )}
            <AvatarFallback className="bg-zinc-800 text-amber-300 font-semibold text-xs select-none">
              {effectiveInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-sm font-semibold text-zinc-100 truncate leading-none">{displayName}</p>
              {isStaff && (
                <Badge variant="outline" size="xs" className="font-bold text-2xs uppercase tracking-wider px-1.5 py-0 border-zinc-700 text-zinc-300">
                  {user?.role}
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate font-normal mt-1 leading-none">{effectiveEmail}</p>
          </div>
        </div>

        {/* Separator 1 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* 2. My Projects (Primary Navigation Home) */}
        <DropdownMenuItem
          render={
            <Link
              href="/projects"
              className={cn(
                'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors cursor-pointer w-full outline-none select-none',
                isProjectsActive
                  ? 'bg-amber-400/15 text-amber-300 font-semibold'
                  : 'text-zinc-300 hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white'
              )}
            >
              <FolderKanban
                className={cn(
                  'size-4 shrink-0 transition-colors',
                  isProjectsActive
                    ? 'text-amber-400'
                    : 'text-zinc-400 group-hover:text-zinc-200 group-focus:text-zinc-200'
                )}
              />
              <span>My Projects</span>
            </Link>
          }
        />

        {/* 3. Mobile-Only Credit Balance (Hidden on md+ desktop where header pill is visible) */}
        <div className="md:hidden">
          <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
          <DropdownMenuItem
            render={
              <Link
                href="/redeem-code"
                className="group flex h-9 items-center justify-between rounded-lg px-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white cursor-pointer transition-colors w-full outline-none select-none"
              >
                <div className="flex items-center gap-2.5">
                  <Coins className="size-4 shrink-0 text-amber-400" />
                  <span>Credit balance</span>
                </div>
                {!mounted || effectiveBalance === undefined ? (
                  <div className="skeleton h-5 w-16 rounded-full bg-amber-400/20" />
                ) : (
                  <Badge
                    variant="gold"
                    size="xs"
                    className="px-2 py-0.5 rounded-full font-semibold tabular-nums text-xs border-amber-400/30 bg-amber-400/15 text-amber-300 group-hover:bg-amber-400/25 transition-colors"
                  >
                    {effectiveBalance} {effectiveBalance === 1 ? 'credit' : 'credits'}
                  </Badge>
                )}
              </Link>
            }
          />
        </div>

        {/* Separator 2 */}
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />

        {/* 4. Theme Switcher */}
        <div className="flex h-9 items-center justify-between px-2.5 text-sm font-medium text-zinc-300 select-none">
          <span>Theme</span>
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-full border border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setTheme('light')}
              className={cn(
                'size-6 rounded-full transition-all cursor-pointer border',
                mounted && theme === 'light'
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/35 font-semibold shadow-2xs'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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
                'size-6 rounded-full transition-all cursor-pointer border',
                mounted && theme === 'dark'
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/35 font-semibold shadow-2xs'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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
                'size-6 rounded-full transition-all cursor-pointer border',
                mounted && theme === 'system'
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/35 font-semibold shadow-2xs'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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

        {/* 5. Sign out */}
        <DropdownMenuItem
          className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 focus:bg-white/5 focus:text-white cursor-pointer transition-colors outline-none w-full"
          onClick={handleSignOut}
        >
          <LogOut className="size-4 shrink-0 text-zinc-400 group-hover:text-zinc-200 group-focus:text-zinc-200 transition-colors" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
