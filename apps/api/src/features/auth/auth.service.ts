import crypto from 'node:crypto';
import { env } from '../../config/env';
import { runInTransaction } from '../../database/transaction';
import { AuthenticationFailedError } from '../../errors/application.error';
import { parseDurationToMs } from '../../utilities/duration';
import { verifyPassword } from './password';
import { generateAccessToken, generateRefreshCredential } from './tokens';
import { logger } from '../../utilities/logger';
import {
  getUserByEmail,
  getUserForUpdate,
  createSession,
  updateUserLastLogin,
  createAuditLog,
  mapUserToSanitized,
} from './auth.repository';

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
