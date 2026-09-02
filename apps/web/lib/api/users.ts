import { apiClient } from './client';

export type UserRole = 'SUPER_ADMIN' | 'STAFF' | 'VIEWER';

export interface UserAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface ListUsersParams {
  limit?: number;
  offset?: number;
  role?: UserRole;
  isActive?: boolean;
}

export interface ListUsersResponse {
  users: UserAccount[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: 'STAFF' | 'VIEWER';
  temporaryPassword: string;
}

export async function getUsersApi(params?: ListUsersParams): Promise<ListUsersResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset !== undefined) query.set('offset', params.offset.toString());
  if (params?.role) query.set('role', params.role);
  if (params?.isActive !== undefined) query.set('isActive', params.isActive ? 'true' : 'false');

  const qs = query.toString();
  return apiClient<ListUsersResponse>(`/api/v1/users${qs ? `?${qs}` : ''}`);
}

export async function getUserApi(userId: string): Promise<{ user: UserAccount }> {
  return apiClient<{ user: UserAccount }>(`/api/v1/users/${userId}`);
}

export async function createUserApi(payload: CreateUserPayload): Promise<{ user: UserAccount }> {
  return apiClient<{ user: UserAccount }>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUserRoleApi(
  userId: string,
  role: 'STAFF' | 'VIEWER',
): Promise<{ user: UserAccount }> {
  return apiClient<{ user: UserAccount }>(`/api/v1/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function updateUserStatusApi(
  userId: string,
  isActive: boolean,
): Promise<{ user: UserAccount }> {
  return apiClient<{ user: UserAccount }>(`/api/v1/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function resetUserPasswordApi(
  userId: string,
  temporaryPassword: string,
): Promise<void> {
  return apiClient<void>(`/api/v1/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ temporaryPassword }),
  });
}
