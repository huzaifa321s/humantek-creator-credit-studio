'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CreditValue } from '@/components/ui/credit-value';
import { toast } from 'sonner';
import {
  MessageSquare,
  FileText,
  ImageIcon,
  ExternalLink,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn, formatStudioDate } from '@/lib/utils';
import { useStudioChat } from '@/lib/chatStore';
import type { ClientProjectView, ClientReferenceFile } from '@/lib/serializers/project';

interface ClientProjectDetailsDrawerProps {
  projectId: string | null;
  onClose: () => void;
}

function getStatusDetails(status: string) {
  switch (status) {
    case 'pending_review':
      return {
        label: 'Pending Studio Review',
        variant: 'gold' as const,
        nextStep: 'Studio creative lead is reviewing your brief and confirming scope. Expected response within 2–4 hours.',
        badgeColor: 'bg-amber-400 animate-pulse',
      };
    case 'payment_confirmed':
      return {
        label: 'Payment Confirmed',
        variant: 'success' as const,
        nextStep: 'Your project is queued for production and being assigned to our specialized creator artists.',
        badgeColor: 'bg-emerald-500',
      };
    case 'in_production':
      return {
        label: 'In Production',
        variant: 'gold' as const,
        nextStep: 'Production active! Artists are illustrating and rendering your assets.',
        badgeColor: 'bg-amber-400 animate-pulse',
      };
    case 'review_round':
      return {
        label: 'Review Round Open',
        variant: 'purple' as const,
        nextStep: 'First asset drafts are ready! Review your deliverables and submit feedback or approval.',
        badgeColor: 'bg-purple-500',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        variant: 'success' as const,
        nextStep: 'All final project assets have been completed and verified.',
        badgeColor: 'bg-emerald-500',
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        variant: 'secondary' as const,
        nextStep: 'Your project is currently in progress.',
        badgeColor: 'bg-muted-foreground',
      };
  }
}

export function ClientProjectDetailsDrawer({
  projectId,
  onClose,
}: ClientProjectDetailsDrawerProps) {
  const queryClient = useQueryClient();
  const { setIsOpen: setChatOpen } = useStudioChat();

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // On-demand project details fetch (signed URLs generated only when drawer opens)
  const {
    data: project,
    isLoading,
    isError,
    error,
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
  });

  // Additional note mutation (only available before production)
  const noteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit additional note');
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Additional note recorded on your brief');
      setNewNote('');
      setIsAddingNote(false);
      void queryClient.invalidateQueries({ queryKey: ['projects', 'detail', projectId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Could not add note');
    },
  });

  const files = useMemo(() => project?.uploadedFiles || [], [project]);
  const hasImages = files.length > 0;

  // Keyboard navigation for Lightbox modal
  useEffect(() => {
    if (activeImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveImageIndex(null);
      } else if (e.key === 'ArrowRight') {
        setActiveImageIndex((prev) =>
          prev !== null ? (prev + 1) % files.length : 0
        );
      } else if (e.key === 'ArrowLeft') {
        setActiveImageIndex((prev) =>
          prev !== null ? (prev - 1 + files.length) % files.length : 0
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, files.length]);

  const canAddNote =
    project?.status === 'pending_review' || project?.status === 'payment_confirmed';

  const statusMeta = project ? getStatusDetails(project.status) : null;

  return (
    <>
      <Sheet open={Boolean(projectId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-card border-l border-border/80 shadow-2xl"
        >
          {/* Header */}
          <SheetHeader className="p-5 border-b border-border/80 bg-secondary/15 shrink-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {project && (
                <>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="font-mono tabular-nums text-brand-text dark:text-amber-300 bg-amber-400/10 border-amber-400/30 font-bold"
                  >
                    {project.projectCode}
                  </Badge>
                  <Badge variant="gold" size="sm" className="font-bold">
                    {project.packageName}
                  </Badge>
                  {project.paymentStatus === 'paid' && (
                    <Badge variant="success" size="sm" className="font-semibold text-2xs uppercase">
                      Paid
                    </Badge>
                  )}
                </>
              )}
            </div>
            <SheetTitle className="text-xl font-bold tracking-tight text-foreground truncate">
              {isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                project?.channelName || project?.packageName || 'Project Details'
              )}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2">
              {project && (
                <span>
                  Submitted {formatStudioDate(project.createdAt)} · Platform:{' '}
                  <b className="text-foreground font-medium">{project.platform || 'General'}</b>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Drawer Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs select-text">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : isError || !project ? (
              <div className="p-8 text-center space-y-3">
                <AlertCircle className="size-8 text-destructive mx-auto" />
                <h3 className="font-bold text-foreground text-sm">Could not load project details</h3>
                <p className="text-muted-foreground text-xs">
                  {error instanceof Error ? error.message : 'Please check your connection and try again.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* 1. Status & What Happens Next Card */}
                {statusMeta && (
                  <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                        Current Status
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full shrink-0', statusMeta.badgeColor)} />
                        <span className="font-bold text-foreground text-xs">{statusMeta.label}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/25 flex items-start gap-2.5">
                      <Clock className="size-4 text-brand-text dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <b className="text-foreground font-semibold block mb-0.5">What happens next:</b>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {statusMeta.nextStep}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Specs Summary */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/70 bg-secondary/10">
                  <div>
                    <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Aesthetic Style
                    </span>
                    <b className="text-foreground font-semibold truncate block">{project.style || 'Custom Art'}</b>
                  </div>
                  <div>
                    <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                      Color Palette
                    </span>
                    <b className="text-foreground font-semibold truncate block">{project.colors || 'Brand Colors'}</b>
                  </div>
                </div>

                {/* 3. Creative Brief Instructions (Immutable Snapshot, Plain Text Safe) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-brand-text dark:text-amber-400" />
                      <span>Submitted Creative Brief</span>
                    </span>
                    <Badge variant="outline" size="xs" className="font-mono text-2xs text-muted-foreground">
                      Snapshot
                    </Badge>
                  </div>
                  {/* Strict plain text rendering with preserved line breaks (immune to HTML/XSS injection) */}
                  <div
                    data-testid="brief-instructions"
                    className="p-3.5 rounded-xl bg-secondary/20 border border-border/80 text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans text-xs break-words"
                  >
                    {project.instructions || 'No specific creative notes submitted.'}
                  </div>
                </div>

                {/* 4. External Reference Links */}
                {project.referenceLinks && project.referenceLinks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ExternalLink className="size-3.5 text-brand-text dark:text-amber-400" />
                      <span>Reference Links ({project.referenceLinks.length})</span>
                    </span>
                    <div className="space-y-1.5">
                      {project.referenceLinks.map((link, idx) => {
                        let domain = 'link';
                        try {
                          domain = new URL(link).hostname.replace(/^www\./, '');
                        } catch {}
                        return (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors group"
                          >
                            <span className="font-mono text-2xs text-brand-text dark:text-amber-400 font-semibold">
                              {domain}
                            </span>
                            <span className="text-muted-foreground text-xs truncate max-w-[280px] group-hover:text-foreground">
                              {link}
                            </span>
                            <ExternalLink className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Reference Images Gallery (With Lightbox & Placeholders) */}
                {hasImages && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ImageIcon className="size-3.5 text-brand-text dark:text-amber-400" />
                        <span>Reference Images ({files.length})</span>
                      </span>
                      <span className="text-2xs text-muted-foreground">Click to enlarge</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {files.map((file, i) => {
                        const isBroken = brokenImages.has(file.id);
                        return (
                          <div
                            key={file.id}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-border/80 bg-secondary/20 shadow-2xs"
                          >
                            {file.url && !isBroken ? (
                              <button
                                type="button"
                                onClick={() => setActiveImageIndex(i)}
                                aria-label={`Enlarge reference image: ${file.filename}`}
                                className="size-full cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={file.url}
                                  alt={file.filename}
                                  loading="lazy"
                                  onError={() =>
                                    setBrokenImages((prev) => new Set(prev).add(file.id))
                                  }
                                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                              </button>
                            ) : (
                              <div
                                title={`${file.filename} (image unavailable)`}
                                className="size-full flex flex-col items-center justify-center p-2 text-center text-muted-foreground border border-dashed border-border"
                              >
                                <ImageIcon className="size-5 mb-1 opacity-60" />
                                <span className="text-3xs truncate max-w-full font-mono">
                                  {file.filename}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6. Deliverable Assets Breakdown */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand-text dark:text-amber-400" />
                    <span>Included Deliverables ({project.selections.length})</span>
                  </span>
                  {project.selections.length > 0 ? (
                    <div className="divide-y divide-border/50 rounded-xl border border-border/70 bg-card overflow-hidden">
                      {project.selections.map((sel, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3.5 py-2">
                          <span className="font-medium text-foreground">
                            {sel.name} × {sel.quantity}
                          </span>
                          <span className="font-mono font-bold text-brand-text dark:text-amber-400">
                            {sel.credits} CR
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Custom package deliverables finalized during studio review.
                    </p>
                  )}
                </div>

                {/* 7. Additional Notes Section (Dated additions post-submission) */}
                <div className="space-y-2.5 pt-2 border-t border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Additional Notes ({project.additionalNotes?.length || 0})
                    </span>
                    {canAddNote && !isAddingNote && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setIsAddingNote(true)}
                        className="h-7 px-2 text-xs font-semibold gap-1 rounded-md"
                      >
                        <Plus className="size-3" />
                        <span>Add note</span>
                      </Button>
                    )}
                  </div>

                  {project.additionalNotes && project.additionalNotes.length > 0 ? (
                    <div className="space-y-2">
                      {project.additionalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 rounded-lg border border-border/70 bg-secondary/15 space-y-1"
                        >
                          <div className="flex items-center justify-between text-2xs text-muted-foreground font-mono">
                            <span>{note.authorRole === 'admin' ? 'Studio Team' : 'You (Client)'}</span>
                            <span>{formatStudioDate(note.createdAt)}</span>
                          </div>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {note.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xs text-muted-foreground">
                      No additional notes added yet.
                    </p>
                  )}

                  {/* Add Note Form */}
                  {isAddingNote && (
                    <div className="p-3 rounded-xl border border-amber-400/40 bg-card space-y-2.5">
                      <Textarea
                        placeholder="Add extra clarification, styling preference or reference link..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                        className="text-xs resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={noteMutation.isPending}
                          onClick={() => {
                            setIsAddingNote(false);
                            setNewNote('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="gold"
                          size="xs"
                          disabled={newNote.trim().length < 5 || noteMutation.isPending}
                          onClick={() => noteMutation.mutate(newNote)}
                        >
                          {noteMutation.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            'Save Note'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!canAddNote && (
                    <p className="text-2xs text-muted-foreground/80 italic">
                      Project is in active production. To request scope changes or submit extra files, please use project messages.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-border/80 bg-secondary/15 flex items-center justify-between gap-3 shrink-0">
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Accessible Full-Screen Lightbox Modal */}
      {activeImageIndex !== null && files[activeImageIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image Preview Lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setActiveImageIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between text-white/90 pb-3 px-2">
              <span className="text-xs font-mono tabular-nums">
                {activeImageIndex + 1} / {files.length} · {files[activeImageIndex].filename}
              </span>
              <div className="flex items-center gap-2">
                {files[activeImageIndex].url && (
                  <a
                    href={files[activeImageIndex].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 px-2 py-1"
                  >
                    <span>Open full</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveImageIndex(null)}
                  aria-label="Close image preview"
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Main Preview Image */}
            <div className="relative max-h-[75vh] flex items-center justify-center overflow-hidden rounded-xl bg-black/40 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={files[activeImageIndex].url}
                alt={files[activeImageIndex].filename}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Prev / Next Buttons */}
            {files.length > 1 && (
              <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2 pointer-events-none">
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() =>
                    setActiveImageIndex((prev) =>
                      prev !== null ? (prev - 1 + files.length) % files.length : 0
                    )
                  }
                  className="pointer-events-auto size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors shadow-lg"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() =>
                    setActiveImageIndex((prev) =>
                      prev !== null ? (prev + 1) % files.length : 0
                    )
                  }
                  className="pointer-events-auto size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors shadow-lg"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
