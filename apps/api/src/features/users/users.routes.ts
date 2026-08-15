import { Router } from 'express';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { originGuard } from '../auth/origin.middleware';
import { requireCsrfToken } from '../auth/csrf.middleware';
import { UserRole } from '../../generated/prisma/client';
import * as usersSchemas from './users.schemas';
import * as usersController from './users.controller';

export const usersRouter = Router();

usersRouter.get(
  '/',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  validateRequest(usersSchemas.listUsersSchema),
  usersController.listUsersHandler,
);

usersRouter.get(
  '/:userId',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  validateRequest(usersSchemas.getUserSchema),
  usersController.getUserHandler,
);

usersRouter.post(
  '/',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.createUserSchema),
  usersController.createUserHandler,
);

usersRouter.patch(
  '/:userId/role',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.updateUserRoleSchema),
  usersController.updateUserRoleHandler,
);

usersRouter.post(
  '/:userId/reset-password',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.resetPasswordSchema),
  usersController.resetUserPasswordHandler,
);

usersRouter.patch(
  '/:userId/status',
  originGuard,
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.updateUserStatusSchema),
  usersController.updateUserStatusHandler,
);
