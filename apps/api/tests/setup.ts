// Vitest setup file to ensure a deterministic test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://runtime:runtime@localhost:5432/invoiceflow_dev';
process.env.TEST_DATABASE_URL ??= 'postgresql://test:test@localhost:5432/invoiceflow_test';
process.env.PORT = '5000';
process.env.HOST = '127.0.0.1';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';

process.env.ACCESS_TOKEN_SECRET ??= 'test-access-token-secret-000000000000000000000000';
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-token-secret-0000000000000000000000';
process.env.CSRF_SECRET ??= 'test-csrf-secret-00000000000000000000000000';
process.env.JWT_ISSUER ??= 'invoiceflow-api';
process.env.JWT_AUDIENCE ??= 'invoiceflow-web';
process.env.ACCESS_TOKEN_TTL ??= '15m';
process.env.REFRESH_TOKEN_TTL ??= '7d';
