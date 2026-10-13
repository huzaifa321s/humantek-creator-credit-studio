'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LightboxImage {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
  storagePath?: string;
}

export interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (index: number) => Promise<void> | void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
  onRetry,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Touch tracking for mobile swipe
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  // Content refs to distinguish background clicks from content clicks
  const headerRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const errorCardRef = useRef<HTMLDivElement | null>(null);
  const isPointerDownOutsideRef = useRef(false);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (open) {
      const validIndex = Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0)));
      setCurrentIndex(validIndex);
    }
  }, [open, initialIndex, images.length]);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const goToPrev = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [hasMultiple, images.length]);

  const goToNext = useCallback(() => {
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [hasMultiple, images.length]);

  // Keyboard navigation: ArrowLeft / ArrowRight (use capture phase to handle events before any child traps)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, goToPrev, goToNext]);

  // Preload neighboring images (next and previous) for instantaneous transitions
  useEffect(() => {
    if (!open || images.length <= 1) return;
    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;

    [images[nextIdx]?.url, images[prevIdx]?.url].forEach((url) => {
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [open, currentIndex, images]);

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    didSwipeRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Minimum swipe threshold: 45px horizontal and more horizontal than vertical
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      didSwipeRef.current = true;
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Helper to determine whether an element is part of interactive content
  const isTargetInsideContent = (target: HTMLElement | null): boolean => {
    if (!target) return false;
    return Boolean(
      target.closest('img') ||
      errorCardRef.current?.contains(target) ||
      headerRef.current?.contains(target) ||
      footerRef.current?.contains(target) ||
      target.closest('button') ||
      target.closest('a')
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    isPointerDownOutsideRef.current = !isTargetInsideContent(target);
  };

  const handlePopupClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If mobile swipe just occurred, suppress click closure
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      isPointerDownOutsideRef.current = false;
      return;
    }

    // Only close if pointerdown also originated on the backdrop / outside area
    if (!isPointerDownOutsideRef.current) return;
    isPointerDownOutsideRef.current = false;

    const target = e.target as HTMLElement | null;
    if (!isTargetInsideContent(target)) {
      onOpenChange(false);
    }
  };

  // Image load error handler
  const handleImageError = () => {
    setFailedIndices((prev) => new Set(prev).add(currentIndex));
  };

  // Retry action
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRetry) {
        await onRetry(currentIndex);
      }
      setFailedIndices((prev) => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
      setRetryKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to retry loading image:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!open || !currentImage) return null;

  const isFailed = failedIndices.has(currentIndex);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Layer Scale: z-60 (z-lightbox) strictly above drawer z-50. Plain dark dim background, ZERO backdrop blur */}
        <DialogPrimitive.Backdrop
          data-slot="image-lightbox-backdrop"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-60 bg-black/85 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
        />

        <DialogPrimitive.Popup
          data-slot="image-lightbox-popup"
          className="fixed inset-0 z-60 flex flex-col justify-between p-3 sm:p-5 outline-none select-none overflow-hidden cursor-default"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onClick={handlePopupClick}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              goToPrev();
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              goToNext();
            }
          }}
        >
          {/* Accessible Dialog Title & Description */}
          <DialogPrimitive.Title className="sr-only">
            Image Preview: {currentImage.filename}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full-screen viewer for project reference images. Use arrow keys or swipe to navigate. Press Escape to close.
          </DialogPrimitive.Description>

          {/* Top Control Bar */}
          <header
            ref={headerRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-between text-zinc-100 z-10 py-1 px-1 sm:px-2 pointer-events-auto"
          >
            <div className="flex items-center gap-2 min-w-0 pr-3">
              <span
                data-slot="lightbox-counter"
                className="text-xs font-mono font-bold tabular-nums text-zinc-300 shrink-0"
              >
                {currentIndex + 1} / {images.length}
              </span>
              <span className="text-zinc-500 shrink-0 select-none">·</span>
              <span
                className="text-xs font-medium text-zinc-200 truncate max-w-[160px] sm:max-w-md"
                title={currentImage.filename}
              >
                {currentImage.filename}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {currentImage.url && (
                <a
                  href={currentImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <span>Open original</span>
                  <ExternalLink className="size-3.5" />
                </a>
              )}

              <DialogPrimitive.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close image viewer"
                    className="size-9 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                }
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </header>

          {/* Center Display Area */}
          <main className="relative flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden my-auto pointer-events-auto">
            {isFailed ? (
              <div
                ref={errorCardRef}
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-white/10 bg-zinc-900/90 text-zinc-200 max-w-sm shadow-2xl"
              >
                <AlertCircle className="size-10 text-amber-400 mb-3" />
                <h3 className="text-sm font-bold text-zinc-100">Unable to load image</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  The signed link may have expired or your connection was interrupted.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="gap-1.5 border-white/20 hover:bg-white/10 text-xs"
                  >
                    {isRetrying ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    <span>Retry</span>
                  </Button>
                  {currentImage.url && (
                    <a
                      href={currentImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-300 hover:text-white underline px-2 py-1"
                    >
                      Open link
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative max-h-full max-w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`${currentImage.url}-${retryKey}`}
                  src={currentImage.url}
                  alt={currentImage.filename || `Reference image ${currentIndex + 1}`}
                  onError={handleImageError}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[75vh] sm:max-h-[82vh] w-auto max-w-[92vw] sm:max-w-[85vw] object-contain rounded-lg shadow-2xl transition-all duration-150 select-none pointer-events-auto cursor-default"
                />
              </div>
            )}

            {/* Left & Right Arrow Navigation (desktop and tablet) */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrev();
                  }}
                  className="hidden sm:flex absolute left-2 md:left-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-white/15 items-center justify-center cursor-pointer shadow-xl transition-all active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <ChevronLeft className="size-6" />
                </button>

                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="hidden sm:flex absolute right-2 md:right-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-white/15 items-center justify-center cursor-pointer shadow-xl transition-all active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </main>

          {/* Mobile Bottom Navigation & Thumbnails */}
          <footer
            ref={footerRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center z-10 py-1 pointer-events-auto"
          >
            {hasMultiple && (
              <div className="flex sm:hidden items-center justify-between w-full px-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goToPrev}
                  className="text-xs text-zinc-300 hover:text-white gap-1"
                >
                  <ChevronLeft className="size-4" />
                  <span>Prev</span>
                </Button>
                <span className="text-2xs font-mono tabular-nums text-zinc-400">
                  Swipe or tap
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goToNext}
                  className="text-xs text-zinc-300 hover:text-white gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
