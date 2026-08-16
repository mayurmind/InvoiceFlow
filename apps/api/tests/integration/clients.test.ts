import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

/** Type-safe property omitter — avoids unused destructuring warnings. */
function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete (result as Record<string, unknown>)[key as string];
  return result as Omit<T, K>;
}

// This file mocks out the service layer to perform pure HTTP/Middleware integration tests.
// A full db-backed test is in the database integration suite.

vi.mock('../../src/features/clients/clients.service', () => {
  return {
    ClientsService: {
      createClient: vi.fn(),
      getClientById: vi.fn(),
      updateClient: vi.fn(),
      listClients: vi.fn(),
      archiveClient: vi.fn(),
      restoreClient: vi.fn(),
    },
  };
});

import { ClientsService } from '../../src/features/clients/clients.service';
import { UnauthorizedError } from '../../src/errors/application.error';
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

vi.mock('../../src/features/auth/csrf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/features/auth/csrf')>();
  return {
    ...mod,
    verifyCsrfToken: vi.fn().mockReturnValue(true),
  };
});

import { verifyCsrfToken } from '../../src/features/auth/csrf';

describe('Clients API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCsrfToken).mockReturnValue(true);
  });

  const validPayload = {
    name: 'Test',
    addressLine1: 'Line',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400001',
    country: 'India',
  };

  describe('GET /api/v1/clients', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get('/api/v1/clients').set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
    });

    it('should allow SUPER_ADMIN', async () => {
      vi.mocked(ClientsService.listClients).mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      const res = await request(app)
        .get('/api/v1/clients')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);
    });

    it('should allow STAFF', async () => {
      vi.mocked(ClientsService.listClients).mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      const res = await request(app).get('/api/v1/clients').set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(200);
    });

    it('should allow VIEWER', async () => {
      vi.mocked(ClientsService.listClients).mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
      const res = await request(app).get('/api/v1/clients').set('x-mock-role', UserRole.VIEWER);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/clients', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).post('/api/v1/clients').set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
    });

    it('should forbid VIEWER', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.VIEWER)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send(validPayload);
      expect(res.status).toBe(403);
    });

    it('should require CSRF token', async () => {
      vi.mocked(verifyCsrfToken).mockReturnValue(false);

      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .send(validPayload);
      expect(res.status).toBe(403);
    });

    it('should reject invalid body (missing required fields)', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send({ unknown: 123 });
      expect(res.status).toBe(400);
    });

    it('should reject invalid state/stateCode pair', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send({ ...validPayload, state: 'Karnataka', stateCode: '27' }); // mismatch
      expect(res.status).toBe(400);
    });

    it('should reject missing country', async () => {
      const withoutCountry = omit(validPayload, 'country');
      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send(withoutCountry);
      expect(res.status).toBe(400);
    });

    it('should allow STAFF with valid payload', async () => {
      vi.mocked(ClientsService.createClient).mockResolvedValue({
        id: '123',
      } as unknown as import('../../src/features/clients/clients.types').ClientResponse);
      const res = await request(app)
        .post('/api/v1/clients')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send(validPayload);
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/v1/clients/:id', () => {
    it('should reject invalid UUID', async () => {
      const res = await request(app)
        .put('/api/v1/clients/invalid-uuid')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send(validPayload);
      expect(res.status).toBe(400);
    });

    it('should allow SUPER_ADMIN', async () => {
      vi.mocked(ClientsService.updateClient).mockResolvedValue({
        id: '123',
      } as unknown as import('../../src/features/clients/clients.types').ClientResponse);
      const res = await request(app)
        .put('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send(validPayload);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/clients/:id', () => {
    it('should return 404 for unknown client', async () => {
      const { NotFoundError } = await import('../../src/errors/application.error');
      vi.mocked(ClientsService.getClientById).mockRejectedValue(new NotFoundError('Not found'));
      const res = await request(app)
        .get('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(404);
    });

    it('should return 200 when found', async () => {
      vi.mocked(ClientsService.getClientById).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
      } as unknown as import('../../src/features/clients/clients.types').ClientResponse);
      const res = await request(app)
        .get('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/clients/:id/archive', () => {
    it('should reject invalid UUID', async () => {
      const res = await request(app)
        .post('/api/v1/clients/invalid-uuid/archive')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(400);
    });

    it('should deny VIEWER', async () => {
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/archive')
        .set('x-mock-role', UserRole.VIEWER)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(403);
    });

    it('should reject unexpected body', async () => {
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/archive')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf')
        .send({ unexpected: true });
      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown client', async () => {
      const { NotFoundError } = await import('../../src/errors/application.error');
      vi.mocked(ClientsService.archiveClient).mockRejectedValue(new NotFoundError('Not found'));
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/archive')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(404);
    });

    it('should allow SUPER_ADMIN and return 200', async () => {
      vi.mocked(ClientsService.archiveClient).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        isArchived: true,
      } as unknown as import('../../src/features/clients/clients.types').ClientResponse);
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/archive')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(200);
      expect(res.body.isArchived).toBe(true);
    });
  });

  describe('POST /api/v1/clients/:id/restore', () => {
    it('should deny VIEWER', async () => {
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/restore')
        .set('x-mock-role', UserRole.VIEWER)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(403);
    });

    it('should allow STAFF and return 200', async () => {
      vi.mocked(ClientsService.restoreClient).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        isArchived: false,
      } as unknown as import('../../src/features/clients/clients.types').ClientResponse);
      const res = await request(app)
        .post('/api/v1/clients/123e4567-e89b-12d3-a456-426614174000/restore')
        .set('x-mock-role', UserRole.STAFF)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'mock-csrf');
      expect(res.status).toBe(200);
      expect(res.body.isArchived).toBe(false);
    });
  });
});
