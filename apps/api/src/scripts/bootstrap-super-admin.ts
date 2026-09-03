/* eslint-disable no-console */
import { prisma, connectDatabase, disconnectDatabase } from '../database/prisma';
import { hashPassword } from '../features/auth/password';
import { pathToFileURL } from 'node:url';

export const bootstrapSuperAdmin = async (): Promise<void> => {
  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD environment variables');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDatabase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error(`User with email ${email} already exists.`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: true,
      },
    });

    console.log(`Successfully provisioned SUPER_ADMIN account for ${email}`);
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Bootstrap failed: Could not provision SUPER_ADMIN account due to an internal error: ${message}`,
    );
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapSuperAdmin();
}
