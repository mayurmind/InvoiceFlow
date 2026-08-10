import { LayoutDashboard, Users, FileText, CreditCard, Settings } from 'lucide-react';
import type { NavItem, UserRole } from '@/types/navigation';

/**
 * Centralized navigation configuration.
 * This is the single source of truth for sidebar and mobile navigation items.
 *
 * IMPORTANT: This is UI-only configuration.
 * Navigation visibility filtering (filterNavItems) is a convenience for the UI only.
 * It is NOT a security or authorization control.
 * Real authorization is enforced server-side and will be implemented in the
 * future authentication/authorization phase (P8).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: [], // Visible to all roles
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Users,
    roles: [], // Visible to all roles
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: FileText,
    roles: [], // Visible to all roles
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    roles: [], // Visible to all roles
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN'], // UI hint only — backend enforces access independently
  },
];

/**
 * Filter navigation items based on the user's role.
 *
 * Items with an empty `roles` array are visible to all roles.
 * Items with a non-empty `roles` array are visible only to users whose role is in the list.
 *
 * SECURITY NOTE: This function controls UI visibility only.
 * It does NOT provide authorization. Backend routes are independently protected.
 */
export function filterNavItems(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((item) => item.roles.length === 0 || item.roles.includes(role));
}
