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

  const validProductionEnv: NodeJS.ProcessEnv = {
    ...baseValidEnv,
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'resend',
    EMAIL_API_KEY: 're_test_config_only_not_real',
    EMAIL_FROM_ADDRESS: 'invoices@example.test',
    EMAIL_FROM_NAME: 'InvoiceFlow Test',
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
      ...validProductionEnv,
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

  it('fails securely on invalid REFRESH_TOKEN_TTL format', () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      REFRESH_TOKEN_TTL: 'invalid-format',
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

  describe('Email Provider Requirements', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('valid test environment succeeds with mock provider behavior', () => {
      const testEnv: NodeJS.ProcessEnv = { ...baseValidEnv, NODE_ENV: 'test' };
      const env = parseEnv(testEnv);
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('valid development environment succeeds with mock provider behavior', () => {
      const devEnv: NodeJS.ProcessEnv = { ...baseValidEnv, NODE_ENV: 'development' };
      const env = parseEnv(devEnv);
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('valid production environment succeeds only with EMAIL_PROVIDER=resend and required keys', () => {
      const env = parseEnv(validProductionEnv);
      expect(env.EMAIL_PROVIDER).toBe('resend');
      expect(env.EMAIL_API_KEY).toBe('re_test_config_only_not_real');
      expect(env.EMAIL_FROM_ADDRESS).toBe('invoices@example.test');
      expect(env.EMAIL_FROM_NAME).toBe('InvoiceFlow Test');
    });

    it('production without EMAIL_API_KEY fails closed', () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_API_KEY;
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production without EMAIL_FROM_ADDRESS fails closed', () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_FROM_ADDRESS;
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production without EMAIL_FROM_NAME fails closed', () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_FROM_NAME;
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('production with EMAIL_PROVIDER=mock fails closed', () => {
      const env = { ...validProductionEnv, EMAIL_PROVIDER: 'mock' };
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('test environment cannot activate real Resend', () => {
      const env = { ...baseValidEnv, NODE_ENV: 'test', EMAIL_PROVIDER: 'resend' };
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('development environment cannot activate real Resend', () => {
      const env = { ...baseValidEnv, NODE_ENV: 'development', EMAIL_PROVIDER: 'resend' };
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('invalid EMAIL_FROM_ADDRESS fails validation', () => {
      const env = { ...validProductionEnv, EMAIL_FROM_ADDRESS: 'invalid-email' };
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('EMAIL_FROM_NAME containing CR/LF fails validation', () => {
      const env = { ...validProductionEnv, EMAIL_FROM_NAME: 'Bad\nName' };
      expect(() => parseEnv(env)).toThrow('process.exit called');
    });

    it('EMAIL_FROM_NAME over frozen max length fails validation', () => {
      const env = { ...validProductionEnv, EMAIL_FROM_NAME: 'a'.repeat(101) };
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
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('EMAIL_PROVIDER', 'resend');
      vi.stubEnv('EMAIL_API_KEY', 'key');
      vi.stubEnv('EMAIL_FROM_ADDRESS', 'test@test.com');
      vi.stubEnv('EMAIL_FROM_NAME', 'test name');

      const dbUrlModule = await import('../../src/config/database-url');
      vi.spyOn(dbUrlModule, 'resolveRuntimeDatabaseUrl').mockImplementation(() => {
        throw 'Some string error';
      });

      const { parseEnv } = await import('../../src/config/env');
      expect(() => parseEnv(process.env)).toThrow('process.exit unexpectedly called');
    });
  });
});
