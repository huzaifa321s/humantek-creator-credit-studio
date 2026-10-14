'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ServiceDefinition } from '@/types';
import { getServiceMetadata, DEFAULT_SCOPE_DETAILS, TIER_NAMES } from '@/lib/catalog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CreditValue } from '@/components/ui/credit-value';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Sparkles } from 'lucide-react';
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
  const scopeList = service.scopeDetails ?? DEFAULT_SCOPE_DETAILS;

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
        className="w-[245px] overflow-hidden p-0 ring-0 border-x border-b border-t-0 border-border/80 bg-card/95 backdrop-blur-md shadow-md rounded-xl select-none z-50 animate-in fade-in-0 zoom-in-95 duration-150"
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
            sizes="245px"
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
                <Badge variant="outline" size="xs" className="text-2xs font-bold uppercase tracking-wider">
                  Quote
                </Badge>
              ) : (
                <CreditValue value={service.prices[0]} size="xs" />
              )}
            </div>
          </div>

          {/* Authentic Scope Tiers Checklist */}
          <div className="space-y-1">
            {TIER_NAMES.map((tierName, idx) => (
              <div
                key={tierName}
                className="flex items-start gap-1.5 text-2xs text-muted-foreground leading-normal"
              >
                <Check className="size-3 text-emerald-500 shrink-0 stroke-[2.5] mt-0.5" />
                <span className="line-clamp-1">
                  <strong className="font-semibold text-foreground/90">{tierName}:</strong> {scopeList[idx]}
                </span>
              </div>
            ))}
          </div>

          {/* Category Info Bar */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-2xs text-muted-foreground font-medium">
            <span>{service.category}</span>
            <span className="inline-flex items-center gap-1 text-foreground/85">
              <Sparkles className="size-3 text-brand-text dark:text-amber-400 shrink-0" />
              <span>{service.quoteOnly ? 'Custom quote' : `${service.prices[0]}–${service.prices[2]} CR`}</span>
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
