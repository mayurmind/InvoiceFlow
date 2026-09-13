import * as React from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { Button } from '../ui/button';

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  onMenuClick: () => void;
}

export function Header({ onMenuClick, className, ...props }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header 
      className={cn(
        'flex items-center justify-between h-16 px-4 bg-white border-b border-border lg:px-8',
        className
      )}
      {...props}
    >
      <div className="flex items-center lg:hidden">
        <button 
          onClick={onMenuClick}
          className="p-2 text-muted-foreground hover:bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      
      {/* Spacer for desktop alignment */}
      <div className="hidden lg:block flex-1" />

      <div className="flex items-center space-x-4">
        <button 
          className="p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        
        {user && (
          <div className="flex items-center space-x-3 p-1.5 rounded-lg transition-colors">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
            </div>
            <div className="hidden md:block text-sm">
              <p className="font-medium text-primary leading-none">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-muted-foreground text-xs mt-1 capitalize">{user.role}</p>
            </div>
          </div>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
