import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon element to display above the heading */
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  /** Optional action slot — typically a Button */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Generic empty-state placeholder.
 * Used when a list or table has no data to show.
 */
export function EmptyState({ icon, heading, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
      role="status"
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{heading}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
