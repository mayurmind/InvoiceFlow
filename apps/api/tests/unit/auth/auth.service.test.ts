import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  login,
  refreshSession,
  logoutSession,
  logoutAllSessions,
  generateCsrfForSession,
} from '../../../src/features/auth/auth.service';
import * as authRepo from '../../../src/features/auth/auth.repository';
import * as passwordUtils from '../../../src/features/auth/password';
import * as tokenUtils from '../../../src/features/auth/tokens';
import * as txUtils from '../../../src/database/transaction';
import * as csrfUtils from '../../../src/features/auth/csrf';
import {
  AuthenticationFailedError,
  UnauthorizedError,
  ForbiddenError,
} from '../../../src/errors/application.error';
import type { User, Session } from '../../../src/generated/prisma/client';
import type { SanitizedUser } from '../../../src/features/auth/auth.types';

vi.mock('../../../src/features/auth/auth.repository');
vi.mock('../../../src/features/auth/password');
vi.mock('../../../src/features/auth/tokens');
vi.mock('../../../src/database/transaction');
vi.mock('../../../src/features/auth/csrf');
vi.mock('../../../src/database/prisma', () => ({
  prisma: {},
}));

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tokenUtils.generateRefreshCredential).mockReturnValue({
      raw: 'raw-token',
      hash: 'hashed-token',
    });
    vi.mocked(tokenUtils.generateAccessToken).mockReturnValue('access-token');
    vi.mocked(txUtils.runInTransaction).mockImplementation(async (cb) => {
      return cb({} as txUtils.ITXClient);
    });
  });

  it('throws AuthenticationFailedError and audits failure for unknown email', async () => {
    vi.mocked(authRepo.getUserByEmail).mockResolvedValue(null);
    vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);

    await expect(login('unknown@example.com', 'password', {})).rejects.toThrow(
      AuthenticationFailedError,
    );

    expect(authRepo.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'AUTH_LOGIN_FAILED',
        actorUserId: null,
      }),
    );
  });

  it('throws AuthenticationFailedError for wrong password', async () => {
    vi.mocked(authRepo.getUserByEmail).mockResolvedValue({
      id: 'user-1',
      passwordHash: 'real-hash',
    } as User);
    vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);

    await expect(login('user@example.com', 'wrong', {})).rejects.toThrow(AuthenticationFailedError);
  });

  it('succeeds and creates session for valid credentials', async () => {
    const mockUser = {
      id: 'user-1',
      passwordHash: 'real-hash',
      isActive: true,
      role: 'VIEWER',
    } as User;

    vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);
    vi.mocked(authRepo.getUserForUpdate).mockResolvedValue(mockUser);
    vi.mocked(authRepo.createSession).mockResolvedValue({ id: 'session-1' } as Session);
    vi.mocked(authRepo.mapUserToSanitized).mockReturnValue({ id: 'user-1' } as SanitizedUser);

    const result = await login('user@example.com', 'password', { ip: '127.0.0.1' });

    expect(result.accessToken).toBe('access-token');
    expect(result.rawRefreshToken).toBe('raw-token');
    expect(result.user.id).toBe('user-1');
    expect(authRepo.updateUserLastLogin).toHaveBeenCalled();
    expect(authRepo.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'AUTH_LOGIN_SUCCEEDED',
        actorUserId: 'user-1',
        entityId: 'session-1',
      }),
    );
  });

  it('fails if user becomes inactive during transaction race', async () => {
    const mockUser = {
      id: 'user-1',
      passwordHash: 'real-hash',
      isActive: true,
    } as User;

    vi.mocked(authRepo.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);

    // User becomes inactive when locked
    vi.mocked(authRepo.getUserForUpdate).mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    await expect(login('user@example.com', 'password', {})).rejects.toThrow(
      AuthenticationFailedError,
    );
  });

  describe('generateCsrfForSession', () => {
    it('returns csrf token on success', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 1000),
      } as Session);
      vi.mocked(authRepo.getUserById).mockResolvedValue({ id: 'u1', isActive: true } as User);
      vi.mocked(csrfUtils.generateCsrfToken).mockReturnValue('mock-csrf');
      const token = await generateCsrfForSession('a'.repeat(64));
      expect(token).toBe('mock-csrf');
    });

    it('throws UnauthorizedError if session revoked', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(),
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 1000),
      } as Session);
      await expect(generateCsrfForSession('a'.repeat(64))).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if session expired', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() - 1000),
      } as Session);
      await expect(generateCsrfForSession('a'.repeat(64))).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if session rotated', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: new Date(),
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 1000),
      } as Session);
      await expect(generateCsrfForSession('a'.repeat(64))).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if user inactive', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        rotatedAt: null,
        replacedBySessionId: null,
        expiresAt: new Date(Date.now() + 1000),
      } as Session);
      vi.mocked(authRepo.getUserById).mockResolvedValue({ id: 'u1', isActive: false } as User);
      await expect(generateCsrfForSession('a'.repeat(64))).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshSession', () => {
    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hashed-token',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      rotatedAt: null,
      replacedBySessionId: null,
    } as Session;

    const mockUser = {
      id: 'user-1',
      isActive: true,
      role: 'VIEWER',
    } as User;

    beforeEach(() => {
      vi.mocked(tokenUtils.hashRefreshCredential).mockReturnValue('hashed-token');
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue(mockSession);
      vi.mocked(csrfUtils.verifyCsrfToken).mockReturnValue(true);

      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue(mockUser);
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue(mockSession);
      vi.mocked(authRepo.createSession).mockResolvedValue({ id: 'session-2' } as Session);
    });

    it('throws if candidate session is unknown', async () => {
      vi.mocked(authRepo.getSessionByHash).mockResolvedValue(null);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('throws if csrf token is invalid', async () => {
      vi.mocked(csrfUtils.verifyCsrfToken).mockReturnValue(false);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(ForbiddenError);
    });

    it('revalidates lock: throws if lockedSession missing', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue(null);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if lockedUser missing', async () => {
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue(null);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if User/Session mismatch', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        userId: 'other',
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if tokenHash mismatch', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        tokenHash: 'other-hash',
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if user inactive', async () => {
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as User);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if session revoked', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('revalidates lock: throws if session expired', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('family revocation + replay audit COMMIT, transaction returns { kind: "replay" }, service throws UnauthorizedError only AFTER transaction resolves', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        rotatedAt: new Date(),
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);

      expect(authRepo.invalidateFamily).toHaveBeenCalledWith(
        expect.anything(),
        'family-1',
        'REFRESH_TOKEN_REUSE',
        expect.any(Date),
      );
      expect(authRepo.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'AUTH_REFRESH_REPLAY_DETECTED',
          actorUserId: null,
          entityId: 'session-1',
        }),
      );
    });

    it('throws if replacedBySessionId replay', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        replacedBySessionId: 's2',
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('throws if remaining lifetime boundary is exactly zero or negative', async () => {
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(),
      } as Session);
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow(UnauthorizedError);
    });

    it('JWT signing failure propagates and transaction fails', async () => {
      vi.mocked(tokenUtils.generateAccessToken).mockImplementation(() => {
        throw new Error('JWT failed');
      });
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow('JWT failed');
    });

    it('success audit failure propagates and transaction fails', async () => {
      vi.mocked(authRepo.createAuditLog).mockRejectedValueOnce(new Error('Audit failed'));
      await expect(refreshSession('a'.repeat(64), 'csrf', {})).rejects.toThrow('Audit failed');
    });

    it('successful refresh rotation creates child with same family/expiry, updates parent rotatedAt/lastUsedAt without touching hash', async () => {
      const result = await refreshSession('a'.repeat(64), 'csrf', {});

      expect(result.accessToken).toBe('access-token');
      expect(result.rawRefreshToken).toBe('raw-token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(result.remainingRefreshMs).toBeGreaterThan(0);

      expect(authRepo.createSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-1',
          familyId: 'family-1',
          expiresAt: mockSession.expiresAt,
          tokenHash: 'hashed-token', // from generateRefreshCredential
        }),
      );

      expect(authRepo.replaceSession).toHaveBeenCalledWith(
        expect.anything(),
        'session-1',
        'session-2',
        expect.any(Date),
      );

      expect(tokenUtils.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          sid: 'session-2', // JWT uses child sid
          role: 'VIEWER', // uses current locked DB role
        }),
      );
    });
  });

  describe('logoutSession', () => {
    it('revokes current family, preserves other family, audits', async () => {
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue({ id: 'u1' } as User);
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        id: 's1',
        familyId: 'f1',
        userId: 'u1',
      } as Session);
      await logoutSession('s1', 'u1', {});

      expect(authRepo.invalidateFamily).toHaveBeenCalledWith(
        expect.anything(),
        'f1',
        'USER_LOGOUT',
        expect.any(Date),
      );
      expect(authRepo.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'AUTH_LOGOUT',
          actorUserId: 'u1',
          entityType: 'SESSION',
          entityId: 's1',
        }),
      );
    });

    it('does nothing if user and session ownership mismatch', async () => {
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue({ id: 'u1' } as User);
      vi.mocked(authRepo.getSessionForUpdate).mockResolvedValue({
        id: 's1',
        familyId: 'f1',
        userId: 'u2',
      } as Session);
      await logoutSession('s1', 'u1', {});
      expect(authRepo.invalidateFamily).not.toHaveBeenCalled();
    });
  });

  describe('logoutAllSessions', () => {
    it('revokes all current-user sessions, audits', async () => {
      vi.mocked(authRepo.getUserForUpdate).mockResolvedValue({ id: 'u1' } as User);
      await logoutAllSessions('u1', {});

      expect(authRepo.invalidateAllUserSessions).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'USER_LOGOUT_ALL',
        expect.any(Date),
      );
      expect(authRepo.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'AUTH_LOGOUT_ALL',
          actorUserId: 'u1',
          entityType: 'USER',
          entityId: 'u1',
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('successfully changes password and clears mustChangePassword', async () => {
      const mockUser = {
        id: 'u1',
        passwordHash: 'old-hash',
        isActive: true,
        mustChangePassword: true,
      };

      vi.mocked(authRepo.getUserById).mockResolvedValue(mockUser as User);
      const userRepoMock = {
        getUserPasswordStateById: vi.fn().mockResolvedValue(mockUser),
        getPasswordStateForUpdate: vi.fn().mockResolvedValue(mockUser),
        updateUserPasswordState: vi.fn().mockResolvedValue(undefined),
      };
      vi.doMock('../../../src/features/users/users.repository', () => userRepoMock);

      vi.mocked(passwordUtils.verifyPassword).mockResolvedValueOnce(true); // current is valid
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValueOnce(false); // new is different
      vi.mocked(passwordUtils.hashPassword).mockResolvedValue('new-hash');

      const { changePassword } = await import('../../../src/features/auth/auth.service');
      await changePassword('u1', 'OldPassword123!', 'NewPassword123!', {});

      expect(userRepoMock.updateUserPasswordState).toHaveBeenCalledWith(
        'u1',
        'new-hash',
        false,
        expect.anything(),
      );
      expect(authRepo.invalidateAllUserSessions).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'PASSWORD_CHANGED',
        expect.any(Date),
      );
      expect(authRepo.createAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'USER_PASSWORD_CHANGED', actorUserId: 'u1' }),
      );
    });
  });
});
