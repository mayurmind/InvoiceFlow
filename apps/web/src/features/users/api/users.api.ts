import { apiClient } from '../../../lib/api/client';
import type { ManagedUser, ListUsersResponse, UserRole } from '../types/user.types';

export const usersApi = {
  listUsers: async (params?: { limit?: number; offset?: number; role?: UserRole; isActive?: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams = new URLSearchParams(params as any);
    const queryString = searchParams.toString();
    const url = queryString ? `/users?${queryString}` : '/users';
    return apiClient.get<ListUsersResponse>(url);
  },

  getUser: async (userId: string) => {
    return apiClient.get<ManagedUser>(`/users/${userId}`);
  },

  createUser: async (data: { email: string; firstName: string; lastName: string; role: string; temporaryPassword: string }) => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.post<ManagedUser>('/users', { 
      body: data,
      headers: { 'x-csrf-token': csrfToken }
    });
  },

  updateUserRole: async (userId: string, role: UserRole) => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.patch<ManagedUser>(`/users/${userId}/role`, { 
      body: { role },
      headers: { 'x-csrf-token': csrfToken }
    });
  },

  updateUserStatus: async (userId: string, isActive: boolean) => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.patch<ManagedUser>(`/users/${userId}/status`, { 
      body: { isActive },
      headers: { 'x-csrf-token': csrfToken }
    });
  },

  resetUserPassword: async (userId: string, temporaryPassword: string) => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.post<{ success: boolean }>(`/users/${userId}/reset-password`, { 
      body: { temporaryPassword },
      headers: { 'x-csrf-token': csrfToken }
    });
  },
};
