import { UserRole, Prisma } from '../../generated/prisma/client';
import { ManagedUser } from './users.types';
import * as usersRepo from './users.repository';
import { hashPassword } from '../auth/password';
import { runInTransaction } from '../../database/transaction';
import { ConflictError, NotFoundError, ForbiddenError } from '../../errors/application.error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isExactEmailFieldList = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 1 && value[0] === 'email';

const isUserEmailUniqueConflict = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const meta = error.meta;

  if (!isRecord(meta) || meta.modelName !== 'User') {
    return false;
  }

  // Standard Prisma P2002 metadata shape.
  if (isExactEmailFieldList(meta.target) || meta.target === 'users_email_key') {
    return true;
  }

  // Prisma driver-adapter metadata shape.
  const driverAdapterError = meta.driverAdapterError;

  if (!isRecord(driverAdapterError)) {
    return false;
  }

  const cause = driverAdapterError.cause;

  if (!isRecord(cause) || cause.kind !== 'UniqueConstraintViolation') {
    return false;
  }

  const constraint = cause.constraint;

  if (!isRecord(constraint)) {
    return false;
  }

  return isExactEmailFieldList(constraint.fields);
};

export const listUsers = async (params: {
  limit: number;
  offset: number;
  role?: UserRole;
  isActive?: boolean;
}): Promise<{
  users: ManagedUser[];
  pagination: { limit: number; offset: number; total: number };
}> => {
  const [users, total] = await Promise.all([
    usersRepo.listUsers(params),
    usersRepo.countUsers(params),
  ]);

  return {
    users,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
    },
  };
};

export const getUser = async (userId: string): Promise<ManagedUser> => {
  const user = await usersRepo.getUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

export const provisionUser = async (params: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  temporaryPassword: string;
  actorUserId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<ManagedUser> => {
  if (params.role !== UserRole.STAFF && params.role !== UserRole.VIEWER) {
    throw new ForbiddenError('Invalid provision role');
  }

  const hashedPassword = await hashPassword(params.temporaryPassword);

  try {
    return await runInTransaction(async (tx) => {
      const user = await usersRepo.createUser(
        {
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
          role: params.role,
          passwordHash: hashedPassword,
        },
        tx,
      );

      await usersRepo.createUserAuditLog(
        {
          action: 'USER_PROVISIONED',
          actorUserId: params.actorUserId,
          entityType: 'USER',
          entityId: user.id,
          metadata: { role: user.role },
          ipAddress: params.ipAddress.substring(0, 64),
          userAgent: params.userAgent.substring(0, 500),
          requestId: params.requestId,
        },
        tx,
      );

      return user;
    });
  } catch (error) {
    if (isUserEmailUniqueConflict(error)) {
      throw new ConflictError('A user with this email already exists.');
    }

    throw error;
  }
};

export const updateUserRole = async (params: {
  targetUserId: string;
  newRole: UserRole;
  actorUserId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<ManagedUser> => {
  if (params.newRole !== UserRole.STAFF && params.newRole !== UserRole.VIEWER) {
    throw new ForbiddenError('Invalid destination role');
  }

  return await runInTransaction(async (tx) => {
    const target = await usersRepo.getUserForUpdate(params.targetUserId, tx);
    if (!target) {
      throw new NotFoundError('User not found');
    }

    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Forbidden');
    }

    if (target.role === params.newRole) {
      return target; // No-op, same role
    }

    const previousRole = target.role;
    const updatedUser = await usersRepo.updateUserRole(params.targetUserId, params.newRole, tx);

    await usersRepo.createUserAuditLog(
      {
        action: 'USER_ROLE_CHANGED',
        actorUserId: params.actorUserId,
        entityType: 'USER',
        entityId: target.id,
        metadata: { previousRole, newRole: updatedUser.role },
        ipAddress: params.ipAddress.substring(0, 64),
        userAgent: params.userAgent.substring(0, 500),
        requestId: params.requestId,
      },
      tx,
    );

    return updatedUser;
  });
};
