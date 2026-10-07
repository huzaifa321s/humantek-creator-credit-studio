'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  Coins,
  Sparkles,
  Search,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { useUIStore } from '@/lib/uiStore';
import { DashboardSearchDialog } from './DashboardSearchDialog';
import { DashboardNotificationDropdown } from './DashboardNotificationDropdown';
import { DashboardProfileDropdown } from './DashboardProfileDropdown';

interface DashboardHeaderProps {
  mode?: 'standalone' | 'wizard' | 'auth';
  showBack?: boolean;
  backLabel?: string;
  handleBack?: () => void;
  isBackDisabled?: boolean;
  breadcrumbPage?: string;
  walletBalance?: number;
  userEmail?: string | null;
  userName?: string | null;
  topRightBadge?: React.ReactNode;
  currentStep?: number;
}

export function DashboardHeader({
  mode = 'wizard',
  showBack = true,
  backLabel = 'Back',
  handleBack,
  isBackDisabled = false,
  breadcrumbPage,
  walletBalance,
  userEmail = null,
  userName = null,
  topRightBadge,
  currentStep = 1,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const { isSearchOpen, setSearchOpen, toggleSearch } = useUIStore();
  const { setIsOpen: setChatOpen, unreadCounts } = useStudioChat();
  const { user } = useUserStore();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const resolveEffectiveName = () => {
    if (userName && userName.trim().toLowerCase() !== 'client') return userName.trim();
    if (user.name && user.name.trim().toLowerCase() !== 'client') return user.name.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    if (user.email && user.email.includes('@')) return user.email.split('@')[0];
    return 'Welcome';
  };
  const effectiveName = resolveEffectiveName();
  const effectiveEmail = userEmail || user.email;
  const effectiveBalance =
    walletBalance !== undefined && walletBalance !== null
      ? walletBalance
      : user.walletBalance;

  // Compute default breadcrumb title if not explicitly passed
  const activePageTitle =
    breadcrumbPage ||
    (pathname === '/projects'
      ? 'My Projects'
      : pathname === '/messages'
      ? 'Messages'
      : pathname === '/management'
      ? 'Agency Console'
      : pathname === '/redeem-code'
      ? 'Promo Code'
      : mode === 'wizard'
      ? 'New Project'
      : backLabel.replace(/^Back to\s+/, ''));

  return (
    <>
      <header className="dark h-13 sm:h-13.5 px-3.5 sm:px-5 lg:px-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-950/95 text-zinc-100 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        {/* =================================================================== */}
        {/* Left Section: Sidebar Toggle, Brand Identity & Breadcrumbs           */}
        {/* =================================================================== */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          {mode === 'standalone' && (
            <SidebarTrigger className="-ml-1 mr-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 size-8 rounded-md transition-colors cursor-pointer" />
          )}

          {/* Unified Brand Logo & Title across all modes */}
          <Link href="/" className="flex items-center gap-2 group select-none shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-2xs tracking-wider shadow-xs group-hover:scale-105 transition-transform shrink-0">
              ART
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white tracking-tight text-xs">
                  Humantek Art
                </span>
                <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              </div>
              <span className="block text-2xs tracking-wider uppercase font-bold text-amber-400 leading-tight">
                Creator Credits Studio
              </span>
            </div>
          </Link>

          {/* Optional Back Navigation Button (only in wizard mode when step > 1 to avoid duplicate "Studio") */}
          {mode === 'wizard' && currentStep > 1 && handleBack && (
            <>
              <Separator orientation="vertical" className="h-4 hidden sm:block bg-zinc-700/80" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBackDisabled}
                onClick={handleBack}
                className="gap-1 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors h-7.5 px-2 rounded-md cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden md:inline">Back</span>
              </Button>
            </>
          )}

          {mode !== 'auth' && (
            <>
              <Separator orientation="vertical" className="h-4 hidden sm:block bg-zinc-700/80" />

              {/* Breadcrumb Navigation Trail */}
              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList className="gap-1.5 sm:gap-2 text-xs">
                  {pathname === '/' || activePageTitle === 'Studio' ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs font-semibold text-white">
                        Studio
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          href="/"
                          className="text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                        >
                          Studio
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="text-zinc-500 [&>svg]:size-3" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-xs font-semibold text-white">
                          {activePageTitle}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </>
          )}
        </div>

        {/* =================================================================== */}
        {/* Center Section: Interactive Command Search Pill (hidden in auth)    */}
        {/* =================================================================== */}
        {mode !== 'auth' ? (
          <div className="flex items-center justify-center flex-1 px-2 sm:px-4 max-w-sm mx-auto">
            {/* Desktop & Tablet Search Bar Pill */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center justify-between gap-2.5 h-8 px-3 rounded-lg border-zinc-700/70 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer w-full max-w-64 shadow-2xs text-xs select-none font-normal"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="size-3.5 text-zinc-400 shrink-0" />
                <span className="truncate text-xs font-medium text-zinc-300">Type to search...</span>
              </div>
              <Kbd className="bg-zinc-950 border border-zinc-700/80 text-2xs font-mono tabular-nums text-zinc-400 px-1.5 py-0.5 h-4.5 rounded shadow-2xs">
                ⌘K
              </Kbd>
            </Button>

            {/* Mobile Search Icon Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="sm:hidden size-8 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
            >
              <Search className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* =================================================================== */}
        {/* Right Section: Producer Chat, Notifications, Balance & User Profile */}
        {/* =================================================================== */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {mode === 'auth' ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300 text-xs font-medium select-none shadow-2xs">
                <ShieldCheck className="size-3.5 text-amber-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-300">Secure Access</span>
              </div>
            </div>
          ) : (
            <>
              {/* Quick Producer Chat Trigger with Reusable Tooltip */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setChatOpen(true)}
                      aria-label="Messages"
                      className="group relative size-8 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer select-none"
                    />
                  }
                >
                  <MessageSquare className="size-4 text-zinc-300 group-hover:text-white group-hover:scale-105 transition-transform" />
                  {totalUnreadChat > 0 ? (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-zinc-950" />
                  ) : null}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-semibold text-white">Messages</p>
                  <p className="text-zinc-400 text-2xs">Chat with our team</p>
                </TooltipContent>
              </Tooltip>

              {/* Notification Popover Dropdown */}
              <DashboardNotificationDropdown />

              {/* Credit Balance Pill (Standardized naming, consistent across all screens) */}
              <Link
                href="/redeem-code"
                title="View credit balance and redeem codes"
                className={cn(
                  badgeVariants({ variant: 'gold', size: 'default' }),
                  'hidden md:inline-flex items-center gap-1.5 py-1 px-3 rounded-full border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 transition-all text-xs font-semibold select-none shadow-2xs cursor-pointer'
                )}
              >
                <Coins className="size-3.5 text-amber-400 shrink-0" />
                <span className="text-zinc-300 font-medium text-xs">Credit balance:</span>
                <span className="text-amber-300 font-mono tabular-nums font-bold tracking-tight">{effectiveBalance} CR</span>
              </Link>

              {/* Optional Top-Right Action Badge (e.g. New Project or Active Package) */}
              {topRightBadge}

              {/* User Profile Avatar Dropdown */}
              <DashboardProfileDropdown
                userEmail={effectiveEmail}
                userName={effectiveName}
                walletBalance={effectiveBalance}
              />
            </>
          )}
        </div>
      </header>

      {/* Global Command / Quick Search Dialog (only in app modes) */}
      {mode !== 'auth' && (
        <DashboardSearchDialog
          open={isSearchOpen}
          onOpenChange={setSearchOpen}
          walletBalance={walletBalance}
        />
      )}
    </>
  );
}
