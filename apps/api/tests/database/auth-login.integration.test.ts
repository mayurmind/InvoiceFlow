import { describe, it, expect } from 'vitest';
import { withRollback } from './helpers/transaction';
import { hashPassword } from '../../src/features/auth/password';
import { generateRefreshCredential } from '../../src/features/auth/tokens';
import * as authRepo from '../../src/features/auth/auth.repository';
import crypto from 'node:crypto';

describe('Login Database Integration', () => {
  it('successfully persists session, updates lastLoginAt, and audits login within a rollback transaction', async () => {
    await withRollback(async (tx) => {
      // 1. Setup User
      const passwordHash = await hashPassword('TestPassword123!');
      const user = await tx.user.create({
        data: {
          email: 'login-db-test@example.com',
          passwordHash,
          firstName: 'Login',
          lastName: 'Test',
          role: 'VIEWER',
          isActive: true,
        },
      });

      // 2. Perform DB operations exactly as login service does
      const lockedUser = await authRepo.getUserForUpdate(tx, user.id);
      expect(lockedUser).toBeDefined();
      expect(lockedUser!.id).toBe(user.id);

      const refreshCredential = generateRefreshCredential();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7d
      const familyId = crypto.randomUUID();

      const session = await authRepo.createSession(tx, {
        userId: user.id,
        tokenHash: refreshCredential.hash,
        familyId,
        expiresAt,
        lastUsedAt: now,
      });

      await authRepo.updateUserLastLogin(tx, user.id, now);

      await authRepo.createAuditLog(tx, {
        action: 'AUTH_LOGIN_SUCCEEDED',
        actorUserId: user.id,
        entityType: 'SESSION',
        entityId: session.id,
      });

      // 3. Assertions
      const savedSession = await tx.session.findUnique({ where: { id: session.id } });
      expect(savedSession).not.toBeNull();
      expect(savedSession!.tokenHash).toBe(refreshCredential.hash);
      expect(savedSession!.tokenHash).not.toBe(refreshCredential.raw); // raw is not stored
      expect(savedSession!.familyId).toBe(familyId);
      expect(savedSession!.expiresAt.getTime()).toBe(expiresAt.getTime());
      expect(savedSession!.lastUsedAt!.getTime()).toBe(now.getTime());

      const savedUser = await tx.user.findUnique({ where: { id: user.id } });
      expect(savedUser!.lastLoginAt!.getTime()).toBe(now.getTime());

      const audit = await tx.auditLog.findFirst({
        where: { actorUserId: user.id, action: 'AUTH_LOGIN_SUCCEEDED' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.entityId).toBe(session.id);
    });
  });
});
