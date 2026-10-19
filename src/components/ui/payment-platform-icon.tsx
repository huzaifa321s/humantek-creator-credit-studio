import * as React from 'react';
import { Landmark, Wallet, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PAYMENT_PLATFORM_LABELS,
  type PaymentPlatform,
} from '@/lib/payment-platform';

export type PaymentIconSize = 'xs' | 'sm' | 'md' | 'lg';

const CONTAINER_SIZES: Record<PaymentIconSize, string> = {
  xs: 'size-4 rounded-[5px]',
  sm: 'size-5 rounded-md',
  md: 'size-6 rounded-lg',
  lg: 'size-9 rounded-xl',
};

const GLYPH_SIZES: Record<PaymentIconSize, string> = {
  xs: 'size-2.5',
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-5',
};

/** Official PayPal monogram SVG mark */
export function PayPalBrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.645h6.72c2.226 0 3.916.463 4.92 1.377.96.874 1.32 2.138 1.07 3.758-.03.196-.067.396-.11.6-.472 2.27-1.693 3.816-3.63 4.597-.926.373-2.054.562-3.353.562H9.07a.77.77 0 0 0-.758.646l-.96 6.087a.64.64 0 0 1-.633.54h-.643v.095Zm12.416-13.09c-.025.158-.056.32-.093.486-.562 2.548-2.185 3.99-4.824 4.287a12.56 12.56 0 0 1-1.396.073H10.56l-.86 5.453-.265 1.682a.54.54 0 0 0 .533.624h3.22a.675.675 0 0 0 .666-.567l.027-.142.528-3.347.034-.184a.675.675 0 0 1 .666-.567h.42c2.714 0 4.839-1.103 5.46-4.294.26-1.335.125-2.448-.563-3.23-.232-.264-.53-.484-.894-.664Z" />
    </svg>
  );
}

/** Official Cash App "$" monogram SVG mark */
export function CashAppBrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export interface PaymentPlatformIconProps {
  platform: PaymentPlatform | 'credits';
  size?: PaymentIconSize;
  className?: string;
}

/**
 * Reusable Payment Platform Icon tile with brand-authentic colors and dark/light mode support.
 * Used across Billing tables, Admin Console selects, Summary cards, and Checkout modals.
 */
export function PaymentPlatformIcon({
  platform,
  size = 'sm',
  className,
}: PaymentPlatformIconProps) {
  const normalized: PaymentPlatform =
    platform === 'credits' ? 'wallet' : platform;

  const containerSize = CONTAINER_SIZES[size];
  const glyphSize = GLYPH_SIZES[size];

  if (normalized === 'paypal') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 bg-[#0070ba]/15 text-[#0070ba] dark:bg-[#0070ba]/25 dark:text-[#38bdf8] ring-1 ring-[#0070ba]/25',
          containerSize,
          className
        )}
        aria-hidden="true"
      >
        <PayPalBrandMark className={glyphSize} />
      </span>
    );
  }

  if (normalized === 'cashapp') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 bg-[#00d64f] text-white shadow-2xs ring-1 ring-[#00b843]/40',
          containerSize,
          className
        )}
        aria-hidden="true"
      >
        <CashAppBrandMark className={glyphSize} />
      </span>
    );
  }

  if (normalized === 'bank_transfer') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 ring-1 ring-sky-500/25',
          containerSize,
          className
        )}
        aria-hidden="true"
      >
        <Landmark className={glyphSize} />
      </span>
    );
  }

  if (normalized === 'wallet') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 bg-amber-400/15 text-brand-text dark:bg-amber-400/20 dark:text-amber-300 ring-1 ring-amber-400/30',
          containerSize,
          className
        )}
        aria-hidden="true"
      >
        <Wallet className={glyphSize} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 bg-muted text-muted-foreground ring-1 ring-border/80',
        containerSize,
        className
      )}
      aria-hidden="true"
    >
      <Clock className={glyphSize} />
    </span>
  );
}

export interface PaymentPlatformLabelProps {
  platform: PaymentPlatform | 'credits';
  size?: PaymentIconSize;
  className?: string;
  labelClassName?: string;
  customLabel?: string;
}

/**
 * Reusable inline Payment Platform icon + label pair for tables, mobile cards, and dropdowns.
 */
export function PaymentPlatformLabel({
  platform,
  size = 'sm',
  className,
  labelClassName,
  customLabel,
}: PaymentPlatformLabelProps) {
  const normalized: PaymentPlatform =
    platform === 'credits' ? 'wallet' : platform;
  const label = customLabel ?? PAYMENT_PLATFORM_LABELS[normalized] ?? 'Bank Transfer';

  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      <PaymentPlatformIcon platform={normalized} size={size} />
      <span className={cn('font-semibold text-foreground truncate', labelClassName)}>
        {label}
      </span>
    </span>
  );
}
