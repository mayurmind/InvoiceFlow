import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireCsrfToken } from '../../../src/features/auth/csrf.middleware';
import * as csrfUtils from '../../../src/features/auth/csrf';
import { Request, Response } from 'express';
import { ForbiddenError } from '../../../src/errors/application.error';

vi.mock('../../../src/features/auth/csrf');

describe('requireCsrfToken', () => {
  const mockNext = vi.fn();
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  let mockReq: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      auth: {
        sessionId: 'session-1',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'VIEWER',
        } as import('../../../src/features/auth/auth.types').SanitizedUser,
      },
      headers: {
        'x-csrf-token': 'valid-csrf',
      },
      rawHeaders: ['Host', 'localhost', 'X-CSRF-Token', 'valid-csrf'],
    };
    vi.mocked(csrfUtils.verifyCsrfToken).mockReturnValue(true);
  });

  it('calls next if valid', () => {
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(csrfUtils.verifyCsrfToken).toHaveBeenCalledWith('session-1', 'valid-csrf');
  });

  it('rejects if auth/sessionId missing', () => {
    mockReq.auth = undefined;
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if x-csrf-token is missing', () => {
    mockReq.headers = {};
    mockReq.rawHeaders = ['Host', 'localhost'];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if x-csrf-token is not string', () => {
    mockReq.headers = { 'x-csrf-token': ['token1'] };
    // rawHeaders wouldn't matter here since the headers object is already an array,
    // but the middleware checks rawHeaders for duplicates first.
    mockReq.rawHeaders = ['X-CSRF-Token', 'token1', 'X-CSRF-Token', 'token2'];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if normalized header exists but raw occurrence count is zero', () => {
    mockReq.headers = { 'x-csrf-token': 'valid-csrf' };
    mockReq.rawHeaders = ['Host', 'localhost'];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if duplicate exact-case headers', () => {
    mockReq.rawHeaders = ['X-CSRF-Token', 'token1', 'X-CSRF-Token', 'token2'];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if duplicate mixed-case headers', () => {
    mockReq.rawHeaders = ['x-csrf-token', 'token1', 'X-Csrf-Token', 'token2'];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if empty token', () => {
    mockReq.headers = { 'x-csrf-token': '' };
    mockReq.rawHeaders = ['X-CSRF-Token', ''];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('rejects if >256 token', () => {
    const tooLong = 'a'.repeat(257);
    mockReq.headers = { 'x-csrf-token': tooLong };
    mockReq.rawHeaders = ['X-CSRF-Token', tooLong];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('accepts valid 256 boundary token', () => {
    const boundaryToken = 'a'.repeat(256);
    mockReq.headers = { 'x-csrf-token': boundaryToken };
    mockReq.rawHeaders = ['X-CSRF-Token', boundaryToken];
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(csrfUtils.verifyCsrfToken).toHaveBeenCalledWith('session-1', boundaryToken);
  });

  it('rejects if x-csrf-token is invalid', () => {
    vi.mocked(csrfUtils.verifyCsrfToken).mockReturnValue(false);
    requireCsrfToken(mockReq as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
