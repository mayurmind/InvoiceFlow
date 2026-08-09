import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/database/**/*.test.ts'],
    setupFiles: ['./tests/database/setup.ts'],
    globalSetup: ['./tests/database/global-setup.ts'],
    fileParallelism: false,
  },
});
