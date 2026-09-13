import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { InvoiceForm } from '../components/InvoiceForm';
import { invoicesApi } from '../api/invoices.api';
import { apiClient } from '../../../lib/api/client';
import type { InvoiceCreatePayload, InvoiceDetailResponse } from '../types/invoice.types';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';

export function InvoiceCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneFrom = searchParams.get('cloneFrom');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCloning, setIsCloning] = React.useState(!!cloneFrom);
  const [cloneError, setCloneError] = React.useState<string | null>(null);
  const [initialData, setInitialData] = React.useState<InvoiceDetailResponse | undefined>();

  React.useEffect(() => {
    let mounted = true;

    async function loadCloneSource() {
      if (!cloneFrom) return;
      try {
        const sourceInvoice = await apiClient.get<InvoiceDetailResponse>(`/invoices/${cloneFrom}`);
        if (!mounted) return;
        
        // Strip out specific identifiers and dates so they are re-calculated
        setInitialData({
          ...sourceInvoice,
          invoiceDate: '', // Will default to today in InvoiceForm
          dueDate: '',
        });
      } catch {
        if (mounted) {
          setCloneError('Failed to load the source invoice for cloning.');
        }
      } finally {
        if (mounted) {
          setIsCloning(false);
        }
      }
    }

    if (cloneFrom) {
      loadCloneSource();
    }

    return () => {
      mounted = false;
    };
  }, [cloneFrom]);

  const handleSubmit = async (payload: InvoiceCreatePayload, issueImmediately?: boolean) => {
    try {
      setIsSubmitting(true);
      
      const response = await invoicesApi.createInvoice(payload);
      
      if (issueImmediately) {
        try {
          await invoicesApi.issueInvoice(response.id);
        } catch (issueErr) {
          // If creation succeeded but issuing failed, we still navigate but show an error in state or handle it.
          // For now, we will navigate and the detail page will show it as DRAFT.
          console.error('Failed to issue invoice automatically', issueErr);
          // In a real app we might use a toast here. We can just let the redirect happen.
        }
      }
      
      navigate(`/invoices/${response.id}`);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 403) {
        throw new Error('You do not have permission to create invoices.', { cause: err });
      } else if (err instanceof Error) {
        throw err;
      } else {
        throw new Error('Failed to create invoice. Please check your inputs and try again.', { cause: err });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCloning) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Create Invoice" description="Loading data from source invoice..." />
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (cloneError) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Create Invoice" description="Enter the details for the new invoice." />
        <ErrorState 
          title="Unable to clone invoice" 
          description={cloneError} 
          onRetry={() => navigate('/invoices/new')} 
          retryLabel="Create Blank Invoice"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Create Invoice"
        description={cloneFrom ? "New invoice details pre-filled from existing invoice." : "Enter the details for the new invoice."}
      />

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <InvoiceForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/invoices')}
          isSubmitting={isSubmitting}
          submitLabel="Create Invoice"
        />
      </div>
    </div>
  );
}
