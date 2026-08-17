import { Prisma } from '../../generated/prisma/client';
import { ITXClient } from '../../database/transaction';

export class InvoicesRepository {
  static async createDraftInvoice(
    data: Omit<Prisma.InvoiceUncheckedCreateInput, 'items' | 'payments' | 'emailDeliveries'>,
    tx: ITXClient,
  ) {
    return tx.invoice.create({
      data,
    });
  }

  static async createInvoiceItems(data: Prisma.InvoiceItemCreateManyInput[], tx: ITXClient) {
    return tx.invoiceItem.createMany({
      data,
    });
  }

  static async getInvoiceWithItems(id: string, tx: ITXClient) {
    return tx.invoice.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  static async createInvoiceAuditLog(
    data: {
      actorUserId: string;
      action: string;
      entityId: string;
      requestId: string;
      ipAddress: string;
      userAgent: string;
      metadata: object;
    },
    tx: ITXClient,
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: 'INVOICE',
        entityId: data.entityId,
        requestId: data.requestId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    });
  }
}
