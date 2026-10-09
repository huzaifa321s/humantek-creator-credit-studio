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
import { ChatGate } from '@/components/chat/ChatGate';

function ProjectCardChatButton({ projectId }: { projectId: string }) {
  const { setIsOpen, unreadCounts } = useStudioChat();
  const unread = unreadCounts[projectId] ?? 0;

  return (
    <ChatGate>
      <Button
        data-chat-entry="project-card-chat"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true, projectId)}
        className="h-8 px-3 text-xs font-medium gap-1.5 rounded-lg border-border text-foreground hover:bg-muted cursor-pointer w-full md:w-auto justify-center"
      >
        <MessageSquare className="size-3.5 text-amber-600" />
        <span>Messages</span>
        {unread > 0 && (
          <Badge
            variant="destructive"
            size="xs"
            className="size-4 p-0 font-bold font-mono tabular-nums text-2xs rounded-full"
          >
            {unread}
          </Badge>
        )}
      </Button>
    </ChatGate>
  );
}

const EMPTY_PROJECTS: ProjectRecord[] = [];

export default function ProjectsPage() {
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
        <Link href="/new-project">
          <Button variant="default" size="sm" className="h-8 px-2.5 sm:px-3 rounded-md text-xs font-bold gap-1 shadow-xs bg-amber-500 hover:bg-amber-600 text-white cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden min-[400px]:inline">New Project</span>
            <span className="min-[400px]:hidden">New</span>
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
              Track your projects, progress, and deliverables.
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
                { value: 'active', label: 'In Progress', count: activeCount },
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
        ) : projects.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold text-foreground">No projects yet</EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                Start your first project to see its progress here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="default"
                className="text-sm font-semibold h-10 px-5 gap-2 bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs"
                render={<Link href="/new-project" />}
                nativeButton={false}
              >
                <Sparkles className="size-4" />
                Start a project
              </Button>
            </EmptyContent>
          </Empty>
        ) : filteredProjects.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border bg-card/80 p-12 sm:p-14 shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold text-foreground">No matching creative projects found</EmptyTitle>
              <EmptyDescription className="text-muted-foreground text-sm">
                {searchQuery
                  ? `No projects matched "${searchQuery}". Try adjusting your search query or filters.`
                  : 'No projects match the selected filter.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                className="text-sm font-semibold h-9 px-4 cursor-pointer"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              >
                Clear filters
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
                  <CardHeader className="p-4 sm:p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="gold" size="sm" className="font-bold">
                          {proj.packageName}
                        </Badge>
                        <Badge variant="outline" size="sm" className="font-mono tabular-nums text-muted-foreground font-semibold">
                          {proj.projectCode}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 tracking-tight break-words">
                        {proj.channelName || proj.packageName}
                      </CardTitle>

                      {/* Client-friendly Status & Context note */}
                      <div className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                        {proj.status === 'pending_review' ? (
                          <>
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span>Pending Studio Review · Creative brief submitted for review</span>
                          </>
                        ) : proj.status === 'payment_confirmed' ? (
                          <>
                            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Payment Confirmed · Preparing production assets</span>
                          </>
                        ) : proj.status === 'in_production' ? (
                          <>
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span>In Production · Creative work in progress</span>
                          </>
                        ) : proj.status === 'review_round' ? (
                          <>
                            <span className="size-1.5 rounded-full bg-purple-500 shrink-0" />
                            <span>Review Round Open · Deliverables awaiting your review</span>
                          </>
                        ) : proj.status === 'delivered' ? (
                          <>
                            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Delivered · All project assets completed</span>
                          </>
                        ) : (
                          <>
                            <span className="size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                            <span>Project {proj.status.replace(/_/g, ' ')}</span>
                          </>
                        )}
                        {proj.platform && proj.platform.toLowerCase() !== 'general' && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span>Platform: <b className="text-foreground font-semibold">{proj.platform}</b></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end md:flex-col md:items-end gap-2 pt-2 md:pt-0 border-t border-border/40 md:border-t-0 shrink-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={
                            proj.paymentStatus === 'paid'
                              ? 'success'
                              : proj.status === 'pending_review'
                              ? 'gold'
                              : 'secondary'
                          }
                          className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-md"
                        >
                          {proj.paymentStatus === 'paid'
                            ? 'Payment Confirmed'
                            : proj.status === 'pending_review'
                            ? 'Pending Review'
                            : 'Awaiting Payment'}
                        </Badge>
                        {proj.usedCredits > 0 && (
                          <div className="flex items-center gap-1.5">
                            <CreditValue value={proj.usedCredits} size="sm" variant="pill" />
                            <span className="text-xs text-muted-foreground font-semibold hidden min-[440px]:inline">used</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center md:justify-end gap-2 w-full md:w-auto">
                        <ProjectCardChatButton projectId={proj.id} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* 6-Stage Project Progress Stepper */}
                    <div className="p-4 sm:p-6 bg-secondary/25">
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
                    <div className={cn(
                      "p-4 sm:p-6 grid gap-3 sm:gap-4 border-t border-border/60",
                      proj.platform && proj.platform.toLowerCase() !== 'general'
                        ? "grid-cols-2 sm:grid-cols-4"
                        : "grid-cols-1 sm:grid-cols-3"
                    )}>
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Aesthetic Style</span>
                        <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.style || 'Custom Art'}</b>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Color Palette</span>
                        <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.colors || 'Brand Colors'}</b>
                      </div>
                      {proj.platform && proj.platform.toLowerCase() !== 'general' && (
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Target Platform</span>
                          <b className="text-xs sm:text-sm font-semibold text-foreground truncate block">{proj.platform}</b>
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-2xs sm:text-xs block font-bold uppercase tracking-wider mb-1">Submitted Date</span>
                        <b className="text-xs sm:text-sm font-semibold font-mono tabular-nums text-foreground">
                          {formatStudioDate(proj.createdAt)}
                        </b>
                      </div>
                    </div>

                    {/* Deliverable Assets List */}
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-border/60 pt-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Deliverable Assets</span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">{proj.selections.length} items</span>
                      </div>
                      {proj.selections.length > 0 ? (
                        <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-muted/20 text-xs overflow-hidden">
                          {proj.selections.map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/40 transition-colors gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-foreground truncate">{item.name}</span>
                                <span className="text-muted-foreground font-mono tabular-nums shrink-0">× {item.quantity}</span>
                              </div>
                              <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono tabular-nums shrink-0">{item.credits} CR</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed border-border/70 bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                          <span>We’ll finalize the exact deliverables together during the brief review.</span>
                          <span className="font-mono text-2xs text-muted-foreground/60">Awaiting Brief</span>
                        </div>
                      )}
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
