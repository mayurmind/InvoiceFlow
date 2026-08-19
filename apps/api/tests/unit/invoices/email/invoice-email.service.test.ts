import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvoiceEmailService } from '../../../../src/features/invoices/email/invoice-email.service';
import { EmailDeliveryStatus, InvoiceStatus } from '../../../../src/generated/prisma/client';
import { buildInvoicePdfModel } from '../../../../src/features/invoices/pdf/invoice-pdf.mapper';

const mockLockInvoiceForUpdate = vi.fn();
const mockFetchInvoiceWithItems = vi.fn();
const mockFindEmailDeliveryHistory = vi.fn();
const mockCreatePendingEmailDelivery = vi.fn();
const mockCreateEmailAuditLog = vi.fn();
const mockLockEmailDeliveryForUpdate = vi.fn();
const mockFinalizePendingToAccepted = vi.fn();
const mockFinalizePendingToFailed = vi.fn();

vi.mock('../../../../src/features/invoices/email/invoice-email.repository', () => {
  return {
    InvoiceEmailRepository: vi.fn().mockImplementation(() => {
      return {
        lockInvoiceForUpdate: mockLockInvoiceForUpdate,
        fetchInvoiceWithItems: mockFetchInvoiceWithItems,
        findEmailDeliveryHistory: mockFindEmailDeliveryHistory,
        createPendingEmailDelivery: mockCreatePendingEmailDelivery,
        createEmailAuditLog: mockCreateEmailAuditLog,
        lockEmailDeliveryForUpdate: mockLockEmailDeliveryForUpdate,
        finalizePendingToAccepted: mockFinalizePendingToAccepted,
        finalizePendingToFailed: mockFinalizePendingToFailed,
      };
    }),
  };
});

export const mockFindUnique = vi.fn();

vi.mock('../../../../src/database/transaction', () => {
  return {
    runInTransaction: vi
      .fn()
      .mockImplementation(async (cb) => cb({ invoice: { findUnique: mockFindUnique } })),
  };
});

const mockGenerateInvoicePdf = vi.fn();
vi.mock('../../../../src/features/invoices/pdf/invoice-pdf.service', () => {
  return {
    InvoicePdfService: {
      generateInvoicePdf: (...args: unknown[]) => mockGenerateInvoicePdf(...args),
    },
  };
});

vi.mock('../../../../src/features/invoices/pdf/invoice-pdf.mapper', () => {
  return {
    buildInvoicePdfModel: vi.fn().mockReturnValue({
      supplier: { displayName: 'Test', email: 'supplier@example.com' },
      recipient: { name: 'Client', email: 'client@example.com' },
      metadata: { invoiceNumber: 'INV/1' },
      totals: { total: 'INR 100' },
    }),
  };
});

const mockGenerateInvoiceEmailTemplate = vi.fn();
vi.mock('../../../../src/features/invoices/email/invoice-email.template', () => {
  return {
    generateInvoiceEmailTemplate: (...args: unknown[]) => mockGenerateInvoiceEmailTemplate(...args),
  };
});

const mockSendInvoiceEmail = vi.fn();
vi.mock('../../../../src/features/invoices/email/invoice-email.provider', () => {
  return {
    getEmailProvider: vi.fn().mockReturnValue({
      sendInvoiceEmail: (...args: unknown[]) => mockSendInvoiceEmail(...args),
    }),
  };
});

const defaultContext = {
  actorUserId: 'usr_1',
  requestId: 'req_1',
  ipAddress: '127.0.0.1',
  userAgent: 'test',
};

const mockValidInvoice = {
  id: 'inv_1',
  status: InvoiceStatus.SENT,
  invoiceNumber: 'INV/1',
  financialYear: '2026-2027',
  snapshotVersion: 1,
  businessSnapshot: { version: 1, displayName: 'Test', email: 'test@example.com' },
  clientSnapshot: { version: 1, name: 'Client', email: 'client@example.com' },
  sentAt: new Date(),
  currency: 'INR',
  items: [],
  subtotal: 100,
  discountTotal: 0,
  taxableTotal: 100,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  total: 100,
  paidAmount: 0,
  outstandingAmount: 100,
};

describe('Invoice Email Service', () => {
  let service: InvoiceEmailService;

  beforeEach(() => {
    service = new InvoiceEmailService();
    vi.stubEnv('EMAIL_PROVIDER', 'mock');
    mockLockInvoiceForUpdate.mockReset().mockResolvedValue({ id: 'inv_1' });
    mockFetchInvoiceWithItems.mockReset().mockResolvedValue({ ...mockValidInvoice });
    mockFindEmailDeliveryHistory.mockReset().mockResolvedValue([]);
    mockCreatePendingEmailDelivery
      .mockReset()
      .mockResolvedValue({ id: 'del_1', attemptNumber: 1, idempotencyKey: 'key_1' });
    mockCreateEmailAuditLog.mockReset();
    mockLockEmailDeliveryForUpdate
      .mockReset()
      .mockResolvedValue({ id: 'del_1', status: EmailDeliveryStatus.PENDING, attemptNumber: 1 });
    mockFinalizePendingToAccepted
      .mockReset()
      .mockResolvedValue({ id: 'del_1', status: EmailDeliveryStatus.ACCEPTED, attemptNumber: 1 });
    mockFinalizePendingToFailed
      .mockReset()
      .mockResolvedValue({ id: 'del_1', status: EmailDeliveryStatus.FAILED, attemptNumber: 1 });

    mockGenerateInvoicePdf
      .mockReset()
      .mockResolvedValue({ buffer: Buffer.from('pdf'), filename: 'inv.pdf' });
    mockGenerateInvoiceEmailTemplate
      .mockReset()
      .mockReturnValue({ subject: 'Subj', htmlBody: '<p>Hi</p>', textBody: 'Hi' });
    mockSendInvoiceEmail
      .mockReset()
      .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg_1' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Validation & Rejection', () => {
    it('rejects if invoice not found', async () => {
      mockLockInvoiceForUpdate.mockResolvedValue(null);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Invoice not found',
      );
    });

    it('rejects DRAFT invoice', async () => {
      mockFetchInvoiceWithItems.mockResolvedValue({
        ...mockValidInvoice,
        status: InvoiceStatus.DRAFT,
      });
      const result = await service.sendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(result.message).toBe('Invoice cannot be sent in DRAFT status');
    });

    it('rejects CANCELLED invoice', async () => {
      mockFetchInvoiceWithItems.mockResolvedValue({
        ...mockValidInvoice,
        status: InvoiceStatus.CANCELLED,
      });
      const result = await service.sendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(result.message).toBe('Invoice cannot be sent in CANCELLED status');
    });

    it('rejects missing snapshot', async () => {
      vi.mocked(buildInvoicePdfModel).mockImplementationOnce(() => {
        throw new Error('Incomplete snapshot');
      });
      mockFetchInvoiceWithItems.mockResolvedValue({ ...mockValidInvoice, clientSnapshot: null });
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Incomplete snapshot',
      );
    });

    it('rejects missing recipient email', async () => {
      vi.mocked(buildInvoicePdfModel).mockReturnValueOnce({
        recipient: { email: '' },
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput);
      const result = await service.sendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(result.message).toBe('Invoice snapshot is missing a valid recipient email');
    });
  });

  describe('Accepted Statuses', () => {
    it('accepts SENT invoice', async () => {
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
    });

    it('accepts PARTIALLY_PAID invoice', async () => {
      mockFetchInvoiceWithItems.mockResolvedValue({
        ...mockValidInvoice,
        status: InvoiceStatus.PARTIALLY_PAID,
      });
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
    });

    it('accepts PAID invoice', async () => {
      mockFetchInvoiceWithItems.mockResolvedValue({
        ...mockValidInvoice,
        status: InvoiceStatus.PAID,
      });
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
    });
  });

  describe('Delivery History & Concurrency', () => {
    it('accepts send first attempt', async () => {
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
      expect(mockCreatePendingEmailDelivery).toHaveBeenCalledWith(
        expect.anything(),
        'inv_1',
        expect.any(String),
        1,
      );
    });

    it('returns 409 if send with existing history', async () => {
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.ACCEPTED },
      ]);
      const res = await service.sendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(res.message).toBe('Delivery history already exists, use /resend');
    });

    it('returns 409 if resend with no history', async () => {
      const res = await service.resendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(res.message).toBe('No delivery history exists, use /send');
    });

    it('creates N+1 attempt on resend after ACCEPTED', async () => {
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.ACCEPTED, attemptNumber: 1 },
      ]);
      const res = await service.resendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
      expect(mockCreatePendingEmailDelivery).toHaveBeenCalledWith(
        expect.anything(),
        'inv_1',
        expect.any(String),
        2,
      );
    });

    it('creates N+1 attempt on resend after FAILED', async () => {
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.FAILED, attemptNumber: 1 },
      ]);
      const res = await service.resendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
      expect(mockCreatePendingEmailDelivery).toHaveBeenCalledWith(
        expect.anything(),
        'inv_1',
        expect.any(String),
        2,
      );
    });

    it('resumes SAME attempt if recent PENDING', async () => {
      const recent = new Date();
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.PENDING, attemptNumber: 1, attemptedAt: recent },
      ]);
      const res = await service.resendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(200);
      expect(mockCreatePendingEmailDelivery).not.toHaveBeenCalled();
      expect(mockLockEmailDeliveryForUpdate).toHaveBeenCalledWith(expect.anything(), 'del_1');
    });

    it('returns 409 if stale PENDING >= 23h', async () => {
      const stale = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.PENDING, attemptNumber: 1, attemptedAt: stale },
      ]);
      const res = await service.resendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(res.message).toBe(
        'Email attempt outcome is unresolved and requires manual reconciliation.',
      );
    });

    it('reuses idempotency key on recent PENDING resume', async () => {
      mockFindEmailDeliveryHistory.mockResolvedValue([
        {
          id: 'del_1',
          status: EmailDeliveryStatus.PENDING,
          attemptNumber: 1,
          attemptedAt: new Date(),
          idempotencyKey: 'old_key',
        },
      ]);
      mockLockEmailDeliveryForUpdate.mockResolvedValue({
        id: 'del_1',
        status: EmailDeliveryStatus.PENDING,
        attemptNumber: 1,
        idempotencyKey: 'old_key',
      });
      await service.resendInvoiceEmail('inv_1', defaultContext);
      expect(mockSendInvoiceEmail).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'invoiceflow-email-delivery:del_1' }),
      );
    });
  });

  describe('Finalization & Failure Modes', () => {
    it('sets FAILED on template failure', async () => {
      mockGenerateInvoiceEmailTemplate.mockImplementationOnce(() => {
        throw new Error('Template fail');
      });
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Failed to generate email content',
      );
      expect(mockFinalizePendingToFailed).toHaveBeenCalled();
    });

    it('sets FAILED on PDF failure', async () => {
      mockGenerateInvoicePdf.mockRejectedValueOnce(new Error('PDF fail'));
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Failed to generate email content',
      );
      expect(mockFinalizePendingToFailed).toHaveBeenCalled();
    });

    it('sets FAILED on provider definitive rejection 400', async () => {
      const err = Object.assign(new Error('reject'), { statusCode: 400, name: 'validation_error' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Provider rejected the email request',
      );
      expect(mockFinalizePendingToFailed).toHaveBeenCalled();
    });

    it('returns 502 on provider definitive rejection 400 when caught by controller (simulated)', async () => {
      // The service propagates the error, the controller returns 502/503.
      const err = Object.assign(new Error('reject'), { statusCode: 400, name: 'validation_error' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      const e = await service.sendInvoiceEmail('inv_1', defaultContext).catch((e) => e);
      expect(e.message).toBe('Provider rejected the email request');
    });

    it('leaves PENDING on provider ambiguous outcome 503', async () => {
      const err = Object.assign(new Error('timeout'), { statusCode: 504, name: 'mock_timeout' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Provider outcome is ambiguous',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('leaves PENDING on invalid_idempotency_key (500)', async () => {
      const err = Object.assign(new Error('key'), { name: 'invalid_idempotency_key' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Local contract defect: invalid idempotency key format',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('leaves PENDING on invalid_idempotent_request (409)', async () => {
      const err = Object.assign(new Error('req'), { name: 'invalid_idempotent_request' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Email attempt outcome is unresolved',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('leaves PENDING on concurrent_idempotent_requests (409)', async () => {
      const err = Object.assign(new Error('req'), { name: 'concurrent_idempotent_requests' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Attempt still in progress',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('leaves PENDING on missing provider message ID', async () => {
      const err = Object.assign(new Error('missing id'), { name: 'ResendAmbiguousError' });
      mockSendInvoiceEmail.mockRejectedValueOnce(err);
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Provider outcome is ambiguous',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('handles already-ACCEPTED finalization race safely', async () => {
      mockLockEmailDeliveryForUpdate.mockResolvedValue({
        id: 'del_1',
        status: EmailDeliveryStatus.ACCEPTED,
        providerMessageId: 'msg_1',
      });
      mockSendInvoiceEmail.mockResolvedValue({ provider: 'mock', providerMessageId: 'msg_1' });
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(res.status).toBe(201);
    });

    it('handles already-FAILED finalization race safely', async () => {
      mockLockEmailDeliveryForUpdate.mockResolvedValue({
        id: 'del_1',
        status: EmailDeliveryStatus.FAILED,
      });
      const recent = new Date();
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.PENDING, attemptNumber: 1, attemptedAt: recent },
      ]);
      await expect(service.resendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Delivery was already finalized as FAILED',
      );
    });

    it('avoids second ATTEMPTED audit on recovery', async () => {
      const recent = new Date();
      mockFindEmailDeliveryHistory.mockResolvedValue([
        { id: 'del_1', status: EmailDeliveryStatus.PENDING, attemptNumber: 1, attemptedAt: recent },
      ]);
      mockLockEmailDeliveryForUpdate.mockResolvedValue({
        id: 'del_1',
        status: EmailDeliveryStatus.PENDING,
        attemptNumber: 1,
        idempotencyKey: 'key_1',
      });
      await service.resendInvoiceEmail('inv_1', defaultContext);
      // createEmailAuditLog is called for ACCEPTED, but NOT for ATTEMPTED on resume
      // We expect 1 call for ACCEPTED
      expect(mockCreateEmailAuditLog).toHaveBeenCalledTimes(1);
    });

    it('creates both ATTEMPTED and ACCEPTED audits on fresh send', async () => {
      await service.sendInvoiceEmail('inv_1', defaultContext);
      expect(mockCreateEmailAuditLog).toHaveBeenCalledTimes(2);
    });

    it('finalizeFailed short-circuits if lock is ACCEPTED', async () => {
      mockLockEmailDeliveryForUpdate.mockResolvedValueOnce({
        id: 'del_1',
        status: EmailDeliveryStatus.ACCEPTED,
      });
      mockGenerateInvoicePdf.mockRejectedValueOnce(new Error('PDF fail'));
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Failed to generate email content',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });

    it('finalizeFailed short-circuits if lock is FAILED', async () => {
      mockLockEmailDeliveryForUpdate.mockResolvedValueOnce({
        id: 'del_1',
        status: EmailDeliveryStatus.FAILED,
      });
      mockGenerateInvoicePdf.mockRejectedValueOnce(new Error('PDF fail'));
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Failed to generate email content',
      );
      expect(mockFinalizePendingToFailed).not.toHaveBeenCalled();
    });
  });

  describe('DTO and Output', () => {
    it('does not expose provider internals in public DTO', async () => {
      const res = await service.sendInvoiceEmail('inv_1', defaultContext);
      expect((res.delivery as Record<string, unknown>).providerMessageId).toBeUndefined();
      expect((res.delivery as Record<string, unknown>).provider).toBeUndefined();
    });
  });

  describe('listInvoiceEmailDeliveries', () => {
    it('returns formatted deliveries', async () => {
      const d1 = {
        id: 'd1',
        invoiceId: 'inv_1',
        recipientEmail: 'foo@bar.com',
        status: EmailDeliveryStatus.PENDING,
        attemptNumber: 1,
        attemptedAt: new Date(),
        acceptedAt: null,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      };
      mockFindUnique.mockResolvedValueOnce({ id: 'inv_1' });
      mockFindEmailDeliveryHistory.mockResolvedValueOnce([d1]);

      const res = await service.listInvoiceEmailDeliveries('inv_1');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('d1');
    });

    it('throws NotFoundError if invoice does not exist', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      await expect(service.listInvoiceEmailDeliveries('inv_1')).rejects.toThrow(
        'Invoice not found',
      );
    });
  });

  describe('Edge cases', () => {
    it('throws Unknown mode if invalid mode is passed internally', async () => {
      await expect(
        service['processEmailRequest']('inv_1', defaultContext, 'invalid_mode'),
      ).rejects.toThrow('Unknown mode');
    });

    it('throws ConflictError if finalized with different message ID', async () => {
      mockLockEmailDeliveryForUpdate.mockResolvedValueOnce({
        id: 'del_1',
        status: EmailDeliveryStatus.ACCEPTED,
        providerMessageId: 'msg_old',
      });
      mockSendInvoiceEmail.mockResolvedValueOnce({
        provider: 'mock',
        providerMessageId: 'msg_new',
      });
      await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
        'Delivery already accepted with different message ID',
      );
    });
  });
  it('throws NotFoundError if invoice disappears before fetch', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValue(null);

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Invoice not found',
    );
  });

  it('throws Error if invoice disappears before PDF render', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValueOnce(mockValidInvoice).mockResolvedValueOnce(null);
    mockFindEmailDeliveryHistory.mockResolvedValue([]);
    mockCreatePendingEmailDelivery.mockResolvedValue({ id: 'd-new' });
    mockSendInvoiceEmail.mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });
    mockLockEmailDeliveryForUpdate.mockResolvedValue({
      status: EmailDeliveryStatus.PENDING,
      id: 'd-new',
      attemptNumber: 1,
    });
    mockFinalizePendingToAccepted.mockResolvedValue({
      id: 'd-new',
      status: EmailDeliveryStatus.ACCEPTED,
    });

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Failed to generate email content',
    );
  });

  it('throws Error if delivery disappears before finalize success', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValue(mockValidInvoice);
    mockFindEmailDeliveryHistory.mockResolvedValue([]);
    mockCreatePendingEmailDelivery.mockResolvedValue({ id: 'd-new' });
    mockSendInvoiceEmail.mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });
    mockLockEmailDeliveryForUpdate.mockResolvedValue(null);

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Delivery disappeared',
    );
  });

  it('returns early if delivery disappears before finalize failed', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValue(mockValidInvoice);
    mockFindEmailDeliveryHistory.mockResolvedValue([]);
    mockCreatePendingEmailDelivery.mockResolvedValue({ id: 'd-new' });
    mockSendInvoiceEmail.mockRejectedValue(
      Object.assign(new Error('fail'), { name: 'validation_error', statusCode: 400 }),
    );
    mockLockEmailDeliveryForUpdate.mockResolvedValue(null);

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Provider rejected the email request',
    );
  });

  it('returns early if delivery is already ACCEPTED during finalize failed', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValue(mockValidInvoice);
    mockFindEmailDeliveryHistory.mockResolvedValue([]);
    mockCreatePendingEmailDelivery.mockResolvedValue({ id: 'd-new' });
    mockSendInvoiceEmail.mockRejectedValue(
      Object.assign(new Error('fail'), { name: 'validation_error', statusCode: 400 }),
    );
    mockLockEmailDeliveryForUpdate.mockResolvedValue({ status: EmailDeliveryStatus.ACCEPTED });

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Provider rejected the email request',
    );
  });

  it('returns early if delivery is already FAILED during finalize failed', async () => {
    mockLockInvoiceForUpdate.mockResolvedValue({});
    mockFetchInvoiceWithItems.mockResolvedValue(mockValidInvoice);
    mockFindEmailDeliveryHistory.mockResolvedValue([]);
    mockCreatePendingEmailDelivery.mockResolvedValue({ id: 'd-new' });
    mockSendInvoiceEmail.mockRejectedValue(
      Object.assign(new Error('fail'), { name: 'validation_error', statusCode: 400 }),
    );
    mockLockEmailDeliveryForUpdate.mockResolvedValue({ status: EmailDeliveryStatus.FAILED });

    await expect(service.sendInvoiceEmail('inv_1', defaultContext)).rejects.toThrow(
      'Provider rejected the email request',
    );
  });
});
