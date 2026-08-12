import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';
import { verifyCsrfToken } from '../../src/features/auth/csrf';
import { UnauthorizedError } from '../../src/errors/application.error';
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

vi.mock('../../src/features/auth/auth.middleware', () => ({
  authenticateRequest: vi.fn((req, _res, next) => {
    if (req.headers['x-mock-auth'] === 'none') {
      return next(new UnauthorizedError());
    }
    const role = (req.headers['x-mock-role'] as UserRole) || UserRole.STAFF;
    req.auth = createAuthContext(role);
    next();
  }),
}));

// We mock the user service to bypass database logic,
// because we are only testing RBAC middleware security boundaries.
vi.mock('../../src/features/users/users.service');

describe('RBAC Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCsrfToken).mockReturnValue(true);
  });

  const provisionPayload = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Test',
    role: UserRole.STAFF,
    temporaryPassword: 'StrongPassword123!',
  };

  it('STAFF/VIEWER enumeration denial', async () => {
    let res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.STAFF);
    expect(res.status).toBe(403);
    res = await request(app).get('/api/v1/users').set('x-mock-role', UserRole.VIEWER);
    expect(res.status).toBe(403);
  });

  it('STAFF/VIEWER create denial', async () => {
    let res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.STAFF)
      .set('x-csrf-token', 'mock-csrf')
      .send(provisionPayload);
    expect(res.status).toBe(403);

    res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.VIEWER)
      .set('x-csrf-token', 'mock-csrf')
      .send(provisionPayload);
    expect(res.status).toBe(403);
  });

  it('STAFF/VIEWER role-mutation denial', async () => {
    let res = await request(app)
      .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.STAFF)
      .set('x-csrf-token', 'mock-csrf')
      .send({ role: UserRole.VIEWER });
    expect(res.status).toBe(403);

    res = await request(app)
      .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.VIEWER)
      .set('x-csrf-token', 'mock-csrf')
      .send({ role: UserRole.STAFF });
    expect(res.status).toBe(403);
  });

  it('cannot create SUPER_ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-csrf-token', 'mock-csrf')
      .send({ ...provisionPayload, role: UserRole.SUPER_ADMIN });
    expect(res.status).toBe(400); // Schema rejection
  });

  it('cannot promote to SUPER_ADMIN', async () => {
    const res = await request(app)
      .patch('/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-csrf-token', 'mock-csrf')
      .send({ role: UserRole.SUPER_ADMIN });
    expect(res.status).toBe(400); // Schema rejection
  });

  it('forged role header ignored', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('x-mock-role', UserRole.VIEWER) // This mocks what the auth middleware extracts from JWT
      .set('role', UserRole.SUPER_ADMIN); // This is the forged header
    expect(res.status).toBe(403); // Fails because auth middleware says VIEWER
  });

  it('forged role query ignored', async () => {
    const res = await request(app)
      .get('/api/v1/users?role=SUPER_ADMIN')
      .set('x-mock-role', UserRole.VIEWER);
    expect(res.status).toBe(403);
  });

  it('passwordHash/isActive/mustChangePassword injection', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-csrf-token', 'mock-csrf')
      .send({
        ...provisionPayload,
        passwordHash: 'injected',
        isActive: false,
        mustChangePassword: false,
      });
    expect(res.status).toBe(400); // Schema rejection
  });

  it('Origin/CSRF protections', async () => {
    vi.mocked(verifyCsrfToken).mockReturnValueOnce(false);
    let res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-csrf-token', 'invalid')
      .send(provisionPayload);
    expect(res.status).toBe(403); // CSRF blocks

    res = await request(app)
      .post('/api/v1/users')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .set('x-csrf-token', 'mock-csrf')
      .send(provisionPayload);
    expect(res.status).toBe(401); // Origin blocks before CSRF
  });
});
