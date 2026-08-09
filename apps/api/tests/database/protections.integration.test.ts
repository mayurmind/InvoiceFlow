import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma';
import { withRollback } from './helpers/transaction';
import { randomUUID } from 'node:crypto';

describe('Database Protections & Business Logic Integration', () => {
  it('DB-08: Prisma User create/read roundtrip', async () => {
    await withRollback(async (tx) => {
      const email = `roundtrip_${randomUUID()}@test.com`;
      const created = await tx.user.create({
        data: {
          id: randomUUID(),
          email,
          passwordHash: 'dummy',
          firstName: 'First',
          lastName: 'Last',
          role: 'SUPER_ADMIN',
        },
      });

      const read = await tx.user.findUnique({
        where: { id: created.id },
      });

      expect(read).toBeDefined();
      expect(read?.email).toBe(email);
      expect(read?.role).toBe('SUPER_ADMIN');
    });
  });

  it('DB-13: Financial delete protection (Invoice delete trigger rejection)', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            id: randomUUID(),
            name: 'Delete Client',
            email: `delete_${randomUUID()}@test.com`,
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            stateCode: 'TS',
            postalCode: '123456',
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            id: randomUUID(),
            clientId: client.id,
            status: 'DRAFT',
            invoiceDate: new Date('2026-08-10T00:00:00Z'),
            dueDate: new Date('2026-08-20T00:00:00Z'),
            placeOfSupplyState: 'Test State',
            placeOfSupplyStateCode: 'TS',
            currency: 'USD',
            subtotal: '100.00',
            total: '100.00',
            paidAmount: '0.00',
            outstandingAmount: '100.00',
          },
        });

        reachedTargetOperation = true;

        // Attempting to delete an invoice should be rejected by trigger
        await tx.invoice.delete({
          where: { id: invoice.id },
        });
      }),
    ).rejects.toBeDefined();

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-14: AuditLog update rejection', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: randomUUID(),
            email: `audit_${randomUUID()}@test.com`,
            passwordHash: 'dummy',
            firstName: 'First',
            lastName: 'Last',
            role: 'STAFF',
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            id: randomUUID(),
            actorUserId: user.id,
            action: 'CREATE_INVOICE',
            entityType: 'INVOICE',
            entityId: randomUUID(),
          },
        });

        reachedTargetOperation = true;

        // Updating an audit log should be rejected
        await tx.auditLog.update({
          where: { id: auditLog.id },
          data: { action: 'UPDATE_INVOICE' },
        });
      }),
    ).rejects.toBeDefined();

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-15: AuditLog delete rejection', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: randomUUID(),
            email: `audit2_${randomUUID()}@test.com`,
            passwordHash: 'dummy',
            firstName: 'First',
            lastName: 'Last',
            role: 'STAFF',
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            id: randomUUID(),
            actorUserId: user.id,
            action: 'CREATE_INVOICE',
            entityType: 'INVOICE',
            entityId: randomUUID(),
          },
        });

        reachedTargetOperation = true;

        // Deleting an audit log should be rejected
        await tx.auditLog.delete({
          where: { id: auditLog.id },
        });
      }),
    ).rejects.toBeDefined();

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-16: DRAFT InvoiceItem update allowed', async () => {
    await withRollback(async (tx) => {
      const client = await tx.client.create({
        data: {
          id: randomUUID(),
          name: 'Draft Client',
          email: `draft_${randomUUID()}@test.com`,
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          stateCode: 'TS',
          postalCode: '123456',
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          id: randomUUID(),
          clientId: client.id,
          status: 'DRAFT', // Mutable status
          invoiceDate: new Date('2026-08-10T00:00:00Z'),
          dueDate: new Date('2026-08-20T00:00:00Z'),
          placeOfSupplyState: 'Test State',
          placeOfSupplyStateCode: 'TS',
          currency: 'USD',
          subtotal: '100.00',
          total: '100.00',
          paidAmount: '0.00',
          outstandingAmount: '100.00',
        },
      });

      const itemId = randomUUID();
      const item = await tx.invoiceItem.create({
        data: {
          id: itemId,
          invoiceId: invoice.id,
          lineNumber: 1,
          description: 'Initial Item',
          quantity: '1.000',
          rate: '100.00',
          taxableAmount: '100.00',
          gstRate: '0.00',
          totalAmount: '100.00',
        },
      });

      // Update should succeed
      const updated = await tx.invoiceItem.update({
        where: { id: item.id },
        data: { description: 'Updated Item' },
      });

      expect(updated.description).toBe('Updated Item');
    });
  });

  it('DB-17: SENT InvoiceItem update rejected', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            id: randomUUID(),
            name: 'Sent Client',
            email: `sent_${randomUUID()}@test.com`,
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            stateCode: 'TS',
            postalCode: '123456',
          },
        });

        const invoiceNumber = `P27${randomUUID().replace(/-/g, '').slice(0, 13)}`;

        const invoice = await tx.invoice.create({
          data: {
            id: randomUUID(),
            clientId: client.id,
            status: 'SENT', // Immutable status
            invoiceNumber,
            financialYear: '26-27',
            sentAt: new Date('2026-08-15T00:00:00Z'),
            businessSnapshot: { name: 'My Business' },
            clientSnapshot: { name: 'Sent Client' },
            invoiceDate: new Date('2026-08-10T00:00:00Z'),
            dueDate: new Date('2026-08-20T00:00:00Z'),
            placeOfSupplyState: 'Test State',
            placeOfSupplyStateCode: 'TS',
            currency: 'USD',
            subtotal: '100.00',
            total: '100.00',
            paidAmount: '0.00',
            outstandingAmount: '100.00',
          },
        });

        const item = await tx.invoiceItem.create({
          data: {
            id: randomUUID(),
            invoiceId: invoice.id,
            lineNumber: 1,
            description: 'Immutable Item',
            quantity: '1.000',
            rate: '100.00',
            taxableAmount: '100.00',
            gstRate: '0.00',
            totalAmount: '100.00',
          },
        });

        reachedTargetOperation = true;

        // Updating an item on a SENT invoice should be rejected by trigger
        await tx.invoiceItem.update({
          where: { id: item.id },
          data: { description: 'Attempted Update' },
        });
      }),
    ).rejects.toBeDefined();

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-18: Explicit transaction rollback leaves no record', async () => {
    const email = `rollback_${randomUUID()}@test.com`;

    await withRollback(async (tx) => {
      await tx.user.create({
        data: {
          id: randomUUID(),
          email,
          passwordHash: 'dummy',
          firstName: 'First',
          lastName: 'Last',
          role: 'STAFF',
        },
      });
      // The withRollback helper implicitly throws the ROLLBACK symbol here, rolling back the transaction.
    });

    // Verify the user does not exist outside the transaction
    const user = await prisma.user.findUnique({
      where: { email },
    });

    expect(user).toBeNull();
  });
});
