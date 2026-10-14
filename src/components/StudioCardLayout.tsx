'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';
import {
  FolderKanban,
  Ticket,
  MessageSquare,
  LayoutDashboard,
  Receipt,
  Bell,
  Plus,
  PencilLine,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarRail,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { HorizontalStepper } from '@/components/HorizontalStepper';
import { StudioBackground } from '@/components/StudioBackground';
import { DashboardHeader } from '@/components/header/DashboardHeader';
import { cn } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore, type StudioUser } from '@/lib/userStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { ChatGate } from '@/components/chat/ChatGate';
import { StudioNewProjectButton } from '@/components/StudioNewProjectButton';
import { useActiveWizardDraft } from '@/lib/wizardStore';

interface StudioCardLayoutProps {
  children: React.ReactNode;
  mode?: 'wizard' | 'standalone';
  fullBleed?: boolean;
  currentStep?: number;
  onSelectStep?: (step: number) => void;
  isPackageSelected?: boolean;
  onBack?: () => void;
  backLabel?: string;
  showBack?: boolean;
  walletBalance?: number;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  topRightBadge?: React.ReactNode;
  footerActions?: React.ReactNode;
  selectedPackageName?: string;
  selectedPackagePrice?: number;
  selectedPackageCredits?: number;
  selectedServicesCount?: number;
  usedCredits?: number;
  remainingCredits?: number;
  isPolicyAccepted?: boolean;
  isBriefCompleted?: boolean;
  hideStepper?: boolean;
  onSignInClick?: () => void;
}

interface StudioSidebarNavigationProps {
  pathname: string;
  user: StudioUser | null;
}

function SidebarAdminCommunicationsItem({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { unreadCounts } = useStudioChat();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = pathname.startsWith('/management/inbox');

  return (
    <SidebarMenuItem data-chat-entry="admin-communications">
      <SidebarMenuButton
        isActive={isActive}
        onClick={handleNavClick}
        render={<Link href="/management/inbox" onClick={handleNavClick} />}
        tooltip="Client Messages"
        className={cn(
          'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
          isActive
            ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
            : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
        )}
      >
        <MessageSquare
          className={cn(
            'size-4 shrink-0 transition-colors',
            isActive ? 'text-brand-text dark:text-amber-400' : 'text-muted-foreground group-hover/menu-button:text-foreground'
          )}
        />
        <span className="truncate group-data-[collapsible=icon]:hidden">Client Messages</span>
        {totalUnreadChat > 0 && (
          <SidebarMenuBadge className="bg-amber-400 text-zinc-950 font-black font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1 shadow-xs shadow-amber-400/25">
            {totalUnreadChat}
          </SidebarMenuBadge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarClientMessagesItem() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { setIsOpen: setChatOpen, unreadCounts, isOpen } = useStudioChat();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const handleMessagesClick = () => {
    if (isMobile) {
      setChatOpen(true);
      setOpenMobile(false);
    } else {
      setChatOpen(!isOpen);
    }
  };

  return (
    <ChatGate>
      <SidebarMenuItem data-chat-entry="sidebar-link">
        <SidebarMenuButton
          isActive={isOpen}
          onClick={handleMessagesClick}
          tooltip="Messages"
          className={cn(
            'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
            isOpen
              ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
              : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <MessageSquare
            className={cn(
              'size-4 shrink-0 transition-colors',
              isOpen ? 'text-brand-text dark:text-amber-400' : 'text-muted-foreground group-hover/menu-button:text-foreground'
            )}
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">Messages</span>
          {totalUnreadChat > 0 && (
            <SidebarMenuBadge className="bg-amber-400 text-zinc-950 font-black font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1 shadow-xs shadow-amber-400/25">
              {totalUnreadChat}
            </SidebarMenuBadge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </ChatGate>
  );
}

function SidebarNotificationsItem({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = pathname.startsWith('/notifications');

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={handleNavClick}
        render={<Link href="/notifications" onClick={handleNavClick} />}
        tooltip="Notifications"
        className={cn(
          'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
          isActive
            ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
            : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
        )}
      >
        <Bell
          className={cn(
            'size-4 shrink-0 transition-colors',
            isActive ? 'text-brand-text dark:text-amber-400' : 'text-muted-foreground group-hover/menu-button:text-foreground'
          )}
        />
        <span className="truncate group-data-[collapsible=icon]:hidden">Notifications</span>
        {unreadCount > 0 && (
          <SidebarMenuBadge className="bg-amber-400 text-zinc-950 font-black font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1 shadow-xs shadow-amber-400/25">
            {unreadCount}
          </SidebarMenuBadge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Draft-aware sidebar entry point into the project wizard.
 * Shows "Resume Project" (with current step) when a saved draft exists,
 * otherwise "New Project".
 */
function SidebarNewProjectItem() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { hasDraft, step } = useActiveWizardDraft();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const label = hasDraft ? 'Resume Project' : 'New Project';
  const Icon = hasDraft ? PencilLine : Plus;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleNavClick}
        render={<Link href="/new-project" onClick={handleNavClick} />}
        tooltip={hasDraft ? `Resume Project (Step ${step})` : 'New Project'}
        className="h-9 min-h-9 px-2.5 rounded-lg text-sm font-semibold gap-2.5 transition-colors cursor-pointer text-brand-text dark:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30"
      >
        <Icon className="size-4 shrink-0 text-brand-text dark:text-amber-400" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
        {hasDraft && (
          <SidebarMenuBadge className="bg-amber-400 text-zinc-950 font-bold font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:hidden shadow-xs shadow-amber-400/25">
            Step {step}
          </SidebarMenuBadge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function StudioSidebarNavigation({ pathname, user }: StudioSidebarNavigationProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isAdmin = Boolean(
    user?.role &&
    user.role.toLowerCase() === 'admin'
  );

  return (
    <SidebarContent className="p-1.5 space-y-1.5 flex-1">
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {isAdmin ? (
              // =========================================================
              // ADMINISTRATOR NAVIGATION MENU (Strict Operations Console)
              // =========================================================
              <>
                {/* 1. Overview */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/management'}
                    onClick={handleNavClick}
                    render={<Link href="/management" onClick={handleNavClick} />}
                    tooltip="Agency Overview"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname === '/management'
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <LayoutDashboard
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/management'
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 2. Client Projects */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith('/management/projects')}
                    onClick={handleNavClick}
                    render={<Link href="/management/projects" onClick={handleNavClick} />}
                    tooltip="Client Projects"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname.startsWith('/management/projects')
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <FolderKanban
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname.startsWith('/management/projects')
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Client Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 3. Client Messages (Realtime Chat) */}
                <SidebarAdminCommunicationsItem pathname={pathname} />

                {/* 4. Credit History */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith('/management/ledger')}
                    onClick={handleNavClick}
                    render={<Link href="/management/ledger" onClick={handleNavClick} />}
                    tooltip="Credit History"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname.startsWith('/management/ledger')
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Receipt
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname.startsWith('/management/ledger')
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Credit History</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 5. Notifications */}
                <SidebarNotificationsItem pathname={pathname} />
              </>
            ) : (
              // =========================================================
              // CREATOR CLIENT NAVIGATION MENU (Clean Self-Service)
              // =========================================================
              <>
                {/* 0. New / Resume Project (draft-aware) */}
                <SidebarNewProjectItem />

                {/* 1. My Projects */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/projects'}
                    onClick={handleNavClick}
                    render={<Link href="/projects" onClick={handleNavClick} />}
                    tooltip="My Projects"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname === '/projects'
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <FolderKanban
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/projects'
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">My Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 2. Messages */}
                <SidebarClientMessagesItem />

                {/* 3. Credit History */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith('/wallet')}
                    onClick={handleNavClick}
                    render={<Link href="/wallet" onClick={handleNavClick} />}
                    tooltip="Credit History"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname.startsWith('/wallet')
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Receipt
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname.startsWith('/wallet')
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Credit History</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 4. Promo Code */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/redeem-code'}
                    onClick={handleNavClick}
                    render={<Link href="/redeem-code" onClick={handleNavClick} />}
                    tooltip="Promo Code"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname === '/redeem-code'
                        ? 'bg-amber-400/15 text-brand-text dark:text-amber-300 font-bold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Ticket
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/redeem-code'
                          ? 'text-brand-text dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Promo Code</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 5. Notifications */}
                <SidebarNotificationsItem pathname={pathname} />
              </>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}

export function StudioCardLayout({
  children,
  mode = 'wizard',
  fullBleed = false,
  currentStep = 1,
  onSelectStep = () => {},
  isPackageSelected = false,
  onBack,
  backLabel = 'Back',
  showBack = true,
  walletBalance,
  userEmail = null,
  userAvatarUrl = null,
  topRightBadge,
  footerActions,
  selectedPackageName,
  selectedPackagePrice,
  selectedPackageCredits,
  selectedServicesCount,
  usedCredits,
  remainingCredits,
  isPolicyAccepted,
  isBriefCompleted,
  hideStepper = false,
  onSignInClick,
}: StudioCardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const topLoader = useTopLoader();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 1 && mode === 'wizard') {
      onSelectStep(currentStep - 1);
    } else if (pathname !== '/projects') {
      topLoader.start();
      router.push('/projects');
    }
  };

  const isBackDisabled = mode === 'wizard' && currentStep === 1 && !onBack;
  const { user, isHydrated, isSessionVerified } = useUserStore();

  // Fallback client check for expired sessions and role confinement
  useEffect(() => {
    if (!isHydrated || !isSessionVerified) return;

    if (!user?.email) {
      if (pathname.startsWith('/management')) {
        router.replace('/admin-login');
      } else if (!pathname.startsWith('/new-project')) {
        const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/projects';
        router.replace(`/login?next=${encodeURIComponent(currentUrl)}`);
      }
      return;
    }

    const isAdminUser = Boolean(user.role && user.role.toLowerCase() === 'admin');

    if (isAdminUser && !pathname.startsWith('/management')) {
      router.replace('/management');
    } else if (!isAdminUser && pathname.startsWith('/management')) {
      router.replace('/projects');
    }
  }, [isHydrated, isSessionVerified, user?.email, user?.role, pathname, router]);

  const effectiveName = isHydrated ? (user?.name || '') : '';
  const effectiveEmail = isHydrated ? (userEmail || user?.email || '') : (userEmail || '');
  const effectiveAvatarUrl = isHydrated ? (userAvatarUrl || user?.avatarUrl) : userAvatarUrl;
  const effectiveBalance =
    walletBalance !== undefined
      ? walletBalance
      : isHydrated
      ? user?.walletBalance
      : undefined;

  // =========================================================================
  // 1. STANDALONE MODE: Full shadcn & ReUI Collapsible Sidebar Architecture
  // =========================================================================
  if (mode === 'standalone') {
    return (
      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
        className={cn(
          "w-full bg-background flex flex-col font-sans antialiased",
          fullBleed ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"
        )}
      >
        {/* 1. Full-Width Black Dashboard Header (Shadcn Studio Style) */}
        <DashboardHeader
          mode="standalone"
          showBack={showBack}
          backLabel={backLabel}
          handleBack={handleBack}
          isBackDisabled={isBackDisabled}
          walletBalance={effectiveBalance}
          userEmail={effectiveEmail}
          userName={effectiveName}
          userAvatarUrl={effectiveAvatarUrl}
          topRightBadge={topRightBadge === undefined ? <StudioNewProjectButton /> : topRightBadge}
          onSignInClick={onSignInClick}
        />

        <div
          className={cn(
            "flex flex-1 w-full min-h-0 relative",
            fullBleed && "h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.375rem)] max-h-[calc(100vh-3.25rem)] sm:max-h-[calc(100vh-3.375rem)] overflow-hidden"
          )}
        >
          {/* 2. Official Ultra-Compact shadcn Sidebar sitting below the top header */}
          <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none top-13 sm:top-13.5 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.375rem)]">
            {/* Sidebar Navigation Content with Mobile Auto-Close */}
            <StudioSidebarNavigation pathname={pathname} user={user} />
            <SidebarRail />
          </Sidebar>

          {/* 4. Main Page View Inset */}
          <SidebarInset
            className={cn(
              "flex-1 flex flex-col min-w-0 bg-background min-h-0 relative isolate",
              fullBleed && "h-full max-h-full overflow-hidden"
            )}
          >
            <StudioBackground />

            {/* Main Step / Page Content */}
            <div
              className={cn(
                'flex-1 w-full relative z-10 flex flex-col min-h-0',
                fullBleed
                  ? 'p-0 max-w-none h-full max-h-full overflow-hidden'
                  : 'p-3.5 sm:p-4 lg:p-5 mx-auto max-w-[1600px]'
              )}
            >
              {!isHydrated ? (
                <div className="space-y-6 pb-24 sm:pb-32 w-full" aria-busy="true">
                  <div className="space-y-2 border-b border-border/60 pb-5">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                  </div>
                  <Skeleton className="h-[520px] w-full rounded-xl border border-border/60" />
                </div>
              ) : (
                children
              )}
            </div>

            {/* Bottom Footer Actions Bar (If provided) */}
            {footerActions && (
              <footer
                id="studio-footer-actions"
                className="border-t border-border/80 px-4 py-3 sm:px-6 sm:py-3.5 bg-background/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20"
              >
                <div className="w-full mx-auto max-w-[1200px]">
                  {footerActions}
                </div>
              </footer>
            )}
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  // =========================================================================
  // 2. WIZARD MODE: Dedicated Clean Stepper Brief Flow
  // =========================================================================
  return (
    <div className="min-h-screen w-full bg-background flex flex-col font-sans antialiased">
      <main className="flex-1 flex flex-col min-w-0 bg-background min-h-screen relative isolate">
        <StudioBackground />

        {/* Top Black Dashboard Header (Shadcn Studio Style) */}
        <DashboardHeader
          mode="wizard"
          currentStep={currentStep}
          showBack={showBack}
          backLabel={backLabel}
          handleBack={handleBack}
          isBackDisabled={isBackDisabled}
          walletBalance={effectiveBalance}
          userEmail={effectiveEmail}
          userName={effectiveName}
          userAvatarUrl={effectiveAvatarUrl}
          topRightBadge={topRightBadge}
        />

        {/* Dedicated Horizontal Stepper Bar */}
        {!hideStepper && (
          <div className="w-full border-b border-border/70 bg-background/95 backdrop-blur-md py-2.5 sm:py-3.5 px-3 sm:px-4 md:px-6 transition-all">
            <div className="w-full max-w-[1200px] mx-auto flex items-center justify-center">
              <div className="w-full max-w-[880px]">
                <HorizontalStepper
                  currentStep={currentStep}
                  onSelectStep={onSelectStep}
                  isPackageSelected={isPackageSelected}
                  selectedPackageName={selectedPackageName}
                  selectedPackagePrice={selectedPackagePrice}
                  selectedPackageCredits={selectedPackageCredits}
                  selectedServicesCount={selectedServicesCount}
                  usedCredits={usedCredits}
                  remainingCredits={remainingCredits}
                  isPolicyAccepted={isPolicyAccepted}
                  isBriefCompleted={isBriefCompleted}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Step / Page Content */}
        <div className={cn("flex-1 p-3 sm:p-4 md:p-6 lg:p-8 w-full mx-auto relative z-10 max-w-[1200px]", footerActions && "pb-28 sm:pb-32 lg:pb-36")}>
          {children}
        </div>

        {/* Bottom Footer Actions Bar (If provided) */}
        {footerActions && (
          <footer
            id="studio-footer-actions"
            className="border-t border-border/80 px-3.5 sm:px-6 py-2.5 sm:py-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-background/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20"
          >
            <div className="w-full mx-auto max-w-[1200px]">
              {footerActions}
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
