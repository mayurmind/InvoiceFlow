import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';
import { UnauthorizedError } from '../../src/errors/application.error';
import type { AuthContext } from '../../src/features/auth/auth.types';

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
      const mustChangePassword = req.headers['x-mock-auth'] === 'pwd-change-required';
      req.auth = createAuthContext(role, mustChangePassword);
      next();
    }),
  };
});

vi.mock('../../src/features/auth/csrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/csrf')>();
  return {
    ...actual,
    verifyCsrfToken: vi.fn((_sessionId: string, token: string) => {
      return token === 'mock-csrf-token';
    }),
  };
});

// Mock services to return success, so we isolate the security gates.
vi.mock('../../src/features/business-settings/business-settings.service', () => {
  const mockSettings = {
    id: 'settings-id',
    singletonKey: 1,
    legalName: 'My Business',
    displayName: 'My Business',
    gstin: null,
    pan: 'ABCDE1234F',
    addressLine1: 'HQ',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    email: null,
    phone: null,
    logoStorageKey: null,
    invoicePrefix: 'INV',
    defaultDueDays: 15,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
    upiId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    getBusinessSettings: vi.fn().mockResolvedValue(mockSettings),
    updateBusinessSettings: vi.fn().mockResolvedValue({ settings: mockSettings, created: false }),
  };
});

vi.mock('../../src/features/clients/clients.service', () => {
  const mockClient = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Client',
    email: 'jane@example.com',
    phone: '9876543210',
    gstin: null,
    pan: null,
    addressLine1: '123 Test St',
    addressLine2: null,
    city: 'Test City',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    notes: null,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    ClientsService: {
      listClients: vi.fn().mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
      getClientById: vi.fn().mockResolvedValue(mockClient),
      createClient: vi.fn().mockResolvedValue(mockClient),
      updateClient: vi.fn().mockResolvedValue(mockClient),
      archiveClient: vi.fn().mockResolvedValue({ ...mockClient, isArchived: true }),
      restoreClient: vi.fn().mockResolvedValue({ ...mockClient, isArchived: false }),
    },
  };
});

describe('Phase 4 Security Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validClientPayload = {
    name: 'Test Client',
    email: 'jane@example.com',
    phone: '9876543210',
    gstin: null,
    pan: null,
    addressLine1: '123 Test St',
    addressLine2: null,
    city: 'Test City',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    notes: null,
  };

  const validBusinessSettingsPayload = {
    legalName: 'My Business',
    displayName: 'My Business',
    gstin: null,
    pan: 'ABCDE1234F',
    addressLine1: 'HQ',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
    email: null,
    phone: null,
    logoStorageKey: null,
    invoicePrefix: 'INV',
    defaultDueDays: 15,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankIfsc: null,
    upiId: null,
  };

  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
  const CSRF_TOKEN = 'mock-csrf-token';

  const setAuth = (req: request.Test, role: UserRole, requiresPwdChange = false) => {
    return req
      .set('x-mock-role', role)
      .set('x-mock-auth', requiresPwdChange ? 'pwd-change-required' : 'valid-session');
  };

  const addCsrf = (req: request.Test) => {
    return req.set('x-csrf-token', CSRF_TOKEN).set('cookie', `csrf-token=${CSRF_TOKEN}`);
  };

  const p4Routes = [
    { method: 'get', path: '/api/v1/business-settings', isMutation: false },
    {
      method: 'put',
      path: '/api/v1/business-settings',
      isMutation: true,
      payload: validBusinessSettingsPayload,
    },
    { method: 'get', path: '/api/v1/clients', isMutation: false },
    { method: 'get', path: `/api/v1/clients/${VALID_UUID}`, isMutation: false },
    { method: 'post', path: '/api/v1/clients', isMutation: true, payload: validClientPayload },
    {
      method: 'put',
      path: `/api/v1/clients/${VALID_UUID}`,
      isMutation: true,
      payload: validClientPayload,
    },
    {
      method: 'post',
      path: `/api/v1/clients/${VALID_UUID}/archive`,
      isMutation: true,
      payload: {},
    },
    {
      method: 'post',
      path: `/api/v1/clients/${VALID_UUID}/restore`,
      isMutation: true,
      payload: {},
    },
  ];

  describe('PASSWORD CHANGE MATRIX', () => {
    p4Routes.forEach((route) => {
      it(`blocks ${route.method.toUpperCase()} ${route.path} if password change required`, async () => {
        type RequestFunction = (url: string) => request.Test;
        const methodMap = request(app) as unknown as Record<string, RequestFunction>;
        let req = methodMap[route.method](route.path);

        req = setAuth(req, UserRole.SUPER_ADMIN, true);

        if (route.isMutation) {
          req = req.set('Origin', 'http://localhost:3000');
          req = addCsrf(req);
          if (route.payload) {
            req = req.send(route.payload);
          }
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
      });
    });
  });

  describe('RBAC MATRIX', () => {
    it('Business Settings GET: SUPER_ADMIN allow, STAFF allow, VIEWER 403', async () => {
      let res = await setAuth(request(app).get('/api/v1/business-settings'), UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);

      res = await setAuth(request(app).get('/api/v1/business-settings'), UserRole.STAFF);
      expect(res.status).toBe(200);

      res = await setAuth(request(app).get('/api/v1/business-settings'), UserRole.VIEWER);
      expect(res.status).toBe(403);
    });

    it('Business Settings PUT: SUPER_ADMIN allow, STAFF 403, VIEWER 403', async () => {
      const getReq = (role: UserRole) =>
        addCsrf(
          setAuth(
            request(app).put('/api/v1/business-settings').set('Origin', 'http://localhost:3000'),
            role,
          ),
        ).send(validBusinessSettingsPayload);

      let res = await getReq(UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);

      res = await getReq(UserRole.STAFF);
      expect(res.status).toBe(403);

      res = await getReq(UserRole.VIEWER);
      expect(res.status).toBe(403);
    });

    it('Client list/detail: SUPER_ADMIN allow, STAFF allow, VIEWER allow', async () => {
      for (const role of [UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER]) {
        let res = await setAuth(request(app).get('/api/v1/clients'), role);
        expect(res.status).toBe(200);

        res = await setAuth(request(app).get(`/api/v1/clients/${VALID_UUID}`), role);
        expect(res.status).toBe(200);
      }
    });

    it('Client create/update/archive/restore: SUPER_ADMIN allow, STAFF allow, VIEWER 403', async () => {
      const routes = [
        { method: 'post', path: '/api/v1/clients', payload: validClientPayload },
        { method: 'put', path: `/api/v1/clients/${VALID_UUID}`, payload: validClientPayload },
        {
          method: 'post',
          path: `/api/v1/clients/${VALID_UUID}/archive`,
          payload: {},
        },
        {
          method: 'post',
          path: `/api/v1/clients/${VALID_UUID}/restore`,
          payload: {},
        },
      ];

      for (const route of routes) {
        type RequestFunction = (url: string) => request.Test;
        const methodMap = request(app) as unknown as Record<string, RequestFunction>;

        // SUPER_ADMIN
        let res = await setAuth(
          addCsrf(request(app)[route.method](route.path)),
          UserRole.SUPER_ADMIN,
        )
          .set('Origin', 'http://localhost:3000')
          .send(route.payload || {});
        expect(res.status).toBeGreaterThanOrEqual(200);
        expect(res.status).toBeLessThan(300);

        // STAFF
        res = await addCsrf(
          setAuth(
            methodMap[route.method](route.path).set('Origin', 'http://localhost:3000'),
            UserRole.STAFF,
          ),
        ).send(route.payload);
        expect(res.status).toBeGreaterThanOrEqual(200);
        expect(res.status).toBeLessThan(300);

        // VIEWER
        res = await addCsrf(
          setAuth(
            methodMap[route.method](route.path).set('Origin', 'http://localhost:3000'),
            UserRole.VIEWER,
          ),
        ).send(route.payload);
        expect(res.status).toBe(403);
      }
    });
  });

  describe('CLIENT ORIGIN SECURITY', () => {
    const mutatingRoutes = [
      { method: 'post', path: '/api/v1/clients', payload: validClientPayload },
      { method: 'put', path: `/api/v1/clients/${VALID_UUID}`, payload: validClientPayload },
      {
        method: 'post',
        path: `/api/v1/clients/${VALID_UUID}/archive`,
        payload: { action: 'ARCHIVE', reason: 'Test' },
      },
      {
        method: 'post',
        path: `/api/v1/clients/${VALID_UUID}/restore`,
        payload: { action: 'RESTORE', reason: 'Test' },
      },
    ];

    mutatingRoutes.forEach((route) => {
      it(`rejects malicious Origin for ${route.method.toUpperCase()} ${route.path}`, async () => {
        type RequestFunction = (url: string) => request.Test;
        const methodMap = request(app) as unknown as Record<string, RequestFunction>;
        const res = await addCsrf(
          setAuth(
            methodMap[route.method](route.path).set('Origin', 'http://evil.com'),
            UserRole.SUPER_ADMIN,
          ),
        ).send(route.payload);

        expect(res.status).toBe(401);
      });
    });
  });

  describe('CLIENT CSRF SECURITY', () => {
    const csrfRoutes = [
      { method: 'put', path: `/api/v1/clients/${VALID_UUID}`, payload: validClientPayload },
      {
        method: 'post',
        path: `/api/v1/clients/${VALID_UUID}/archive`,
        payload: { action: 'ARCHIVE', reason: 'Test' },
      },
      {
        method: 'post',
        path: `/api/v1/clients/${VALID_UUID}/restore`,
        payload: { action: 'RESTORE', reason: 'Test' },
      },
    ];

    csrfRoutes.forEach((route) => {
      it(`rejects missing CSRF token for ${route.method.toUpperCase()} ${route.path}`, async () => {
        type RequestFunction = (url: string) => request.Test;
        const methodMap = request(app) as unknown as Record<string, RequestFunction>;
        const res = await setAuth(
          methodMap[route.method](route.path).set('Origin', 'http://localhost:3000'),
          UserRole.SUPER_ADMIN,
        ).send(route.payload);

        expect(res.status).toBe(403);
      });

      it(`rejects invalid CSRF token for ${route.method.toUpperCase()} ${route.path}`, async () => {
        type RequestFunction = (url: string) => request.Test;
        const methodMap = request(app) as unknown as Record<string, RequestFunction>;
        const res = await setAuth(
          methodMap[route.method](route.path)
            .set('Origin', 'http://localhost:3000')
            .set('x-csrf-token', 'wrong-token')
            .set('cookie', `csrf-token=${CSRF_TOKEN}`),
          UserRole.SUPER_ADMIN,
        ).send(route.payload);

        expect(res.status).toBe(403);
      });
    });
  });

  describe('MASS ASSIGNMENT', () => {
    const invalidFields = [
      'id',
      'createdByUserId',
      'isArchived',
      'archivedAt',
      'createdAt',
      'updatedAt',
    ];

    invalidFields.forEach((field) => {
      it(`Client POST rejects server-owned field: ${field}`, async () => {
        const payload = { ...validClientPayload, [field]: 'injected-value' };
        const res = await addCsrf(
          setAuth(
            request(app).post('/api/v1/clients').set('Origin', 'http://localhost:3000'),
            UserRole.SUPER_ADMIN,
          ),
        ).send(payload);
        expect(res.status).toBe(400);
      });

      it(`Client PUT rejects server-owned field: ${field}`, async () => {
        const payload = { ...validClientPayload, [field]: 'injected-value' };
        const res = await addCsrf(
          setAuth(
            request(app)
              .put(`/api/v1/clients/${VALID_UUID}`)
              .set('Origin', 'http://localhost:3000'),
            UserRole.SUPER_ADMIN,
          ),
        ).send(payload);
        expect(res.status).toBe(400);
      });
    });

    const invalidSettingsFields = ['id', 'singletonKey', 'createdAt', 'updatedAt'];

    invalidSettingsFields.forEach((field) => {
      it(`Business Settings PUT rejects server-owned field: ${field}`, async () => {
        const payload = { ...validBusinessSettingsPayload, [field]: 'injected-value' };
        const res = await addCsrf(
          setAuth(
            request(app).put('/api/v1/business-settings').set('Origin', 'http://localhost:3000'),
            UserRole.SUPER_ADMIN,
          ),
        ).send(payload);
        expect(res.status).toBe(400);
      });
    });
  });

  describe('NO HARD DELETE', () => {
    it('Client DELETE API does not exist', async () => {
      const res = await addCsrf(
        setAuth(
          request(app)
            .delete(`/api/v1/clients/${VALID_UUID}`)
            .set('Origin', 'http://localhost:3000'),
          UserRole.SUPER_ADMIN,
        ),
      );

      expect(res.status).toBe(404);
    });
  });
});
