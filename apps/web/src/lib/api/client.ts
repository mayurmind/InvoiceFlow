import { ApiError, NetworkError } from './errors';
import type { ApiResponse } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string>;
  responseType?: 'json' | 'blob';
}

export type ErrorCallback = (error: ApiError) => void;

const errorListeners = new Set<ErrorCallback>();

export const apiEvents = {
  onError: (callback: ErrorCallback) => {
    errorListeners.add(callback);
    return () => errorListeners.delete(callback);
  },
  emitError: (error: ApiError) => {
    errorListeners.forEach(listener => listener(error));
  }
};

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function fetchClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, body: rawBody, headers: customHeaders, ...customConfig } = options;

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type') && !(rawBody instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let body: BodyInit | undefined;
  if (rawBody !== undefined) {
    body = rawBody instanceof FormData || typeof rawBody === 'string' 
      ? rawBody 
      : JSON.stringify(rawBody);
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
    body,
    credentials: 'include',
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new NetworkError('Failed to connect to the server.');
  }

  let data: ApiResponse<T> | null = null;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      // Failed to parse JSON
    }
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        }).then(res => {
          if (!res.ok) throw new Error('Refresh failed');
        }).finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      
      try {
        if (refreshPromise) await refreshPromise;
        // Retry original request
        response = await fetch(url, config);
        
        const isJsonRetry = response.headers.get('content-type')?.includes('application/json');
        if (isJsonRetry) {
          try { data = await response.json(); } catch { /* ignore */ }
        }
        
        if (!response.ok) {
          throw new ApiError(
            response.status,
            data?.error?.message || response.statusText,
            data?.error?.code,
            data?.error?.details
          );
        }
      } catch {
        const error = new ApiError(
          response.status,
          data?.error?.message || response.statusText,
          data?.error?.code,
          data?.error?.details
        );
        apiEvents.emitError(error);
        throw error;
      }
    } else {
      const error = new ApiError(
        response.status,
        data?.error?.message || response.statusText,
        data?.error?.code,
        data?.error?.details
      );
      
      if (response.status === 401) {
        apiEvents.emitError(error);
      }
      
      throw error;
    }
  }

  // If we expect JSON but didn't get it, we return null or handle appropriately
  // For 204 No Content, data will be null
  
  if (options.responseType === 'blob') {
    return (await response.blob()) as unknown as T;
  }

  // If the response has a pagination object, we should return the whole object 
  // because it's a paginated response, not just a data wrapper.
  if (data?.data !== undefined && !(data as Record<string, unknown>).pagination) {
    return data.data as T;
  }
  
  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    fetchClient<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, options?: RequestOptions) =>
    fetchClient<T>(endpoint, { ...options, method: 'POST' }),
  put: <T>(endpoint: string, options?: RequestOptions) =>
    fetchClient<T>(endpoint, { ...options, method: 'PUT' }),
  patch: <T>(endpoint: string, options?: RequestOptions) =>
    fetchClient<T>(endpoint, { ...options, method: 'PATCH' }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    fetchClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
