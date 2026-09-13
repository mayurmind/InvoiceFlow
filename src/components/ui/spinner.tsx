import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
}

export function Spinner({ className, size = 'default', ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)} {...props}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
