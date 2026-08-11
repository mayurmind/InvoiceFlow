import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import * as tokensUtils from '../../src/features/auth/tokens';
import * as authService from '../../src/features/auth/auth.service';

vi.mock('../../src/features/auth/csrf', () => ({
  verifyCsrfToken: vi.fn().mockReturnValue(true),
  generateCsrfToken: vi.fn().mockReturnValue('mock-csrf'),
}));

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

const cleanupAuthFixtures = async (): Promise<void> => {
  await assertIsolatedTestDatabase();

  await prisma.$transaction(async (tx) => {
    // TEST-HARNESS ONLY:
    // audit_logs is append-only for application DML, so normal DELETE is
    // intentionally forbidden. TRUNCATE is used only after verifying the
    // isolated local invoiceflow_test database.
    await tx.$executeRaw`TRUNCATE TABLE public."audit_logs"`;

    await tx.session.deleteMany();
    await tx.user.deleteMany();
  });
};

describe('Auth Refresh Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanupAuthFixtures();
  });

  afterEach(async () => {
    await cleanupAuthFixtures();
  });

  const setupBaseState = async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${crypto.randomUUID()}@example.com`,
        passwordHash: 'dummy',
        firstName: 'T',
        lastName: 'U',
        isActive: true,
      },
    });

    const familyId = crypto.randomUUID();
    const refreshCredential = tokensUtils.generateRefreshCredential();
    const rawRefresh = refreshCredential.raw;
    const tokenHash = refreshCredential.hash;
    const csrfToken = 'valid-csrf';

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        lastUsedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      },
    });

    const makeReq = (refresh: string) =>
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', [`invoiceflow-refresh=${refresh}`])
        .set('x-csrf-token', csrfToken);

    return { user, familyId, rawRefresh, session, makeReq };
  };

  it('A. Successful rotation', async () => {
    const { user, familyId, rawRefresh, session: s1, makeReq } = await setupBaseState();

    const t0 = new Date();
    const res = await makeReq(rawRefresh);
    const t1 = new Date();

    expect(res.status).toBe(200);

    const s1Db = await prisma.session.findUnique({ where: { id: s1.id } });
    expect(s1Db).toBeDefined();
    expect(s1Db!.rotatedAt).not.toBeNull();

    // Find child S2
    const s2Db = await prisma.session.findFirst({
      where: { familyId, id: { not: s1.id } },
    });

    expect(s2Db).toBeDefined();
    expect(s1Db!.replacedBySessionId).toBe(s2Db!.id);
    expect(s2Db!.userId).toBe(user.id);
    expect(s2Db!.expiresAt).toStrictEqual(s1.expiresAt); // absolute expiresAt preserved
    expect(s2Db!.tokenHash).not.toBe(s1.tokenHash);
    expect(s2Db!.revokedAt).toBeNull();
    expect(s2Db!.rotatedAt).toBeNull();
    expect(s2Db!.replacedBySessionId).toBeNull();

    // Check timestamps
    expect(s1Db!.lastUsedAt.getTime()).toBeGreaterThanOrEqual(t0.getTime());
    expect(s1Db!.lastUsedAt.getTime()).toBeLessThanOrEqual(t1.getTime());
    expect(s2Db!.lastUsedAt.getTime()).toBeGreaterThanOrEqual(t0.getTime());
    expect(s2Db!.lastUsedAt.getTime()).toBeLessThanOrEqual(t1.getTime());
    expect(s1Db!.lastUsedAt).toEqual(s1Db!.rotatedAt);
    expect(s2Db!.lastUsedAt).toEqual(s1Db!.rotatedAt);
  });

  it('B. Replay', async () => {
    const { rawRefresh, session: s1, familyId, makeReq } = await setupBaseState();

    // First rotation
    await makeReq(rawRefresh);

    // Create another session in the family just to prove it gets revoked
    const otherChild = await prisma.session.create({
      data: {
        userId: s1.userId,
        familyId,
        tokenHash: 'other-hash',
        expiresAt: s1.expiresAt,
      },
    });

    const historicalAt = new Date(Date.now() - 100000);
    const historical = await prisma.session.create({
      data: {
        userId: s1.userId,
        familyId,
        tokenHash: 'historical-hash',
        expiresAt: s1.expiresAt,
        revokedAt: historicalAt,
        revocationReason: 'USER_LOGOUT',
      },
    });

    // Replay S1
    const replayRes = await makeReq(rawRefresh);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.message).toBe('Unauthorized');

    const s1Db = await prisma.session.findUnique({ where: { id: s1.id } });
    expect(s1Db!.revokedAt).not.toBeNull();
    expect(s1Db!.revocationReason).toBe('REFRESH_TOKEN_REUSE');

    const children = await prisma.session.findMany({ where: { familyId } });

    const otherChildDb = children.find((c) => c.id === otherChild.id);
    expect(otherChildDb!.revokedAt).not.toBeNull();
    expect(otherChildDb!.revocationReason).toBe('REFRESH_TOKEN_REUSE');

    const s2Db = children.find(
      (c) => c.id !== s1.id && c.id !== otherChild.id && c.id !== historical.id,
    );
    expect(s2Db).toBeDefined();
    expect(s2Db!.revokedAt).not.toBeNull();
    expect(s2Db!.revocationReason).toBe('REFRESH_TOKEN_REUSE');

    const historicalDb = children.find((c) => c.id === historical.id);
    expect(historicalDb!.revokedAt).toEqual(historicalAt);
    expect(historicalDb!.revocationReason).toBe('USER_LOGOUT');

    const auditLogs = await prisma.auditLog.findMany();
    const replayLog = auditLogs.find((l) => l.action === 'AUTH_REFRESH_REPLAY_DETECTED');
    expect(replayLog).toBeDefined();
    expect(replayLog!.actorUserId).toBeNull();
    expect(replayLog!.entityType).toBe('SESSION');
    expect(replayLog!.entityId).toBe(s1.id);
  });

  it('C. Same-token concurrency', async () => {
    const { rawRefresh, makeReq, familyId } = await setupBaseState();

    // Fire two refreshes concurrently
    const [res1, res2] = await Promise.all([makeReq(rawRefresh), makeReq(rawRefresh)]);

    // One should succeed, one should detect replay and fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);

    // Final family should be revoked/unusable
    const activeMembers = await prisma.session.findMany({
      where: { familyId, revokedAt: null },
    });
    // The one that succeeded created a child, but the replay should have revoked it
    expect(activeMembers.length).toBe(0);
  });

  it('D. Refresh/logout race - refresh wins first', async () => {
    const { user, rawRefresh, makeReq, familyId, session } = await setupBaseState();

    const refreshRes = await makeReq(rawRefresh);
    expect(refreshRes.status).toBe(200);

    await authService.logoutSession(session.id, user.id, {});

    const family = await prisma.session.findMany({ where: { familyId } });
    const unrevoked = family.filter((s) => !s.revokedAt);
    expect(unrevoked.length).toBe(0); // The child created by refresh was revoked by logout
  });

  it('D. Refresh/logout race - logout wins first', async () => {
    const { user, rawRefresh, makeReq, familyId, session } = await setupBaseState();

    await authService.logoutSession(session.id, user.id, {});

    const refreshRes = await makeReq(rawRefresh);
    expect(refreshRes.status).toBe(401);

    const family = await prisma.session.findMany({ where: { familyId } });
    expect(family.length).toBe(1); // No child created
  });

  it('D2. Refresh/logout actual concurrency', async () => {
    const { user, rawRefresh, makeReq, familyId, session } = await setupBaseState();

    await Promise.all([
      makeReq(rawRefresh),
      authService.logoutSession(session.id, user.id, {}).catch(() => {}),
    ]);

    const family = await prisma.session.findMany({ where: { familyId } });
    const unrevoked = family.filter((s) => !s.revokedAt);
    expect(unrevoked.length).toBe(0); // Final family state must be securely revoked
  });

  it('E. Refresh/logout-all race - refresh wins first', async () => {
    const { user, rawRefresh, makeReq, familyId } = await setupBaseState();

    const refreshRes = await makeReq(rawRefresh);
    expect(refreshRes.status).toBe(200);

    await authService.logoutAllSessions(user.id, {});

    const family = await prisma.session.findMany({ where: { familyId } });
    const unrevoked = family.filter((s) => !s.revokedAt);
    expect(unrevoked.length).toBe(0); // The child created by refresh was revoked
  });

  it('E. Refresh/logout-all race - logout-all wins first', async () => {
    const { user, rawRefresh, makeReq, familyId } = await setupBaseState();

    await authService.logoutAllSessions(user.id, {});

    const refreshRes = await makeReq(rawRefresh);
    expect(refreshRes.status).toBe(401);

    const family = await prisma.session.findMany({ where: { familyId } });
    expect(family.length).toBe(1); // No child created
  });

  it('F. Isolation', async () => {
    const { session: s1, user: u1 } = await setupBaseState();
    const { session: s2 } = await setupBaseState();

    // logout s1 doesn't affect f2
    await authService.logoutSession(s1.id, u1.id, {});
    const s2Db = await prisma.session.findUnique({ where: { id: s2.id } });
    expect(s2Db!.revokedAt).toBeNull();

    // logout-all u1 doesn't affect u2
    await authService.logoutAllSessions(u1.id, {});
    const s2DbAfter = await prisma.session.findUnique({ where: { id: s2.id } });
    expect(s2DbAfter!.revokedAt).toBeNull();
  });
});
