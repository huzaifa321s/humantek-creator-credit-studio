'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ProjectRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import { cn, formatStudioDate } from '@/lib/utils';
import { Package, Search, MessageSquare, Sparkles } from 'lucide-react';
import { useStudioChat } from '@/lib/chatStore';
import { ProjectPipelineStepper } from '@/components/ProjectPipelineStepper';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useProjectsQuery } from '@/lib/queries/projects';

const EMPTY_PROJECTS: ProjectRecord[] = [];

export default function ProjectsPage() {
  const { setIsOpen, unreadCounts } = useStudioChat();
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const isLoading = projectsQuery.isPending;
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const activeCount = projects.filter(
    (p) => p.status !== 'delivered' && p.status !== 'declined'
  ).length;
  const deliveredCount = projects.filter((p) => p.status === 'delivered').length;

  return (
    <StudioCardLayout
      mode="standalone"
      backLabel="Back to Studio"
      topRightBadge={
        <Link href="/">
          <Button variant="default" size="sm" className="h-8 px-3 rounded-md text-xs font-bold gap-1 shadow-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 pb-24 sm:pb-32 animate-in fade-in duration-200">
        {/* Step Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              My Projects
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              See where each project is and how many credits it uses.
            </p>
          </div>
        </div>

        {/* Filter Bar with Tabs and Search — only shown when client has more than 3 projects */}
        {projects.length > 3 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FilterTabs
              value={activeTab}
              onValueChange={setActiveTab}
              size="sm"
              tabs={[
                { value: 'all', label: 'All', count: projects.length },
                { value: 'active', label: 'Active Production', count: activeCount },
                { value: 'delivered', label: 'Delivered', count: deliveredCount },
              ]}
            />

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by code, brand, or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border/80 rounded-lg focus-visible:border-amber-500"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 sm:p-6 rounded-xl border border-border/80 bg-card space-y-4">
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
          <Empty className="rounded-xl border border-dashed border-border/80 bg-card/60 p-12 sm:p-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold">No matching creative projects found</EmptyTitle>
              <EmptyDescription>
                Start building your first custom branding or streaming pack in the studio.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="default"
                className="text-sm font-semibold h-10 px-5"
                render={<Link href="/" />}
                nativeButton={false}
              >
                Open Creator Studio
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((proj) => {
              return (
                <Card
                  key={proj.id}
                  className="rounded-xl border border-border/80 bg-card shadow-xs hover:border-amber-500/40 transition-all overflow-hidden"
                >
                  {/* Top Header */}
                  <CardHeader className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="gold" size="sm" className="font-bold">
                          {proj.packageName}
                        </Badge>
                        <Badge variant="outline" size="sm" className="font-mono tabular-nums text-muted-foreground font-semibold">
                          {proj.projectCode}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 tracking-tight">
                        {proj.channelName || proj.clientName}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Client: <b className="text-foreground font-semibold">{proj.clientName}</b> ({proj.email}) · Platform: <span className="font-semibold text-foreground">{proj.platform || 'General'}</span>
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <div className="flex items-center sm:justify-end gap-2">
                        <Badge
                          variant={proj.paymentStatus === 'paid' ? 'success' : 'secondary'}
                          className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-md"
                        >
                          {proj.paymentStatus === 'paid' ? 'Payment Verified' : 'Awaiting Payment'}
                        </Badge>
                      </div>
                      <div className="flex items-center sm:justify-end gap-1.5 mt-1.5">
                        <CreditValue value={proj.usedCredits} size="sm" variant="pill" />
                        <span className="text-xs text-muted-foreground font-semibold">Allocated</span>
                      </div>
                      <div className="mt-2 flex items-center sm:justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsOpen(true, proj.id)}
                          className="h-8 px-3 text-xs font-medium gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer"
                        >
                          <MessageSquare className="size-3.5 text-amber-600" />
                          <span>Messages</span>
                          {(unreadCounts[proj.id] ?? 0) > 0 && (
                            <Badge
                              variant="destructive"
                              size="xs"
                              className="size-4 p-0 font-bold font-mono tabular-nums text-2xs rounded-full"
                            >
                              {unreadCounts[proj.id]}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* 6-Stage Project Progress Stepper */}
                    <div className="p-5 sm:p-6 bg-secondary/25">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        Project Progress
                      </p>
                      <ProjectPipelineStepper
                        status={proj.status}
                        createdAt={proj.createdAt}
                        projectCode={proj.projectCode}
                      />
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
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Remaining in this package</span>
                        <b className="text-sm font-extrabold text-amber-700 dark:text-amber-400 font-mono tabular-nums">{proj.remainingCredits} CR</b>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block font-bold uppercase tracking-wider mb-1">Submitted Date</span>
                        <b className="text-sm font-semibold font-mono tabular-nums text-foreground">
                          {formatStudioDate(proj.createdAt)}
                        </b>
                      </div>
                    </div>

                    {/* Deliverable Assets List */}
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-border/60 pt-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deliverable Assets</span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">{proj.selections.length} items</span>
                      </div>
                      <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-muted/20 text-xs overflow-hidden">
                        {proj.selections.map((item, i) => (
                          <div key={i} className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{item.name}</span>
                              <span className="text-muted-foreground font-mono tabular-nums">× {item.quantity}</span>
                            </div>
                            <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono tabular-nums">{item.credits} CR</span>
                          </div>
                        ))}
                      </div>
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
