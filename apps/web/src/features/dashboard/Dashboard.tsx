import * as React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/skeleton';
import { ErrorState } from '../../components/ui/error-state';
import { apiClient } from '../../lib/api/client';
import { DashboardSummaryCards } from './components/DashboardSummaryCards';
import { InvoiceStatusChart } from './components/InvoiceStatusChart';
import { RecentInvoicesTable } from './components/RecentInvoicesTable';
import { RecentPaymentsTable } from './components/RecentPaymentsTable';
import type { DashboardSummaryDto, ClientListResponse } from './types/dashboard.types';

export function DashboardPlaceholder() {
  const [summary, setSummary] = React.useState<DashboardSummaryDto | null>(null);
  const [totalClients, setTotalClients] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const [summaryResult, clientsResult] = await Promise.allSettled([
          apiClient.get<DashboardSummaryDto>('/dashboard/summary'),
          apiClient.get<ClientListResponse>('/clients?limit=1')
        ]);

        if (!mounted) return;

        if (summaryResult.status === 'rejected') {
          // If the main dashboard summary fails, we consider it a complete failure.
          // Extract specific error message if it's an API error
          const err = summaryResult.reason;
          if (err?.status === 403) {
            setError('You do not have permission to view the dashboard.');
          } else {
            setError('Failed to load dashboard data. Please try again.');
          }
          return;
        }

        setSummary(summaryResult.value);

        if (clientsResult.status === 'fulfilled') {
          setTotalClients(clientsResult.value.pagination.total);
        } else {
          // If client fetching fails, we just don't show the total clients count.
          setTotalClients(null);
        }

      } catch {
        if (mounted) {
          setError('An unexpected error occurred while loading the dashboard.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Dashboard" 
          description="Overview of your business metrics and recent activity."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border bg-card text-card-foreground shadow">
              <div className="p-6 space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-64 rounded-xl border bg-card p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Dashboard" 
          description="Overview of your business metrics and recent activity."
        />
        <ErrorState 
          title="Unable to load dashboard" 
          description={error || 'An unexpected error occurred.'} 
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const totalInvoices = Object.values(summary.invoiceStatusCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your business metrics and recent activity."
      />
      
      <DashboardSummaryCards 
        totalInvoices={totalInvoices}
        totalClients={totalClients}
        paidAmount={summary.paidAmount}
        outstandingAmount={summary.outstandingAmount}
      />

      <InvoiceStatusChart statusCounts={summary.invoiceStatusCounts} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentInvoicesTable
          invoices={summary.recentInvoices}
          onInvoiceUpdated={() => setRefreshTrigger((p) => p + 1)}
        />
        <RecentPaymentsTable payments={summary.recentPayments} />
      </div>
    </div>
  );
}
