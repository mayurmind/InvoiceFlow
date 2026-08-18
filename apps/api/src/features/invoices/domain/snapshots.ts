import { BusinessSettings, Client } from '../../../generated/prisma/client';

export interface BusinessSnapshotV1 {
  version: 1;
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
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  upiId: string | null;
}

export interface ClientSnapshotV1 {
  version: 1;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
}

export function createBusinessSnapshotV1(settings: BusinessSettings): BusinessSnapshotV1 {
  return {
    version: 1,
    legalName: settings.legalName,
    displayName: settings.displayName,
    gstin: settings.gstin,
    pan: settings.pan,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    city: settings.city,
    state: settings.state,
    stateCode: settings.stateCode,
    postalCode: settings.postalCode,
    country: settings.country,
    email: settings.email,
    phone: settings.phone,
    logoStorageKey: settings.logoStorageKey,
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    bankName: settings.bankName,
    bankIfsc: settings.bankIfsc,
    upiId: settings.upiId,
  };
}

export function createClientSnapshotV1(client: Client): ClientSnapshotV1 {
  return {
    version: 1,
    clientId: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    gstin: client.gstin,
    pan: client.pan,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    city: client.city,
    state: client.state,
    stateCode: client.stateCode,
    postalCode: client.postalCode,
    country: client.country,
  };
}
