import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole } from '../../src/generated/prisma/client';

vi.mock('../../src/features/invoices/invoices.service', () => ({
  InvoicesService: {
    issueInvoice: vi.fn(),
  },
}));

type RouterLayerLike = {
  name?: string;
  regexp?: { test: (path: string) => boolean };
  handle?: {
    stack?: RouterLayerLike[];
  };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{
      name?: string;
      handle?: {
        name?: string;
      };
    }>;
  };
};

import { InvoicesService } from '../../src/features/invoices/invoices.service';
import type { AuthContext } from '../../src/features/auth/auth.types';
import { UnauthorizedError } from '../../src/errors/application.error';

const createAuthContext = (role: UserRole, mustChangePassword = false): AuthContext => ({
  sessionId: 'mock-session-id',
  user: {
    id: 'mock-user-id',
    email: 'mock@example.com',
    firstName: 'Mock',
    lastName: 'User',
    role,
    mustChangePassword,
    lastLoginAt: null,
  },
});

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn((req, _res, next) => {
      if (req.headers['x-mock-auth'] === 'none') return next(new UnauthorizedError());
      const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
      const mustChangePassword = req.headers['x-mock-must-change-password'] === 'true';
      req.auth = createAuthContext(role, mustChangePassword);
      next();
    }),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((req, _res, next) => {
    if (req.headers['x-origin-verified'] !== 'true') return next(new UnauthorizedError());
    next();
  }),
}));

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((req, _res, next) => {
    if (req.headers['x-csrf-verified'] === 'false') return next(new UnauthorizedError());
    next();
  }),
}));

describe('P6.2 Security tests (Gate B)', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(InvoicesService.issueInvoice).mockResolvedValue({
      id: validId,
      invoiceNumber: 'INV/26-27/0001',
      status: 'SENT',
    } as never);
  });

  describe('SEC-01 to SEC-08: Auth and Roles', () => {
    it('SEC-01 anonymous issue denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-auth', 'none')
        .set('x-origin-verified', 'true')
        .send({});
      expect(res.status).toBe(401);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-02 VIEWER denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.VIEWER)
        .set('x-origin-verified', 'true')
        .send({});
      expect(res.status).toBe(403);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-03 STAFF permitted', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.STAFF)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({});
      expect(res.status).toBe(200);
      expect(InvoicesService.issueInvoice).toHaveBeenCalledTimes(1);
    });

    it('SEC-04 SUPER_ADMIN permitted', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({});
      expect(res.status).toBe(200);
      expect(InvoicesService.issueInvoice).toHaveBeenCalledTimes(1);
    });

    it('SEC-05 mustChangePassword denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-mock-must-change-password', 'true')
        .set('x-origin-verified', 'true')
        .send({});
      expect(res.status).toBe(403);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-06 missing CSRF denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'false') // Missing or invalid defaults to failed CSRF in mock
        .send({});
      expect(res.status).toBe(401);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-07 invalid CSRF denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'false')
        .send({});
      expect(res.status).toBe(401);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-08 untrusted Origin denied', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'false')
        .send({});
      expect(res.status).toBe(401);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });
  });

  describe('SEC-09 to SEC-18: Mass Assignment and Validation', () => {
    it('SEC-09 malformed UUID rejected safely', async () => {
      const res = await request(app)
        .post('/api/v1/invoices/not-a-uuid/issue')
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({});
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-10 non-empty body rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-11 invoiceNumber mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ invoiceNumber: 'INV/25-26/9999' });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-12 financialYear mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ financialYear: '26-27' });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-13 status mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ status: 'PAID' });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-14 businessSnapshot mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ businessSnapshot: { gstin: 'HACKED' } });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-15 clientSnapshot mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ clientSnapshot: { name: 'HACKED' } });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-16 snapshotVersion mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ snapshotVersion: 2 });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-17 sentByUserId mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ sentByUserId: 'hacker-id' });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });

    it('SEC-18 sentAt mass assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({ sentAt: new Date().toISOString() });
      expect(res.status).toBe(400);
      expect(InvoicesService.issueInvoice).not.toHaveBeenCalled();
    });
  });

  describe('SEC-19 and SEC-20: Error Handling and Middleware Chain', () => {
    it('SEC-19 unexpected repository/DB failure does not leak internal state', async () => {
      vi.mocked(InvoicesService.issueInvoice).mockRejectedValueOnce(
        new Error(
          'PrismaClientKnownRequestError: P2002 Unique constraint failed on the fields: (`invoiceNumber`) SQLSTATE 23505',
        ),
      );

      const res = await request(app)
        .post(`/api/v1/invoices/${validId}/issue`)
        .set('x-mock-role', UserRole.SUPER_ADMIN)
        .set('x-origin-verified', 'true')
        .set('x-csrf-verified', 'true')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error.message).not.toContain('Prisma');
      expect(res.body.error.message).not.toContain('SQLSTATE');
      expect(res.body.error.message).not.toContain('23505');
      expect(res.body.error.message).toBe('An unexpected internal error occurred');
    });

    it('SEC-20 issue endpoint cannot bypass the frozen middleware chain', () => {
      // The app mounts apiV1Router at /api/v1
      const apiV1Layer = app._router.stack.find(
        (layer: RouterLayerLike) => layer.name === 'router' && layer.regexp?.test('/api/v1'),
      );
      expect(apiV1Layer).toBeDefined();

      const apiV1Router = apiV1Layer.handle;
      // The apiV1Router mounts invoicesRouter at /invoices
      const invoicesRouterLayer = apiV1Router.stack.find(
        (layer: RouterLayerLike) => layer.name === 'router' && layer.regexp?.test('/invoices'),
      );
      expect(invoicesRouterLayer).toBeDefined();

      const invoicesRouter = invoicesRouterLayer.handle;
      // Find the specific issue route
      const issueRoute = invoicesRouter.stack.find(
        (layer: RouterLayerLike) =>
          layer.route && layer.route.path === '/:invoiceId/issue' && layer.route.methods?.post,
      );
      expect(issueRoute).toBeDefined();

      const stackNames = issueRoute.route.stack.map((s: RouterLayerLike) => s.name);

      expect(stackNames).toEqual([
        'spy', // originGuard mock
        'spy', // authenticateRequest mock
        'requirePasswordChangeCompleted',
        '<anonymous>', // requireRoles returns anonymous function
        'spy', // requireCsrfToken mock
        '<anonymous>', // validateRequest returns anonymous function
        'issueInvoice', // InvoicesController.issueInvoice
      ]);
    });
  });
});
