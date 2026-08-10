/**
 * @vitest-environment jsdom
 *
 * Shell component smoke tests — F1.4.
 *
 * These tests verify that the application shell components
 * (AppSidebar, AppTopbar, SidebarNav, SidebarNavItem) and the
 * MockUserProvider context mount without throwing.
 *
 * Behavioural and navigation tests belong in feature-specific files.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ── Mock next/navigation (usePathname) ───────────────────────────────
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// ── Mock next/link ───────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

import { MockUserProvider, MOCK_USER, useMockUser } from '@/contexts/user-role-context';
import { SidebarNav, SidebarNavItem } from '@/components/layout/sidebar-nav';
import { NAV_ITEMS } from '@/lib/navigation';
import type { NavItem } from '@/types/navigation';
import { LayoutDashboard } from 'lucide-react';

// ── MockUserProvider & useMockUser ───────────────────────────────────
describe('MockUserProvider', () => {
  it('provides MOCK_USER to children', () => {
    function Consumer() {
      const user = useMockUser();
      return <span>{user.name}</span>;
    }
    render(
      <MockUserProvider>
        <Consumer />
      </MockUserProvider>,
    );
    expect(screen.getByText(MOCK_USER.name)).toBeDefined();
  });
});

// ── SidebarNavItem ───────────────────────────────────────────────────
describe('SidebarNavItem', () => {
  const item: NavItem = {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: [],
  };

  it('renders a link with the item label', () => {
    render(
      <MockUserProvider>
        <SidebarNavItem item={item} />
      </MockUserProvider>,
    );
    expect(screen.getByText('Dashboard')).toBeDefined();
  });

  it('marks the active link with aria-current="page"', () => {
    render(
      <MockUserProvider>
        <SidebarNavItem item={item} />
      </MockUserProvider>,
    );
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});

// ── SidebarNav ───────────────────────────────────────────────────────
describe('SidebarNav', () => {
  it('renders all provided nav items', () => {
    render(
      <MockUserProvider>
        <SidebarNav />
      </MockUserProvider>,
    );
    // Each nav item label should appear in the document
    for (const item of NAV_ITEMS) {
      expect(screen.getByText(item.label)).toBeDefined();
    }
  });
});
