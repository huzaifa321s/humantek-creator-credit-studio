'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  Coins,
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
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-zinc-950" />
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

function HeaderCreditBalanceBadge({ effectiveBalance }: { effectiveBalance: number }) {
  const recentCreditDelta = useUserStore((s) => s.recentCreditDelta);
  const clearRecentCreditDelta = useUserStore((s) => s.clearRecentCreditDelta);
  const [displayBalance, setDisplayBalance] = useState<number>(effectiveBalance);
  const [isHighlighting, setIsHighlighting] = useState(false);

  const activeDelta =
    recentCreditDelta &&
    recentCreditDelta.delta !== 0 &&
    Date.now() - recentCreditDelta.timestamp < 4200
      ? recentCreditDelta
      : null;

  useEffect(() => {
    if (!activeDelta) {
      setDisplayBalance(effectiveBalance);
      setIsHighlighting(false);
      return;
    }

    setIsHighlighting(true);
    const startVal = activeDelta.from;
    const endVal = effectiveBalance;
    const duration = 680;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayBalance(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    const glowTimer = setTimeout(() => {
      setIsHighlighting(false);
    }, 1600);

    const remainingMs = Math.max(400, 3600 - (Date.now() - activeDelta.timestamp));
    const clearTimer = setTimeout(() => {
      clearRecentCreditDelta();
    }, remainingMs);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(glowTimer);
      clearTimeout(clearTimer);
    };
  }, [activeDelta?.timestamp, activeDelta?.from, effectiveBalance, clearRecentCreditDelta]);

  const isPositive = (activeDelta?.delta ?? 0) > 0;

  return (
    <div className="relative hidden sm:inline-flex items-center shrink-0">
      <Link
        href="/wallet"
        title="View credit history and balance"
        className={cn(
          badgeVariants({ variant: 'gold', size: 'default' }),
          'inline-flex items-center gap-1.5 py-1 px-2.5 lg:px-3 rounded-full border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 hover:border-amber-400/60 transition-all duration-300 text-xs font-semibold select-none shadow-2xs cursor-pointer whitespace-nowrap',
          isHighlighting &&
            (isPositive
              ? 'ring-2 ring-emerald-400/70 bg-amber-400/30 border-amber-300 shadow-md shadow-amber-400/25 scale-[1.03]'
              : 'ring-2 ring-amber-400/60 bg-amber-400/25 border-amber-300 scale-[1.02]')
        )}
      >
        <Coins
          className={cn(
            'size-3.5 text-amber-400 shrink-0 transition-transform duration-300',
            isHighlighting && 'scale-125 text-amber-300'
          )}
        />
        <span className="hidden lg:inline text-zinc-300 font-medium text-xs">Credit balance:</span>
        <span
          className={cn(
            'font-mono tabular-nums font-bold tracking-tight transition-colors duration-300',
            isHighlighting && isPositive ? 'text-emerald-300' : 'text-amber-300'
          )}
        >
          {displayBalance} CR
        </span>
      </Link>

      {activeDelta && (
        <div
          key={activeDelta.timestamp}
          role="status"
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute -bottom-6 right-1 z-50 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-mono font-bold tabular-nums shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-200',
            isPositive
              ? 'bg-zinc-950/95 border border-emerald-400/60 text-emerald-300 shadow-emerald-500/20'
              : 'bg-zinc-950/95 border border-amber-400/50 text-amber-300 shadow-amber-500/15'
          )}
        >
          {isPositive && <Coins className="size-2.5 text-amber-400 shrink-0" />}
          <span>
            {isPositive ? `+${activeDelta.delta}` : activeDelta.delta} CR
          </span>
        </div>
      )}
    </div>
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
  userAvatarUrl?: string | null;
  topRightBadge?: React.ReactNode;
  currentStep?: number;
  onSignInClick?: () => void;
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
  userAvatarUrl = null,
  topRightBadge,
  currentStep = 1,
  onSignInClick,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const { isSearchOpen, setSearchOpen, toggleSearch } = useUIStore();
  const { user, isHydrated } = useUserStore();
  const isAdminUser = Boolean(user?.role && user.role.toLowerCase() === 'admin');
  const isManagementRoute = Boolean(pathname?.startsWith('/management') || isAdminUser);

  // Ensure global search is closed in management console
  useEffect(() => {
    if (isManagementRoute && isSearchOpen) {
      setSearchOpen(false);
    }
  }, [isManagementRoute, isSearchOpen, setSearchOpen]);

  const resolveEffectiveName = () => {
    if (userName && userName.trim().toLowerCase() !== 'client') return userName.trim();
    if (user?.name && user.name.trim().toLowerCase() !== 'client') return user.name.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    if (user?.email && user.email.includes('@')) return user.email.split('@')[0];
    return 'Welcome';
  };
  const effectiveName = isHydrated ? resolveEffectiveName() : (userName || 'Welcome');
  const effectiveEmail = isHydrated ? (userEmail || user?.email) : userEmail;
  const effectiveAvatarUrl = isHydrated ? (userAvatarUrl || user?.avatarUrl) : userAvatarUrl;
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
      : pathname === '/wallet'
      ? 'Credit History'
      : pathname === '/billing'
      ? 'Billing'
      : pathname === '/notifications'
      ? 'Notifications'
      : pathname === '/profile'
      ? 'Account Profile'
      : pathname === '/management'
      ? 'Studio Overview'
      : pathname === '/management/projects'
      ? 'Client Projects'
      : pathname === '/management/clients'
      ? 'Studio Clients'
      : pathname === '/management/inbox'
      ? 'Client Messages'
      : pathname === '/management/ledger'
      ? 'Credit History'
      : pathname === '/management/billing'
      ? 'Billing'
      : pathname === '/management/team'
      ? 'Team Access'
      : pathname?.startsWith('/management')
      ? 'Studio Management'
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
          'dark h-13 sm:h-13.5 border-b border-zinc-800/80 flex items-center shrink-0 bg-zinc-950/95 text-zinc-100 backdrop-blur-md sticky top-0 z-40 shadow-xs w-full max-w-full overflow-hidden',
          mode === 'standalone' ? 'px-0' : 'px-2.5 sm:px-4 lg:px-6 justify-between gap-2'
        )}
      >
        {/* =================================================================== */}
        {/* Left Section: Sidebar Toggle & Brand Identity (Aligned with Sidebar) */}
        {/* =================================================================== */}
        <div
          className={cn(
            'h-full flex items-center min-w-0 transition-[width] duration-200 ease-linear select-none',
            mode === 'standalone'
              ? cn(
                  'shrink-0 border-r border-zinc-800/80 bg-zinc-950',
                  isSidebarCollapsed
                    ? 'w-(--sidebar-width-icon) justify-center px-1.5'
                    : 'w-auto md:w-(--sidebar-width) px-2 sm:px-3.5'
                )
              : 'shrink-0 gap-1.5 sm:gap-2.5'
          )}
        >
          <div
            className={cn(
              'flex items-center min-w-0',
              mode === 'standalone' && 'w-full',
              isSidebarCollapsed ? 'justify-center' : 'gap-2 sm:gap-2.5'
            )}
          >
            {mode === 'standalone' && (
              <SidebarTrigger className="-ml-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 size-8 rounded-md transition-colors cursor-pointer shrink-0" />
            )}

            {/* Unified Brand Logo & Title across all modes */}
            <Link
              href={isManagementRoute ? '/management' : '/projects'}
              className={cn(
                'flex items-center gap-2 group select-none shrink-0 min-w-0',
                isSidebarCollapsed && 'hidden'
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-black text-zinc-950 text-2xs tracking-wider shadow-xs shadow-amber-400/30 group-hover:scale-105 transition-transform shrink-0">
                ART
              </div>
              <div className="hidden sm:block min-w-0 truncate">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-white tracking-tight text-xs truncate">
                    Humantek Art
                  </span>
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
              <Separator orientation="vertical" className="h-4 hidden sm:block bg-zinc-700/80 shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBackDisabled}
                onClick={handleBack}
                className="gap-1 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors h-7.5 px-2 rounded-md cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden lg:inline">Back</span>
              </Button>
            </>
          )}
        </div>

        {/* =================================================================== */}
        {/* Main Content Header Bar (Breadcrumbs, Search & Profile Actions)     */}
        {/* =================================================================== */}
        <div
          className={cn(
            'flex-1 flex items-center justify-between min-w-0 h-full gap-1.5 sm:gap-2',
            mode === 'standalone' ? 'px-2.5 sm:px-4 lg:px-6' : ''
          )}
        >
          {/* Left: Breadcrumbs Trail */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {mode !== 'auth' && breadcrumbPage && (
              <Breadcrumb className="hidden lg:block">
                <BreadcrumbList className="gap-1.5 sm:gap-2 text-xs">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href={isManagementRoute ? '/management' : '/projects'}
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
        {/* Center Section: Interactive Command Search Pill (hidden in auth & admin management) */}
        {/* =================================================================== */}
        {mode !== 'auth' && !isManagementRoute ? (
          <div className={cn(
            "items-center justify-center min-w-0 max-w-xs mx-auto",
            mode === 'wizard' ? "hidden sm:flex flex-1 px-1 lg:px-3" : "flex flex-1 px-1 lg:px-3"
          )}>
            {/* Desktop & Tablet Search Bar Pill */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center justify-between gap-2 h-8 px-2.5 lg:px-3 rounded-lg border-zinc-700/70 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer w-full min-w-0 max-w-56 lg:max-w-64 shadow-2xs text-xs select-none font-normal"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <Search className="size-3.5 text-zinc-400 shrink-0" />
                <span className="truncate text-xs font-medium text-zinc-300">
                  <span className="hidden md:inline">Type to search...</span>
                  <span className="md:hidden">Search...</span>
                </span>
              </div>
              <Kbd className="hidden lg:inline-flex bg-zinc-950 border border-zinc-700/80 text-2xs font-mono tabular-nums text-zinc-400 px-1.5 py-0.5 h-4.5 rounded shadow-2xs shrink-0">
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
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          {mode === 'auth' ? (
            <div className="flex items-center gap-3">
              <a
                href="mailto:support@humantek.art"
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer select-none"
              >
                Need help?
              </a>
            </div>
          ) : !isHydrated ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-busy="true" aria-label="Loading account">
              <Skeleton className="hidden sm:block h-7 w-20 lg:w-28 rounded-full bg-white/10 border border-white/10" />
              <Skeleton className="size-8.5 rounded-full bg-white/10 border border-white/15 shrink-0" />
            </div>
          ) : !effectiveEmail ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isManagementRoute && topRightBadge}
              {onSignInClick ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSignInClick}
                  className="h-8 px-3 rounded-lg border-amber-400/40 text-amber-400 hover:text-white hover:bg-amber-400/20 text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  Sign In
                </Button>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(pathname || '/projects')}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg border-amber-400/40 text-amber-400 hover:text-white hover:bg-amber-400/20 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Quick Producer Chat Trigger with Reusable Tooltip */}
              <HeaderChatButton mode={mode} />

              {/* Notification Popover Dropdown */}
              <DashboardNotificationDropdown />

              {/* Credit Balance Pill or Admin Badge */}
              {isManagementRoute ? (
                <div className="hidden md:inline-flex items-center gap-1.5 py-1 px-2.5 lg:px-3 rounded-full border border-amber-400/40 bg-amber-400/15 text-amber-300 text-xs font-semibold select-none shadow-2xs shrink-0">
                  <ShieldCheck className="size-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-xs tracking-tight">
                    {user?.teamRole === 'owner'
                      ? 'Studio Owner'
                      : user?.teamRole === 'viewer'
                        ? 'Viewer · Read-Only'
                        : user?.teamRole === 'manager'
                          ? 'Studio Manager'
                          : 'Studio Admin'}
                  </span>
                </div>
              ) : !isBalanceLoaded ? (
                <div
                  className="hidden sm:inline-flex items-center gap-1.5 py-1 px-2.5 lg:px-3 rounded-full border border-amber-400/40 bg-amber-400/15 text-xs font-semibold select-none shadow-2xs shrink-0"
                  aria-label="Loading balance"
                >
                  <Coins className="size-3.5 text-amber-400/60 animate-pulse shrink-0" />
                  <span className="hidden lg:inline text-zinc-300 font-medium text-xs">Credit balance:</span>
                  <Skeleton className="h-3.5 w-11 rounded-xs bg-amber-400/25" />
                </div>
              ) : (
                <HeaderCreditBalanceBadge effectiveBalance={effectiveBalance} />
              )}

              {/* Optional Top-Right Action Badge (hidden on management console) */}
              {!isManagementRoute && topRightBadge}

              {/* User Profile Avatar Dropdown */}
              <DashboardProfileDropdown
                userEmail={effectiveEmail}
                userName={effectiveName}
                userAvatarUrl={effectiveAvatarUrl}
                walletBalance={effectiveBalance}
              />
            </>
          )}
        </div>
      </div>
    </header>

      {/* Global Command / Quick Search Dialog (only in app modes outside management) */}
      {mode !== 'auth' && !isManagementRoute && (
        <DashboardSearchDialog
          open={isSearchOpen}
          onOpenChange={setSearchOpen}
          walletBalance={effectiveBalance}
        />
      )}
    </>
  );
}
