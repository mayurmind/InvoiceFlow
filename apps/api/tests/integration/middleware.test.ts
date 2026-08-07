import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { z } from 'zod';
import { validateRequest } from '../../src/middleware/validation.middleware';
import { AppError } from '../../src/errors/application.error';

// Add some test routes directly to the app for testing middlewares
app.get('/test-error', () => {
  throw new Error('Unexpected catastrophic failure');
});

app.get('/test-app-error', () => {
  throw new AppError('Payment Required', 402, 'PAYMENT_REQUIRED', { foo: 'bar' });
});

const testSchema = z.object({
  id: z.string().uuid(),
});

app.post('/test-validation', validateRequest({ body: testSchema }), (req, res) => {
  res.json({ success: true, id: req.body.id });
});

describe('Middleware Integration', () => {
  describe('Not Found (404)', () => {
    it('returns standardized 404 error for unknown routes', async () => {
      const res = await request(app).get('/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('not found');
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('Request ID', () => {
    it('generates a new Request ID if none is provided', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('trusts a valid incoming UUID Request ID', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get('/api/v1/health').set('X-Request-Id', validUuid);
      expect(res.headers['x-request-id']).toBe(validUuid);
    });

    it('rejects an invalid Request ID and generates a new one', async () => {
      const invalidId = 'not-a-uuid';
      const res = await request(app).get('/api/v1/health').set('X-Request-Id', invalidId);
      expect(res.headers['x-request-id']).not.toBe(invalidId);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Global Error Handler', () => {
    it('handles unexpected errors and hides stack traces (500)', async () => {
      // Suppress pino fatal log in test output
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/test-error');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBe('An unexpected internal error occurred');
      expect(res.body.error.stack).toBeUndefined();

      errorSpy.mockRestore();
    });

    it('handles known AppErrors gracefully', async () => {
      const res = await request(app).get('/test-app-error');
      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
      expect(res.body.error.details).toEqual({ foo: 'bar' });
    });
  });

  describe('Zod Validation Middleware', () => {
    it('passes valid request body', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).post('/test-validation').send({ id: validUuid });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('fails on invalid request body with standard format', async () => {
      const res = await request(app).post('/test-validation').send({ id: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Request validation failed');
      expect(res.body.error.details.id._errors[0]).toBe('Invalid uuid');
    });
  });

  describe('CORS and Rate Limiter', () => {
    it('sets CORS headers on requests from allowed origin', async () => {
      const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
    });

    it('rate limiter restricts excessive requests', async () => {
      // In app.ts limit is 100 per 15 min. We hit the limit.
      const promises = [];
      for (let i = 0; i < 101; i++) {
        promises.push(request(app).get('/api/v1/health'));
      }
      const responses = await Promise.all(promises);
      const lastResponse = responses[100];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
