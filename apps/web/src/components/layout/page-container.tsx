import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  /** Whether to constrain the content to a max width. Defaults to true. */
  constrained?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Top-level page wrapper.
 * Provides consistent horizontal padding and an optional max-width constraint.
 * Always a Server Component — contains no client interactivity.
 */
export function PageContainer({ constrained = true, className, children }: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-6 sm:px-6 lg:px-8',
        constrained && 'mx-auto max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
