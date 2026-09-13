import * as React from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  actions, 
  className,
  ...props 
}: PageHeaderProps) {
  return (
    <div 
      className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8', className)}
      {...props}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center space-x-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
