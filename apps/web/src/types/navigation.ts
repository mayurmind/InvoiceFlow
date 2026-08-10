import type { LucideIcon } from 'lucide-react';

/**
 * Frozen role names from the InvoiceFlow database schema (P0.6-R1).
 * These exact string values match the UserRole enum in apps/api.
 */
export type UserRole = 'SUPER_ADMIN' | 'STAFF' | 'VIEWER';

/**
 * A single navigation item in the application shell.
 */
export interface NavItem {
  /** Display label shown in the sidebar and mobile drawer. */
  label: string;
  /** Absolute pathname, e.g. "/dashboard". */
  href: string;
  /** Icon from lucide-react. */
  icon: LucideIcon;
  /**
   * Roles that can see this item.
   * An empty array means the item is visible to ALL roles.
   */
  roles: UserRole[];
}
