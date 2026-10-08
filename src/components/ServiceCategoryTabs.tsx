'use client';

import { useMemo, useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ServiceCategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts?: Record<string, number>;
  maxPrimary?: number;
  className?: string;
}

export function ServiceCategoryTabs({
  categories,
  activeCategory,
  onSelectCategory,
  categoryCounts,
  maxPrimary,
  className,
}: ServiceCategoryTabsProps) {
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  useEffect(() => {
    setMounted(true);
    setWindowWidth(window.innerWidth);

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsively determine primary tabs count so tabs never get cut off
  const effectiveMax = useMemo(() => {
    if (typeof maxPrimary === 'number') return maxPrimary;
    if (!mounted) return 2;
    if (windowWidth < 520) return 2; // Under 520px (all mobile phones): 2 primary tabs + More dropdown fits perfectly without clipping
    if (windowWidth < 768) return 3; // 520px - 767px (large phones in landscape, phablets)
    if (windowWidth < 1024) return 4; // 768px - 1023px (tablets)
    if (windowWidth < 1700) return 5; // 1024px - 1699px (laptops, standard 1080p desktop): 5 primary tabs + More dropdown fits with generous room so Chevron is ALWAYS fully visible
    return 6; // Ultrawide screens >= 1700px
  }, [maxPrimary, mounted, windowWidth]);

  // Split into primary visible tabs and secondary "More" items to eliminate horizontal clipping
  const { primaryTabs, moreTabs } = useMemo(() => {
    if (categories.length <= effectiveMax) {
      return { primaryTabs: categories, moreTabs: [] };
    }

    const primary = categories.slice(0, effectiveMax);
    const more = categories.slice(effectiveMax);
    return { primaryTabs: primary, moreTabs: more };
  }, [categories, effectiveMax]);

  const isMoreActive = moreTabs.includes(activeCategory);

  return (
    <Tabs
      value={isMoreActive ? '' : activeCategory}
      onValueChange={onSelectCategory}
      className={cn('w-full min-w-0', className)}
    >
      <div className="w-full min-w-0 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="bg-secondary/60 p-1 pr-2 rounded-xl h-10 inline-flex w-auto min-w-0 justify-start gap-1 items-center flex-nowrap">
          {primaryTabs.map((cat) => {
            const count = categoryCounts?.[cat];
            const isSelectedTab = cat === 'Selected';
            const hasSelectedItems = isSelectedTab && (count ?? 0) > 0;

            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className={cn(
                  'rounded-lg text-xs sm:text-sm font-semibold px-2 sm:px-2.5 h-8 shrink-0 transition-all select-none flex items-center gap-1 sm:gap-1.5 cursor-pointer',
                  'data-active:bg-card data-active:text-foreground data-active:shadow-2xs',
                  hasSelectedItems
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                    : 'text-muted-foreground'
                )}
              >
                <span className="shrink-0">{cat}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      'text-2xs sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono tabular-nums shrink-0',
                      hasSelectedItems
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-muted/70 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}

          {/* More Categories Dropdown (Ensures last categories are cleanly accessible without clipping) */}
          {moreTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-semibold px-2 sm:px-2.5 h-8 shrink-0 gap-1 sm:gap-1.5 cursor-pointer transition-all border border-transparent select-none outline-none',
                  isMoreActive
                    ? 'bg-card text-foreground shadow-2xs font-bold ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <span className="truncate max-w-[85px] sm:max-w-none">{isMoreActive ? activeCategory : 'More'}</span>
                {isMoreActive && categoryCounts?.[activeCategory] !== undefined ? (
                  <span className="text-2xs sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono tabular-nums bg-amber-500 text-white shadow-xs shrink-0">
                    {categoryCounts[activeCategory]}
                  </span>
                ) : (
                  <span className="text-2xs font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground shrink-0">
                    {moreTabs.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 opacity-90 text-foreground/80 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-md bg-popover text-popover-foreground border border-border">
                {moreTabs.map((cat) => {
                  const count = categoryCounts?.[cat];
                  const isActive = activeCategory === cat;
                  return (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => onSelectCategory(cat)}
                      className={cn(
                        'flex items-center justify-between text-xs sm:text-sm px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                        isActive
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold'
                          : 'hover:bg-secondary/70'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        <span>{cat}</span>
                      </span>
                      {count !== undefined && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-bold tabular-nums',
                            isActive
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TabsList>
      </div>
    </Tabs>
  );
}
