import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'STAFF' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED';
  mustChangePassword?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function loginApi(payload: LoginPayload): Promise<{ user: UserProfile }> {
  return apiClient<{ user: UserProfile }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMeApi(): Promise<{ user: UserProfile }> {
  return apiClient<{ user: UserProfile }>('/api/v1/auth/me');
}

export async function logoutApi(): Promise<void> {
  return apiClient<void>('/api/v1/auth/logout', {
    method: 'POST',
  });
}

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<void> {
  return apiClient<void>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
