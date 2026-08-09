import { Prisma } from '../../../src/generated/prisma/client';
import { prisma } from '../../../src/database/prisma';

export const ROLLBACK = Symbol('ROLLBACK');

export async function withRollback<T>(
  testBody: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let result!: T;

  try {
    await prisma.$transaction(async (tx) => {
      result = await testBody(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) {
      throw error; // Re-throw real assertion or database errors
    }
  }

  return result;
}
