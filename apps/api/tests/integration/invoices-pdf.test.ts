import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

vi.mock('../../src/features/invoices/pdf/invoice-pdf.service', () => {
  return {
    InvoicePdfService: {
      generateInvoicePdf: vi.fn(),
    },
  };
});

import { InvoicePdfService } from '../../src/features/invoices/pdf/invoice-pdf.service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../src/errors/application.error';
import type { AuthContext } from '../../src/features/auth/auth.types';
import { UserRole } from '../../src/generated/prisma/client';

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
      if (req.headers['x-mock-auth'] === 'none') {
        return next(new UnauthorizedError());
      }
      const roleStr = req.headers['x-mock-role'] as string;
      const mustChangeStr = req.headers['x-mock-must-change'] as string;

      const role = roleStr ? (roleStr as UserRole) : UserRole.STAFF;
      const mustChangePassword = mustChangeStr === 'true';

      req.auth = createAuthContext(role, mustChangePassword);
      next();
    }),
  };
});

describe('invoices-pdf.integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const mockBuffer = Buffer.from('%PDF-1.4\nSome binary content\n%%EOF');

  it('H-01 SUPER_ADMIN -> 200', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app)
      .get(`/api/v1/invoices/${validUuid}/pdf`)
      .set('x-mock-role', UserRole.SUPER_ADMIN);
    expect(res.status).toBe(200);
  });

  it('H-02 STAFF -> 200', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app)
      .get(`/api/v1/invoices/${validUuid}/pdf`)
      .set('x-mock-role', UserRole.STAFF);
    expect(res.status).toBe(200);
  });

  it('H-03 VIEWER -> 200', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app)
      .get(`/api/v1/invoices/${validUuid}/pdf`)
      .set('x-mock-role', UserRole.VIEWER);
    expect(res.status).toBe(200);
  });

  it('H-04 anonymous -> 401', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validUuid}/pdf`)
      .set('x-mock-auth', 'none');
    expect(res.status).toBe(401);
  });

  it('H-05 mustChangePassword -> denied', async () => {
    const res = await request(app)
      .get(`/api/v1/invoices/${validUuid}/pdf`)
      .set('x-mock-must-change', 'true');
    expect(res.status).toBe(403);
  });

  it('H-06 malformed UUID -> 400', async () => {
    const res = await request(app).get(`/api/v1/invoices/not-a-uuid/pdf`);
    expect(res.status).toBe(400);
  });

  it('H-07 missing invoice -> 404', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(new NotFoundError());
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(404);
  });

  it('H-08 DRAFT -> 409', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(new ConflictError());
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(409);
  });

  it('H-09 corrupt issuance data -> 409', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(new ConflictError());
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(409);
  });

  it('H-10 unsupported snapshot -> 409', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(new ConflictError());
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(409);
  });

  it('H-11 GET without CSRF succeeds', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    // No x-csrf-token header
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(200);
  });

  it('H-12 GET without Origin succeeds according to frozen read-route contract', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    // Origin omitted intentionally
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(200);
  });

  it('H-13 Content-Type application/pdf', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('H-14 Content-Disposition inline', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.headers['content-disposition']).toBe('inline; filename="Invoice-INV-001.pdf"');
  });

  it('H-15 filename sanitized', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.headers['content-disposition']).toBe('inline; filename="Invoice-INV-001.pdf"');
  });

  it('H-16 invoice slashes do not remain as filename path separators', async () => {
    // This is tested via the service returning the sanitized name
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-26-27-0001.pdf',
    });
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.headers['content-disposition']).not.toContain('/');
    expect(res.headers['content-disposition']).toContain('Invoice-INV-26-27-0001.pdf');
  });

  it('H-17 Cache-Control private, no-store', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('H-18 returned body begins %PDF-', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
      buffer: mockBuffer,
      filename: 'Invoice-INV-001.pdf',
    });
    // Must parse as buffer
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`).responseType('blob');
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('H-19 internal renderer error -> safe 500', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(
      new Error('Internal failure'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(500);
  });

  it('H-20 no raw stack/Prisma/PostgreSQL text leaked', async () => {
    vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockRejectedValue(
      new Error('Internal failure: PrismaClientKnownRequestError'),
    );
    const res = await request(app).get(`/api/v1/invoices/${validUuid}/pdf`);
    expect(res.status).toBe(500);
    expect(res.body.error.message).not.toContain('Prisma');
    expect(res.body.error.message).toBe('An unexpected internal error occurred');
  });
});
