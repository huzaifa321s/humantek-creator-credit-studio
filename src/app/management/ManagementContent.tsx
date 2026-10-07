'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { AgencyDataGrid, type LedgerTransaction } from '@/components/AgencyDataGrid';
import { AdminKpiStrip } from '@/components/management/AdminKpiStrip';
import { AdminProjectsTable } from '@/components/management/AdminProjectsTable';
import { AdminInbox } from '@/components/management/AdminInbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { MessageSquare, FolderKanban, Receipt } from 'lucide-react';
import { useProjectsQuery, useUpdateProjectStatus } from '@/lib/queries/projects';
import { useStudioChat } from '@/lib/chatStore';

const EMPTY_PROJECTS: ProjectRecord[] = [];

function InnerManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const { setActiveProjectId } = useStudioChat();

  const [activeTab, setActiveTab] = useState<'projects' | 'ledger' | 'messages'>(() => {
    if (tabParam === 'messages') return 'messages';
    if (tabParam === 'ledger') return 'ledger';
    return 'projects';
  });

  // Keep state in sync with URL search params on Back / Forward navigation
  useEffect(() => {
    if (tabParam === 'messages' && activeTab !== 'messages') {
      setActiveTab('messages');
    } else if (tabParam === 'ledger' && activeTab !== 'ledger') {
      setActiveTab('ledger');
    } else if ((!tabParam || tabParam === 'projects') && activeTab !== 'projects') {
      setActiveTab('projects');
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (val: 'projects' | 'ledger' | 'messages') => {
    setActiveTab(val);
    const url = val === 'projects' ? '/management' : `/management?tab=${val}`;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', url);
    }
  };

  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const isLoading = projectsQuery.isPending;
  const updateStatus = useUpdateProjectStatus();
  const isUpdating = updateStatus.isPending ? updateStatus.variables?.id ?? null : null;

  const handleUpdateStatus = (
    id: string,
    newStatus: ProjectRecord['status'],
    newPayment?: ProjectRecord['paymentStatus']
  ) => {
    updateStatus.mutate(
      { id, status: newStatus, paymentStatus: newPayment },
      {
        onSuccess: () =>
          toast.success(`Updated status to ${newStatus.replace(/_/g, ' ')}`),
        onError: (err) => toast.error(err.message || 'Failed to update status'),
      }
    );
  };

  const handleOpenChat = (projectId: string) => {
    setActiveProjectId(projectId);
    handleTabChange('messages');
  };

  // KPI Metrics Calculations
  const totalRevenue = projects
    .filter((p) => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + p.packagePrice, 0);

  const totalCreditsAllocated = projects.reduce((sum, p) => sum + p.usedCredits, 0);
  const pendingReviewCount = projects.filter((p) => p.status === 'pending_review').length;
  const activeOrdersCount = projects.filter(
    (p) => p.status !== 'delivered' && p.status !== 'declined'
  ).length;

  // Credit Ledger Transactions matching funding models & verified revenue rules
  const ledgerTransactions: LedgerTransaction[] = useMemo(() => {
    const list: LedgerTransaction[] = [];

    // Map projects into audit transactions
    projects.forEach((p) => {
      if (p.id === 'proj-demo-1') return; // Handled by seed-tx-1 / seed-tx-2

      const isWalletFunding =
        p.fundingSource === 'wallet' ||
        p.packageId === 'studio-wallet' ||
        p.paymentMethod === 'credits';

      // 1. Package Purchase Deposit (PayPal)
      if (!isWalletFunding) {
        list.push({
          id: `tx-purchase-${p.id}`,
          reference: p.projectCode || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email,
          clientName: p.clientName,
          type: 'package_purchase',
          creditsDelta:
            p.packageCredits || p.usedCredits + (p.remainingCredits || 0) || 660,
          usdAmount: p.packagePrice,
          date: new Date(p.createdAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.createdAt || Date.now()).getTime(),
          paymentMethod: 'paypal',
          status: p.paymentStatus === 'paid' ? 'completed' : 'pending',
        });
      }

      // 2. Service Scope Deduction
      if (p.usedCredits > 0) {
        list.push({
          id: `tx-deduct-${p.id}`,
          reference: p.projectCode || `HT-${p.id.slice(-6).toUpperCase()}`,
          clientEmail: p.email,
          clientName: p.clientName,
          type: 'service_deduction',
          creditsDelta: -p.usedCredits,
          usdAmount: 0,
          date: new Date(p.createdAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }),
          timestamp: new Date(p.createdAt || Date.now()).getTime() + 1000,
          paymentMethod: 'credits',
          status: p.paymentStatus === 'paid' ? 'completed' : 'pending',
        });
      }
    });

    list.push(
      {
        id: 'seed-tx-1',
        reference: 'HT-9428-FORGE',
        clientEmail: 'kira@example.com',
        clientName: 'Kira Vance',
        type: 'package_purchase',
        creditsDelta: 660,
        usdAmount: 1500.0,
        date: 'Oct 01, 2026',
        timestamp: 1790841600000,
        paymentMethod: 'paypal',
        status: 'completed',
      },
      {
        id: 'seed-tx-2',
        reference: 'HT-9428-FORGE',
        clientEmail: 'kira@example.com',
        clientName: 'Kira Vance',
        type: 'service_deduction',
        creditsDelta: -550,
        usdAmount: 0,
        date: 'Oct 01, 2026',
        timestamp: 1790841660000,
        paymentMethod: 'credits',
        status: 'completed',
      }
    );

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [projects]);

  return (
    <StudioCardLayout mode="standalone" backLabel="Back to Studio">
      <div className="space-y-6">
        {/* KPI Strip */}
        <AdminKpiStrip
          totalRevenue={totalRevenue}
          activeOrdersCount={activeOrdersCount}
          pendingReviewCount={pendingReviewCount}
          totalCreditsAllocated={totalCreditsAllocated}
        />

        {/* View Switcher FilterTabs */}
        <FilterTabs
          value={activeTab}
          onValueChange={handleTabChange}
          tabs={[
            {
              value: 'projects',
              label: 'Projects Queue',
              icon: FolderKanban,
              count: projects.length,
            },
            {
              value: 'messages',
              label: 'Agency Inbox',
              icon: MessageSquare,
              count: pendingReviewCount > 0 ? pendingReviewCount : undefined,
            },
            {
              value: 'ledger',
              label: 'Credit Ledger',
              icon: Receipt,
              count: ledgerTransactions.length,
            },
          ]}
        />

        {/* TAB 1: Projects Table */}
        {activeTab === 'projects' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <AdminProjectsTable
              projects={projects}
              isLoading={isLoading}
              onOpenChat={handleOpenChat}
              onUpdateStatus={handleUpdateStatus}
              isUpdatingId={isUpdating}
            />
          </div>
        )}

        {/* TAB 2: Agency Inbox */}
        {activeTab === 'messages' && (
          <div className="animate-in fade-in duration-200">
            <AdminInbox />
          </div>
        )}

        {/* TAB 3: Credit Ledger DataGrid */}
        {activeTab === 'ledger' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <AgencyDataGrid transactions={ledgerTransactions} />
          </div>
        )}
      </div>
    </StudioCardLayout>
  );
}

export function ManagementContent() {
  return (
    <Suspense
      fallback={
        <StudioCardLayout mode="standalone" backLabel="Back to Studio">
          <div className="space-y-6 p-6">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-5 w-80 rounded-md" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </StudioCardLayout>
      }
    >
      <InnerManagementContent />
    </Suspense>
  );
}
