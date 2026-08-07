import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { requestIdMiddleware } from '../../src/middleware/request-id.middleware';
import { notFoundMiddleware, globalErrorMiddleware } from '../../src/middleware/error.middleware';
import { validateRequest } from '../../src/middleware/validation.middleware';
import { AppError } from '../../src/errors/application.error';
import { env } from '../../src/config/env';

// Create a dedicated isolated test application for middleware
const testApp = express();

// 1. CORS for specific test
testApp.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  }),
);

// 2. Request ID
testApp.use(requestIdMiddleware);
testApp.use(express.json());

// 3. Custom Rate Limiter for test (Limit: 2)
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: (req: import('express').Request, _res: import('express').Response) => {
    return {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
        requestId: req.id,
      },
    };
  },
});
testApp.use('/test-rate-limit', testLimiter);
testApp.get('/test-rate-limit', (req, res) => {
  res.json({ ok: true });
});

// 4. Test Routes
testApp.get('/test-error', () => {
  throw new Error('Unexpected catastrophic failure');
});

testApp.get('/test-app-error', () => {
  throw new AppError('Payment Required', 402, 'PAYMENT_REQUIRED', { foo: 'bar' });
});

const testSchema = z.object({
  id: z.string().uuid(),
});

testApp.post('/test-validation', validateRequest({ body: testSchema }), (req, res) => {
  res.json({ success: true, id: req.body.id });
});

// 5. Terminal Middlewares (must be last)
testApp.use(notFoundMiddleware);
testApp.use(globalErrorMiddleware);

describe('Middleware Integration', () => {
  describe('Not Found (404)', () => {
    it('returns standardized 404 error for unknown routes', async () => {
      const res = await request(testApp).get('/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('not found');
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('Request ID', () => {
    it('generates a new Request ID if none is provided', async () => {
      const res = await request(testApp).get('/does-not-exist'); // Hit 404 just to get headers
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('trusts a valid incoming UUID Request ID', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(testApp).get('/does-not-exist').set('X-Request-Id', validUuid);
      expect(res.headers['x-request-id']).toBe(validUuid);
    });

    it('rejects an invalid Request ID and generates a new one', async () => {
      const invalidId = 'not-a-uuid';
      const res = await request(testApp).get('/does-not-exist').set('X-Request-Id', invalidId);
      expect(res.headers['x-request-id']).not.toBe(invalidId);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Global Error Handler', () => {
    it('handles unexpected errors and hides stack traces (500)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(testApp).get('/test-error');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBe('An unexpected internal error occurred');
      expect(res.body.error.stack).toBeUndefined();
      errorSpy.mockRestore();
    });

    it('handles known AppErrors gracefully', async () => {
      const res = await request(testApp).get('/test-app-error');
      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
      expect(res.body.error.details).toEqual({ foo: 'bar' });
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('Zod Validation Middleware', () => {
    it('passes valid request body', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(testApp).post('/test-validation').send({ id: validUuid });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('fails on invalid request body with standard format, without executing handler', async () => {
      const res = await request(testApp).post('/test-validation').send({ id: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Request validation failed');
      expect(res.body.error.details.id._errors[0]).toBe('Invalid uuid');
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('CORS and Rate Limiter', () => {
    it('sets CORS headers on requests from allowed origin', async () => {
      const res = await request(testApp)
        .get('/does-not-exist')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('denies CORS on requests from unapproved origin', async () => {
      const res = await request(testApp).get('/does-not-exist').set('Origin', 'http://evil.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('responds to CORS preflight for allowed origin', async () => {
      const res = await request(testApp)
        .options('/does-not-exist')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('rate limiter restricts excessive requests deterministically', async () => {
      // Limit is 2
      await request(testApp).get('/test-rate-limit'); // 1
      await request(testApp).get('/test-rate-limit'); // 2
      const res = await request(testApp).get('/test-rate-limit'); // 3 (blocked)

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.requestId).toBeDefined();
    });
  });
});
