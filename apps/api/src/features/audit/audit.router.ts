import { Router } from 'express';
import { AuditController } from './audit.controller';
import { authenticateRequest } from '../auth/auth.middleware';
import { requireRoles } from '../auth/rbac.middleware';
import { UserRole } from '../../generated/prisma/client';

export const auditRouter = Router();

// All audit routes require SUPER_ADMIN role
auditRouter.use(authenticateRequest);
auditRouter.use(requireRoles(UserRole.SUPER_ADMIN));

auditRouter.get('/', AuditController.listAuditLogs);
