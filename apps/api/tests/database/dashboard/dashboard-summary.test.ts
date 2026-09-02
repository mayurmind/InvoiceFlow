import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../../src/app';
import { prisma } from '../../../src/database/prisma';
import { InvoiceStatus, UserRole } from '../../../src/generated/prisma/client';

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

describe('Dashboard Integration - GET /api/v1/dashboard/summary', () => {
  beforeAll(async () => {
    // Setup initial data
    const client = await prisma.client.create({
      data: {
        name: 'Dashboard Test Client',
        addressLine1: 'Test',
        city: 'Test',
        state: 'Test',
        stateCode: '01',
        postalCode: '123456',
        country: 'India',
      },
    });

    // Create DRAFT
    await prisma.invoice.create({
      data: {
        clientId: client.id,
        status: InvoiceStatus.DRAFT,
        invoiceDate: new Date(),
        dueDate: new Date(),
        placeOfSupplyState: 'Test',
        placeOfSupplyStateCode: '01',
        total: 1000,
        outstandingAmount: 1000,
        paidAmount: 0,
      },
    });

    // Create SENT (Outstanding)
    await prisma.invoice.create({
      data: {
        clientId: client.id,
        status: InvoiceStatus.SENT,
        invoiceDate: new Date(),
        dueDate: new Date(),
        placeOfSupplyState: 'Test',
        placeOfSupplyStateCode: '01',
        total: 2000,
        outstandingAmount: 2000,
        paidAmount: 0,
        invoiceNumber: 'INV-001',
        financialYear: '23-24',
        sentAt: new Date(),
        businessSnapshot: { name: 'Test Business' },
        clientSnapshot: { name: 'Test Client' },
      },
    });

    // Create PAID
    await prisma.invoice.create({
      data: {
        clientId: client.id,
        status: InvoiceStatus.PAID,
        invoiceDate: new Date(),
        dueDate: new Date(),
        placeOfSupplyState: 'Test',
        placeOfSupplyStateCode: '01',
        total: 3000,
        outstandingAmount: 0,
        paidAmount: 3000,
        invoiceNumber: 'INV-002',
        financialYear: '23-24',
        sentAt: new Date(),
        businessSnapshot: { name: 'Test Business' },
        clientSnapshot: { name: 'Test Client' },
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    try {
      await prisma.invoice.deleteMany();
      await prisma.client.deleteMany();
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
    }
  });

  it('returns 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('returns the dashboard summary with correct totals when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('x-mock-role', UserRole.VIEWER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      outstandingAmount: '2000', // Only SENT/PARTIALLY_PAID
      paidAmount: '3000', // Only SENT/PARTIALLY_PAID/PAID
    });

    // Status counts should reflect our seeded data
    // Assuming isolation isn't perfect in parallel tests, we expect at least these counts
    expect(res.body.invoiceStatusCounts[InvoiceStatus.DRAFT]).toBeGreaterThanOrEqual(1);
    expect(res.body.invoiceStatusCounts[InvoiceStatus.SENT]).toBeGreaterThanOrEqual(1);
    expect(res.body.invoiceStatusCounts[InvoiceStatus.PAID]).toBeGreaterThanOrEqual(1);
  });
});
