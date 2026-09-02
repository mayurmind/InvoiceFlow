import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';

export interface AuditLogFilters {
  page: number;
  limit: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class AuditRepository {
  static async getAuditLogs(filters: AuditLogFilters) {
    const { page, limit, actorUserId, action, entityType, entityId, dateFrom, dateTo } = filters;

    const where: Prisma.AuditLogWhereInput = {};

    if (actorUserId) {
      where.actorUserId = actorUserId;
    }
    if (action) {
      where.action = action;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          actorUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return { total, data };
  }
}
