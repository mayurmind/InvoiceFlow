import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { BusinessSettings, Client, Invoice, Prisma } from '../../../src/generated/prisma/client';

vi.mock('../../../src/features/business-settings/business-settings.repository');
vi.mock('../../../src/features/clients/clients.repository');
vi.mock('../../../src/features/invoices/invoices.repository');
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
          items: [{ description: 'i', quantity: '1', rate: '100', gstRate: '19' }], // 19 is invalid
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
    // 99 is invalid state code
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '99',
    } as unknown as Client);

    await expect(
      InvoicesService.createInvoice(
        'u1',
        { ...basePayload, placeOfSupplyStateCode: undefined },
        auditContext,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('creates invoice successfully and serializes items', async () => {
    vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
      stateCode: '27',
      gstin: 'some',
      defaultDueDays: 15,
    } as unknown as BusinessSettings);
    vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
      id: 'c1',
      isArchived: false,
      stateCode: '27',
    } as unknown as Client);
    vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({
      id: 'inv-1',
    } as unknown as Invoice);
    vi.mocked(InvoicesRepository.createInvoiceItems).mockResolvedValue(undefined as never);
    vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue(undefined);
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue({
      id: 'inv-1',
      clientId: 'c1',
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
    } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>);

    const res = await InvoicesService.createInvoice('u1', basePayload, auditContext);
    expect(res.id).toBe('inv-1');
    expect(res.items.length).toBe(1);
    expect(res.items[0].totalAmount).toBe('118.00');
  });

  describe('invoiceDate validation against Asia/Kolkata timezone', () => {
    it('accepts invoiceDate == Asia/Kolkata today', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
        defaultDueDays: 15,
      } as unknown as BusinessSettings);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as unknown as Client);
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({
        id: 'inv-1',
      } as unknown as Invoice);
      vi.mocked(InvoicesRepository.createInvoiceItems).mockResolvedValue(undefined as never);
      vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue(undefined);
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue({
        id: 'inv-1',
        items: [],
        invoiceDate: new Date(),
        dueDate: new Date(),
        subtotal: { toFixed: () => '0' },
        discountTotal: { toFixed: () => '0' },
        taxableTotal: { toFixed: () => '0' },
        cgstTotal: { toFixed: () => '0' },
        sgstTotal: { toFixed: () => '0' },
        igstTotal: { toFixed: () => '0' },
        total: { toFixed: () => '0' },
        paidAmount: { toFixed: () => '0' },
        outstandingAmount: { toFixed: () => '0' },
      } as never);

      vi.useFakeTimers();
      // 2026-08-16T12:00:00Z -> Asia/Kolkata is 2026-08-16 17:30
      vi.setSystemTime(new Date('2026-08-16T12:00:00Z'));

      const payload = { ...basePayload, invoiceDate: '2026-08-16' };
      await expect(
        InvoicesService.createInvoice('u1', payload, auditContext),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });

    it('accepts invoiceDate < Asia/Kolkata today', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
        defaultDueDays: 15,
      } as never);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as never);
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({ id: 'inv-1' } as never);
      vi.mocked(InvoicesRepository.createInvoiceItems).mockResolvedValue(undefined as never);
      vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue(undefined);
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue({
        id: 'inv-1',
        items: [],
        invoiceDate: new Date(),
        dueDate: new Date(),
        subtotal: { toFixed: () => '0' },
        discountTotal: { toFixed: () => '0' },
        taxableTotal: { toFixed: () => '0' },
        cgstTotal: { toFixed: () => '0' },
        sgstTotal: { toFixed: () => '0' },
        igstTotal: { toFixed: () => '0' },
        total: { toFixed: () => '0' },
        paidAmount: { toFixed: () => '0' },
        outstandingAmount: { toFixed: () => '0' },
      } as never);

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T12:00:00Z'));

      const payload = { ...basePayload, invoiceDate: '2026-08-15' };
      await expect(
        InvoicesService.createInvoice('u1', payload, auditContext),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });

    it('rejects invoiceDate > Asia/Kolkata today', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
      } as never);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as never);

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-16T12:00:00Z'));

      const payload = { ...basePayload, invoiceDate: '2026-08-17' };
      await expect(InvoicesService.createInvoice('u1', payload, auditContext)).rejects.toThrow(
        ValidationError,
      );
      vi.useRealTimers();
    });

    it('correctly uses Asia/Kolkata timezone boundary, not UTC', async () => {
      vi.mocked(businessSettingsRepo.getBusinessSettings).mockResolvedValue({
        stateCode: '27',
        gstin: 'some',
        defaultDueDays: 15,
      } as never);
      vi.mocked(ClientsRepository.getClientById).mockResolvedValue({
        id: 'c1',
        isArchived: false,
        stateCode: '27',
      } as never);

      vi.useFakeTimers();
      // 2026-08-16T22:00:00Z is 2026-08-17 03:30 in Asia/Kolkata
      // So Kolkata today is 2026-08-17.
      vi.setSystemTime(new Date('2026-08-16T22:00:00Z'));

      // Since Kolkata today is 2026-08-17, payload with 2026-08-17 should be accepted, even though UTC is 2026-08-16
      vi.mocked(InvoicesRepository.createDraftInvoice).mockResolvedValue({ id: 'inv-1' } as never);
      vi.mocked(InvoicesRepository.createInvoiceItems).mockResolvedValue(undefined as never);
      vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue(undefined);
      vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue({
        id: 'inv-1',
        items: [],
        invoiceDate: new Date(),
        dueDate: new Date(),
        subtotal: { toFixed: () => '0' },
        discountTotal: { toFixed: () => '0' },
        taxableTotal: { toFixed: () => '0' },
        cgstTotal: { toFixed: () => '0' },
        sgstTotal: { toFixed: () => '0' },
        igstTotal: { toFixed: () => '0' },
        total: { toFixed: () => '0' },
        paidAmount: { toFixed: () => '0' },
        outstandingAmount: { toFixed: () => '0' },
      } as never);

      const payload = { ...basePayload, invoiceDate: '2026-08-17' };
      await expect(
        InvoicesService.createInvoice('u1', payload, auditContext),
      ).resolves.toBeDefined();
      vi.useRealTimers();
    });
  });
});
/ /   T e s t   i m p l e m e n t a t i o n s   a d d e d  
 