import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../../src/app';
import { UserRole } from '../../../src/generated/prisma/client';

vi.mock('../../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn((req: Request & { auth?: unknown }, _res: Response, next: NextFunction) => {
      const role = req.headers['x-mock-role'];
      if (!role) {
        return actual.authenticateRequest(req, _res, next);
      }
      req.auth = {
        sessionId: 'test-session',
        user: { 
          id: 'test-user', 
          email: 'test@example.com', 
          firstName: 'Test',
          lastName: 'User',
          role, 
          mustChangePassword: false,
          lastLoginAt: null
        }
      };
      return next();
    }),
  };
});

vi.mock('../../../src/features/audit/audit.service', () => ({
  AuditService: {
    listAuditLogs: vi.fn().mockResolvedValue({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      data: [
        {
          id: 'audit-id',
          action: 'LOGIN',
          entityType: 'User',
        }
      ]
    }),
  },
}));

describe('Audit Integration - GET /api/v1/audit', () => {
  it('returns 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/v1/audit');
    expect(res.status).toBe(401);
  });

  it('returns 403 if authenticated but not SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('x-mock-role', UserRole.STAFF);
    expect(res.status).toBe(403);
  });

  it('returns 200 with audit logs for SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('x-mock-role', UserRole.SUPER_ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 1,
      data: expect.any(Array)
    });
    expect(res.body.data[0].action).toBe('LOGIN');
  });

  it('validates query parameters', async () => {
    const res = await request(app)
      .get('/api/v1/audit?page=invalid')
      .set('x-mock-role', UserRole.SUPER_ADMIN);

    expect(res.status).toBe(400);
  });
});
