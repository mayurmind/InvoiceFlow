import { NotFoundError, ConflictError, ValidationError } from '../../errors/application.error';
import { runInTransaction } from '../../database/transaction';
import { InvoicesRepository } from './invoices.repository';
import { ClientsRepository } from '../clients/clients.repository';
import * as businessSettingsRepo from '../business-settings/business-settings.repository';
import { INDIA_STATES_AND_UT } from '../business-settings/business-settings.constants';
import { InvoiceCreatePayload, DraftInvoiceResponse } from './invoices.types';
import { parseQuantity, parseMoney } from './domain/decimal';
import { calculateInvoiceItem, calculateInvoiceTotals } from './domain/calculation';
import { InvoiceCalculationError } from './domain/types';
import { InvoiceStatus, Prisma } from '../../generated/prisma/client';

export class InvoicesService {
  static async createInvoice(
    actorUserId: string,
    payload: InvoiceCreatePayload,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<DraftInvoiceResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    return await runInTransaction(async (tx) => {
      try {
        // 1. Acquire Business Settings singleton lock
        await businessSettingsRepo.acquireSingletonLock(tx);

        // 2. Read Business Settings
        const settings = await businessSettingsRepo.getBusinessSettings(tx);
        if (!settings) {
          throw new NotFoundError('Business settings are not configured');
        }

        // 3. Lock Client FOR UPDATE
        await ClientsRepository.lockClientForLifecycle(payload.clientId, tx);

        // 4. Fetch Client
        const client = await ClientsRepository.getClientById(payload.clientId, tx);
        if (!client) {
          throw new NotFoundError('Client not found');
        }

        // 5. Validate Client active
        if (client.isArchived) {
          throw new ConflictError('Cannot create invoice for an archived client');
        }

        // 6. Resolve POS
        const resolvedStateCode = payload.placeOfSupplyStateCode ?? client.stateCode;

        // 7. Derive POS state name
        const placeOfSupplyState = INDIA_STATES_AND_UT.find(
          (s) => s.code === resolvedStateCode,
        )?.name;
        if (!placeOfSupplyState) {
          throw new ValidationError('Invalid Indian State/UT Code');
        }

        // 8. Resolve dates
        const invoiceDateObj = parseCalendarDate(payload.invoiceDate);
        let dueDateObj: Date;
        if (payload.dueDate) {
          dueDateObj = parseCalendarDate(payload.dueDate);
          if (dueDateObj < invoiceDateObj) {
            throw new ValidationError('dueDate cannot be before invoiceDate');
          }
        } else {
          dueDateObj = addDaysToCalendarDate(invoiceDateObj, settings.defaultDueDays);
        }

        // 9. Build TaxContext
        const taxContext = {
          supplierStateCode: settings.stateCode,
          placeOfSupplyStateCode: resolvedStateCode,
          isGstRegistered: settings.gstin !== null,
        };

        // 10. Parse quantity/rate & 11. calculateInvoiceItem()
        const calculatedItems = payload.items.map((item) => {
          const calc = calculateInvoiceItem(
            {
              quantity: item.quantity,
              rate: item.rate,
              discountAmount: item.discountAmount ?? '0.00',
              gstRate: item.gstRate,
            },
            taxContext,
          );
          return {
            ...item,
            parsedQuantity: parseQuantity(item.quantity),
            parsedRate: parseMoney(item.rate),
            calculated: calc,
          };
        });

        // 12. calculateInvoiceTotals()
        const calculatedTotals = calculateInvoiceTotals(calculatedItems.map((i) => i.calculated));

        // 13. Create DRAFT Invoice
        const invoice = await InvoicesRepository.createDraftInvoice(
          {
            clientId: client.id,
            status: InvoiceStatus.DRAFT,
            invoiceNumber: null,
            financialYear: null,
            currency: 'INR',
            invoiceDate: invoiceDateObj,
            dueDate: dueDateObj,
            placeOfSupplyState: placeOfSupplyState,
            placeOfSupplyStateCode: resolvedStateCode,
            notes: payload.notes ?? null,
            terms: payload.terms ?? null,
            subtotal: calculatedTotals.subtotal,
            discountTotal: calculatedTotals.discountTotal,
            taxableTotal: calculatedTotals.taxableTotal,
            cgstTotal: calculatedTotals.cgstTotal,
            sgstTotal: calculatedTotals.sgstTotal,
            igstTotal: calculatedTotals.igstTotal,
            total: calculatedTotals.total,
            paidAmount: parseMoney('0'),
            outstandingAmount: calculatedTotals.total,
            snapshotVersion: 1,
            businessSnapshot: Prisma.DbNull,
            clientSnapshot: Prisma.DbNull,
            sentAt: null,
            sentByUserId: null,
            cancelledAt: null,
            cancellationReason: null,
            createdByUserId: actorUserId,
          },
          tx,
        );

        // 14. Create InvoiceItems
        const itemsToCreate = calculatedItems.map((item, index) => ({
          invoiceId: invoice.id,
          lineNumber: index + 1,
          description: item.description,
          sacCode: item.sacCode ?? null,
          quantity: item.parsedQuantity,
          rate: item.parsedRate,
          discountAmount: item.calculated.discountAmount,
          taxableAmount: item.calculated.taxableAmount,
          gstRate: item.calculated.gstRate,
          cgstAmount: item.calculated.cgstAmount,
          sgstAmount: item.calculated.sgstAmount,
          igstAmount: item.calculated.igstAmount,
          totalAmount: item.calculated.totalAmount,
        }));

        await InvoicesRepository.createInvoiceItems(itemsToCreate, tx);

        // 15. Create INVOICE_CREATED audit
        await InvoicesRepository.createInvoiceAuditLog(
          {
            actorUserId,
            action: 'INVOICE_CREATED',
            entityId: invoice.id,
            requestId: auditContext.requestId,
            ipAddress: boundIp,
            userAgent: boundUa,
            metadata: { itemCount: itemsToCreate.length },
          },
          tx,
        );

        // 16. COMMIT
        const invoiceWithItems = await InvoicesRepository.getInvoiceWithItems(invoice.id, tx);
        if (!invoiceWithItems) throw new Error('Failed to fetch created invoice');

        return mapInvoiceToResponse(invoiceWithItems);
      } catch (error) {
        if (error instanceof InvoiceCalculationError) {
          throw new ValidationError(error.message);
        }
        throw error; // Let NotFoundError, ConflictError and ValidationError bubble up
      }
    });
  }
}

function mapInvoiceToResponse(
  invoice: Prisma.InvoiceGetPayload<{ include: { items: true } }>,
): DraftInvoiceResponse {
  return {
    id: invoice.id,
    clientId: invoice.clientId,
    invoiceNumber: invoice.invoiceNumber,
    financialYear: invoice.financialYear,
    status: invoice.status,
    invoiceDate: formatCalendarDate(invoice.invoiceDate),
    dueDate: formatCalendarDate(invoice.dueDate),
    currency: invoice.currency,
    placeOfSupplyState: invoice.placeOfSupplyState,
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    notes: invoice.notes,
    terms: invoice.terms,
    subtotal: invoice.subtotal.toFixed(2),
    discountTotal: invoice.discountTotal.toFixed(2),
    taxableTotal: invoice.taxableTotal.toFixed(2),
    cgstTotal: invoice.cgstTotal.toFixed(2),
    sgstTotal: invoice.sgstTotal.toFixed(2),
    igstTotal: invoice.igstTotal.toFixed(2),
    total: invoice.total.toFixed(2),
    paidAmount: invoice.paidAmount.toFixed(2),
    outstandingAmount: invoice.outstandingAmount.toFixed(2),
    items: invoice.items.map((item) => ({
      id: item.id,
      lineNumber: item.lineNumber,
      description: item.description,
      sacCode: item.sacCode,
      quantity: item.quantity.toFixed(3),
      rate: item.rate.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      taxableAmount: item.taxableAmount.toFixed(2),
      gstRate: item.gstRate.toFixed(2),
      cgstAmount: item.cgstAmount.toFixed(2),
      sgstAmount: item.sgstAmount.toFixed(2),
      igstAmount: item.igstAmount.toFixed(2),
      totalAmount: item.totalAmount.toFixed(2),
    })),
    createdByUserId: invoice.createdByUserId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

// Calendar Date Helpers (UTC Safe)
function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatCalendarDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToCalendarDate(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
