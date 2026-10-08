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

function StudioSidebarNavigation({ pathname, user }: StudioSidebarNavigationProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { setIsOpen: setChatOpen, unreadCounts, isOpen } = useStudioChat();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const handleMessagesClick = () => {
    // When clicking messages in mobile view, auto-close the dashboard sidebar sheet because the right messages drawer will open
    if (isMobile) {
      setChatOpen(true);
      setOpenMobile(false);
    } else {
      setChatOpen(!isOpen);
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarContent className="p-1.5 space-y-1.5 flex-1">
      {/* Main Studio Navigation Group */}
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
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
            <SidebarMenuItem>
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

            {/* 4. Management Console (Strictly for Admins & Staff; never shown to client role) */}
            {Boolean(
              user?.role &&
              user.role.toLowerCase() !== 'client' &&
              user.role.toLowerCase() !== 'user' &&
              (
                user.role.toLowerCase() === 'admin' ||
                user.role.toLowerCase() === 'producer' ||
                user.role.toLowerCase() === 'staff' ||
                user.email === 'dev@localhost' ||
                user.email === 'admin@humantek.art' ||
                user.email === 'huzaifa14321furqan@gmail.com'
              )
            ) && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith('/management')}
                  onClick={handleNavClick}
                  render={<Link href="/management" onClick={handleNavClick} />}
                  tooltip="Management"
                  className={cn(
                    'h-9 min-h-9 px-2.5 rounded-lg text-sm font-medium gap-2.5 transition-colors cursor-pointer',
                    pathname.startsWith('/management')
                      ? 'bg-amber-500/18 text-amber-950 dark:text-amber-200 font-semibold shadow-2xs'
                      : 'text-sidebar-foreground/80 hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <ShieldCheck
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      pathname.startsWith('/management')
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground group-hover/menu-button:text-foreground'
                    )}
                  />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

  // Fallback client check for expired sessions (Server proxy handles primary optimistic redirect)
  useEffect(() => {
    if (isHydrated && !user?.email) {
      const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/projects';
      router.replace(`/login?next=${encodeURIComponent(currentUrl)}`);
    }
  }, [isHydrated, user?.email, router]);

  const effectiveName = user?.name || '';
  const effectiveEmail = userEmail || user?.email || '';
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
