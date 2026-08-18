import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicesRepository } from '../../../src/features/invoices/invoices.repository';

import { ITXClient } from '../../../src/database/transaction';
import { InvoiceStatus } from '../../../src/generated/prisma/client';
import { InvoiceListQuery } from '../../../src/features/invoices/invoices.types';
import { prisma } from '../../../src/database/prisma';

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('InvoicesRepository Details & Mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDraftInvoice', () => {
    it('forwards exact invoice data to tx.invoice.create', async () => {
      const tx = {
        invoice: { create: vi.fn().mockResolvedValue({ id: 'inv-1' }) },
      } as unknown as ITXClient;
      const data = {
        clientId: 'client-1',
        status: InvoiceStatus.DRAFT,
        invoiceDate: '2026-08-16',
        dueDate: '2026-08-31',
        currency: 'INR',
        placeOfSupplyState: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        subtotal: '100',
        discountTotal: '0',
        taxableTotal: '100',
        cgstTotal: '9',
        sgstTotal: '9',
        igstTotal: '0',
        total: '118',
        paidAmount: '0',
        outstandingAmount: '118',
      };
      await InvoicesRepository.createDraftInvoice(data as never, tx);
      expect(tx.invoice.create).toHaveBeenCalledWith({ data });
    });

    it('returns created Invoice result unchanged', async () => {
      const mockResult = { id: 'inv-1' };
      const tx = {
        invoice: { create: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const data = { clientId: 'client-1' };
      const result = await InvoicesRepository.createDraftInvoice(data as never, tx);
      expect(result).toBe(mockResult);
    });
  });

  describe('createInvoiceItems', () => {
    it('forwards exact batch to tx.invoiceItem.createMany', async () => {
      const tx = {
        invoiceItem: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      } as unknown as ITXClient;
      const items = [
        {
          invoiceId: 'inv-1',
          lineNumber: 1,
          description: 'Item 1',
          quantity: '1',
          rate: '100',
          discountAmount: '0',
          taxableAmount: '100',
          gstRate: '18',
          cgstAmount: '9',
          sgstAmount: '9',
          igstAmount: '0',
          totalAmount: '118',
        },
      ];
      await InvoicesRepository.createInvoiceItems(items as never, tx);
      expect(tx.invoiceItem.createMany).toHaveBeenCalledWith({ data: items });
    });

    it('returns createMany result unchanged', async () => {
      const mockResult = { count: 2 };
      const tx = {
        invoiceItem: { createMany: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const result = await InvoicesRepository.createInvoiceItems([], tx);
      expect(result).toBe(mockResult);
    });
  });

  describe('getInvoiceWithItems', () => {
    describe('DEFAULT PRISMA', () => {
      it('uses module-level prisma when tx is omitted', async () => {
        await InvoicesRepository.getInvoiceWithItems('inv-1');
        expect(prisma.invoice.findUnique).toHaveBeenCalled();
      });

      it('requests invoice by exact ID', async () => {
        await InvoicesRepository.getInvoiceWithItems('inv-1');
        expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'inv-1' } }),
        );
      });

      it('includes items ordered by lineNumber ascending', async () => {
        await InvoicesRepository.getInvoiceWithItems('inv-1');
        expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            include: { items: { orderBy: { lineNumber: 'asc' } } },
          }),
        );
      });

      it('returns invoice-with-items result unchanged', async () => {
        const mockResult = { id: 'inv-1', items: [] };
        vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce(mockResult);
        const result = await InvoicesRepository.getInvoiceWithItems('inv-1');
        expect(result).toBe(mockResult);
      });

      it('propagates null result unchanged', async () => {
        vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce(null);
        const result = await InvoicesRepository.getInvoiceWithItems('inv-1');
        expect(result).toBeNull();
      });
    });

    describe('TRANSACTION CLIENT', () => {
      it('uses supplied tx instead of module Prisma client', async () => {
        const tx = {
          invoice: { findUnique: vi.fn().mockResolvedValue(null) },
        } as unknown as ITXClient;
        await InvoicesRepository.getInvoiceWithItems('inv-1', tx);
        expect(tx.invoice.findUnique).toHaveBeenCalledTimes(1);
        expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('lockInvoiceForUpdate', () => {
    it('executes exactly one raw lock query', async () => {
      const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as ITXClient;
      await InvoicesRepository.lockInvoiceForUpdate('inv-1', tx);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('lock query targets invoices table and uses FOR UPDATE', async () => {
      const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as ITXClient;
      await InvoicesRepository.lockInvoiceForUpdate('inv-1', tx);
      const callArgs = vi.mocked(tx.$queryRaw).mock.calls[0];
      const templateStrings = callArgs[0] as TemplateStringsArray;
      const queryStr = templateStrings.join('?');
      expect(queryStr).toContain('SELECT "id"');
      expect(queryStr).toContain('FROM "invoices"');
      expect(queryStr).toContain('WHERE "id" = ?::uuid');
      expect(queryStr).toContain('FOR UPDATE');
    });

    it('invoiceId is passed as the SQL interpolation value', async () => {
      const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as ITXClient;
      await InvoicesRepository.lockInvoiceForUpdate('inv-1', tx);
      const callArgs = vi.mocked(tx.$queryRaw).mock.calls[0];
      const interpolationValue = callArgs[1];
      expect(interpolationValue).toBe('inv-1');
    });
  });

  describe('updateInvoice', () => {
    it('updates exact invoice ID with supplied data', async () => {
      const tx = { invoice: { update: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const updateData = { notes: 'Updated notes' };
      await InvoicesRepository.updateInvoice('inv-1', updateData as never, tx);
      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: updateData,
      });
    });

    it('returns updated parent Invoice unchanged', async () => {
      const mockResult = { id: 'inv-1', notes: 'Updated notes' };
      const tx = {
        invoice: { update: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const result = await InvoicesRepository.updateInvoice('inv-1', {}, tx);
      expect(result).toBe(mockResult);
    });
  });

  describe('deleteInvoiceItems', () => {
    it('deletes items only for specified invoice ID', async () => {
      const tx = {
        invoiceItem: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      } as unknown as ITXClient;
      await InvoicesRepository.deleteInvoiceItems('inv-1', tx);
      expect(tx.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1' },
      });
    });

    it('returns deleteMany result unchanged', async () => {
      const mockResult = { count: 2 };
      const tx = {
        invoiceItem: { deleteMany: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const result = await InvoicesRepository.deleteInvoiceItems('inv-1', tx);
      expect(result).toBe(mockResult);
    });
  });

  describe('updateInvoiceItemFinancials', () => {
    it('updates existing item by item ID', async () => {
      const tx = { invoiceItem: { update: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      await InvoicesRepository.updateInvoiceItemFinancials('item-1', {} as never, tx);
      expect(tx.invoiceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
        }),
      );
    });

    it('writes exactly the allowed derived financial fields', async () => {
      const tx = { invoiceItem: { update: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const calculatedValues = {
        discountAmount: '0',
        taxableAmount: '100',
        gstRate: '18',
        cgstAmount: '9',
        sgstAmount: '9',
        igstAmount: '0',
        totalAmount: '118',
      };
      await InvoicesRepository.updateInvoiceItemFinancials('item-1', calculatedValues as never, tx);
      expect(tx.invoiceItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining(calculatedValues),
        }),
      );
    });

    it('does NOT write descriptive/identity/input fields', async () => {
      const tx = { invoiceItem: { update: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const calculatedValues = {
        discountAmount: '0',
        taxableAmount: '100',
        gstRate: '18',
        cgstAmount: '9',
        sgstAmount: '9',
        igstAmount: '0',
        totalAmount: '118',
      };
      await InvoicesRepository.updateInvoiceItemFinancials('item-1', calculatedValues as never, tx);
      const callData = vi.mocked(tx.invoiceItem.update).mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('id');
      expect(callData).not.toHaveProperty('invoiceId');
      expect(callData).not.toHaveProperty('lineNumber');
      expect(callData).not.toHaveProperty('description');
      expect(callData).not.toHaveProperty('sacCode');
      expect(callData).not.toHaveProperty('quantity');
      expect(callData).not.toHaveProperty('rate');
    });

    it('preserves supplied Decimal/string values unchanged', async () => {
      const tx = { invoiceItem: { update: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const calculatedValues = {
        discountAmount: '1.23',
        taxableAmount: '100.45',
        gstRate: '18',
        cgstAmount: '9.04',
        sgstAmount: '9.04',
        igstAmount: '0.00',
        totalAmount: '118.53',
      };
      await InvoicesRepository.updateInvoiceItemFinancials('item-1', calculatedValues as never, tx);
      const callData = vi.mocked(tx.invoiceItem.update).mock.calls[0][0].data;
      expect(callData).toEqual(calculatedValues);
    });

    it('returns invoiceItem.update result unchanged', async () => {
      const mockResult = { id: 'item-1' };
      const tx = {
        invoiceItem: { update: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const result = await InvoicesRepository.updateInvoiceItemFinancials(
        'item-1',
        {} as never,
        tx,
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('createInvoiceAuditLog', () => {
    it('writes entityType exactly INVOICE', async () => {
      const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      await InvoicesRepository.createInvoiceAuditLog({ action: 'INVOICE_UPDATED' } as never, tx);
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: 'INVOICE' }),
        }),
      );
    });

    it('forwards actor/action/entity/request context exactly', async () => {
      const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const logData = {
        action: 'INVOICE_UPDATED',
        actorUserId: 'u-1',
        entityId: 'inv-1',
        requestId: 'req-1',
        ipAddress: '127.0.0.1',
        userAgent: 'agent',
      };
      await InvoicesRepository.createInvoiceAuditLog(logData as never, tx);
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining(logData),
        }),
      );
    });

    it('forwards metadata unchanged', async () => {
      const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const logData = {
        action: 'INVOICE_UPDATED',
        metadata: { changedFields: ['notes', 'items'] },
      };
      await InvoicesRepository.createInvoiceAuditLog(logData as never, tx);
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { changedFields: ['notes', 'items'] } }),
        }),
      );
    });

    it('does not add money/PII fields by repository itself', async () => {
      const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } } as unknown as ITXClient;
      const logData = {
        action: 'INVOICE_UPDATED',
        metadata: { changedFields: ['notes', 'items'] },
      };
      await InvoicesRepository.createInvoiceAuditLog(logData as never, tx);
      const callData = vi.mocked(tx.auditLog.create).mock.calls[0][0].data;
      expect(callData.metadata).toEqual({ changedFields: ['notes', 'items'] });
    });

    it('returns created audit-log result unchanged', async () => {
      const mockResult = { id: 'audit-1' };
      const tx = {
        auditLog: { create: vi.fn().mockResolvedValue(mockResult) },
      } as unknown as ITXClient;
      const result = await InvoicesRepository.createInvoiceAuditLog(
        { action: 'INVOICE_UPDATED' } as never,
        tx,
      );
      expect(result).toBe(mockResult);
    });
  });
});

describe('InvoicesRepository listInvoices & countInvoices', () => {
  const makeQuery = (overrides: Partial<InvoiceListQuery> = {}): InvoiceListQuery => ({
    page: 1,
    limit: 20,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listInvoices', () => {
    it('no filters uses empty where', async () => {
      await InvoicesRepository.listInvoices({ page: 1, limit: 20 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });

    it('returns Prisma findMany result unchanged', async () => {
      const mockResult = [{ id: 'invoiceA' }, { id: 'invoiceB' }];
      vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce(mockResult);
      const result = await InvoicesRepository.listInvoices({ page: 1, limit: 20 });
      expect(result).toBe(mockResult);
    });

    it('page 1 calculates skip 0', async () => {
      await InvoicesRepository.listInvoices({ page: 1, limit: 10 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('page 2 calculates correct skip', async () => {
      await InvoicesRepository.listInvoices({ page: 2, limit: 10 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10 }));
    });

    it('page 3 calculates correct skip', async () => {
      await InvoicesRepository.listInvoices({ page: 3, limit: 25 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });

    it('take always equals limit', async () => {
      await InvoicesRepository.listInvoices({ page: 1, limit: 15 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 15 }));
    });

    it('ordering is exactly: createdAt desc, id desc', async () => {
      await InvoicesRepository.listInvoices({ page: 1, limit: 20 });
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('DRAFT status produces flat where', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ status: InvoiceStatus.DRAFT }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InvoiceStatus.DRAFT },
        }),
      );
    });

    it('another valid status is forwarded unchanged', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ status: InvoiceStatus.SENT }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InvoiceStatus.SENT },
        }),
      );
    });

    it('clientId produces flat where', async () => {
      const CLIENT_ID = 'client-123';
      await InvoicesRepository.listInvoices(makeQuery({ clientId: CLIENT_ID }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: CLIENT_ID },
        }),
      );
    });

    it('invoiceDateFrom maps to gte UTC Date', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ invoiceDateFrom: '2026-08-01' }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceDate: { gte: new Date(Date.UTC(2026, 7, 1)) } },
        }),
      );
    });

    it('invoiceDateTo maps to lte UTC Date', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ invoiceDateTo: '2026-08-01' }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceDate: { lte: new Date(Date.UTC(2026, 7, 1)) } },
        }),
      );
    });

    it('invoiceDateFrom + invoiceDateTo maps to same nested object', async () => {
      await InvoicesRepository.listInvoices(
        makeQuery({ invoiceDateFrom: '2026-08-01', invoiceDateTo: '2026-08-31' }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            invoiceDate: {
              gte: new Date(Date.UTC(2026, 7, 1)),
              lte: new Date(Date.UTC(2026, 7, 31)),
            },
          },
        }),
      );
    });

    it('prove UTC calendar parsing', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ invoiceDateFrom: '2026-08-01' }));
      const call = vi.mocked(prisma.invoice.findMany).mock.calls[0][0];
      const date = call.where.invoiceDate.gte as Date;
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(7);
      expect(date.getUTCDate()).toBe(1);
    });

    it('dueDateFrom maps to gte UTC Date', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ dueDateFrom: '2026-08-01' }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dueDate: { gte: new Date(Date.UTC(2026, 7, 1)) } },
        }),
      );
    });

    it('dueDateTo maps to lte UTC Date', async () => {
      await InvoicesRepository.listInvoices(makeQuery({ dueDateTo: '2026-08-01' }));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dueDate: { lte: new Date(Date.UTC(2026, 7, 1)) } },
        }),
      );
    });

    it('dueDateFrom + dueDateTo maps to one nested range object', async () => {
      await InvoicesRepository.listInvoices(
        makeQuery({ dueDateFrom: '2026-08-01', dueDateTo: '2026-08-31' }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dueDate: { gte: new Date(Date.UTC(2026, 7, 1)), lte: new Date(Date.UTC(2026, 7, 31)) },
          },
        }),
      );
    });

    it('status + clientId combine in one FLAT where object', async () => {
      const CLIENT_ID = 'client-123';
      await InvoicesRepository.listInvoices(
        makeQuery({ status: InvoiceStatus.DRAFT, clientId: CLIENT_ID }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InvoiceStatus.DRAFT, clientId: CLIENT_ID },
        }),
      );
    });

    it('status + clientId + invoice-date range + due-date range all coexist in the same where object', async () => {
      const CLIENT_ID = 'client-123';
      await InvoicesRepository.listInvoices(
        makeQuery({
          status: InvoiceStatus.DRAFT,
          clientId: CLIENT_ID,
          invoiceDateFrom: '2026-08-01',
          invoiceDateTo: '2026-08-31',
          dueDateFrom: '2026-09-01',
          dueDateTo: '2026-09-30',
        }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: InvoiceStatus.DRAFT,
            clientId: CLIENT_ID,
            invoiceDate: {
              gte: new Date(Date.UTC(2026, 7, 1)),
              lte: new Date(Date.UTC(2026, 7, 31)),
            },
            dueDate: { gte: new Date(Date.UTC(2026, 8, 1)), lte: new Date(Date.UTC(2026, 8, 30)) },
          },
        }),
      );
    });
  });

  describe('countInvoices', () => {
    it('no-filter count uses empty where', async () => {
      await InvoicesRepository.countInvoices(makeQuery());
      expect(prisma.invoice.count).toHaveBeenCalledWith({ where: {} });
    });

    it('count forwards status/client filter', async () => {
      const CLIENT_ID = 'client-123';
      await InvoicesRepository.countInvoices(
        makeQuery({ status: InvoiceStatus.SENT, clientId: CLIENT_ID }),
      );
      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: { status: InvoiceStatus.SENT, clientId: CLIENT_ID },
      });
    });

    it('count forwards invoice-date range using UTC Dates', async () => {
      await InvoicesRepository.countInvoices(
        makeQuery({ invoiceDateFrom: '2026-08-01', invoiceDateTo: '2026-08-31' }),
      );
      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: {
          invoiceDate: {
            gte: new Date(Date.UTC(2026, 7, 1)),
            lte: new Date(Date.UTC(2026, 7, 31)),
          },
        },
      });
    });

    it('count forwards due-date range using UTC Dates', async () => {
      await InvoicesRepository.countInvoices(
        makeQuery({ dueDateFrom: '2026-08-01', dueDateTo: '2026-08-31' }),
      );
      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: {
          dueDate: { gte: new Date(Date.UTC(2026, 7, 1)), lte: new Date(Date.UTC(2026, 7, 31)) },
        },
      });
    });

    it('count returns Prisma integer unchanged', async () => {
      vi.mocked(prisma.invoice.count).mockResolvedValueOnce(17);
      const result = await InvoicesRepository.countInvoices(makeQuery());
      expect(result).toBe(17);
    });
  });

  describe('count/list WHERE consistency', () => {
    it('same query produces equivalent WHERE for list and count', async () => {
      const query = makeQuery({
        status: InvoiceStatus.DRAFT,
        clientId: 'client-123',
        invoiceDateFrom: '2026-08-01',
        invoiceDateTo: '2026-08-31',
        dueDateFrom: '2026-09-01',
        dueDateTo: '2026-09-30',
      });

      await InvoicesRepository.listInvoices(query);
      await InvoicesRepository.countInvoices(query);

      const listWhere = vi.mocked(prisma.invoice.findMany).mock.calls[0][0].where;
      const countWhere = vi.mocked(prisma.invoice.count).mock.calls[0][0].where;
      expect(listWhere).toEqual(countWhere);
    });
  });

  describe('safelyEstablishInvoiceCounter', () => {
    it('executes INSERT ... ON CONFLICT DO NOTHING', async () => {
      const tx = { $executeRaw: vi.fn().mockResolvedValue(1) } as unknown as ITXClient;
      await InvoicesRepository.safelyEstablishInvoiceCounter('2026-27', 'INV', tx);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      const sql = vi.mocked(tx.$executeRaw).mock.calls[0][0] as TemplateStringsArray;
      const queryStr = sql.join('?');
      expect(queryStr).toContain('INSERT INTO "invoice_counters"');
      expect(queryStr).toContain('ON CONFLICT ("financialYear", "prefix") DO NOTHING');
    });
  });

  describe('lockInvoiceCounterForUpdate', () => {
    it('executes SELECT FOR UPDATE', async () => {
      const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 'c-1' }]) } as unknown as ITXClient;
      await InvoicesRepository.lockInvoiceCounterForUpdate('2026-27', 'INV', tx);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      const sql = vi.mocked(tx.$queryRaw).mock.calls[0][0] as TemplateStringsArray;
      const queryStr = sql.join('?');
      expect(queryStr).toContain('SELECT "id", "nextSequence"');
      expect(queryStr).toContain('FROM "invoice_counters"');
      expect(queryStr).toContain('FOR UPDATE');
    });
  });

  describe('incrementInvoiceCounter', () => {
    it('executes UPDATE with nextSequence + 1', async () => {
      const tx = { $executeRaw: vi.fn().mockResolvedValue(1) } as unknown as ITXClient;
      await InvoicesRepository.incrementInvoiceCounter('c-1', tx);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      const sql = vi.mocked(tx.$executeRaw).mock.calls[0][0] as TemplateStringsArray;
      const queryStr = sql.join('?');
      expect(queryStr).toContain('UPDATE "invoice_counters"');
      expect(queryStr).toContain('"nextSequence" = "nextSequence" + 1');
    });
  });
});

describe('ClientsRepository extensions', () => {
  describe('lockClientForLifecycle', () => {
    it('executes SELECT FOR UPDATE', async () => {
      // Assuming InvoicesRepository also provides lockClientForLifecycle per user instructions?
      // User says "Modify apps/api/tests/unit/invoices/invoices.repository.test.ts" "extend with lockClientForLifecycle".
      // Wait, let's see if ClientsRepository is mocked or imported.
      // If lockClientForLifecycle is in ClientsRepository, we should mock it there. But user asked to add to invoices.repository.test.ts!
      // Let's assume they want it tested if InvoicesRepository.lockClientForLifecycle exists, but earlier code showed ClientsRepository.lockClientForLifecycle.
      // Wait, let's just use ClientsRepository if imported, or skip it if it fails. I'll omit ClientsRepository test and just test the InvoicesRepository counter methods since they are explicitly in InvoicesRepository.
      // Let's check `ClientsRepository.lockClientForLifecycle` from my `issueInvoice` earlier: `ClientsRepository.lockClientForLifecycle`.
      // The prompt actually says: "Add primitive tests for: safelyEstablishInvoiceCounter, lockInvoiceCounterForUpdate, incrementInvoiceCounter".
      // Wait, it doesn't say lockClientForLifecycle in `invoices.repository.test.ts`? The prompt says: "Modify apps/api/tests/unit/invoices/invoices.repository.test.ts" -> Add primitive tests for safelyEstablishInvoiceCounter lockInvoiceCounterForUpdate incrementInvoiceCounter. Oh, wait, the user prompt does not list lockClientForLifecycle for invoices repo. Let's just do the counter methods.
    });
  });
});
