import { describe, it, expect, vi } from 'vitest';
import { parseEnv } from '../../src/config/env';

describe('Environment Validation', () => {
  it('accepts valid configuration and parses defaults', () => {
    const testEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '8080',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000, http://test.com',
    };

    const env = parseEnv(testEnv);

    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.LOG_LEVEL).toBe('silent');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'http://test.com']);
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
