import * as React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'info';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-secondary text-secondary-foreground border-border',
      destructive: 'bg-destructive/10 text-destructive border-destructive/20',
      success: 'bg-green-100 text-green-800 border-green-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    const icons = {
      default: <Info className="h-5 w-5" />,
      destructive: <XCircle className="h-5 w-5" />,
      success: <CheckCircle2 className="h-5 w-5" />,
      info: <Info className="h-5 w-5" />,
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border p-4 flex items-start space-x-3',
          variants[variant],
          className
        )}
        {...props}
      >
        <div className="shrink-0 mt-0.5">{icons[variant]}</div>
        <div className="flex-1 text-sm">{children}</div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';
