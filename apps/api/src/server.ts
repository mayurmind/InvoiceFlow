import { app } from './app';
import { env } from './config/env';
import { logger } from './utilities/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import type { Server } from 'http';

let server: Server;
let isShuttingDown = false;

const bootstrap = async () => {
  try {
    await connectDatabase();
    logger.info('Database connection established.');
  } catch {
    logger.error('Database startup failed.');
    process.exit(1);
    return;
  }

  server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`Server started securely on http://${env.HOST}:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
};

// Handle graceful shutdown
const shutdown = async (signal: string, requestedExitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down gracefully...`);

  let exitCode = requestedExitCode;

  const forceCloseTimeout = setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      logger.info('Closed out remaining connections.');
    }

    await disconnectDatabase();
    logger.info('Database connection closed.');
  } catch {
    exitCode = 1;
    logger.error('Error during graceful shutdown.');
  } finally {
    clearTimeout(forceCloseTimeout);
    process.exit(exitCode);
  }
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM', 0);
});

process.on('SIGINT', () => {
  void shutdown('SIGINT', 0);
});

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection at promise');
  void shutdown('UNHANDLED_REJECTION', 1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception thrown');
  void shutdown('UNCAUGHT_EXCEPTION', 1);
});

bootstrap();
