import { Router } from 'express';
import { authenticateRequest } from '../auth/auth.middleware';
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
  requireRoles(UserRole.SUPER_ADMIN),
  validateRequest(usersSchemas.listUsersSchema),
  usersController.listUsersHandler,
);

usersRouter.get(
  '/:userId',
  authenticateRequest,
  requireRoles(UserRole.SUPER_ADMIN),
  validateRequest(usersSchemas.getUserSchema),
  usersController.getUserHandler,
);

usersRouter.post(
  '/',
  originGuard,
  authenticateRequest,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.createUserSchema),
  usersController.createUserHandler,
);

usersRouter.patch(
  '/:userId/role',
  originGuard,
  authenticateRequest,
  requireRoles(UserRole.SUPER_ADMIN),
  requireCsrfToken,
  validateRequest(usersSchemas.updateUserRoleSchema),
  usersController.updateUserRoleHandler,
);
