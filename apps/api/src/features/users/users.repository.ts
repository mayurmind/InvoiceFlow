import { Prisma, UserRole } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';
import { ManagedUser } from './users.types';
import type { ITXClient } from '../../database/transaction';

export const managedUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const listUsers = async (
  params: {
    limit: number;
    offset: number;
    role?: UserRole;
    isActive?: boolean;
  },
  client: ITXClient = prisma,
): Promise<ManagedUser[]> => {
  const where: Prisma.UserWhereInput = {};
  if (params.role !== undefined) where.role = params.role;
  if (params.isActive !== undefined) where.isActive = params.isActive;

  return client.user.findMany({
    where,
    select: managedUserSelect,
    take: params.limit,
    skip: params.offset,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
};

export const countUsers = async (
  params: {
    role?: UserRole;
    isActive?: boolean;
  },
  client: ITXClient = prisma,
): Promise<number> => {
  const where: Prisma.UserWhereInput = {};
  if (params.role !== undefined) where.role = params.role;
  if (params.isActive !== undefined) where.isActive = params.isActive;

  return client.user.count({ where });
};

export const getUserById = async (
  userId: string,
  client: ITXClient = prisma,
): Promise<ManagedUser | null> => {
  return client.user.findUnique({
    where: { id: userId },
    select: managedUserSelect,
  });
};

export const createUser = async (
  data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  },
  client: ITXClient = prisma,
): Promise<ManagedUser> => {
  return client.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: true,
      mustChangePassword: true,
    },
    select: managedUserSelect,
  });
};

export const getUserForUpdate = async (
  userId: string,
  client: ITXClient = prisma,
): Promise<ManagedUser | null> => {
  const rows = await client.$queryRaw<ManagedUser[]>`
    SELECT
      "id",
      "email",
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

  return rows[0] || null;
};

export const updateUserRole = async (
  userId: string,
  role: UserRole,
  client: ITXClient = prisma,
): Promise<ManagedUser> => {
  return client.user.update({
    where: { id: userId },
    data: { role },
    select: managedUserSelect,
  });
};

export const createUserAuditLog = async (
  data: {
    action: string;
    actorUserId: string;
    entityType: string;
    entityId: string;
    metadata: Prisma.InputJsonValue;
    ipAddress: string;
    userAgent: string;
    requestId: string;
  },
  client: ITXClient = prisma,
): Promise<void> => {
  await client.auditLog.create({
    data: {
      action: data.action,
      actorUserId: data.actorUserId,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      requestId: data.requestId,
    },
  });
};
