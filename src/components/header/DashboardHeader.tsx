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
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { DashboardSearchDialog } from './DashboardSearchDialog';
import { DashboardNotificationDropdown } from './DashboardNotificationDropdown';
import { DashboardProfileDropdown } from './DashboardProfileDropdown';

interface DashboardHeaderProps {
  mode?: 'standalone' | 'wizard';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const { setIsOpen: setChatOpen, unreadCounts } = useStudioChat();
  const { user } = useUserStore();
  const totalUnreadChat = Object.values(unreadCounts || {}).reduce((acc, count) => acc + count, 0);

  const effectiveName = userName || (userEmail ? userEmail.split('@')[0] : user.name);
  const effectiveEmail = userEmail || user.email;
  const effectiveBalance =
    walletBalance !== undefined && walletBalance !== null
      ? walletBalance
      : user.walletBalance;

  // Compute default breadcrumb title if not explicitly passed
  const activePageTitle =
    breadcrumbPage ||
    (pathname === '/projects'
      ? 'Your Projects & Milestones'
      : pathname === '/messages'
      ? 'Producer Messages'
      : pathname === '/management'
      ? 'Agency Console'
      : pathname === '/redeem-code'
      ? 'Redeem Promo Voucher'
      : mode === 'wizard'
      ? 'Project Setup'
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-[11px] shadow-xs group-hover:scale-105 transition-transform shrink-0">
              ART
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white tracking-tight text-xs">
                  Humantek Art
                </span>
                <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              </div>
              <span className="block text-[9px] tracking-wider uppercase font-semibold text-amber-400 leading-tight">
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

          <Separator orientation="vertical" className="h-4 hidden sm:block bg-zinc-700/80" />

          {/* Breadcrumb Navigation Trail */}
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList className="gap-1.5 sm:gap-2 text-xs">
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
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* =================================================================== */}
        {/* Center Section: Interactive Command Search Pill                     */}
        {/* =================================================================== */}
        <div className="flex items-center justify-center flex-1 px-2 sm:px-4 max-w-sm mx-auto">
          {/* Desktop & Tablet Search Bar Pill */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-zinc-700/70 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer w-full max-w-64 shadow-2xs text-xs select-none"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate text-xs font-medium text-zinc-300">Type to search...</span>
            </div>
            <span className="inline-flex items-center justify-center font-mono rounded bg-zinc-950 border border-zinc-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 shrink-0">
              ⌘K
            </span>
          </button>

          {/* Mobile Search Icon Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="sm:hidden p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* Right Section: Producer Chat, Notifications, Balance & User Profile */}
        {/* =================================================================== */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Producer Chat Trigger Button */}
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            title="Chat with Producer"
            aria-label="Chat with Producer"
            className="relative inline-flex items-center justify-center size-8 rounded-md text-amber-400 hover:text-amber-300 hover:bg-zinc-800/80 transition-colors cursor-pointer select-none"
          >
            <MessageSquare className="w-4 h-4 fill-amber-500/20 text-amber-400" />
            {totalUnreadChat > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-zinc-950 animate-pulse" />
            ) : null}
          </button>

          {/* Notification Popover Dropdown */}
          <DashboardNotificationDropdown />

          {/* Studio Balance Pill (Consistent across all screens in the same location) */}
          <Link
            href="/redeem-code"
            title="View balance and redeem credits"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors text-xs font-semibold select-none shadow-2xs cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-300 font-medium text-xs">Balance:</span>
            <span className="text-amber-300 font-bold">{effectiveBalance} CR</span>
          </Link>

          {/* Optional Top-Right Action Badge (e.g. New Asset Request or Active Package) */}
          {topRightBadge}

          {/* User Profile Avatar Dropdown */}
          <DashboardProfileDropdown
            userEmail={effectiveEmail}
            userName={effectiveName}
            walletBalance={effectiveBalance}
          />
        </div>
      </header>

      {/* Global Command / Quick Search Dialog */}
      <DashboardSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        walletBalance={walletBalance}
      />
    </>
  );
}
