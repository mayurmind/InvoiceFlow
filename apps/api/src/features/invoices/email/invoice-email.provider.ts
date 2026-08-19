import { Resend } from 'resend';
import { SendInvoiceEmailInput, SendInvoiceEmailResult } from './invoice-email.types';
import { env } from '../../../config/env';

export interface EmailProvider {
  sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult>;
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;

  constructor() {
    if (!env.EMAIL_API_KEY) {
      throw new Error('Resend provider instantiated without EMAIL_API_KEY');
    }
    this.resend = new Resend(env.EMAIL_API_KEY);
  }

  async sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
    try {
      const response = await this.resend.emails.send(
        {
          from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
          to: input.to,
          subject: input.subject,
          html: input.htmlBody,
          text: input.textBody,
          attachments: [
            {
              content: input.pdfBuffer,
              filename: input.pdfFilename,
              contentType: 'application/pdf',
            },
          ],
        },
        {
          idempotencyKey: input.idempotencyKey,
        },
      );

      if (response.error) {
        // We throw to handle it as an ambiguous/failed outcome below
        throw response.error;
      }

      if (
        !response.data ||
        !response.data.id ||
        typeof response.data.id !== 'string' ||
        response.data.id.trim() === '' ||
        response.data.id.length > 255
      ) {
        // Missing or invalid ID means we can't confirm acceptance safely
        const err = new Error(
          'Invalid or missing provider message ID in successful response',
        ) as Error & { name?: string };
        err.name = 'ResendAmbiguousError';
        throw err;
      }

      return {
        provider: 'resend',
        providerMessageId: response.data.id,
      };
    } catch (error: unknown) {
      const err = error as Error & { name?: string; code?: string };
      if (err && err.name === 'invalid_idempotency_key') {
        const customErr = new Error(
          'Local contract defect: invalid idempotency key format',
        ) as Error & { name?: string };
        customErr.name = 'invalid_idempotency_key';
        throw customErr;
      }
      if (err && err.name === 'invalid_idempotent_request') {
        const customErr = new Error('Payload mismatch for existing idempotency key') as Error & {
          name?: string;
        };
        customErr.name = 'invalid_idempotent_request';
        throw customErr;
      }
      if (err && err.name === 'concurrent_idempotent_requests') {
        const customErr = new Error('Attempt still in progress') as Error & { name?: string };
        customErr.name = 'concurrent_idempotent_requests';
        throw customErr;
      }
      throw err;
    }
  }
}

export class MockEmailProvider implements EmailProvider {
  async sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
    // Development/test mock provider - zero external network.

    // Simulate invalid_idempotency_key
    if (input.idempotencyKey === 'trigger_invalid_key') {
      const err = new Error('Local contract defect') as Error & { name?: string };
      err.name = 'invalid_idempotency_key';
      throw err;
    }

    // Simulate invalid_idempotent_request
    if (input.idempotencyKey === 'trigger_invalid_request') {
      const err = new Error('Payload mismatch') as Error & { name?: string };
      err.name = 'invalid_idempotent_request';
      throw err;
    }

    // Simulate concurrent_idempotent_requests
    if (input.idempotencyKey === 'trigger_concurrent') {
      const err = new Error('Attempt still in progress') as Error & { name?: string };
      err.name = 'concurrent_idempotent_requests';
      throw err;
    }

    // Simulate definitive rejection
    if (input.to === 'reject@example.com') {
      const err = new Error('Definitive rejection by mock provider') as Error & {
        name?: string;
        statusCode?: number;
      };
      err.name = 'validation_error';
      throw err;
    }

    // Simulate ambiguous timeout / error
    if (input.to === 'timeout@example.com') {
      const err = new Error('Mock network timeout') as Error & {
        name?: string;
        statusCode?: number;
      };
      err.name = 'mock_timeout';
      throw err;
    }

    return {
      provider: 'mock',
      providerMessageId: `mock-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}

export function getEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === 'resend') {
    return new ResendEmailProvider();
  }
  return new MockEmailProvider();
}
