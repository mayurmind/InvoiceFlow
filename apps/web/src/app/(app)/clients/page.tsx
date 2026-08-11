import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { ClientTable } from '@/components/clients/client-table';
import { ClientDialog } from '@/components/clients/client-dialog';
import { Client } from '@/types/domain';

export const metadata: Metadata = {
  title: 'Clients',
  description: 'Manage your client list and billing information.',
};

const mockClients: Client[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    email: 'billing@acmecorp.com',
    status: 'active',
    createdAt: '2023-10-15',
  },
  {
    id: '2',
    name: 'Globex Inc',
    email: 'accounts@globex.com',
    status: 'active',
    createdAt: '2023-11-02',
  },
  {
    id: '3',
    name: 'Initech',
    email: 'finance@initech.com',
    status: 'inactive',
    createdAt: '2024-01-20',
  },
];

/**
 * Clients view — F1.6.
 * Renders a data table for managing clients, using the advanced F1.5 UI components.
 */
export default function ClientsPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Clients"
          description="Manage your client list and billing information."
          action={<ClientDialog />}
        />

        <ClientTable clients={mockClients} />
      </div>
    </PageContainer>
  );
}
