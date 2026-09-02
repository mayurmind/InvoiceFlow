import { apiClient } from './client';

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: 'India';
  notes?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientListResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'archived' | 'all';
  stateCode?: string;
}

export async function getClientsApi(params?: ClientListParams): Promise<ClientListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.stateCode) query.set('stateCode', params.stateCode);

  const qs = query.toString();
  return apiClient<ClientListResponse>(`/api/v1/clients${qs ? `?${qs}` : ''}`);
}

export async function getClientApi(id: string): Promise<{ client: Client }> {
  return apiClient<{ client: Client }>(`/api/v1/clients/${id}`);
}

export async function createClientApi(
  data: Omit<Client, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
): Promise<{ client: Client }> {
  return apiClient<{ client: Client }>('/api/v1/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClientApi(
  id: string,
  data: Partial<Client>,
): Promise<{ client: Client }> {
  return apiClient<{ client: Client }>(`/api/v1/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deactivateClientApi(id: string): Promise<void> {
  return apiClient<void>(`/api/v1/clients/${id}/deactivate`, {
    method: 'POST',
  });
}
