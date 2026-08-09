import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma';
import { withRollback } from './helpers/transaction';
import { randomUUID } from 'node:crypto';

describe('Database Constraints Integration', () => {
  it('DB-09: Rejects duplicate user email', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        const email = `duplicate_${randomUUID()}@test.com`;

        await tx.user.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash: 'dummy',
            firstName: 'First',
            lastName: 'Last',
            role: 'SUPER_ADMIN',
          },
        });

        reachedTargetOperation = true;

        // The second insertion should violate the unique constraint and abort the transaction.
        await tx.user.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash: 'dummy2',
            firstName: 'First2',
            lastName: 'Last2',
            role: 'STAFF',
          },
        });
      }),
    ).rejects.toBeDefined(); // Unique constraint violation throws

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-10: Rejects foreign key violation (Session with missing User)', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        reachedTargetOperation = true;
        await tx.session.create({
          data: {
            id: randomUUID(),
            userId: randomUUID(), // Non-existent user
            tokenHash: `token_${randomUUID()}`,
            familyId: randomUUID(),
            expiresAt: new Date(Date.now() + 100000),
          },
        });
      }),
    ).rejects.toBeDefined(); // Foreign key constraint violation throws

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-11: Rejects Invoice where dueDate < invoiceDate (CHECK constraint)', async () => {
    let reachedTargetOperation = false;
    await expect(
      prisma.$transaction(async (tx) => {
        // Create prerequisite Client
        const client = await tx.client.create({
          data: {
            id: randomUUID(),
            name: 'Test Client',
            email: `client_${randomUUID()}@test.com`,
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            stateCode: 'TS',
            postalCode: '123456',
          },
        });

        reachedTargetOperation = true;

        // dueDate < invoiceDate should be rejected by DB constraint
        await tx.invoice.create({
          data: {
            id: randomUUID(),
            clientId: client.id,
            status: 'DRAFT',
            invoiceDate: new Date('2026-08-10T00:00:00Z'),
            dueDate: new Date('2026-08-01T00:00:00Z'), // Before invoiceDate
            placeOfSupplyState: 'Test State',
            placeOfSupplyStateCode: 'TS',
            currency: 'USD',
            subtotal: '100.00',
            total: '100.00',
            paidAmount: '0.00',
            outstandingAmount: '100.00',
          },
        });
      }),
    ).rejects.toBeDefined();

    expect(reachedTargetOperation).toBe(true);
  });

  it('DB-12: Exact Decimal roundtrip representation', async () => {
    await withRollback(async (tx) => {
      const client = await tx.client.create({
        data: {
          id: randomUUID(),
          name: 'Decimal Client',
          email: `decimal_${randomUUID()}@test.com`,
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
          subtotal: '138.88',
          total: '138.88',
          paidAmount: '0.00',
          outstandingAmount: '138.88',
        },
      });

      const itemId = randomUUID();
      await tx.invoiceItem.create({
        data: {
          id: itemId,
          invoiceId: invoice.id,
          lineNumber: 1,
          description: 'Decimal Item',
          quantity: '1.125',
          rate: '123.45',
          taxableAmount: '138.88',
          gstRate: '0.00',
          totalAmount: '138.88',
        },
      });

      const readItem = await tx.invoiceItem.findUnique({
        where: { id: itemId },
      });

      expect(readItem).toBeDefined();
      expect(readItem?.quantity.toFixed(3)).toBe('1.125');
      expect(readItem?.rate.toFixed(2)).toBe('123.45');
      expect(readItem?.taxableAmount.toFixed(2)).toBe('138.88');
    });
  });
});
