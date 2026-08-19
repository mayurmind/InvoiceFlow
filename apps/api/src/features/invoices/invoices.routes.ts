import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client';
import { originGuard } from '../auth/origin.middleware';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { requireCsrfToken } from '../auth/csrf.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { InvoicesController } from './invoices.controller';
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  invoiceListQuerySchema,
  invoiceIdParamSchema,
  invoiceIssueSchema,
} from './invoices.schemas';
import {
  sendInvoiceEmailBodySchema,
  resendInvoiceEmailBodySchema,
} from './email/invoice-email.schemas';

const router = Router();

router.post(
  '/',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ body: invoiceCreateSchema }),
  InvoicesController.createInvoice,
);

router.get(
  '/',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ query: invoiceListQuerySchema }),
  InvoicesController.listInvoices,
);

router.get(
  '/:invoiceId',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ params: invoiceIdParamSchema }),
  InvoicesController.getInvoiceById,
);

router.put(
  '/:invoiceId',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ params: invoiceIdParamSchema, body: invoiceUpdateSchema }),
  InvoicesController.updateInvoice,
);

router.post(
  '/:invoiceId/issue',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ params: invoiceIdParamSchema, body: invoiceIssueSchema }),
  InvoicesController.issueInvoice,
);

router.get(
  '/:invoiceId/pdf',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ params: invoiceIdParamSchema }),
  InvoicesController.downloadInvoicePdf,
);

router.post(
  '/:invoiceId/send',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ params: invoiceIdParamSchema, body: sendInvoiceEmailBodySchema }),
  InvoicesController.sendInvoiceEmail,
);

router.post(
  '/:invoiceId/resend',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ params: invoiceIdParamSchema, body: resendInvoiceEmailBodySchema }),
  InvoicesController.resendInvoiceEmail,
);

router.get(
  '/:invoiceId/email-deliveries',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ params: invoiceIdParamSchema }),
  InvoicesController.listInvoiceEmailDeliveries,
);

export { router as invoicesRouter };
