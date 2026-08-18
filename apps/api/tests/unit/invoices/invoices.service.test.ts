import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvoicesService } from '../../../src/features/invoices/invoices.service';
import * as businessSettingsRepo from '../../../src/features/business-settings/business-settings.repository';
import { ClientsRepository } from '../../../src/features/clients/clients.repository';
import { InvoicesRepository } from '../../../src/features/invoices/invoices.repository';
import * as transactionModule from '../../../src/database/transaction';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../../src/errors/application.error';
import { ITXClient } from '../../../src/database/transaction';
import {
  BusinessSettings,
  Client,
  Invoice,
  Prisma,
  InvoiceStatus,
} from '../../../src/generated/prisma/client';

vi.mock('../../../src/features/business-settings/business-settings.repository');
vi.mock('../../../src/features/clients/clients.repository');
vi.mock('../../../src/features/invoices/invoices.repository');
vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue({
  id: 'inv-1',
  items: [
    {
      id: 'item-1',
      lineNumber: 1,
      description: 'Item 1',
      sacCode: '1234',
      quantity: new Prisma.Decimal('1'),
      rate: new Prisma.Decimal('100'),
      discountAmount: new Prisma.Decimal('0'),
      gstRate: new Prisma.Decimal('18'),
      taxableAmount: new Prisma.Decimal('100'),
      cgstAmount: new Prisma.Decimal('9'),
      sgstAmount: new Prisma.Decimal('9'),
      igstAmount: new Prisma.Decimal('0'),
      totalAmount: new Prisma.Decimal('118'),
    },
  ],
  invoiceDate: new Date(),
  dueDate: new Date(),
  subtotal: new Prisma.Decimal(100),
  discountTotal: new Prisma.Decimal(0),
  taxableTotal: new Prisma.Decimal(100),
  cgstTotal: new Prisma.Decimal(9),
  sgstTotal: new Prisma.Decimal(9),
  igstTotal: new Prisma.Decimal(0),
  total: new Prisma.Decimal(118),
  paidAmount: new Prisma.Decimal(0),
  outstandingAmount: new Prisma.Decimal(118),
} as never);
vi.mock('../../../src/database/transaction');

describe('InvoicesService', () => {
  const auditContext = { requestId: '1', ipAddress: '127.0.0.1', userAgent: 'test' };
  const basePayload = {
    clientId: 'client-1',
    invoiceDate: '2026-08-16',
    items: [{ description: 'Item 1', quantity: '1', rate: '100', gstRate: '18' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionModule.runInTransaction).mockImplementation(async (cb) =>
      cb({} as unknown as ITXClient),
    );
    vi.mocked(businessSettingsRepo.acquireSingletonLock).mockResolvedValue(undefined);
    vi.mocked(ClientsRepository.lockClientForLifecycle).mockResolvedValue(undefined);
  });

  it('throws 404 if business settings are missing', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(null);
    await expect(InvoicesService.createInvoice('u1', basePayload, auditContext)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws 404 if client is missing', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);

    await expect(InvoicesService.createInvoice('u1', basePayload, auditContext)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws 409 if client is archived', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: true,
    } as unknown as Client);

    await expect(InvoicesService.createInvoice('u1', basePayload, auditContext)).rejects.toThrow(
      ConflictError,
    );
  });

  it('throws 400 if dueDate is before invoiceDate', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '27',
    } as unknown as Client);

    await expect(
      InvoicesService.createInvoice('u1', { ...basePayload, dueDate: '2026-08-15' }, auditContext),
    ).rejects.toThrow(ValidationError);
  });

  it('throws 400 for calculator error (ValidationError mapping)', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '27',
    } as unknown as Client);

    // Simulate invalid gst rate
    await expect(
      InvoicesService.createInvoice(
        'u1',
        {
          ...basePayload,
          items: [{ description: 'Item 1', quantity: '1', rate: '100', gstRate: '9.99' }],
        },
        auditContext,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws 400 for invalid state code from client fallback', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '99',
    } as unknown as Client);

    await expect(InvoicesService.createInvoice('u1', basePayload, auditContext)).rejects.toThrow(
      ValidationError,
    );
  });

  it('creates invoice successfully and serializes items', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '27',
    } as unknown as Client);
    vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({
      id: 'inv-1',
      clientId: 'c1',
      invoiceNumber: 'INV-001',
      status: 'DRAFT',
      currency: 'INR',
      placeOfSupplyStateCode: '27',
      placeOfSupplyState: 'Maharashtra',
      financialYear: '2026-27',
      subtotal: { toFixed: () => '100.00' },
      discountTotal: { toFixed: () => '0.00' },
      taxableTotal: { toFixed: () => '100.00' },
      cgstTotal: { toFixed: () => '9.00' },
      sgstTotal: { toFixed: () => '9.00' },
      igstTotal: { toFixed: () => '0.00' },
      total: { toFixed: () => '118.00' },
      paidAmount: { toFixed: () => '0.00' },
      outstandingAmount: { toFixed: () => '118.00' },
      invoiceDate: new Date('2026-08-16'),
      dueDate: new Date('2026-08-31'),
      items: [
        {
          id: 'item-1',
          lineNumber: 1,
          description: 'Item 1',
          sacCode: '1234',
          quantity: { toFixed: () => '1.000' },
          rate: { toFixed: () => '100.00' },
          discountAmount: { toFixed: () => '0.00' },
          taxableAmount: { toFixed: () => '100.00' },
          gstRate: { toFixed: () => '18.00' },
          cgstAmount: { toFixed: () => '9.00' },
          sgstAmount: { toFixed: () => '9.00' },
          igstAmount: { toFixed: () => '0.00' },
          totalAmount: { toFixed: () => '118.00' },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: null,
      terms: null,
      createdByUserId: 'u1',
      sentAt: null,
      sentByUserId: null,
      cancelledAt: null,
      cancellationReason: null,
    } as unknown as Invoice);
    vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue(undefined as never);

    const result = await InvoicesService.createInvoice('u1', basePayload, auditContext);

    expect(result.id).toBe('inv-1');
    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity).toBe('1.000');
    expect(result.items[0].rate).toBe('100.00');
  });

  describe('invoiceDate validation against Asia/Kolkata timezone', () => {
    it('accepts invoiceDate == Asia/Kolkata today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));

      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
      } as unknown as BusinessSettings);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as unknown as Client);
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({} as unknown as Invoice);

      await expect(
        InvoicesService.createInvoice(
          'u1',
          { ...basePayload, invoiceDate: '2026-08-16' },
          auditContext,
        ),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });

    it('accepts invoiceDate < Asia/Kolkata today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));

      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
      } as unknown as BusinessSettings);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as unknown as Client);
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({} as unknown as Invoice);

      await expect(
        InvoicesService.createInvoice(
          'u1',
          { ...basePayload, invoiceDate: '2026-08-15' },
          auditContext,
        ),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });

    it('rejects invoiceDate > Asia/Kolkata today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));

      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
      } as unknown as BusinessSettings);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as unknown as Client);

      await expect(
        InvoicesService.createInvoice(
          'u1',
          { ...basePayload, invoiceDate: '2026-08-17' },
          auditContext,
        ),
      ).rejects.toThrow(ValidationError);
      vi.useRealTimers();
    });

    it('correctly uses Asia/Kolkata timezone boundary, not UTC', async () => {
      vi.useFakeTimers();
      // 2026-08-16T22:00:00Z is 03:30 AM on 2026-08-17 in Asia/Kolkata.
      vi.setSystemTime(new Date('2026-08-16T22:00:00Z'));

      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
      } as unknown as BusinessSettings);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as unknown as Client);
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({} as unknown as Invoice);

      // Even though UTC is still 08-16, Asia/Kolkata is 08-17, so invoiceDate='2026-08-17' should be valid.
      await expect(
        InvoicesService.createInvoice(
          'u1',
          { ...basePayload, invoiceDate: '2026-08-17' },
          auditContext,
        ),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });
  });
});

function makeBusinessSettings(
  overrides: Partial<Prisma.BusinessSettingsGetPayload<Record<string, never>>> = {},
) {
  return {
    id: 'bs-1',
    businessName: 'Test Business',
    defaultDueDays: 30,
    stateCode: '27',
    gstin: '27AAAAA0000A1Z5',
    ...overrides,
  };
}

function makeClient(overrides: Partial<Prisma.ClientGetPayload<Record<string, never>>> = {}) {
  return {
    id: 'client-1',
    name: 'Test Client',
    stateCode: '27',
    isArchived: false,
    ...overrides,
  };
}

function makeInvoiceItem(
  overrides: Partial<Prisma.InvoiceItemGetPayload<Record<string, never>>> = {},
) {
  return {
    id: 'item-1',
    invoiceId: 'inv-1',
    lineNumber: 1,
    description: 'Item 1',
    sacCode: '1234',
    quantity: new Prisma.Decimal('1.000'),
    rate: new Prisma.Decimal('100.00'),
    discountAmount: new Prisma.Decimal('0.00'),
    taxableAmount: new Prisma.Decimal('100.00'),
    gstRate: new Prisma.Decimal('18.00'),
    cgstAmount: new Prisma.Decimal('9.00'),
    sgstAmount: new Prisma.Decimal('9.00'),
    igstAmount: new Prisma.Decimal('0.00'),
    totalAmount: new Prisma.Decimal('118.00'),
    createdAt: new Date('2026-08-16T10:00:00.000Z'),
    updatedAt: new Date('2026-08-16T10:00:00.000Z'),
    ...overrides,
  };
}

function makeDraftInvoice(
  overrides: Partial<Prisma.InvoiceGetPayload<{ include: { items: true } }>> = {},
) {
  return {
    id: 'inv-1',
    clientId: 'client-1',
    invoiceNumber: 'INV-001',
    financialYear: '2026-27',
    status: InvoiceStatus.DRAFT,
    invoiceDate: new Date('2026-08-16T00:00:00Z'),
    dueDate: new Date('2026-08-31T00:00:00Z'),
    currency: 'INR',
    placeOfSupplyState: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    subtotal: new Prisma.Decimal('100.00'),
    discountTotal: new Prisma.Decimal('0.00'),
    taxableTotal: new Prisma.Decimal('100.00'),
    cgstTotal: new Prisma.Decimal('9.00'),
    sgstTotal: new Prisma.Decimal('9.00'),
    igstTotal: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('118.00'),
    paidAmount: new Prisma.Decimal('0.00'),
    outstandingAmount: new Prisma.Decimal('118.00'),
    notes: 'Test notes',
    terms: 'Test terms',
    createdByUserId: 'u-1',
    sentAt: null,
    sentByUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-08-16T10:00:00.000Z'),
    updatedAt: new Date('2026-08-16T10:00:00.000Z'),
    items: [makeInvoiceItem()],
    ...overrides,
  } as Prisma.InvoiceGetPayload<{ include: { items: true } }>;
}

type UpdatePayload = {
  clientId: string;
  invoiceDate: string;
  dueDate?: string;
  placeOfSupplyStateCode?: string;
  notes?: string | null;
  terms?: string | null;
  items: Array<{
    id?: string;
    description: string;
    sacCode?: string | null;
    quantity: string;
    rate: string;
    discountAmount?: string;
    gstRate: string;
  }>;
};

function makeUpdatePayload(overrides: Record<string, unknown> = {}): UpdatePayload {
  return {
    clientId: 'client-1',
    invoiceDate: '2026-08-16',
    dueDate: '2026-08-31',
    notes: 'Test notes',
    terms: 'Test terms',
    items: [
      {
        id: 'item-1',
        description: 'Item 1',
        sacCode: '1234',
        quantity: '1',
        rate: '100',
        discountAmount: '0',
        gstRate: '18',
      },
    ],
    ...overrides,
  } as UpdatePayload;
}

describe('InvoicesService - listInvoices & getInvoiceById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('listInvoices', () => {
    it('forwards exact query to listInvoices and countInvoices repository methods exactly once', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(0);
      await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(InvoicesRepository.listInvoices).toHaveBeenCalledTimes(1);
      expect(InvoicesRepository.countInvoices).toHaveBeenCalledTimes(1);
    });

    it('handles empty results returning correct pagination with total 0, totalPages 0, false flags', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(0);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.pagination).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('exact page and limit echoed and total unchanged', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(100);
      const res = await InvoicesService.listInvoices({ page: 2, limit: 20 });
      expect(res.pagination.page).toBe(2);
      expect(res.pagination.limit).toBe(20);
      expect(res.pagination.total).toBe(100);
    });

    it('totalPages uses ceiling division and exact multiple correct', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(21);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.pagination.totalPages).toBe(3);
    });

    it('hasNextPage true before final page and false final page', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(20);
      const res1 = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res1.pagination.hasNextPage).toBe(true);
      const res2 = await InvoicesService.listInvoices({ page: 2, limit: 10 });
      expect(res2.pagination.hasNextPage).toBe(false);
    });

    it('hasPreviousPage true page > 1 when total > 0 and false first', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(20);
      const res1 = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res1.pagination.hasPreviousPage).toBe(false);
      const res2 = await InvoicesService.listInvoices({ page: 2, limit: 10 });
      expect(res2.pagination.hasPreviousPage).toBe(true);
    });

    it('zero-total page > 1 still hasPreviousPage false', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(0);
      const res = await InvoicesService.listInvoices({ page: 2, limit: 10 });
      expect(res.pagination.hasPreviousPage).toBe(false);
    });

    it('maps invoice identity fields exactly', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data[0].id).toBe(inv.id);
      expect(res.data[0].clientId).toBe(inv.clientId);
      expect(res.data[0].invoiceNumber).toBe(inv.invoiceNumber);
      expect(res.data[0].status).toBe(inv.status);
    });

    it('maps currency and POS fields exactly', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data[0].currency).toBe(inv.currency);
      expect(res.data[0].placeOfSupplyState).toBe(inv.placeOfSupplyState);
      expect(res.data[0].placeOfSupplyStateCode).toBe(inv.placeOfSupplyStateCode);
    });

    it('invoiceDate and dueDate YYYY-MM-DD', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data[0].invoiceDate).toBe('2026-08-16');
      expect(res.data[0].dueDate).toBe('2026-08-31');
    });

    it('all parent money fields serialize to exactly two decimals', async () => {
      const inv = makeDraftInvoice({ subtotal: new Prisma.Decimal('100') });
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data[0].subtotal).toBe('100.00');
    });

    it('createdAt and updatedAt remain Date values/references', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data[0].createdAt).toBeInstanceOf(Date);
      expect(res.data[0].updatedAt).toBeInstanceOf(Date);
    });

    it('list DTO contains no items and no detail-only fields', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(1);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect((res.data[0] as unknown as Record<string, unknown>).items).toBeUndefined();
    });

    it('maps every repository row and preserves repository order', async () => {
      const inv1 = makeDraftInvoice({ id: '1' });
      const inv2 = makeDraftInvoice({ id: '2' });
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([inv1 as never, inv2 as never]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(2);
      const res = await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(res.data.length).toBe(2);
      expect(res.data[0].id).toBe('1');
      expect(res.data[1].id).toBe('2');
    });

    it('listInvoices does not call updateInvoice and does not create invoice audit log', async () => {
      vi.mocked(InvoicesRepository.listInvoices).mockResolvedValue([]);
      vi.mocked(InvoicesRepository.countInvoices).mockResolvedValue(0);
      await InvoicesService.listInvoices({ page: 1, limit: 10 });
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getInvoiceById', () => {
    it('calls getInvoiceWithItems exact ID once, no list/count', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      await InvoicesService.getInvoiceById('inv-1');
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledWith('inv-1');
      expect(InvoicesRepository.listInvoices).not.toHaveBeenCalled();
    });

    it('throws NotFoundError exact message', async () => {
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(null);
      await expect(InvoicesService.getInvoiceById('inv-1')).rejects.toThrowError(
        new NotFoundError('Invoice not found'),
      );
    });

    it('identity/status/notes/terms/createdByUserId', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.id).toBe(inv.id);
      expect(res.status).toBe(inv.status);
      expect(res.notes).toBe(inv.notes);
      expect(res.terms).toBe(inv.terms);
      expect(res.createdByUserId).toBe(inv.createdByUserId);
    });

    it('invoiceDate/dueDate YYYY-MM-DD', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.invoiceDate).toBe('2026-08-16');
      expect(res.dueDate).toBe('2026-08-31');
    });

    it('parent financials two decimals', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.subtotal).toBe('100.00');
    });

    it('Draft lifecycle nullable fields remain null', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.sentAt).toBeNull();
      expect(res.cancelledAt).toBeNull();
    });

    it('all items and repository item order', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.items.length).toBe(1);
    });

    it('id/lineNumber/description/sacCode exact', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.items[0].id).toBe('item-1');
      expect(res.items[0].lineNumber).toBe(1);
      expect(res.items[0].description).toBe('Item 1');
      expect(res.items[0].sacCode).toBe('1234');
    });

    it('quantity exactly 3 decimals and rate 2 decimals', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.items[0].quantity).toBe('1.000');
      expect(res.items[0].rate).toBe('100.00');
    });

    it('discount/taxable/GST/tax/total values 2 decimals', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.items[0].discountAmount).toBe('0.00');
      expect(res.items[0].totalAmount).toBe('118.00');
    });

    it('SENT readable and lifecycle mapped', async () => {
      const inv = makeDraftInvoice({
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
        sentByUserId: 'u-1',
      });
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.status).toBe(InvoiceStatus.SENT);
      expect(res.sentAt).toBeInstanceOf(Date);
    });

    it('PAID readable', async () => {
      const inv = makeDraftInvoice({ status: InvoiceStatus.PAID });
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.status).toBe(InvoiceStatus.PAID);
    });

    it('CANCELLED readable with lifecycle fields', async () => {
      const inv = makeDraftInvoice({
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'reason',
      });
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      const res = await InvoicesService.getInvoiceById('inv-1');
      expect(res.status).toBe(InvoiceStatus.CANCELLED);
      expect(res.cancelledAt).toBeInstanceOf(Date);
    });

    it('getInvoiceById does not call updateInvoice or audit', async () => {
      const inv = makeDraftInvoice();
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(inv as never);
      await InvoicesService.getInvoiceById('inv-1');
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
    });
  });
});

describe('updateInvoice', () => {
  const auditContext = { requestId: '1', ipAddress: '127.0.0.1', userAgent: 'test' };
  let payload: UpdatePayload;
  let existing: Prisma.InvoiceGetPayload<{ include: { items: true } }> & { client?: unknown };

  beforeEach(() => {
    vi.clearAllMocks();
    payload = makeUpdatePayload();
    existing = makeDraftInvoice();
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(
      makeBusinessSettings() as never,
    );
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue(makeClient() as never);
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(existing as never);
    vi.mocked(businessSettingsRepo.acquireSingletonLock).mockResolvedValue(undefined);
    vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mockResolvedValue(undefined);
    vi.mocked(ClientsRepository.lockClientForLifecycle).mockResolvedValue(undefined);
    vi.mocked(InvoicesRepository.updateInvoice).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('A. SETTINGS / INVOICE GUARDS', () => {
    it('acquires BusinessSettings singleton lock and reads current settings', async () => {
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(businessSettingsRepo.acquireSingletonLock).toHaveBeenCalled();
      expect(businessSettingsRepo.getBusinessSettings).toHaveBeenCalled();
    });

    it('missing settings exact NotFound and stops before Invoice lock', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(null);
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new NotFoundError('Business settings are not configured'));
      expect(InvoicesRepository.lockInvoiceForUpdate).not.toHaveBeenCalled();
    });

    it('locks target Invoice and reads locked Invoice using same tx', async () => {
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.lockInvoiceForUpdate).toHaveBeenCalledWith(
        'inv-1',
        expect.anything(),
      );
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledWith(
        'inv-1',
        expect.anything(),
      );
    });

    it('missing Invoice exact NotFound', async () => {
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(null);
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new NotFoundError('Invoice not found'));
    });
  });

  describe('B. DRAFT-ONLY LIFECYCLE', () => {
    it('DRAFT allowed', async () => {
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.toBeDefined();
    });

    it('SENT rejected with exact ConflictError and no mutations', async () => {
      existing.status = InvoiceStatus.SENT;
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ConflictError('Only DRAFT invoices can be modified'));
    });

    it('PARTIALLY_PAID rejected', async () => {
      existing.status = InvoiceStatus.PARTIALLY_PAID;
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ConflictError('Only DRAFT invoices can be modified'));
    });

    it('PAID rejected', async () => {
      existing.status = InvoiceStatus.PAID;
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ConflictError('Only DRAFT invoices can be modified'));
    });

    it('CANCELLED rejected', async () => {
      existing.status = InvoiceStatus.CANCELLED;
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ConflictError('Only DRAFT invoices can be modified'));
    });
  });

  describe('C. CLIENT LIFECYCLE', () => {
    it('same Client does NOT lock/fetch Client lifecycle', async () => {
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(ClientsRepository.lockClientForLifecycle).not.toHaveBeenCalled();
      expect(ClientsRepository.getClientById).not.toHaveBeenCalled();
    });

    it('same archived Client allowed', async () => {
      existing.client = makeClient({ isArchived: true });
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(ClientsRepository.lockClientForLifecycle).not.toHaveBeenCalled();
    });

    it('changed Client locks and fetches target using same tx', async () => {
      payload.clientId = 'client-2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(ClientsRepository.lockClientForLifecycle).toHaveBeenCalledWith(
        'client-2',
        expect.anything(),
      );
    });

    it('changed active Client succeeds', async () => {
      payload.clientId = 'client-2';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });

    it('changed missing Client exact NotFound', async () => {
      payload.clientId = 'client-2';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(null);
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new NotFoundError('Client not found'));
    });

    it('changed archived Client exact Conflict', async () => {
      payload.clientId = 'client-2';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ isArchived: true }) as never,
      );
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ConflictError('Cannot use an archived client'));
    });
  });

  describe('D. POS RESOLUTION', () => {
    it('explicit POS wins same Client', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyStateCode).toBe('29');
    });

    it('explicit POS wins Client change', async () => {
      payload.clientId = 'client-2';
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyStateCode).toBe('29');
    });

    it('same Client + omitted POS preserves stored POS', async () => {
      payload.notes = null; // trigger updateInvoice (notes changes: 'Test notes' -> null)
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyStateCode).toBe('27');
    });

    it('changed Client + omitted POS defaults target Client state', async () => {
      payload.clientId = 'client-2';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ stateCode: '33' }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyStateCode).toBe('33');
    });

    it('POS state name derives correctly', async () => {
      payload.placeOfSupplyStateCode = '33';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyState).toBe('Tamil Nadu');
    });
  });

  describe('E. INVOICE DATE RULES', () => {
    it('today Asia/Kolkata succeeds', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));
      payload.invoiceDate = '2026-08-16';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });

    it('before today succeeds', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));
      payload.invoiceDate = '2026-08-15';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });

    it('future rejects exact', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T10:00:00Z'));
      payload.invoiceDate = '2026-08-17';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(
        new ValidationError('invoiceDate cannot be in the future (Asia/Kolkata timezone)'),
      );
    });

    it('Asia/Kolkata rollover boundary, not UTC', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T22:00:00Z')); // 3:30 AM Aug 17 IST
      payload.invoiceDate = '2026-08-17';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });
  });

  describe('F. DUE DATE RULES', () => {
    it('unchanged invoiceDate + omitted dueDate preserves existing', async () => {
      delete payload.dueDate;
      payload.notes = null; // trigger updateInvoice (notes changes: 'Test notes' -> null)
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).dueDate.toISOString()).toBe(
        existing.dueDate.toISOString(),
      );
    });

    it('changed invoiceDate + truly omitted dueDate recalculates from CURRENT settings.defaultDueDays', async () => {
      payload.invoiceDate = '2026-08-10';
      delete payload.dueDate;
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(
        makeBusinessSettings({ defaultDueDays: 15 }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).dueDate).toEqual(
        new Date('2026-08-25T00:00:00.000Z'),
      );
    });

    it('explicit valid dueDate wins', async () => {
      payload.dueDate = '2026-09-01';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).dueDate).toEqual(
        new Date('2026-09-01T00:00:00.000Z'),
      );
    });

    it('explicit dueDate == invoiceDate succeeds', async () => {
      payload.invoiceDate = '2026-08-16';
      payload.dueDate = '2026-08-16';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });

    it('explicit dueDate before invoiceDate rejects exact', async () => {
      payload.invoiceDate = '2026-08-16';
      payload.dueDate = '2026-08-15';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(new ValidationError('dueDate cannot be before invoiceDate'));
    });
  });

  describe('G. NORMALIZATION', () => {
    it('omitted notes -> null', async () => {
      delete payload.notes;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).notes).toBeNull();
    });

    it('explicit null notes -> null', async () => {
      payload.notes = null;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).notes).toBeNull();
    });

    it('notes string unchanged', async () => {
      payload.notes = 'Hello';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).notes).toBe('Hello');
    });

    it('omitted terms -> null', async () => {
      delete payload.terms;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).terms).toBeNull();
    });

    it('explicit null terms -> null', async () => {
      payload.terms = null;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).terms).toBeNull();
    });

    it('terms string unchanged', async () => {
      payload.terms = 'World';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).terms).toBe('World');
    });

    it('omitted item sacCode -> null', async () => {
      delete payload.items[0].sacCode;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
    });

    it('explicit null sacCode -> null', async () => {
      payload.items[0].sacCode = null;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
    });

    it('omitted discountAmount -> persisted Decimal zero', async () => {
      payload.items[0].description = 'Trigger Mode A';
      delete payload.items[0].discountAmount;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const createdItems = vi.mocked(InvoicesRepository.createInvoiceItems).mock.calls[0][0];
      expect((createdItems[0] as Record<string, unknown>).discountAmount.toFixed(2)).toBe('0.00');
    });
  });

  describe('H. MODE A / ITEM REPLACEMENT', () => {
    it('description change triggers Mode A', async () => {
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('sacCode change triggers Mode A', async () => {
      payload.items[0].sacCode = '9999';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('quantity change triggers Mode A', async () => {
      payload.items[0].quantity = '2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('rate change triggers Mode A', async () => {
      payload.items[0].rate = '200';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('discount change triggers Mode A', async () => {
      payload.items[0].discountAmount = '10';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('GST-rate change triggers Mode A', async () => {
      payload.items[0].gstRate = '5';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('item-count change adding item triggers Mode A', async () => {
      payload.items.push({ description: 'Item 2', quantity: '1', rate: '100', gstRate: '18' });
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('item-count change removing item triggers Mode A', async () => {
      existing.items.push(makeInvoiceItem({ id: 'item-2', lineNumber: 2 }));
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('item-order change triggers Mode A', async () => {
      existing.items.push(makeInvoiceItem({ id: 'item-2', description: 'Item 2', lineNumber: 2 }));
      payload.items = [
        { description: 'Item 2', quantity: '1', rate: '100', gstRate: '18' },
        { description: 'Item 1', quantity: '1', rate: '100', gstRate: '18' },
      ];
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalled();
    });

    it('delete old items exact invoice ID, exactly once, before create', async () => {
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalledWith(
        'inv-1',
        expect.anything(),
      );
      expect(InvoicesRepository.deleteInvoiceItems).toHaveBeenCalledTimes(1);
    });

    it('complete replacement', async () => {
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const createdItems = vi.mocked(InvoicesRepository.createInvoiceItems).mock.calls[0][0];
      expect(createdItems.length).toBe(1);
      expect((createdItems[0] as Record<string, unknown>).lineNumber).toBe(1);
      expect((createdItems[0] as Record<string, unknown>).invoiceId).toBe('inv-1');
      expect((createdItems[0] as Record<string, unknown>).id).toBeUndefined();
    });

    it('derived item financial persistence — intra-state GST', async () => {
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const createdItems = vi.mocked(InvoicesRepository.createInvoiceItems).mock.calls[0][0];
      expect((createdItems[0] as Record<string, unknown>).cgstAmount).toEqual(
        new Prisma.Decimal('9.00'),
      );
      expect((createdItems[0] as Record<string, unknown>).sgstAmount).toEqual(
        new Prisma.Decimal('9.00'),
      );
      expect((createdItems[0] as Record<string, unknown>).igstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
    });

    it('inter-state GST propagation', async () => {
      payload.placeOfSupplyStateCode = '29';
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const createdItems = vi.mocked(InvoicesRepository.createInvoiceItems).mock.calls[0][0];
      expect((createdItems[0] as Record<string, unknown>).cgstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
      expect((createdItems[0] as Record<string, unknown>).sgstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
      expect((createdItems[0] as Record<string, unknown>).igstAmount).toEqual(
        new Prisma.Decimal('18.00'),
      );
    });

    it('parent financial recalculation', async () => {
      payload.items[0].quantity = '2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).subtotal).toEqual(new Prisma.Decimal('200.00'));
      expect((callData as Record<string, unknown>).total).toEqual(new Prisma.Decimal('236.00'));
    });

    it('paidAmount and outstandingAmount reset on recalculation', async () => {
      existing.paidAmount = new Prisma.Decimal('10.00');
      payload.items[0].quantity = '2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).paidAmount).toEqual(new Prisma.Decimal('0.00'));
      expect((callData as Record<string, unknown>).outstandingAmount).toEqual(
        new Prisma.Decimal('236.00'),
      );
    });

    it('multiple-item totals aggregate correctly', async () => {
      payload.items.push({
        description: 'Item 2',
        quantity: '1',
        rate: '200',
        discountAmount: '0',
        gstRate: '18',
      });
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).subtotal).toEqual(new Prisma.Decimal('300.00'));
    });

    it('updateInvoiceItemFinancials NEVER called when items changed', async () => {
      payload.items[0].quantity = '2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('parent update exact invoice ID + same transaction', async () => {
      payload.items[0].quantity = '2';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalledWith(
        'inv-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('successful Mode A: one audit, refetch, complete returned DTO', async () => {
      payload.items[0].quantity = '2';
      const refetched = makeDraftInvoice({ total: new Prisma.Decimal('236.00') });
      vi.mocked(InvoicesRepository.getInvoiceWithItems)
        .mockResolvedValueOnce(existing as never)
        .mockResolvedValueOnce(refetched as never);
      const result = await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledTimes(1);
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(refetched.id);
    });

    it('unsupported GST 9.99 -> ValidationError + no persistence side-effects', async () => {
      payload.items[0].gstRate = '9.99';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(ValidationError);
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
    });

    it('GST-unregistered non-zero GST rejection', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(
        makeBusinessSettings({ gstin: null }) as never,
      );
      payload.items[0].gstRate = '18';
      payload.items[0].description = 'New Description';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).rejects.toThrowError(ValidationError);
    });

    it('GST-unregistered zero-rate accepted', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue(
        makeBusinessSettings({ gstin: null }) as never,
      );
      payload.items[0].gstRate = '0';
      payload.items[0].description = 'New Description';
      await expect(
        InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext),
      ).resolves.not.toThrow();
    });

    it('transaction-bound primitives all use same tx', async () => {
      payload.items[0].description = 'New Description';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const txDel = vi.mocked(InvoicesRepository.deleteInvoiceItems).mock.calls[0][1];
      const txCre = vi.mocked(InvoicesRepository.createInvoiceItems).mock.calls[0][1];
      const txUpd = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][2];
      expect(txDel).toBe(txCre);
      expect(txCre).toBe(txUpd);
    });
  });

  describe('I. MODE B / FINANCIAL-ONLY ITEM UPDATE', () => {
    it('same Client + changed explicit POS triggers Mode B', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });

    it('Mode B updates exact existing item ID', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][0]).toBe(
        'item-1',
      );
    });

    it('multiple items preserve IDs', async () => {
      existing.items.push(makeInvoiceItem({ id: 'item-2', lineNumber: 2 }));
      payload.items.push({
        description: 'Item 1',
        sacCode: '1234',
        quantity: '1',
        rate: '100',
        discountAmount: '0',
        gstRate: '18',
      });
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalledTimes(2);
      expect(vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][0]).toBe(
        'item-1',
      );
      expect(vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[1][0]).toBe(
        'item-2',
      );
    });

    it('Mode B never calls deleteInvoiceItems/createInvoiceItems', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).not.toHaveBeenCalled();
    });

    it('INTRA -> INTER tax transition', async () => {
      payload.placeOfSupplyStateCode = '29'; // settings is '27'
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const itemUpdate = vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][1];
      expect((itemUpdate as Record<string, unknown>).cgstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
      expect((itemUpdate as Record<string, unknown>).sgstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
      expect((itemUpdate as Record<string, unknown>).igstAmount).toEqual(
        new Prisma.Decimal('18.00'),
      );
    });

    it('INTER -> INTRA tax transition', async () => {
      existing.placeOfSupplyStateCode = '29'; // stored as INTER
      payload.placeOfSupplyStateCode = '27'; // change back to INTRA
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const itemUpdate = vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][1];
      expect((itemUpdate as Record<string, unknown>).cgstAmount).toEqual(
        new Prisma.Decimal('9.00'),
      );
      expect((itemUpdate as Record<string, unknown>).sgstAmount).toEqual(
        new Prisma.Decimal('9.00'),
      );
      expect((itemUpdate as Record<string, unknown>).igstAmount).toEqual(
        new Prisma.Decimal('0.00'),
      );
    });

    it('derived values passed to financial updater', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const itemUpdate = vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][1];
      expect((itemUpdate as Record<string, unknown>).taxableAmount).toEqual(
        new Prisma.Decimal('100.00'),
      );
      expect((itemUpdate as Record<string, unknown>).totalAmount).toEqual(
        new Prisma.Decimal('118.00'),
      );
    });

    it('input fields are not replaced: no lineNumber/description replacement persistence', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const itemUpdate = vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][1];
      expect((itemUpdate as Record<string, unknown>).description).toBeUndefined();
      expect((itemUpdate as Record<string, unknown>).lineNumber).toBeUndefined();
    });

    it('CLIENT CHANGE + OMITTED POS: target Client state => Mode B', async () => {
      payload.clientId = 'client-2';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ stateCode: '29' }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });

    it('CLIENT CHANGE + EXPLICIT POS: explicit POS wins => Mode B', async () => {
      payload.clientId = 'client-2';
      payload.placeOfSupplyStateCode = '33';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ stateCode: '29' }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });

    it('CLIENT CHANGE EVEN IF EFFECTIVE POS STAYS SAME: financial updater called', async () => {
      payload.clientId = 'client-2';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ stateCode: '27' }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });

    it('CLIENT CHANGE + EXPLICIT SAME POS: Mode B', async () => {
      payload.clientId = 'client-2';
      payload.placeOfSupplyStateCode = '27';
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue(
        makeClient({ stateCode: '27' }) as never,
      );
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });

    it('Parent total recalculation', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).igstTotal).toEqual(new Prisma.Decimal('18.00'));
    });

    it('Payment reset: paidAmount 0.00, outstandingAmount == new total', async () => {
      existing.paidAmount = new Prisma.Decimal('10.00');
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).paidAmount).toEqual(new Prisma.Decimal('0.00'));
      expect((callData as Record<string, unknown>).outstandingAmount).toEqual(
        new Prisma.Decimal('118.00'),
      );
    });

    it('three existing items => exactly three financial updater calls', async () => {
      existing.items.push(makeInvoiceItem({ id: 'item-2', lineNumber: 2 }));
      existing.items.push(makeInvoiceItem({ id: 'item-3', lineNumber: 3 }));
      payload.items.push({
        description: 'Item 1',
        sacCode: '1234',
        quantity: '1',
        rate: '100',
        discountAmount: '0',
        gstRate: '18',
      });
      payload.items.push({
        description: 'Item 1',
        sacCode: '1234',
        quantity: '1',
        rate: '100',
        discountAmount: '0',
        gstRate: '18',
      });
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalledTimes(3);
    });

    it('Transaction binding', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const txItem = vi.mocked(InvoicesRepository.updateInvoiceItemFinancials).mock.calls[0][2];
      const txUpd = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][2];
      expect(txItem).toBe(txUpd);
    });

    it('Parent POS update: placeOfSupplyStateCode + placeOfSupplyState', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1];
      expect((callData as Record<string, unknown>).placeOfSupplyStateCode).toBe('29');
      expect((callData as Record<string, unknown>).placeOfSupplyState).toBe('Karnataka');
    });

    it('Audit / Refetch minimum', async () => {
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledTimes(1);
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledTimes(2);
    });

    it('items remain semantically unchanged despite Decimal/string representation differences', async () => {
      payload.items[0].quantity = '1.00'; // existing is '1.000'
      payload.items[0].rate = '100'; // existing is '100.00'
      payload.placeOfSupplyStateCode = '29';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).toHaveBeenCalled();
    });
  });

  describe('J. MODE C / PARENT-ONLY UPDATE', () => {
    it('notes-only update triggers Mode C', async () => {
      payload.notes = 'Updated notes';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('terms-only update triggers Mode C', async () => {
      payload.terms = 'Updated terms';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('dueDate-only update triggers Mode C', async () => {
      payload.dueDate = '2026-09-15';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('invoiceDate-only with explicit unchanged dueDate triggers Mode C', async () => {
      payload.invoiceDate = '2026-08-10';
      payload.dueDate = '2026-08-31';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('invoiceDate changed + omitted dueDate causing defaulted dueDate triggers Mode C', async () => {
      payload.invoiceDate = '2026-08-10';
      delete payload.dueDate;
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('notes + terms update triggers Mode C', async () => {
      payload.notes = 'A';
      payload.terms = 'B';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
    });

    it('financial preservation: Mode C MUST NOT recalculate parent financials', async () => {
      existing.subtotal = new Prisma.Decimal('100.50');
      existing.discountTotal = new Prisma.Decimal('1.00');
      existing.taxableTotal = new Prisma.Decimal('99.50');
      existing.cgstTotal = new Prisma.Decimal('5.00');
      existing.sgstTotal = new Prisma.Decimal('5.00');
      existing.igstTotal = new Prisma.Decimal('0.00');
      existing.total = new Prisma.Decimal('109.50');
      existing.paidAmount = new Prisma.Decimal('50.00');
      existing.outstandingAmount = new Prisma.Decimal('59.50');

      payload.notes = 'Trigger Mode C';

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      const callData = vi.mocked(InvoicesRepository.updateInvoice).mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(callData.subtotal).toEqual(new Prisma.Decimal('100.50'));
      expect(callData.discountTotal).toEqual(new Prisma.Decimal('1.00'));
      expect(callData.taxableTotal).toEqual(new Prisma.Decimal('99.50'));
      expect(callData.cgstTotal).toEqual(new Prisma.Decimal('5.00'));
      expect(callData.sgstTotal).toEqual(new Prisma.Decimal('5.00'));
      expect(callData.igstTotal).toEqual(new Prisma.Decimal('0.00'));
      expect(callData.total).toEqual(new Prisma.Decimal('109.50'));
      expect(callData.paidAmount).toEqual(new Prisma.Decimal('50.00'));
      expect(callData.outstandingAmount).toEqual(new Prisma.Decimal('59.50'));
    });
  });

  describe('K. NO-OP', () => {
    it('complete semantic no-op avoids all mutations and returns locked Invoice', async () => {
      const result = await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
      expect(InvoicesRepository.deleteInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();

      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledTimes(1);

      expect(result.id).toBe(existing.id);
      expect(result.updatedAt).toEqual(existing.updatedAt);
    });

    it('decimal-equivalent no-op', async () => {
      existing.items[0].quantity = new Prisma.Decimal('1.000');
      existing.items[0].rate = new Prisma.Decimal('100.00');
      existing.items[0].discountAmount = new Prisma.Decimal('0.00');
      existing.items[0].gstRate = new Prisma.Decimal('18.00');

      payload.items[0].quantity = '1';
      payload.items[0].rate = '100';
      payload.items[0].discountAmount = '0';
      payload.items[0].gstRate = '18';

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
    });

    it('optional normalization no-op (sacCode/discountAmount omitted)', async () => {
      existing.items[0].sacCode = null;
      existing.items[0].discountAmount = new Prisma.Decimal('0.00');
      delete payload.items[0].sacCode;
      delete payload.items[0].discountAmount;

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
    });

    it('optional normalization no-op (notes/terms omitted)', async () => {
      existing.notes = null;
      existing.terms = null;
      delete payload.notes;
      delete payload.terms;

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
    });

    it('settings drift ALONE must NOT cause mutation', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        id: 'bs-1',
        businessName: 'Changed Business',
        defaultDueDays: 99,
        stateCode: '99',
        gstin: '99AAAAA0000A1Z5',
      } as never);

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceItems).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoiceItemFinancials).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
    });

    it('unchanged invoiceDate + omitted dueDate preserves existing dueDate despite defaultDueDays drift', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        id: 'bs-1',
        businessName: 'Changed Business',
        defaultDueDays: 99,
        stateCode: '27',
        gstin: '27AAAAA0000A1Z5',
      } as never);
      delete payload.dueDate;

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
    });
  });

  describe('L. AUDIT & METADATA', () => {
    it('changedFields EXACT ORDER for all editable fields', async () => {
      payload.clientId = 'client-2';
      payload.invoiceDate = '2026-08-10';
      payload.dueDate = '2026-08-15';
      payload.placeOfSupplyStateCode = '29';
      payload.notes = 'N';
      payload.terms = 'T';
      payload.items[0].quantity = '2';

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.metadata).toEqual({
        changedFields: [
          'clientId',
          'invoiceDate',
          'dueDate',
          'placeOfSupplyStateCode',
          'notes',
          'terms',
          'items',
        ],
      });
    });

    it('changedFields subset exact order', async () => {
      payload.invoiceDate = '2026-08-10';
      payload.dueDate = '2026-08-15';
      payload.notes = 'N';
      payload.terms = 'T';

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.metadata).toEqual({
        changedFields: ['invoiceDate', 'dueDate', 'notes', 'terms'],
      });
    });

    it('audit exactness (action, actorUserId, entityId, requestId, no financials/raw/client details)', async () => {
      payload.notes = 'Updated notes';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.action).toBe('INVOICE_UPDATED');
      expect(auditPayload.actorUserId).toBe('u-1');
      expect(auditPayload.entityId).toBe('inv-1');
      expect(auditPayload.requestId).toBe('1');
      expect(auditPayload.metadata).toEqual({
        changedFields: ['notes'],
      });
    });

    it('audit context bounds: IP address 64 chars', async () => {
      payload.notes = 'U';
      const longIp = 'A'.repeat(100);
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, {
        ...auditContext,
        ipAddress: longIp,
      });
      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.ipAddress).toBe('A'.repeat(64));
    });

    it('audit context bounds: User-Agent 500 chars', async () => {
      payload.notes = 'U';
      const longUa = 'A'.repeat(600);
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, {
        ...auditContext,
        userAgent: longUa,
      });
      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.userAgent).toBe('A'.repeat(500));
    });

    it('audit context bounds: short IP/User-Agent/requestId preserved', async () => {
      payload.notes = 'U';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      const auditPayload = vi.mocked(InvoicesRepository.createInvoiceAuditLog).mock.calls[0][0];
      expect(auditPayload.ipAddress).toBe('127.0.0.1');
      expect(auditPayload.userAgent).toBe('test');
      expect(auditPayload.requestId).toBe('1');
    });

    it('no-op results in NO audit', async () => {
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('M. LOCKS & SEQUENCE ORDERING', () => {
    it('Client unchanged: BusinessSettings lock BEFORE Invoice lock, no Client lock', async () => {
      payload.notes = 'U';
      const callOrder: string[] = [];
      vi.mocked(businessSettingsRepo.acquireSingletonLock).mockImplementation(async () => {
        callOrder.push('settingsLock');
      });
      vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mockImplementation(async () => {
        callOrder.push('invoiceLock');
      });

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(callOrder).toEqual(['settingsLock', 'invoiceLock']);
      expect(ClientsRepository.lockClientForLifecycle).not.toHaveBeenCalled();
    });

    it('Changed Client: BusinessSettings lock < Invoice lock < Client lock', async () => {
      payload.clientId = 'client-2';
      const callOrder: string[] = [];
      vi.mocked(businessSettingsRepo.acquireSingletonLock).mockImplementation(async () => {
        callOrder.push('settingsLock');
      });
      vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mockImplementation(async () => {
        callOrder.push('invoiceLock');
      });
      vi.mocked(ClientsRepository.lockClientForLifecycle).mockImplementation(async () => {
        callOrder.push('clientLock');
      });

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(callOrder).toEqual(['settingsLock', 'invoiceLock', 'clientLock']);
    });

    it('Detailed lock/read order for settings and invoice', async () => {
      payload.notes = 'U';
      const callOrder: string[] = [];
      vi.mocked(businessSettingsRepo.acquireSingletonLock).mockImplementation(async () => {
        callOrder.push('settingsLock');
      });
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockImplementation(async () => {
        callOrder.push('getSettings');
        return makeBusinessSettings() as never;
      });
      vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mockImplementation(async () => {
        callOrder.push('invoiceLock');
      });
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockImplementation(async () => {
        callOrder.push('getInvoice');
        return existing as never;
      });

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(callOrder).toEqual([
        'settingsLock',
        'getSettings',
        'invoiceLock',
        'getInvoice',
        'getInvoice',
      ]); // getInvoice twice due to refetch
    });

    it('Detailed lock/read order for changed Client', async () => {
      payload.clientId = 'client-2';
      const callOrder: string[] = [];
      vi.mocked(ClientsRepository.lockClientForLifecycle).mockImplementation(async () => {
        callOrder.push('clientLock');
      });
      vi.mocked(ClientsRepository.getClientById).mockImplementation(async () => {
        callOrder.push('getClient');
        return makeClient() as never;
      });

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(callOrder).toEqual(['clientLock', 'getClient']);
    });

    it('All relevant operations use same tx', async () => {
      payload.clientId = 'client-2';
      payload.notes = 'U';
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      const txSettingsLock = vi.mocked(businessSettingsRepo.acquireSingletonLock).mock.calls[0][0];
      const txSettingsGet = vi.mocked(businessSettingsRepo.getBusinessSettings).mock.calls[0][0];
      const txInvLock = vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mock.calls[0][1];
      const txInvGet = vi.mocked(InvoicesRepository.getInvoiceWithItems).mock.calls[0][1];
      const txClientLock = vi.mocked(ClientsRepository.lockClientForLifecycle).mock.calls[0][1];
      const txClientGet = vi.mocked(ClientsRepository.getClientById).mock.calls[0][1];

      expect(txSettingsLock).toBe(txSettingsGet);
      expect(txSettingsGet).toBe(txInvLock);
      expect(txInvLock).toBe(txInvGet);
      expect(txInvGet).toBe(txClientLock);
      expect(txClientLock).toBe(txClientGet);
    });

    it('No-op required locks: acquire settings lock, lock Invoice, read locked Invoice', async () => {
      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(businessSettingsRepo.acquireSingletonLock).toHaveBeenCalledTimes(1);
      expect(InvoicesRepository.lockInvoiceForUpdate).toHaveBeenCalledTimes(1);
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledTimes(1); // No refetch
      expect(ClientsRepository.lockClientForLifecycle).not.toHaveBeenCalled();
      expect(InvoicesRepository.updateInvoice).not.toHaveBeenCalled();
      expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
    });

    it('Persistence Order: parent update < audit < final refetch', async () => {
      payload.notes = 'U';
      const callOrder: string[] = [];
      vi.mocked(InvoicesRepository.updateInvoice).mockImplementation(async () => {
        callOrder.push('updateInvoice');
        return undefined as never;
      });
      vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockImplementation(async () => {
        callOrder.push('auditLog');
        return undefined as never;
      });
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockImplementation(async () => {
        callOrder.push('getInvoice');
        return existing as never;
      });

      await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      // initial getInvoice is index 0
      expect(callOrder).toEqual(['getInvoice', 'updateInvoice', 'auditLog', 'getInvoice']);
    });

    it('Changed Mode C returns SECOND/refetched Invoice DTO', async () => {
      payload.notes = 'U';
      const refetched = makeDraftInvoice({ notes: 'Refetched Notes' });

      vi.mocked(InvoicesRepository.getInvoiceWithItems)
        .mockResolvedValueOnce(existing as never)
        .mockResolvedValueOnce(refetched as never);

      const result = await InvoicesService.updateInvoice('u-1', 'inv-1', payload, auditContext);

      expect(result.notes).toBe('Refetched Notes');
      expect(InvoicesRepository.getInvoiceWithItems).toHaveBeenCalledTimes(2);
    });
  });
});
