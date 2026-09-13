import * as React from 'react';
import { cn } from '../../lib/utils';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  if (!items?.length) return null;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn('flex items-center text-sm text-muted-foreground mb-4', className)}
      {...props}
    >
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.label} className="flex items-center">
              {item.href && !isLast ? (
                <Link 
                  to={item.href} 
                  className="hover:text-primary transition-colors focus:outline-none focus:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-primary font-medium' : ''} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              
              {!isLast && (
                <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
