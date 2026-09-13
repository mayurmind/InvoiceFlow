import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { apiClient } from '../../../lib/api/client';
import { InvoiceTable } from '../components/InvoiceTable';
import { InvoiceFilters } from '../components/InvoiceFilters';
import type { InvoiceFiltersState } from '../components/InvoiceFilters';
import { InvoiceStatus } from '../types/invoice.types';
import type { InvoiceListResponse, ClientResponse } from '../types/invoice.types';

export function InvoicesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<InvoiceListResponse | null>(null);
  const [clientsMap, setClientsMap] = React.useState<Record<string, ClientResponse>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const filters: InvoiceFiltersState = {
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as InvoiceStatus) || '',
    clientId: searchParams.get('clientId') || '',
    invoiceDateFrom: searchParams.get('invoiceDateFrom') || '',
    invoiceDateTo: searchParams.get('invoiceDateTo') || '',
    dueDateFrom: searchParams.get('dueDateFrom') || '',
    dueDateTo: searchParams.get('dueDateTo') || '',
  };

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  React.useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', page.toString());
        queryParams.set('limit', limit.toString());
        
        if (filters.search) queryParams.set('search', filters.search);
        if (filters.status) queryParams.set('status', filters.status);
        if (filters.clientId) queryParams.set('clientId', filters.clientId);
        if (filters.invoiceDateFrom) queryParams.set('invoiceDateFrom', filters.invoiceDateFrom);
        if (filters.invoiceDateTo) queryParams.set('invoiceDateTo', filters.invoiceDateTo);
        if (filters.dueDateFrom) queryParams.set('dueDateFrom', filters.dueDateFrom);
        if (filters.dueDateTo) queryParams.set('dueDateTo', filters.dueDateTo);

        const invoicesResult = await apiClient.get<InvoiceListResponse>(`/invoices?${queryParams.toString()}`);

        if (!mounted) return;

        setData(invoicesResult);

        // Fetch exactly the clients we need for the current page
        const uniqueClientIds = Array.from(new Set(invoicesResult.data.map(i => i.clientId)));
        if (uniqueClientIds.length > 0) {
          const clientPromises = uniqueClientIds.map(id => apiClient.get<ClientResponse>(`/clients/${id}`));
          const clientResults = await Promise.allSettled(clientPromises);
          
          const map: Record<string, ClientResponse> = {};
          clientResults.forEach((res) => {
            if (res.status === 'fulfilled') {
              map[res.value.id] = res.value;
            }
          });
          if (mounted) {
            setClientsMap(map);
          }
        } else {
          if (mounted) {
            setClientsMap({});
          }
        }

      } catch {
        if (mounted) {
          setError('An unexpected error occurred while loading data.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [page, filters.search, filters.status, filters.clientId, filters.invoiceDateFrom, filters.invoiceDateTo, filters.dueDateFrom, filters.dueDateTo, refreshTrigger]);

  const handleFilterChange = (newFilters: InvoiceFiltersState) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1'); // Reset to page 1 on filter change
    
    // Update params based on new filters
    if (newFilters.search) params.set('search', newFilters.search);
    else params.delete('search');
    
    if (newFilters.status) params.set('status', newFilters.status);
    else params.delete('status');
    
    if (newFilters.clientId) params.set('clientId', newFilters.clientId);
    else params.delete('clientId');
    
    if (newFilters.invoiceDateFrom) params.set('invoiceDateFrom', newFilters.invoiceDateFrom);
    else params.delete('invoiceDateFrom');
    
    if (newFilters.invoiceDateTo) params.set('invoiceDateTo', newFilters.invoiceDateTo);
    else params.delete('invoiceDateTo');

    if (newFilters.dueDateFrom) params.set('dueDateFrom', newFilters.dueDateFrom);
    else params.delete('dueDateFrom');
    
    if (newFilters.dueDateTo) params.set('dueDateTo', newFilters.dueDateTo);
    else params.delete('dueDateTo');
    
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="Manage and review your invoices" />
        <ErrorState 
          title="Unable to load invoices" 
          description={error} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Invoices" description="Manage and review your invoices" />
      </div>

      <InvoiceFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data?.data.length === 0 ? (
        <EmptyState 
          title="No invoices found" 
          description={
            Object.values(filters).some(Boolean)
              ? "Try adjusting your filters to find what you're looking for."
              : "You haven't created any invoices yet."
          }
        />
      ) : (
        <div className="space-y-4">
          <InvoiceTable
            invoices={data!.data}
            clientsMap={clientsMap}
            onInvoiceUpdated={() => setRefreshTrigger((p) => p + 1)}
          />
          
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing page {data!.pagination.page} of {data!.pagination.totalPages || 1}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data!.pagination.page - 1)}
                disabled={!data!.pagination.hasPreviousPage}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data!.pagination.page + 1)}
                disabled={!data!.pagination.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
