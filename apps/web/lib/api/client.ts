export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: Array<{ field: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

let cachedCsrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken !== null && cachedCsrfToken !== '') {
    return cachedCsrfToken;
  }
  try {
    const res = await fetch('/api/v1/auth/csrf', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const token = data && typeof data.csrfToken === 'string' ? data.csrfToken : '';
      cachedCsrfToken = token;
      return token;
    }
  } catch {
    // ignore fetch error, CSRF header will remain empty
  }
  return '';
}

export function clearCsrfTokenCache(): void {
  cachedCsrfToken = null;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method?.toUpperCase() || 'GET';
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Inject CSRF token for mutating requests
  if (isMutation) {
    const csrfToken = await fetchCsrfToken();
    if (csrfToken && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrfToken);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!res.ok) {
    if (res.status === 403) {
      // Refresh CSRF cache on potential CSRF failure
      clearCsrfTokenCache();
    }

    if (isJson) {
      const errorData: ApiErrorResponse = await res.json();
      const code = errorData?.error?.code || 'UNKNOWN_ERROR';
      const message = errorData?.error?.message || `Request failed with status ${res.status}`;
      const details = errorData?.error?.details;
      throw new ApiError(res.status, code, message, details);
    }

    const text = await res.text();
    throw new ApiError(res.status, 'SERVER_ERROR', text || `HTTP Error ${res.status}`);
  }

  if (isJson) {
    return (await res.json()) as T;
  }

  return (await res.blob()) as unknown as T;
}
