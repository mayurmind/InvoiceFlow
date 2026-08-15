import { z } from 'zod';
import { updateBusinessSettingsSchema } from './business-settings.schemas';

export type BusinessSettingsUpdatePayload = z.infer<typeof updateBusinessSettingsSchema.body>;

export interface BusinessSettingsDto {
  id: string;
  legalName: string;
  displayName: string;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  email: string | null;
  phone: string | null;
  logoStorageKey: string | null;
  invoicePrefix: string;
  defaultDueDays: number;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
