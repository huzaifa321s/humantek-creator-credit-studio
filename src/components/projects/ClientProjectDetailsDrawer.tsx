'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Zap, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatStudioDate, getProjectStatusLabel, getProjectStatusBadgeClass } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { ChatGate } from '@/components/chat/ChatGate';
import { downloadProjectInvoice, preloadProjectInvoice } from '@/lib/invoice';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { ReferenceImageGrid } from '@/components/ui/reference-image-grid';
import {
  ProjectDrawerSpecsCard,
  ProjectDrawerBriefSection,
  ProjectDrawerPaymentBanner,
  ProjectDrawerLinksSection,
  ProjectDrawerServicesSection,
  ProjectDrawerSkeleton,
  ProjectDrawerNotFound,
} from '@/components/projects/ProjectDrawerSections';
import { useProjectDetailQuery } from '@/lib/queries/projects';
import type { ProjectRecord } from '@/types';

interface ClientProjectDetailsDrawerProps {
  projectId: string | null;
  initialProject?: ProjectRecord | null;
  onClose: () => void;
}

export function ClientProjectDetailsDrawer({
  projectId,
  initialProject = null,
  onClose,
}: ClientProjectDetailsDrawerProps) {
  const { setIsOpen: setChatOpen } = useStudioChat();

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // Warm up jsPDF and font payloads as soon as the drawer opens
  useEffect(() => {
    if (projectId) {
      preloadProjectInvoice();
    }
  }, [projectId]);

  // Unified on-demand project details query (seeds placeholderData from cached lists + fetches fresh signed URLs)
  const {
    data: fetchedProject,
    isLoading,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useProjectDetailQuery(projectId, { initialProject });

  // Use freshly fetched detail if available; otherwise fall back to placeholder/initialProject from the list
  // so text/brief/services render immediately while signed image URLs load in the background.
  const project = useMemo(() => {
    if (fetchedProject && fetchedProject.id === projectId) return fetchedProject;
    if (initialProject && initialProject.id === projectId) return initialProject;
    return null;
  }, [fetchedProject, initialProject, projectId]);

  const isSigningImages = Boolean((!fetchedProject || isPlaceholderData) && isFetching);
  const files = useMemo(() => project?.uploadedFiles || [], [project]);

  return (
    <>
      <Sheet open={Boolean(projectId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col h-dvh overflow-hidden bg-card border-l border-border/80 shadow-2xl"
        >
          {/* Header */}
          <SheetHeader className="p-4 sm:p-5 pr-12 border-b border-border/80 bg-secondary/15 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap min-w-0">
              {project ? (
                <>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="font-mono tabular-nums text-muted-foreground bg-secondary/40 border-border/80 font-semibold shrink-0"
                  >
                    {project.projectCode}
                  </Badge>
                  <Badge variant="gold" size="sm" className="font-bold truncate max-w-[200px]">
                    {project.packageName}
                  </Badge>
                  <Badge
                    variant="outline"
                    size="sm"
                    className={cn(
                      'font-semibold text-2xs shrink-0',
                      getProjectStatusBadgeClass(project.status)
                    )}
                  >
                    {getProjectStatusLabel(project.status)}
                  </Badge>
                  {project.paymentStatus === 'paid' && (
                    <Badge variant="success" size="sm" className="font-semibold text-2xs uppercase shrink-0">
                      Paid
                    </Badge>
                  )}
                  {project.additions?.includes('rush') && (
                    <Badge
                      variant="warning"
                      size="sm"
                      className="font-semibold text-2xs gap-1 shrink-0"
                    >
                      <Zap className="size-3" />
                      <span>Rush</span>
                    </Badge>
                  )}
                </>
              ) : isLoading ? (
                <>
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-28 rounded-md" />
                </>
              ) : null}
            </div>
            <SheetTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              {!project && isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                project?.channelName || project?.packageName || 'Project Details'
              )}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 min-w-0">
              {project ? (
                <span className="truncate">
                  Submitted {formatStudioDate(project.createdAt)} · Platform:{' '}
                  <b className="text-foreground font-medium">{project.platform || 'General'}</b>
                </span>
              ) : isLoading ? (
                <Skeleton className="h-4 w-56" />
              ) : null}
            </SheetDescription>
          </SheetHeader>

          {/* Drawer Scrollable Body */}
          <ScrollArea className="flex-1 min-h-0 w-full">
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-xs select-text min-w-0">
              {!project && isLoading ? (
                <ProjectDrawerSkeleton />
              ) : !project ? (
                <ProjectDrawerNotFound onClose={onClose} onRetry={() => refetch()} />
              ) : (
                <>
                  {/* 0. Payment status */}
                  <ProjectDrawerPaymentBanner
                    instructions={project.instructions}
                    paymentStatus={project.paymentStatus}
                    projectStatus={project.status}
                    audience="client"
                  />

                  {/* 1. Aesthetic Style & Color Palette */}
                  <ProjectDrawerSpecsCard style={project.style} colors={project.colors} />

                  {/* 2. Creative Brief Instructions */}
                  <ProjectDrawerBriefSection
                    instructions={project.instructions}
                    title="Project Brief"
                  />

                  {/* 3. Reference Links */}
                  <ProjectDrawerLinksSection links={project.referenceLinks} />

                  {/* 4. Reference Images (Signed URLs load on demand with targeted skeleton) */}
                  {files.length > 0 && (
                    <ReferenceImageGrid
                      files={files}
                      isLoading={isSigningImages}
                      onSelectImage={(index) => setActiveImageIndex(index)}
                    />
                  )}

                  <Separator className="bg-border/60" />

                  {/* 5. Selected Services */}
                  <ProjectDrawerServicesSection
                    selections={project.selections}
                    usedCredits={project.usedCredits}
                    emptyMessage="Custom package services will be finalized during studio review."
                  />
                </>
              )}
            </div>
          </ScrollArea>

          {/* Drawer Footer Actions */}
          <SheetFooter className="p-3 sm:p-4 border-t border-border/80 bg-secondary/15 flex-row items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold h-9 px-3 rounded-lg cursor-pointer shrink-0"
            >
              Close
            </Button>
            {project && (
              <div className="flex items-center gap-1.5 sm:gap-2 ml-auto min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isDownloadingInvoice}
                  loadingText="Invoice..."
                  onClick={async () => {
                    if (isDownloadingInvoice) return;
                    setIsDownloadingInvoice(true);
                    try {
                      await downloadProjectInvoice(project);
                      toast.success(`Invoice INV-${project.projectCode} downloaded`);
                    } catch {
                      toast.error('Could not generate invoice PDF');
                    } finally {
                      setIsDownloadingInvoice(false);
                    }
                  }}
                  className="text-xs font-semibold h-9 px-2.5 sm:px-3.5 gap-1.5 rounded-lg cursor-pointer shrink-0"
                >
                  <Download className="size-3.5 text-brand-text dark:text-amber-400" />
                  <span>Invoice</span>
                </Button>
                <ChatGate>
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    onClick={() => {
                      onClose();
                      setChatOpen(true, project.id);
                    }}
                    className="text-xs font-bold h-9 px-3 sm:px-4 gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20 shrink-0"
                  >
                    <MessageSquare className="size-3.5" />
                    <span className="sm:hidden">Project Chat</span>
                    <span className="hidden sm:inline">Open Project Chat</span>
                  </Button>
                </ChatGate>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Unified Accessible Full-Screen Lightbox Portal (Layer Scale z-60) */}
      <ImageLightbox
        images={files}
        initialIndex={activeImageIndex ?? 0}
        open={activeImageIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setActiveImageIndex(null);
        }}
        onRetry={async () => {
          await refetch();
        }}
      />
    </>
  );
}
