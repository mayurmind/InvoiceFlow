import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payments',
  description: 'Record and track payments against your invoices.',
};

/**
 * Payments placeholder — F1.4.
 * Payment recording is implemented in P7; UI is wired in P8.
 */
export default function PaymentsPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Payments"
          description="Record and track payments against your invoices."
        />
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          heading="No payments recorded"
          description="Payment recording and tracking will be available once the backend is connected."
        />
      </div>
    </PageContainer>
  );
}
