'use client';

import { useState, useMemo } from 'react';
import { SERVICES, TIER_NAMES, DEFAULT_SCOPE_DETAILS } from '@/lib/catalog';
import { Layers, Table as TableIcon, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditValue } from '@/components/ui/credit-value';
import { cn } from '@/lib/utils';
import { ServiceCategoryTabs } from '@/components/ServiceCategoryTabs';
import { useUIStore } from '@/lib/uiStore';

const ITEMS_PER_PAGE = 5;

export function ScopeGuideModal() {
  const { isScopeGuideOpen, setScopeGuideOpen } = useUIStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(() => {
    const distinct = Array.from(new Set(SERVICES.map((s) => s.category)));
    return ['All', ...distinct];
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: SERVICES.length };
    for (const s of SERVICES) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredServices = useMemo(() => {
    return SERVICES.filter((s) => {
      const matchesCategory =
        selectedCategory === 'All' || s.category === selectedCategory;
      const matchesQuery =
        !filterQuery ||
        s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(filterQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(filterQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, filterQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedServices = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredServices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredServices, safeCurrentPage]);

  const startIdx = filteredServices.length === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIdx = Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredServices.length);

  return (
    <Dialog open={isScopeGuideOpen} onOpenChange={setScopeGuideOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 sm:gap-2 text-2xs sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 border-dashed text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs"
          >
            <TableIcon className="size-3 sm:size-3.5 text-brand-text" />
            <span className="hidden min-[400px]:inline">Full Credit Rates &amp; Scope Matrix</span>
            <span className="min-[400px]:hidden">Rates &amp; Scope Matrix</span>
          </Button>
        }
      />

      <DialogContent className="w-[96vw] sm:w-[90vw] sm:max-w-4xl max-h-[88vh] sm:max-h-[82vh] flex flex-col p-3 sm:p-5 overflow-hidden rounded-2xl sm:rounded-xl gap-0 shadow-xl border border-border/80">
        {/* Header */}
        <DialogHeader className="pb-2.5 border-b border-border/70 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-brand-text dark:text-amber-400 shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate">
                Creative Services · Scope Matrix
              </DialogTitle>
              <DialogDescription className="text-2xs sm:text-xs text-muted-foreground mt-0.5 truncate">
                All 39 studio services · <span className="font-semibold text-foreground/80">1 CR = $2.50</span> base rate
              </DialogDescription>
            </div>
          </div>

          {/* Compact Search Bar */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search 39 services (e.g. Logo, VTuber, Intro)..."
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8.5 pr-8 h-8.5 text-xs rounded-lg bg-muted/20 border-border/70 w-full"
            />
            {filterQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setFilterQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Category Filter Tabs (Shared UI Component) */}
          <ServiceCategoryTabs
            categories={categories}
            activeCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentPage(1);
            }}
            categoryCounts={categoryCounts}
          />
        </DialogHeader>

        {/* Scope Matrix Content Container */}
        <ScrollArea className="flex-1 min-h-0 border rounded-xl border-border/70 bg-card mt-2 mb-2.5 shadow-2xs overflow-y-auto overscroll-contain scrollbar-thin scrollbar-gutter-stable">
          {filteredServices.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs sm:text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">No services matching your filters</p>
              <p className="mt-1 text-xs">Try resetting the category filter or clearing your search term.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilterQuery('');
                  setSelectedCategory('All');
                  setCurrentPage(1);
                }}
                className="mt-3 text-xs rounded-lg cursor-pointer h-9 px-4"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW (md+): 5-column table */}
              <div className="hidden md:block">
                <Table className="w-full table-fixed">
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-xs">
                    <TableRow className="border-b border-border/70 hover:bg-transparent">
                      <TableHead className="w-[25%] font-semibold text-xs text-foreground/80 h-9 px-3">
                        Service
                      </TableHead>
                      <TableHead className="w-[9%] font-semibold text-xs text-foreground/80 h-9 px-2">
                        Category
                      </TableHead>
                      {TIER_NAMES.map((tier, idx) => (
                        <TableHead
                          key={tier}
                          className="w-[22%] font-semibold text-xs text-foreground/80 h-9 px-3"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>{tier}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs px-2 py-0.5 font-medium h-5 rounded leading-none",
                                idx === 0 && "text-muted-foreground border-border/60",
                                idx === 1 && "bg-amber-400/15 text-brand-text dark:text-amber-400 border-amber-400/30",
                                idx === 2 && "bg-amber-400/25 text-brand-text dark:text-amber-300 border-amber-400/40 font-semibold"
                              )}
                            >
                              Tier {idx}
                            </Badge>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedServices.map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                        {/* Service & Description */}
                        <TableCell className="py-2.5 px-3 align-top">
                          <div className="font-semibold text-foreground text-xs leading-snug">{s.name}</div>
                          <div
                            className="text-xs text-muted-foreground line-clamp-1 mt-0.5 leading-normal"
                            title={s.description}
                          >
                            {s.description}
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="py-2.5 px-2 align-top">
                          <Badge variant="outline" className="text-xs font-medium text-muted-foreground px-2 py-0.5 whitespace-nowrap border-border/60">
                            {s.category}
                          </Badge>
                        </TableCell>

                        {/* Scope Columns */}
                        {s.quoteOnly ? (
                          <TableCell
                            colSpan={3}
                            className="py-2.5 px-3 text-center font-semibold text-brand-text dark:text-amber-400 bg-amber-400/10 text-xs rounded-lg border border-dashed border-amber-400/30"
                          >
                            Custom Scope / Studio Quote Required
                          </TableCell>
                        ) : (
                          s.prices.map((price, idx) => {
                            const detailText = s.scopeDetails?.[idx] ?? DEFAULT_SCOPE_DETAILS[idx];
                            return (
                              <TableCell key={idx} className="py-2.5 px-3 align-top">
                                <div className="flex flex-col gap-0.5">
                                  <div>
                                    <CreditValue value={price} size="sm" showUsd />
                                  </div>
                                  <p
                                    className="text-xs leading-snug text-muted-foreground line-clamp-2 mt-0.5 break-words"
                                    title={detailText}
                                  >
                                    {detailText}
                                  </p>
                                </div>
                              </TableCell>
                            );
                          })
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE VIEW (< md): Adaptive Cards with 3-Tier Micro-Grid */}
              <div className="block md:hidden divide-y divide-border/60 pb-6">
                {paginatedServices.map((s) => (
                  <div key={s.id} className="p-3 space-y-2">
                    {/* Header Row: Title, Category Badge & Starting Rate Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-foreground text-xs leading-tight">
                            {s.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-3xs font-medium text-muted-foreground px-1.5 py-0 h-4 border-border/60"
                          >
                            {s.category}
                          </Badge>
                        </div>
                        <p
                          className="text-2xs text-muted-foreground line-clamp-1 mt-0.5 leading-normal"
                          title={s.description}
                        >
                          {s.description}
                        </p>
                      </div>

                      {!s.quoteOnly && (
                        <div className="shrink-0">
                          <CreditValue
                            value={s.prices[0]}
                            size="xs"
                            variant="pill"
                            prefix="From "
                            showUsd={false}
                          />
                        </div>
                      )}
                    </div>

                    {/* Scope Breakdown */}
                    {s.quoteOnly ? (
                      <div className="py-2 px-3 text-center font-semibold text-brand-text dark:text-amber-400 bg-amber-400/10 text-2xs rounded-lg border border-dashed border-amber-400/30">
                        Custom Scope / Studio Quote Required
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        {s.prices.map((price, idx) => {
                          const detailText = s.scopeDetails?.[idx] ?? DEFAULT_SCOPE_DETAILS[idx];
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "rounded-lg p-1.5 xs:p-2 flex flex-col justify-between border transition-colors min-w-0 overflow-hidden",
                                idx === 0 && "bg-muted/30 border-border/60",
                                idx === 1 && "bg-amber-400/5 border-amber-400/30 dark:bg-amber-950/20",
                                idx === 2 && "bg-amber-400/15 border-amber-400/40 dark:bg-amber-950/30"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span
                                    className={cn(
                                      "text-3xs font-bold uppercase tracking-wider truncate",
                                      idx === 0 && "text-muted-foreground",
                                      idx === 1 && "text-brand-text dark:text-amber-400 font-extrabold",
                                      idx === 2 && "text-brand-text dark:text-amber-300 font-extrabold"
                                    )}
                                  >
                                    {TIER_NAMES[idx]}
                                  </span>
                                  <span className="text-3xs font-mono text-muted-foreground/60 shrink-0">
                                    T{idx}
                                  </span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="leading-tight">
                                    <CreditValue
                                      value={price}
                                      size="xs"
                                      showUsd={false}
                                      className="text-2xs sm:text-xs font-bold"
                                    />
                                  </div>
                                  <span className="text-3xs text-muted-foreground/80 font-mono tabular-nums leading-none mt-0.5">
                                    (${Math.round(price * 2.5)})
                                  </span>
                                </div>
                              </div>
                              <p
                                className="text-3xs text-muted-foreground line-clamp-2 mt-1 leading-tight break-words"
                                title={detailText}
                              >
                                {detailText}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>

        {/* Footer with Compact Mobile & Full Desktop Pagination */}
        <DialogFooter className="mx-0 mb-0 mt-2.5 pt-2.5 sm:pt-3.5 pb-0.5 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full bg-transparent">
          {/* Item Counter */}
          <div className="text-xs text-muted-foreground flex items-center justify-between sm:justify-start w-full sm:w-auto gap-1.5">
            <span>
              Showing <b className="text-foreground font-mono tabular-nums">{startIdx}</b>–<b className="text-foreground font-mono tabular-nums">{endIdx}</b> of{' '}
              <b className="text-foreground font-mono tabular-nums">{filteredServices.length}</b> services
            </span>
            {filteredServices.length !== SERVICES.length && (
              <Badge variant="outline" className="text-3xs sm:text-xs px-1.5 py-0 font-normal">
                Filtered
              </Badge>
            )}
          </div>

          {/* Mobile Pagination Row (< sm) */}
          <div className="flex sm:hidden items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="h-10 min-h-[40px] px-3 text-xs font-semibold gap-1 rounded-lg cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>

              <span className="text-xs font-mono font-bold text-foreground px-2 tabular-nums">
                {safeCurrentPage} / {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="h-10 min-h-[40px] px-3 text-xs font-semibold gap-1 rounded-lg cursor-pointer disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <DialogClose
              render={
                <Button variant="secondary" size="sm" className="h-10 min-h-[40px] text-xs font-semibold rounded-lg px-4 cursor-pointer">
                  Close
                </Button>
              }
            />
          </div>

          {/* Desktop Pagination Controls (sm+) */}
          <div className="hidden sm:flex items-center gap-3">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-8 px-2.5 text-xs gap-1 rounded-md cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Prev</span>
                </Button>

                <div className="flex items-center gap-0.5 px-0.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      type="button"
                      variant={safeCurrentPage === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'h-8 w-8 text-xs font-semibold font-mono tabular-nums rounded-md p-0 cursor-pointer',
                        safeCurrentPage === pageNum
                          ? 'bg-primary text-primary-foreground font-black hover:bg-[oklch(0.769_0.188_70.08)] shadow-xs shadow-amber-400/20'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="h-8 px-2.5 text-xs gap-1 rounded-md cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}

            <DialogClose
              render={
                <Button variant="secondary" size="sm" className="text-xs rounded-lg px-3.5 cursor-pointer font-medium h-8">
                  Close
                </Button>
              }
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
