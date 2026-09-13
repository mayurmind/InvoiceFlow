import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, UserCog, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../features/auth/hooks/useAuth';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Settings', href: '/settings/business', icon: Settings },
  { name: 'Security', href: '/settings/security', icon: ShieldCheck },
];

export function Sidebar({ isOpen, onClose, className, ...props }: SidebarProps) {
  const { user } = useAuth();
  
  const items = [...navItems];
  if (user?.role === 'SUPER_ADMIN') {
    items.push({ name: 'Users', href: '/settings/users', icon: UserCog });
    items.push({ name: 'Audit Logs', href: '/settings/audit', icon: ShieldAlert });
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-border transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
        {...props}
      >
        <div className="flex items-center h-16 px-6 border-b border-border shrink-0">
          <span className="text-xl font-bold tracking-tight text-primary">InvoiceFlow</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors',
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-primary'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
