import { InvoiceEmailRepository } from './invoice-email.repository';
import { getEmailProvider } from './invoice-email.provider';
import { generateInvoiceEmailTemplate } from './invoice-email.template';
import { runInTransaction } from '../../../database/transaction';
import { InvoicePdfService } from '../pdf/invoice-pdf.service';
import { buildInvoicePdfModel } from '../pdf/invoice-pdf.mapper';
import { EmailDeliveryDto } from './invoice-email.types';
import {
  NotFoundError,
  ConflictError,
  BadGatewayError,
  ServiceUnavailableError,
} from '../../../errors/application.error';
import { EmailDeliveryStatus, InvoiceStatus } from '../../../generated/prisma/client';

const STALE_PENDING_MS = 23 * 60 * 60 * 1000;

export interface RequestContext {
  actorUserId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
}

export class InvoiceEmailService {
  private repository = new InvoiceEmailRepository();
  private provider = getEmailProvider();

  private assertSendableState(status: InvoiceStatus) {
    if (status === InvoiceStatus.DRAFT || status === InvoiceStatus.CANCELLED) {
      throw new ConflictError(`Invoice cannot be sent in ${status} status`);
    }
  }

  async sendInvoiceEmail(
    invoiceId: string,
    ctx: RequestContext,
  ): Promise<{ delivery: EmailDeliveryDto; status: 201 | 200 }> {
    return this.processEmailRequest(invoiceId, ctx, 'send');
  }

  async resendInvoiceEmail(
    invoiceId: string,
    ctx: RequestContext,
  ): Promise<{ delivery: EmailDeliveryDto; status: 201 | 200 }> {
    return this.processEmailRequest(invoiceId, ctx, 'resend');
  }

  async listInvoiceEmailDeliveries(invoiceId: string): Promise<EmailDeliveryDto[]> {
    return runInTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice not found');

      const deliveries = await this.repository.findEmailDeliveryHistory(tx, invoiceId);
      return deliveries.map((d) => ({
        id: d.id,
        invoiceId: d.invoiceId,
        recipientEmail: d.recipientEmail,
        status: d.status,
        attemptNumber: d.attemptNumber,
        attemptedAt: d.attemptedAt,
        acceptedAt: d.acceptedAt,
        failedAt: d.failedAt,
        failureCode: d.failureCode,
        failureMessage: d.failureMessage,
      }));
    });
  }

  private async processEmailRequest(
    invoiceId: string,
    ctx: RequestContext,
    mode: 'send' | 'resend',
  ): Promise<{ delivery: EmailDeliveryDto; status: 201 | 200 }> {
    let targetDeliveryId: string | null = null;
    let isResume = false;
    let recipientEmailStr = '';

    const prepareResult = await runInTransaction(async (tx) => {
      const lock = await this.repository.lockInvoiceForUpdate(tx, invoiceId);
      if (!lock) throw new NotFoundError('Invoice not found');

      const invoice = await this.repository.fetchInvoiceWithItems(tx, invoiceId);
      if (!invoice) throw new NotFoundError('Invoice not found');

      this.assertSendableState(invoice.status);

      // Validate snapshot via mapper
      const model = buildInvoicePdfModel(invoice);
      const recipientEmail = model.recipient.email;
      if (!recipientEmail || recipientEmail.trim() === '') {
        throw new ConflictError('Invoice snapshot is missing a valid recipient email');
      }
      recipientEmailStr = recipientEmail;

      const history = await this.repository.findEmailDeliveryHistory(tx, invoiceId);
      const latest = history[0]; // ordered DESC by attemptNumber

      if (mode === 'send') {
        if (latest) {
          throw new ConflictError('Delivery history already exists, use /resend');
        }
        const created = await this.repository.createPendingEmailDelivery(
          tx,
          invoiceId,
          recipientEmailStr,
          1,
        );
        await this.repository.createEmailAuditLog(tx, {
          action: 'INVOICE_EMAIL_ATTEMPTED',
          actorUserId: ctx.actorUserId,
          invoiceId,
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { emailDeliveryId: created.id, attemptNumber: 1 },
        });
        return { deliveryId: created.id, resume: false };
      }

      if (mode === 'resend') {
        if (!latest) {
          throw new ConflictError('No delivery history exists, use /send');
        }

        if (latest.status === EmailDeliveryStatus.PENDING) {
          const ageMs = Date.now() - latest.attemptedAt.getTime();
          if (ageMs >= STALE_PENDING_MS) {
            throw new ConflictError(
              'Email attempt outcome is unresolved and requires manual reconciliation.',
            );
          }
          // Resume same attempt
          return { deliveryId: latest.id, resume: true };
        }

        // Terminal, create new
        const newAttemptNumber = latest.attemptNumber + 1;
        const created = await this.repository.createPendingEmailDelivery(
          tx,
          invoiceId,
          recipientEmailStr,
          newAttemptNumber,
        );
        await this.repository.createEmailAuditLog(tx, {
          action: 'INVOICE_EMAIL_ATTEMPTED',
          actorUserId: ctx.actorUserId,
          invoiceId,
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { emailDeliveryId: created.id, attemptNumber: newAttemptNumber },
        });
        return { deliveryId: created.id, resume: false };
      }

      throw new Error('Unknown mode');
    });

    targetDeliveryId = prepareResult.deliveryId;
    isResume = prepareResult.resume;

    // ----- OUTSIDE TRANSACTION -----
    let providerResult;
    try {
      // 1. Generate PDF
      const { buffer: pdfBuffer, filename: pdfFilename } =
        await InvoicePdfService.generateInvoicePdf(invoiceId);

      // 2. Fetch invoice model again just for template (we already proved it's valid)
      // Since it's immutable for email purposes, a simple read is fine.
      const invoice = await runInTransaction((tx) =>
        this.repository.fetchInvoiceWithItems(tx, invoiceId),
      );
      if (!invoice) throw new Error('Invoice disappeared');
      const model = buildInvoicePdfModel(invoice);
      const template = generateInvoiceEmailTemplate(model);

      const idempotencyKey = `invoiceflow-email-delivery:${targetDeliveryId}`;

      // 3. Provider Call
      providerResult = await this.provider.sendInvoiceEmail({
        to: recipientEmailStr,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        pdfBuffer,
        pdfFilename,
        idempotencyKey,
      });
    } catch (error: unknown) {
      const err = error as Error & { name?: string; statusCode?: number; code?: string };
      // Analyze error outside transaction
      const isDefinitiveProviderRejection =
        err.name === 'validation_error' || err.statusCode === 400 || err.statusCode === 403; // Real resend validation error

      const isAmbiguous =
        err.name === 'ResendAmbiguousError' ||
        err.name === 'mock_timeout' ||
        (err.statusCode && err.statusCode >= 500) ||
        err.code === 'ECONNRESET';

      if (err.name === 'invalid_idempotency_key') {
        throw new Error('Local contract defect: invalid idempotency key format');
      }
      if (err.name === 'invalid_idempotent_request') {
        throw new ConflictError(
          'Email attempt outcome is unresolved and requires manual reconciliation.',
        );
      }
      if (err.name === 'concurrent_idempotent_requests') {
        throw new ConflictError('Attempt still in progress');
      }

      if (isAmbiguous) {
        throw new ServiceUnavailableError('Provider outcome is ambiguous');
      }

      // Definitive failure
      const failureCode = isDefinitiveProviderRejection
        ? 'PROVIDER_REJECTED'
        : 'INTERNAL_RENDER_FAILED';
      const failureMessage = isDefinitiveProviderRejection
        ? 'Provider rejected the email request'
        : 'Failed to generate email content';

      await this.finalizeFailed(targetDeliveryId, failureCode, failureMessage, ctx, invoiceId);

      if (isDefinitiveProviderRejection) {
        throw new BadGatewayError('Provider rejected the email request');
      } else {
        throw new Error(failureMessage);
      }
    }

    // 4. Finalize Success
    const finalizedDto = await runInTransaction(async (tx) => {
      const lock = await this.repository.lockEmailDeliveryForUpdate(tx, targetDeliveryId!);
      if (!lock) throw new Error('Delivery disappeared');

      if (lock.status === EmailDeliveryStatus.FAILED) {
        throw new ConflictError('Delivery was already finalized as FAILED');
      }

      if (lock.status === EmailDeliveryStatus.ACCEPTED) {
        if (lock.providerMessageId === providerResult.providerMessageId) {
          // Idempotent success
          return lock;
        }
        throw new ConflictError('Delivery already accepted with different message ID');
      }

      const updated = await this.repository.finalizePendingToAccepted(
        tx,
        targetDeliveryId!,
        providerResult.provider,
        providerResult.providerMessageId!,
      );

      await this.repository.createEmailAuditLog(tx, {
        action: 'INVOICE_EMAIL_ACCEPTED',
        actorUserId: ctx.actorUserId,
        invoiceId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          emailDeliveryId: lock.id,
          attemptNumber: lock.attemptNumber,
          provider: providerResult.provider,
        },
      });

      return updated;
    });

    const dto: EmailDeliveryDto = {
      id: finalizedDto.id,
      invoiceId: finalizedDto.invoiceId,
      recipientEmail: finalizedDto.recipientEmail,
      status: finalizedDto.status,
      attemptNumber: finalizedDto.attemptNumber,
      attemptedAt: finalizedDto.attemptedAt,
      acceptedAt: finalizedDto.acceptedAt,
      failedAt: finalizedDto.failedAt,
      failureCode: finalizedDto.failureCode,
      failureMessage: finalizedDto.failureMessage,
    };

    return { delivery: dto, status: isResume ? 200 : 201 };
  }

  private async finalizeFailed(
    deliveryId: string,
    failureCode: string,
    failureMessage: string,
    ctx: RequestContext,
    invoiceId: string,
  ) {
    await runInTransaction(async (tx) => {
      const lock = await this.repository.lockEmailDeliveryForUpdate(tx, deliveryId);
      if (!lock) return;

      if (lock.status === EmailDeliveryStatus.ACCEPTED) {
        // DO NOT rewrite to FAILED
        return;
      }

      if (lock.status === EmailDeliveryStatus.FAILED) {
        // DO NOT duplicate audit
        return;
      }

      await this.repository.finalizePendingToFailed(tx, deliveryId, failureCode, failureMessage);

      await this.repository.createEmailAuditLog(tx, {
        action: 'INVOICE_EMAIL_FAILED',
        actorUserId: ctx.actorUserId,
        invoiceId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { emailDeliveryId: lock.id, attemptNumber: lock.attemptNumber, failureCode },
      });
    });
  }
}
