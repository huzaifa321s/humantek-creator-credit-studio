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

const ITEMS_PER_PAGE = 8;

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

      <DialogContent className="sm:max-w-6xl w-[96vw] max-h-[90vh] flex flex-col p-6 overflow-hidden rounded-2xl gap-0">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border/80 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Creative Services · Scope Matrix
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Transparent credit values across all 39 Humantek creative services. 1 CR = $2.50 base rate.
              </DialogDescription>
            </div>
          </div>

          {/* Search Bar (Full Width) */}
          <div className="relative w-full pt-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search 39 services by name, category or scope deliverables (e.g. Logo, VTuber, Intro)..."
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-8 h-10 text-sm rounded-xl bg-card border-border/80 w-full"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Tabs (Shared UI & UX Component) */}
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

        {/* Scope Matrix Table Container - table-fixed ensures 100% column containment */}
        <ScrollArea className="flex-1 min-h-0 border rounded-xl border-border bg-card my-3 shadow-2xs overflow-hidden">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
              <TableRow className="border-b border-border/80 hover:bg-transparent">
                <TableHead className="w-[30%] font-semibold text-sm text-foreground/80 h-11 px-4">
                  Service & Description
                </TableHead>
                <TableHead className="w-[13%] font-semibold text-sm text-foreground/80 h-11 px-3">
                  Category
                </TableHead>
                {TIER_NAMES.map((tier) => (
                  <TableHead key={tier} className="w-[19%] font-semibold text-sm text-right text-foreground/80 h-11 px-4">
                    {tier} Scope
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground text-base">No services matching your filters</p>
                    <p className="mt-1">Try resetting the category filter or clearing your search term.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFilterQuery('');
                        setSelectedCategory('All');
                        setCurrentPage(1);
                      }}
                      className="mt-3 text-sm rounded-lg"
                    >
                      Reset Filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedServices.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/50 transition-colors border-b border-border/60">
                    {/* Service & Description */}
                    <TableCell className="py-3.5 px-4 align-top">
                      <div className="font-semibold text-foreground text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {s.description}
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-3.5 px-3 align-top">
                      <Badge variant="outline" className="text-xs font-medium text-muted-foreground px-2 py-0.5">
                        {s.category}
                      </Badge>
                    </TableCell>

                    {/* Scope Columns */}
                    {s.quoteOnly ? (
                      <TableCell
                        colSpan={3}
                        className="py-3.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-500/5 text-sm rounded-lg"
                      >
                        Custom Scope / Studio Agency Quote Required
                      </TableCell>
                    ) : (
                      s.prices.map((price, idx) => (
                        <TableCell key={idx} className="py-3.5 px-4 align-top text-right text-sm">
                          <div className="font-semibold">
                            <CreditValue value={price} size="sm" showUsd />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {s.scopeDetails?.[idx] ?? DEFAULT_SCOPE_DETAILS[idx]}
                          </div>
                        </TableCell>
                      ))
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Footer with Pagination Controls */}
        <DialogFooter className="pt-3 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 w-full bg-transparent p-0">
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
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
                className="h-8 px-3 text-sm gap-1 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    type="button"
                    variant={safeCurrentPage === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'h-8 w-8 text-sm font-semibold rounded-lg p-0 cursor-pointer',
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
                className="h-8 px-3 text-sm gap-1 rounded-lg cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <DialogClose
            render={
              <Button variant="secondary" size="default" className="text-sm rounded-xl px-4 cursor-pointer font-medium">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
