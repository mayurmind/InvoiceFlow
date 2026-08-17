import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

vi.mock('../../src/features/invoices/invoices.service', () => {
  return {
    InvoicesService: {
      createInvoice: vi.fn(),
    },
  };
});

import { InvoicesService } from '../../src/features/invoices/invoices.service';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
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

      const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
      const mustChangePassword = req.headers['x-mock-must-change-password'] === 'true';

      req.auth = createAuthContext(role, mustChangePassword);
      next();
    }),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((req, _res, next) => {
    if (req.headers['x-origin-verified'] !== 'true') return next(new UnauthorizedError());
    next();
  }),
}));

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((req, _res, next) => {
    if (req.headers['x-csrf-verified'] === 'false') return next(new UnauthorizedError());
    next();
  }),
}));

import { DraftInvoiceResponse } from '../../src/features/invoices/invoices.types';

describe('Invoices Integration - HTTP & Validation Layer', () => {
  const validPayload = {
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    invoiceDate: '2026-08-16',
    items: [
      {
        description: 'Mock Item',
        quantity: '1.000',
        rate: '100.00',
        gstRate: '18.00',
      },
    ],
  };

  const expectedResponse: DraftInvoiceResponse = {
    id: 'inv-1',
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    invoiceNumber: null,
    financialYear: null,
    status: 'DRAFT',
    invoiceDate: '2026-08-16',
    dueDate: '2026-08-16',
    subtotal: '100.00',
    taxTotal: '18.00',
    total: '118.00',
    paidAmount: '0.00',
    outstandingAmount: '118.00',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(InvoicesService.createInvoice).mockResolvedValue(expectedResponse);
  });

  describe('POST /api/v1/invoices', () => {
    it('returns 201 on valid creation by SUPER_ADMIN', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expectedResponse);
    });

    it('returns 201 on valid creation by STAFF', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
    });

    it('returns 403 when called by VIEWER', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.VIEWER)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-auth', 'none')
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('returns 403 when password change is required', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-mock-must-change-password', 'true')
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(403);
    });

    it('returns 401 on Origin rejection', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'false')
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('returns 401 on CSRF rejection', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'false')
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('returns 400 for unknown fields in request body', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, unknownField: true });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid calendar date', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, invoiceDate: '2026-02-30' }); // Invalid date

      expect(response.status).toBe(400);
    });

    it('returns 400 for valid calendar date in the future (Asia/Kolkata)', async () => {
      vi.mocked(InvoicesService.createInvoice).mockRejectedValueOnce(
        new ValidationError('invoiceDate cannot be in the future (Asia/Kolkata timezone)'),
      );

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, invoiceDate: '2030-01-01' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid financial input', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({
          ...validPayload,
          items: [{ ...validPayload.items[0], quantity: '1.0001' }], // Invalid quantity precision
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 for missing Business Settings', async () => {
      vi.mocked(InvoicesService.createInvoice).mockRejectedValueOnce(
        new NotFoundError('Business settings missing'),
      );

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(404);
    });

    it('returns 404 for missing Client', async () => {
      vi.mocked(InvoicesService.createInvoice).mockRejectedValueOnce(
        new NotFoundError('Client not found'),
      );

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(404);
    });

    it('returns 409 for archived Client', async () => {
      vi.mocked(InvoicesService.createInvoice).mockRejectedValueOnce(
        new ConflictError('Client is archived'),
      );

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(409);
    });

    it('returns 201 for intra-state create', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, placeOfSupplyStateCode: '27' });

      expect(response.status).toBe(201);
    });

    it('returns 201 for inter-state create', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, placeOfSupplyStateCode: '29' });

      expect(response.status).toBe(201);
    });

    it('returns 201 for non-GST create', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send({ ...validPayload, items: [{ ...validPayload.items[0], gstRate: '0.00' }] });

      expect(response.status).toBe(201);
    });

    it('decimal strings verified', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.subtotal).toBe('100.00'); // Check string responses mapping
    });

    it('DATE strings verified', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.invoiceDate).toBe('2026-08-16'); // Check DATE string response
    });

    it('items verified', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('DRAFT lifecycle nulls verified', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.invoiceNumber).toBe(null);
      expect(response.body.financialYear).toBe(null);
      expect(response.body.status).toBe('DRAFT');
    });
  });
});
/ /   T e s t   i m p l e m e n t a t i o n s   a d d e d  
 