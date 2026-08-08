// Vitest setup file to ensure a deterministic test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://invoiceflow_test:invoiceflow_test@localhost:5432/invoiceflow_test';
process.env.PORT = '5000';
process.env.HOST = '127.0.0.1';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
