import { ITXClient } from '../../../database/transaction';
import { prisma } from '../../../database/prisma';
import { EmailDeliveryStatus, Prisma } from '../../../generated/prisma/client';

export class InvoiceEmailRepository {
  async lockInvoiceForUpdate(tx: ITXClient, invoiceId: string) {
    const raw = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "invoices"
      WHERE id = ${invoiceId}
      FOR UPDATE
    `;
    return raw.length > 0 ? raw[0] : null;
  }

  async fetchInvoiceWithItems(tx: ITXClient, invoiceId: string) {
    return tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
  }

  async findEmailDeliveryHistory(tx: ITXClient | typeof prisma, invoiceId: string) {
    return tx.emailDelivery.findMany({
      where: { invoiceId },
      orderBy: { attemptNumber: 'desc' },
    });
  }

  async findLatestDelivery(tx: ITXClient, invoiceId: string) {
    return tx.emailDelivery.findFirst({
      where: { invoiceId },
      orderBy: { attemptNumber: 'desc' },
    });
  }

  async createPendingEmailDelivery(
    tx: ITXClient,
    invoiceId: string,
    recipientEmail: string,
    attemptNumber: number,
  ) {
    return tx.emailDelivery.create({
      data: {
        invoiceId,
        recipientEmail,
        status: EmailDeliveryStatus.PENDING,
        attemptNumber,
        attemptedAt: new Date(),
      },
    });
  }

  async lockEmailDeliveryForUpdate(tx: ITXClient, deliveryId: string) {
    const raw = await tx.$queryRaw<{ id: string; status: EmailDeliveryStatus }[]>`
      SELECT id, status FROM "email_deliveries"
      WHERE id = ${deliveryId}
      FOR UPDATE
    `;
    if (raw.length === 0) return null;
    return tx.emailDelivery.findUnique({ where: { id: deliveryId } });
  }

  async finalizePendingToAccepted(
    tx: ITXClient,
    deliveryId: string,
    provider: string,
    providerMessageId: string,
  ) {
    return tx.emailDelivery.update({
      where: { id: deliveryId },
      data: {
        status: EmailDeliveryStatus.ACCEPTED,
        provider,
        providerMessageId,
        acceptedAt: new Date(),
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  async finalizePendingToFailed(
    tx: ITXClient,
    deliveryId: string,
    failureCode: string,
    failureMessage: string,
  ) {
    return tx.emailDelivery.update({
      where: { id: deliveryId },
      data: {
        status: EmailDeliveryStatus.FAILED,
        failedAt: new Date(),
        failureCode,
        failureMessage,
      },
    });
  }

  async createEmailAuditLog(
    tx: ITXClient,
    params: {
      action: string;
      actorUserId: string;
      invoiceId: string;
      requestId: string;
      ipAddress: string;
      userAgent: string;
      metadata: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({
      data: {
        action: params.action,
        entityType: 'INVOICE',
        entityId: params.invoiceId,
        actorUserId: params.actorUserId,
        metadata: params.metadata ?? Prisma.JsonNull,
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}
