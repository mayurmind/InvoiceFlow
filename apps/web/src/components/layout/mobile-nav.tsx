'use client';

import * as React from 'react';
import { Menu, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { UserNav } from '@/components/layout/user-nav';

/**
 * MobileNav — Client component that wraps the Sheet dialog.
 *
 * Accessible off-canvas navigation panel.
 */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="md:hidden shrink-0"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent id="mobile-nav-sheet" side="left" className="w-72 p-0 flex flex-col">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">
          Primary application navigation links.
        </SheetDescription>

        {/* Sheet brand header */}
        <div className="flex h-14 items-center gap-2.5 px-4 shrink-0 border-b border-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <span className="font-bold tracking-tight">InvoiceFlow</span>
        </div>

        {/* Nav links — onNavClick closes the drawer */}
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavClick={() => setOpen(false)} />
        </div>

        <Separator />

        {/* User footer inside sheet */}
        <UserNav className="px-4 py-4" />
      </SheetContent>
    </Sheet>
  );
}
