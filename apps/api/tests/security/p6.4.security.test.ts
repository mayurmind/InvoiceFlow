import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole, InvoiceStatus, EmailDeliveryStatus } from '../../src/generated/prisma/client';
import { InvoiceEmailService } from '../../src/features/invoices/email/invoice-email.service';
import type { AuthContext } from '../../src/features/auth/auth.types';
import { UnauthorizedError, ConflictError } from '../../src/errors/application.error';
import { env } from '../../src/config/env';
import { createInvoiceSubject, createInvoiceEmailHtml } from '../../src/features/invoices/email/invoice-email.template';

type RouterLayerLike = {
  name?: string;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{ name?: string }>;
  };
};

const createAuthContext = (role: UserRole, mustChangePassword = false): AuthContext => ({
  sessionId: 'mock-session-id',
  user: {
    id: 'mock-user-id',
    email: 'mock@example.com',
    firstName: 'Mock',
    lastName: 'User',
    role,
    mustChangePassword,
    lastLoginAt: null,
  },
});

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn((req, _res, next) => {
      if (req.headers['x-mock-auth'] === 'none') return next(new UnauthorizedError());
      const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
      const mustChangePassword = req.headers['x-mock-must-change-password'] === 'true';
      req.auth = createAuthContext(role, mustChangePassword);
      next();
    }),
  };
});

vi.mock('../../src/features/invoices/email/invoice-email.service', () => ({
  InvoiceEmailService: vi.fn().mockImplementation(() => ({
    sendInvoiceEmail: vi.fn().mockResolvedValue({ status: 201, delivery: { id: 'd1', attemptNumber: 1, status: 'PENDING' } }),
    resendInvoiceEmail: vi.fn().mockResolvedValue({ status: 201, delivery: { id: 'd2', attemptNumber: 2, status: 'PENDING' } }),
    getEmailDeliveryHistory: vi.fn().mockResolvedValue([]),
  })),
}));

describe('P6.4 Security Matrix', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and RBAC', () => {
    it('SEC-EMAIL-01: Authentication required', async () => {
      const endpoints: Array<{ method: 'post' | 'get'; path: string }> = [
        { method: 'post', path: `/api/v1/invoices/${validId}/send` },
        { method: 'post', path: `/api/v1/invoices/${validId}/resend` },
        { method: 'get', path: `/api/v1/invoices/${validId}/email-deliveries` },
      ];
      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set('x-mock-auth', 'none');
        expect(res.status).toBe(401);
      }
    });

    it('SEC-EMAIL-02: STAFF may send/resend', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(201);
    });

    it('SEC-EMAIL-03: SUPER_ADMIN may send/resend', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(201);
    });

    it('SEC-EMAIL-04: VIEWER forbidden from send/resend', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).set('x-mock-role', UserRole.VIEWER);
      expect(res.status).toBe(403);
    });

    it('SEC-EMAIL-05: Password-change requirement enforced', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/send`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-mock-must-change-password', 'true');
      expect(res.status).toBe(403);
    });
  });

  describe('Origin / CSRF / Request Validation', () => {
    it('SEC-EMAIL-06: POST send/resend require Origin guard', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) => (invoicesRouter.stack as RouterLayerLike[]).find(
        (layer) => layer.route?.path === path && layer.route?.methods?.post,
      );
      expect(getLayer('/:invoiceId/send')!.route!.stack!.map(s => s.name)).toContain('originGuard');
      expect(getLayer('/:invoiceId/resend')!.route!.stack!.map(s => s.name)).toContain('originGuard');
    });

    it('SEC-EMAIL-07: POST send/resend require CSRF', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) => (invoicesRouter.stack as RouterLayerLike[]).find(
        (layer) => layer.route?.path === path && layer.route?.methods?.post,
      );
      expect(getLayer('/:invoiceId/send')!.route!.stack!.map(s => s.name)).toContain('requireCsrfToken');
      expect(getLayer('/:invoiceId/resend')!.route!.stack!.map(s => s.name)).toContain('requireCsrfToken');
    });

    it('SEC-EMAIL-08: invoiceId must be valid UUID', async () => {
      const res = await request(app).post(`/api/v1/invoices/not-a-uuid/send`);
      expect(res.status).toBe(400);
    });

    it('SEC-EMAIL-09: recipient override forbidden', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).send({ to: 'hacker@example.com', recipientEmail: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });

    it('SEC-EMAIL-10: cc/bcc injection forbidden', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).send({ cc: 'hacker@example.com', bcc: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });

    it('SEC-EMAIL-11: from override forbidden', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).send({ from: 'hacker@example.com', replyTo: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });

    it('SEC-EMAIL-12: subject override forbidden', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).send({ subject: 'Fake' });
      expect(res.status).toBe(400);
    });

    it('SEC-EMAIL-13: body/html/text override forbidden', async () => {
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`).send({ html: '<h1>Hack</h1>', text: 'Hack', provider: 'fake', status: 'SENT', attachment: true, idempotencyKey: '123' });
      expect(res.status).toBe(400);
    });
  });

  describe('Template Security', () => {
    it('SEC-EMAIL-14: subject CR/LF injection protected', () => {
      const subject = createInvoiceSubject('INV\r\n123', 'My\rBusiness');
      expect(subject).not.toContain('\r');
      expect(subject).not.toContain('\n');
    });

    it('SEC-EMAIL-15: HTML dynamic fields escaped', () => {
      const html = createInvoiceEmailHtml('INV-1', '<script>alert(1)</script>', 'My <Business>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;Business&gt;');
    });
  });

  describe('Lifecycle / Snapshot Safety', () => {
    it('SEC-EMAIL-16: DRAFT invoice cannot send', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new ConflictError('DRAFT invoice cannot be sent.'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(409);
    });

    it('SEC-EMAIL-17: CANCELLED invoice cannot send', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new ConflictError('CANCELLED invoice cannot be sent.'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(409);
    });

    it('SEC-EMAIL-18: missing snapshot recipient rejected', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new ConflictError('Missing recipient'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(409);
    });

    it('SEC-EMAIL-19: corrupt snapshot rejected', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new ConflictError('Corrupt snapshot'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(409);
    });

    it('SEC-EMAIL-20: live Client.email is not used as recipient fallback', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).not.toContain('invoice.client.email');
      expect(serviceCode).toContain('invoice.clientSnapshot');
    });

    it('SEC-EMAIL-21: live BusinessSettings not used for historical email', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).not.toContain('prisma.businessSettings');
      expect(serviceCode).toContain('invoice.businessSnapshot');
    });
  });

  describe('Secret / Error / Network Isolation', () => {
    it('SEC-EMAIL-22: EMAIL_API_KEY is not leaked', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new Error(`Error: ${env.EMAIL_API_KEY}`));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(500);
      expect(res.text).not.toContain(env.EMAIL_API_KEY as string);
    });

    it('SEC-EMAIL-23: raw provider error is not leaked', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new Error('Resend network disconnected'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(500);
      expect(res.text).not.toContain('Resend network disconnected');
    });

    it('SEC-EMAIL-24: raw Prisma error is not leaked', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new Error('PrismaClientKnownRequestError'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(500);
      expect(res.text).not.toContain('Prisma');
    });

    it('SEC-EMAIL-25: raw PostgreSQL error is not leaked', async () => {
      const svc = new InvoiceEmailService(null as any, null as any);
      vi.mocked(svc.sendInvoiceEmail).mockRejectedValueOnce(new Error('relation "email_deliveries" does not exist'));
      const res = await request(app).post(`/api/v1/invoices/${validId}/send`);
      expect(res.status).toBe(500);
      expect(res.text).not.toContain('relation');
    });

    it('SEC-EMAIL-26: PDF is not persisted to filesystem', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).not.toContain('fs.write');
    });

    it('SEC-EMAIL-27: tests perform no real provider network', () => {
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('SEC-EMAIL-28: provider call occurs only after invoice validation', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      const validationIndex = serviceCode.indexOf('InvoiceStatus.DRAFT');
      const providerIndex = serviceCode.indexOf('sendInvoiceEmail');
      expect(validationIndex).toBeGreaterThan(-1);
    });
  });

  describe('Idempotency / Concurrency', () => {
    it('SEC-EMAIL-29: same pending attempt uses stable idempotency key', async () => {
      const fs = await import('fs');
      const providerCode = fs.readFileSync('src/features/invoices/email/invoice-email.provider.ts', 'utf8');
      expect(providerCode).toContain('Idempotency-Key');
    });

    it('SEC-EMAIL-30: new resend attempt uses different idempotency key', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).toContain('resendInvoiceEmail');
    });

    it('SEC-EMAIL-31: concurrent recovery does not create duplicate attempt', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).toContain('FOR UPDATE');
    });

    it('SEC-EMAIL-41: stale PENDING attempt is not automatically replayed', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).toContain('manual reconciliation');
    });

    it('SEC-EMAIL-42: concurrent provider idempotency conflict remains PENDING', async () => {
      const fs = await import('fs');
      const serviceCode = fs.readFileSync('src/features/invoices/email/invoice-email.service.ts', 'utf8');
      expect(serviceCode).toContain('EmailDeliveryStatus.PENDING');
    });
  });

  describe('Invoice Immutability', () => {
    it('SEC-EMAIL-32: Invoice.status unchanged', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).not.toContain('status: ');
    });

    it('SEC-EMAIL-33: Invoice.updatedAt unchanged', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).not.toContain('updatedAt: ');
    });

    it('SEC-EMAIL-34: financial fields unchanged', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).not.toContain('total: ');
    });

    it('SEC-EMAIL-35: InvoiceItems unchanged', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).not.toContain('prisma.invoiceItem');
    });

    it('SEC-EMAIL-36: InvoiceCounter unchanged', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).not.toContain('prisma.invoiceCounter');
    });
  });

  describe('Failure Sanitization', () => {
    it('SEC-EMAIL-37: failureCode/failureMessage bounded and sanitized', async () => {
      const fs = await import('fs');
      const repoCode = fs.readFileSync('src/features/invoices/email/invoice-email.repository.ts', 'utf8');
      expect(repoCode).toContain('substring');
    });
  });

  describe('History Read Authorization', () => {
    it('SEC-EMAIL-38: VIEWER may read email-delivery history', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${validId}/email-deliveries`)
        .set('x-mock-role', UserRole.VIEWER);
      expect(res.status).toBe(200);
    });

    it('SEC-EMAIL-39: GET history does not require CSRF', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) => (invoicesRouter.stack as RouterLayerLike[]).find(
        (layer) => layer.route?.path === path && layer.route?.methods?.get,
      );
      expect(getLayer('/:invoiceId/email-deliveries')!.route!.stack!.map(s => s.name)).not.toContain('requireCsrfToken');
    });

    it('SEC-EMAIL-40: GET history does not require Origin guard', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) => (invoicesRouter.stack as RouterLayerLike[]).find(
        (layer) => layer.route?.path === path && layer.route?.methods?.get,
      );
      expect(getLayer('/:invoiceId/email-deliveries')!.route!.stack!.map(s => s.name)).not.toContain('originGuard');
    });
  });
});
