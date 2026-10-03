'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Package, Check, Search } from 'lucide-react';

const STATUS_STAGES = [
  'Request Received',
  'Payment Confirmed',
  'Brief Approved',
  'In Production',
  'Review Round',
  'Delivered',
];

function getStageIndex(status: ProjectRecord['status']): number {
  switch (status) {
    case 'pending_review':
      return 0;
    case 'payment_confirmed':
      return 1;
    case 'in_production':
      return 3;
    case 'review_round':
      return 4;
    case 'delivered':
      return 5;
    default:
      return 0;
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredProjects = projects.filter((p) => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'delivered' && p.status === 'delivered') ||
      (activeTab === 'active' && p.status !== 'delivered' && p.status !== 'declined');

    const matchesSearch =
      searchQuery.trim() === '' ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.channelName && p.channelName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.packageName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      walletBalance={80}
      topRightBadge={
        <Link href="/">
          <Button variant="default" size="sm" className="text-xs font-semibold">
            + New Asset Request
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              PROJECT DASHBOARD
            </div>
            <h1 className="scroll-m-20 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground lg:text-4xl">
              Your Projects & Milestones
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Track live production pipelines, milestone stages, and credit scopes for your creative orders.
            </p>
          </div>
        </div>

        {/* Filter Bar with Tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'all' | 'active' | 'delivered')}
            className="w-auto"
          >
            <TabsList className="bg-secondary/70 p-1 rounded-xl">
              <TabsTrigger
                value="all"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs"
              >
                All ({projects.length})
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs"
              >
                Active Production
              </TabsTrigger>
              <TabsTrigger
                value="delivered"
                className="text-sm font-semibold px-3.5 py-1.5 data-active:bg-card data-active:text-amber-700 data-active:shadow-2xs"
              >
                Delivered
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by code, brand or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm bg-card rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 rounded-2xl border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="p-14 text-center border-dashed border-border bg-card/60 shadow-none rounded-2xl">
            <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-foreground">No matching creative projects found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm mx-auto">
              Start building your first custom branding or streaming pack in the studio.
            </p>
            <Link href="/">
              <Button variant="default" size="default" className="text-sm font-semibold h-10 px-5">
                Open Creator Studio
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((proj) => {
              const activeIndex = getStageIndex(proj.status);

              return (
                <Card
                  key={proj.id}
                  className="rounded-2xl border-border bg-card shadow-sm hover:border-amber-300 transition-all overflow-hidden"
                >
                  {/* Top Header */}
                  <CardHeader className="p-5 sm:p-6 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="gold" className="text-xs font-bold px-2.5 py-1">
                          {proj.packageName}
                        </Badge>
                        <span className="font-mono text-sm text-muted-foreground font-medium">
                          {proj.projectCode}
                        </span>
                      </div>
                      <CardTitle className="text-2xl font-black text-foreground mt-1.5">
                        {proj.channelName || proj.clientName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Client: <b className="text-foreground font-semibold">{proj.clientName}</b> ({proj.email}) · Platform: <span className="font-semibold text-foreground">{proj.platform || 'General'}</span>
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <Badge
                        variant={proj.paymentStatus === 'paid' ? 'success' : 'secondary'}
                        className="text-xs font-bold uppercase px-3 py-1"
                      >
                        {proj.paymentStatus === 'paid' ? 'Payment Verified' : 'Awaiting Payment'}
                      </Badge>
                      <span className="block font-extrabold text-base text-amber-700 dark:text-amber-400 mt-1.5 tabular-nums">
                        {proj.usedCredits} CR Allocated
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* 6-Stage Timeline Tracker */}
                    <div className="p-5 sm:p-6 bg-secondary/25">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Production Pipeline Tracker
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                        {STATUS_STAGES.map((stage, idx) => {
                          const isDone = idx <= activeIndex;
                          const isCurrent = idx === activeIndex;

                          return (
                            <div
                              key={stage}
                              className={cn(
                                'p-3 rounded-xl text-center transition-all border',
                                isCurrent
                                  ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs'
                                  : isDone
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                                  : 'bg-card border-border/80 text-muted-foreground opacity-60'
                              )}
                            >
                              <span className="block text-sm font-extrabold mb-1">
                                {isDone ? <Check className="w-4 h-4 mx-auto stroke-[2.5]" /> : idx + 1}
                              </span>
                              <span className="text-xs font-medium leading-tight block truncate">{stage}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary Details */}
                    <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border/60">
                      <div>
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Aesthetic Style</span>
                        <b className="text-sm font-semibold text-foreground">{proj.style || 'Custom Art'}</b>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Color Palette</span>
                        <b className="text-sm font-semibold text-foreground">{proj.colors || 'Brand Colors'}</b>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Remaining Credits</span>
                        <b className="text-sm font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">{proj.remainingCredits} CR</b>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Submitted Date</span>
                        <b className="text-sm font-semibold text-foreground">
                          {new Date(proj.createdAt).toLocaleDateString()}
                        </b>
                      </div>
                    </div>

                    {/* Service Items Badges */}
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-wrap gap-2.5 items-center">
                      <span className="text-sm text-muted-foreground font-semibold">Assets:</span>
                      {proj.selections.map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-sm py-1.5 px-3 gap-1.5 rounded-xl font-medium">
                          <span>{item.name}</span>
                          <span className="text-muted-foreground font-normal">({item.quantity}x)</span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold ml-1">{item.credits} CR</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StudioCardLayout>
  );
}
