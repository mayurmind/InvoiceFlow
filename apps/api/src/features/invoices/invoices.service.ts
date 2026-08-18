import { NotFoundError, ConflictError, ValidationError } from '../../errors/application.error';
import { runInTransaction } from '../../database/transaction';
import { InvoicesRepository } from './invoices.repository';
import { ClientsRepository } from '../clients/clients.repository';
import * as businessSettingsRepo from '../business-settings/business-settings.repository';
import { INDIA_STATES_AND_UT } from '../business-settings/business-settings.constants';
import {
  InvoiceCreatePayload,
  DraftInvoiceResponse,
  InvoiceUpdatePayload,
  InvoiceListQuery,
  InvoiceListResponse,
  InvoiceDetailResponse,
  InvoiceListItemResponse,
} from './invoices.types';
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

        const kolkataToday = getAsiaKolkataToday();
        if (payload.invoiceDate > kolkataToday) {
          throw new ValidationError('invoiceDate cannot be in the future (Asia/Kolkata timezone)');
        }

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

  static async listInvoices(query: InvoiceListQuery): Promise<InvoiceListResponse> {
    const [data, total] = await Promise.all([
      InvoicesRepository.listInvoices(query),
      InvoicesRepository.countInvoices(query),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const hasNextPage = query.page < totalPages;
    const hasPreviousPage = query.page > 1 && total > 0;

    return {
      data: data.map(mapInvoiceToListResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  static async getInvoiceById(invoiceId: string): Promise<InvoiceDetailResponse> {
    const invoice = await InvoicesRepository.getInvoiceWithItems(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    return mapInvoiceToDetailResponse(invoice);
  }

  static async updateInvoice(
    actorUserId: string,
    invoiceId: string,
    payload: InvoiceUpdatePayload,
    auditContext: { requestId: string; ipAddress: string; userAgent: string },
  ): Promise<DraftInvoiceResponse> {
    const boundIp = auditContext.ipAddress.substring(0, 64);
    const boundUa = auditContext.userAgent.substring(0, 500);

    return await runInTransaction(async (tx) => {
      try {
        await businessSettingsRepo.acquireSingletonLock(tx);
        const settings = await businessSettingsRepo.getBusinessSettings(tx);
        if (!settings) {
          throw new NotFoundError('Business settings are not configured');
        }

        await InvoicesRepository.lockInvoiceForUpdate(invoiceId, tx);
        const existingInvoice = await InvoicesRepository.getInvoiceWithItems(invoiceId, tx);
        if (!existingInvoice) {
          throw new NotFoundError('Invoice not found');
        }
        if (existingInvoice.status !== InvoiceStatus.DRAFT) {
          throw new ConflictError('Only DRAFT invoices can be modified');
        }

        const clientChanged = payload.clientId !== existingInvoice.clientId;
        let targetClient = null;
        if (clientChanged) {
          await ClientsRepository.lockClientForLifecycle(payload.clientId, tx);
          targetClient = await ClientsRepository.getClientById(payload.clientId, tx);
          if (!targetClient) throw new NotFoundError('Client not found');
          if (targetClient.isArchived) throw new ConflictError('Cannot use an archived client');
        }

        let effectivePOSCode = existingInvoice.placeOfSupplyStateCode;
        if (payload.placeOfSupplyStateCode) {
          effectivePOSCode = payload.placeOfSupplyStateCode;
        } else if (clientChanged && targetClient) {
          effectivePOSCode = targetClient.stateCode;
        }
        const placeOfSupplyState = INDIA_STATES_AND_UT.find(
          (s) => s.code === effectivePOSCode,
        )?.name;
        if (!placeOfSupplyState) throw new ValidationError('Invalid Indian State/UT Code');

        const kolkataToday = getAsiaKolkataToday();
        if (payload.invoiceDate > kolkataToday) {
          throw new ValidationError('invoiceDate cannot be in the future (Asia/Kolkata timezone)');
        }

        const formattedStoredInvoiceDate = formatCalendarDate(existingInvoice.invoiceDate);
        const invoiceDateChanged = payload.invoiceDate !== formattedStoredInvoiceDate;
        const newInvoiceDateObj = parseCalendarDate(payload.invoiceDate);

        let newDueDateObj: Date;
        if (payload.dueDate) {
          newDueDateObj = parseCalendarDate(payload.dueDate);
          if (newDueDateObj < newInvoiceDateObj) {
            throw new ValidationError('dueDate cannot be before invoiceDate');
          }
        } else {
          if (!invoiceDateChanged) {
            newDueDateObj = existingInvoice.dueDate;
          } else {
            newDueDateObj = addDaysToCalendarDate(newInvoiceDateObj, settings.defaultDueDays);
          }
        }

        const normalizedPayload = {
          notes: payload.notes ?? null,
          terms: payload.terms ?? null,
          items: payload.items.map((i) => ({
            ...i,
            sacCode: i.sacCode ?? null,
            discountAmount: i.discountAmount ?? '0.00',
          })),
        };

        const changedFields: string[] = [];
        if (clientChanged) changedFields.push('clientId');
        if (invoiceDateChanged) changedFields.push('invoiceDate');
        if (formatCalendarDate(newDueDateObj) !== formatCalendarDate(existingInvoice.dueDate)) {
          if (!changedFields.includes('dueDate')) changedFields.push('dueDate');
        }
        if (effectivePOSCode !== existingInvoice.placeOfSupplyStateCode) {
          changedFields.push('placeOfSupplyStateCode');
        }
        if (normalizedPayload.notes !== existingInvoice.notes) changedFields.push('notes');
        if (normalizedPayload.terms !== existingInvoice.terms) changedFields.push('terms');

        const itemsChanged = areItemsSemanticallyDifferent(
          existingInvoice.items,
          normalizedPayload.items,
        );
        if (itemsChanged) changedFields.push('items');

        const fixedChangedFields = [
          'clientId',
          'invoiceDate',
          'dueDate',
          'placeOfSupplyStateCode',
          'notes',
          'terms',
          'items',
        ].filter((field) => changedFields.includes(field));

        if (fixedChangedFields.length === 0) {
          return mapInvoiceToResponse(existingInvoice);
        }

        const financialRecalculationRequired =
          itemsChanged ||
          effectivePOSCode !== existingInvoice.placeOfSupplyStateCode ||
          clientChanged;

        let finalTotals = {
          subtotal: existingInvoice.subtotal,
          discountTotal: existingInvoice.discountTotal,
          taxableTotal: existingInvoice.taxableTotal,
          cgstTotal: existingInvoice.cgstTotal,
          sgstTotal: existingInvoice.sgstTotal,
          igstTotal: existingInvoice.igstTotal,
          total: existingInvoice.total,
          paidAmount: existingInvoice.paidAmount,
          outstandingAmount: existingInvoice.outstandingAmount,
        };

        type CalculatedItem = {
          description: string;
          sacCode: string | null;
          parsedQuantity: Prisma.Decimal;
          parsedRate: Prisma.Decimal;
          calculated: {
            lineGross: Prisma.Decimal;
            discountAmount: Prisma.Decimal;
            taxableAmount: Prisma.Decimal;
            gstRate: Prisma.Decimal;
            cgstAmount: Prisma.Decimal;
            sgstAmount: Prisma.Decimal;
            igstAmount: Prisma.Decimal;
            totalAmount: Prisma.Decimal;
          };
        };

        let calculatedItems: CalculatedItem[] = [];

        if (financialRecalculationRequired) {
          const taxContext = {
            supplierStateCode: settings.stateCode,
            placeOfSupplyStateCode: effectivePOSCode,
            isGstRegistered: settings.gstin !== null,
          };

          calculatedItems = normalizedPayload.items.map((item) => {
            const calc = calculateInvoiceItem(
              {
                quantity: item.quantity,
                rate: item.rate,
                discountAmount: item.discountAmount,
                gstRate: item.gstRate,
              },
              taxContext,
            );
            return {
              description: item.description,
              sacCode: item.sacCode,
              parsedQuantity: parseQuantity(item.quantity),
              parsedRate: parseMoney(item.rate),
              calculated: calc,
            };
          });

          const calcs = calculateInvoiceTotals(calculatedItems.map((i) => i.calculated));
          finalTotals = {
            subtotal: calcs.subtotal,
            discountTotal: calcs.discountTotal,
            taxableTotal: calcs.taxableTotal,
            cgstTotal: calcs.cgstTotal,
            sgstTotal: calcs.sgstTotal,
            igstTotal: calcs.igstTotal,
            total: calcs.total,
            paidAmount: parseMoney('0'),
            outstandingAmount: calcs.total,
          };
        }

        await InvoicesRepository.updateInvoice(
          existingInvoice.id,
          {
            clientId: payload.clientId,
            invoiceDate: newInvoiceDateObj,
            dueDate: newDueDateObj,
            placeOfSupplyState: placeOfSupplyState,
            placeOfSupplyStateCode: effectivePOSCode,
            notes: normalizedPayload.notes,
            terms: normalizedPayload.terms,
            subtotal: finalTotals.subtotal,
            discountTotal: finalTotals.discountTotal,
            taxableTotal: finalTotals.taxableTotal,
            cgstTotal: finalTotals.cgstTotal,
            sgstTotal: finalTotals.sgstTotal,
            igstTotal: finalTotals.igstTotal,
            total: finalTotals.total,
            paidAmount: finalTotals.paidAmount,
            outstandingAmount: finalTotals.outstandingAmount,
          },
          tx,
        );

        if (itemsChanged) {
          // MODE A: Items changed semantically -> complete replacement
          await InvoicesRepository.deleteInvoiceItems(existingInvoice.id, tx);
          const itemsToCreate = calculatedItems.map((item, index) => ({
            invoiceId: existingInvoice.id,
            lineNumber: index + 1,
            description: item.description,
            sacCode: item.sacCode,
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
        } else if (financialRecalculationRequired) {
          // MODE B: Items unchanged semantically, but context changed (POS/Client)
          for (let i = 0; i < existingInvoice.items.length; i++) {
            const existingItem = existingInvoice.items[i];
            const calculatedItem = calculatedItems[i];
            await InvoicesRepository.updateInvoiceItemFinancials(
              existingItem.id,
              calculatedItem.calculated,
              tx,
            );
          }
        }

        await InvoicesRepository.createInvoiceAuditLog(
          {
            actorUserId,
            action: 'INVOICE_UPDATED',
            entityId: existingInvoice.id,
            requestId: auditContext.requestId,
            ipAddress: boundIp,
            userAgent: boundUa,
            metadata: { changedFields: fixedChangedFields },
          },
          tx,
        );

        const refetched = await InvoicesRepository.getInvoiceWithItems(existingInvoice.id, tx);
        if (!refetched) throw new Error('Refetch failed');
        return mapInvoiceToResponse(refetched);
      } catch (error) {
        if (error instanceof InvoiceCalculationError) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    });
  }
}

function areItemsSemanticallyDifferent(
  existingItems: Prisma.InvoiceItemGetPayload<Record<string, never>>[],
  payloadItems: InvoiceUpdatePayload['items'],
): boolean {
  if (existingItems.length !== payloadItems.length) return true;
  for (let i = 0; i < existingItems.length; i++) {
    const e = existingItems[i];
    const p = payloadItems[i];
    if (e.description !== p.description) return true;
    if (e.sacCode !== p.sacCode) return true;
    if (e.quantity.toFixed(3) !== parseQuantity(p.quantity).toFixed(3)) return true;
    if (e.rate.toFixed(2) !== parseMoney(p.rate).toFixed(2)) return true;
    if (e.discountAmount.toFixed(2) !== parseMoney(p.discountAmount ?? '0.00').toFixed(2))
      return true;
    if (e.gstRate.toFixed(2) !== parseMoney(p.gstRate).toFixed(2)) return true;
  }
  return false;
}

export function mapInvoiceToResponse(
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

export function mapInvoiceToListResponse(
  invoice: Prisma.InvoiceGetPayload<Prisma.InvoiceDefaultArgs>,
): InvoiceListItemResponse {
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
    subtotal: invoice.subtotal.toFixed(2),
    discountTotal: invoice.discountTotal.toFixed(2),
    taxableTotal: invoice.taxableTotal.toFixed(2),
    cgstTotal: invoice.cgstTotal.toFixed(2),
    sgstTotal: invoice.sgstTotal.toFixed(2),
    igstTotal: invoice.igstTotal.toFixed(2),
    total: invoice.total.toFixed(2),
    paidAmount: invoice.paidAmount.toFixed(2),
    outstandingAmount: invoice.outstandingAmount.toFixed(2),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function mapInvoiceToDetailResponse(
  invoice: Prisma.InvoiceGetPayload<{ include: { items: true } }>,
): InvoiceDetailResponse {
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
    sentByUserId: invoice.sentByUserId,
    sentAt: invoice.sentAt,
    cancelledAt: invoice.cancelledAt,
    cancellationReason: invoice.cancellationReason,
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

function getAsiaKolkataToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}
