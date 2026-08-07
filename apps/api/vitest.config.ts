import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
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
        'eslint.config.js',
        '**/*.d.ts',
        'src/server.ts', // Exclude server.ts as it binds to a port and is meant for runtime execution
      ],
    },
  },
});
