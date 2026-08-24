import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

  const validProductionEnv: NodeJS.ProcessEnv = {
    ...baseValidEnv,
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 're_test_config_only_not_real',
    EMAIL_FROM_ADDRESS: 'invoices@example.test',
    EMAIL_FROM_NAME: 'InvoiceFlow Test',
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('accepts valid configuration and parses defaults', async () => {
    const { parseEnv } = await import('../../src/config/env');
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

  it('fails securely on missing TEST_DATABASE_URL when NODE_ENV=test', async () => {
    const missingTestDatabaseEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
    };
    delete missingTestDatabaseEnv.TEST_DATABASE_URL;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(missingTestDatabaseEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TEST_DATABASE_URL is required when NODE_ENV=test'),
    );
  });

  it('selects TEST_DATABASE_URL in test mode even with remote DATABASE_URL', async () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      DATABASE_URL: 'postgresql://runtime:runtime@db.example.supabase.co:5432/postgres',
    };

    const { parseEnv } = await import('../../src/config/env');
    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(baseValidEnv.TEST_DATABASE_URL);
  });

  it('fails securely on unsafe remote TEST_DATABASE_URL in test mode', async () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      TEST_DATABASE_URL: 'postgresql://test:test@db.example.supabase.co:5432/postgres',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(testEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('development mode does not require TEST_DATABASE_URL', async () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      NODE_ENV: 'development',
    };
    delete testEnv.TEST_DATABASE_URL;

    const { parseEnv } = await import('../../src/config/env');
    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(testEnv.DATABASE_URL);
  });

  it('production mode does not require TEST_DATABASE_URL', async () => {
    const testEnv: NodeJS.ProcessEnv = {
      ...validProductionEnv,
    };
    delete testEnv.TEST_DATABASE_URL;

    const { parseEnv } = await import('../../src/config/env');
    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe(testEnv.DATABASE_URL);
  });

  it('fails securely on missing required auth secrets', async () => {
    const missingAccessSecretEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
    };
    delete missingAccessSecretEnv.ACCESS_TOKEN_SECRET;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(missingAccessSecretEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails securely on invalid REFRESH_TOKEN_TTL format', async () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      REFRESH_TOKEN_TTL: 'invalid-format',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails securely on weak auth secrets', async () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_SECRET: 'too-short',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails securely on invalid TTL formats', async () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_TTL: 'invalid',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails securely if REFRESH_TOKEN_TTL <= ACCESS_TOKEN_TTL', async () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      ACCESS_TOKEN_TTL: '7d',
      REFRESH_TOKEN_TTL: '1d',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { parseEnv } = await import('../../src/config/env');
    expect(() => parseEnv(invalidEnv)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  describe('Email Provider Requirements', () => {
    let exitSpy: ReturnType<typeof vi.spyOn<NodeJS.Process, 'exit'>>;
    let errorSpy: ReturnType<typeof vi.spyOn<NodeJS.WriteStream, 'write'>>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('valid test environment succeeds with mock provider behavior', async () => {
      const testEnv: NodeJS.ProcessEnv = { ...baseValidEnv, NODE_ENV: 'test' };
      const { parseEnv } = await import('../../src/config/env');
      const env = parseEnv(testEnv);
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('valid development environment succeeds with mock provider behavior', async () => {
      const devEnv: NodeJS.ProcessEnv = { ...baseValidEnv, NODE_ENV: 'development' };
      const { parseEnv } = await import('../../src/config/env');
      const env = parseEnv(devEnv);
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('valid production environment succeeds only with EMAIL_PROVIDER=resend and required keys', async () => {
      const { parseEnv } = await import('../../src/config/env');
      const env = parseEnv(validProductionEnv);
      expect(env.EMAIL_PROVIDER).toBe('resend');
      expect(env.EMAIL_API_KEY).toBe('re_test_config_only_not_real');
      expect(env.EMAIL_FROM_ADDRESS).toBe('invoices@example.test');
      expect(env.EMAIL_FROM_NAME).toBe('InvoiceFlow Test');
    });

    it('production without EMAIL_API_KEY fails closed', async () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_API_KEY;
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production without EMAIL_FROM_ADDRESS fails closed', async () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_FROM_ADDRESS;
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production without EMAIL_FROM_NAME fails closed', async () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_FROM_NAME;
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production with EMAIL_PROVIDER=mock fails closed', async () => {
      const env = { ...validProductionEnv, EMAIL_PROVIDER: 'mock' };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('test environment cannot activate real Resend', async () => {
      const env = { ...baseValidEnv, NODE_ENV: 'test', EMAIL_PROVIDER: 'resend' };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('development environment cannot activate real Resend', async () => {
      const env = { ...baseValidEnv, NODE_ENV: 'development', EMAIL_PROVIDER: 'resend' };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('invalid EMAIL_FROM_ADDRESS fails validation', async () => {
      const env = { ...validProductionEnv, EMAIL_FROM_ADDRESS: 'invalid-email' };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('EMAIL_FROM_NAME containing CR/LF fails validation', async () => {
      const env = { ...validProductionEnv, EMAIL_FROM_NAME: 'Bad\nName' };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('EMAIL_FROM_NAME over frozen max length fails validation', async () => {
      const env = { ...validProductionEnv, EMAIL_FROM_NAME: 'a'.repeat(101) };
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });
  });

  describe('DATABASE_URL protocol and non-Error validation', () => {
    it('accepts postgres:// protocol', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db');
      vi.stubEnv('EMAIL_PROVIDER', 'mock');
      vi.stubEnv('NODE_ENV', 'test');
      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(process.env)).not.toThrow();
    });

    it('handles non-Error thrown in parseEnv database resolution', async () => {
      const { parseEnv } = await import('../../src/config/env');

      const dbUrlModule = await import('../../src/config/database-url');

      vi.spyOn(dbUrlModule, 'resolveRuntimeDatabaseUrl').mockImplementation(() => {
        throw 'Some string error';
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`TEST_PROCESS_EXIT_${String(code)}`);
      });

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const validProductionEnv: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',

        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',

        ACCESS_TOKEN_SECRET: 'a'.repeat(32),
        REFRESH_TOKEN_SECRET: 'b'.repeat(32),
        CSRF_SECRET: 'c'.repeat(32),

        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL: '7d',

        EMAIL_PROVIDER: 'resend',
        EMAIL_API_KEY: 'test-resend-api-key',
        EMAIL_FROM_ADDRESS: 'test@example.com',
        EMAIL_FROM_NAME: 'Test Sender',
      };

      expect(() => parseEnv(validProductionEnv)).toThrow('TEST_PROCESS_EXIT_1');

      expect(exitSpy).toHaveBeenCalledWith(1);

      const stderrOutput = stderrSpy.mock.calls.flat().map(String).join('');

      expect(stderrOutput).toContain('Invalid database configuration');
      expect(stderrOutput).toContain('Unknown error');
      expect(stderrOutput).not.toContain('Some string error');

      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    });
  });
});
