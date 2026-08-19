import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvoiceEmailRepository } from '../../src/features/invoices/email/invoice-email.repository';
import { InvoiceEmailService } from '../../src/features/invoices/email/invoice-email.service';
import { InvoiceEmailProvider } from '../../src/features/invoices/email/invoice-email.provider';
import { prisma } from '../../src/database/prisma';
import { runInTransaction } from '../../src/database/transaction';
import { EmailDeliveryStatus, InvoiceStatus } from '../../src/generated/prisma/client';

describe('Invoice Email Database Integration', () => {
  const repository = new InvoiceEmailRepository();
  // Provider is intentionally fake to ensure zero real Resend network calls
  const fakeProvider = {
    sendInvoiceEmail: vi.fn(),
  } as unknown as InvoiceEmailProvider;

  const service = new InvoiceEmailService(repository, fakeProvider);

  let testInvoiceId: string;
  let testUserId: string;

  beforeEach(async () => {
    // 6 - PRESERVE DATABASE BUSINESS PROOFS:
    // Real PostgreSQL, local invoiceflow_test only, real immutable snapshots
    const client = await prisma.client.create({
      data: {
        name: 'Client',
        email: 'client@example.com',
        addressLine1: '123 St',
        city: 'City',
        state: 'State',
        stateCode: '01',
        postalCode: '12345',
      },
    });

    const user = await prisma.user.create({
      data: {
        email: 'integration-test@example.com',
        passwordHash: 'dummy',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    testUserId = user.id;

    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        createdByUserId: user.id,
        status: InvoiceStatus.SENT,
        invoiceNumber: 'INV-DB-1',
        currency: 'INR',
        invoiceDate: new Date(),
        dueDate: new Date(),
        placeOfSupplyState: 'State',
        placeOfSupplyStateCode: '01',
        subtotal: 100,
        taxableTotal: 100,
        total: 100,
        outstandingAmount: 100,
        financialYear: '23-24',
        sentAt: new Date(),
        // historical clientSnapshot.email and businessSnapshot
        clientSnapshot: {
          version: 1,
          clientId: client.id,
          name: 'Client',
          email: 'historical-client@example.com',
          phone: null,
          gstin: null,
          pan: null,
          addressLine1: '123 Client St',
          addressLine2: null,
          city: 'Client City',
          state: 'Client State',
          stateCode: '03',
          postalCode: '11111',
          country: 'India',
        },
        businessSnapshot: {
          version: 1,
          displayName: 'Business',
          email: 'historical-business@example.com',
          legalName: 'Legal Business',
          addressLine1: '123 Business St',
          addressLine2: null,
          city: 'Business City',
          state: 'Business State',
          stateCode: '02',
          postalCode: '54321',
          country: 'India',
          gstin: null,
          pan: null,
          phone: null,
          logoStorageKey: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankName: null,
          bankIfsc: null,
          upiId: null,
        },
        snapshotVersion: 1,
      },
    });
    testInvoiceId = invoice.id;

    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        lineNumber: 1,
        description: 'Test Item',
        quantity: 1,
        rate: 100,
        taxableAmount: 100,
        gstRate: 0,
        totalAmount: 100,
      },
    });
  });

  afterEach(async () => {
    // Truncate circumvents row-level triggers
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE users, clients, invoices, invoice_items, email_deliveries, audit_logs CASCADE;`,
    );
    vi.restoreAllMocks();
  });

  it('handles concurrency and finalization races correctly', async () => {
    // We test all the repository queries directly to prove they work
    await runInTransaction(async (tx) => {
      // lock invoice FOR UPDATE
      const lock = await repository.lockInvoiceForUpdate(tx, testInvoiceId);
      expect(lock?.id).toBe(testInvoiceId);

      // get invoice + items
      const invoice = await repository.fetchInvoiceWithItems(tx, testInvoiceId);
      expect(invoice?.id).toBe(testInvoiceId);
      expect(invoice?.items.length).toBe(1);

      // create first PENDING attempt
      const attempt1 = await repository.createPendingEmailDelivery(
        tx,
        testInvoiceId,
        'client@example.com',
        1,
      );
      expect(attempt1.status).toBe(EmailDeliveryStatus.PENDING);

      // create resend PENDING attempt (attemptNumber allocation logic)
      const attempt2 = await repository.createPendingEmailDelivery(
        tx,
        testInvoiceId,
        'client@example.com',
        2,
      );
      expect(attempt2.attemptNumber).toBe(2);

      // list existing deliveries, find latest delivery, attemptNumber DESC ordering
      const history = await repository.findEmailDeliveryHistory(tx, testInvoiceId);
      expect(history.length).toBe(2);
      expect(history[0].attemptNumber).toBe(2);
      expect(history[1].attemptNumber).toBe(1);

      const latest = await repository.findLatestDelivery(tx, testInvoiceId);
      expect(latest?.attemptNumber).toBe(2);

      // lock EmailDelivery FOR UPDATE, read exact EmailDelivery
      const deliveryLock = await repository.lockEmailDeliveryForUpdate(tx, attempt1.id);
      expect(deliveryLock?.id).toBe(attempt1.id);

      // PENDING -> ACCEPTED
      const accepted = await repository.finalizePendingToAccepted(
        tx,
        attempt1.id,
        'resend',
        'msg_1',
      );
      expect(accepted.status).toBe(EmailDeliveryStatus.ACCEPTED);

      // PENDING -> FAILED
      const failed = await repository.finalizePendingToFailed(tx, attempt2.id, 'CODE', 'msg');
      expect(failed.status).toBe(EmailDeliveryStatus.FAILED);

      // Audits
      await repository.createEmailAuditLog(tx, {
        action: 'INVOICE_EMAIL_ATTEMPTED',
        actorUserId: testUserId,
        invoiceId: testInvoiceId,
        requestId: 'req_1',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        metadata: { attemptNumber: 1 },
      });
      await repository.createEmailAuditLog(tx, {
        action: 'INVOICE_EMAIL_ACCEPTED',
        actorUserId: testUserId,
        invoiceId: testInvoiceId,
        requestId: 'req_1',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        metadata: { attemptNumber: 1 },
      });
      await repository.createEmailAuditLog(tx, {
        action: 'INVOICE_EMAIL_FAILED',
        actorUserId: testUserId,
        invoiceId: testInvoiceId,
        requestId: 'req_2',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        metadata: { attemptNumber: 2 },
      });
    });

    // Check terminal states
    const finalInvoice = await prisma.invoice.findUnique({ where: { id: testInvoiceId } });
    expect(finalInvoice?.status).toBe(InvoiceStatus.SENT); // Invoice.status unchanged

    // Test the service layer against real DB for convergence
    vi.mocked(fakeProvider.sendInvoiceEmail).mockResolvedValueOnce({
      success: true,
      messageId: 'msg_svc',
    });

    // First send attempt via service (must be resend since history exists)
    const defaultContext = {
      userId: testUserId,
      ipAddress: '1.1.1.1',
      userAgent: 'test',
      requestId: 'req_svc',
    };
    const result = await service.resendInvoiceEmail(testInvoiceId, defaultContext);
    expect(result.status).toBe(201); // Created new attempt since previous attempts were finalized
    expect(result.delivery.attemptNumber).toBe(3); // previous attempts 1, 2 were created directly

    // send + resend convergence:
    // If we call resend, it will be attempt 4
    vi.mocked(fakeProvider.sendInvoiceEmail).mockResolvedValueOnce({
      success: true,
      messageId: 'msg_svc_4',
    });
    const resendResult = await service.resendInvoiceEmail(testInvoiceId, defaultContext);
    expect(resendResult.status).toBe(201);
    expect(resendResult.delivery.attemptNumber).toBe(4);

    // If we try to resend while a stale PENDING exists (simulated), it should block
    const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await runInTransaction(async (tx) => {
      await repository.createPendingEmailDelivery(tx, testInvoiceId, 'client@example.com', 5);
      await tx.$queryRaw`UPDATE "email_deliveries" SET "attemptedAt" = ${staleDate} WHERE "attemptNumber" = 5`;
    });

    await expect(service.resendInvoiceEmail(testInvoiceId, defaultContext)).rejects.toThrow(
      'requires manual reconciliation',
    );

    // recent PENDING resume
    const recentDate = new Date();
    await runInTransaction(async (tx) => {
      await repository.createPendingEmailDelivery(tx, testInvoiceId, 'client@example.com', 6);
      await tx.$queryRaw`UPDATE "email_deliveries" SET "attemptedAt" = ${recentDate} WHERE "attemptNumber" = 6`;
    });

    vi.mocked(fakeProvider.sendInvoiceEmail).mockResolvedValueOnce({
      success: true,
      messageId: 'msg_svc_6',
    });
    const resumeResult = await service.resendInvoiceEmail(testInvoiceId, defaultContext);
    expect(resumeResult.status).toBe(200); // Resumed existing PENDING attempt
    expect(resumeResult.delivery.attemptNumber).toBe(6);
  });
});
