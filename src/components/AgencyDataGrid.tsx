'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { CreditValue } from '@/components/ui/credit-value';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LedgerTransaction {
  id: string;
  reference: string;
  clientEmail: string;
  clientName: string;
  type: 'package_purchase' | 'service_deduction' | 'refund' | 'promo_credit';
  creditsDelta: number;
  usdAmount: number;
  date: string;
  timestamp: number;
  paymentMethod: 'paypal' | 'credits' | 'promo';
  status: 'completed' | 'pending' | 'reversed';
}

interface AgencyDataGridProps {
  transactions: LedgerTransaction[];
  className?: string;
}

type SortField = 'reference' | 'clientEmail' | 'type' | 'creditsDelta' | 'usdAmount' | 'timestamp';
type SortOrder = 'asc' | 'desc';

export function AgencyDataGrid({ transactions, className }: AgencyDataGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'timestamp' || field === 'creditsDelta' || field === 'usdAmount' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.reference.toLowerCase().includes(q) ||
        t.clientEmail.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q);

      // 2. Type Filter
      const matchesType = typeFilter === 'all' || t.type === typeFilter;

      // 3. Status Filter
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, searchQuery, typeFilter, statusFilter]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortField === 'creditsDelta') {
        comparison = a.creditsDelta - b.creditsDelta;
      } else if (sortField === 'usdAmount') {
        comparison = a.usdAmount - b.usdAmount;
      } else if (sortField === 'reference') {
        comparison = a.reference.localeCompare(b.reference);
      } else if (sortField === 'clientEmail') {
        comparison = a.clientEmail.localeCompare(b.clientEmail);
      } else if (sortField === 'type') {
        comparison = a.type.localeCompare(b.type);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const pageItems = sortedTransactions.slice(startIndex, startIndex + pageSize);

  // Totals for filtered set
  const netCreditsDelta = filteredTransactions.reduce((acc, t) => acc + t.creditsDelta, 0);
  const totalUsdVolume = filteredTransactions.reduce((acc, t) => acc + t.usdAmount, 0);

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60 ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ml-1 inline" />
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Control Bar: Search, Type Filter, Status Filter, Reset */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/35 border border-border/80">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search reference, email, creator..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs bg-card rounded-lg border-border/80"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val as string);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs bg-card min-w-[140px] rounded-lg">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Types</SelectItem>
              <SelectItem value="package_purchase" className="text-xs">Package Purchase</SelectItem>
              <SelectItem value="service_deduction" className="text-xs">Service Scope</SelectItem>
              <SelectItem value="promo_credit" className="text-xs">Promo Code</SelectItem>
              <SelectItem value="refund" className="text-xs">Refund</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val as string);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs bg-card min-w-[130px] rounded-lg">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              <SelectItem value="completed" className="text-xs">Completed</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="reversed" className="text-xs">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters / Summary Count */}
        <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            Showing <b className="text-foreground">{sortedTransactions.length}</b> records
          </span>
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={resetFilters}
              className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      {sortedTransactions.length === 0 ? (
        <Empty className="p-10 border border-dashed rounded-xl bg-secondary/20">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-bold">No Ledger Records Found</EmptyTitle>
            <EmptyDescription className="text-xs sm:text-sm">
              No transactions match your search &ldquo;{searchQuery || typeFilter}&rdquo;. Try clearing filters.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs font-semibold rounded-lg"
            >
              Clear All Filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-2xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/80 hover:bg-transparent select-none">
                  <TableHead
                    onClick={() => handleSort('reference')}
                    className="pl-5 font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Reference</span> {getSortIcon('reference')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('clientEmail')}
                    className="font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Client / Channel</span> {getSortIcon('clientEmail')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('type')}
                    className="font-bold text-xs text-foreground/80 h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Type</span> {getSortIcon('type')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('creditsDelta')}
                    className="font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Credits Delta</span> {getSortIcon('creditsDelta')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('usdAmount')}
                    className="font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>USD Amount</span> {getSortIcon('usdAmount')}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('timestamp')}
                    className="pr-5 font-bold text-xs text-foreground/80 text-right h-11 cursor-pointer hover:text-foreground"
                  >
                    <span>Date &amp; Status</span> {getSortIcon('timestamp')}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/40 transition-colors border-b border-border/60"
                  >
                    {/* Reference */}
                    <TableCell className="pl-5 font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                      {item.reference}
                    </TableCell>

                    {/* Client */}
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground">{item.clientName || 'Creator'}</div>
                      <div className="text-muted-foreground text-2xs">{item.clientEmail}</div>
                    </TableCell>

                    {/* Type Badge with Human Labels */}
                    <TableCell>
                      {item.type === 'package_purchase' && (
                        <Badge variant="success" className="text-2xs font-semibold px-2 py-0.5">
                          Package Purchase
                        </Badge>
                      )}
                      {item.type === 'service_deduction' && (
                        <Badge variant="outline" className="text-2xs font-semibold text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 px-2 py-0.5">
                          Service Scope
                        </Badge>
                      )}
                      {item.type === 'promo_credit' && (
                        <Badge variant="gold" className="text-2xs font-semibold px-2 py-0.5">
                          Promo Code
                        </Badge>
                      )}
                      {item.type === 'refund' && (
                        <Badge variant="destructive" className="text-2xs font-semibold px-2 py-0.5">
                          Refund
                        </Badge>
                      )}
                    </TableCell>

                    {/* Credits Delta */}
                    <TableCell className="text-right text-xs">
                      <CreditValue
                        value={item.creditsDelta > 0 ? `+${item.creditsDelta}` : `${item.creditsDelta}`}
                        size="sm"
                        variant="delta"
                      />
                    </TableCell>

                    {/* USD Amount */}
                    <TableCell className="text-right font-bold text-foreground text-xs font-mono tabular-nums">
                      ${item.usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    {/* Date & Status */}
                    <TableCell className="pr-5 text-right text-xs">
                      <div className="font-medium text-foreground text-2xs font-mono tabular-nums">{item.date}</div>
                      <div className="inline-flex items-center gap-1 text-2xs text-muted-foreground mt-0.5">
                        {item.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="size-3" /> Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <Clock className="size-3" /> Pending
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>

              <TableFooter>
                <TableRow className="hover:bg-transparent bg-muted/20">
                  <TableCell colSpan={3} className="pl-5 font-semibold text-xs text-foreground">
                    Filtered Totals (<span className="font-mono tabular-nums">{filteredTransactions.length}</span> records)
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs text-foreground">
                    <CreditValue
                      value={netCreditsDelta >= 0 ? `+${netCreditsDelta}` : `${netCreditsDelta}`}
                      size="sm"
                      variant="delta"
                    />
                  </TableCell>
                  <TableCell className="text-right font-bold text-xs text-foreground font-mono tabular-nums">
                    ${totalUsdVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="pr-5" />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Clean Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border/70 bg-card text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs bg-card rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="text-xs">5</SelectItem>
                  <SelectItem value="10" className="text-xs">10</SelectItem>
                  <SelectItem value="25" className="text-xs">25</SelectItem>
                </SelectContent>
              </Select>
              <span>
                Page <b className="text-foreground font-mono tabular-nums">{activePage}</b> of <b className="text-foreground font-mono tabular-nums">{totalPages}</b>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="size-7 rounded-lg"
                aria-label="Previous Page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <span className="text-2xs px-2 font-mono font-semibold tabular-nums text-muted-foreground">
                {startIndex + 1}–{Math.min(startIndex + pageSize, sortedTransactions.length)} of {sortedTransactions.length}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="size-7 rounded-lg"
                aria-label="Next Page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
