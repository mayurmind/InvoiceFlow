import { apiClient } from './client';

export interface BusinessSettings {
  id?: string;
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

export async function getBusinessSettingsApi(): Promise<{ settings: BusinessSettings }> {
  return apiClient<{ settings: BusinessSettings }>('/api/v1/business-settings');
}

export async function updateBusinessSettingsApi(
  settings: BusinessSettings,
): Promise<{ settings: BusinessSettings }> {
  return apiClient<{ settings: BusinessSettings }>('/api/v1/business-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
