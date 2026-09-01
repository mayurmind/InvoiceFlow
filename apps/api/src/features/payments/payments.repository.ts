import { Prisma, PaymentStatus, InvoiceStatus, PaymentMethod } from '../../generated/prisma/client';
import { ITXClient } from '../../database/transaction';

export class PaymentsRepository {
  /**
   * Attempts to find a payment by its idempotency key.
   */
  static async getPaymentByIdempotencyKey(idempotencyKey: string, tx: ITXClient) {
    return tx.payment.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Creates a new Payment record in the database.
   */
  static async createPaymentRecord(
    data: {
      invoiceId: string;
      amount: Prisma.Decimal;
      method: PaymentMethod;
      status: PaymentStatus;
      reference?: string | null;
      notes?: string | null;
      idempotencyKey: string;
      recordedByUserId: string;
      paidAt: Date;
    },
    tx: ITXClient,
  ) {
    return tx.payment.create({
      data,
    });
  }

  /**
   * Updates an invoice's totals and status.
   */
  static async updateInvoiceTotalsAndStatus(
    invoiceId: string,
    data: {
      paidAmount: Prisma.Decimal;
      outstandingAmount: Prisma.Decimal;
      status: InvoiceStatus;
    },
    tx: ITXClient,
  ) {
    return tx.invoice.update({
      where: { id: invoiceId },
      data,
    });
  }

  /**
   * Locks the invoice exclusively for a transaction using FOR UPDATE.
   */
  static async lockInvoiceForUpdate(invoiceId: string, tx: ITXClient): Promise<void> {
    await tx.$queryRaw`
      SELECT "id"
      FROM "invoices"
      WHERE "id" = ${invoiceId}::uuid
      FOR UPDATE
    `;
  }

  /**
   * Retrieves an invoice without items.
   */
  static async getInvoiceById(invoiceId: string, tx: ITXClient) {
    return tx.invoice.findUnique({
      where: { id: invoiceId },
    });
  }

  /**
   * Creates an audit log record for a payment action.
   */
  static async createPaymentAuditLog(
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
        entityType: 'PAYMENT',
        entityId: data.entityId,
        requestId: data.requestId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    });
  }
}
