'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ServiceDefinition } from '@/types';
import { getServiceMetadata } from '@/lib/catalog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CreditValue } from '@/components/ui/credit-value';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceImageHoverCardProps {
  service: ServiceDefinition;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function ServiceImageHoverCard({
  service,
  children,
  side = 'top',
  align = 'center',
}: ServiceImageHoverCardProps) {
  const meta = getServiceMetadata(service);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Guarantee a beautiful, full-bleed artwork preview for all categories
  const fallbackImage =
    ['VTuber', 'Artwork', 'Content', '3D'].includes(service.category)
      ? '/previews/oc-sheet.jpg'
      : '/previews/animated-logo.jpg';
  const previewSrc = meta.previewImage || fallbackImage;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        closeDelay={120}
        render={children as React.ReactElement}
      />
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-[230px] overflow-hidden p-0 ring-0 border-x border-b border-t-0 border-border/80 bg-card/95 backdrop-blur-md shadow-md rounded-xl select-none z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Full-bleed, edge-to-edge deliverable image with Skeleton shimmer */}
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
          {!imageLoaded && (
            <Skeleton className="absolute inset-0 size-full rounded-none bg-muted/80 animate-pulse" />
          )}
          <Image
            src={previewSrc}
            alt={`${service.name} preview`}
            fill
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "object-cover object-center transition-all duration-300",
              imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-98"
            )}
            sizes="230px"
          />
        </div>

        {/* High-value details body */}
        <div className="p-2.5 space-y-2">
          {/* Header Row: Service Name & Starting Rate */}
          <div className="flex items-center justify-between gap-1.5 leading-tight">
            <h4 className="text-xs font-bold text-foreground truncate">
              {service.name}
            </h4>
            <div className="shrink-0">
              {service.quoteOnly ? (
                <Badge variant="outline" size="xs" className="text-[10px] font-bold">
                  Quote
                </Badge>
              ) : (
                <CreditValue value={service.prices[0]} size="xs" />
              )}
            </div>
          </div>

          {/* High-Value Deliverables Checklist (2-3 concise bullets) */}
          <div className="space-y-1">
            {meta.deliverables.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug"
              >
                <Check className="size-3 text-emerald-500 shrink-0 stroke-[2.5] mt-0.5" />
                <span className="line-clamp-1">{item}</span>
              </div>
            ))}
          </div>

          {/* Turnaround & Revisions Info Bar */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground font-medium">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3 text-amber-500 shrink-0" />
              <span>{meta.turnaround}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-foreground/85">
              <Sparkles className="size-3 text-amber-500 shrink-0" />
              <span>{meta.revisions}</span>
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
