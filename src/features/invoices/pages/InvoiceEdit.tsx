import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { apiClient } from '../../../lib/api/client';
import { InvoiceForm } from '../components/InvoiceForm';
import { invoicesApi } from '../api/invoices.api';
import type { InvoiceDetailResponse, InvoiceUpdatePayload } from '../types/invoice.types';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { InvoiceStatus } from '../types/invoice.types';
import { Button } from '../../../components/ui/button';

export function InvoiceEdit() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [invoice, setInvoice] = React.useState<InvoiceDetailResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!invoiceId) return;

      try {
        const invoiceResponse = await apiClient.get<InvoiceDetailResponse>(`/invoices/${invoiceId}`);

        if (mounted) {
          setInvoice(invoiceResponse);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 404) {
            setError('Invoice not found.');
          } else {
            setError('Failed to load data. Please try again.');
          }
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  const handleSubmit = async (payload: InvoiceUpdatePayload, issueImmediately?: boolean) => {
    if (!invoiceId) return;
    try {
      setIsSubmitting(true);
      
      await invoicesApi.updateInvoice(invoiceId, payload);
      
      if (issueImmediately) {
        try {
          await invoicesApi.issueInvoice(invoiceId);
        } catch (issueErr) {
          console.error('Failed to issue invoice automatically after saving', issueErr);
        }
      }
      
      navigate(`/invoices/${invoiceId}`);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 403) {
        throw new Error('You do not have permission to update invoices.', { cause: err });
      } else if (err instanceof Error) {
        throw err;
      } else {
        throw new Error('Failed to update invoice. Please check your inputs and try again.', { cause: err });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Edit Invoice" description="Update draft invoice" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Edit Invoice" description="Update draft invoice" />
        <ErrorState 
          title="Unable to load invoice" 
          description={error || 'Unknown error'} 
          onRetry={() => navigate('/invoices')}
          retryLabel="Back to Invoices"
        />
      </div>
    );
  }

  if (invoice.status !== InvoiceStatus.DRAFT) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Edit Invoice" description={`Invoice ${invoice.invoiceNumber || invoice.id}`} />
        <div className="bg-yellow-50 text-yellow-800 p-6 rounded-md border border-yellow-200">
          <h3 className="text-lg font-medium mb-2">Cannot Edit Invoice</h3>
          <p className="mb-4">Only draft invoices can be edited. This invoice is currently <strong>{invoice.status}</strong>.</p>
          <Button onClick={() => navigate(`/invoices/${invoice.id}`)}>
            View Invoice
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Edit Draft Invoice"
        description="Update the details for this draft invoice."
      />

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <InvoiceForm
          initialData={invoice}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/invoices/${invoice.id}`)}
          isSubmitting={isSubmitting}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
