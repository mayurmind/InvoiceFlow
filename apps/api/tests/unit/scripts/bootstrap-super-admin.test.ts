import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { bootstrapSuperAdmin } from '../../../src/scripts/bootstrap-super-admin';
import { prisma, connectDatabase, disconnectDatabase } from '../../../src/database/prisma';
import { hashPassword } from '../../../src/features/auth/password';
import type { User } from '../../../src/generated/prisma/client';

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../../src/features/auth/password', () => ({
  hashPassword: vi.fn(),
}));

describe('bootstrapSuperAdmin', () => {
  let consoleErrorSpy: MockInstance;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;

    vi.stubEnv('SUPER_ADMIN_EMAIL', 'Admin@Example.com  ');
    vi.stubEnv('SUPER_ADMIN_PASSWORD', 'super-secret-password');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('refuses provisioning if email or password is missing', async () => {
    vi.stubEnv('SUPER_ADMIN_EMAIL', '');

    await bootstrapSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD environment variables',
    );
    expect(process.exitCode).toBe(1);
    expect(connectDatabase).not.toHaveBeenCalled();
  });

  it('normalizes email before checking', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');

    await bootstrapSuperAdmin();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
  });

  it('refuses overwrite if user already exists', async () => {
    const existingUser: User = {
      id: '12345678-1234-1234-1234-123456789012',
      email: 'admin@example.com',
      passwordHash: 'hash',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser);

    await bootstrapSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'User with email admin@example.com already exists.',
    );
    expect(process.exitCode).toBe(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(disconnectDatabase).toHaveBeenCalled();
  });

  it('creates user with exact required fields and hashed password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');

    await bootstrapSuperAdmin();

    expect(hashPassword).toHaveBeenCalledWith('super-secret-password');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: true,
      },
    });

    // Check plaintext password is not in output
    const allConsoleCalls = [...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]
      .flat()
      .join(' ');
    expect(allConsoleCalls).not.toContain('super-secret-password');

    expect(process.exitCode).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Successfully provisioned SUPER_ADMIN account for admin@example.com',
    );
    expect(disconnectDatabase).toHaveBeenCalled();
  });

  it('handles password hashing failure safely', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(hashPassword).mockRejectedValue(new Error('Hashing failed'));

    await bootstrapSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Bootstrap failed: Could not provision SUPER_ADMIN account due to an internal error.',
    );
    expect(process.exitCode).toBe(1);
    expect(disconnectDatabase).toHaveBeenCalled();
  });

  it('handles database creation failure safely', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');
    vi.mocked(prisma.user.create).mockRejectedValue(new Error('DB Error'));

    await bootstrapSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Bootstrap failed: Could not provision SUPER_ADMIN account due to an internal error.',
    );
    expect(process.exitCode).toBe(1);
    expect(disconnectDatabase).toHaveBeenCalled();
  });
});
