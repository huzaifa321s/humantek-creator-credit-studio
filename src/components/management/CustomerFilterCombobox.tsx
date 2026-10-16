'use client';

import React, { useMemo, useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Users,
  UserCheck,
  ChevronsUpDown,
  Search,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BATCH_SIZE = 40;

export interface CustomerFilterOption {
  clientEmail: string;
  clientName: string;
  count: number;
}

interface CustomerFilterComboboxProps {
  customers: CustomerFilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function CustomerFilterCombobox({
  customers,
  value,
  onValueChange,
  className,
}: CustomerFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(BATCH_SIZE);

  const selectedCustomer = useMemo(() => {
    if (!value || value === 'all') return null;
    const normalized = value.toLowerCase().trim();
    return (
      customers.find((c) => c.clientEmail.toLowerCase().trim() === normalized) ||
      null
    );
  }, [customers, value]);

  const matchingCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return [...customers].sort(
        (a, b) =>
          a.clientName.localeCompare(b.clientName) ||
          a.clientEmail.localeCompare(b.clientEmail)
      );
    }
    return customers
      .filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.clientEmail.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aStarts =
          a.clientName.toLowerCase().startsWith(q) ||
          a.clientEmail.toLowerCase().startsWith(q);
        const bStarts =
          b.clientName.toLowerCase().startsWith(q) ||
          b.clientEmail.toLowerCase().startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.clientName.localeCompare(b.clientName);
      });
  }, [customers, search]);

  const visibleCustomers = useMemo(
    () => matchingCustomers.slice(0, visibleLimit),
    [matchingCustomers, visibleLimit]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setVisibleLimit(BATCH_SIZE);
        if (!nextOpen) setSearch('');
      }}
    >
      <PopoverTrigger
        className={cn(
          'h-8 px-2.5 text-xs bg-card dark:bg-input/30 dark:hover:bg-input/50 w-full sm:w-[220px] rounded-lg border border-border/80 inline-flex items-center justify-between gap-1.5 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer',
          selectedCustomer && 'border-amber-400/50 bg-amber-400/5',
          className
        )}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          {selectedCustomer ? (
            <UserCheck className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          ) : (
            <Users className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="truncate text-foreground">
            {selectedCustomer
              ? `${selectedCustomer.clientName} (${selectedCustomer.count})`
              : `All Customers (${customers.length})`}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-72 p-0 gap-0 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/60">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search client name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleLimit(BATCH_SIZE);
            }}
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setVisibleLimit(BATCH_SIZE);
              }}
              aria-label="Clear client search"
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Progressively Loaded Customer Options List */}
        <div
          className="max-h-64 overflow-y-auto p-1"
          onScroll={(e) => {
            if (visibleLimit >= matchingCustomers.length) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
              setVisibleLimit((prev) =>
                Math.min(prev + BATCH_SIZE, matchingCustomers.length)
              );
            }
          }}
        >
          {!search.trim() && (
            <button
              type="button"
              onClick={() => {
                onValueChange('all');
                setOpen(false);
                setSearch('');
              }}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer',
                value === 'all'
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'hover:bg-accent/70 text-foreground'
              )}
            >
              <span className="truncate">All Customers ({customers.length})</span>
              {value === 'all' && (
                <Check className="size-3.5 text-foreground shrink-0" />
              )}
            </button>
          )}

          {visibleCustomers.length === 0 ? (
            <div className="py-5 px-3 text-center text-xs text-muted-foreground">
              No clients match &ldquo;{search}&rdquo;
            </div>
          ) : (
            visibleCustomers.map((c) => {
              const normalizedEmail = c.clientEmail.toLowerCase().trim();
              const isSelected = value.toLowerCase().trim() === normalizedEmail;
              return (
                <button
                  key={c.clientEmail}
                  type="button"
                  onClick={() => {
                    onValueChange(normalizedEmail);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/70 text-foreground'
                  )}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-semibold text-foreground">{c.clientName}</span>
                    <span className="text-2xs text-muted-foreground ml-1.5 font-mono">
                      ({c.clientEmail})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-2xs font-mono text-muted-foreground">
                      {c.count}
                    </span>
                    {isSelected && (
                      <Check className="size-3.5 text-foreground shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Progressive Scroll Footer Notice */}
        {matchingCustomers.length > visibleCustomers.length && (
          <div className="px-2.5 py-1.5 border-t border-border/60 text-2xs text-muted-foreground font-mono text-center">
            Showing {visibleCustomers.length} of {matchingCustomers.length} — scroll or type for more
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
