'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ServiceDefinition } from '@/types';
import { TIER_NAMES, DEFAULT_SCOPE_DETAILS, getServiceMetadata } from '@/lib/catalog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditValue } from '@/components/ui/credit-value';
import {
  Sparkles,
  CheckCircle2,
  Plus,
  Check,
  Palette,
  Video,
  Monitor,
  Box,
  Layers,
  Sparkle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceQuickPreviewModalProps {
  service: ServiceDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  isSelected?: boolean;
  currentLevel?: 0 | 1 | 2;
  onSelectService?: (serviceId: string, level: 0 | 1 | 2) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Branding: Palette,
  Stream: Monitor,
  Animation: Sparkles,
  VTuber: Sparkle,
  Artwork: Palette,
  Content: Video,
  '3D': Box,
  Custom: Layers,
};

interface ServiceQuickPreviewContentProps {
  service: ServiceDefinition;
  onClose: () => void;
  isSelected: boolean;
  currentLevel: 0 | 1 | 2;
  onSelectService?: (serviceId: string, level: 0 | 1 | 2) => void;
}

function ServiceQuickPreviewContent({
  service,
  onClose,
  isSelected,
  currentLevel,
  onSelectService,
}: ServiceQuickPreviewContentProps) {
  const [selectedLevel, setSelectedLevel] = useState<0 | 1 | 2>(currentLevel);

  const meta = getServiceMetadata(service);
  const Icon = CATEGORY_ICONS[service.category] || Layers;

  const currentPrice = service.quoteOnly ? 0 : service.prices[selectedLevel];
  const selectedTierName = TIER_NAMES[selectedLevel];
  const isAlreadyAtThisLevel = isSelected && currentLevel === selectedLevel;

  const handleConfirmScope = () => {
    if (onSelectService) {
      onSelectService(service.id, selectedLevel);
    }
    onClose();
  };

  return (
    <>
      {/* Fixed Header */}
      <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b border-border/70 shrink-0 text-left space-y-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <DialogTitle className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                  {service.name}
                </DialogTitle>
                <Badge variant="gold" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                  {service.category}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {service.description}
              </DialogDescription>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Starting Rate
            </span>
            {service.quoteOnly ? (
              <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                Custom Quote
              </span>
            ) : (
              <CreditValue value={service.prices[0]} size="sm" />
            )}
          </div>
        </div>
      </DialogHeader>

      {/* Scrollable Content Body */}
      <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4 flex-1">
        {/* Real Visual Showcase or Graphic Frame (Simplified, un-cluttered) */}
        {meta.previewImage ? (
          <div className="relative w-full h-38 sm:h-44 rounded-xl overflow-hidden border border-border/80 group shadow-xs bg-secondary/30">
            <Image
              src={meta.previewImage}
              alt={`${service.name} preview`}
              fill
              className="object-cover object-center group-hover:scale-102 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 600px"
              priority
            />
            {/* Soft gradient scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-black/30" />

            {/* Single clean badge in top corner */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/90 text-white backdrop-blur-md shadow-xs">
                Commercial License Included
              </span>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-border/80 bg-gradient-to-br from-amber-500/10 via-secondary/50 to-card flex items-center justify-between p-4 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs">
                <Icon className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {service.name} Deliverable Spec
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Production-ready asset kit
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              Commercial License Included
            </span>
          </div>
        )}

        {/* Best For Highlight */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs leading-normal">
            <span className="font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mr-1.5">
              Best For:
            </span>
            <span className="text-foreground font-medium">{meta.bestFor}</span>
          </div>
        </div>

        {/* What's Included Deliverables Checklist */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What&apos;s Included
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {meta.deliverables.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/35 border border-border/60 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-foreground font-medium line-clamp-1">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scope Tiers Comparison (Clean, lighter cards without redundant footnote) */}
        {!service.quoteOnly && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Scope Tiers (Click to Choose)
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Selected: <strong className="text-foreground">{selectedTierName}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[0, 1, 2].map((lvl) => {
                const tierName = TIER_NAMES[lvl as 0 | 1 | 2];
                const price = service.prices[lvl];
                const scope = service.scopeDetails?.[lvl] || DEFAULT_SCOPE_DETAILS[lvl];
                const isActive = selectedLevel === lvl;

                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl as 0 | 1 | 2)}
                    className={cn(
                      'p-3 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer min-h-[76px]',
                      isActive
                        ? 'border-2 border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
                        : 'border-border/80 bg-card hover:border-amber-400/50 hover:bg-secondary/30'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 w-full mb-1">
                      <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                        {tierName}
                        {isActive && (
                          <CheckCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        )}
                      </span>
                      <Badge
                        variant={isActive ? 'gold' : 'outline'}
                        className="text-[10px] font-mono font-bold px-1.5 py-0"
                      >
                        {price} CR
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {scope}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Area (Always visible, clean buttons) */}
      <div className="px-5 sm:px-6 py-3.5 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
        {/* Status Line */}
        <div className="text-xs sm:text-sm font-medium text-foreground">
          {service.quoteOnly ? (
            <span>Custom Scope Tier · Custom Quote</span>
          ) : (
            <span>
              <strong className="text-amber-700 dark:text-amber-400 font-bold">
                {selectedTierName} Tier
              </strong>{' '}
              selected ·{' '}
              <span className="font-bold text-foreground">{currentPrice} CR</span>
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-medium rounded-xl h-9 cursor-pointer px-4"
          >
            Cancel
          </Button>

          {service.quoteOnly ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmScope}
              className="gap-1.5 text-xs font-bold rounded-xl h-9 shadow-xs cursor-pointer px-5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSelected ? 'Keep in Scope' : 'Add to Scope'}</span>
            </Button>
          ) : isAlreadyAtThisLevel ? (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Added to Scope</span>
            </div>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmScope}
              className="gap-1.5 text-xs font-bold rounded-xl h-9 shadow-xs cursor-pointer px-5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSelected ? 'Update Scope' : 'Add to Scope'}</span>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function ServiceQuickPreviewModal({
  service,
  isOpen,
  onClose,
  isSelected = false,
  currentLevel = 0,
  onSelectService,
}: ServiceQuickPreviewModalProps) {
  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[95vw] max-h-[88vh] flex flex-col p-0 rounded-2xl overflow-hidden gap-0 border border-border/80 shadow-2xl">
        <ServiceQuickPreviewContent
          key={service.id}
          service={service}
          onClose={onClose}
          isSelected={isSelected}
          currentLevel={currentLevel}
          onSelectService={onSelectService}
        />
      </DialogContent>
    </Dialog>
  );
}
