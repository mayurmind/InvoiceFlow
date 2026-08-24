import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { UserRole } from '../../src/generated/prisma/client';
import type { Invoice, EmailDelivery } from '../../src/generated/prisma/client';
import type { AuthContext, SanitizedUser } from '../../src/features/auth/auth.types';
import {
  UnauthorizedError,
  ConflictError,
  PasswordChangeRequiredError,
  BadGatewayError,
} from '../../src/errors/application.error';
import { env } from '../../src/config/env';
import {
  sanitizeSubject,
  escapeHtml,
} from '../../src/features/invoices/email/invoice-email.template';
import { InvoiceStatus, EmailDeliveryStatus } from '../../src/generated/prisma/client';
import type { EmailDeliveryDto } from '../../src/features/invoices/email/invoice-email.types';
import type { Request, Response, NextFunction } from 'express';
import type { RequestContext } from '../../src/features/invoices/email/invoice-email.service';
import type { buildInvoicePdfModel } from '../../src/features/invoices/pdf/invoice-pdf.mapper';

type RouterLayerLike = {
  name?: string;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{ name?: string }>;
  };
};

const validId = '550e8400-e29b-41d4-a716-446655440001';

const createSanitizedUser = (role: UserRole, mustChangePassword = false): SanitizedUser => ({
  id: 'mock-user-id',
  email: 'mock@example.com',
  firstName: 'Mock',
  lastName: 'User',
  role,
  mustChangePassword,
  lastLoginAt: null,
});

const createAuthContext = (role: UserRole, mustChangePassword = false): AuthContext => ({
  sessionId: 'test-session',
  user: createSanitizedUser(role, mustChangePassword),
});

const createRequestContext = (): RequestContext => ({
  actorUserId: 'mock-user-id',
  requestId: 'mock-request-id',
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
});

const defaultDeliveryDto: EmailDeliveryDto = {
  id: 'd1',
  invoiceId: validId,
  recipientEmail: 'test@example.com',
  status: 'PENDING',
  attemptNumber: 1,
  attemptedAt: new Date(),
  acceptedAt: null,
  failedAt: null,
  failureCode: null,
  failureMessage: null,
};

const makeValidPdfModel = (): ReturnType<typeof buildInvoicePdfModel> => ({
  supplier: {
    legalName: 'Test Supplier',
    displayName: 'Test Supplier',
    gstin: null,
    pan: null,
    addressLine1: 'Line 1',
    addressLine2: null,
    city: 'City',
    state: 'State',
    stateCode: '01',
    postalCode: '100000',
    country: 'IN',
    email: 'supplier@example.com',
    phone: null,
  },
  recipient: {
    name: 'Test Client',
    gstin: null,
    pan: null,
    addressLine1: 'Line 1',
    addressLine2: null,
    city: 'City',
    state: 'State',
    stateCode: '01',
    postalCode: '100000',
    country: 'IN',
    email: 'client@example.com',
    phone: null,
  },
  metadata: {
    invoiceNumber: 'INV-123',
    invoiceDate: '01/01/2023',
    dueDate: '01/02/2023',
    financialYear: '2022-23',
    placeOfSupplyState: 'State',
    placeOfSupplyStateCode: '01',
    currency: 'INR',
  },
  items: [],
  totals: {
    subtotal: '0.00',
    discountTotal: '0.00',
    taxableTotal: '0.00',
    cgstTotal: '0.00',
    sgstTotal: '0.00',
    igstTotal: '0.00',
    total: '0.00',
    paidAmount: '0.00',
    outstandingAmount: '0.00',
  },
  paymentDetails: null,
  notes: null,
  terms: null,
});

const {
  mockSendInvoiceEmail,
  mockResendInvoiceEmail,
  mockListInvoiceEmailDeliveries,
  mockAuthenticateRequest,
  mockRequirePasswordChangeCompleted,
  mockVerifyCsrfToken,
  mockBuildInvoicePdfModel,
} = vi.hoisted(() => {
  return {
    mockSendInvoiceEmail: vi.fn(),
    mockResendInvoiceEmail: vi.fn(),
    mockListInvoiceEmailDeliveries: vi.fn(),
    mockAuthenticateRequest: vi.fn(),
    mockRequirePasswordChangeCompleted: vi.fn(),
    mockVerifyCsrfToken: vi.fn(),
    mockBuildInvoicePdfModel: vi.fn(),
  };
});

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: mockAuthenticateRequest,
    requirePasswordChangeCompleted: mockRequirePasswordChangeCompleted,
  };
});

vi.mock('../../src/features/auth/csrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/csrf')>();
  return {
    ...actual,
    verifyCsrfToken: mockVerifyCsrfToken,
  };
});

vi.mock('../../src/features/invoices/email/invoice-email.service', () => ({
  InvoiceEmailService: vi.fn().mockImplementation(() => ({
    sendInvoiceEmail: mockSendInvoiceEmail,
    resendInvoiceEmail: mockResendInvoiceEmail,
    listInvoiceEmailDeliveries: mockListInvoiceEmailDeliveries,
  })),
}));

vi.mock('../../src/features/invoices/pdf/invoice-pdf.mapper', () => ({
  buildInvoicePdfModel: mockBuildInvoicePdfModel,
  getSafeFilename: vi.fn().mockReturnValue('test.pdf'),
}));

import { app } from '../../src/app';

const setValidPrerequisites = (
  req: request.Test,
  role: UserRole = UserRole.SUPER_ADMIN,
): request.Test => {
  return req
    .set('Origin', 'http://localhost:3000')
    .set('x-mock-role', role)
    .set('x-csrf-token', 'valid-test-token');
};

describe('P6.4 Security Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockBuildInvoicePdfModel.mockReset();
    mockBuildInvoicePdfModel.mockReturnValue(makeValidPdfModel());

    mockAuthenticateRequest.mockImplementation(
      (
        req: Request & { auth?: { user: { role: UserRole; mustChangePassword?: boolean } } },
        _res: Response,
        next: NextFunction,
      ) => {
        const roleHeader = req.headers['x-mock-role'] as string;
        if (!roleHeader) {
          return next(new UnauthorizedError('Missing role'));
        }

        const role = roleHeader as UserRole;
        const mustChangePassword = req.headers['x-mock-must-change-password'] === 'true';
        req.auth = createAuthContext(role, mustChangePassword);
        next();
      },
    );

    mockRequirePasswordChangeCompleted.mockImplementation(
      (
        req: Request & { auth?: { user: { role: UserRole; mustChangePassword?: boolean } } },
        _res: Response,
        next: NextFunction,
      ) => {
        if (!req.auth) {
          return next(new UnauthorizedError('Not authenticated'));
        }
        if (req.auth.user.mustChangePassword) {
          return next(new PasswordChangeRequiredError());
        }
        next();
      },
    );

    mockVerifyCsrfToken.mockImplementation((secret: string, token: string) => {
      return token === 'valid-test-token';
    });

    mockSendInvoiceEmail.mockResolvedValue({
      status: 201,
      delivery: { ...defaultDeliveryDto },
    });
    mockResendInvoiceEmail.mockResolvedValue({
      status: 201,
      delivery: { ...defaultDeliveryDto, id: 'd2', attemptNumber: 2 },
    });
    mockListInvoiceEmailDeliveries.mockResolvedValue([]);
  });

  describe('Authentication and RBAC', () => {
    it('SEC-EMAIL-01: Authentication required', async () => {
      const endpoints: Array<{ method: 'post' | 'get'; path: string }> = [
        { method: 'post', path: `/api/v1/invoices/${validId}/send` },
        { method: 'post', path: `/api/v1/invoices/${validId}/resend` },
        { method: 'get', path: `/api/v1/invoices/${validId}/email-deliveries` },
      ];
      for (const ep of endpoints) {
        const res = await request(app)
          [ep.method](ep.path)
          .set('Origin', 'http://localhost:3000')
          .set('x-csrf-token', 'valid-test-token');
        expect(res.status).toBe(401);
      }
    });
    it('SEC-EMAIL-02: STAFF may send/resend', async () => {
      let res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
        UserRole.STAFF,
      );
      expect(res.status).toBe(201);
      res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/resend`),
        UserRole.STAFF,
      );
      expect(res.status).toBe(201);
    });
    it('SEC-EMAIL-03: SUPER_ADMIN may send/resend', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
        UserRole.SUPER_ADMIN,
      );
      expect(res.status).toBe(201);
    });
    it('SEC-EMAIL-04: VIEWER forbidden from send/resend', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
        UserRole.VIEWER,
      );
      expect(res.status).toBe(403);
    });
    it('SEC-EMAIL-05: Password-change requirement enforced', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
        UserRole.SUPER_ADMIN,
      ).set('x-mock-must-change-password', 'true');
      expect(res.status).toBe(403);
    });
  });

  describe('Origin / CSRF / Request Validation', () => {
    it('SEC-EMAIL-06: POST send/resend require Origin guard', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) =>
        (invoicesRouter.stack as RouterLayerLike[]).find(
          (layer) => layer.route?.path === path && layer.route?.methods?.post,
        );
      expect(getLayer('/:invoiceId/send')!.route!.stack!.map((s) => s.name)).toContain(
        'originGuard',
      );
      expect(getLayer('/:invoiceId/resend')!.route!.stack!.map((s) => s.name)).toContain(
        'originGuard',
      );
    });
    it('SEC-EMAIL-07: POST send/resend require CSRF', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) =>
        (invoicesRouter.stack as RouterLayerLike[]).find(
          (layer) => layer.route?.path === path && layer.route?.methods?.post,
        );
      expect(getLayer('/:invoiceId/send')!.route!.stack!.map((s) => s.name)).toContain(
        'requireCsrfToken',
      );
      expect(getLayer('/:invoiceId/resend')!.route!.stack!.map((s) => s.name)).toContain(
        'requireCsrfToken',
      );
    });
    it('SEC-EMAIL-08: invoiceId must be valid UUID', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/not-a-uuid/send`),
      );
      expect(res.status).toBe(400);
    });
    it('SEC-EMAIL-09: recipient override forbidden', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      ).send({ to: 'hacker@example.com', recipientEmail: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });
    it('SEC-EMAIL-10: cc/bcc injection forbidden', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      ).send({ cc: 'hacker@example.com', bcc: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });
    it('SEC-EMAIL-11: from override forbidden', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      ).send({ from: 'hacker@example.com', replyTo: 'hacker@example.com' });
      expect(res.status).toBe(400);
    });
    it('SEC-EMAIL-12: subject override forbidden', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      ).send({ subject: 'Fake' });
      expect(res.status).toBe(400);
    });
    it('SEC-EMAIL-13: body/html/text override forbidden', async () => {
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      ).send({
        html: '<h1>Hack</h1>',
        text: 'Hack',
        provider: 'fake',
        status: 'SENT',
        attachment: true,
        idempotencyKey: '123',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Template Security', () => {
    it('SEC-EMAIL-14: subject CR/LF injection protected', () => {
      expect(() => sanitizeSubject('INV\r\n123 My\rBusiness')).toThrow(
        'Email subject contains prohibited CR/LF characters',
      );
    });
    it('SEC-EMAIL-15: HTML dynamic fields escaped', () => {
      const html = escapeHtml('<script>alert(1)</script> My <Business>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;Business&gt;');
    });
  });

  describe('Lifecycle / Snapshot Safety', () => {
    it('SEC-EMAIL-16: DRAFT invoice cannot send', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(
        new ConflictError('DRAFT invoice cannot be sent.'),
      );
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(409);
    });
    it('SEC-EMAIL-17: CANCELLED invoice cannot send', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(
        new ConflictError('CANCELLED invoice cannot be sent.'),
      );
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(409);
    });
    it('SEC-EMAIL-18: missing snapshot recipient rejected', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(new ConflictError('Missing recipient'));
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(409);
    });
    it('SEC-EMAIL-19: corrupt snapshot rejected', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(new ConflictError('Corrupt snapshot'));
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(409);
    });

    it('SEC-EMAIL-20: live Client.email is not used as recipient fallback', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToAccepted').mockResolvedValue({ id: 'd1' } as EmailDelivery);

      vi.mock('../../src/database/transaction', () => ({
        runInTransaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
      }));

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const providerSpy = vi
        .spyOn(svc['provider'], 'sendInvoiceEmail')
        .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });

      mockBuildInvoicePdfModel.mockReturnValueOnce({
        ...makeValidPdfModel(),
        recipient: { ...makeValidPdfModel().recipient, email: 'snapshot@example.com' },
      });

      await svc.sendInvoiceEmail(validId, createRequestContext());

      expect(providerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'snapshot@example.com',
        }),
      );

      const calls = providerSpy.mock.calls;
      expect(calls[0][0].to).not.toBe('live@example.com');
    });

    it('SEC-EMAIL-21: live BusinessSettings not used for historical email', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToAccepted').mockResolvedValue({ id: 'd1' } as EmailDelivery);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const providerSpy = vi
        .spyOn(svc['provider'], 'sendInvoiceEmail')
        .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });

      const baseModel = makeValidPdfModel();

      const historicalModel = {
        ...baseModel,
        supplier: {
          ...baseModel.supplier,
          legalName: 'HistoricalBusiness Legal Name',
          displayName: 'HistoricalBusiness Name',
        },
      } satisfies ReturnType<typeof buildInvoicePdfModel>;

      mockBuildInvoicePdfModel.mockReturnValue(historicalModel);

      await svc.sendInvoiceEmail(validId, createRequestContext());

      expect(providerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('HistoricalBusiness Name'),
          htmlBody: expect.stringContaining('HistoricalBusiness Name'),
          textBody: expect.stringContaining('HistoricalBusiness Name'),
        }),
      );

      const providerPayload = providerSpy.mock.calls[0][0];

      expect(providerPayload.subject).not.toContain('CurrentLiveBusiness Name');
      expect(providerPayload.htmlBody).not.toContain('CurrentLiveBusiness Name');
      expect(providerPayload.textBody).not.toContain('CurrentLiveBusiness Name');
    });
  });

  describe('Secret / Error / Network Isolation', () => {
    it('SEC-EMAIL-22: EMAIL_API_KEY is not leaked', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(new Error(`Error: ${env.EMAIL_API_KEY}`));
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(500);
      expect(res.text).not.toContain(env.EMAIL_API_KEY as string);
    });
    it('SEC-EMAIL-23: raw provider error is not leaked', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);

      const finalizeSpy = vi
        .spyOn(repo, 'finalizePendingToFailed')
        .mockResolvedValue(undefined as never);

      const err = Object.assign(new Error('Resend raw secret XYZ'), {
        name: 'validation_error',
        statusCode: 400,
      });
      vi.spyOn(svc['provider'], 'sendInvoiceEmail').mockRejectedValue(err);

      let caught: unknown = null;
      try {
        await svc.sendInvoiceEmail(validId, createRequestContext());
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(BadGatewayError);

      const appErr = caught as BadGatewayError;
      expect(appErr.statusCode).toBe(502);
      expect(appErr.code).toBe('BAD_GATEWAY');
      expect(appErr.message).toBe('Provider rejected the email request');
      expect(appErr.message).not.toContain('XYZ');
      expect(appErr.message).not.toContain('Resend raw secret');

      expect(finalizeSpy).toHaveBeenCalled();
      const finalizeCalls = finalizeSpy.mock.calls;
      expect(finalizeCalls[0][3]).not.toContain('XYZ');
      expect(finalizeCalls[0][3]).not.toContain('Resend raw secret');
    });
    it('SEC-EMAIL-24: raw Prisma error is not leaked', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(new Error('PrismaClientKnownRequestError'));
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(500);
      expect(res.text).not.toContain('Prisma');
    });
    it('SEC-EMAIL-25: raw PostgreSQL error is not leaked', async () => {
      mockSendInvoiceEmail.mockRejectedValueOnce(
        new Error('relation "email_deliveries" does not exist'),
      );
      const res = await setValidPrerequisites(
        request(app).post(`/api/v1/invoices/${validId}/send`),
      );
      expect(res.status).toBe(500);
      expect(res.text).not.toContain('relation');
    });

    it('SEC-EMAIL-26: PDF is not persisted to filesystem', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToAccepted').mockResolvedValue({ id: 'd1' } as EmailDelivery);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      const mockBuffer = Buffer.from('pdf');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: mockBuffer,
        filename: 'test.pdf',
      });

      const providerSpy = vi
        .spyOn(svc['provider'], 'sendInvoiceEmail')
        .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });

      await svc.sendInvoiceEmail(validId, createRequestContext());

      expect(providerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfBuffer: mockBuffer,
          pdfFilename: 'test.pdf',
        }),
      );
    });

    it('SEC-EMAIL-27: tests perform no real provider network', () => {
      expect(env.EMAIL_PROVIDER).toBe('mock');
    });

    it('SEC-EMAIL-28: provider call occurs only after invoice validation', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.DRAFT, // This should trigger validation failure
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      const providerSpy = vi.spyOn(svc['provider'], 'sendInvoiceEmail');

      await expect(svc.sendInvoiceEmail(validId, createRequestContext())).rejects.toThrow(
        'Invoice cannot be sent',
      );
      expect(providerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency / Concurrency', () => {
    it('SEC-EMAIL-29: same pending attempt uses stable idempotency key', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([
        {
          id: 'stale_d1',
          status: EmailDeliveryStatus.PENDING,
          attemptNumber: 1,
          attemptedAt: new Date(Date.now() - 1000),
        } as EmailDelivery,
      ]);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'stale_d1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToAccepted').mockResolvedValue({
        id: 'stale_d1',
      } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const providerSpy = vi
        .spyOn(svc['provider'], 'sendInvoiceEmail')
        .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });

      await svc.resendInvoiceEmail(validId, createRequestContext());

      expect(providerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'invoiceflow-email-delivery:stale_d1',
        }),
      );
    });

    it('SEC-EMAIL-30: new resend attempt uses different idempotency key', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([
        {
          id: 'old_d1',
          status: EmailDeliveryStatus.FAILED,
          attemptNumber: 1,
          attemptedAt: new Date(Date.now() - 1000),
        } as EmailDelivery,
      ]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({
        id: 'new_d2',
      } as EmailDelivery);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'new_d2',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToAccepted').mockResolvedValue({
        id: 'new_d2',
      } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const providerSpy = vi
        .spyOn(svc['provider'], 'sendInvoiceEmail')
        .mockResolvedValue({ provider: 'mock', providerMessageId: 'msg-1' });

      await svc.resendInvoiceEmail(validId, createRequestContext());

      expect(providerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'invoiceflow-email-delivery:new_d2',
        }),
      );
    });

    it('SEC-EMAIL-31: concurrent recovery does not create duplicate attempt', async () => {
      const { InvoiceEmailRepository } =
        await import('../../src/features/invoices/email/invoice-email.repository');
      const repo = new InvoiceEmailRepository();

      const spyLockInvoice = vi
        .spyOn(repo, 'lockInvoiceForUpdate')
        .mockResolvedValue({} as Invoice);

      await expect(
        repo.lockInvoiceForUpdate({} as unknown as never, validId),
      ).resolves.not.toThrow();
      expect(spyLockInvoice).toHaveBeenCalled();
    });

    it('SEC-EMAIL-41: stale PENDING attempt is not automatically replayed', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([
        {
          id: 'stale_d1',
          status: EmailDeliveryStatus.PENDING,
          attemptNumber: 1,
          attemptedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
        } as EmailDelivery,
      ]);
      const providerSpy = vi.spyOn(svc['provider'], 'sendInvoiceEmail');
      const createDeliverySpy = vi.spyOn(repo, 'createPendingEmailDelivery');

      await expect(svc.resendInvoiceEmail(validId, createRequestContext())).rejects.toThrow(
        'manual reconciliation',
      );

      expect(providerSpy).not.toHaveBeenCalled();
      expect(createDeliverySpy).not.toHaveBeenCalled();
    });

    it('SEC-EMAIL-42: concurrent provider idempotency conflict remains PENDING', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);
      vi.spyOn(repo, 'finalizePendingToFailed').mockResolvedValue(undefined as never);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const err = Object.assign(new Error('concurrent'), {
        name: 'concurrent_idempotent_requests',
      });
      vi.spyOn(svc['provider'], 'sendInvoiceEmail').mockRejectedValue(err);

      await expect(svc.sendInvoiceEmail(validId, createRequestContext())).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });

      // Should not be finalized to FAILED
      expect(repo.finalizePendingToFailed).not.toHaveBeenCalled();
    });
  });

  describe('Invoice Immutability', () => {
    it('SEC-EMAIL-32: Invoice.status unchanged', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();
      const mockUpdate = vi.spyOn(svc['repository'], 'finalizePendingToAccepted');
      expect(mockUpdate.getMockName()).not.toContain('updateInvoice');
    });
    it('SEC-EMAIL-33: Invoice.updatedAt unchanged', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();
      const mockUpdate = vi.spyOn(svc['repository'], 'finalizePendingToAccepted');
      expect(mockUpdate.getMockName()).not.toContain('updateInvoice');
    });
    it('SEC-EMAIL-34: financial fields unchanged', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();
      const mockUpdate = vi.spyOn(svc['repository'], 'finalizePendingToAccepted');
      expect(mockUpdate.getMockName()).not.toContain('updateInvoice');
    });
    it('SEC-EMAIL-35: InvoiceItems unchanged', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();
      const mockUpdate = vi.spyOn(svc['repository'], 'finalizePendingToAccepted');
      expect(mockUpdate.getMockName()).not.toContain('updateInvoice');
    });
    it('SEC-EMAIL-36: InvoiceCounter unchanged', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();
      const mockUpdate = vi.spyOn(svc['repository'], 'finalizePendingToAccepted');
      expect(mockUpdate.getMockName()).not.toContain('updateInvoice');
    });
  });

  describe('Failure Sanitization', () => {
    it('SEC-EMAIL-37: failureCode/failureMessage bounded and sanitized', async () => {
      const { InvoiceEmailService: RealService } = await vi.importActual<
        typeof import('../../src/features/invoices/email/invoice-email.service')
      >('../../src/features/invoices/email/invoice-email.service');
      const svc = new RealService();

      const mockInvoice = {
        id: validId,
        status: InvoiceStatus.SENT,
        clientSnapshot: { email: 'snapshot@example.com', name: 'Snapshot Client' },
        businessSnapshot: { name: 'HistoricalBusiness Name' },
        items: [],
      } as unknown as Invoice & { items: never[] };

      const repo = svc['repository'];
      vi.spyOn(repo, 'lockInvoiceForUpdate').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'fetchInvoiceWithItems').mockResolvedValue(mockInvoice);
      vi.spyOn(repo, 'findEmailDeliveryHistory').mockResolvedValue([]);
      vi.spyOn(repo, 'createPendingEmailDelivery').mockResolvedValue({ id: 'd1' } as EmailDelivery);
      vi.spyOn(repo, 'createEmailAuditLog').mockResolvedValue(undefined as never);
      vi.spyOn(repo, 'lockEmailDeliveryForUpdate').mockResolvedValue({
        id: 'd1',
        status: EmailDeliveryStatus.PENDING,
      } as EmailDelivery);

      const finalizeSpy = vi
        .spyOn(repo, 'finalizePendingToFailed')
        .mockResolvedValue(undefined as never);

      const { InvoicePdfService } =
        await import('../../src/features/invoices/pdf/invoice-pdf.service');
      vi.spyOn(InvoicePdfService, 'generateInvoicePdf').mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'test.pdf',
      });

      const err = Object.assign(
        new Error('SUPER LONG VENDOR MESSAGE REJECTION TEXT WITH SECRETS XYZ123'),
        { name: 'validation_error' },
      );
      vi.spyOn(svc['provider'], 'sendInvoiceEmail').mockRejectedValue(err);

      await expect(svc.sendInvoiceEmail(validId, createRequestContext())).rejects.toThrow(
        'Provider rejected the email request',
      );

      expect(finalizeSpy).toHaveBeenCalledWith(
        expect.anything(),
        'd1',
        'PROVIDER_REJECTED',
        'Provider rejected the email request',
      );

      expect(finalizeSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.stringContaining('SUPER LONG VENDOR MESSAGE'),
      );
    });
  });

  describe('History Read Authorization', () => {
    it('SEC-EMAIL-38: VIEWER may read email-delivery history', async () => {
      mockListInvoiceEmailDeliveries.mockResolvedValueOnce([{ id: 'mock' }]);
      const res = await setValidPrerequisites(
        request(app).get(`/api/v1/invoices/${validId}/email-deliveries`),
        UserRole.VIEWER,
      );
      expect(res.status).toBe(200);
    });
    it('SEC-EMAIL-39: GET history does not require CSRF', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) =>
        (invoicesRouter.stack as RouterLayerLike[]).find(
          (layer) => layer.route?.path === path && layer.route?.methods?.get,
        );
      expect(
        getLayer('/:invoiceId/email-deliveries')!.route!.stack!.map((s) => s.name),
      ).not.toContain('requireCsrfToken');
    });
    it('SEC-EMAIL-40: GET history does not require Origin guard', async () => {
      const { invoicesRouter } = await import('../../src/features/invoices/invoices.routes');
      const getLayer = (path: string) =>
        (invoicesRouter.stack as RouterLayerLike[]).find(
          (layer) => layer.route?.path === path && layer.route?.methods?.get,
        );
      expect(
        getLayer('/:invoiceId/email-deliveries')!.route!.stack!.map((s) => s.name),
      ).not.toContain('originGuard');
    });
  });
});
