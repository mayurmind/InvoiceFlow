import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';
import { ITXClient } from '../../database/transaction';
import { InvoiceListQuery } from './invoices.types';

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

  static async getInvoiceWithItems(id: string, tx?: ITXClient) {
    const db = tx ?? prisma;
    return db.invoice.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  static async lockInvoiceForUpdate(invoiceId: string, tx: ITXClient): Promise<void> {
    await tx.$queryRaw`
      SELECT "id"
      FROM "invoices"
      WHERE "id" = ${invoiceId}::uuid
      FOR UPDATE
    `;
  }

  static async updateInvoice(
    invoiceId: string,
    data: Prisma.InvoiceUncheckedUpdateInput,
    tx: ITXClient,
  ) {
    return tx.invoice.update({
      where: { id: invoiceId },
      data,
    });
  }

  static async deleteInvoiceItems(invoiceId: string, tx: ITXClient) {
    return tx.invoiceItem.deleteMany({
      where: { invoiceId },
    });
  }

  static async hasActiveRecordedPayments(invoiceId: string, tx: ITXClient): Promise<boolean> {
    const count = await tx.payment.count({
      where: {
        invoiceId,
        status: 'RECORDED',
      },
    });
    return count > 0;
  }

  static async hasPendingEmailDeliveries(invoiceId: string, tx: ITXClient): Promise<boolean> {
    const count = await tx.emailDelivery.count({
      where: {
        invoiceId,
        status: 'PENDING',
      },
    });
    return count > 0;
  }

  static async markInvoiceCancelled(
    invoiceId: string,
    data: {
      cancelledAt: Date;
      cancellationReason: string;
    },
    tx: ITXClient,
  ) {
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: data.cancelledAt,
        cancellationReason: data.cancellationReason,
      },
    });
  }

  static async updateInvoiceItemFinancials(
    itemId: string,
    calculatedValues: {
      discountAmount: Prisma.Decimal | string;
      taxableAmount: Prisma.Decimal | string;
      gstRate: Prisma.Decimal | string;
      cgstAmount: Prisma.Decimal | string;
      sgstAmount: Prisma.Decimal | string;
      igstAmount: Prisma.Decimal | string;
      totalAmount: Prisma.Decimal | string;
    },
    tx: ITXClient,
  ) {
    return tx.invoiceItem.update({
      where: { id: itemId },
      data: {
        discountAmount: calculatedValues.discountAmount,
        taxableAmount: calculatedValues.taxableAmount,
        gstRate: calculatedValues.gstRate,
        cgstAmount: calculatedValues.cgstAmount,
        sgstAmount: calculatedValues.sgstAmount,
        igstAmount: calculatedValues.igstAmount,
        totalAmount: calculatedValues.totalAmount,
      },
    });
  }

  static async listInvoices(query: InvoiceListQuery) {
    const where = this.buildWhereClause(query);
    const skip = (query.page - 1) * query.limit;

    return prisma.invoice.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  static async countInvoices(query: InvoiceListQuery) {
    const where = this.buildWhereClause(query);
    return prisma.invoice.count({ where });
  }

  private static buildWhereClause(query: InvoiceListQuery): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    const parseUTC = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    };

    if (query.invoiceDateFrom || query.invoiceDateTo) {
      where.invoiceDate = {};
      if (query.invoiceDateFrom) where.invoiceDate.gte = parseUTC(query.invoiceDateFrom);
      if (query.invoiceDateTo) where.invoiceDate.lte = parseUTC(query.invoiceDateTo);
    }
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) where.dueDate.gte = parseUTC(query.dueDateFrom);
      if (query.dueDateTo) where.dueDate.lte = parseUTC(query.dueDateTo);
    }

    return where;
  }

  static async safelyEstablishInvoiceCounter(financialYear: string, prefix: string, tx: ITXClient) {
    await tx.$executeRaw`
      INSERT INTO "invoice_counters" ("id", "financialYear", "prefix", "nextSequence", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${financialYear}, ${prefix}, 1, NOW(), NOW())
      ON CONFLICT ("financialYear", "prefix") DO NOTHING
    `;
  }

  static async lockInvoiceCounterForUpdate(financialYear: string, prefix: string, tx: ITXClient) {
    const rows = await tx.$queryRaw<Array<{ id: string; nextSequence: number }>>`
      SELECT "id", "nextSequence"
      FROM "invoice_counters"
      WHERE "financialYear" = ${financialYear} AND "prefix" = ${prefix}
      FOR UPDATE
    `;
    return rows[0] || null;
  }

  static async incrementInvoiceCounter(id: string, tx: ITXClient) {
    await tx.$executeRaw`
      UPDATE "invoice_counters"
      SET "nextSequence" = "nextSequence" + 1, "updatedAt" = NOW()
      WHERE "id" = ${id}::uuid
    `;
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
