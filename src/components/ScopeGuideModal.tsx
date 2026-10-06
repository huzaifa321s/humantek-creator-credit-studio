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

const ITEMS_PER_PAGE = 5;

export function ScopeGuideModal() {
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
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-xs border-dashed text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs"
          >
            <TableIcon className="w-3.5 h-3.5 text-amber-600" />
            Full Credit Rates & Scope Matrix
          </Button>
        }
      />

      <DialogContent className="sm:max-w-4xl w-[90vw] max-h-[78vh] flex flex-col p-4 sm:p-5 overflow-hidden rounded-xl gap-0 shadow-xl border border-border/80">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/70 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Creative Services · Scope Matrix
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Transparent rates across all 39 services · 1 CR = $2.50 base rate
              </DialogDescription>
            </div>
          </div>

          {/* Compact Search Bar */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search 39 services by name or deliverable (e.g. Logo, VTuber, Intro)..."
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

        {/* Scope Matrix Table Container */}
        <ScrollArea className="flex-1 min-h-0 border rounded-xl border-border/70 bg-card mt-2 mb-3.5 shadow-2xs overflow-hidden">
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
                          idx === 1 && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
                          idx === 2 && "bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-600/30 font-semibold"
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
              {filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-xs sm:text-sm text-muted-foreground">
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
                      className="mt-2.5 text-xs rounded-lg cursor-pointer"
                    >
                      Reset Filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedServices.map((s) => (
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
                        className="py-2.5 px-3 text-center font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/5 text-xs rounded-lg border border-dashed border-amber-500/25"
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
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Footer with Compact Pagination Controls */}
        <DialogFooter className="mx-0 mb-0 mt-3 pt-3.5 pb-1 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full bg-transparent">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>
              Showing <b className="text-foreground">{startIdx}</b>–<b className="text-foreground">{endIdx}</b> of{' '}
              <b className="text-foreground">{filteredServices.length}</b> services
            </span>
            {filteredServices.length !== SERVICES.length && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 font-normal">
                Filtered
              </Badge>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="h-7 px-2 text-xs gap-1 rounded-md cursor-pointer"
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
                      'h-7 w-7 text-xs font-semibold rounded-md p-0 cursor-pointer',
                      safeCurrentPage === pageNum
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
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
                className="h-7 px-2 text-xs gap-1 rounded-md cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}

          <DialogClose
            render={
              <Button variant="secondary" size="sm" className="text-xs rounded-lg px-3.5 cursor-pointer font-medium h-7">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
