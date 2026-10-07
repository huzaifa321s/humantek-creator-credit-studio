import React from 'react';
import { cn } from '@/lib/utils';

interface StudioBackgroundProps {
  className?: string;
  variant?: 'default' | 'subtle' | 'spotlight';
  showDots?: boolean;
}

/**
 * StudioBackground
 * 
 * An ultra-lightweight, zero-dependency studio ambient background component.
 * Features:
 *  1. Top-center warm amber studio spotlight (harmonizes with gold/amber branding)
 *  2. Subtle bottom-right warmth to anchor cards and review summaries
 *  3. Precision micro-dot grid texture with a radial vignette mask for optimal text contrast
 *  4. 100% free, pure CSS, zero battery drain, zero performance overhead
 */
export function StudioBackground({
  className,
  variant = 'default',
  showDots = true,
}: StudioBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden select-none',
        className
      )}
    >
      {/* 1. Primary Top Studio Spotlight (Amber/Gold aura) */}
      <div
        className={cn(
          'absolute -top-[100px] left-1/2 -translate-x-1/2 w-[1100px] max-w-[100vw] h-[550px] rounded-full blur-3xl transition-opacity duration-500',
          variant === 'subtle'
            ? 'opacity-25 dark:opacity-20'
            : 'opacity-45 dark:opacity-30'
        )}
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.15) 50%, transparent 75%)',
        }}
      />

      {/* 2. Secondary Ambient Warm Glow (Bottom Right corner) */}
      <div
        className="absolute -bottom-[180px] -right-[120px] w-[600px] h-[600px] rounded-full blur-3xl opacity-25 dark:opacity-20"
        style={{
          background:
            'radial-gradient(circle at center, rgba(245, 158, 11, 0.25) 0%, transparent 65%)',
        }}
      />

      {/* 3. Precision Micro Dot Grid with Radial Vignette Fade (Optional) */}
      {showDots && (
        <div
          className="absolute inset-0 text-foreground opacity-[0.055] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse 90% 75% at 50% 25%, black 35%, transparent 85%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 75% at 50% 25%, black 35%, transparent 85%)',
          }}
        />
      )}

      {/* 4. Fine Linear Horizon Top Glow Line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-30 dark:opacity-20"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.6) 50%, transparent 100%)',
        }}
      />
    </div>
  );
}
