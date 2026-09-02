import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { UserRole } from '../../../src/generated/prisma/client';
import { generateAuthToken } from '../../helpers/auth';

describe('P7.3 Security - Dashboard MVP', () => {
  let viewerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    viewerToken = await generateAuthToken(UserRole.VIEWER);
    adminToken = await generateAuthToken(UserRole.SUPER_ADMIN);
  });

  it('prevents unauthenticated access to /api/v1/dashboard/summary', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('allows VIEWER role to access dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Cookie', [`accessToken=${viewerToken}`]);

    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN role to access dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Cookie', [`accessToken=${adminToken}`]);

    expect(res.status).toBe(200);
  });
});
