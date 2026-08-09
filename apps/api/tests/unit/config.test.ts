import { describe, it, expect, vi } from 'vitest';
import { parseEnv } from '../../src/config/env';

describe('Environment Validation', () => {
  it('accepts valid configuration and parses defaults', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/invoiceflow_test',
      PORT: '8080',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000, http://test.com',
    };

    const env = parseEnv(testEnv);

    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/invoiceflow_test');
    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.LOG_LEVEL).toBe('silent');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'http://test.com']);
  });

  it('fails securely on missing TEST_DATABASE_URL when NODE_ENV=test', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Invalid database configuration:',
      'TEST_DATABASE_URL is required when NODE_ENV=test.',
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('selects TEST_DATABASE_URL in test mode even with remote DATABASE_URL', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://runtime:runtime@db.example.supabase.co:5432/postgres',
      TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/invoiceflow_test',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/invoiceflow_test');
  });

  it('fails securely on unsafe remote TEST_DATABASE_URL in test mode', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://runtime:runtime@localhost:5432/db',
      TEST_DATABASE_URL: 'postgresql://test:test@db.example.supabase.co:5432/postgres',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Invalid database configuration:',
      'TEST_DATABASE_URL must target localhost or 127.0.0.1.',
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('development mode does not require TEST_DATABASE_URL', () => {
    const testEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('production mode does not require TEST_DATABASE_URL', () => {
    const testEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const env = parseEnv(testEnv);
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('fails securely on missing required DATABASE_URL', () => {
    const testEnv = {
      NODE_ENV: 'test',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely on invalid DATABASE_URL', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://user:pass@localhost/db',
      PORT: '5000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely on invalid PORT', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: 'invalid',
      CORS_ALLOWED_ORIGINS: 'http://localhost',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails securely on missing required CORS_ALLOWED_ORIGINS', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '5000',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv(testEnv)).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
