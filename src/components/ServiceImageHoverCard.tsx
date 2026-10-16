'use client';

import React from 'react';
import { ServiceDefinition } from '@/types';
import { DEFAULT_SCOPE_DETAILS, TIER_NAMES } from '@/lib/catalog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CreditValue } from '@/components/ui/credit-value';
import { Check } from 'lucide-react';

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
  const scopeList = service.scopeDetails ?? DEFAULT_SCOPE_DETAILS;

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
        className="w-[260px] overflow-hidden p-3 ring-0 border border-border/80 bg-card/95 backdrop-blur-md shadow-md rounded-xl select-none z-50 animate-in fade-in-0 zoom-in-95 duration-150 space-y-2"
      >
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
        <div className="space-y-1.5">
          {TIER_NAMES.map((tierName, idx) => (
            <div
              key={tierName}
              className="flex items-start gap-1.5 text-2xs text-muted-foreground leading-snug"
            >
              <Check className="size-3 text-emerald-500 shrink-0 stroke-[2.5] mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground/90">{tierName}:</strong> {scopeList[idx]}
              </span>
            </div>
          ))}
        </div>

        {/* Category Info Bar */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-2xs text-muted-foreground font-medium">
          <span>{service.category}</span>
          <span className="font-mono font-semibold text-foreground/85">
            {service.quoteOnly ? 'Custom quote' : `${service.prices[0]}–${service.prices[2]} CR`}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

