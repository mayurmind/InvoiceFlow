import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../auth/hooks/useAuth';
import { ClientFilters } from '../components/ClientFilters';
import type { ClientFiltersState } from '../components/ClientFilters';
import { ClientTable } from '../components/ClientTable';
import type { ClientListResponse, ClientStatusFilter } from '../types/client.types';

export function ClientsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF';

  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<ClientListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const filters: ClientFiltersState = {
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as ClientStatusFilter) || '',
    stateCode: searchParams.get('stateCode') || '',
  };

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const handleFilterChange = (newFilters: ClientFiltersState) => {
    const params = new URLSearchParams(searchParams);
    
    if (newFilters.search) params.set('search', newFilters.search);
    else params.delete('search');
    
    if (newFilters.status) params.set('status', newFilters.status);
    else params.delete('status');
    
    if (newFilters.stateCode) params.set('stateCode', newFilters.stateCode);
    else params.delete('stateCode');
    
    // Reset to page 1 on filter change
    params.set('page', '1');
    
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  React.useEffect(() => {
    let mounted = true;

    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, string> = {
          page: page.toString(),
          limit: limit.toString(),
        };

        if (filters.search) params.search = filters.search;
        if (filters.status) params.status = filters.status;
        if (filters.stateCode) params.stateCode = filters.stateCode;

        const response = await apiClient.get<ClientListResponse>('/clients', { params });
        
        if (mounted) {
          setData(response);
        }
      } catch {
        if (mounted) {
          setError('An unexpected error occurred while loading clients.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchClients();

    return () => {
      mounted = false;
    };
  }, [page, limit, filters.search, filters.status, filters.stateCode]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage your business clients and contact information"
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/clients/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <ClientFilters filters={filters} onFilterChange={handleFilterChange} />

        {error ? (
          <ErrorState 
            title="Failed to load clients"
            description={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              setSearchParams(new URLSearchParams(searchParams)); // trigger re-render
            }}
          />
        ) : loading && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full rounded-md" />
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="space-y-4">
            <ClientTable clients={data.data} />
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2 text-sm text-gray-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} clients
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!data.pagination.hasPreviousPage}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!data.pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No clients found"
            description={
              filters.search || filters.status || filters.stateCode
                ? "We couldn't find any clients matching your current filters. Try adjusting them."
                : "You haven't added any clients yet. Add your first client to start managing them."
            }
            icon={Users}
            actionLabel={!filters.search && !filters.status && !filters.stateCode && canCreate ? "New Client" : undefined}
            onAction={!filters.search && !filters.status && !filters.stateCode && canCreate ? () => navigate('/clients/new') : undefined}
          />
        )}
      </div>
    </div>
  );
}
