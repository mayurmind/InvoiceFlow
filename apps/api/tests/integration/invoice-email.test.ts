import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn((req, _res, next) => {
      // Simulate auth or missing auth based on headers
      if (req.headers['x-mock-unauth']) {
        next(); // will be caught by controller check
        return;
      }
      req.auth = {
        sessionId: 'mock-session-id',
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'SUPER_ADMIN', // using string to avoid enum import
          mustChangePassword: false,
          lastLoginAt: null,
        },
      };
      next();
    }),
    requirePasswordChangeCompleted: vi.fn((_req, _res, next) => next()),
    requireRoles: vi.fn(
      () =>
        (
          _req: import('express').Request,
          _res: import('express').Response,
          next: import('express').NextFunction,
        ) =>
          next(),
    ),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../src/features/auth/rbac.middleware', () => ({
  requireRoles: vi.fn(
    () =>
      (
        _req: import('express').Request,
        _res: import('express').Response,
        next: import('express').NextFunction,
      ) =>
        next(),
  ),
}));

export const mockSendInvoiceEmail = vi
  .fn()
  .mockResolvedValue({ status: 202, delivery: { id: 'd-1' } });
export const mockResendInvoiceEmail = vi
  .fn()
  .mockResolvedValue({ status: 202, delivery: { id: 'd-2' } });
export const mockListInvoiceEmailDeliveries = vi.fn().mockResolvedValue([{ id: 'd-1' }]);

vi.mock('../../src/features/invoices/email/invoice-email.service', () => ({
  InvoiceEmailService: vi.fn().mockImplementation(() => ({
    sendInvoiceEmail: mockSendInvoiceEmail,
    resendInvoiceEmail: mockResendInvoiceEmail,
    listInvoiceEmailDeliveries: mockListInvoiceEmailDeliveries,
  })),
}));

describe('Invoice Email HTTP Integration', () => {
  it('POST /api/v1/invoices/:id/send requires auth', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/send')
      .set('x-mock-unauth', 'true');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/invoices/:id/resend requires auth', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/resend')
      .set('x-mock-unauth', 'true');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/invoices/:id/email-deliveries requires auth', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/00000000-0000-0000-0000-000000000001/email-deliveries')
      .set('x-mock-unauth', 'true');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/invoices/:id/send succeeds when authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/send')
      .send({});
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ id: 'd-1' });
  });

  it('POST /api/v1/invoices/:id/resend succeeds when authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/resend')
      .send({});
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ id: 'd-2' });
  });

  it('GET /api/v1/invoices/:id/email-deliveries succeeds when authenticated', async () => {
    const res = await request(app).get(
      '/api/v1/invoices/00000000-0000-0000-0000-000000000001/email-deliveries',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'd-1' }]);
  });

  it('POST /api/v1/invoices/:id/send handles service errors', async () => {
    mockSendInvoiceEmail.mockRejectedValueOnce(new Error('Test error'));
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/send')
      .send({});
    expect(res.status).toBe(500);
  });

  it('GET /api/v1/invoices/:id/email-deliveries handles service errors', async () => {
    mockListInvoiceEmailDeliveries.mockRejectedValueOnce(new Error('Test error'));
    const res = await request(app).get(
      '/api/v1/invoices/00000000-0000-0000-0000-000000000001/email-deliveries',
    );
    expect(res.status).toBe(500);
  });

  // P6.4 coverage tests for other endpoints in invoices.controller.ts
  it('POST /api/v1/invoices/:id/issue requires auth', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/00000000-0000-0000-0000-000000000001/issue')
      .set('x-mock-unauth', 'true')
      .send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/invoices/:id/pdf requires auth', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/00000000-0000-0000-0000-000000000001/pdf')
      .set('x-mock-unauth', 'true');
    expect(res.status).toBe(401);
  });
});
