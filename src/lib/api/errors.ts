export class ApiError extends Error {
  public status: number;
  public code?: string;
  public data?: unknown;

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network failure') {
    super(message);
    this.name = 'NetworkError';
  }
}
