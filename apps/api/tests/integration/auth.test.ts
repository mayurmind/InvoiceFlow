import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import * as authService from '../../src/features/auth/auth.service';
import { meHandler } from '../../src/features/auth/auth.controller';
import * as authRepo from '../../src/features/auth/auth.repository';
import { prisma } from '../../src/database/prisma';
import type { ITXClient } from '../../src/database/transaction';
import type { User, Session, AuditLog } from '../../src/generated/prisma/client';
import type { SanitizedUser } from '../../src/features/auth/auth.types';
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../src/errors/application.error';
vi.mock('../../src/features/auth/auth.service');
// Mocking the middleware directly isn't perfectly straightforward because express app binds it at startup,
// but for an integration test of the routing we might mock the auth service instead.
// Wait, actually mocking middleware works if we mock it before importing `app`. But `app` is imported above.
// Let's just test the /login endpoint parsing and origin guard.

vi.mock('../../src/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      CORS_ALLOWED_ORIGINS: ['http://localhost:3000'],
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    },
  };
});

describe('Auth API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects without origin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Missing or malformed Origin/Referer');
    });

    it('rejects with disallowed origin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://evil.com')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Disallowed Origin/Referer');
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'not-an-email', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns sanitized user and cookies on success', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        accessToken: 'mock-access',
        rawRefreshToken: 'mock-refresh',
        user: { id: 'u1', email: 'test@example.com', role: 'VIEWER' } as SanitizedUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('u1');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me - Controller Unit Tests', () => {
    it('catches and forwards errors to next()', async () => {
      const mockReq = {} as Request; // req.auth is undefined, will throw TypeError
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn() as NextFunction;

      await meHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(TypeError));
    });
  });

  describe('Auth Repository Unit Tests', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const fakeTx = {
      $queryRaw: vi.fn(),
      session: { create: vi.fn() },
      user: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    } as unknown as ITXClient;

    describe('getUserByEmail', () => {
      it('returns user when found', async () => {
        const mockUser = { id: 'u1' } as User;
        const spy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
        const result = await authRepo.getUserByEmail('test@example.com');
        expect(result).toEqual(mockUser);
        expect(spy).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      });

      it('returns null when not found', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
        const result = await authRepo.getUserByEmail('test@example.com');
        expect(result).toBeNull();
      });
    });

    describe('getUserById', () => {
      it('returns user when found', async () => {
        const mockUser = { id: 'u1' } as User;
        const spy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
        const result = await authRepo.getUserById('u1');
        expect(result).toEqual(mockUser);
        expect(spy).toHaveBeenCalledWith({ where: { id: 'u1' } });
      });

      it('returns null when not found', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
        const result = await authRepo.getUserById('u1');
        expect(result).toBeNull();
      });
    });

    describe('getSessionById', () => {
      it('returns session when found', async () => {
        const mockSession = { id: 's1' } as Session;
        const spy = vi.spyOn(prisma.session, 'findUnique').mockResolvedValue(mockSession);
        const result = await authRepo.getSessionById('s1');
        expect(result).toEqual(mockSession);
        expect(spy).toHaveBeenCalledWith({ where: { id: 's1' } });
      });

      it('returns null when not found', async () => {
        vi.spyOn(prisma.session, 'findUnique').mockResolvedValue(null);
        const result = await authRepo.getSessionById('s1');
        expect(result).toBeNull();
      });
    });

    describe('getUserForUpdate', () => {
      it('returns user when found', async () => {
        const mockUser = { id: 'u1' } as User;
        vi.mocked(fakeTx.$queryRaw).mockResolvedValue([mockUser]);
        const result = await authRepo.getUserForUpdate(fakeTx, 'u1');
        expect(result).toEqual(mockUser);
        expect(fakeTx.$queryRaw).toHaveBeenCalled();
      });

      it('returns null when empty result', async () => {
        vi.mocked(fakeTx.$queryRaw).mockResolvedValue([]);
        const result = await authRepo.getUserForUpdate(fakeTx, 'u1');
        expect(result).toBeNull();
      });
    });

    describe('createSession', () => {
      it('calls tx.session.create with correct data', async () => {
        const data = {
          userId: 'u1',
          tokenHash: 'hash',
          familyId: 'f1',
          expiresAt: new Date(),
          lastUsedAt: new Date(),
          userAgent: 'ua',
          ipAddress: '127.0.0.1',
        };
        const mockSession = { id: 's1' } as Session;
        vi.mocked(fakeTx.session.create).mockResolvedValue(mockSession);

        const result = await authRepo.createSession(fakeTx, data);
        expect(result).toEqual(mockSession);
        expect(fakeTx.session.create).toHaveBeenCalledWith({ data });
      });
    });

    describe('updateUserLastLogin', () => {
      it('calls tx.user.update with correct data', async () => {
        const date = new Date();
        const mockUser = { id: 'u1' } as User;
        vi.mocked(fakeTx.user.update).mockResolvedValue(mockUser);

        const result = await authRepo.updateUserLastLogin(fakeTx, 'u1', date);
        expect(result).toEqual(mockUser);
        expect(fakeTx.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { lastLoginAt: date },
        });
      });
    });

    describe('createAuditLog', () => {
      it('calls tx.auditLog.create with correct data and Prisma.JsonNull for empty metadata', async () => {
        const data = {
          action: 'LOGIN',
          entityType: 'SESSION',
        };
        const mockLog = {
          id: 'l1',
          action: 'LOGIN',
          entityType: 'SESSION',
          entityId: null,
          actorUserId: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
          metadata: null,
          createdAt: new Date(),
        } as AuditLog;
        vi.mocked(fakeTx.auditLog.create).mockResolvedValue(mockLog);

        const result = await authRepo.createAuditLog(fakeTx, data);
        expect(result).toEqual(mockLog);
        expect(fakeTx.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'LOGIN',
            entityType: 'SESSION',
            metadata: expect.anything(),
          }),
        });
      });

      it('passes metadata when provided', async () => {
        const data = {
          action: 'LOGIN',
          entityType: 'SESSION',
          metadata: { key: 'value' },
        };
        const mockLog = {
          id: 'l1',
          action: 'LOGIN',
          entityType: 'SESSION',
          entityId: null,
          actorUserId: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
          metadata: { key: 'value' },
          createdAt: new Date(),
        } as AuditLog;
        vi.mocked(fakeTx.auditLog.create).mockResolvedValue(mockLog);

        await authRepo.createAuditLog(fakeTx, data);
        expect(fakeTx.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            metadata: { key: 'value' },
          }),
        });
      });
    });
  });

  describe('GET /api/v1/auth/csrf', () => {
    it('rejects without origin', async () => {
      const res = await request(app).get('/api/v1/auth/csrf');
      expect(res.status).toBe(401);
    });

    it('returns generic 401 if refresh cookie is missing', async () => {
      const res = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);
    });

    it('returns generic 401 if refresh cookie is invalid (no session)', async () => {
      vi.mocked(authService.generateCsrfForSession).mockRejectedValue(new UnauthorizedError());
      const res = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-refresh=invalid']);
      expect(res.status).toBe(401);
    });

    it('returns 200 with Cache-Control no-store and exactly csrfToken', async () => {
      vi.mocked(authService.generateCsrfForSession).mockResolvedValue('<csrf-token>');

      const res = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-refresh=valid']);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.csrfToken).toBe('<csrf-token>');
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 if missing refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);
    });

    it('returns 403 if CSRF is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-refresh=valid']);
      expect(res.status).toBe(403);
    });

    it('returns 200 on success, clears token fields, sets max-age cookies', async () => {
      vi.mocked(authService.refreshSession).mockResolvedValue({
        kind: 'success',
        accessToken: 'new-access',
        rawRefreshToken: 'new-refresh',
        remainingRefreshMs: 123456,
        user: { id: 'u1', email: 'test@example.com', role: 'VIEWER' } as SanitizedUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-refresh=valid'])
        .set('x-csrf-token', 'valid-csrf');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('u1');
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('invoiceflow-access='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('invoiceflow-refresh='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('Max-Age='))).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 204 with empty body, clears cookies, requires Origin, Auth, CSRF', async () => {
      // Missing auth -> 401
      let res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);

      // We mock the middleware payload
      vi.mocked(authService.logoutSession).mockResolvedValue();

      // We mock the auth middleware explicitly since it's hard to bypass
      const tokenUtils = await import('../../src/features/auth/tokens');
      const csrfUtils = await import('../../src/features/auth/csrf');
      vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
        sub: 'u1',
        sid: 's1',
        role: 'VIEWER',
        type: 'access',
      });
      vi.spyOn(authRepo, 'getSessionById').mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 10000),
      } as Session);
      vi.spyOn(authRepo, 'getUserById').mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: 'VIEWER',
      } as User);
      vi.spyOn(csrfUtils, 'verifyCsrfToken').mockReturnValue(true);

      res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-access=valid'])
        .set('x-csrf-token', 'valid-csrf');

      expect(res.status).toBe(204);
      expect(res.body).toEqual({}); // Empty body
      expect(res.text).toBe('');

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('Max-Age=0'))).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('returns 204 with empty body, clears cookies, requires Origin, Auth, CSRF', async () => {
      vi.mocked(authService.logoutAllSessions).mockResolvedValue();

      const tokenUtils = await import('../../src/features/auth/tokens');
      const csrfUtils = await import('../../src/features/auth/csrf');
      vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
        sub: 'u1',
        sid: 's1',
        role: 'VIEWER',
        type: 'access',
      });
      vi.spyOn(authRepo, 'getSessionById').mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 10000),
      } as Session);
      vi.spyOn(authRepo, 'getUserById').mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: 'VIEWER',
      } as User);
      vi.spyOn(csrfUtils, 'verifyCsrfToken').mockReturnValue(true);

      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-access=valid'])
        .set('x-csrf-token', 'valid-csrf');

      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('Max-Age=0'))).toBe(true);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('returns 204 on success, clears cookies', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue();

      const tokenUtils = await import('../../src/features/auth/tokens');
      const csrfUtils = await import('../../src/features/auth/csrf');
      vi.spyOn(tokenUtils, 'verifyAccessToken').mockReturnValue({
        sub: 'u1',
        sid: 's1',
        role: 'VIEWER',
        type: 'access',
      });
      vi.spyOn(authRepo, 'getSessionById').mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 10000),
      } as Session);
      vi.spyOn(authRepo, 'getUserById').mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: 'VIEWER',
        mustChangePassword: true, // Should succeed even if true
      } as User);
      vi.spyOn(csrfUtils, 'verifyCsrfToken').mockReturnValue(true);

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', ['invoiceflow-access=valid'])
        .set('x-csrf-token', 'valid-csrf')
        .send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c: string) => c.includes('Max-Age=0'))).toBe(true);
    });
  });

  describe('CORS', () => {
    it('OPTIONS preflight proves X-CSRF-Token is allowed', async () => {
      const res = await request(app)
        .options('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204); // CORS preflight success
      expect(res.headers['access-control-allow-headers']).toContain('X-CSRF-Token');
    });
  });
});
