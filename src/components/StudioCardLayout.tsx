'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Coins,
  FolderKanban,
  Ticket,
  ShieldCheck,
  Sparkles,
  LogOut,
  ChevronDown,
  User,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { HorizontalStepper } from '@/components/HorizontalStepper';
import { cn } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';

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
  walletBalance = 0,
  userEmail = null,
  topRightBadge,
  footerActions,
}: StudioCardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpen: setChatOpen } = useStudioChat();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 1 && mode === 'wizard') {
      onSelectStep(currentStep - 1);
    } else if (pathname !== '/') {
      router.push('/');
    }
  };

  const isBackDisabled = mode === 'wizard' && currentStep === 1 && !onBack;

  return (
    <div
      className={cn(
        'min-h-screen w-full bg-background flex font-sans antialiased',
        mode === 'standalone' ? 'flex-col lg:flex-row' : 'flex-col'
      )}
    >
      {/* ========================================================= */}
      {/* LEFT SIDEBAR PANEL (Only rendered in standalone mode)      */}
      {/* ========================================================= */}
      {mode === 'standalone' && (
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-card border-b lg:border-b-0 lg:border-r border-border p-5 sm:p-6 flex flex-col justify-between select-none lg:h-screen lg:sticky lg:top-0 overflow-y-auto z-30">
          <div className="space-y-6">
            {/* Brand Logo Header */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                ART
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-foreground tracking-tight text-lg">
                    Humantek Art
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <span className="block text-xs tracking-wider uppercase font-bold text-amber-600">
                  Creator Credits Studio
                </span>
              </div>
            </Link>

            {/* Standalone App Navigation Links */}
            <nav className="space-y-1.5">
              <Link href="/">
                <Button
                  variant={pathname === '/' ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-sm font-semibold gap-2.5 h-10 rounded-xl"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Creator Studio Wizard</span>
                </Button>
              </Link>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setChatOpen(true)}
                className="w-full justify-start text-sm font-semibold gap-2.5 h-10 rounded-xl cursor-pointer hover:bg-secondary/60 text-foreground"
              >
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span>Chat with Producer</span>
              </Button>

              <Link href="/projects">
                <Button
                  variant={pathname === '/projects' ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-sm font-semibold gap-2.5 h-10 rounded-xl"
                >
                  <FolderKanban className="w-4 h-4 text-amber-600" />
                  <span>Your Projects Tracker</span>
                </Button>
              </Link>

              <Link href="/redeem-code">
                <Button
                  variant={pathname === '/redeem-code' ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-sm font-semibold gap-2.5 h-10 rounded-xl"
                >
                  <Ticket className="w-4 h-4 text-amber-600" />
                  <span>Redeem Promo Voucher</span>
                </Button>
              </Link>

              <Link href="/management">
                <Button
                  variant={pathname === '/management' ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-sm font-semibold gap-2.5 h-10 rounded-xl"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Agency Console</span>
                </Button>
              </Link>
            </nav>
          </div>

          {/* Sidebar Bottom Status & Shortcuts */}
          <div className="pt-6 border-t border-border/60 space-y-3 mt-6 lg:mt-0">
            {/* Wallet Balance Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">Studio Balance</span>
              </div>
              <CreditValue value={walletBalance} size="sm" variant="pill" />
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA (Full Width in Wizard Mode)              */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-background min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-border/80 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-md sticky top-0 z-30">
          {/* Left: Brand Logo & Back Action */}
          <div className="flex items-center gap-3 shrink-0">
            {mode === 'wizard' ? (
              <>
                <Link href="/" className="flex items-center gap-2.5 group select-none">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                    ART
                  </div>
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-foreground tracking-tight text-sm">
                        Humantek Art
                      </span>
                      <Sparkles className="w-3 h-3 text-amber-500" />
                    </div>
                    <span className="block text-[9px] tracking-wider uppercase font-bold text-amber-600 leading-none">
                      Creator Credits Studio
                    </span>
                  </div>
                </Link>

                {showBack && (currentStep > 1 || onBack) && (
                  <>
                    <Separator orientation="vertical" className="h-4 hidden sm:block bg-border" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={isBackDisabled}
                      onClick={handleBack}
                      className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground h-7 px-2 rounded-lg"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">{backLabel}</span>
                    </Button>
                  </>
                )}

                <Separator orientation="vertical" className="h-4 hidden sm:block bg-border" />

                <Breadcrumb className="hidden sm:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/" className="text-xs text-muted-foreground hover:text-foreground">
                        Studio
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs font-semibold text-foreground">
                        Step {currentStep} of 5
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </>
            ) : (
              /* Standalone Mode: Back Action & Breadcrumb */
              <>
                {showBack && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBackDisabled}
                    onClick={handleBack}
                    className="gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-amber-700 h-8 px-2"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    <span>{backLabel}</span>
                  </Button>
                )}

                <Separator orientation="vertical" className="h-4 hidden sm:block bg-border" />

                <Breadcrumb className="hidden sm:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/" className="text-sm text-muted-foreground hover:text-foreground">
                        Studio
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-sm font-semibold text-foreground">
                        {backLabel.replace(/^Back to\s+/, '')}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </>
            )}
          </div>

          {/* Center: Flexible Spacer */}
          <div className="flex-1" />

          {/* Right: Balance Pill & User Account Profile */}
          <div className="flex items-center gap-2.5 shrink-0">
            {topRightBadge}

            {/* Balance Pill for Wizard Mode */}
            {mode === 'wizard' && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/80 text-xs font-semibold select-none">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-muted-foreground font-medium">Balance:</span>
                <span className="text-foreground font-bold">{walletBalance} CR</span>
              </div>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 p-1.5 pl-2.5 rounded-full border border-border/80 bg-secondary/40 hover:bg-secondary transition-colors cursor-pointer select-none text-sm font-semibold h-9"
                  />
                }
              >
                <Avatar className="w-7 h-7 text-xs bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  <AvatarFallback>
                    {userEmail ? userEmail.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[140px] truncate text-foreground text-sm font-medium pr-1">
                  {userEmail || 'Creator Studio'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pr-1" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuLabel className="font-semibold text-xs text-foreground px-2 py-1.5">
                  Signed in as
                  <span className="block font-normal text-muted-foreground truncate">
                    {userEmail || 'guest@creator.studio'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer w-full"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span>Chat with Producer</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link href="/projects" className="flex items-center gap-2 cursor-pointer w-full">
                      <FolderKanban className="w-4 h-4 text-amber-600" />
                      <span>Your Projects Tracker</span>
                    </Link>
                  }
                />
                <DropdownMenuItem
                  render={
                    <Link href="/redeem-code" className="flex items-center gap-2 cursor-pointer w-full">
                      <Ticket className="w-4 h-4 text-amber-600" />
                      <span>Redeem Promo Voucher</span>
                    </Link>
                  }
                />
                <DropdownMenuItem
                  render={
                    <Link href="/management" className="flex items-center gap-2 cursor-pointer w-full">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Agency Console</span>
                    </Link>
                  }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 cursor-pointer flex items-center gap-2"
                  onClick={() => {
                    router.push('/login');
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dedicated Horizontal Stepper Bar (Below the Navbar, Centered) */}
        {mode === 'wizard' && (
          <div className="w-full border-b border-border/80 bg-card/90 backdrop-blur-md py-3 sm:py-3.5 px-4 sm:px-6 sticky top-16 z-20 shadow-2xs transition-all">
            <div className="max-w-4xl mx-auto flex items-center justify-center">
              <HorizontalStepper
                currentStep={currentStep}
                onSelectStep={onSelectStep}
                isPackageSelected={isPackageSelected}
              />
            </div>
          </div>
        )}

        {/* Main Step / Page Content */}
        <div className="flex-1 p-3.5 sm:p-4 lg:p-5 w-full max-w-[1600px] mx-auto">
          {children}
        </div>

        {/* Bottom Footer Actions Bar (If provided) */}
        {footerActions && (
          <footer className="border-t border-border/80 px-4 py-3 sm:px-6 sm:py-3.5 bg-background/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20">
            <div className="w-full max-w-[1600px] mx-auto">
              {footerActions}
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
