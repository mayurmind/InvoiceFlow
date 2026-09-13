import { apiClient } from '../../../lib/api/client';
import type { ChangePasswordPayload } from '../types/auth.types';

export const authApi = {
  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    await apiClient.post('/auth/change-password', {
      body: payload,
      headers: {
        'x-csrf-token': csrfToken
      }
    });
  }
};
