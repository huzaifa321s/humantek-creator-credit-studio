'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { MessageSquare, Zap } from 'lucide-react';
import { formatStudioDate, getProjectStatusLabel } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { ReferenceImageGrid } from '@/components/ui/reference-image-grid';
import {
  ProjectDrawerSpecsCard,
  ProjectDrawerBriefSection,
  ProjectDrawerLinksSection,
  ProjectDrawerServicesSection,
  ProjectDrawerSkeleton,
  ProjectDrawerNotFound,
} from '@/components/projects/ProjectDrawerSections';
import type { ClientProjectView } from '@/lib/serializers/project';
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

  // On-demand project details fetch (signed URLs generated only when drawer opens)
  const {
    data: fetchedProject,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<ClientProjectView>({
    queryKey: ['projects', 'detail', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (res.status === 404) throw new Error('Project not found');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load project details');
      }
      const json = await res.json();
      return json.project as ClientProjectView;
    },
    enabled: Boolean(projectId),
    staleTime: 0, // Always ensure fresh signed URLs upon opening
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'Project not found') {
        return false;
      }
      return failureCount < 1;
    },
  });

  // Use freshly fetched detail if available; otherwise fall back to initialProject from the list
  // so text/brief/services render immediately while signed image URLs load in the background.
  const project = useMemo(() => {
    if (fetchedProject && fetchedProject.id === projectId) return fetchedProject;
    if (initialProject && initialProject.id === projectId) return initialProject;
    return null;
  }, [fetchedProject, initialProject, projectId]);

  const isSigningImages = Boolean(!fetchedProject && isFetching);
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
                    className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold shrink-0"
                  >
                    {project.projectCode}
                  </Badge>
                  <Badge variant="gold" size="sm" className="font-bold truncate max-w-[200px]">
                    {project.packageName}
                  </Badge>
                  <Badge variant="secondary" size="sm" className="font-semibold text-2xs shrink-0">
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
                  {/* 1. Aesthetic Style & Color Palette */}
                  <ProjectDrawerSpecsCard style={project.style} colors={project.colors} />

                  {/* 2. Creative Brief Instructions */}
                  <ProjectDrawerBriefSection
                    instructions={project.instructions}
                    title="Submitted Creative Brief"
                    showSnapshotBadge
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
          <SheetFooter className="p-4 border-t border-border/80 bg-secondary/15 flex-row items-center justify-between gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold h-9 px-4 rounded-lg cursor-pointer"
            >
              Close
            </Button>
            {project && (
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => {
                  onClose();
                  setChatOpen(true, project.id);
                }}
                className="text-xs font-bold h-9 px-4 gap-1.5 rounded-lg cursor-pointer shadow-xs shadow-amber-400/20"
              >
                <MessageSquare className="size-3.5" />
                <span>Open Project Chat</span>
              </Button>
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
