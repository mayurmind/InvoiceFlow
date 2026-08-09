import { describe, it, expect, vi } from 'vitest';
import { originGuard } from '../../../src/features/auth/origin.middleware';
import { Request, Response } from 'express';

vi.mock('../../../src/config/env', () => ({
  env: {
    CORS_ALLOWED_ORIGINS: ['http://localhost:3000', 'https://app.invoiceflow.com'],
  },
}));

describe('originGuard', () => {
  const mockNext = vi.fn();
  const mockRes = {} as Response;

  it('allows valid origin', () => {
    const req = {
      headers: {
        origin: 'http://localhost:3000',
      },
    } as unknown as Request;

    originGuard(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
    mockNext.mockClear();
  });

  it('allows valid referer if origin is missing', () => {
    const req = {
      headers: {
        referer: 'https://app.invoiceflow.com/login',
      },
    } as unknown as Request;

    originGuard(req, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
    mockNext.mockClear();
  });

  it('rejects missing origin and referer', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    originGuard(req, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Missing or malformed Origin/Referer');
    mockNext.mockClear();
  });

  it('rejects disallowed origin', () => {
    const req = {
      headers: {
        origin: 'http://evil.com',
      },
    } as unknown as Request;

    originGuard(req, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Disallowed Origin/Referer');
    mockNext.mockClear();
  });

  it('rejects malformed referer', () => {
    const req = {
      headers: {
        referer: 'not-a-url',
      },
    } as unknown as Request;

    originGuard(req, mockRes, mockNext);
    expect(mockNext.mock.calls[0][0].message).toBe('Missing or malformed Origin/Referer');
    mockNext.mockClear();
  });
});
