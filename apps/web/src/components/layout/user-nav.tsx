'use client';

import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMockUser } from '@/contexts/user-role-context';
import { cn } from '@/lib/utils';

interface UserNavProps {
  className?: string;
  /** Whether to show the user's name and email. Defaults to true. */
  showDetails?: boolean;
}

/**
 * UserNav — Client component that displays the current user's avatar and info.
 * It reads from the MockUserContext (which will be replaced by real auth).
 */
export function UserNav({ className, showDetails = true }: UserNavProps) {
  const user = useMockUser();

  return (
    <div className={cn('flex items-center gap-3 shrink-0', className)}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
          {user.initials}
        </AvatarFallback>
      </Avatar>
      {showDetails && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      )}
    </div>
  );
}
