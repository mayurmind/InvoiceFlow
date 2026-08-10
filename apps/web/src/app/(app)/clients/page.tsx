import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Clients',
  description: 'Manage your client list and billing information.',
};

/**
 * Clients placeholder — F1.4.
 * Client CRUD APIs are implemented in P4; UI is wired in P8.
 */
export default function ClientsPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Clients"
          description="Manage your client list and billing information."
        />
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          heading="No clients yet"
          description="Client management will be available once the backend is connected."
        />
      </div>
    </PageContainer>
  );
}
