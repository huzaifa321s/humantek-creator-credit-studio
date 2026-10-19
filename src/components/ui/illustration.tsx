import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Small, optimized 3D illustrations (transparent WebP, 256px, <20KB each).
 * Used ONLY in empty states and the success screen. Decorative, so alt="".
 * Swap a file in /public/illustrations to restyle everywhere.
 */
export const ILLUSTRATIONS = {
  'empty-projects': '/illustrations/empty-projects.webp',
  'empty-wallet': '/illustrations/empty-wallet.webp',
  'empty-messages': '/illustrations/empty-messages.webp',
  'empty-notifications': '/illustrations/empty-notifications.webp',
  success: '/illustrations/success.webp',
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

interface IllustrationProps {
  name: IllustrationName;
  /** Rendered size in px (square). Default 96. */
  size?: number;
  /** Set true only for a single above-the-fold illustration. */
  priority?: boolean;
  className?: string;
}

export function Illustration({
  name,
  size = 96,
  priority = false,
  className,
}: IllustrationProps) {
  return (
    <Image
      src={ILLUSTRATIONS[name]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      className={cn('select-none object-contain pointer-events-none', className)}
    />
  );
}
