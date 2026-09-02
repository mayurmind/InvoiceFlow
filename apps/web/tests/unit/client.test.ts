import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError, clearCsrfTokenCache } from '@/lib/api/client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfTokenCache();
  });

  it('fetches JSON successfully on GET', async () => {
    const mockData = { hello: 'world' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const result = await apiClient('/api/v1/test');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        credentials: 'same-origin',
      }),
    );
  });

  it('fetches CSRF token and attaches header on mutation methods', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/v1/auth/csrf') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ csrfToken: 'mock-csrf-token' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });
    });

    await apiClient('/api/v1/invoices', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/csrf', expect.anything());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/invoices',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
  });

  it('throws structured ApiError on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: [{ field: 'name', message: 'Name is required' }],
        },
      }),
    });

    await expect(apiClient('/api/v1/clients')).rejects.toThrow(ApiError);
  });
});
