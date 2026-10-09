import React from 'react';
import { cn } from '@/lib/utils';

export interface CreditValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  variant?: 'default' | 'pill' | 'delta' | 'subtle';
  showUsd?: boolean;
  usdRate?: number;
  prefix?: string;
  suffix?: string;
}

export function CreditValue({
  value,
  size = 'sm',
  variant = 'default',
  showUsd = false,
  usdRate = 2.5,
  prefix,
  suffix = 'CR',
  className,
  ...props
}: CreditValueProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
  const isPositiveDelta = typeof value === 'string' && value.startsWith('+');
  const isNegative = !isNaN(numericValue) && (numericValue < 0 || (typeof value === 'string' && value.startsWith('-')));
  
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString('en-US') 
    : value;

  const usdEquivalent = !isNaN(numericValue) ? (Math.abs(numericValue) * usdRate).toFixed(0) : null;

  // Size styling map
  const sizeStyles = {
    xs: {
      root: 'text-xs font-semibold',
      num: 'font-bold',
      unit: 'text-xs font-extrabold',
      usd: 'text-xs',
    },
    sm: {
      root: 'text-sm font-semibold',
      num: 'font-bold',
      unit: 'text-xs font-extrabold',
      usd: 'text-xs',
    },
    md: {
      root: 'text-base sm:text-lg font-bold',
      num: 'font-extrabold',
      unit: 'text-xs sm:text-sm font-black',
      usd: 'text-xs sm:text-sm',
    },
    lg: {
      root: 'text-2xl sm:text-3xl font-black',
      num: 'font-black tracking-tight',
      unit: 'text-base sm:text-lg font-bold',
      usd: 'text-sm',
    },
    hero: {
      root: 'text-4xl sm:text-5xl font-black',
      num: 'font-black tracking-tight',
      unit: 'text-2xl sm:text-3xl font-extrabold',
      usd: 'text-base',
    },
  }[size];

  // Variant styling map
  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-tight border shadow-2xs select-none whitespace-nowrap shrink-0',
          'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
          sizeStyles.root,
          className
        )}
        {...props}
      >
        <span className={cn('tabular-nums', sizeStyles.num)}>
          {prefix}{formattedValue}
        </span>
        <span className={cn('text-brand-text tracking-wide', sizeStyles.unit)}>
          {suffix}
        </span>
        {showUsd && usdEquivalent && (
          <span className={cn('text-amber-700/70 dark:text-amber-400/70 font-normal ml-0.5', sizeStyles.usd)}>
            (${usdEquivalent})
          </span>
        )}
      </span>
    );
  }

  if (variant === 'delta') {
    const isSuccess = isPositiveDelta || (!isNegative && numericValue > 0);
    return (
      <span
        className={cn(
          'inline-flex items-baseline gap-0.5 font-mono tabular-nums select-none',
          isSuccess
            ? 'text-emerald-700 dark:text-emerald-400 font-bold'
            : isNegative
            ? 'text-rose-700 dark:text-rose-400 font-bold'
            : 'text-foreground font-semibold',
          sizeStyles.root,
          className
        )}
        {...props}
      >
        <span className={sizeStyles.num}>
          {prefix}{formattedValue}
        </span>
        <span
          className={cn(
            'uppercase tracking-wide ml-0.5',
            isSuccess
              ? 'text-emerald-600 dark:text-emerald-500'
              : isNegative
              ? 'text-rose-600 dark:text-rose-500'
              : 'text-muted-foreground',
            sizeStyles.unit
          )}
        >
          {suffix}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 font-mono tabular-nums select-none',
        variant === 'subtle' ? 'text-muted-foreground' : 'text-foreground',
        sizeStyles.root,
        className
      )}
      {...props}
    >
      <span className={sizeStyles.num}>
        {prefix}{formattedValue}
      </span>
      <span
        className={cn(
          'uppercase tracking-wider ml-0.5',
          variant === 'subtle'
            ? 'text-muted-foreground/80'
            : 'text-brand-text font-bold',
          sizeStyles.unit
        )}
      >
        {suffix}
      </span>
      {showUsd && usdEquivalent && (
        <span className={cn('text-muted-foreground font-normal ml-1', sizeStyles.usd)}>
          (${usdEquivalent})
        </span>
      )}
    </span>
  );
}
