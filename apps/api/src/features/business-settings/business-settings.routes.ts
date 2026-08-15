import { Router } from 'express';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { originGuard } from '../auth/origin.middleware';
import { requireCsrfToken } from '../auth/csrf.middleware';
import { UserRole } from '../../generated/prisma/client';
import * as schemas from './business-settings.schemas';
import * as controller from './business-settings.controller';

export const businessSettingsRouter = Router();

businessSettingsRouter.get(
  '/',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF),
  controller.getBusinessSettingsHandler,
);

businessSettingsRouter.put(
  '/',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(schemas.updateBusinessSettingsSchema),
  controller.updateBusinessSettingsHandler,
);
