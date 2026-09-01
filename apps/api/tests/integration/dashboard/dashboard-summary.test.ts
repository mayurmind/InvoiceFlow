import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../../src/app';
import { prisma } from '../../../../src/database/prisma';
import { InvoiceStatus, PaymentMethod, PaymentStatus, UserRole } from '../../../../src/generated/prisma/client';
import { generateAuthToken } from '../../../helpers/auth';

describe('Dashboard Integration - GET /api/v1/dashboard/summary', () => {
  let viewerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Generate valid tokens
    viewerToken = await generateAuthToken(UserRole.VIEWER);
    adminToken = await generateAuthToken(UserRole.SUPER_ADMIN);

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
      }
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
      }
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
      }
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
      }
    });
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany();
    await prisma.client.deleteMany();
  });

  it('returns 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('returns the dashboard summary with correct totals when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Cookie', [`accessToken=${viewerToken}`]);
      
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
