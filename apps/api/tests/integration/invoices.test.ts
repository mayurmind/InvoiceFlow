import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

vi.mock('../../src/features/invoices/invoices.service', () => {
  return {
    InvoicesService: {
      createInvoice: vi.fn(),
      listInvoices: vi.fn(),
      getInvoiceById: vi.fn(),
      updateInvoice: vi.fn(),
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
    vi.mocked(InvoicesService.listInvoices).mockResolvedValue({
      data: [expectedResponse],
      pagination: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    vi.mocked(InvoicesService.getInvoiceById).mockResolvedValue(expectedResponse as never);
    vi.mocked(InvoicesService.updateInvoice).mockResolvedValue(expectedResponse);
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
  describe('GET /api/v1/invoices', () => {
    it('returns 200 on successful list request (A)', async () => {
      const response = await request(app)
        .get('/api/v1/invoices')
        .set('x-mock-role', UserRole.STAFF);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [expectedResponse],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      expect(InvoicesService.listInvoices).toHaveBeenCalledTimes(1);
      expect(InvoicesService.listInvoices).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('handles explicit pagination (B)', async () => {
      const response = await request(app)
        .get('/api/v1/invoices?page=2&limit=50')
        .set('x-mock-role', UserRole.STAFF);

      expect(response.status).toBe(200);
      expect(InvoicesService.listInvoices).toHaveBeenCalledWith({
        page: 2,
        limit: 50,
      });
    });

    it('forwards valid filters (C)', async () => {
      const clientId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(
          `/api/v1/invoices?status=DRAFT&clientId=${clientId}&invoiceDateFrom=2026-08-01&invoiceDateTo=2026-08-31&dueDateFrom=2026-09-01&dueDateTo=2026-09-30`,
        )
        .set('x-mock-role', UserRole.STAFF);

      expect(response.status).toBe(200);
      expect(InvoicesService.listInvoices).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'DRAFT',
        clientId,
        invoiceDateFrom: '2026-08-01',
        invoiceDateTo: '2026-08-31',
        dueDateFrom: '2026-09-01',
        dueDateTo: '2026-09-30',
      });
    });

    it('allows SUPER_ADMIN, STAFF, and VIEWER roles (D)', async () => {
      const roles = [UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER];
      for (const role of roles) {
        const res = await request(app).get('/api/v1/invoices').set('x-mock-role', role);
        expect(res.status).toBe(200);
      }
    });

    it('rejects unauthenticated requests (E)', async () => {
      const res = await request(app).get('/api/v1/invoices').set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
      expect(InvoicesService.listInvoices).not.toHaveBeenCalled();
    });

    it('rejects when password change is required (F)', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('x-mock-role', UserRole.STAFF)
        .set('x-mock-must-change-password', 'true');
      expect(res.status).toBe(403);
      expect(InvoicesService.listInvoices).not.toHaveBeenCalled();
    });

    it('rejects validation failures (H)', async () => {
      const invalidQueries = [
        '?page=0',
        '?limit=101',
        '?page=1.5',
        '?status=UNKNOWN_STATUS',
        '?clientId=not-a-uuid',
        '?invoiceDateFrom=invalid-date',
        '?invoiceDateFrom=2026-08-31&invoiceDateTo=2026-08-01', // From > To
        '?unknownKey=true',
      ];
      for (const query of invalidQueries) {
        const res = await request(app)
          .get(`/api/v1/invoices${query}`)
          .set('x-mock-role', UserRole.STAFF);
        expect(res.status).toBe(400);
      }
      expect(InvoicesService.listInvoices).not.toHaveBeenCalled();
    });

    it('allows future dates for filters (I)', async () => {
      const res = await request(app)
        .get('/api/v1/invoices?invoiceDateFrom=2030-01-01')
        .set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(200);
      expect(InvoicesService.listInvoices).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceDateFrom: '2030-01-01' }),
      );
    });
  });

  describe('GET /api/v1/invoices/:invoiceId', () => {
    const validId = '550e8400-e29b-41d4-a716-446655440001';

    it('returns 200 on success (J)', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedResponse);
      expect(InvoicesService.getInvoiceById).toHaveBeenCalledWith(validId);
      expect(InvoicesService.getInvoiceById).toHaveBeenCalledTimes(1);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN, STAFF, and VIEWER roles (K)', async () => {
      const roles = [UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER];
      for (const role of roles) {
        const res = await request(app).get(`/api/v1/invoices/${validId}`).set('x-mock-role', role);
        expect(res.status).toBe(200);
      }
    });

    it('rejects unauthenticated and password-change-required (L)', async () => {
      let res = await request(app).get(`/api/v1/invoices/${validId}`).set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
      res = await request(app)
        .get(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-mock-must-change-password', 'true');
      expect(res.status).toBe(403);
      expect(InvoicesService.getInvoiceById).not.toHaveBeenCalled();
    });

    it('rejects invalid UUID (M)', async () => {
      const res = await request(app)
        .get('/api/v1/invoices/not-a-uuid')
        .set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(400);
      expect(InvoicesService.getInvoiceById).not.toHaveBeenCalled();
    });

    it('propagates NotFoundError correctly (N)', async () => {
      vi.mocked(InvoicesService.getInvoiceById).mockRejectedValueOnce(
        new NotFoundError('Invoice not found'),
      );
      const res = await request(app)
        .get(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Invoice not found');
    });
  });

  describe('PUT /api/v1/invoices/:invoiceId', () => {
    const validId = '550e8400-e29b-41d4-a716-446655440001';

    it('returns 200 on success (O, AD)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedResponse);
      expect(InvoicesService.updateInvoice).toHaveBeenCalledTimes(1);
      expect(InvoicesService.updateInvoice).toHaveBeenCalledWith(
        'mock-user-id',
        validId,
        {
          ...validPayload,
          items: [{ ...validPayload.items[0], discountAmount: '0.00' }],
        },
        expect.any(Object),
      );
    });

    it('allows SUPER_ADMIN and STAFF roles (P)', async () => {
      const roles = [UserRole.SUPER_ADMIN, UserRole.STAFF];
      for (const role of roles) {
        const res = await request(app)
          .put(`/api/v1/invoices/${validId}`)
          .set('x-mock-role', role)
          .set('x-origin-verified', 'true')
          .set('x-csrf-verified', 'true')
          .send(validPayload);
        expect(res.status).toBe(200);
      }
    });

    it('rejects VIEWER role (Q)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.VIEWER)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(403);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests (R)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-auth', 'none')
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(401);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects when password change is required (S)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-mock-must-change-password', 'true')
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(403);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects without origin verification (T)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(401);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects without CSRF verification (U)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'false')
        .send(validPayload);
      expect(res.status).toBe(401);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects invalid UUID (V)', async () => {
      const res = await request(app)
        .put('/api/v1/invoices/not-a-uuid')
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(400);
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects strict body validation failures (W)', async () => {
      const invalidPayloads = [
        { ...validPayload, clientId: undefined },
        { ...validPayload, invoiceDate: undefined },
        { ...validPayload, items: undefined },
        { ...validPayload, items: [] },
        { ...validPayload, unknownField: true },
        { ...validPayload, status: 'DRAFT' },
      ];
      for (const invalid of invalidPayloads) {
        const res = await request(app)
          .put(`/api/v1/invoices/${validId}`)
          .set('x-mock-role', UserRole.STAFF)
          .set('x-origin-verified', 'true')
          .set('x-csrf-verified', 'true')
          .send(invalid);
        expect(res.status).toBe(400);
      }
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('rejects item validation failures (X)', async () => {
      const invalidItems = [
        [{ ...validPayload.items[0], description: undefined }],
        [{ ...validPayload.items[0], quantity: undefined }],
        [{ ...validPayload.items[0], rate: undefined }],
        [{ ...validPayload.items[0], gstRate: undefined }],
        [{ ...validPayload.items[0], unknownItemField: true }],
        [{ ...validPayload.items[0], id: 'server-owned-id' }],
        [{ ...validPayload.items[0], quantity: 'invalid-number' }],
      ];
      for (const items of invalidItems) {
        const res = await request(app)
          .put(`/api/v1/invoices/${validId}`)
          .set('x-mock-role', UserRole.STAFF)
          .set('x-origin-verified', 'true')
          .set('x-csrf-verified', 'true')
          .send({ ...validPayload, items });
        expect(res.status).toBe(400);
      }
      expect(InvoicesService.updateInvoice).not.toHaveBeenCalled();
    });

    it('handles future invoice date service error (Y)', async () => {
      vi.mocked(InvoicesService.updateInvoice).mockRejectedValueOnce(
        new ValidationError('invoiceDate cannot be in the future (Asia/Kolkata timezone)'),
      );
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ ...validPayload, invoiceDate: '2030-01-01' });
      expect(res.status).toBe(400);
    });

    it('propagates domain errors correctly (Z)', async () => {
      const errors = [
        { error: new NotFoundError('Invoice not found'), expectedStatus: 404 },
        { error: new NotFoundError('Business settings are not configured'), expectedStatus: 404 },
        { error: new ConflictError('Only DRAFT invoices can be modified'), expectedStatus: 409 },
        { error: new NotFoundError('Client not found'), expectedStatus: 404 },
        { error: new ConflictError('Cannot use an archived client'), expectedStatus: 409 },
      ];
      for (const { error, expectedStatus } of errors) {
        vi.mocked(InvoicesService.updateInvoice).mockRejectedValueOnce(error);
        const res = await request(app)
          .put(`/api/v1/invoices/${validId}`)
          .set('x-mock-role', UserRole.STAFF)
          .set('x-origin-verified', 'true')
          .set('x-csrf-verified', 'true')
          .send(validPayload);
        expect(res.status).toBe(expectedStatus);
      }
    });

    it('handles valid request with optional fields omitted (AA)', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${validId}`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send(validPayload);
      expect(res.status).toBe(200);
      expect(InvoicesService.updateInvoice).toHaveBeenCalledTimes(1);
    });
  });
});
