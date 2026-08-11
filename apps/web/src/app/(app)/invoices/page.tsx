import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { Invoice } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Invoices',
  description: 'Create, manage, and send invoices to your clients.',
};

const mockInvoices: Invoice[] = [
  {
    id: '1',
    number: 'INV/24-25/0001',
    clientName: 'Acme Corporation',
    amount: 1250.0,
    status: 'paid',
    issueDate: '2023-11-01',
    dueDate: '2023-11-15',
  },
  {
    id: '2',
    number: 'INV/24-25/0002',
    clientName: 'Globex Inc',
    amount: 450.5,
    status: 'sent',
    issueDate: '2023-11-10',
    dueDate: '2023-11-24',
  },
  {
    id: '3',
    number: 'INV/24-25/0003',
    clientName: 'Initech',
    amount: 3200.0,
    status: 'overdue',
    issueDate: '2023-10-05',
    dueDate: '2023-10-19',
  },
  {
    id: '4',
    number: 'INV/24-25/0004',
    clientName: 'Acme Corporation',
    amount: 750.0,
    status: 'draft',
    issueDate: '2023-11-20',
    dueDate: '2023-12-04',
  },
];

/**
 * Invoices view — F1.6.
 * Renders a data table for managing invoices.
 */
export default function InvoicesPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          heading="Invoices"
          description="Create, manage, and send invoices to your clients."
          action={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          }
        />

        <InvoiceTable invoices={mockInvoices} />
      </div>
    </PageContainer>
  );
}
