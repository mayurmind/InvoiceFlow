export interface BusinessSettings {
  id: string;
  organizationId: string;
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
  country: 'India';
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
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBusinessSettingsRequest {
  legalName: string;
  displayName: string;
  gstin?: string | null;
  pan?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: 'India';
  email?: string | null;
  phone?: string | null;
  logoStorageKey?: string | null;
  invoicePrefix: string;
  defaultDueDays: number;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
}
