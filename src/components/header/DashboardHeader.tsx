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
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { badgeVariants } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { useUIStore } from '@/lib/uiStore';
import { useWalletQuery } from '@/lib/queries/wallet';
import { ChatGate } from '@/components/chat/ChatGate';
import { ClientOnly } from '@/components/ClientOnly';
import { DashboardSearchDialog } from './DashboardSearchDialog';
import { DashboardNotificationDropdown } from './DashboardNotificationDropdown';
import { DashboardProfileDropdown } from './DashboardProfileDropdown';

function HeaderChatButton({ mode }: { mode: 'standalone' | 'wizard' | 'auth' }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { setIsOpen: setChatOpen, unreadCounts } = useStudioChat();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  return (
    <ChatGate>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              data-chat-entry="header-icon"
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setChatOpen(true);
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              aria-label="Messages"
              className={cn(
                "group relative size-8 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer select-none",
                mode === 'wizard' ? "hidden min-[380px]:inline-flex" : ""
              )}
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
    </ChatGate>
  );
}

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
  const { user, isHydrated } = useUserStore();
  const isManagementRoute = Boolean(pathname?.startsWith('/management'));

  const resolveEffectiveName = () => {
    if (userName && userName.trim().toLowerCase() !== 'client') return userName.trim();
    if (user?.name && user.name.trim().toLowerCase() !== 'client') return user.name.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    if (user?.email && user.email.includes('@')) return user.email.split('@')[0];
    return 'Welcome';
  };
  const effectiveName = isHydrated ? resolveEffectiveName() : (userName || 'Welcome');
  const effectiveEmail = isHydrated ? (userEmail || user?.email) : userEmail;
  const { data: walletData, isSuccess: isWalletSuccess, isPending: isWalletPending } = useWalletQuery(effectiveEmail);
  const hasServerBalance = isWalletSuccess && typeof walletData?.walletBalance === 'number';
  const effectiveBalance =
    hasServerBalance
      ? walletData.walletBalance
      : walletBalance !== undefined && walletBalance !== null
      ? walletBalance
      : user?.walletBalance ?? 0;
  const isBalanceLoaded =
    isHydrated &&
    typeof effectiveBalance === 'number' &&
    !(Boolean(effectiveEmail) && isWalletPending && !hasServerBalance);

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

  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const isSidebarCollapsed = mode === 'standalone' && sidebarState === 'collapsed';

  return (
    <>
      <header
        className={cn(
          'dark h-13 sm:h-13.5 border-b border-zinc-800/80 flex items-center shrink-0 bg-zinc-950/95 text-zinc-100 backdrop-blur-md sticky top-0 z-40 shadow-xs',
          mode === 'standalone' ? 'px-0' : 'px-2.5 sm:px-5 lg:px-6 justify-between'
        )}
      >
        {/* =================================================================== */}
        {/* Left Section: Sidebar Toggle & Brand Identity (Aligned with Sidebar) */}
        {/* =================================================================== */}
        <div
          className={cn(
            'h-full flex items-center shrink-0 min-w-0 transition-[width] duration-200 ease-linear select-none',
            mode === 'standalone'
              ? cn(
                  'border-r border-zinc-800/80 bg-zinc-950',
                  isSidebarCollapsed
                    ? 'w-(--sidebar-width-icon) justify-center px-1.5'
                    : 'w-auto md:w-(--sidebar-width) px-2 sm:px-3.5'
                )
              : 'gap-2 sm:gap-2.5'
          )}
        >
          <div
            className={cn(
              'flex items-center min-w-0 w-full',
              isSidebarCollapsed ? 'justify-center' : 'gap-2 sm:gap-2.5'
            )}
          >
            {mode === 'standalone' && (
              <SidebarTrigger className="-ml-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 size-8 rounded-md transition-colors cursor-pointer shrink-0" />
            )}

            {/* Unified Brand Logo & Title across all modes */}
            <Link
              href="/projects"
              className={cn(
                'flex items-center gap-2 group select-none shrink-0 min-w-0',
                isSidebarCollapsed && 'hidden'
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-2xs tracking-wider shadow-xs group-hover:scale-105 transition-transform shrink-0">
                ART
              </div>
              <div className="hidden sm:block min-w-0 truncate">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white tracking-tight text-xs truncate">
                    Humantek Art
                  </span>
                  <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                </div>
                <span className="block text-2xs tracking-wider uppercase font-bold text-amber-400 leading-tight truncate">
                  Creator Credits Studio
                </span>
              </div>
            </Link>
          </div>

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
        </div>

        {/* =================================================================== */}
        {/* Main Content Header Bar (Breadcrumbs, Search & Profile Actions)     */}
        {/* =================================================================== */}
        <div
          className={cn(
            'flex-1 flex items-center justify-between min-w-0 h-full',
            mode === 'standalone' ? 'px-3.5 sm:px-5 lg:px-6' : ''
          )}
        >
          {/* Left: Breadcrumbs Trail */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {mode !== 'auth' && breadcrumbPage && (
              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList className="gap-1.5 sm:gap-2 text-xs">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href="/projects"
                      className="text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      Home
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-zinc-500 [&>svg]:size-3" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-semibold text-white">
                      {breadcrumbPage}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>

        {/* =================================================================== */}
        {/* Center Section: Interactive Command Search Pill (hidden in auth)    */}
        {/* =================================================================== */}
        {mode !== 'auth' ? (
          <div className={cn(
            "items-center justify-center max-w-sm mx-auto",
            mode === 'wizard' ? "hidden sm:flex flex-1 px-2 sm:px-4" : "flex flex-1 px-2 sm:px-4"
          )}>
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

            {/* Mobile Search Icon Button (Standalone mode only; omitted in wizard to make room for scope pill) */}
            {mode !== 'wizard' && (
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
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* =================================================================== */}
        {/* Right Section: Producer Chat, Notifications, Balance & User Profile */}
        {/* =================================================================== */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {mode === 'auth' ? (
            <div className="flex items-center gap-3">
              <a
                href="mailto:support@humantek.art"
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
              >
                Need help?
              </a>
            </div>
          ) : !effectiveEmail ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isManagementRoute && topRightBadge}
              <Link href="/login">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg border-amber-500/40 text-amber-400 hover:text-white hover:bg-amber-500/20 text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Quick Producer Chat Trigger with Reusable Tooltip */}
              <HeaderChatButton mode={mode} />

              {/* Notification Popover Dropdown */}
              <DashboardNotificationDropdown />

              {/* Credit Balance Pill or Admin Badge */}
              {isManagementRoute ? (
                <div className="hidden md:inline-flex items-center gap-1.5 py-1 px-3 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs font-semibold select-none shadow-2xs">
                  <ShieldCheck className="size-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-xs tracking-tight">Studio Admin</span>
                </div>
              ) : !isBalanceLoaded ? (
                <div
                  className="hidden md:inline-flex items-center gap-1.5 py-1 px-3 rounded-full border border-amber-500/40 bg-amber-500/15 text-xs font-semibold select-none shadow-2xs shrink-0"
                  aria-label="Loading credit balance"
                >
                  <Coins className="size-3.5 text-amber-400/60 animate-pulse shrink-0" />
                  <span className="text-zinc-300 font-medium text-xs">Credit balance:</span>
                  <div className="skeleton h-3.5 w-11 rounded-xs bg-amber-400/25" />
                </div>
              ) : (
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
                  <span className="text-amber-300 font-mono tabular-nums font-bold tracking-tight">
                    {effectiveBalance} CR
                  </span>
                </Link>
              )}

              {/* Optional Top-Right Action Badge (hidden on management console) */}
              {!isManagementRoute && topRightBadge}

              {/* User Profile Avatar Dropdown */}
              <DashboardProfileDropdown
                userEmail={effectiveEmail}
                userName={effectiveName}
                walletBalance={effectiveBalance}
              />
            </>
          )}
        </div>
      </div>
    </header>

      {/* Global Command / Quick Search Dialog (only in app modes) */}
      {mode !== 'auth' && (
        <DashboardSearchDialog
          open={isSearchOpen}
          onOpenChange={setSearchOpen}
          walletBalance={effectiveBalance}
        />
      )}
    </>
  );
}
