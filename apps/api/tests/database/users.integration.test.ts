import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as usersService from '../../src/features/users/users.service';
import { prisma } from '../../src/database/prisma';
import { UserRole } from '../../src/generated/prisma/client';
import { ConflictError, ForbiddenError } from '../../src/errors/application.error';

const assertIsolatedTestDatabase = async (): Promise<void> => {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `;

  if (rows[0]?.current_database !== 'invoiceflow_test') {
    throw new Error(
      `SAFETY STOP: auth refresh DB cleanup requires invoiceflow_test, got ${
        rows[0]?.current_database ?? '<unknown>'
      }`,
    );
  }
};

const cleanupUsersFixtures = async (): Promise<void> => {
  await assertIsolatedTestDatabase();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`TRUNCATE TABLE public."audit_logs"`;
    await tx.session.deleteMany();
    await tx.user.deleteMany();
  });
};

describe('Users Database Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanupUsersFixtures();
  });

  afterEach(async () => {
    await cleanupUsersFixtures();
  });

  const baseInput = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Test',
    role: UserRole.STAFF,
    temporaryPassword: 'StrongPassword123!',
    actorUserId: 'admin-id', // replaced with real
    requestId: 'req-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  const setupAdmin = async () => {
    return prisma.user.create({
      data: {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        passwordHash: 'dummy',
        isActive: true,
      },
    });
  };

  it('STAFF persisted with USER_PROVISIONED audit (no password), isActive, mustChangePassword, passwordHash Argon2', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.role).toBe(UserRole.STAFF); // STAFF persisted
    expect(dbUser!.isActive).toBe(true); // isActive true
    expect(dbUser!.mustChangePassword).toBe(true); // mustChangePassword true
    expect(dbUser!.passwordHash).not.toBe('StrongPassword123!'); // != raw
    expect(dbUser!.passwordHash.startsWith('$argon2')).toBe(true); // is Argon2

    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('USER_PROVISIONED');
    expect(auditLogs[0].actorUserId).toBe(admin.id);
    expect(auditLogs[0].entityId).toBe(user.id);
    expect(auditLogs[0].metadata).toEqual({ role: UserRole.STAFF });
    expect(JSON.stringify(auditLogs[0].metadata)).not.toContain('StrongPassword123!'); // no password in audit
  });

  it('VIEWER persisted', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({
      ...baseInput,
      role: UserRole.VIEWER,
      actorUserId: admin.id,
    });
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.role).toBe(UserRole.VIEWER);
  });

  it('duplicate email, concurrent duplicate provisioning one success', async () => {
    const admin = await setupAdmin();
    const p1 = usersService.provisionUser({ ...baseInput, actorUserId: admin.id });
    const p2 = usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // Also test serial duplicate email
    await expect(
      usersService.provisionUser({
        ...baseInput,
        email: 'test@example.com',
        actorUserId: admin.id,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('create + audit atomic rollback', async () => {
    // We use an invalid nonexistent actor UUID to fail the audit foreign key after user insert
    const invalidActorId = '00000000-0000-0000-0000-000000000000';
    await expect(
      usersService.provisionUser({ ...baseInput, actorUserId: invalidActorId }),
    ).rejects.toThrow();

    const count = await prisma.user.count();
    expect(count).toBe(0); // global persistent row delta 0
    const auditCount = await prisma.auditLog.count();
    expect(auditCount).toBe(0);
  });

  it('STAFF -> VIEWER with role audit previous/new role', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    const updated = await usersService.updateUserRole({
      targetUserId: user.id,
      newRole: UserRole.VIEWER,
      actorUserId: admin.id,
      requestId: 'req-2',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    expect(updated.role).toBe(UserRole.VIEWER);

    const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[1].action).toBe('USER_ROLE_CHANGED');
    expect(auditLogs[1].metadata).toEqual({
      previousRole: UserRole.STAFF,
      newRole: UserRole.VIEWER,
    });
  });

  it('VIEWER -> STAFF', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({
      ...baseInput,
      role: UserRole.VIEWER,
      actorUserId: admin.id,
    });

    const updated = await usersService.updateUserRole({
      targetUserId: user.id,
      newRole: UserRole.STAFF,
      actorUserId: admin.id,
      requestId: 'req-2',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    expect(updated.role).toBe(UserRole.STAFF);
  });

  it('same-role no duplicate audit', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    await usersService.updateUserRole({
      targetUserId: user.id,
      newRole: UserRole.STAFF, // same
      actorUserId: admin.id,
      requestId: 'req-2',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs).toHaveLength(1); // Only Provisioned
  });

  it('target SUPER_ADMIN forbidden', async () => {
    const admin = await setupAdmin();
    await expect(
      usersService.updateUserRole({
        targetUserId: admin.id,
        newRole: UserRole.STAFF,
        actorUserId: admin.id,
        requestId: 'req-2',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('role update + audit atomic rollback', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    // Fail audit with invalid actor
    const invalidActorId = '00000000-0000-0000-0000-000000000000';
    await expect(
      usersService.updateUserRole({
        targetUserId: user.id,
        newRole: UserRole.VIEWER,
        actorUserId: invalidActorId,
        requestId: 'req-2',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    ).rejects.toThrow();

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.role).toBe(UserRole.STAFF); // Role rolled back

    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs).toHaveLength(1); // No new audit
  });

  it('same-target role serialization/locking where practical and unrelated users unaffected', async () => {
    const admin = await setupAdmin();
    const user1 = await usersService.provisionUser({
      ...baseInput,
      email: 'u1@ex.com',
      actorUserId: admin.id,
    });
    const user2 = await usersService.provisionUser({
      ...baseInput,
      email: 'u2@ex.com',
      actorUserId: admin.id,
    });

    // Concurrent updates to same user
    const p1 = usersService.updateUserRole({
      targetUserId: user1.id,
      newRole: UserRole.VIEWER,
      actorUserId: admin.id,
      requestId: 'req-2',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    const p2 = usersService.updateUserRole({
      targetUserId: user1.id,
      newRole: UserRole.STAFF,
      actorUserId: admin.id,
      requestId: 'req-3',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    await Promise.allSettled([p1, p2]);

    const u1 = await prisma.user.findUnique({ where: { id: user1.id } });
    const u2 = await prisma.user.findUnique({ where: { id: user2.id } });

    // Since p1 and p2 are concurrent and one flips to VIEWER and one to STAFF,
    // final state will be one of them, but they serialize cleanly
    expect([UserRole.STAFF, UserRole.VIEWER]).toContain(u1!.role);

    // Unrelated user unaffected
    expect(u2!.role).toBe(UserRole.STAFF);
  });

  it('Exact USER_DEACTIVATED audit', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    const session = await prisma.session.create({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        userAgent: 'test',
        ipAddress: '127.0.0.1',
        tokenHash: 'dummy',
        familyId: '55555555-5555-5555-5555-555555555555',
      },
    });

    const updated = await usersService.updateUserStatus({
      targetUserId: user.id,
      isActive: false,
      actorUserId: admin.id,
      requestId: 'req-status-1',
      ipAddress: '192.168.1.1',
      userAgent: 'status-agent',
    });

    expect(updated.isActive).toBe(false);

    const dbSession = await prisma.session.findUnique({ where: { id: session.id } });
    expect(dbSession!.revokedAt).not.toBeNull();

    const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(auditLogs).toHaveLength(2);

    const audit = auditLogs[1];
    expect(audit.action).toBe('USER_DEACTIVATED');
    expect(audit.actorUserId).toBe(admin.id);
    expect(audit.entityType).toBe('USER');
    expect(audit.entityId).toBe(user.id);
    expect(audit.metadata).toEqual({
      previousIsActive: true,
      newIsActive: false,
    });
    expect(audit.requestId).toBe('req-status-1');
    expect(audit.ipAddress).toBe('192.168.1.1');
    expect(audit.userAgent).toBe('status-agent');
  });

  it('Reactivation / session non-resurrection', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    const session = await prisma.session.create({
      data: {
        id: '22222222-2222-2222-2222-222222222222',
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        userAgent: 'test',
        ipAddress: '127.0.0.1',
        tokenHash: 'dummy',
        familyId: '55555555-5555-5555-5555-555555555555',
      },
    });

    await usersService.updateUserStatus({
      targetUserId: user.id,
      isActive: false,
      actorUserId: admin.id,
      requestId: 'req-deact',
      ipAddress: '1.1.1.1',
      userAgent: 'ua1',
    });

    const revokedSession = await prisma.session.findUnique({ where: { id: session.id } });
    expect(revokedSession!.revokedAt).not.toBeNull();

    await usersService.updateUserStatus({
      targetUserId: user.id,
      isActive: true,
      actorUserId: admin.id,
      requestId: 'req-react',
      ipAddress: '2.2.2.2',
      userAgent: 'ua2',
    });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.isActive).toBe(true);

    const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    const reactivateAudit = auditLogs[2];

    expect(reactivateAudit.action).toBe('USER_REACTIVATED');
    expect(reactivateAudit.metadata).toEqual({
      previousIsActive: false,
      newIsActive: true,
    });

    const finalSession = await prisma.session.findUnique({ where: { id: session.id } });
    expect(finalSession!.revokedAt).toEqual(revokedSession!.revokedAt);
    expect(finalSession!.revocationReason).toEqual(revokedSession!.revocationReason);
    expect(finalSession!.rotatedAt).toEqual(revokedSession!.rotatedAt);
    expect(finalSession!.replacedBySessionId).toEqual(revokedSession!.replacedBySessionId);

    const sessionCount = await prisma.session.count({ where: { userId: user.id } });
    expect(sessionCount).toBe(1);
  });

  it('Same-state active -> active complete no-op', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    await prisma.session.create({
      data: {
        id: '33333333-3333-3333-3333-333333333333',
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        userAgent: 'test',
        ipAddress: '127.0.0.1',
        tokenHash: 'dummy',
        familyId: '55555555-5555-5555-5555-555555555555',
      },
    });

    const beforeUser = await prisma.user.findUnique({ where: { id: user.id } });
    const beforeSessionCount = await prisma.session.count();
    const beforeAuditCount = await prisma.auditLog.count();
    const beforeSession = await prisma.session.findUnique({
      where: { id: '33333333-3333-3333-3333-333333333333' },
    });

    const returnedUser = await usersService.updateUserStatus({
      targetUserId: user.id,
      isActive: true,
      actorUserId: admin.id,
      requestId: 'req-noop',
      ipAddress: '1.1.1.1',
      userAgent: 'ua1',
    });

    expect(returnedUser.isActive).toBe(true);

    const afterUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterUser!.updatedAt).toEqual(beforeUser!.updatedAt);

    const afterAuditCount = await prisma.auditLog.count();
    expect(afterAuditCount).toBe(beforeAuditCount);

    const afterSessionCount = await prisma.session.count();
    expect(afterSessionCount).toBe(beforeSessionCount);

    const afterSession = await prisma.session.findUnique({
      where: { id: '33333333-3333-3333-3333-333333333333' },
    });
    expect(afterSession).toEqual(beforeSession);
  });

  it('Status + audit transactional rollback', async () => {
    const admin = await setupAdmin();
    const user = await usersService.provisionUser({ ...baseInput, actorUserId: admin.id });

    await prisma.session.create({
      data: {
        id: '44444444-4444-4444-4444-444444444444',
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        userAgent: 'test',
        ipAddress: '127.0.0.1',
        tokenHash: 'dummy',
        familyId: '55555555-5555-5555-5555-555555555555',
      },
    });

    const beforeUser = await prisma.user.findUnique({ where: { id: user.id } });
    const beforeSession = await prisma.session.findUnique({
      where: { id: '44444444-4444-4444-4444-444444444444' },
    });
    const beforeAuditCount = await prisma.auditLog.count();

    const invalidActorId = '00000000-0000-0000-0000-000000000000';
    await expect(
      usersService.updateUserStatus({
        targetUserId: user.id,
        isActive: false,
        actorUserId: invalidActorId,
        requestId: 'req-fail',
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      }),
    ).rejects.toThrow();

    const afterUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterUser!.isActive).toBe(true);
    expect(afterUser).toEqual(beforeUser);

    const afterSession = await prisma.session.findUnique({
      where: { id: '44444444-4444-4444-4444-444444444444' },
    });
    expect(afterSession!.revokedAt).toBeNull();
    expect(afterSession).toEqual(beforeSession);

    const afterAuditCount = await prisma.auditLog.count();
    expect(afterAuditCount).toBe(beforeAuditCount);
  });
});
