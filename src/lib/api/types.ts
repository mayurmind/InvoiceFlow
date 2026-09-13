export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
