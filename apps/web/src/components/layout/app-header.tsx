import * as React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UserNav } from '@/components/layout/user-nav';

/**
 * AppHeader — Server component for the mobile top navigation bar.
 *
 * Visible only on small screens (hidden at md+).
 * Composes the MobileNav (client component trigger/drawer), brand mark,
 * and the UserNav in avatar-only mode.
 */
export function AppHeader() {
  return (
    <header
      aria-label="Mobile navigation bar"
      className="md:hidden flex h-14 items-center gap-3 border-b border-border bg-background px-4 shrink-0"
    >
      <MobileNav />

      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <span className="font-bold tracking-tight">InvoiceFlow</span>
      </Link>

      {/* User avatar only */}
      <UserNav showDetails={false} />
    </header>
  );
}
