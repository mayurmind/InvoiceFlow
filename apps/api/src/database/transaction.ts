import { Prisma, PrismaClient } from '../generated/prisma/client';
import { prisma } from './prisma';

export type ITXClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const runInTransaction = async <T>(
  fn: (tx: ITXClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> => {
  return prisma.$transaction(fn, options);
};
