import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use project-based configuration to support multiple environments
    // without relying on the deprecated environmentMatchGlobs.
    projects: [
      {
        // Utility tests — pure TypeScript, no DOM needed
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/tests/utils.test.ts'],
        },
      },
      {
        // Component smoke tests — require jsdom for React rendering
        extends: true,
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/tests/components.test.tsx'],
          setupFiles: ['./src/tests/setup.ts'],
        },
      },
      {
        // Shell component smoke tests — F1.4 application shell
        extends: true,
        test: {
          name: 'shell',
          environment: 'jsdom',
          include: ['src/tests/shell.test.tsx'],
          setupFiles: ['./src/tests/setup.ts'],
        },
      },
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
      exclude: ['node_modules/**', '.next/**', 'src/tests/**', 'src/app/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
