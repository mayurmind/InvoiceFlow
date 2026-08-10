'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation';
import { NAV_ITEMS, filterNavItems } from '@/lib/navigation';
import { useMockUser } from '@/contexts/user-role-context';

interface SidebarNavItemProps {
  item: NavItem;
  /** Called when a nav link is activated — used by mobile nav to close the drawer. */
  onNavClick?: () => void;
}

export function SidebarNavItem({ item, onNavClick }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

interface SidebarNavProps {
  onNavClick?: () => void;
}

export function SidebarNav({ onNavClick }: SidebarNavProps) {
  const user = useMockUser();
  const items = filterNavItems(NAV_ITEMS, user.role);

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
      {items.map((item) => (
        <SidebarNavItem key={item.href} item={item} onNavClick={onNavClick} />
      ))}
    </nav>
  );
}
