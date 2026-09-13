import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { auditApi } from '../api/audit.api';
import { usersApi } from '../../users/api/users.api';
import { AuditLogTable } from '../components/AuditLogTable';
import { AuditLogFilters } from '../components/AuditLogFilters';
import type { AuditLogFiltersState, AuditLogResponse } from '../types/audit.types';
import type { ManagedUser } from '../../users/types/user.types';

export function AuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<AuditLogResponse | null>(null);
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const filters: AuditLogFiltersState = {
    actorUserId: searchParams.get('actorUserId') || '',
    action: searchParams.get('action') || '',
    entityType: searchParams.get('entityType') || '',
    entityId: searchParams.get('entityId') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  };

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  React.useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const [auditResult, usersResult] = await Promise.allSettled([
          auditApi.getAuditLogs({
            page,
            limit,
            actorUserId: filters.actorUserId || undefined,
            action: filters.action || undefined,
            entityType: filters.entityType || undefined,
            entityId: filters.entityId || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          }),
          usersApi.listUsers({ limit: 100 }) // Load users for the filter dropdown
        ]);

        if (!mounted) return;

        if (auditResult.status === 'rejected') {
          // If we receive a 403, we can capture it
          if (auditResult.reason?.response?.status === 403) {
            setError('You do not have permission to view audit logs.');
          } else {
            setError('Failed to load audit logs. Please try again.');
          }
          return;
        }

        setData(auditResult.value);

        if (usersResult.status === 'fulfilled') {
          setUsers(usersResult.value.data);
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
  }, [page, filters.actorUserId, filters.action, filters.entityType, filters.entityId, filters.dateFrom, filters.dateTo]);

  const handleFilterChange = (newFilters: AuditLogFiltersState) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    
    if (newFilters.actorUserId) params.set('actorUserId', newFilters.actorUserId);
    else params.delete('actorUserId');
    
    if (newFilters.action) params.set('action', newFilters.action);
    else params.delete('action');
    
    if (newFilters.entityType) params.set('entityType', newFilters.entityType);
    else params.delete('entityType');

    if (newFilters.entityId) params.set('entityId', newFilters.entityId);
    else params.delete('entityId');
    
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    else params.delete('dateFrom');
    
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
    else params.delete('dateTo');
    
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
        <PageHeader title="Audit Logs" description="Review system activity and security events" />
        <ErrorState 
          title="Unable to load audit logs" 
          description={error} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Audit Logs" description="Review system activity and security events" />
      </div>

      <AuditLogFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        users={users} 
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
          title="No audit logs found" 
          description={
            Object.values(filters).some(Boolean)
              ? "Try adjusting your filters to find what you're looking for."
              : "There is no audit history available."
          }
        />
      ) : (
        <div className="space-y-4">
          <AuditLogTable auditLogs={data!.data} />
          
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing page {data!.page} of {data!.totalPages || 1} ({data!.total} total records)
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data!.page - 1)}
                disabled={data!.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data!.page + 1)}
                disabled={data!.page >= data!.totalPages}
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
