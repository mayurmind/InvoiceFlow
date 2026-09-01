import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client';
import { authenticateRequest, requirePasswordChangeCompleted } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();

router.get(
  '/summary',
  authenticateRequest,
  requirePasswordChangeCompleted,
  requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER),
  DashboardController.getSummary,
);

export { router as dashboardRouter };
