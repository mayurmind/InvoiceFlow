import crypto from 'node:crypto';
import { env } from '../../config/env';
import { runInTransaction } from '../../database/transaction';
import {
  AuthenticationFailedError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../errors/application.error';
import { parseDurationToMs } from '../../utilities/duration';
import { verifyPassword, hashPassword } from './password';
import { generateAccessToken, generateRefreshCredential } from './tokens';
import { logger } from '../../utilities/logger';
import {
  getUserByEmail,
  getUserForUpdate,
  createSession,
  updateUserLastLogin,
  createAuditLog,
  mapUserToSanitized,
  getSessionByHash,
  getSessionForUpdate,
  invalidateFamily,
  invalidateAllUserSessions,
  replaceSession,
} from './auth.repository';
import { hashRefreshCredential } from './tokens';
import { verifyCsrfToken, generateCsrfToken } from './csrf';

// Precomputed valid Argon2id hash for timing equalization.
// Uses m=19456, t=2, p=1 to match P3.1 password parameters.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$c29tZWhhc2hzb21laGFzaHNvbWVoYXNoc29tZWhhc2g';

export const login = async (
  email: string,
  password: string,
  clientInfo: { ip?: string; userAgent?: string; requestId?: string },
) => {
  const boundedIp = clientInfo.ip?.slice(0, 64);
  const boundedUa = clientInfo.userAgent?.slice(0, 500);

  // 1. Fetch candidate user
  const user = await getUserByEmail(email);

  // 2. Perform Argon2 verification (real or dummy)
  const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
  const isPasswordValid = await verifyPassword(hashToVerify, password);

  // 3. Evaluate credentials
  if (!user || !isPasswordValid) {
    try {
      const { prisma } = await import('../../database/prisma');
      await createAuditLog(prisma, {
        action: 'AUTH_LOGIN_FAILED',
        actorUserId: null,
        entityType: 'AUTH',
        entityId: null,
        ipAddress: boundedIp,
        userAgent: boundedUa,
        requestId: clientInfo.requestId,
      });
    } catch {
      logger.warn({ requestId: clientInfo.requestId }, 'Failed to persist AUTH_LOGIN_FAILED audit');
    }

    throw new AuthenticationFailedError();
  }

  // 4. Generate refresh credential and familyId
  const refreshCredential = generateRefreshCredential();
  const familyId = crypto.randomUUID();

  // 5. Transaction
  const result = await runInTransaction(async (tx) => {
    // 5.1 Lock user
    const lockedUser = await getUserForUpdate(tx, user.id);

    // 5.2 Re-verify state
    if (!lockedUser) {
      throw new AuthenticationFailedError();
    }
    if (lockedUser.isActive !== true) {
      throw new AuthenticationFailedError();
    }
    if (lockedUser.passwordHash !== hashToVerify) {
      throw new AuthenticationFailedError();
    }

    // 5.3 Establish login time
    const loginAt = new Date();

    // 5.4 Create session
    const refreshMs = parseDurationToMs(env.REFRESH_TOKEN_TTL);
    const expiresAt = new Date(loginAt.getTime() + refreshMs);

    const session = await createSession(tx, {
      userId: lockedUser.id,
      tokenHash: refreshCredential.hash,
      familyId,
      expiresAt,
      lastUsedAt: loginAt,
      ipAddress: boundedIp,
      userAgent: boundedUa,
    });

    // 5.5 Create JWT
    const accessToken = generateAccessToken({
      sub: lockedUser.id,
      sid: session.id,
      role: lockedUser.role,
    });

    // 5.6 Update last login
    await updateUserLastLogin(tx, lockedUser.id, loginAt);

    // 5.7 Audit success
    await createAuditLog(tx, {
      action: 'AUTH_LOGIN_SUCCEEDED',
      actorUserId: lockedUser.id,
      entityType: 'SESSION',
      entityId: session.id,
      ipAddress: boundedIp,
      userAgent: boundedUa,
      requestId: clientInfo.requestId,
    });

    // 5.8 Return
    return {
      user: mapUserToSanitized({ ...lockedUser, lastLoginAt: loginAt }),
      accessToken,
      rawRefreshToken: refreshCredential.raw,
    };
  });

  return result;
};

export const refreshSession = async (
  rawRefreshToken: string,
  csrfToken: string,
  clientInfo: { ip?: string; userAgent?: string; requestId?: string },
) => {
  const boundedIp = clientInfo.ip?.slice(0, 64);
  const boundedUa = clientInfo.userAgent?.slice(0, 500);

  if (
    typeof rawRefreshToken !== 'string' ||
    rawRefreshToken.length !== 64 ||
    !/^[A-Za-z0-9_-]+$/.test(rawRefreshToken)
  ) {
    throw new UnauthorizedError();
  }
  const tokenHash = hashRefreshCredential(rawRefreshToken);
  const candidateSession = await getSessionByHash(tokenHash);

  if (!candidateSession) {
    throw new UnauthorizedError();
  }

  const isValidCsrf = verifyCsrfToken(candidateSession.id, csrfToken);
  if (!isValidCsrf) {
    throw new ForbiddenError();
  }

  const refreshCredential = generateRefreshCredential();

  const result = await runInTransaction(async (tx) => {
    // User -> Session locking
    const lockedUser = await getUserForUpdate(tx, candidateSession.userId);
    const lockedSession = await getSessionForUpdate(tx, candidateSession.id);

    // Revalidate inside transaction
    const rotationAt = new Date();

    if (!lockedSession) {
      throw new UnauthorizedError();
    }
    if (!lockedUser) {
      throw new UnauthorizedError();
    }
    if (lockedSession.userId !== lockedUser.id) {
      throw new UnauthorizedError();
    }
    if (lockedSession.tokenHash !== tokenHash) {
      throw new UnauthorizedError();
    }
    if (lockedUser.isActive !== true) {
      throw new UnauthorizedError();
    }
    if (lockedSession.revokedAt !== null) {
      throw new UnauthorizedError();
    }
    if (lockedSession.expiresAt.getTime() <= rotationAt.getTime()) {
      throw new UnauthorizedError();
    }

    const remainingRefreshMs = lockedSession.expiresAt.getTime() - rotationAt.getTime();
    if (!Number.isSafeInteger(remainingRefreshMs) || remainingRefreshMs <= 0) {
      throw new UnauthorizedError();
    }

    // Replay only when otherwise eligible locked Session has rotated or replaced
    if (lockedSession.rotatedAt !== null || lockedSession.replacedBySessionId !== null) {
      const replayAt = new Date();
      await invalidateFamily(tx, lockedSession.familyId, 'REFRESH_TOKEN_REUSE', replayAt);

      await createAuditLog(tx, {
        action: 'AUTH_REFRESH_REPLAY_DETECTED',
        actorUserId: null,
        entityType: 'SESSION',
        entityId: lockedSession.id,
        ipAddress: boundedIp,
        userAgent: boundedUa,
        requestId: clientInfo.requestId,
      });

      return { kind: 'replay' as const };
    }

    // Create new child session
    const newSession = await createSession(tx, {
      userId: lockedUser.id,
      tokenHash: refreshCredential.hash,
      familyId: lockedSession.familyId,
      expiresAt: lockedSession.expiresAt,
      lastUsedAt: rotationAt,
      ipAddress: boundedIp,
      userAgent: boundedUa,
    });

    // Parent atomic update
    await replaceSession(tx, lockedSession.id, newSession.id, rotationAt);

    // Generate JWT INSIDE transaction
    const accessToken = generateAccessToken({
      sub: lockedUser.id,
      sid: newSession.id,
      role: lockedUser.role,
    });

    await createAuditLog(tx, {
      action: 'AUTH_REFRESH_SUCCEEDED',
      actorUserId: lockedUser.id,
      entityType: 'SESSION',
      entityId: newSession.id,
      ipAddress: boundedIp,
      userAgent: boundedUa,
      requestId: clientInfo.requestId,
    });

    return {
      kind: 'success' as const,
      user: mapUserToSanitized(lockedUser),
      accessToken,
      rawRefreshToken: refreshCredential.raw,
      remainingRefreshMs,
    };
  });

  if (result.kind === 'replay') {
    throw new UnauthorizedError();
  }

  return result;
};

export const logoutSession = async (
  sessionId: string,
  userId: string,
  clientInfo: { ip?: string; userAgent?: string; requestId?: string },
) => {
  const boundedIp = clientInfo.ip?.slice(0, 64);
  const boundedUa = clientInfo.userAgent?.slice(0, 500);

  await runInTransaction(async (tx) => {
    // User lock -> current Session lock
    const lockedUser = await getUserForUpdate(tx, userId);
    if (!lockedUser) return;

    const lockedSession = await getSessionForUpdate(tx, sessionId);
    if (!lockedSession) return;

    if (lockedSession.userId !== lockedUser.id) return;

    const logoutAt = new Date();
    await invalidateFamily(tx, lockedSession.familyId, 'USER_LOGOUT', logoutAt);

    await createAuditLog(tx, {
      action: 'AUTH_LOGOUT',
      actorUserId: lockedUser.id,
      entityType: 'SESSION',
      entityId: lockedSession.id,
      ipAddress: boundedIp,
      userAgent: boundedUa,
      requestId: clientInfo.requestId,
    });
  });
};

export const logoutAllSessions = async (
  userId: string,
  clientInfo: { ip?: string; userAgent?: string; requestId?: string },
) => {
  const boundedIp = clientInfo.ip?.slice(0, 64);
  const boundedUa = clientInfo.userAgent?.slice(0, 500);

  await runInTransaction(async (tx) => {
    const lockedUser = await getUserForUpdate(tx, userId);
    if (!lockedUser) return;

    const logoutAllAt = new Date();
    await invalidateAllUserSessions(tx, userId, 'USER_LOGOUT_ALL', logoutAllAt);

    await createAuditLog(tx, {
      action: 'AUTH_LOGOUT_ALL',
      actorUserId: userId,
      entityType: 'USER',
      entityId: userId,
      ipAddress: boundedIp,
      userAgent: boundedUa,
      requestId: clientInfo.requestId,
    });
  });
};

export const generateCsrfForSession = async (rawRefreshToken: string) => {
  if (
    typeof rawRefreshToken !== 'string' ||
    rawRefreshToken.length !== 64 ||
    !/^[A-Za-z0-9_-]+$/.test(rawRefreshToken)
  ) {
    throw new UnauthorizedError();
  }
  const tokenHash = hashRefreshCredential(rawRefreshToken);
  const { getSessionByHash, getUserById } = await import('./auth.repository');
  const session = await getSessionByHash(tokenHash);

  if (!session) {
    throw new UnauthorizedError();
  }
  if (session.revokedAt !== null) {
    throw new UnauthorizedError();
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError();
  }
  if (session.rotatedAt !== null || session.replacedBySessionId !== null) {
    throw new UnauthorizedError();
  }

  const user = await getUserById(session.userId);
  if (!user || user.isActive !== true) {
    throw new UnauthorizedError();
  }

  return generateCsrfToken(session.id);
};

export const changePassword = async (
  userId: string,
  currentPasswordRaw: string,
  newPasswordRaw: string,
  clientInfo: { ip?: string; userAgent?: string; requestId?: string },
) => {
  const boundedIp = clientInfo.ip?.slice(0, 64);
  const boundedUa = clientInfo.userAgent?.slice(0, 500);

  const { getUserById } = await import('./auth.repository');
  const user = await getUserById(userId);
  if (!user || user.isActive !== true) {
    throw new UnauthorizedError('Current password is incorrect.');
  }

  // To get the actual passwordHash, we need the internal password state
  const { getPasswordStateForUpdate, updateUserPasswordState } =
    await import('../users/users.repository');
  // We don't have a non-locking password reader yet in users, but we can just use getUserForUpdate without a transaction? No, wait.
  // We can just use getPasswordStateForUpdate outside tx, or create a simple getter.
  // Actually, I can just use prisma directly here or create a getter.
  // I'll create a getter in users.repository.ts called `getUserPasswordStateById`.
  const { getUserPasswordStateById } = await import('../users/users.repository');
  const preTxUser = await getUserPasswordStateById(userId);
  if (!preTxUser) {
    throw new UnauthorizedError('Current password is incorrect.');
  }

  const isCurrentPasswordValid = await verifyPassword(preTxUser.passwordHash, currentPasswordRaw);
  if (!isCurrentPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect.');
  }

  // Prevent same password
  const isNewSameAsCurrent = await verifyPassword(preTxUser.passwordHash, newPasswordRaw);
  if (isNewSameAsCurrent) {
    throw new ConflictError('New password must be different from current password.');
  }

  const newPasswordHash = await hashPassword(newPasswordRaw);

  await runInTransaction(async (tx) => {
    const lockedUser = await getPasswordStateForUpdate(userId, tx);
    if (!lockedUser || lockedUser.isActive !== true) {
      throw new ConflictError('User state changed.');
    }

    if (lockedUser.passwordHash !== preTxUser.passwordHash) {
      throw new ConflictError('Password state changed concurrently.');
    }

    await updateUserPasswordState(userId, newPasswordHash, false, tx);

    const changeAt = new Date();
    const { invalidateAllUserSessions } = await import('./auth.repository');
    await invalidateAllUserSessions(tx, userId, 'PASSWORD_CHANGED', changeAt);

    await createAuditLog(tx, {
      action: 'USER_PASSWORD_CHANGED',
      actorUserId: userId,
      entityType: 'USER',
      entityId: userId,
      ipAddress: boundedIp,
      userAgent: boundedUa,
      requestId: clientInfo.requestId,
    });
  });
};
