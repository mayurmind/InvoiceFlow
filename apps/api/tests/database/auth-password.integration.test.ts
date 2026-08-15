import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/database/prisma';
import { changePassword } from '../../src/features/auth/auth.service';
import { hashPassword, verifyPassword } from '../../src/features/auth/password';
import { resetPassword, updateUserStatus } from '../../src/features/users/users.service';
import { UserRole } from '../../src/generated/prisma/client';

const assertIsolatedTestDatabase = async (): Promise<void> => {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `;

  if (rows[0]?.current_database !== 'invoiceflow_test') {
    throw new Error(
      `SAFETY STOP: P3.5 DB cleanup requires invoiceflow_test, got ${
        rows[0]?.current_database ?? '<unknown>'
      }`,
    );
  }
};

describe('Password Management Integration (P3.5)', () => {
  const adminId = '11111111-1111-1111-1111-111111111111';
  let targetUserId: string;
  let targetSessionId: string;

  beforeAll(async () => {
    await assertIsolatedTestDatabase();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE public."audit_logs"`;
      await tx.session.deleteMany({});
      await tx.user.deleteMany({});
    });

    await prisma.user.create({
      data: {
        id: adminId,
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: await hashPassword('AdminPass123456!'),
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await assertIsolatedTestDatabase();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE public."audit_logs"`;
      await tx.session.deleteMany({});
      await tx.user.deleteMany({});
    });
  });

  beforeEach(async () => {
    await assertIsolatedTestDatabase();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE public."audit_logs"`;
      await tx.session.deleteMany({});
      await tx.user.deleteMany({
        where: {
          id: {
            not: adminId,
          },
        },
      });
    });

    const user = await prisma.user.create({
      data: {
        email: 'target@test.com',
        firstName: 'Target',
        lastName: 'User',
        passwordHash: await hashPassword('OldPass12345678!'),
        role: UserRole.STAFF,
        isActive: true,
        mustChangePassword: true,
      },
    });
    targetUserId = user.id;

    // Create an active session
    const session = await prisma.session.create({
      data: {
        userId: targetUserId,
        tokenHash: `p35-session-${randomUUID()}`,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    targetSessionId = session.id;
  });

  describe('Self Password Change', () => {
    it('successfully changes password and clears mustChangePassword', async () => {
      await changePassword(targetUserId, 'OldPass12345678!', 'NewPass12345678!', {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
      expect(user.mustChangePassword).toBe(false);
      expect(await verifyPassword(user.passwordHash, 'NewPass12345678!')).toBe(true);

      const session = await prisma.session.findUnique({ where: { id: targetSessionId } });
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revocationReason).toBe('PASSWORD_CHANGED');
    });

    it('rejects concurrent password change attempts if password changes mid-flight', async () => {
      // Simulate race condition by throwing after hash is read.
      // The application code checks preTxUser vs lockedUser.

      const p1 = changePassword(targetUserId, 'OldPass12345678!', 'NewPass12345678!', {});
      const p2 = changePassword(targetUserId, 'OldPass12345678!', 'AnotherPass1234!', {});

      const results = await Promise.allSettled([p1, p2]);

      const success = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(success.length).toBe(1);
      expect(failures.length).toBe(1);
    });
  });

  describe('Admin Password Reset', () => {
    it('successfully resets password and sets mustChangePassword', async () => {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { mustChangePassword: false },
      });

      await resetPassword({
        targetUserId,
        temporaryPassword: 'TempPassword123!',
        actorUserId: adminId,
        requestId: 'req-1',
        ipAddress: '127.0.0.1',
        userAgent: 'admin-agent',
      });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
      expect(user.mustChangePassword).toBe(true);
      expect(await verifyPassword(user.passwordHash, 'TempPassword123!')).toBe(true);

      const session = await prisma.session.findUnique({ where: { id: targetSessionId } });
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revocationReason).toBe('ADMIN_PASSWORD_RESET');
    });

    it('prevents resetting SUPER_ADMIN password', async () => {
      await expect(
        resetPassword({
          targetUserId: adminId,
          temporaryPassword: 'TempPassword123!',
          actorUserId: adminId,
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'admin-agent',
        }),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('Admin Status Change', () => {
    it('deactivates account and revokes sessions', async () => {
      await updateUserStatus({
        targetUserId,
        isActive: false,
        actorUserId: adminId,
        requestId: 'req-1',
        ipAddress: '127.0.0.1',
        userAgent: 'admin-agent',
      });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
      expect(user.isActive).toBe(false);

      const session = await prisma.session.findUnique({ where: { id: targetSessionId } });
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revocationReason).toBe('ACCOUNT_DEACTIVATED');
    });
  });
});
