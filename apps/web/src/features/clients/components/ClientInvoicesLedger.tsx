import * as React from 'react';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { apiClient } from '../../../lib/api/client';
import { InvoiceTable } from '../../invoices/components/InvoiceTable';
import type { InvoiceListResponse } from '../../invoices/types/invoice.types';
import type { ClientResponse } from '../types/client.types';
import { FileText } from 'lucide-react';

interface ClientInvoicesLedgerProps {
  clientId: string;
  client: ClientResponse;
}

export function ClientInvoicesLedger({ clientId, client }: ClientInvoicesLedgerProps) {
  const [data, setData] = React.useState<InvoiceListResponse | null>(null);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const limit = 10;

  React.useEffect(() => {
    let mounted = true;

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        params.set('clientId', clientId);
        params.set('page', page.toString());
        params.set('limit', limit.toString());

        const response = await apiClient.get<InvoiceListResponse>(`/invoices?${params.toString()}`);
        
        if (mounted) {
          setData(response);
        }
      } catch {
        if (mounted) {
          setError('Failed to load recent invoices for this client.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInvoices();

    return () => {
      mounted = false;
    };
  }, [clientId, page, refreshTrigger]);

  if (loading && !data) {
    return (
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4 md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Recent Invoices</h3>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4 md:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Recent Invoices</h3>
        <ErrorState 
          title="Ledger Error"
          description={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            setPage(page); // Trigger effect
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4 md:col-span-2">
      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Recent Invoices</h3>
      
      {data && data.data.length > 0 ? (
        <div className="space-y-4">
          <InvoiceTable
            invoices={data.data}
            clientsMap={{ [client.id]: client }}
            onInvoiceUpdated={() => setRefreshTrigger((p) => p + 1)}
          />
          
          <div className="flex items-center justify-between px-2 pt-4">
            <div className="text-sm text-gray-500">
              Showing page {data.pagination.page} of {data.pagination.totalPages || 1}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.pagination.hasPreviousPage}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Invoices"
          description="This client does not have any invoices yet."
          icon={FileText}
        />
      )}
    </div>
  );
}
