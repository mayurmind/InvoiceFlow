import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';
import { verifyCsrfToken } from '../../src/features/auth/csrf';
import * as service from '../../src/features/business-settings/business-settings.service';
import { UnauthorizedError } from '../../src/errors/application.error';
import type { AuthContext } from '../../src/features/auth/auth.types';
import { NotFoundError } from '../../src/errors/application.error';

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

vi.mock('../../src/features/auth/csrf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/features/auth/csrf')>();
  return {
    ...mod,
    verifyCsrfToken: vi.fn().mockReturnValue(true),
  };
});

vi.mock('../../src/features/business-settings/business-settings.service');

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

describe('Business Settings API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCsrfToken).mockReset();
    vi.mocked(verifyCsrfToken).mockReturnValue(true);
  });

  const validPayload = {
    legalName: 'Integration Legal Name',
    displayName: 'Integration Display Name',
    addressLine1: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    invoicePrefix: 'INV',
    defaultDueDays: 30,
  };

  const mockSettings = {
    id: 'test-id',
    ...validPayload,
    gstin: null,
    pan: null,
    addressLine2: null,
    email: null,
    phone: null,
    logoStorageKey: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
    upiId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/v1/business-settings', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/business-settings')
        .set('x-mock-auth', 'none');
      expect(response.status).toBe(401);
    });

    it('returns 403 for VIEWER', async () => {
      const response = await request(app)
        .get('/api/v1/business-settings')
        .set('x-mock-role', UserRole.VIEWER);
      expect(response.status).toBe(403);
    });

    it('returns 404 for SUPER_ADMIN when not configured', async () => {
      vi.mocked(service.getBusinessSettings).mockRejectedValue(new NotFoundError('Not found'));

      const response = await request(app)
        .get('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(response.status).toBe(404);
    });

    it('returns 200 and settings when configured', async () => {
      vi.mocked(service.getBusinessSettings).mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(response.status).toBe(200);
      expect(response.body.settings.legalName).toBe(mockSettings.legalName);
    });
  });

  describe('PUT /api/v1/business-settings', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-auth', 'none')
        .send(validPayload);
      expect(response.status).toBe(401);
    });

    it('returns 403 for STAFF', async () => {
      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.STAFF)
        .set('X-CSRF-Token', 'valid-token')
        .set('Origin', 'http://localhost:3000')
        .send(validPayload);

      expect(response.status).toBe(403);
    });

    it('returns 403 when CSRF is missing', async () => {
      vi.mocked(verifyCsrfToken).mockReturnValue(false);

      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('Origin', 'http://localhost:3000')
        .send(validPayload);

      expect(response.status).toBe(403);
    });

    it('returns 401 when Origin is invalid', async () => {
      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('X-CSRF-Token', 'valid-token')
        .set('Origin', 'http://malicious.com')
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('returns 201 for first-time configuration by SUPER_ADMIN', async () => {
      vi.mocked(service.updateBusinessSettings).mockResolvedValue({
        settings: mockSettings,
        created: true,
      });

      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('X-CSRF-Token', 'valid-token')
        .set('Origin', 'http://localhost:3000')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.settings.legalName).toBe(validPayload.legalName);
    });

    it('returns 200 for subsequent updates by SUPER_ADMIN', async () => {
      vi.mocked(service.updateBusinessSettings).mockResolvedValue({
        settings: mockSettings,
        created: false,
      });

      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('X-CSRF-Token', 'valid-token')
        .set('Origin', 'http://localhost:3000')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body.settings.legalName).toBe(validPayload.legalName);
    });

    it('rejects payload with extra unknown fields', async () => {
      const response = await request(app)
        .put('/api/v1/business-settings')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('X-CSRF-Token', 'valid-token')
        .set('Origin', 'http://localhost:3000')
        .send({ ...validPayload, injectedField: 'HACK' });

      expect(response.status).toBe(400);
    });
  });
});
