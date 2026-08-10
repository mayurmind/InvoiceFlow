/**
 * Shared UI prop types for the InvoiceFlow design system.
 * Import these instead of re-declaring the same types across components.
 */

/** Standard component size variants */
export type SizeVariant = 'sm' | 'default' | 'lg';

/** Standard component visual style variants (mirrors shadcn/ui conventions) */
export type StyleVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

/** Status badge variants for domain objects (invoices, etc.) */
export type StatusVariant =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

/** Generic children prop */
export interface WithChildren {
  children: React.ReactNode;
}

/** Generic className prop */
export interface WithClassName {
  className?: string;
}
