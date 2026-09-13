import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../auth/hooks/useAuth';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { formatDate } from '../../invoices/utils/formatters';
import { ClientInvoicesLedger } from '../components/ClientInvoicesLedger';
import type { ClientResponse } from '../types/client.types';

export function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF';
  
  const [client, setClient] = React.useState<ClientResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const fetchClient = async () => {
      if (!clientId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<ClientResponse>(`/clients/${clientId}`);
        if (mounted) {
          setClient(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 404) {
            setError('Client not found.');
          } else {
            setError('Failed to load client details.');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchClient();

    return () => {
      mounted = false;
    };
  }, [clientId]);

  const handleToggleArchive = async () => {
    if (!client || !clientId) return;
    
    try {
      setActionLoading(true);
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      if (!csrfToken) throw new Error('Security token missing');

      const action = client.isArchived ? 'restore' : 'archive';
      
      const updated = await apiClient.post<ClientResponse>(
        `/clients/${clientId}/${action}`,
        { headers: { 'x-csrf-token': csrfToken } }
      );
      
      setClient(updated);
    } catch {
      alert('Failed to update client status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <ErrorState 
        title="Client Error"
        description={error || 'An unexpected error occurred'}
        onRetry={() => navigate('/clients')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={
          <span className="flex items-center gap-2 mt-2">
            <span>Client ID: {client.id}</span>
            <span className="text-gray-300">•</span>
            <ClientStatusBadge isArchived={client.isArchived} />
          </span>
        }
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/clients/${client.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant={client.isArchived ? 'outline' : 'destructive'}
                onClick={handleToggleArchive}
                disabled={actionLoading}
              >
                {client.isArchived ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Archive
                  </>
                )}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Email Address</div>
              <div className="mt-1 text-gray-900">{client.email || '—'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Phone Number</div>
              <div className="mt-1 text-gray-900">{client.phone || '—'}</div>
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Tax Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">GSTIN</div>
              <div className="mt-1 text-gray-900 font-mono">{client.gstin || '—'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">PAN</div>
              <div className="mt-1 text-gray-900 font-mono">{client.pan || '—'}</div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Address</h3>
          <div className="text-gray-900">
            <div>{client.addressLine1}</div>
            {client.addressLine2 && <div>{client.addressLine2}</div>}
            <div>{client.city}, {client.state} {client.postalCode}</div>
            <div>{client.country}</div>
          </div>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Notes</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
        
        {/* Metadata */}
        <div className="md:col-span-2 flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
          <div>Added on {formatDate(client.createdAt)}</div>
          <div>Last updated on {formatDate(client.updatedAt)}</div>
          {client.archivedAt && <div>Archived on {formatDate(client.archivedAt)}</div>}
        </div>
        
        {/* Invoice Ledger */}
        <ClientInvoicesLedger clientId={client.id} client={client} />
      </div>
    </div>
  );
}
