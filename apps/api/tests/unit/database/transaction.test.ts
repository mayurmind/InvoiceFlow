import { describe, it, expect, vi } from 'vitest';
import { runInTransaction } from '../../../src/database/transaction';
import { prisma } from '../../../src/database/prisma';
import { Prisma } from '../../../src/generated/prisma/client';

vi.mock('../../../src/database/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe('Transaction Helper', () => {
  it('delegates to the existing centralized prisma.$transaction and passes callback unchanged', async () => {
    const mockCallback = vi.fn(async () => 'result');

    vi.mocked(prisma.$transaction).mockResolvedValue('result');

    const result = await runInTransaction(mockCallback);

    expect(prisma.$transaction).toHaveBeenCalledWith(mockCallback, undefined);
    expect(result).toBe('result');
  });

  it('forwards maxWait, timeout, and isolationLevel', async () => {
    const mockCallback = vi.fn(async () => 'result');
    const options = {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    };

    vi.mocked(prisma.$transaction).mockResolvedValue('result');

    await runInTransaction(mockCallback, options);

    expect(prisma.$transaction).toHaveBeenCalledWith(mockCallback, options);
  });

  it('propagates transaction rejection', async () => {
    const mockCallback = vi.fn(async () => 'result');
    const mockError = new Error('transaction failed');

    vi.mocked(prisma.$transaction).mockRejectedValue(mockError);

    await expect(runInTransaction(mockCallback)).rejects.toThrow('transaction failed');
  });
});
