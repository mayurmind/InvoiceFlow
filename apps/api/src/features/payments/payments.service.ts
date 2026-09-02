import { Prisma, InvoiceStatus, PaymentStatus } from '../../generated/prisma/client';
import { runInTransaction } from '../../database/transaction';
import { PaymentsRepository } from './payments.repository';
import { PaymentRecordBodyDto, PaymentReverseBodyDto } from './payments.schemas';
import { ConflictError, NotFoundError } from '../../errors/application.error';

export class PaymentsService {
  /**
   * Records a new payment against an invoice.
   */
  static async recordPayment(
    invoiceId: string,
    actorUserId: string,
    payload: PaymentRecordBodyDto,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ) {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    try {
      return await runInTransaction(async (tx) => {
        // 1. Check idempotency BEFORE locking invoice
        const existingPayment = await PaymentsRepository.getPaymentByIdempotencyKey(
          payload.idempotencyKey,
          tx,
        );

        if (existingPayment) {
          // Must match exactly
          if (
            existingPayment.invoiceId !== invoiceId ||
            !existingPayment.amount.equals(new Prisma.Decimal(payload.amount)) ||
            existingPayment.method !== payload.method
          ) {
            throw new ConflictError('Idempotency key reused with mismatched payload');
          }
          return existingPayment;
        }

        // 2. Pessimistic lock on invoice
        await PaymentsRepository.lockInvoiceForUpdate(invoiceId, tx);

        // 3. Load invoice (will be locked)
        const invoice = await PaymentsRepository.getInvoiceById(invoiceId, tx);
        if (!invoice) {
          throw new NotFoundError('Invoice not found');
        }

        // 4. Verify invoice eligibility
        if (
          invoice.status !== InvoiceStatus.SENT &&
          invoice.status !== InvoiceStatus.PARTIALLY_PAID
        ) {
          throw new ConflictError(`Cannot record payment on invoice in ${invoice.status} status`);
        }

        const paymentAmount = new Prisma.Decimal(payload.amount);
        const currentOutstanding = invoice.outstandingAmount;
        const currentPaid = invoice.paidAmount;

        // 5. Overpayment check
        if (paymentAmount.greaterThan(currentOutstanding)) {
          throw new ConflictError('Payment amount exceeds outstanding balance');
        }

        // 6. Calculate new totals
        const newPaidAmount = currentPaid.add(paymentAmount);
        const newOutstandingAmount = currentOutstanding.sub(paymentAmount);
        const newStatus = newOutstandingAmount.equals(new Prisma.Decimal(0))
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

        // 7. Create Payment
        const payment = await PaymentsRepository.createPaymentRecord(
          {
            invoiceId,
            amount: paymentAmount,
            method: payload.method,
            status: PaymentStatus.RECORDED,
            reference: payload.reference,
            notes: payload.notes,
            idempotencyKey: payload.idempotencyKey,
            recordedByUserId: actorUserId,
            paidAt: new Date(),
          },
          tx,
        );

        // 8. Update Invoice
        await PaymentsRepository.updateInvoiceTotalsAndStatus(
          invoiceId,
          {
            paidAmount: newPaidAmount,
            outstandingAmount: newOutstandingAmount,
            status: newStatus,
          },
          tx,
        );

        // 9. Audit Log
        await PaymentsRepository.createPaymentAuditLog(
          {
            actorUserId,
            action: 'PAYMENT_CREATED',
            entityId: payment.id,
            requestId: auditContext.requestId,
            ipAddress: boundIp,
            userAgent: boundUa,
            metadata: {
              paymentId: payment.id,
              amount: paymentAmount.toString(),
              method: payment.method,
              previousInvoiceStatus: invoice.status,
              resultingInvoiceStatus: newStatus,
              previousOutstanding: currentOutstanding.toString(),
              resultingOutstanding: newOutstandingAmount.toString(),
            },
          },
          tx,
        );

        return payment;
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'P2002' &&
        'meta' in error &&
        typeof error.meta === 'object' &&
        error.meta !== null
      ) {
        const meta = error.meta as Record<string, unknown>;
        const target = meta.target as string | string[] | undefined;

        if (
          target &&
          (target.includes('idempotencyKey') || target.includes('Payment_idempotencyKey_key'))
        ) {
          // Concurrent race lost. The winner committed the payment. We can safely retrieve it.
          return await runInTransaction(async (tx) => {
            const existingPayment = await PaymentsRepository.getPaymentByIdempotencyKey(
              payload.idempotencyKey,
              tx,
            );
            if (existingPayment) {
              if (
                existingPayment.invoiceId !== invoiceId ||
                !existingPayment.amount.equals(new Prisma.Decimal(payload.amount)) ||
                existingPayment.method !== payload.method
              ) {
                throw new ConflictError('Idempotency key reused with mismatched payload');
              }
              return existingPayment;
            }
            throw error;
          });
        }
      }
      throw error;
    }
  }

  /**
   * Reverses an existing payment and updates the invoice balance.
   */
  static async reversePayment(
    invoiceId: string,
    paymentId: string,
    actorUserId: string,
    payload: PaymentReverseBodyDto,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ) {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    return await runInTransaction(async (tx) => {
      // 1. Pessimistic lock on invoice to prevent concurrent payments during reversal
      await PaymentsRepository.lockInvoiceForUpdate(invoiceId, tx);

      // 2. Load payment and verify it exists and belongs to the invoice
      const payment = await PaymentsRepository.getPaymentById(paymentId, tx);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }
      if (payment.invoiceId !== invoiceId) {
        throw new ConflictError('Payment does not belong to this invoice');
      }

      // 3. Verify payment is RECORDED (not already reversed)
      if (payment.status === PaymentStatus.REVERSED) {
        throw new ConflictError('Payment is already reversed');
      }

      // 4. Load invoice (will be locked)
      const invoice = await PaymentsRepository.getInvoiceById(invoiceId, tx);
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }

      // 5. Calculate new totals
      const currentOutstanding = invoice.outstandingAmount;
      const currentPaid = invoice.paidAmount;

      const newPaidAmount = currentPaid.sub(payment.amount);
      if (newPaidAmount.lessThan(0)) {
        throw new ConflictError(
          'Reversal would result in negative paid amount due to inconsistent state',
        );
      }
      const newOutstandingAmount = currentOutstanding.add(payment.amount);

      // Status goes to PARTIALLY_PAID or SENT if paid amount is 0
      const newStatus = newPaidAmount.equals(new Prisma.Decimal(0))
        ? InvoiceStatus.SENT
        : InvoiceStatus.PARTIALLY_PAID;

      // 6. Update Payment Status to REVERSED
      const updatedPayment = await PaymentsRepository.updatePaymentStatus(
        paymentId,
        {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: actorUserId,
          reversalReason: payload.reversalReason,
        },
        tx,
      );

      // 7. Update Invoice
      await PaymentsRepository.updateInvoiceTotalsAndStatus(
        invoiceId,
        {
          paidAmount: newPaidAmount,
          outstandingAmount: newOutstandingAmount,
          status: newStatus,
        },
        tx,
      );

      // 8. Audit Log
      await PaymentsRepository.createPaymentAuditLog(
        {
          actorUserId,
          action: 'PAYMENT_REVERSED',
          entityId: payment.id,
          requestId: auditContext.requestId,
          ipAddress: boundIp,
          userAgent: boundUa,
          metadata: {
            paymentId: payment.id,
            amount: payment.amount.toString(),
            method: payment.method,
            reason: payload.reversalReason,
            previousInvoiceStatus: invoice.status,
            resultingInvoiceStatus: newStatus,
            previousOutstanding: currentOutstanding.toString(),
            resultingOutstanding: newOutstandingAmount.toString(),
          },
        },
        tx,
      );

      return updatedPayment;
    });
  }
}
