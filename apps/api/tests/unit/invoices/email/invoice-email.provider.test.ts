import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ResendEmailProvider,
  getEmailProvider,
} from '../../../../src/features/invoices/email/invoice-email.provider';
import { env } from '../../../../src/config/env';

vi.mock('../../../../src/config/env', () => ({
  env: { EMAIL_PROVIDER: 'mock', EMAIL_API_KEY: 'test_key' },
}));

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => {
      return {
        emails: {
          send: vi.fn().mockImplementation(async (payload, options) => {
            if (options?.idempotencyKey === 'provider_error') {
              return { data: null, error: new Error('Provider error') };
            }
            if (options?.idempotencyKey === 'bad_req') {
              const err = new Error('invalid') as Error & { name?: string };
              err.name = 'invalid_idempotent_request';
              throw err;
            }
            if (options?.idempotencyKey === 'bad_key') {
              const err = new Error('invalid key') as Error & { name?: string };
              err.name = 'invalid_idempotency_key';
              throw err;
            }
            if (options?.idempotencyKey === 'concurrent') {
              const err = new Error('concurrent') as Error & { name?: string };
              err.name = 'concurrent_idempotent_requests';
              throw err;
            }
            if (payload.to === 'reject@example.com') {
              const err = new Error('reject') as Error & { name?: string; statusCode?: number };
              err.name = 'validation_error';
              err.statusCode = 400;
              throw err;
            }
            if (payload.to === 'timeout@example.com') {
              const err = new Error('timeout') as Error & { name?: string; statusCode?: number };
              err.name = 'mock_timeout';
              err.statusCode = 504;
              throw err;
            }
            if (payload.to === 'unresolved@example.com') {
              const err = new Error('unresolved') as Error & { name?: string; statusCode?: number };
              err.name = 'application_error';
              // no status code implies transport/unknown
              throw err;
            }
            if (payload.to === 'unknown@example.com') {
              throw new Error('Some random network error');
            }
            if (payload.to === 'no-id@example.com') {
              return { data: { id: null }, error: null };
            }
            if (payload.to === 'whitespace-id@example.com') {
              return { data: { id: '   ' }, error: null };
            }
            if (payload.to === 'oversized-id@example.com') {
              return { data: { id: 'a'.repeat(300) }, error: null };
            }
            return { data: { id: 'msg_123' }, error: null };
          }),
        },
      };
    }),
  };
});

describe('Invoice Email Provider', () => {
  let provider: ResendEmailProvider;

  beforeEach(() => {
    vi.stubEnv('EMAIL_API_KEY', 're_123456789');
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'test@invoiceflow.local');
    vi.stubEnv('EMAIL_FROM_NAME', 'InvoiceFlow Test');
    provider = new ResendEmailProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws error when EMAIL_API_KEY is missing', () => {
    const originalKey = env.EMAIL_API_KEY;
    env.EMAIL_API_KEY = '';
    try {
      expect(() => new ResendEmailProvider()).toThrow(
        'Resend provider instantiated without EMAIL_API_KEY',
      );
    } finally {
      env.EMAIL_API_KEY = originalKey;
    }
  });

  it('sends email successfully and returns message ID', async () => {
    const result = await provider.sendInvoiceEmail({
      to: 'test@example.com',
      subject: 'Test',
      htmlBody: '<p>Hi</p>',
      textBody: 'Hi',
      pdfBuffer: Buffer.from('pdf'),
      pdfFilename: 'invoice.pdf',
      idempotencyKey: 'key_1',
    });
    expect(result.provider).toBe('resend');
    expect(result.providerMessageId).toBe('msg_123');
  });

  it('throws mapped error for invalid_idempotent_request', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'bad_req',
      }),
    ).rejects.toThrow('Payload mismatch');
  });

  it('throws mapped error for invalid_idempotency_key', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'bad_key',
      }),
    ).rejects.toThrow('Local contract defect: invalid idempotency key format');
  });

  it('throws mapped error for concurrent_idempotent_requests', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'concurrent',
      }),
    ).rejects.toThrow('Attempt still in progress');
  });

  it('throws ResendAmbiguousError when ID is missing from success response', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'no-id@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('Invalid or missing provider message ID in successful response');
  });

  it('throws ResendAmbiguousError when ID is whitespace', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'whitespace-id@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('Invalid or missing provider message ID in successful response');
  });

  it('throws ResendAmbiguousError when ID is oversized', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'oversized-id@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('Invalid or missing provider message ID in successful response');
  });

  it('throws validation error on definitive rejection (4xx)', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'reject@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('reject');
  });

  it('throws ambiguous error on 5xx timeout', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'timeout@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('timeout');
  });

  it('throws ambiguous error on application_error with unresolved semantics', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'unresolved@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('unresolved');
  });

  it('throws ambiguous error on unknown SDK transport exception', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'unknown@example.com',
        subject: 'Test',
        htmlBody: 'H',
        textBody: 'H',
        pdfBuffer: Buffer.from('pdf'),
        pdfFilename: 'i.pdf',
        idempotencyKey: 'key_1',
      }),
    ).rejects.toThrow('Some random network error');
  });
});

describe('Mock Email Provider', () => {
  let provider: import('../../../../src/features/invoices/email/invoice-email.provider').InvoiceEmailProvider;
  beforeEach(async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'mock');
    const module = await import('../../../../src/features/invoices/email/invoice-email.provider');
    provider = module.getEmailProvider();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends email successfully', async () => {
    const result = await provider.sendInvoiceEmail({
      to: 'test@example.com',
      idempotencyKey: 'ok',
    } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput);
    expect(result.provider).toBe('mock');
    expect(result.providerMessageId).toContain('mock-id-');
  });

  it('throws invalid_idempotency_key', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        idempotencyKey: 'trigger_invalid_key',
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput),
    ).rejects.toThrow('Local contract defect');
  });

  it('throws invalid_idempotent_request', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        idempotencyKey: 'trigger_invalid_request',
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput),
    ).rejects.toThrow('Payload mismatch');
  });

  it('throws concurrent_idempotent_requests', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'test@example.com',
        idempotencyKey: 'trigger_concurrent',
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput),
    ).rejects.toThrow('Attempt still in progress');
  });

  it('throws validation_error', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'reject@example.com',
        idempotencyKey: 'ok',
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput),
    ).rejects.toThrow('Definitive rejection by mock provider');
  });

  it('throws mock_timeout', async () => {
    await expect(
      provider.sendInvoiceEmail({
        to: 'timeout@example.com',
        idempotencyKey: 'ok',
      } as unknown as import('../../../../src/features/invoices/email/invoice-email.types').SendInvoiceEmailInput),
    ).rejects.toThrow('Mock network timeout');
  });
  it('handles provider_error correctly', async () => {
    const resendProvider = new ResendEmailProvider();
    await expect(
      resendProvider.sendInvoiceEmail({
        to: 'test@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        textBody: 'Test',
        pdfBuffer: Buffer.from('test'),
        pdfFilename: 'test.pdf',
        idempotencyKey: 'provider_error',
      }),
    ).rejects.toThrow('Provider error');
  });

  describe('getEmailProvider', () => {
    it('returns MockEmailProvider when env.EMAIL_PROVIDER is mock', () => {
      env.EMAIL_PROVIDER = 'mock';
      const p = getEmailProvider();
      expect(p.constructor.name).toBe('MockEmailProvider');
    });

    it('returns ResendEmailProvider when env.EMAIL_PROVIDER is resend', () => {
      env.EMAIL_PROVIDER = 'resend';
      const p = getEmailProvider();
      expect(p.constructor.name).toBe('ResendEmailProvider');
      env.EMAIL_PROVIDER = 'mock'; // restore
    });
  });
});
