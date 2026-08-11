import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { Writable } from 'stream';
import { loggerOptions } from '../../src/utilities/logger';
import request from 'supertest';
import { app } from '../../src/app';
import * as authRepo from '../../src/features/auth/auth.repository';
import * as passwordUtils from '../../src/features/auth/password';
import * as tokensUtils from '../../src/features/auth/tokens';
import * as transactionUtils from '../../src/database/transaction';
import type { ITXClient } from '../../src/database/transaction';
import type { User, Session, AuditLog } from '../../src/generated/prisma/client';

vi.mock('../../src/features/auth/auth.repository');
vi.mock('../../src/features/auth/password');
vi.mock('../../src/features/auth/tokens');
vi.mock('../../src/database/transaction');

// We also need to mock env for allowed origins
vi.mock('../../src/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      CORS_ALLOWED_ORIGINS: ['http://localhost:3000'],
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    },
  };
});

const mockTx = {} as ITXClient;

describe('Auth Security', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(transactionUtils.runInTransaction).mockImplementation(async (callback) =>
      callback(mockTx),
    );
  });

  describe('Login Orchestration', () => {
    const origin = 'http://localhost:3000';
    const getReqPayload = () => ({
      email: `test-${crypto.randomUUID()}@example.com`,
      password: 'Password123!',
    });

    const mockActiveUser = (email: string): User => ({
      id: 'u1',
      email,
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'User',
      role: 'VIEWER',
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockInactiveUser = (email: string): User => ({
      ...mockActiveUser(email),
      isActive: false,
    });

    it('unknown email returns generic 401', async () => {
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(null);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);
      const payload = getReqPayload();
      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('wrong password returns same generic 401', async () => {
      const payload = getReqPayload();
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockActiveUser(payload.email));
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);
      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('existing-inactive account flow returns same generic 401', async () => {
      const payload = getReqPayload();
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockInactiveUser(payload.email));
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);
      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('post-Argon deactivation race returns same generic 401', async () => {
      const payload = getReqPayload();
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockActiveUser(payload.email));
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);
      // Fails at lock phase when it realizes it's inactive
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue(mockInactiveUser(payload.email));
      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('strict/unknown login fields rejected', async () => {
      const payload = getReqPayload();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ ...payload, extra: 'field' });
      expect(res.status).toBe(400); // Validation error
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allowed Origin accepted', async () => {
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(null);
      const payload = getReqPayload();
      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);
      expect(res.status).not.toBe(403);
      expect(res.body.error?.message).not.toBe('Disallowed Origin/Referer');
    });

    it('disallowed Origin rejected', async () => {
      const payload = getReqPayload();
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://evil.com')
        .send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Disallowed Origin/Referer');
    });

    it('missing Origin/Referer rejected', async () => {
      const payload = getReqPayload();
      const res = await request(app).post('/api/v1/auth/login').send(payload);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Missing or malformed Origin/Referer');
    });

    it('login success returns no tokens/password/hash in JSON and secure auth-cookie contract', async () => {
      const payload = getReqPayload();
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockActiveUser(payload.email));
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue(mockActiveUser(payload.email));
      vi.mocked(tokensUtils.generateRefreshCredential).mockReturnValue({
        raw: 'raw-refresh',
        hash: 'hash-refresh',
      });
      vi.mocked(tokensUtils.generateAccessToken).mockReturnValue('raw-access');
      vi.mocked(authRepo.createSession).mockResolvedValue({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'u1',
        tokenHash: 'hash-refresh',
        familyId: '33333333-3333-4333-8333-333333333333',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        revocationReason: null,
        lastUsedAt: new Date(),
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
        rotatedAt: null,
        replacedBySessionId: null,
        createdAt: new Date(),
      });
      vi.mocked(authRepo.updateUserLastLogin).mockResolvedValue(mockActiveUser(payload.email));
      vi.mocked(authRepo.createAuditLog).mockResolvedValue({
        id: '44444444-4444-4444-8444-444444444444',
        action: 'AUTH_LOGIN_SUCCEEDED',
        entityType: 'SESSION',
        entityId: '22222222-2222-4222-8222-222222222222',
        actorUserId: 'u1',
        requestId: null,
        metadata: null,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
        createdAt: new Date(),
      } satisfies AuditLog);
      vi.mocked(authRepo.mapUserToSanitized).mockReturnValue({
        id: 'u1',
        email: payload.email,
        firstName: 'A',
        lastName: 'B',
        role: 'VIEWER',
        mustChangePassword: true,
        lastLoginAt: new Date(),
      });

      const res = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      const setCookieHeader = res.headers['set-cookie'];
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : setCookieHeader
          ? [setCookieHeader]
          : [];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('invoiceflow-access='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('invoiceflow-refresh='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('Login Rate Limiter', () => {
    it('blocks after 5 attempts', async () => {
      const origin = 'http://localhost:3000';
      const reqPayload = { email: 'rate-limit@example.com', password: 'Password123!' };
      vi.mocked(authRepo.getUserByEmail).mockResolvedValue(null); // Fail normal login

      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/v1/auth/login').set('Origin', origin).send(reqPayload);
      }

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send(reqPayload);
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('Authentication Middleware Orchestration', () => {
    const origin = 'http://localhost:3000';

    beforeEach(() => {
      vi.mocked(tokensUtils.verifyAccessToken).mockReturnValue({
        sub: 'u1',
        sid: 's1',
        role: 'VIEWER',
        type: 'access',
      });
      vi.mocked(authRepo.getSessionById).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 100000),
      } as Session);
      vi.mocked(authRepo.getUserById).mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: 'VIEWER',
      } as User);
    });

    it('missing/invalid access auth returns generic 401', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Origin', origin); // no cookies
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Unauthorized');
    });

    it('revoked Session returns generic 401', async () => {
      vi.mocked(authRepo.getSessionById).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(),
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 100000),
      } as Session);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Cookie', ['invoiceflow-access=valid-token']);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Unauthorized');
    });

    it('expired DB Session while JWT remains valid returns generic 401', async () => {
      vi.mocked(authRepo.getSessionById).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() - 10000),
      } as Session); // expired
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Cookie', ['invoiceflow-access=valid-token']);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Unauthorized');
    });

    it('inactive current User returns generic 401', async () => {
      vi.mocked(authRepo.getUserById).mockResolvedValue({
        id: 'u1',
        isActive: false,
        role: 'VIEWER',
      } as User);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Cookie', ['invoiceflow-access=valid-token']);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Unauthorized');
    });

    it('JWT/DB role mismatch returns generic 401', async () => {
      vi.mocked(authRepo.getUserById).mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: 'STAFF',
      } as User); // DB says STAFF, token says VIEWER
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Cookie', ['invoiceflow-access=valid-token']);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Unauthorized');
    });
  });

  describe('Logger Redaction', () => {
    it('redacts sensitive request and response headers via real pino-http', async () => {
      let loggedOutput = '';
      const stream = new Writable({
        write(chunk, encoding, callback) {
          void encoding;
          loggedOutput += chunk.toString();
          callback();
        },
      });

      const testLogger = pino(loggerOptions, stream);

      const pinoHttp = (await import('pino-http')).default({
        logger: testLogger,
        autoLogging: true,
      });

      const express = (await import('express')).default;
      const testApp = express();

      testApp.use(pinoHttp);
      testApp.get('/test', (req, res) => {
        void req;
        res.setHeader('set-cookie', [
          'invoiceflow-access=SENTINEL_RESPONSE_ACCESS_SECRET; Path=/; HttpOnly; SameSite=Lax',
          'invoiceflow-refresh=SENTINEL_RESPONSE_REFRESH_SECRET; Path=/; HttpOnly; SameSite=Lax',
        ]);
        res.send('ok');
      });

      await request(testApp)
        .get('/test')
        .set(
          'Cookie',
          'invoiceflow-access=SENTINEL_ACCESS_SECRET; invoiceflow-refresh=SENTINEL_REFRESH_SECRET',
        )
        .set('Authorization', 'Bearer SENTINEL_AUTHORIZATION_SECRET')
        .set('x-csrf-token', 'SENTINEL_CSRF_SECRET');

      expect(loggedOutput).not.toContain('SENTINEL_ACCESS_SECRET');
      expect(loggedOutput).not.toContain('SENTINEL_REFRESH_SECRET');
      expect(loggedOutput).not.toContain('SENTINEL_AUTHORIZATION_SECRET');
      expect(loggedOutput).not.toContain('SENTINEL_CSRF_SECRET');
      expect(loggedOutput).not.toContain('SENTINEL_RESPONSE_ACCESS_SECRET');
      expect(loggedOutput).not.toContain('SENTINEL_RESPONSE_REFRESH_SECRET');

      expect(loggedOutput).toContain('[REDACTED]');
    });
  });
});
