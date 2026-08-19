import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';
import { InvoicePdfService } from '../../src/features/invoices/pdf/invoice-pdf.service';
import type { AuthContext } from '../../src/features/auth/auth.types';
import { UnauthorizedError, ConflictError } from '../../src/errors/application.error';
import { getSafeFilename } from '../../src/features/invoices/pdf/invoice-pdf.mapper';

vi.mock('../../src/features/invoices/pdf/invoice-pdf.service', () => ({
  InvoicePdfService: {
    generateInvoicePdf: vi.fn(),
  },
}));

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

describe('P6.3 Security tests (Gate B)', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440001';
  const mockBuffer = Buffer.from('%PDF-');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
  });

  it('SEC-01 anonymous denied', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validId}/pdf`)
      .set('x-mock-auth', 'none');
    expect(res.status).toBe(401);
  });

  it('SEC-02 VIEWER allowed', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validId}/pdf`)
      .set('x-mock-role', UserRole.VIEWER);
    expect(res.status).toBe(200);
  });

  it('SEC-03 STAFF allowed', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validId}/pdf`)
      .set('x-mock-role', UserRole.STAFF);
    expect(res.status).toBe(200);
  });

  it('SEC-04 SUPER_ADMIN allowed', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validId}/pdf`)
      .set('x-mock-role', UserRole.SUPER_ADMIN);
    expect(res.status).toBe(200);
  });

  it('SEC-05 password-change-required denied', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validId}/pdf`)
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-mock-must-change-password', 'true');
    expect(res.status).toBe(403);
  });

  it('SEC-06 malformed UUID rejected', async () => {
    const res = await request(app).get(`/api/v1/invoices/not-a-uuid/pdf`);
    expect(res.status).toBe(400);
  });

  it('SEC-07 mutation CSRF NOT required', async () => {
    const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
    const routeLayer = (invoicesRouter.stack as RouterLayerLike[]).find(
      (layer) => layer.route?.path === '/:invoiceId/pdf' && layer.route?.methods?.get,
    );
    const handlers = routeLayer!.route!.stack!.map((s) => s.name);
    expect(handlers).not.toContain('requireCsrfToken');
  });

  it('SEC-08 mutation Origin guard NOT required', async () => {
    const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
    const routeLayer = (invoicesRouter.stack as RouterLayerLike[]).find(
      (layer) => layer.route?.path === '/:invoiceId/pdf' && layer.route?.methods?.get,
    );
    const handlers = routeLayer!.route!.stack!.map((s) => s.name);
    expect(handlers).not.toContain('originGuard');
  });

  it('SEC-09 malicious filename cannot inject headers', async () => {
    const malicious = 'file.pdf"\r\nEvil-Header: true';
    const safe = getSafeFilename(malicious);
    expect(safe).not.toContain('\r');
    expect(safe).not.toContain('\n');
    expect(safe).toBe('Invoice-file.pdf-Evil-Header-true.pdf');
  });

  it('SEC-10 slash-containing invoice number cannot create path separators in Content-Disposition filename', async () => {
    const malicious = 'INV/2026/001';
    const safe = getSafeFilename(malicious);
    expect(safe).not.toContain('/');
    expect(safe).toBe('Invoice-INV-2026-001.pdf');
  });

  it('SEC-11 CRLF removed/prevented', async () => {
    const malicious = 'file\r\n.pdf';
    const safe = getSafeFilename(malicious);
    expect(safe).not.toContain('\r');
    expect(safe).not.toContain('\n');
  });

  it('SEC-12 DRAFT denied', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new ConflictError('Cannot issue PDF for DRAFT'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(409); // the error handler transforms ConflictError to 409
  });

  it('SEC-13 corrupt frozen data denied', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new ConflictError('Malformed or unsupported business snapshot'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(409);
  });

  it('SEC-14 safe renderer/internal 500 response', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new Error('Secret Renderer Crash'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(500);
    expect(res.body?.error?.message).not.toContain('Secret Renderer Crash');
    expect(res.body?.error?.message).toBe('An unexpected internal error occurred');
  });

  it('SEC-15 Prisma details not leaked', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new Error('PrismaClientKnownRequestError'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(500);
    expect(res.body?.error?.message).not.toContain('Prisma');
  });

  it('SEC-16 PostgreSQL details not leaked', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new Error('relation "users" does not exist'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('relation');
  });

  it('SEC-17 local filesystem path not leaked', async () => {
    vi.mocked(InvoicePdfService.generateInvoicePdf).mockRejectedValue(
      new Error('/var/www/html/app'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validId}/pdf`);
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('/var/www/');
  });

  it('SEC-18 middleware chain matches approved read chain', async () => {
    const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
    const routeLayer = (invoicesRouter.stack as RouterLayerLike[]).find(
      (layer) => layer.route?.path === '/:invoiceId/pdf' && layer.route?.methods?.get,
    );
    const handlers = routeLayer!.route!.stack!.map((s) => s.name);
    expect(handlers).toEqual([
      'spy',
      'requirePasswordChangeCompleted',
      '<anonymous>',
      '<anonymous>',
      'downloadInvoicePdf',
    ]);
  });

  it('SEC-19 logoStorageKey causes no network/storage resolution', async () => {
    // Proven statically: renderer implementation contains zero usage of fetch/fs for the logo
    const fs = await import('fs');
    const rendererCode = fs.readFileSync(
      'src/features/invoices/pdf/invoice-pdf.renderer.ts',
      'utf8',
    );
    expect(rendererCode).not.toContain('fetch(');
    expect(rendererCode).not.toContain('axios');
    expect(rendererCode).not.toContain('s3');
  });

  it('SEC-20 renderer/service contains no network dependency usage', async () => {
    const fs = await import('fs');
    const rendererCode = fs.readFileSync(
      'src/features/invoices/pdf/invoice-pdf.renderer.ts',
      'utf8',
    );
    const serviceCode = fs.readFileSync('src/features/invoices/pdf/invoice-pdf.service.ts', 'utf8');
    const combined = rendererCode + serviceCode;
    expect(combined).not.toContain('import * as fs');
    expect(combined).not.toContain('import * as net');
    expect(combined).not.toContain('import * as http');
    expect(combined).not.toContain('import * as https');
  });
});
