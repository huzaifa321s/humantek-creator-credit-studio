'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Coins,
  FolderKanban,
  Ticket,
  Sparkles,
  LogOut,
  ChevronDown,
  User,
  MessageSquare,
  ShieldCheck,
  LayoutDashboard,
  Landmark,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { CreditValue } from '@/components/ui/credit-value';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { HorizontalStepper } from '@/components/HorizontalStepper';
import { StudioBackground } from '@/components/StudioBackground';
import { DashboardHeader } from '@/components/header/DashboardHeader';
import { cn } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { ChatGate } from '@/components/chat/ChatGate';

interface StudioCardLayoutProps {
  children: React.ReactNode;
  mode?: 'wizard' | 'standalone';
  currentStep?: number;
  onSelectStep?: (step: number) => void;
  isPackageSelected?: boolean;
  onBack?: () => void;
  backLabel?: string;
  showBack?: boolean;
  walletBalance?: number;
  userEmail?: string | null;
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
}

interface StudioSidebarNavigationProps {
  pathname: string;
  user: any;
}

function SidebarAdminCommunicationsItem({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { unreadCounts } = useStudioChat();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = pathname === '/management' && typeof window !== 'undefined' && window.location.search.includes('tab=messages');

  return (
    <SidebarMenuItem data-chat-entry="admin-communications">
      <SidebarMenuButton
        isActive={isActive}
        onClick={handleNavClick}
        render={<Link href="/management?tab=messages" onClick={handleNavClick} />}
        tooltip="Client Communications"
        className={cn(
          'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
          isActive
            ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
            : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
        )}
      >
        <MessageSquare
          className={cn(
            'size-4 shrink-0 transition-colors',
            isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground group-hover/menu-button:text-foreground'
          )}
        />
        <span className="truncate group-data-[collapsible=icon]:hidden">Communications</span>
        {totalUnreadChat > 0 && (
          <SidebarMenuBadge className="bg-amber-500 text-white font-bold font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1">
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
              ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
              : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <MessageSquare
            className={cn(
              'size-4 shrink-0 transition-colors',
              isOpen ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground group-hover/menu-button:text-foreground'
            )}
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">Messages</span>
          {totalUnreadChat > 0 && (
            <SidebarMenuBadge className="bg-amber-500 text-white font-bold font-mono tabular-nums text-2xs px-1.5 h-4 min-w-4 rounded-full group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1">
              {totalUnreadChat}
            </SidebarMenuBadge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </ChatGate>
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
    user.role.toLowerCase() !== 'client' &&
    user.role.toLowerCase() !== 'user' &&
    (
      user.role.toLowerCase() === 'admin' ||
      user.email === 'dev@localhost' ||
      user.email === 'admin@humantek.art' ||
      user.email === 'huzaifa14321furqan@gmail.com' ||
      user.email === 'huzaifafurqan22@gmail.com'
    )
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
                {/* 1. Projects & Orders Overview */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/management'}
                    onClick={handleNavClick}
                    render={<Link href="/management" onClick={handleNavClick} />}
                    tooltip="Projects & Orders"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname === '/management'
                        ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <LayoutDashboard
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/management'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Projects & Orders</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 2. Client Communications (Realtime Doorbell Chat) */}
                <SidebarAdminCommunicationsItem pathname={pathname} />

                {/* 3. Manual Payment Orders */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/management' && typeof window !== 'undefined' && window.location.search.includes('tab=wire-orders')}
                    onClick={handleNavClick}
                    render={<Link href="/management?tab=wire-orders" onClick={handleNavClick} />}
                    tooltip="Manual Payments"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Landmark className="size-4 shrink-0 text-muted-foreground group-hover/menu-button:text-foreground transition-colors" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Manual Payments</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 4. Security Alerts */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/management' && typeof window !== 'undefined' && window.location.search.includes('tab=alerts')}
                    onClick={handleNavClick}
                    render={<Link href="/management?tab=alerts" onClick={handleNavClick} />}
                    tooltip="Security Alerts"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <ShieldAlert className="size-4 shrink-0 text-muted-foreground group-hover/menu-button:text-foreground transition-colors" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Security Alerts</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            ) : (
              // =========================================================
              // CREATOR CLIENT NAVIGATION MENU (Clean Self-Service)
              // =========================================================
              <>
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
                        ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <FolderKanban
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/projects'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">My Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* 2. Messages */}
                <SidebarClientMessagesItem />

                {/* 3. Promo Code */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === '/redeem-code'}
                    onClick={handleNavClick}
                    render={<Link href="/redeem-code" onClick={handleNavClick} />}
                    tooltip="Promo Code"
                    className={cn(
                      'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                      pathname === '/redeem-code'
                        ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
                        : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Ticket
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        pathname === '/redeem-code'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground group-hover/menu-button:text-foreground'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Promo Code</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
  currentStep = 1,
  onSelectStep = () => {},
  isPackageSelected = false,
  onBack,
  backLabel = 'Back',
  showBack = true,
  walletBalance,
  userEmail = null,
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
}: StudioCardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 1 && mode === 'wizard') {
      onSelectStep(currentStep - 1);
    } else if (pathname !== '/projects') {
      router.push('/projects');
    }
  };

  const isBackDisabled = mode === 'wizard' && currentStep === 1 && !onBack;
  const { user, isHydrated } = useUserStore();

  // Fallback client check for expired sessions and role confinement
  useEffect(() => {
    if (!isHydrated) return;

    if (!user?.email) {
      if (pathname.startsWith('/management')) {
        router.replace('/admin-login');
      } else if (!pathname.startsWith('/new-project')) {
        const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/projects';
        router.replace(`/login?next=${encodeURIComponent(currentUrl)}`);
      }
      return;
    }

    const isAdminUser =
      user.role === 'admin' ||
      user.email === 'admin@humantek.art' ||
      user.email === 'huzaifafurqan22@gmail.com' ||
      user.email === 'dev@localhost';

    if (isAdminUser && !pathname.startsWith('/management')) {
      router.replace('/management');
    } else if (!isAdminUser && pathname.startsWith('/management')) {
      router.replace('/projects');
    }
  }, [isHydrated, user?.email, user?.role, pathname, router]);

  const effectiveName = isHydrated ? (user?.name || '') : '';
  const effectiveEmail = isHydrated ? (userEmail || user?.email || '') : (userEmail || '');
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
      <SidebarProvider defaultOpen={true} style={{ "--sidebar-width": "15rem" } as React.CSSProperties} className="min-h-screen w-full bg-background flex flex-col font-sans antialiased">
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
          topRightBadge={topRightBadge}
        />

        <div className="flex flex-1 w-full min-h-0 relative">
          {/* 2. Official Ultra-Compact shadcn Sidebar sitting below the top header */}
          <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none top-13 sm:top-13.5 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.375rem)]">
            {/* Sidebar Navigation Content with Mobile Auto-Close */}
            <StudioSidebarNavigation pathname={pathname} user={user} />
            <SidebarRail />
          </Sidebar>

          {/* 4. Main Page View Inset */}
          <SidebarInset className="flex-1 flex flex-col min-w-0 bg-background min-h-0 relative isolate">
            <StudioBackground />

            {/* Main Step / Page Content */}
            <div className="flex-1 p-3.5 sm:p-4 lg:p-5 w-full mx-auto relative z-10 max-w-[1600px]">
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
