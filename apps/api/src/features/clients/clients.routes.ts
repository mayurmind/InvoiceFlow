import { Router } from 'express';
import { ClientsController } from './clients.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { requireCsrfToken } from '../auth/csrf.middleware';
import { originGuard } from '../auth/origin.middleware';
import { UserRole } from '../../generated/prisma/client';
import {
  createClientSchema,
  updateClientSchema,
  clientListQuerySchema,
  clientIdParamSchema,
} from './clients.schemas';

const router = Router();

// ============================================================
// READ ROUTES
// authenticateRequest -> requirePasswordChangeCompleted -> requireRoles -> validation -> controller
// ============================================================

router.get(
  '/',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ query: clientListQuerySchema }),
  ClientsController.listClients,
);

router.get(
  '/:clientId',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  validateRequest({ params: clientIdParamSchema }),
  ClientsController.getClientById,
);

// ============================================================
// MUTATING ROUTES
// originGuard -> authenticateRequest -> requirePasswordChangeCompleted -> requireRoles -> requireCsrfToken -> validation -> controller
// ============================================================

router.post(
  '/',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ body: createClientSchema }),
  ClientsController.createClient,
);

router.put(
  '/:clientId',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  requireCsrfToken,
  validateRequest({ params: clientIdParamSchema, body: updateClientSchema }),
  ClientsController.updateClient,
);

export const clientsRouter = router;
