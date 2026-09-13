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
    return apiClient.post<ManagedUser>('/users', { body: data });
  },

  updateUserRole: async (userId: string, role: UserRole) => {
    return apiClient.patch<ManagedUser>(`/users/${userId}/role`, { body: { role } });
  },

  updateUserStatus: async (userId: string, isActive: boolean) => {
    return apiClient.patch<ManagedUser>(`/users/${userId}/status`, { body: { isActive } });
  },

  resetUserPassword: async (userId: string, temporaryPassword: string) => {
    return apiClient.post<{ success: boolean }>(`/users/${userId}/reset-password`, { body: { temporaryPassword } });
  },
};
