import { describe, it, expect, vi } from 'vitest';
import { parseEnv } from '../../src/config/env';

describe('Environment Validation', () => {
  const baseValidEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/invoiceflow_test',
    PORT: '8080',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000, http://test.com',
    ACCESS_TOKEN_SECRET: 'test-access-token-secret-000000000000000000000000',
    REFRESH_TOKEN_SECRET: 'test-refresh-token-secret-0000000000000000000000',
    CSRF_SECRET: 'test-csrf-secret-00000000000000000000000000',
  };

  it('accepts valid configuration and parses defaults', () => {
    const env = parseEnv(baseValidEnv);

    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/invoiceflow_test');
    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.LOG_LEVEL).toBe('silent');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'http://test.com']);
    expect(env.ACCESS_TOKEN_SECRET).toBe(baseValidEnv.ACCESS_TOKEN_SECRET);
    expect(env.JWT_ISSUER).toBe('invoiceflow-api'); // default
  });

  it('fails securely on missing TEST_DATABASE_URL when NODE_ENV=test', () => {
    const missingTestDatabaseEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
    };
    delete missingTestDatabaseEnv.TEST_DATABASE_URL;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(missingTestDatabaseEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Invalid database configuration:',
      'TEST_DATABASE_URL is required when NODE_ENV=test.',
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('selects TEST_DATABASE_URL in test mode even with remote DATABASE_URL', () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      DATABASE_URL: 'postgresql://runtime:runtime@db.example.supabase.co:5432/postgres',
    };

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(baseValidEnv.TEST_DATABASE_URL);
  });

  it('fails securely on unsafe remote TEST_DATABASE_URL in test mode', () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      TEST_DATABASE_URL: 'postgresql://test:test@db.example.supabase.co:5432/postgres',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('development mode does not require TEST_DATABASE_URL', () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      NODE_ENV: 'development',
    };
    delete testEnv.TEST_DATABASE_URL;

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(testEnv.DATABASE_URL);
  });

  it('production mode does not require TEST_DATABASE_URL', () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
    };
    delete testEnv.TEST_DATABASE_URL;

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(testEnv.DATABASE_URL);
  });

  it('fails securely on missing required auth secrets', () => {
    const missingAccessSecretEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
    };
    delete missingAccessSecretEnv.ACCESS_TOKEN_SECRET;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(missingAccessSecretEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely on weak auth secrets', () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_SECRET: 'too-short',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely on invalid TTL formats', () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_TTL: 'invalid',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely if REFRESH_TOKEN_TTL <= ACCESS_TOKEN_TTL', () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_TTL: '7d',
      REFRESH_TOKEN_TTL: '1d',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
