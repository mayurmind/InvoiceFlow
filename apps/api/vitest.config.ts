import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'vitest.config.ts',
        'vitest.database.config.ts',
        'eslint.config.js',
        '**/*.d.ts',
        'src/server.ts', // Exclude server.ts as it binds to a port and is meant for runtime execution
        'prisma.config.ts',
        'prisma.test.config.ts',
        'src/generated/prisma/**',
      ],
    },
    exclude: [...configDefaults.exclude, 'tests/database/**'],
  },
});
