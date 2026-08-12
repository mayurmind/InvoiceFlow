import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as usersService from '../../../src/features/users/users.service';
import * as usersRepo from '../../../src/features/users/users.repository';
import * as passwordModule from '../../../src/features/auth/password';
import * as transactionModule from '../../../src/database/transaction';
import { UserRole, Prisma } from '../../../src/generated/prisma/client';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../../../src/errors/application.error';
import { ManagedUser } from '../../../src/features/users/users.types';
import type { ITXClient } from '../../../src/database/transaction';

vi.mock('../../../src/features/users/users.repository');
vi.mock('../../../src/features/auth/password');
vi.mock('../../../src/database/transaction', () => ({
  runInTransaction: vi.fn(async (cb) => {
    return await cb({} as unknown as ITXClient);
  }),
}));

describe('Users Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersRepo.createUserAuditLog).mockReset();
    vi.mocked(usersRepo.createUserAuditLog).mockResolvedValue(undefined);
  });

  const mockUser: ManagedUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    firstName: 'First',
    lastName: 'Last',
    role: UserRole.STAFF,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('listUsers', () => {
    it('applies filters and pagination (list filters/pagination)', async () => {
      vi.mocked(usersRepo.listUsers).mockResolvedValue([mockUser]);
      vi.mocked(usersRepo.countUsers).mockResolvedValue(1);

      const res = await usersService.listUsers({ limit: 10, offset: 5, role: UserRole.STAFF });
      expect(res.users).toEqual([mockUser]);
      expect(res.pagination).toEqual({ limit: 10, offset: 5, total: 1 });
      expect(usersRepo.listUsers).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        role: UserRole.STAFF,
      });
    });
  });

  describe('getUser', () => {
    it('returns found user (get found)', async () => {
      vi.mocked(usersRepo.getUserById).mockResolvedValue(mockUser);
      const res = await usersService.getUser('user-id-123');
      expect(res).toEqual(mockUser);
    });

    it('throws NotFoundError if missing (get missing)', async () => {
      vi.mocked(usersRepo.getUserById).mockResolvedValue(null);
      await expect(usersService.getUser('user-id-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('provisionUser', () => {
    const provisionInput = {
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      role: UserRole.STAFF,
      temporaryPassword: 'StrongPassword123',
      actorUserId: 'admin-id',
      requestId: 'req-id',
      ipAddress: 'A'.repeat(100),
      userAgent: 'B'.repeat(600),
    };

    it('creates STAFF, bounds IP/UA, hashes password correctly', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');
      vi.mocked(usersRepo.createUser).mockResolvedValue(mockUser);
      let hashComplete = false;
      vi.mocked(passwordModule.hashPassword).mockImplementation(async () => {
        hashComplete = true;
        return 'hashed-pass';
      });

      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(async (cb) => {
        expect(hashComplete).toBe(true); // hash completes before transaction callback executes
        return await cb(mockTx);
      });

      const res = await usersService.provisionUser(provisionInput);

      expect(res).toEqual(mockUser);
      expect(passwordModule.hashPassword).toHaveBeenCalledWith('StrongPassword123'); // hashPassword called
      expect(usersRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          passwordHash: 'hashed-pass', // hashed value reaches repository
          role: UserRole.STAFF, // STAFF create
        }),
        mockTx,
      );
      // raw temporaryPassword never reaches repository
      expect(vi.mocked(usersRepo.createUser).mock.calls[0][0]).not.toHaveProperty(
        'temporaryPassword',
      );

      // provision audit action/actor/entity/metadata
      // IP bounded to 64
      // user agent bounded to 500
      expect(usersRepo.createUserAuditLog).toHaveBeenCalledWith(
        {
          action: 'USER_PROVISIONED',
          actorUserId: 'admin-id',
          entityType: 'USER',
          entityId: mockUser.id,
          metadata: { role: UserRole.STAFF },
          ipAddress: 'A'.repeat(64),
          userAgent: 'B'.repeat(500),
          requestId: 'req-id',
        },
        mockTx,
      );
    });

    it('VIEWER create', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');
      vi.mocked(usersRepo.createUser).mockResolvedValue(mockUser);
      await usersService.provisionUser({ ...provisionInput, role: UserRole.VIEWER });
      expect(usersRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.VIEWER }),
        expect.anything(),
      );
    });

    it('P2002 User.email driver-adapter conflict -> ConflictError', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');

      vi.mocked(transactionModule.runInTransaction).mockImplementation(() => {
        throw new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '1',
          meta: {
            modelName: 'User',
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: {
                originalCode: '23505',
                kind: 'UniqueConstraintViolation',
                constraint: {
                  fields: ['email'],
                },
              },
            },
          },
        });
      });

      await expect(usersService.provisionUser(provisionInput)).rejects.toThrow(ConflictError);
    });

    it('unrelated P2002 remains system error', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');

      vi.mocked(transactionModule.runInTransaction).mockImplementation(() => {
        throw new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '1',
          meta: {
            modelName: 'User',
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: {
                originalCode: '23505',
                kind: 'UniqueConstraintViolation',
                constraint: {
                  fields: ['other'],
                },
              },
            },
          },
        });
      });

      await expect(usersService.provisionUser(provisionInput)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });

    it('other-model email P2002 remains system error', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');

      vi.mocked(transactionModule.runInTransaction).mockImplementation(() => {
        throw new Prisma.PrismaClientKnownRequestError('msg', {
          code: 'P2002',
          clientVersion: '1',
          meta: {
            modelName: 'OtherModel',
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: {
                originalCode: '23505',
                kind: 'UniqueConstraintViolation',
                constraint: {
                  fields: ['email'],
                },
              },
            },
          },
        });
      });

      await expect(usersService.provisionUser(provisionInput)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });

    it('audit failure rejects operation', async () => {
      vi.mocked(passwordModule.hashPassword).mockResolvedValue('hashed-pass');
      vi.mocked(usersRepo.createUser).mockResolvedValue(mockUser);
      vi.mocked(usersRepo.createUserAuditLog).mockRejectedValueOnce(new Error('Audit fail'));
      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(
        async (cb) => await cb(mockTx),
      );

      await expect(usersService.provisionUser(provisionInput)).rejects.toThrow('Audit fail');
    });
  });

  describe('updateUserRole', () => {
    const updateInput = {
      targetUserId: 'target-id',
      newRole: UserRole.VIEWER, // STAFF -> VIEWER by default mockUser
      actorUserId: 'admin-id',
      requestId: 'req-id',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('STAFF -> VIEWER with row lock and role audit metadata', async () => {
      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(
        async (cb) => await cb(mockTx),
      );
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue(mockUser); // role STAFF
      vi.mocked(usersRepo.updateUserRole).mockResolvedValue({ ...mockUser, role: UserRole.VIEWER });

      const res = await usersService.updateUserRole(updateInput);

      expect(res.role).toBe(UserRole.VIEWER);
      expect(usersRepo.getUserForUpdate).toHaveBeenCalledWith('target-id', mockTx); // row lock
      expect(usersRepo.updateUserRole).toHaveBeenCalledWith('target-id', UserRole.VIEWER, mockTx);
      expect(usersRepo.createUserAuditLog).toHaveBeenCalledWith(
        {
          action: 'USER_ROLE_CHANGED',
          actorUserId: 'admin-id',
          entityType: 'USER',
          entityId: mockUser.id,
          metadata: { previousRole: UserRole.STAFF, newRole: UserRole.VIEWER },
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          requestId: 'req-id',
        },
        mockTx,
      );
    });

    it('VIEWER -> STAFF', async () => {
      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(
        async (cb) => await cb(mockTx),
      );
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });
      vi.mocked(usersRepo.updateUserRole).mockResolvedValue({ ...mockUser, role: UserRole.STAFF });

      const res = await usersService.updateUserRole({ ...updateInput, newRole: UserRole.STAFF });
      expect(res.role).toBe(UserRole.STAFF);
    });

    it('target missing', async () => {
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue(null);
      await expect(usersService.updateUserRole(updateInput)).rejects.toThrow(NotFoundError);
    });

    it('target SUPER_ADMIN', async () => {
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });
      await expect(usersService.updateUserRole(updateInput)).rejects.toThrow(ForbiddenError);
    });

    it('invalid destination fails closed', async () => {
      await expect(
        usersService.updateUserRole({ ...updateInput, newRole: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('same-role no update/no audit', async () => {
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue({
        ...mockUser,
        role: UserRole.VIEWER,
      });
      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(
        async (cb) => await cb(mockTx),
      );

      const res = await usersService.updateUserRole(updateInput);
      expect(res.role).toBe(UserRole.VIEWER);
      expect(usersRepo.updateUserRole).not.toHaveBeenCalled();
      expect(usersRepo.createUserAuditLog).not.toHaveBeenCalled();
    });

    it('role audit failure rejects operation', async () => {
      vi.mocked(usersRepo.getUserForUpdate).mockResolvedValue(mockUser); // role STAFF
      vi.mocked(usersRepo.updateUserRole).mockResolvedValue({ ...mockUser, role: UserRole.VIEWER });
      vi.mocked(usersRepo.createUserAuditLog).mockRejectedValueOnce(new Error('Audit fail'));
      const mockTx = {} as unknown as ITXClient;
      vi.mocked(transactionModule.runInTransaction).mockImplementation(
        async (cb) => await cb(mockTx),
      );

      await expect(usersService.updateUserRole(updateInput)).rejects.toThrow('Audit fail');
    });
  });
});
