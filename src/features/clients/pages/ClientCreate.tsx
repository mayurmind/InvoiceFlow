import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { apiClient } from '../../../lib/api/client';
import { ClientForm } from '../components/ClientForm';
import { toClientPayload } from '../types/client.types';
import type { ClientFormValues, ClientResponse } from '../types/client.types';

export function ClientCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (data: ClientFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
      if (!csrfToken) throw new Error('Security token missing');

      const payload = toClientPayload(data);
      
      const response = await apiClient.post<ClientResponse>(
        '/clients',
        { 
          body: payload,
          headers: { 'x-csrf-token': csrfToken } 
        }
      );
      
      navigate(`/clients/${response.id}`);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 403) {
        setError('You do not have permission to create clients.');
      } else {
        setError('Failed to create client. Please check your inputs and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Add New Client"
        description="Enter the details for the new client."
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <ClientForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/clients')}
        isSubmitting={isSubmitting}
        submitLabel="Create Client"
      />
    </div>
  );
}
