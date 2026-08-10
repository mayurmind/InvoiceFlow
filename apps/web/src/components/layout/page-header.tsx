import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  heading: string;
  description?: string;
  /** Optional slot for actions (e.g. a primary Button) placed on the right */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standardised page-level heading block.
 * Renders an h1 + optional description and action slot.
 * Always a Server Component.
 *
 * Usage:
 *   <PageHeader heading="Clients" description="Manage your client list." action={<Button>Add client</Button>} />
 */
export function PageHeader({ heading, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
