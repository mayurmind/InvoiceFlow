import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Invoices',
  description: 'Create, manage, and send invoices to your clients.',
};

/**
 * Invoices placeholder — F1.4.
 * Invoice engine is implemented in P5/P6; UI is wired in P8.
 */
export default function InvoicesPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Invoices"
          description="Create, manage, and send invoices to your clients."
        />
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          heading="No invoices yet"
          description="Invoice creation and management will be available once the backend is connected."
        />
      </div>
    </PageContainer>
  );
}
