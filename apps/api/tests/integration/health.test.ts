import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Health Routes', () => {
  it('GET /health succeeds and returns 200 (Root Liveness Check)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toBe('InvoiceFlow API is running');
    expect(res.body.timestamp).toBeDefined();

    // Check security headers from Helmet
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');

    // Check Request ID header
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health alias succeeds and returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toBe('InvoiceFlow API is running');
  });
});
