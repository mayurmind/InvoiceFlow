import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
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

vi.mock('../../src/features/dashboard/dashboard.service', () => ({
  DashboardService: {
    getSummary: vi.fn().mockResolvedValue({
      outstandingAmount: '2000',
      paidAmount: '3000',
      invoiceStatusCounts: {},
      recentInvoices: [],
      recentPayments: [],
    }),
  },
}));

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
