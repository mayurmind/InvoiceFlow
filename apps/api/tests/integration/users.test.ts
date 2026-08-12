import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';
import { verifyCsrfToken } from '../../src/features/auth/csrf';
import * as usersService from '../../src/features/users/users.service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../../src/errors/application.error';
import { ManagedUser } from '../../src/features/users/users.types';
import type { AuthContext } from '../../src/features/auth/auth.types';

const createAuthContext = (role: UserRole): AuthContext => ({
  sessionId: 'mock-session-id',
  user: {
    id: 'mock-user-id',
    email: 'mock@example.com',
    firstName: 'Mock',
    lastName: 'User',
    role,
    mustChangePassword: true,
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

vi.mock('../../src/features/users/users.service');

vi.mock('../../src/features/auth/auth.middleware', () => ({
  authenticateRequest: vi.fn((req, _res, next) => {
    if (req.headers['x-mock-auth'] === 'none') {
      return next(new UnauthorizedError());
    }
    const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
    req.auth = createAuthContext(role);
    next();
  }),
}));

describe('Users HTTP Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCsrfToken).mockReset();
    vi.mocked(verifyCsrfToken).mockReturnValue(true);
  });

  const mockUser: ManagedUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Test',
    role: UserRole.STAFF,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/v1/users', () => {
    it('unauth 401', async () => {
      const res = await request(app).get('/api/v1/users').set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
    });

    it('STAFF 403', async () => {
      const res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(403);
    });

    it('VIEWER 403', async () => {
      const res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.VIEWER);
      expect(res.status).toBe(403);
    });

    it('admin 200 with defaults', async () => {
      vi.mocked(usersService.listUsers).mockResolvedValue({
        users: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      });

      const res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.pagination.offset).toBe(0);
      expect(usersService.listUsers).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
    });

    it('explicit limit/offset, role, isActive true/false', async () => {
      vi.mocked(usersService.listUsers).mockResolvedValue({
        users: [],
        pagination: { limit: 50, offset: 10, total: 0 },
      });

      const res = await request(app)
        .get('/api/v1/users?limit=50&offset=10&role=STAFF&isActive=true')
        .set('x-mock-role', UserRole.SUPER_ADMIN);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(50);
      expect(res.body.pagination.offset).toBe(10);
      expect(usersService.listUsers).toHaveBeenCalledWith({
        limit: 50,
        offset: 10,
        role: UserRole.STAFF,
        isActive: true,
      });

      await request(app)
        .get('/api/v1/users?isActive=false')
        .set('x-mock-role', UserRole.SUPER_ADMIN);

      expect(usersService.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('invalid limit', async () => {
      const res = await request(app)
        .get('/api/v1/users?limit=-1')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('invalid offset', async () => {
      const res = await request(app)
        .get('/api/v1/users?offset=-1')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('unsafe offset', async () => {
      const res = await request(app)
        .get('/api/v1/users?offset=9007199254740992')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('invalid boolean', async () => {
      const res = await request(app)
        .get('/api/v1/users?isActive=yes')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('unknown query', async () => {
      const res = await request(app)
        .get('/api/v1/users?hacked=1')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('safe JSON', async () => {
      vi.mocked(usersService.listUsers).mockResolvedValue({
        users: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      });
      const res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
    });
  });

  describe('GET /api/v1/users/:userId', () => {
    it('unauth 401', async () => {
      const res = await request(app).get('/api/v1/users/uuid').set('x-mock-auth', 'none');
      expect(res.status).toBe(401);
    });

    it('STAFF 403', async () => {
      const res = await request(app).get('/api/v1/users/uuid').set('x-mock-role', UserRole.STAFF);
      expect(res.status).toBe(403);
    });

    it('VIEWER 403', async () => {
      const res = await request(app).get('/api/v1/users/uuid').set('x-mock-role', UserRole.VIEWER);
      expect(res.status).toBe(403);
    });

    it('malformed UUID 400', async () => {
      const res = await request(app)
        .get('/api/v1/users/not-uuid')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(400);
    });

    it('missing 404', async () => {
      vi.mocked(usersService.getUser).mockRejectedValue(new NotFoundError());
      const res = await request(app)
        .get('/api/v1/users/550e8400-e29b-41d4-a716-446655440000')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(404);
    });

    it('admin 200, no passwordHash', async () => {
      vi.mocked(usersService.getUser).mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/users/550e8400-e29b-41d4-a716-446655440000')
        .set('x-mock-role', UserRole.SUPER_ADMIN);
      expect(res.status).toBe(200);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /api/v1/users', () => {
    const validBody = {
      email: ' NEW@Example.com ',
      firstName: ' First ',
      lastName: ' Last ',
      role: UserRole.STAFF,
      temporaryPassword: 'StrongPassword123!',
    };

    it('missing origin 401', async () => {
      const res = await request(app).post('/api/v1/users').send(validBody);
      expect(res.status).toBe(401);
    });

    it('disallowed origin 401', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://hacker.com')
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('unauth with valid origin 401', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-auth', 'none')
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('STAFF 403', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.STAFF)
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('VIEWER 403', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.VIEWER)
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('missing CSRF 403', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('invalid CSRF 403', async () => {
      vi.mocked(verifyCsrfToken).mockReturnValueOnce(false);
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'invalid')
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('duplicate raw X-CSRF-Token 403', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', ['token1', 'token2'])
        .send(validBody);
      expect(res.status).toBe(403); // The middleware requireCsrfToken counts occurrences in rawHeaders
    });

    it('STAFF create 201, normalized email, trimmed names, no passwordHash/temporary response', async () => {
      vi.mocked(usersService.provisionUser).mockResolvedValue({
        ...mockUser,
        email: 'new@example.com',
        firstName: 'First',
        lastName: 'Last',
      });

      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body.user.firstName).toBe('First');
      expect(res.body.user.temporaryPassword).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('VIEWER create 201', async () => {
      vi.mocked(usersService.provisionUser).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });

      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, role: UserRole.VIEWER });
      expect(res.status).toBe(201);
    });

    it('SUPER_ADMIN payload 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, role: UserRole.SUPER_ADMIN });
      expect(res.status).toBe(400);
    });

    it('passwordHash injection 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, passwordHash: 'injected' });
      expect(res.status).toBe(400);
    });

    it('isActive injection 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, isActive: false });
      expect(res.status).toBe(400);
    });

    it('mustChangePassword injection 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, mustChangePassword: false });
      expect(res.status).toBe(400);
    });

    it('short password 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, temporaryPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('>128 password 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ ...validBody, temporaryPassword: 'A'.repeat(129) });
      expect(res.status).toBe(400);
    });

    it('duplicate email 409', async () => {
      vi.mocked(usersService.provisionUser).mockRejectedValueOnce(new ConflictError());

      const res = await request(app)
        .post('/api/v1/users')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send(validBody);
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/users/:userId/role', () => {
    const validBody = { role: UserRole.VIEWER };

    it('missing/disallowed origin', async () => {
      const res = await request(app).patch('/api/v1/users/uuid/role').send(validBody);
      expect(res.status).toBe(401);
    });

    it('unauth', async () => {
      const res = await request(app)
        .patch('/api/v1/users/uuid/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-auth', 'none')
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('STAFF/VIEWER denial', async () => {
      const res = await request(app)
        .patch('/api/v1/users/uuid/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.STAFF)
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('missing CSRF 403', async () => {
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('invalid CSRF 403', async () => {
      vi.mocked(verifyCsrfToken).mockReturnValueOnce(false);
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'invalid')
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('duplicate raw CSRF 403', async () => {
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', ['token1', 'token2'])
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('malformed UUID', async () => {
      const res = await request(app)
        .patch('/api/v1/users/bad-uuid/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send(validBody);
      expect(res.status).toBe(400);
    });

    it('SUPER_ADMIN destination payload 400', async () => {
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ role: UserRole.SUPER_ADMIN });
      expect(res.status).toBe(400);
    });

    it('missing target 404', async () => {
      vi.mocked(usersService.updateUserRole).mockRejectedValue(new NotFoundError());
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send(validBody);
      expect(res.status).toBe(404);
    });

    it('existing target SUPER_ADMIN 403', async () => {
      vi.mocked(usersService.updateUserRole).mockRejectedValue(new ForbiddenError());
      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send(validBody);
      expect(res.status).toBe(403);
    });

    it('STAFF -> VIEWER', async () => {
      vi.mocked(usersService.updateUserRole).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });

      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ role: UserRole.VIEWER });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(UserRole.VIEWER);
    });

    it('VIEWER -> STAFF', async () => {
      vi.mocked(usersService.updateUserRole).mockResolvedValue({
        ...mockUser,
        role: UserRole.STAFF,
      });

      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ role: UserRole.STAFF });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(UserRole.STAFF);
    });

    it('same-role 200/no-op', async () => {
      vi.mocked(usersService.updateUserRole).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });

      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ role: UserRole.VIEWER });
      expect(res.status).toBe(200);
    });

    it('safe JSON', async () => {
      vi.mocked(usersService.updateUserRole).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });

      const res = await request(app)
        .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
        .set('Origin', 'http://localhost:3000')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-csrf-token', 'mock-csrf')
        .send({ role: UserRole.VIEWER });
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
    });
  });
});
