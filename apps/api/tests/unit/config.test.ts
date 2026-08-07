import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test the safeParse logic inside env.ts. Since env.ts parses and exits on import if invalid,
// we must isolate module imports and manipulate process.env before importing.

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('accepts valid configuration and parses defaults', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '8080';
    process.env.HOST = '127.0.0.1';
    process.env.LOG_LEVEL = 'silent';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000, http://test.com';

    const { env } = await import('../../src/config/env');

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.LOG_LEVEL).toBe('silent');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'http://test.com']);
  });

  it('fails securely on invalid PORT', async () => {
    process.env.PORT = 'invalid';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('../../src/config/env')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails securely on missing required CORS_ALLOWED_ORIGINS', async () => {
    process.env.PORT = '5000';
    delete process.env.CORS_ALLOWED_ORIGINS;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('../../src/config/env')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
