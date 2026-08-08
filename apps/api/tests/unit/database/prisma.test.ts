import { describe, it, expect, vi } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';
import { env } from '../../../src/config/env';
import { prisma, connectDatabase, disconnectDatabase } from '../../../src/database/prisma';

// Mock dependencies
vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock('../../../src/generated/prisma/client', () => {
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockDisconnect = vi.fn().mockResolvedValue(undefined);
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      $connect: mockConnect,
      $disconnect: mockDisconnect,
    })),
  };
});

describe('Database Module', () => {
  it('TEST-01: PrismaPg is constructed using env.DATABASE_URL', () => {
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: env.DATABASE_URL,
    });
  });

  it('TEST-02: PrismaClient is constructed with that adapter', () => {
    const adapterMockInstance = vi.mocked(PrismaPg).mock.results[0]?.value;
    expect(PrismaClient).toHaveBeenCalledWith({
      adapter: adapterMockInstance,
    });
  });

  it('TEST-03: only the exported centralized client is used', () => {
    // Only one PrismaClient instance should have been constructed globally in the module
    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(prisma).toBeDefined();
  });

  it('TEST-04: connectDatabase() calls prisma.$connect()', async () => {
    await connectDatabase();
    expect(prisma.$connect).toHaveBeenCalledTimes(1);
  });

  it('TEST-05: disconnectDatabase() calls prisma.$disconnect()', async () => {
    await disconnectDatabase();
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
  });
});
