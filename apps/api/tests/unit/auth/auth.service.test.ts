import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login } from '../../../src/features/auth/auth.service';
import * as authRepo from '../../../src/features/auth/auth.repository';
import * as passwordUtils from '../../../src/features/auth/password';
import * as tokenUtils from '../../../src/features/auth/tokens';
import * as txUtils from '../../../src/database/transaction';
import { AuthenticationFailedError } from '../../../src/errors/application.error';
import type { User, Session } from '../../../src/generated/prisma/client';
import type { SanitizedUser } from '../../../src/features/auth/auth.types';

vi.mock('../../../src/features/auth/auth.repository');
vi.mock('../../../src/features/auth/password');
vi.mock('../../../src/features/auth/tokens');
vi.mock('../../../src/database/transaction');
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
});
