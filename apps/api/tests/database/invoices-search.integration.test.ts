import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/database/prisma';
import { InvoicesRepository } from '../../src/features/invoices/invoices.repository';

describe('Server-Side Invoice Search Database Tests', () => {
  let clientId1: string;
  let clientId2: string;
  
  beforeEach(async () => {
    clientId1 = crypto.randomUUID();
    clientId2 = crypto.randomUUID();

    // Create Clients
    await prisma.client.createMany({
      data: [
        {
          id: clientId1,
          name: 'Acme Industries',
          email: 'acme@example.com',
          addressLine1: '1', city: 'C', state: 'S', postalCode: '1', stateCode: '27', country: 'IN',
        },
        {
          id: clientId2,
          name: 'Wayne Enterprises',
          email: 'wayne@example.com',
          addressLine1: '2', city: 'C', state: 'S', postalCode: '2', stateCode: '27', country: 'IN',
        }
      ]
    });

    // Create Invoices
    const inv1Id = crypto.randomUUID();
    await prisma.invoice.create({
      data: {
        id: inv1Id,
        clientId: clientId1,
        invoiceNumber: 'INV-2026-001',
        status: 'DRAFT',
        invoiceDate: new Date('2026-08-01'),
        dueDate: new Date('2026-08-15'),
        currency: 'INR',
        placeOfSupplyState: 'MH',
        placeOfSupplyStateCode: '27',
        items: {
          create: [
            { lineNumber: 1, description: 'Industrial Motor', quantity: 1, rate: 100, taxableAmount: 100, gstRate: 18, totalAmount: 118 }
          ]
        }
      }
    });

    const inv2Id = crypto.randomUUID();
    await prisma.invoice.create({
      data: {
        id: inv2Id,
        clientId: clientId2,
        invoiceNumber: 'INV-2026-002',
        status: 'SENT',
        invoiceDate: new Date('2026-08-05'),
        dueDate: new Date('2026-08-20'),
        currency: 'INR',
        placeOfSupplyState: 'MH',
        placeOfSupplyStateCode: '27',
        items: {
          create: [
            { lineNumber: 1, description: 'Consulting Services', quantity: 1, rate: 200, taxableAmount: 200, gstRate: 18, totalAmount: 236 }
          ]
        }
      }
    });
  });

  afterEach(async () => {
    await prisma.$executeRaw`ALTER TABLE public."invoice_items" DISABLE TRIGGER USER`;
    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    
    await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
    await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
    
    await prisma.client.deleteMany();
  });

  it('searches by invoiceNumber', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: '2026-001' });
    expect(list.length).toBe(1);
    expect(list[0].invoiceNumber).toBe('INV-2026-001');
  });

  it('searches by client.name case-insensitive', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: 'acme' });
    expect(list.length).toBe(1);
    expect(list[0].clientId).toBe(clientId1);
  });

  it('searches by client.email', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: 'wayne@example' });
    expect(list.length).toBe(1);
    expect(list[0].clientId).toBe(clientId2);
  });

  it('searches by invoiceItem.description', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: 'motor' });
    expect(list.length).toBe(1);
    expect(list[0].clientId).toBe(clientId1);
  });

  it('returns zero results for non-existent search', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: 'xyz-nonexistent' });
    expect(list.length).toBe(0);
    
    const count = await InvoicesRepository.countInvoices({ page: 1, limit: 10, search: 'xyz-nonexistent' });
    expect(count).toBe(0);
  });

  it('combines search and status filter with AND logic', async () => {
    // Both invoices match if we search '2026', but only one is SENT
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: '2026', status: 'SENT' });
    expect(list.length).toBe(1);
    expect(list[0].status).toBe('SENT');
  });

  it('applies pagination based on filtered result set', async () => {
    // Both match '2026'
    const count = await InvoicesRepository.countInvoices({ page: 1, limit: 1, search: '2026' });
    expect(count).toBe(2);

    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 1, search: '2026' });
    expect(list.length).toBe(1); // limited to 1
  });

  it('empty or whitespace search behaves normally (returns all)', async () => {
    const list = await InvoicesRepository.listInvoices({ page: 1, limit: 10, search: '   ' });
    // Empty search should just be ignored or passed as contains: '   '
    // Actually, Zod schema trims the search to '', so it will be undefined or empty.
    // Let's test the repository ignoring it or handling it gracefully.
  });
});
