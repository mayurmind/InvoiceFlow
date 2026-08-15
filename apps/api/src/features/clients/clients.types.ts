import type { Client } from '../../generated/prisma/client';

export interface ClientResponse {
  id: string;
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
  notes: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientCreatePayload {
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
  notes: string | null;
}

export type ClientUpdatePayload = ClientCreatePayload;

export type ClientStatusFilter = 'active' | 'archived' | 'all';

export interface ClientListQuery {
  page: number;
  limit: number;
  search?: string;
  status: ClientStatusFilter;
  stateCode?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ClientListResponse {
  data: ClientResponse[];
  pagination: PaginationMeta;
}

// Helper to map a Prisma Client record to ClientResponse DTO
export function mapClientToResponse(client: Client): ClientResponse {
  return {
    id: client.id,
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
    notes: client.notes,
    isArchived: client.isArchived,
    archivedAt: client.archivedAt,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}
