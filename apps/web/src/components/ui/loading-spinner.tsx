import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Tailwind size class, e.g. "h-5 w-5". Defaults to h-6 w-6. */
  size?: string;
  className?: string;
  /** Screen-reader label */
  label?: string;
}

/**
 * Accessible loading spinner using an SVG animation.
 * Uses the design-system ring color so it inherits theme changes.
 */
export function LoadingSpinner({
  size = 'h-6 w-6',
  className,
  label = 'Loading…',
}: LoadingSpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <svg
        className={cn('animate-spin text-primary', size)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </span>
  );
}
