import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './client';

// Mock the global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves data and pagination for paginated responses', async () => {
    const mockPaginatedResponse = {
      data: [{ id: '1', name: 'Test' }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPaginatedResponse,
    });

    const result = await apiClient.get('/test');
    
    // The result should be the entire object, NOT just the inner array
    expect(result).toEqual(mockPaginatedResponse);
  });

  it('unwraps data for ordinary enveloped responses', async () => {
    const mockEnvelopedResponse = {
      data: { id: '1', name: 'Test Enveloped' }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockEnvelopedResponse,
    });

    const result = await apiClient.get('/test');
    
    // The result should be the unwrapped data object
    expect(result).toEqual(mockEnvelopedResponse.data);
  });

  it('returns data as-is if no data wrapper exists', async () => {
    const mockDirectResponse = {
      id: '1', 
      name: 'Test Direct'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockDirectResponse,
    });

    const result = await apiClient.get('/test');
    
    // The result should be the direct object itself
    expect(result).toEqual(mockDirectResponse);
  });

  it('returns blob if responseType is blob', async () => {
    const mockBlob = new Blob(['test-pdf-content'], { type: 'application/pdf' });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      blob: async () => mockBlob,
    });

    const result = await apiClient.get('/test-pdf', { responseType: 'blob' });
    
    expect(result).toEqual(mockBlob);
  });
});
