'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { ImageIcon, Eye, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import { ImageLightbox, type LightboxImage } from '@/components/ui/image-lightbox';
import { cn } from '@/lib/utils';

export interface ReferenceImageItem {
  id: string;
  filename: string;
  url?: string;
  size?: number;
  mimeType?: string;
}

export interface SkeletonImageProps extends Omit<React.ComponentProps<'img'>, 'src'> {
  src?: string | null;
  alt: string;
  skeletonClassName?: string;
}

/**
 * Reusable studio image component that displays a themed `<Skeleton />`
 * while the signed URL is pending, while the image bytes are downloading,
 * or in place of a broken fallback. Once loaded, the image fades in smoothly
 * and unmounts the skeleton to avoid idle animation overhead.
 */
export function SkeletonImage({
  src,
  alt,
  className,
  skeletonClassName,
  ...props
}: SkeletonImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const isLoaded = Boolean(src && loadedSrc === src);
  const isBroken = Boolean(!src || failedSrc === src);

  const handleImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (node && src && node.complete) {
        if (node.naturalWidth > 0) {
          setLoadedSrc(src);
        }
      }
    },
    [src]
  );

  return (
    <div className="relative size-full overflow-hidden">
      {(!isLoaded || isBroken) && (
        <Skeleton
          data-slot="image-skeleton"
          className={cn('absolute inset-0 size-full rounded-none', skeletonClassName)}
        />
      )}
      {src && !isBroken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={handleImgRef}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={cn(
            'size-full object-cover transition-all duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      )}
    </div>
  );
}

export interface ReferenceImageGridProps {
  files: ReferenceImageItem[];
  onSelectImage: (index: number) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Unified 3-column Reference Images gallery for Client & Admin project drawers.
 * Renders a `<Skeleton />` for every slot while signed URLs or image bytes load,
 * eliminating jarring broken-image fallback icons.
 */
export function ReferenceImageGrid({
  files,
  onSelectImage,
  isLoading = false,
  className,
}: ReferenceImageGridProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className={cn('space-y-2 min-w-0', className)}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5 min-w-0 truncate">
          <ImageIcon className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          <span className="truncate">Reference Images ({files.length})</span>
        </span>
        <span className="text-2xs text-muted-foreground shrink-0">Click to enlarge</span>
      </div>

      <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 sm:gap-2.5">
        {files.map((file, i) => {
          const showSkeletonOnly = isLoading && !file.url;

          return (
            <div
              key={file.id || i}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border/80 bg-secondary/20 shadow-2xs"
            >
              {showSkeletonOnly ? (
                <Skeleton className="size-full rounded-none" />
              ) : file.url ? (
                <button
                  type="button"
                  onClick={() => onSelectImage(i)}
                  title={file.filename}
                  aria-label={`Enlarge reference image: ${file.filename}`}
                  className="size-full block cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <SkeletonImage
                    src={file.url}
                    alt={file.filename}
                    className="group-hover:scale-105"
                  />
                </button>
              ) : (
                <div
                  title={file.filename}
                  aria-label={file.filename}
                  className="size-full"
                >
                  <Skeleton className="size-full rounded-none" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAttachmentSize(size?: number): string {
  if (!size || size <= 0) return '';
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export interface UploadedAttachmentListProps {
  files: ReferenceImageItem[];
  uploadingNames?: string[];
  onRemove?: (id: string) => void;
  onRetry?: () => Promise<void> | void;
  className?: string;
}

/**
 * Reusable ReUI / shadcn `Attachment` preview strip paired with the full-screen
 * `ImageLightbox` modal. Used in Step 4 (Reference Art & Files upload) and
 * Step 5 (Production Brief review) so users can click any uploaded thumbnail card
 * to inspect it in full resolution.
 */
export function UploadedAttachmentList({
  files,
  uploadingNames = [],
  onRemove,
  onRetry,
  className,
}: UploadedAttachmentListProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  const lightboxImages: LightboxImage[] = useMemo(
    () =>
      files
        .filter((f): f is ReferenceImageItem & { url: string } => Boolean(f.url))
        .map((f) => ({
          id: f.id,
          url: f.url,
          filename: f.filename,
          size: f.size,
          mimeType: f.mimeType,
        })),
    [files]
  );

  if (files.length === 0 && uploadingNames.length === 0) return null;

  return (
    <>
      <AttachmentGroup className={cn('pt-0.5', className)}>
        {files.map((f) => {
          const lbIndex = lightboxImages.findIndex((img) => img.id === f.id);
          const canPreview = lbIndex !== -1;
          const sizeLabel = formatAttachmentSize(f.size);

          return (
            <Attachment
              key={f.id}
              size="sm"
              className={cn(
                'min-w-0 max-w-[220px] border-border/80 bg-card/90 shadow-2xs transition-all',
                canPreview && 'hover:border-amber-400/50 cursor-pointer'
              )}
            >
              {canPreview && (
                <AttachmentTrigger
                  onClick={() => setActiveImageIndex(lbIndex)}
                  aria-label={`Preview ${f.filename}`}
                  title={`Click to preview ${f.filename}`}
                  className="cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-amber-400"
                />
              )}

              <AttachmentMedia
                variant="image"
                className="size-9 rounded-lg border border-border/60 shrink-0"
              >
                <SkeletonImage
                  src={f.url}
                  alt={f.filename}
                  className="group-hover/attachment:scale-105"
                />
                {canPreview && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-150 group-hover/attachment:opacity-100">
                    <Eye className="size-3.5 text-white drop-shadow-xs" />
                  </div>
                )}
              </AttachmentMedia>

              <AttachmentContent>
                <AttachmentTitle className="text-xs font-semibold text-foreground group-hover/attachment:text-brand-text dark:group-hover/attachment:text-amber-400 transition-colors">
                  {f.filename}
                </AttachmentTitle>
                <AttachmentDescription className="text-2xs font-mono tabular-nums">
                  {sizeLabel ? `${sizeLabel}${canPreview ? ' · Preview' : ''}` : canPreview ? 'Click to preview' : 'Attached'}
                </AttachmentDescription>
              </AttachmentContent>

              {onRemove && (
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remove ${f.filename}`}
                    title={`Remove ${f.filename}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(f.id);
                    }}
                    className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-md"
                  >
                    <X className="size-3.5" />
                  </AttachmentAction>
                </AttachmentActions>
              )}
            </Attachment>
          );
        })}

        {uploadingNames.map((name) => (
          <Attachment
            key={`uploading-${name}`}
            size="sm"
            state="uploading"
            className="min-w-0 max-w-[220px] border-border/80 bg-card/90 shadow-2xs"
          >
            <AttachmentMedia className="size-9 rounded-lg border border-border/60 shrink-0">
              <Skeleton className="size-full rounded-none" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle className="text-xs font-semibold">{name}</AttachmentTitle>
              <AttachmentDescription className="text-2xs">
                Uploading…
              </AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </AttachmentGroup>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={activeImageIndex ?? 0}
        open={activeImageIndex !== null && lightboxImages.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen) setActiveImageIndex(null);
        }}
        onRetry={onRetry}
      />
    </>
  );
}

