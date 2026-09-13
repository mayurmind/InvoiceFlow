/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import { apiClient, apiEvents } from '../../../lib/api/client';
import * as React from 'react';

vi.mock('../../../lib/api/client', () => {
  return {
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
    },
    apiEvents: {
      onError: vi.fn(),
      emitError: vi.fn(),
    }
  };
});

describe('useAuth', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'ADMIN',
    mustChangePassword: false,
    lastLoginAt: null
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (apiEvents.onError as any).mockImplementation(() => {
      // Mock unsubscribe
      return () => {};
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('starts in initializing state and transitions to authenticated on success', async () => {
    (apiClient.get as any).mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially initializing since the effect hasn't finished
    expect(result.current.status).toBe('initializing');

    // Wait for effect to settle
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(mockUser);
  });

  it('transitions to unauthenticated on session check failure', async () => {
    (apiClient.get as any).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('logs user out and clears state', async () => {
    // Setup authenticated state first
    (apiClient.get as any).mockResolvedValueOnce({ user: mockUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock CSRF and logout
    (apiClient.get as any).mockResolvedValueOnce({ csrfToken: 'fake-token' });
    (apiClient.post as any).mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {
      headers: { 'x-csrf-token': 'fake-token' }
    });
  });
});
