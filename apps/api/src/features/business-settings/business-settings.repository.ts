import { BusinessSettings, Prisma } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';
import { ITXClient } from '../../database/transaction';
import { BusinessSettingsUpdatePayload } from './business-settings.types';

export const acquireSingletonLock = async (tx: ITXClient): Promise<void> => {
  // Use a transaction-scoped advisory lock using a fixed key for the BusinessSettings singleton.
  // 1001 is an arbitrary integer identifier for this specific domain lock.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(1001)');
};

export const getBusinessSettings = async (
  tx: ITXClient | typeof prisma = prisma,
): Promise<BusinessSettings | null> => {
  return await tx.businessSettings.findUnique({
    where: {
      singletonKey: 'DEFAULT',
    },
  });
};

export const createBusinessSettings = async (
  payload: BusinessSettingsUpdatePayload,
  tx: ITXClient,
): Promise<BusinessSettings> => {
  return await tx.businessSettings.create({
    data: {
      singletonKey: 'DEFAULT',
      ...payload,
    },
  });
};

export const updateBusinessSettings = async (
  id: string,
  payload: BusinessSettingsUpdatePayload,
  tx: ITXClient,
): Promise<BusinessSettings> => {
  return await tx.businessSettings.update({
    where: {
      id,
    },
    data: payload,
  });
};

export const createBusinessSettingsAuditLog = async (
  data: {
    action: string;
    actorUserId: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    ipAddress: string;
    userAgent: string;
    requestId: string;
  },
  tx: ITXClient,
): Promise<void> => {
  await tx.auditLog.create({
    data: {
      action: data.action,
      actorUserId: data.actorUserId,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata as Prisma.InputJsonValue,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      requestId: data.requestId,
    },
  });
};
