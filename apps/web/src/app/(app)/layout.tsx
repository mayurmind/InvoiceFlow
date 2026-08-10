import * as React from 'react';
import { MockUserProvider } from '@/contexts/user-role-context';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';

/**
 * Application Shell Layout — F1.4
 *
 * This layout wraps every route inside the (app) group:
 *   /dashboard, /clients, /invoices, /payments, /settings
 *
 * Structure:
 *   MockUserProvider  ← provides mock user until real auth lands in P8
 *     div.shell-root  ← full-viewport flex row
 *       AppSidebar    ← desktop-only persistent sidebar (md+)
 *       div.content   ← full-height scrollable column
 *         AppHeader   ← mobile-only top bar (< md)
 *         main        ← page content slot
 *
 * IMPORTANT:
 * - MockUserProvider is intentionally a Client Component boundary.
 * - AppSidebar and AppHeader are Server Components.
 * - The {children} slot stays a Server Component — pages are RSC by default.
 * - Real authentication replaces MockUserProvider in P8.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MockUserProvider>
      {/*
       * Shell root: full viewport height, horizontal flex.
       * AppSidebar sits on the left; the right column fills remaining space.
       */}
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop persistent sidebar */}
        <AppSidebar />

        {/* Right-hand scrollable column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar (hidden at md+) */}
          <AppHeader />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </MockUserProvider>
  );
}
