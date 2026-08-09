import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../src/database/prisma';
import { Prisma } from '../../src/generated/prisma/client';
import { randomUUID } from 'node:crypto';

describe('Auth Session Database Integration', () => {
  const cleanupAuthFixtures = async (): Promise<void> => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeEach(cleanupAuthFixtures);
  afterEach(cleanupAuthFixtures);

  it('creates a user with mustChangePassword = false by default', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(user.mustChangePassword).toBe(false);
  });

  it('can create a user with mustChangePassword = true', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        mustChangePassword: true,
      },
    });

    expect(user.mustChangePassword).toBe(true);
  });

  it('can create a session with rotatedAt and replacedBySession relation', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const oldSession = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'old-hash',
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    const newSession = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'new-hash',
        familyId: oldSession.familyId,
        expiresAt: new Date(Date.now() + 200000),
      },
    });

    const rotatedSession = await prisma.session.update({
      where: { id: oldSession.id },
      data: {
        rotatedAt: new Date(),
        replacedBySessionId: newSession.id,
      },
    });

    expect(rotatedSession.rotatedAt).toBeInstanceOf(Date);
    expect(rotatedSession.replacedBySessionId).toBe(newSession.id);
  });

  it('enforces sessions_replacement_not_self_check constraint', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'self-hash',
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    let error: unknown;
    try {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          rotatedAt: new Date(),
          replacedBySessionId: session.id, // Trying to replace with self
        },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Error).message).toContain('sessions_replacement_not_self_check');

    const unchanged = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(unchanged.rotatedAt).toBeNull();
    expect(unchanged.replacedBySessionId).toBeNull();
  });

  it('enforces sessions_rotation_replacement_consistency_check (only rotatedAt)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'inconsistent-hash-1',
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    let error: unknown;
    try {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          rotatedAt: new Date(),
        },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Error).message).toContain('sessions_rotation_replacement_consistency_check');

    const unchanged = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(unchanged.rotatedAt).toBeNull();
    expect(unchanged.replacedBySessionId).toBeNull();
  });

  it('enforces sessions_rotation_replacement_consistency_check (only replacedBySessionId)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const oldSession = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'inconsistent-hash-2',
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    const newSession = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'inconsistent-hash-3',
        familyId: oldSession.familyId,
        expiresAt: new Date(Date.now() + 200000),
      },
    });

    let error: unknown;
    try {
      await prisma.session.update({
        where: { id: oldSession.id },
        data: {
          replacedBySessionId: newSession.id,
        },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Error).message).toContain('sessions_rotation_replacement_consistency_check');

    const unchanged = await prisma.session.findUniqueOrThrow({ where: { id: oldSession.id } });
    expect(unchanged.rotatedAt).toBeNull();
    expect(unchanged.replacedBySessionId).toBeNull();
  });
});
