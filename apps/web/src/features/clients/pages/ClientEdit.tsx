import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Skeleton } from '../../../components/ui/skeleton';
import { ErrorState } from '../../../components/ui/error-state';
import { apiClient } from '../../../lib/api/client';

import { ClientForm } from '../components/ClientForm';
import { toClientPayload } from '../types/client.types';
import type { ClientFormValues, ClientResponse } from '../types/client.types';

export function ClientEdit() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  
  const [client, setClient] = React.useState<ClientResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const fetchClient = async () => {
      if (!clientId) return;
      try {
        setLoading(true);
        setFetchError(null);
        const data = await apiClient.get<ClientResponse>(`/clients/${clientId}`);
        if (mounted) {
          setClient(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 404) {
            setFetchError('Client not found.');
          } else {
            setFetchError('Failed to load client details.');
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

  const handleSubmit = async (data: ClientFormValues) => {
    if (!clientId) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      if (!csrfToken) throw new Error('Security token missing');

      const payload = toClientPayload(data);
      
      const response = await apiClient.put<ClientResponse>(
        `/clients/${clientId}`,
        { 
          body: payload,
          headers: { 'x-csrf-token': csrfToken } 
        }
      );
      
      navigate(`/clients/${response.id}`);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 403) {
        setSubmitError('You do not have permission to edit clients.');
      } else {
        setSubmitError('Failed to update client. Please check your inputs and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (fetchError || !client) {
    return (
      <ErrorState 
        title="Client Error"
        description={fetchError || 'An unexpected error occurred'}
        onRetry={() => navigate('/clients')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={`Edit ${client.name}`}
        description="Update the details for this client."
      />

      {submitError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {submitError}
        </div>
      )}

      <ClientForm
        initialData={client}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/clients/${client.id}`)}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
      />
    </div>
  );
}
