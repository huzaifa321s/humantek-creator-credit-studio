'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Coins,
  ShieldCheck,
  Sparkles,
  Ticket,
  FolderKanban,
  LogOut,
  ChevronDown,
  Menu,
  MessageSquare,
} from 'lucide-react';
import { useStudioChat } from '@/lib/chatStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavbarProps {
  walletBalance?: number;
  userEmail?: string | null;
}

export function Navbar({ walletBalance = 0, userEmail = null }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalUnreadCount, setIsOpen } = useStudioChat();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-card/95 backdrop-blur-md shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2 sm:gap-2.5">
          {/* Wallet Balance Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/90 shadow-2xs">
            <Coins className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-900 font-medium">Balance:</span>
            <span className="font-extrabold text-base text-amber-700 tabular-nums">
              {walletBalance} CR
            </span>
          </div>

          {/* Messages Trigger (Opens in-place chat drawer) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="relative text-sm font-semibold gap-1.5 h-9 cursor-pointer hover:bg-secondary/60 text-foreground"
            title="Chat with Creative Producer"
          >
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span>Messages</span>
            {totalUnreadCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold animate-pulse">
                {totalUnreadCount}
              </span>
            )}
          </Button>

          <Link href="/projects">
            <Button
              variant={pathname === '/projects' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-sm font-semibold gap-1.5 h-9"
            >
              <FolderKanban className="w-4 h-4 text-amber-600" />
              <span>Projects</span>
            </Button>
          </Link>

          <Link href="/redeem-code">
            <Button
              variant={pathname === '/redeem-code' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-sm font-semibold gap-1.5 h-9"
            >
              <Ticket className="w-4 h-4 text-amber-600" />
              <span>Redeem Code</span>
            </Button>
          </Link>

          <Link href="/management">
            <Button
              variant={pathname === '/management' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-sm gap-1.5 font-semibold h-9"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Management</span>
            </Button>
          </Link>

          {/* User Account / Profile Dropdown */}
          {userEmail ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-sm font-medium pl-1.5 pr-2.5 cursor-pointer h-9"
                  >
                    <Avatar className="w-7 h-7 text-xs bg-amber-100 text-amber-800 font-bold border border-amber-300">
                      <AvatarFallback>{userEmail.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[120px] truncate">{userEmail}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuLabel className="font-semibold text-sm text-foreground px-2 py-1.5">
                  Signed in as
                  <span className="block font-normal text-xs text-muted-foreground truncate">{userEmail}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer w-full"
                  onClick={() => setIsOpen(true)}
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
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm" className="text-xs font-semibold">
                Sign in
              </Button>
            </Link>
          )}
        </nav>

        {/* Mobile Navigation Sheet */}
        <div className="flex md:hidden items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/90 border border-amber-200 text-xs font-bold text-amber-800">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span>{walletBalance} CR</span>
          </div>

          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Menu className="w-4 h-4" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72 p-6 flex flex-col justify-between">
              <div className="space-y-6">
                <SheetHeader className="p-0 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-white text-xs">
                      ART
                    </div>
                    <div>
                      <SheetTitle className="text-base font-bold text-foreground">
                        Humantek Art
                      </SheetTitle>
                      <span className="text-xs text-amber-600 font-bold uppercase tracking-wider block">
                        Credits Studio
                      </span>
                    </div>
                  </div>
                </SheetHeader>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Wallet Balance</span>
                    <b className="text-amber-800 font-black">{walletBalance} CR</b>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Link href="/">
                    <Button
                      variant={pathname === '/' ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-xs font-semibold gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-amber-600" /> Creator Studio
                    </Button>
                  </Link>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsOpen(true)}
                    className="w-full justify-start text-xs font-semibold gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-600" /> Chat with Producer
                    {totalUnreadCount > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold">
                        {totalUnreadCount}
                      </span>
                    )}
                  </Button>

                  <Link href="/projects">
                    <Button
                      variant={pathname === '/projects' ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-xs font-semibold gap-2"
                    >
                      <FolderKanban className="w-4 h-4 text-amber-600" /> Your Projects
                    </Button>
                  </Link>

                  <Link href="/redeem-code">
                    <Button
                      variant={pathname === '/redeem-code' ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-xs font-semibold gap-2"
                    >
                      <Ticket className="w-4 h-4 text-amber-600" /> Redeem Code
                    </Button>
                  </Link>

                  <Link href="/management">
                    <Button
                      variant={pathname === '/management' ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-xs font-semibold gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Management
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                {userEmail ? (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-rose-600"
                      onClick={() => {
                        router.push('/login');
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <Link href="/login" className="w-full block">
                    <Button variant="default" size="sm" className="w-full text-xs font-semibold">
                      Sign in
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
