'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditValue } from '@/components/ui/credit-value';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';
import { FileText, ExternalLink, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';

export interface ProjectDrawerSpecsCardProps {
  style?: string;
  colors?: string;
}

export function ProjectDrawerSpecsCard({ style, colors }: ProjectDrawerSpecsCardProps) {
  const displayStyle = style || 'Custom Art';
  const displayColors = colors || 'Brand Colors';

  return (
    <Card className="bg-secondary/10 border-border/70 shadow-none min-w-0">
      <CardContent className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 p-3 sm:p-3.5 min-w-0">
        <div className="min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-0.5 truncate">
            Aesthetic Style
          </span>
          <b
            className="text-foreground font-semibold truncate block text-xs"
            title={displayStyle}
          >
            {displayStyle}
          </b>
        </div>
        <div className="min-w-0">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-0.5 truncate">
            Color Palette
          </span>
          <b
            className="text-foreground font-semibold truncate block text-xs"
            title={displayColors}
          >
            {displayColors}
          </b>
        </div>
      </CardContent>
    </Card>
  );
}

export interface ProjectDrawerBriefSectionProps {
  instructions?: string;
  title?: string;
  showSnapshotBadge?: boolean;
  redeemCode?: string;
}

export function ProjectDrawerBriefSection({
  instructions,
  title = 'Submitted Creative Brief',
  showSnapshotBadge = true,
  redeemCode,
}: ProjectDrawerBriefSectionProps) {
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5 min-w-0 truncate">
          <FileText className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        {showSnapshotBadge && (
          <Badge
            variant="outline"
            size="xs"
            className="font-mono text-2xs text-muted-foreground shrink-0"
          >
            Snapshot
          </Badge>
        )}
      </div>
      {/* Strict plain text rendering with preserved line breaks (immune to HTML/XSS injection) */}
      <div
        data-testid="brief-instructions"
        className="p-3 sm:p-3.5 rounded-xl bg-secondary/20 border border-border/80 text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans text-xs break-words overflow-hidden"
      >
        {instructions || 'No specific creative notes submitted.'}
      </div>
      {redeemCode && (
        <p className="text-2xs text-brand-text dark:text-amber-300 font-semibold pt-0.5 truncate">
          Promo code attached: <span className="font-mono tabular-nums">{redeemCode}</span>
        </p>
      )}
    </div>
  );
}

export interface ProjectDrawerLinksSectionProps {
  links?: string[];
}

export function ProjectDrawerLinksSection({ links }: ProjectDrawerLinksSectionProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className="space-y-2 min-w-0">
      <span className="text-xs font-bold text-foreground flex items-center gap-1.5 min-w-0 truncate">
        <ExternalLink className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
        <span className="truncate">Reference Links ({links.length})</span>
      </span>
      <ItemGroup className="gap-1.5 min-w-0">
        {links.map((link, idx) => {
          let domain = 'link';
          try {
            domain = new URL(link).hostname.replace(/^www\./, '');
          } catch {}
          return (
            <Item
              key={idx}
              variant="outline"
              size="xs"
              render={
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="w-full min-w-0 overflow-hidden bg-card hover:bg-muted/40 transition-colors group cursor-pointer"
            >
              <ItemMedia
                variant="icon"
                className="size-7 rounded-md bg-amber-400/10 border-amber-400/20 text-brand-text dark:text-amber-400 shrink-0"
              >
                <ExternalLink className="size-3.5" />
              </ItemMedia>
              <ItemContent className="min-w-0 flex-1 overflow-hidden">
                <ItemTitle className="font-mono text-2xs text-brand-text dark:text-amber-400 font-semibold truncate w-full block">
                  {domain}
                </ItemTitle>
                <ItemDescription className="text-muted-foreground text-xs truncate group-hover:text-foreground w-full block">
                  {link}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="shrink-0">
                <ExternalLink className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}

export interface ProjectServiceItem {
  name: string;
  quantity: number;
  credits: number;
}

export interface ProjectDrawerServicesSectionProps {
  selections?: ProjectServiceItem[];
  usedCredits?: number;
  emptyMessage?: string;
}

export function ProjectDrawerServicesSection({
  selections = [],
  usedCredits = 0,
  emptyMessage = 'Custom package services will be finalized during studio review.',
}: ProjectDrawerServicesSectionProps) {
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5 min-w-0 truncate">
          <Sparkles className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
          <span className="truncate">Selected Services ({selections.length})</span>
        </span>
        {usedCredits > 0 && (
          <CreditValue value={usedCredits} size="xs" variant="pill" className="shrink-0" />
        )}
      </div>
      {selections.length > 0 ? (
        <ItemGroup className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs gap-0 min-w-0">
          {selections.map((sel, idx) => (
            <Item
              key={idx}
              size="xs"
              className="rounded-none border-0 px-3 sm:px-3.5 py-2.5 min-w-0"
            >
              <ItemContent className="min-w-0 flex-1">
                <ItemTitle className="font-semibold text-foreground text-xs truncate block w-full">
                  {sel.name}
                  <span className="text-muted-foreground font-mono text-2xs font-normal ml-1">
                    ({sel.quantity}x)
                  </span>
                </ItemTitle>
              </ItemContent>
              <ItemActions className="shrink-0">
                <CreditValue value={sel.credits} size="xs" variant="pill" />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
      )}
    </div>
  );
}

export function ProjectDrawerSkeleton({ showStatusCard = false }: { showStatusCard?: boolean }) {
  return (
    <div className="space-y-4 sm:space-y-5" data-testid="project-drawer-skeleton">
      {showStatusCard && (
        <div className="rounded-xl border border-border/80 p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      )}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 p-3.5 rounded-xl bg-secondary/10 border border-border/70">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ProjectDrawerNotFound({
  onClose,
  onRetry,
}: {
  onClose: () => void;
  onRetry?: () => void;
}) {
  return (
    <Empty className="rounded-xl border border-dashed border-border bg-card/50 p-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle className="size-6 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base font-bold text-foreground">Project not found</EmptyTitle>
        <EmptyDescription className="text-xs text-muted-foreground">
          This project does not exist or you do not have permission to view it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Retry</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold cursor-pointer"
          >
            Back to Projects
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

