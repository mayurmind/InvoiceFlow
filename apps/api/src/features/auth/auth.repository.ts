import { Prisma } from '../../generated/prisma/client';
import type { User, Session } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';
import type { ITXClient } from '../../database/transaction';
import { SanitizedUser } from './auth.types';

export const getUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const getUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

export const getUserForUpdate = async (tx: ITXClient, userId: string) => {
  const users = await tx.$queryRaw<User[]>`
    SELECT
      "id",
      "email",
      "passwordHash",
      "firstName",
      "lastName",
      "role",
      "isActive",
      "mustChangePassword",
      "lastLoginAt",
      "createdAt",
      "updatedAt"
    FROM "users"
    WHERE "id" = ${userId}::uuid
    FOR UPDATE
  `;
  return users[0] ?? null;
};

export const createSession = async (
  tx: ITXClient,
  data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    lastUsedAt: Date;
    userAgent?: string;
    ipAddress?: string;
  },
) => {
  return tx.session.create({
    data,
  });
};

export const getSessionById = async (id: string) => {
  return prisma.session.findUnique({
    where: { id },
  });
};

export const updateUserLastLogin = async (tx: ITXClient, userId: string, lastLoginAt: Date) => {
  return tx.user.update({
    where: { id: userId },
    data: { lastLoginAt },
  });
};

export const createAuditLog = async (
  tx: ITXClient | typeof prisma,
  data: {
    action: string;
    actorUserId?: string | null;
    entityType: string;
    entityId?: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
  },
) => {
  return tx.auditLog.create({
    data: {
      action: data.action,
      actorUserId: data.actorUserId,
      entityType: data.entityType,
      entityId: data.entityId,
      requestId: data.requestId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata || Prisma.JsonNull,
    },
  });
};

export const mapUserToSanitized = (user: User): SanitizedUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
});

export const getSessionByHash = async (tokenHash: string) => {
  return prisma.session.findUnique({
    where: { tokenHash },
  });
};

export const getSessionForUpdate = async (tx: ITXClient, sessionId: string) => {
  const sessions = await tx.$queryRaw<Session[]>`
    SELECT
      "id",
      "userId",
      "tokenHash",
      "familyId",
      "expiresAt",
      "revokedAt",
      "revocationReason",
      "lastUsedAt",
      "userAgent",
      "ipAddress",
      "rotatedAt",
      "replacedBySessionId",
      "createdAt"
    FROM "sessions"
    WHERE "id" = ${sessionId}::uuid
    FOR UPDATE
  `;
  return sessions[0] ?? null;
};

export const invalidateFamily = async (
  tx: ITXClient,
  familyId: string,
  reason: string,
  revokedAt: Date,
) => {
  return tx.session.updateMany({
    where: { familyId, revokedAt: null },
    data: {
      revokedAt,
      revocationReason: reason,
    },
  });
};

export const invalidateAllUserSessions = async (
  tx: ITXClient,
  userId: string,
  reason: string,
  revokedAt: Date,
) => {
  return tx.session.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt,
      revocationReason: reason,
    },
  });
};

export const replaceSession = async (
  tx: ITXClient,
  oldSessionId: string,
  newSessionId: string,
  rotationAt: Date,
) => {
  return tx.session.update({
    where: { id: oldSessionId },
    data: {
      rotatedAt: rotationAt,
      replacedBySessionId: newSessionId,
      lastUsedAt: rotationAt,
    },
  });
};
