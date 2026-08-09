import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateRequest } from '../../../src/features/auth/auth.middleware';
import * as authRepo from '../../../src/features/auth/auth.repository';
import * as tokenUtils from '../../../src/features/auth/tokens';
import * as cookiesUtils from '../../../src/features/auth/cookies';
import { Request, Response } from 'express';
import type { Session, User } from '../../../src/generated/prisma/client';
import type { SanitizedUser } from '../../../src/features/auth/auth.types';

vi.mock('../../../src/features/auth/auth.repository');
vi.mock('../../../src/features/auth/tokens');
vi.mock('../../../src/features/auth/cookies');

describe('authenticateRequest', () => {
  const mockNext = vi.fn();
  const mockRes = {} as Response;
  let mockReq: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      cookies: {
        'invoiceflow-access': 'valid-token',
      },
    };
    vi.mocked(cookiesUtils.getCookieName).mockReturnValue('invoiceflow-access');
    vi.mocked(tokenUtils.verifyAccessToken).mockReturnValue({
      sub: 'user-1',
      sid: 'session-1',
      role: 'VIEWER',
      type: 'access',
    });
    vi.mocked(authRepo.getSessionById).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    } as Session);
    vi.mocked(authRepo.getUserById).mockResolvedValue({
      id: 'user-1',
      isActive: true,
      role: 'VIEWER',
    } as User);
    vi.mocked(authRepo.mapUserToSanitized).mockReturnValue({ id: 'user-1' } as SanitizedUser);
  });

  it('populates req.auth on valid token and session', async () => {
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect((mockReq as Request).auth).toBeDefined();
    expect((mockReq as Request).auth!.sessionId).toBe('session-1');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('rejects if cookie is missing', async () => {
    mockReq.cookies = {};
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if token verification fails', async () => {
    vi.mocked(tokenUtils.verifyAccessToken).mockImplementation(() => {
      throw new Error('Verification failed');
    });
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if session is revoked', async () => {
    vi.mocked(authRepo.getSessionById).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    } as Session);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if session is expired', async () => {
    vi.mocked(authRepo.getSessionById).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
    } as Session);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if user is inactive', async () => {
    vi.mocked(authRepo.getUserById).mockResolvedValue({
      id: 'user-1',
      isActive: false,
      role: 'VIEWER',
    } as User);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if session is missing', async () => {
    vi.mocked(authRepo.getSessionById).mockResolvedValue(null);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if user/session mismatch', async () => {
    vi.mocked(authRepo.getSessionById).mockResolvedValue({
      id: 'session-1',
      userId: 'different-user',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    } as Session);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if user is missing', async () => {
    vi.mocked(authRepo.getUserById).mockResolvedValue(null);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('rejects if role mismatch', async () => {
    vi.mocked(authRepo.getUserById).mockResolvedValue({
      id: 'user-1',
      isActive: true,
      role: 'STAFF', // Different from payload.role ('VIEWER')
    } as User);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('propagates non-UnauthorizedError (e.g. database error)', async () => {
    const dbError = new Error('Database connection failed');
    vi.mocked(authRepo.getSessionById).mockRejectedValue(dbError);
    await authenticateRequest(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
