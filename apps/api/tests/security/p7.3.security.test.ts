import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';

describe('P7.3 Security - Dashboard MVP', () => {
  it('prevents unauthenticated access to /api/v1/dashboard/summary', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('allows VIEWER role to access dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('x-mock-role', UserRole.VIEWER);

    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN role to access dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('x-mock-role', UserRole.SUPER_ADMIN);

    expect(res.status).toBe(200);
  });
});
