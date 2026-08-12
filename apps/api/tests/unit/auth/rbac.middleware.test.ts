import { describe, it, expect, vi } from 'vitest';
import { requireRoles } from '../../../src/features/auth/rbac.middleware';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../src/generated/prisma/client';
import { UnauthorizedError, ForbiddenError } from '../../../src/errors/application.error';

describe('RBAC Middleware', () => {
  const createMockReq = (role?: UserRole, overrides = {}): Request => {
    return {
      auth: role ? { user: { role } } : undefined,
      ...overrides,
    } as unknown as Request;
  };

  const createMockRes = (): Response => ({}) as Response;

  it('allows access when role matches', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = createMockReq(UserRole.SUPER_ADMIN);
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(); // success, no error
  });

  it('denies STAFF when not permitted', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = createMockReq(UserRole.STAFF);
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('denies VIEWER when not permitted', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = createMockReq(UserRole.VIEWER);
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('supports explicitly permitting multiple roles', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN, UserRole.STAFF);
    const next = vi.fn() as NextFunction;

    middleware(createMockReq(UserRole.STAFF), createMockRes(), next);
    expect(next).toHaveBeenCalledWith();

    middleware(createMockReq(UserRole.SUPER_ADMIN), createMockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns UnauthorizedError when req.auth is missing', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = {} as Request;
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('returns UnauthorizedError when req.auth.user is missing', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = { auth: {} } as Request;
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('throws synchronously during construction if empty role list provided', () => {
    expect(() => {
      requireRoles();
    }).toThrow('requireRoles requires at least one allowed role');
  });

  it('ignores headers, query, and body for role override', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = createMockReq(UserRole.VIEWER, {
      headers: { role: 'SUPER_ADMIN' },
      query: { role: 'SUPER_ADMIN' },
      body: { role: 'SUPER_ADMIN' },
    });
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('ForbiddenError is generic', () => {
    const middleware = requireRoles(UserRole.SUPER_ADMIN);
    const req = createMockReq(UserRole.STAFF);
    const next = vi.fn() as NextFunction;

    middleware(req, createMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden' }));
  });
});
