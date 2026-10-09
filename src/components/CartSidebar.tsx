'use client';

import { PackageDefinition, SelectedServiceEntry } from '@/types';
import { TIER_NAMES, EXTRAS_AND_ADDITIONS, ADDITIONS_PRICING } from '@/lib/catalog';
import {
  ArrowUpRight,
  Trash2,
  Layers,
  Sparkles,
  Info,
  AlertTriangle,
  RefreshCw,
  Monitor,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CreditValue } from '@/components/ui/credit-value';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

const EXTRA_METADATA: Record<
  string,
  { icon: React.ElementType; tag: string }
> = {
  'Extra revision round': {
    icon: RefreshCw,
    tag: 'Revision',
  },
  'Additional size / platform': {
    icon: Monitor,
    tag: 'Format',
  },
  'Additional concept': {
    icon: Sparkles,
    tag: 'Creative',
  },
  'Rush delivery request': {
    icon: Zap,
    tag: 'Priority',
  },
};

interface CartSidebarProps {
  pack: PackageDefinition;
  entries: SelectedServiceEntry[];
  usedCredits: number;
  remainingCredits: number;
  standardUnits: number;
  eliteUnits: number;
  totalAvailableCredits?: number;
  appliedWalletCredits?: number;
  recommendedPack?: PackageDefinition;
  onUpgradePackage: (packageId: string) => void;
  onRemoveService: (serviceId: string) => void;
  isTierRestricted?: boolean;
  className?: string;
  additions?: string[];
  onToggleAddition?: (extra: string) => void;
  onClearAll?: () => void;
}

export function CartSidebar({
  pack,
  entries,
  usedCredits,
  remainingCredits,
  standardUnits,
  eliteUnits,
  totalAvailableCredits,
  appliedWalletCredits = 0,
  recommendedPack,
  onUpgradePackage,
  onRemoveService,
  isTierRestricted = false,
  className,
  additions = [],
  onToggleAddition,
  onClearAll,
}: CartSidebarProps) {
  const effectiveTotal = totalAvailableCredits !== undefined ? totalAvailableCredits : pack.credits;
  const percentage = effectiveTotal > 0 ? Math.min(100, Math.round((usedCredits / effectiveTotal) * 100)) : 0;
  const isWalletFunding = pack.id === 'studio-wallet' || pack.price === 0;
  const effectiveRate = pack.credits > 0 && pack.price > 0 ? (pack.price / pack.credits).toFixed(2) : '0.00';
  const isOverBudget = remainingCredits < 0;

  return (
    <Card className={cn('border-border bg-card shadow-xs flex flex-col h-full overflow-hidden rounded-xl', className)}>
      {/* Amber glowing header strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-500 shrink-0" />

      {/* FIXED HEADER: Wallet Info, Selected Summary & Unit Limits */}
      <div className="p-3.5 sm:p-4.5 pb-3 border-b border-border/60 bg-card shrink-0 space-y-3">
        {/* Row 1: Budget Classification Badge & Exchange Rate */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <Badge
            variant="gold"
            className="text-3xs sm:text-2xs font-bold tracking-wide uppercase px-2 py-0.5 rounded-md shrink-0 select-none shadow-2xs"
          >
            {isWalletFunding ? (
              'Studio Wallet'
            ) : appliedWalletCredits > 0 ? (
              <>
                <span className="hidden min-[380px]:inline">Combined Studio Budget</span>
                <span className="min-[380px]:hidden">Combined Budget</span>
              </>
            ) : (
              'Live Credit Wallet'
            )}
          </Badge>
          <div className="text-right shrink-0">
            {isWalletFunding ? (
              <span className="text-2xs sm:text-xs font-medium text-muted-foreground whitespace-nowrap">
                Prepaid Balance
              </span>
            ) : (
              <span className="inline-flex items-center font-mono tabular-nums text-2xs sm:text-xs font-semibold text-muted-foreground bg-secondary/80 dark:bg-secondary/60 px-2 py-0.5 rounded-md border border-border/60 whitespace-nowrap">
                ${effectiveRate} USD / CR
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Total Available Credits & Live Selection Status */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <CreditValue value={effectiveTotal} size="lg" className="tracking-tight" />
            <p
              className="text-2xs sm:text-xs text-muted-foreground mt-0.5 font-medium leading-snug line-clamp-2"
              title={
                appliedWalletCredits > 0
                  ? `${pack.name} (${pack.credits} CR) + Wallet (${appliedWalletCredits} CR)`
                  : undefined
              }
            >
              {appliedWalletCredits > 0
                ? `${pack.name} (${pack.credits} CR) + Wallet (${appliedWalletCredits} CR)`
                : isWalletFunding
                ? 'Account Balance ($0 USD Due)'
                : `${pack.name} · $${pack.price.toLocaleString('en-US')} Package`}
            </p>
          </div>

          <div className="text-right shrink-0 flex flex-col items-end justify-start pt-0.5">
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              <span className="text-xs font-bold text-foreground">
                Selected <span className="font-mono text-brand-text dark:text-amber-400">({entries.length})</span>
              </span>
              {entries.length > 0 && onClearAll && (
                <>
                  <span className="text-muted-foreground/30 text-3xs select-none">·</span>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-2xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2 transition-colors cursor-pointer whitespace-nowrap font-medium"
                    title="Clear all selected services"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
            <span className="text-2xs sm:text-xs font-semibold text-brand-text dark:text-amber-400 block mt-1 font-mono tabular-nums whitespace-nowrap">
              {usedCredits.toLocaleString('en-US')} CR used
            </span>
          </div>
        </div>

        {/* Row 3: Tier Limit Gauges with Tooltips */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="p-2 sm:p-2.5 rounded-xl bg-secondary/80 border border-border/70 hover:border-amber-400/80 transition-colors cursor-help" />
              }
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold min-w-0 gap-1">
                <span className="truncate">Standard Units</span>
                <Info className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
              </div>
              <b className="text-foreground text-sm sm:text-base mt-0.5 block tabular-nums">
                {standardUnits}
                {pack.standardLimit !== undefined ? ` / ${pack.standardLimit}` : ''}
              </b>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs p-3">
              <span className="text-zinc-200">
                {pack.standardLimit !== undefined
                  ? `${pack.name} allows up to ${pack.standardLimit} Standard level service units.`
                  : 'Unlimited Standard level service units supported on this plan.'}
              </span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <div className="p-2 sm:p-2.5 rounded-xl bg-secondary/80 border border-border/70 hover:border-amber-400/80 transition-colors cursor-help" />
              }
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold min-w-0 gap-1">
                <span className="truncate">Elite Units</span>
                <Info className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
              </div>
              <b className="text-foreground text-sm sm:text-base mt-0.5 block tabular-nums">
                {eliteUnits}
                {pack.eliteLimit !== undefined ? ` / ${pack.eliteLimit}` : ''}
              </b>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs p-3">
              <span className="text-zinc-200">
                {pack.eliteLimit !== undefined
                  ? `${pack.name} allows up to ${pack.eliteLimit} Elite complex service units.`
                  : 'Unlimited Elite level complex units supported on this plan.'}
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* SCROLLABLE MIDDLE AREA: Services list + Extras */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pb-8 sm:pb-10 space-y-4 pr-3.5">
        {/* Selected Services List */}
        <div className="space-y-2">
          {entries.length ? (
            entries.map(({ service, choice, credits }) => (
              <div
                key={service.id}
                className="p-3 rounded-xl bg-secondary/40 border border-border/80 flex items-center justify-between gap-3 text-xs group hover:border-amber-400/60 hover:bg-secondary/60 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <b className="font-semibold text-xs sm:text-sm text-foreground truncate block">
                    {service.name}
                  </b>
                  <span className="text-xs text-muted-foreground">
                    {service.quoteOnly
                      ? 'Custom Scope'
                      : `${TIER_NAMES[choice.level]} × ${choice.quantity}`}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  {service.quoteOnly ? (
                    <span className="font-bold text-amber-700 text-sm">TBC</span>
                  ) : (
                    <CreditValue value={credits} size="sm" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemoveService(service.id)}
                    className="size-5 ml-auto mt-0.5 flex text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                    aria-label={`Remove ${service.name}`}
                    title="Remove service"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <Empty className="p-5 gap-2 rounded-xl border border-dashed border-border bg-secondary/20">
              <EmptyHeader className="gap-1.5">
                <EmptyMedia variant="icon" className="mb-0 size-9 rounded-lg">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-xs font-bold text-foreground">
                  No Services Selected
                </EmptyTitle>
                <EmptyDescription className="text-2xs text-muted-foreground leading-normal">
                  Pick creative assets from the catalog to build your project scope.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="pt-0.5">
                <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-text dark:text-amber-400 bg-amber-400/15 px-2.5 py-1 rounded-lg border border-amber-400/25">
                  <Sparkles className="w-3 h-3 text-brand-text dark:text-amber-400" />
                  Click &ldquo;Add to Scope&rdquo; on any service
                </span>
              </EmptyContent>
            </Empty>
          )}
        </div>

        {/* Project Additions & Delivery Enhancements */}
        {onToggleAddition && (
          <div className="space-y-2.5 pt-3 border-t border-border/80">
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Project Additions & Extras
                </h4>
              </div>
              {additions && additions.length > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold tabular-nums bg-amber-400 text-zinc-950 shadow-xs border border-amber-400">
                  {additions.length} selected
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  Optional
                </span>
              )}
            </div>

            <div className="space-y-2">
              {EXTRAS_AND_ADDITIONS.map((extra) => {
                const isChecked = additions?.includes(extra) ?? false;
                const id = `cart-addition-${extra.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
                const meta = EXTRA_METADATA[extra];
                const Icon = meta?.icon || Sparkles;
                const cost = ADDITIONS_PRICING[extra] ?? 0;

                return (
                  <div
                    key={extra}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => onToggleAddition(extra)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        onToggleAddition(extra);
                      }
                    }}
                    className={cn(
                      'group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border text-xs cursor-pointer select-none transition-all duration-200 outline-none shadow-2xs',
                      'focus-visible:ring-2 focus-visible:ring-amber-400/50',
                      isChecked
                        ? 'border-2 border-amber-400 bg-amber-400/[0.06] dark:bg-amber-950/20 text-foreground font-semibold ring-2 ring-amber-400/25 shadow-xs'
                        : 'border-border/80 bg-secondary/30 hover:border-amber-400/50 hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Checkbox
                        id={id}
                        checked={isChecked}
                        className={cn(
                          'pointer-events-none shrink-0 size-4.5 rounded-md',
                          isChecked && 'data-checked:bg-amber-400 data-checked:border-amber-400 data-checked:text-zinc-950'
                        )}
                      />
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-colors',
                          isChecked
                            ? 'text-brand-text dark:text-amber-400'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span className="text-xs font-bold leading-tight text-foreground truncate">
                        {extra}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <span
                        className={cn(
                          'text-xs font-mono font-black px-2 py-0.5 rounded-md border transition-all tabular-nums',
                          isChecked
                            ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-xs shadow-amber-400/25'
                            : 'bg-secondary text-muted-foreground border-border/80 group-hover:text-foreground group-hover:border-amber-400/50'
                        )}
                      >
                        +{cost} CR
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FIXED FOOTER: Totals, Progress, Warnings & Upgrade Button */}
      <div className="p-4 sm:p-5 pt-3.5 border-t border-border/80 bg-card/95 backdrop-blur-xs shrink-0 space-y-2.5">
        {/* Totals & Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm text-muted-foreground items-center">
            <span>Allocated</span>
            <CreditValue value={usedCredits} size="sm" variant="subtle" />
          </div>

          <div className="flex justify-between text-sm sm:text-base font-bold items-center">
            <span className={isOverBudget ? 'text-rose-600 font-extrabold' : 'text-foreground'}>
              Remaining
            </span>
            <CreditValue
              value={remainingCredits}
              size="md"
              variant={isOverBudget ? 'delta' : 'default'}
            />
          </div>

          <Progress
            value={percentage}
            indicatorClassName={isOverBudget ? 'bg-rose-500' : undefined}
          />

          <p className="text-xs text-muted-foreground text-center">
            {isOverBudget
              ? <>Budget exceeded by <span className="font-mono tabular-nums font-semibold">{Math.abs(remainingCredits)} CR</span>.</>
              : <><span className="font-mono tabular-nums font-semibold">{percentage}%</span> of {appliedWalletCredits > 0 ? 'combined budget' : isWalletFunding ? 'wallet' : 'package'} credits allocated.</>}
          </p>
        </div>

        {/* Tier Limit Warning */}
        {isTierRestricted && (
          <Alert variant="destructive" className="rounded-xl p-2.5 animate-in fade-in">
            <AlertTriangle className="w-3.5 h-3.5" />
            <AlertTitle className="text-xs font-bold">Tier Unit Limit Reached</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground leading-normal">
              {pack.name} has reached maximum Standard or Elite units. Upgrade your package or adjust service tiers to continue.
            </AlertDescription>
          </Alert>
        )}

        {/* Dynamic Contextual Upgrade Callout */}
        {isOverBudget && (
          <Alert variant="warning" className="rounded-xl p-3 border-amber-400/35 bg-amber-400/[0.08] animate-in fade-in [&>svg]:text-brand-text dark:[&>svg]:text-amber-400">
            <Sparkles className="w-4 h-4" />
            <AlertTitle className="text-xs sm:text-sm font-bold text-foreground truncate">
              {recommendedPack ? `Upgrade to ${recommendedPack.name}` : 'Upgrade Required'}
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground leading-snug">
              <span className="block">
                {recommendedPack
                  ? `Includes ${recommendedPack.credits} CR for $${recommendedPack.price.toLocaleString('en-US')}`
                  : 'Contact us for a larger custom creator package.'}
              </span>
              {recommendedPack && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="mt-2 w-full text-xs gap-1.5 font-semibold h-8 sm:h-9 rounded-xl shadow-xs cursor-pointer"
                  onClick={() => onUpgradePackage(recommendedPack.id)}
                >
                  <span>Upgrade to {recommendedPack.name}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
}
