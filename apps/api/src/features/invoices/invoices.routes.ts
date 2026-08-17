import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client';
import { originGuard } from '../auth/origin.middleware';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { requireCsrfToken } from '../auth/csrf.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { InvoicesController } from './invoices.controller';
import { invoiceCreateSchema } from './invoices.schemas';

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

export { router as invoicesRouter };
