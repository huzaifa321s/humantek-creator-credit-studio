import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Inline validation message linked to its input via aria-describedby. */
export function FieldError({
  id,
  message,
  className,
}: {
  id: string;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={`${id}-error`}
      role="alert"
      className={cn(
        'flex items-start gap-1 text-[11px] leading-snug font-medium text-destructive animate-in fade-in slide-in-from-top-0.5 duration-150',
        className
      )}
    >
      <CircleAlert className="size-3 mt-px shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
