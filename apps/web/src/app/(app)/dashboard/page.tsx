import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of your invoices, payments, and business metrics.',
};

/**
 * Dashboard placeholder — F1.4.
 * Real dashboard metrics (outstanding amounts, invoice counts, etc.)
 * will be wired in P7/P8 once the backend endpoints exist.
 */
export default function DashboardPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Dashboard"
          description="Overview of your invoices, payments, and business metrics."
        />
        <EmptyState
          icon={<LayoutDashboard className="h-6 w-6" />}
          heading="Dashboard coming soon"
          description="Metrics and summaries will appear here once the backend is connected."
        />
      </div>
    </PageContainer>
  );
}
