import * as React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  error?: Error;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred while loading this content.',
  error,
  onRetry,
  retryLabel = 'Try again',
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-white border border-border rounded-lg',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-medium text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        {description}
      </p>
      {error && import.meta.env.DEV && (
        <div className="mt-4 p-4 bg-secondary text-left text-xs rounded-md w-full max-w-lg overflow-auto">
          <code className="text-red-700">{error.toString()}</code>
        </div>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
