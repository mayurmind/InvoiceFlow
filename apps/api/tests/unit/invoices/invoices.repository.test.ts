import { describe, it, expect, vi } from 'vitest';
import { InvoicesRepository } from '../../../src/features/invoices/invoices.repository';

import { ITXClient } from '../../../src/database/transaction';
import { Prisma } from '../../../src/generated/prisma/client';

describe('InvoicesRepository', () => {
  it('calls create on invoice', async () => {
    const tx = {
      invoice: {
        create: vi.fn().mockResolvedValue({ id: 'inv-1' }),
      },
    } as unknown as ITXClient;

    await InvoicesRepository.createDraftInvoice(
      { clientId: 'client-1' } as unknown as Omit<
        Prisma.InvoiceUncheckedCreateInput,
        'items' | 'payments' | 'emailDeliveries'
      >,
      tx,
    );
    expect(tx.invoice.create).toHaveBeenCalled();
  });

  it('calls createMany on invoiceItem', async () => {
    const tx = {
      invoiceItem: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as ITXClient;

    await InvoicesRepository.createInvoiceItems([], tx);
    expect(tx.invoiceItem.createMany).toHaveBeenCalled();
  });

  it('calls findUnique on invoice with items include', async () => {
    const tx = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', items: [] }),
      },
    } as unknown as ITXClient;

    await InvoicesRepository.getInvoiceWithItems('inv-1', tx);
    expect(tx.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      include: { items: { orderBy: { lineNumber: 'asc' } } },
    });
  });

  it('calls create on auditLog', async () => {
    const tx = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    } as unknown as ITXClient;

    await InvoicesRepository.createInvoiceAuditLog(
      {
        action: 'INVOICE_CREATED',
        actorUserId: 'u-1',
        entityId: 'e-1',
        ipAddress: '127.0.0.1',
        requestId: 'req-1',
        userAgent: 'agent',
        metadata: {},
      },
      tx,
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
