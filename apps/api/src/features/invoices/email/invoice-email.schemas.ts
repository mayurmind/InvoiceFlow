import { z } from 'zod';

export const sendInvoiceEmailBodySchema = z
  .object({})
  .strict('No body properties are allowed for this request.');

export const resendInvoiceEmailBodySchema = z
  .object({})
  .strict('No body properties are allowed for this request.');
