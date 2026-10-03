'use client';

import React from 'react';
import { ServiceDefinition } from '@/types';
import { getServiceMetadata } from '@/lib/catalog';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CreditValue } from '@/components/ui/credit-value';
import { Sparkles } from 'lucide-react';

interface ServiceHoverCardProps {
  service: ServiceDefinition;
  children: React.ReactNode;
}

export function ServiceHoverCard({
  service,
  children,
}: ServiceHoverCardProps) {
  const meta = getServiceMetadata(service);

  return (
    <HoverCard>
      <HoverCardTrigger render={children as React.ReactElement} />
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 p-3.5 space-y-2.5 shadow-xl border-border/80 bg-card/98 backdrop-blur-md rounded-xl select-none"
      >
        {/* Title & Category */}
        <div className="flex items-center justify-between gap-2">
          <b className="text-sm font-bold text-foreground leading-tight truncate">
            {service.name}
          </b>
          <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 py-0 shrink-0">
            {service.category}
          </Badge>
        </div>

        {/* 1-Line Best For */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[11px] leading-tight truncate">
            <span className="font-semibold text-foreground">Best for: </span>
            {meta.bestFor}
          </span>
        </div>

        {/* Key Includes (Max 3) */}
        <div className="space-y-1 pt-1.5 border-t border-border/60 text-[11px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">
            Key Includes
          </span>
          <ul className="space-y-0.5 text-foreground/90 pl-3 list-disc marker:text-amber-500">
            {meta.deliverables.slice(0, 3).map((item, idx) => (
              <li key={idx} className="truncate">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Starting From Rate */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-xs">
          <span className="text-[11px] text-muted-foreground font-medium">Starting from</span>
          {service.quoteOnly ? (
            <span className="text-xs font-bold text-amber-700">Custom Quote</span>
          ) : (
            <CreditValue value={service.prices[0]} size="sm" />
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

