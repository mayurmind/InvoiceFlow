import * as React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { UserNav } from '@/components/layout/user-nav';

/**
 * AppSidebar — Server component for the persistent desktop navigation column.
 *
 * Visible only at md+ breakpoints (hidden on mobile).
 * Contains the InvoiceFlow brand mark, primary nav links,
 * and a compact user-identity footer.
 */
export function AppSidebar() {
  return (
    <aside
      aria-label="Application sidebar"
      className="hidden md:flex md:w-64 md:flex-col md:shrink-0 bg-sidebar border-r border-sidebar-border"
    >
      {/* ── Brand ──────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-2.5 px-6 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </div>
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-sidebar-foreground hover:text-sidebar-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-sm"
        >
          InvoiceFlow
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* ── Primary navigation ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>

      <Separator className="bg-sidebar-border" />

      {/* ── User identity footer ────────────────────────────────── */}
      <UserNav className="px-4 py-4" />
    </aside>
  );
}
